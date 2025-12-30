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
  flushing_.store(true);
  queue_cv_.notify_one();

  // Wait for queue to drain
  std::unique_lock<std::mutex> lock(queue_mutex_);
  queue_cv_.wait(lock, [this] {
    return task_queue_.empty() || !running_.load();
  });

  flushing_.store(false);
}

size_t AsyncEncodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(queue_mutex_));
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

void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Copy packet data for thread-safe transfer
  auto* chunk_data = new std::vector<uint8_t>(pkt->data, pkt->data + pkt->size);
  int64_t pts = pkt->pts;
  int64_t duration = pkt->duration;
  bool is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;

  output_tsfn_.NonBlockingCall(
      chunk_data,
      [pts, duration, is_key](Napi::Env env, Napi::Function fn,
                               std::vector<uint8_t>* data) {
        Napi::Object init = Napi::Object::New(env);
        init.Set("type", is_key ? "key" : "delta");
        init.Set("timestamp", static_cast<double>(pts));
        init.Set("duration", static_cast<double>(duration));
        init.Set("data",
                 Napi::Buffer<uint8_t>::Copy(env, data->data(), data->size()));

        // Create EncodedVideoChunk via its constructor
        Napi::Function constructor = env.Global()
            .Get("EncodedVideoChunk").As<Napi::Function>();
        Napi::Object chunk = constructor.New({init});

        fn.Call({chunk});
        delete data;
      });
}
