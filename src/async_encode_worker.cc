// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncEncodeWorker implementation for non-blocking video encoding.

#include "src/async_encode_worker.h"

#include <string>
#include <utility>
#include <vector>

#include "src/encoded_video_chunk.h"
#include "src/video_encoder.h"

AsyncEncodeWorker::AsyncEncodeWorker(VideoEncoder* encoder,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : encoder_(encoder),
      output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr) {}

void AsyncEncodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  codec_context_ = ctx;
  sws_context_ = sws;
  width_ = width;
  height_ = height;
  frame_ = av_frame_alloc();
  if (frame_) {
    frame_->format = AV_PIX_FMT_YUV420P;
    frame_->width = width;
    frame_->height = height;
    av_frame_get_buffer(frame_, 32);
  }
  packet_ = av_packet_alloc();
}

void AsyncEncodeWorker::SetMetadataConfig(const EncoderMetadataConfig& config) {
  metadata_config_ = config;
}

AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
}

void AsyncEncodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncEncodeWorker::WorkerThread, this);
}

void AsyncEncodeWorker::Stop() {
  if (!running_.load()) return;

  running_.store(false);
  queue_cv_.notify_all();

  if (worker_thread_.joinable()) {
    worker_thread_.join();
  }
}

void AsyncEncodeWorker::Enqueue(EncodeTask task) {
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}

void AsyncEncodeWorker::Flush() {
  // Enqueue a flush task to drain FFmpeg's internal buffers
  EncodeTask flush_task;
  flush_task.is_flush = true;
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(flush_task));
  }
  queue_cv_.notify_one();

  flushing_.store(true);

  // Wait for queue to drain (including flush task)
  {
    std::unique_lock<std::mutex> lock(queue_mutex_);
    queue_cv_.wait(lock, [this] {
      return task_queue_.empty() || !running_.load();
    });
  }

  flushing_.store(false);
}

size_t AsyncEncodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return task_queue_.size();
}

void AsyncEncodeWorker::WorkerThread() {
  while (running_.load()) {
    EncodeTask task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      queue_cv_.wait(lock, [this] {
        return !task_queue_.empty() || !running_.load() || flushing_.load();
      });

      if (!running_.load()) break;

      if (task_queue_.empty()) {
        if (flushing_.load()) {
          queue_cv_.notify_all();
        }
        continue;
      }

      task = std::move(task_queue_.front());
      task_queue_.pop();
    }

    ProcessFrame(task);

    if (task_queue_.empty()) {
      queue_cv_.notify_all();
    }
  }
}

void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }

  // Handle flush task - send NULL frame to drain encoder
  if (task.is_flush) {
    avcodec_send_frame(codec_context_, nullptr);
    // Drain all remaining packets
    while (avcodec_receive_packet(codec_context_, packet_) == 0) {
      EmitChunk(packet_);
      av_packet_unref(packet_);
    }
    return;
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_data[1] = {task.rgba_data.data()};
  int src_linesize[1] = {width_ * 4};

  sws_scale(sws_context_, src_data, src_linesize, 0, height_,
            frame_->data, frame_->linesize);

  frame_->pts = task.timestamp;

  int ret = avcodec_send_frame(codec_context_, frame_);
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    std::string error_msg = "Encode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }

  while (avcodec_receive_packet(codec_context_, packet_) == 0) {
    EmitChunk(packet_);
    av_packet_unref(packet_);
  }
}

// Structure to pass all chunk info through TSFN callback
struct ChunkCallbackData {
  std::vector<uint8_t> data;
  int64_t pts;
  int64_t duration;
  bool is_key;
  EncoderMetadataConfig metadata;
  std::vector<uint8_t> extradata;  // Copy from codec_context at emit time
  std::atomic<int>* pending;
};

void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Increment pending count before async operation
  pending_chunks_.fetch_add(1);

  // Create callback data with all info needed on main thread
  auto* cb_data = new ChunkCallbackData();
  cb_data->data.assign(pkt->data, pkt->data + pkt->size);
  cb_data->pts = pkt->pts;
  cb_data->duration = pkt->duration;
  cb_data->is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;
  cb_data->metadata = metadata_config_;
  // Copy extradata from codec_context at emit time (may be set after configure)
  if (codec_context_ && codec_context_->extradata &&
      codec_context_->extradata_size > 0) {
    cb_data->extradata.assign(
        codec_context_->extradata,
        codec_context_->extradata + codec_context_->extradata_size);
  }
  cb_data->pending = &pending_chunks_;

  output_tsfn_.NonBlockingCall(
      cb_data,
      [](Napi::Env env, Napi::Function fn, ChunkCallbackData* info) {
        // Create EncodedVideoChunk-like object (matches synchronous path)
        Napi::Object chunk = Napi::Object::New(env);
        chunk.Set("type", info->is_key ? "key" : "delta");
        chunk.Set("timestamp", Napi::Number::New(env, info->pts));
        chunk.Set("duration", Napi::Number::New(env, info->duration));
        chunk.Set("data", Napi::Buffer<uint8_t>::Copy(env, info->data.data(),
                                                       info->data.size()));

        // Create metadata object matching sync path
        Napi::Object metadata = Napi::Object::New(env);

        // Add SVC metadata per W3C spec (base layer)
        Napi::Object svc = Napi::Object::New(env);
        svc.Set("temporalLayerId", Napi::Number::New(env, 0));
        metadata.Set("svc", svc);

        // Add decoderConfig for keyframes per W3C spec
        if (info->is_key) {
          Napi::Object decoder_config = Napi::Object::New(env);
          decoder_config.Set("codec", info->metadata.codec_string);
          decoder_config.Set("codedWidth",
                             Napi::Number::New(env, info->metadata.coded_width));
          decoder_config.Set("codedHeight",
                             Napi::Number::New(env, info->metadata.coded_height));
          decoder_config.Set(
              "displayAspectWidth",
              Napi::Number::New(env, info->metadata.display_width));
          decoder_config.Set(
              "displayAspectHeight",
              Napi::Number::New(env, info->metadata.display_height));

          // Add description (extradata) if available
          if (!info->extradata.empty()) {
            decoder_config.Set(
                "description",
                Napi::Buffer<uint8_t>::Copy(env, info->extradata.data(),
                                            info->extradata.size()));
          }

          // Add colorSpace to decoderConfig if configured
          if (!info->metadata.color_primaries.empty() ||
              !info->metadata.color_transfer.empty() ||
              !info->metadata.color_matrix.empty()) {
            Napi::Object color_space = Napi::Object::New(env);
            if (!info->metadata.color_primaries.empty()) {
              color_space.Set("primaries", info->metadata.color_primaries);
            }
            if (!info->metadata.color_transfer.empty()) {
              color_space.Set("transfer", info->metadata.color_transfer);
            }
            if (!info->metadata.color_matrix.empty()) {
              color_space.Set("matrix", info->metadata.color_matrix);
            }
            color_space.Set("fullRange", info->metadata.color_full_range);
            decoder_config.Set("colorSpace", color_space);
          }

          metadata.Set("decoderConfig", decoder_config);
        }

        fn.Call({chunk, metadata});

        // Decrement pending count after callback completes
        info->pending->fetch_sub(1);
        delete info;
      });
}
