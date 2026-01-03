// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncEncodeWorker implementation for non-blocking video encoding.

#include "src/async_encode_worker.h"

#include <chrono>
#include <cstdio>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/common.h"
#include "src/encoded_video_chunk.h"
#include "src/video_encoder.h"

namespace {

// Compute temporal layer ID based on frame position and layer count.
// Uses standard WebRTC temporal layering pattern.
// Note: Duplicated from video_encoder.cc to avoid exposing in header.
int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count) {
  if (temporal_layer_count <= 1) return 0;

  if (temporal_layer_count == 2) {
    // L1T2: alternating pattern [0, 1, 0, 1, ...]
    return (frame_index % 2 == 0) ? 0 : 1;
  }

  // L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
  int pos = frame_index % 4;
  if (pos == 0) return 0;  // Base layer
  if (pos == 2) return 1;  // Middle layer
  return 2;                // Enhancement layer (pos 1, 3)
}

}  // namespace

AsyncEncodeWorker::AsyncEncodeWorker(VideoEncoder* /* encoder */,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr) {}

void AsyncEncodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  sws_context_ = sws;
  width_ = width;
  height_ = height;
  frame_ = ffmpeg::make_frame();
  if (frame_) {
    frame_->format = AV_PIX_FMT_YUV420P;
    frame_->width = width;
    frame_->height = height;
    int ret = av_frame_get_buffer(frame_.get(), 32);
    if (ret < 0) {
      frame_.reset();  // Clear on allocation failure
    }
  }
  packet_ = ffmpeg::make_packet();

  // DARWIN-X64 FIX: Mark codec as valid only after successful initialization.
  // ProcessFrame checks this flag to avoid accessing codec during shutdown.
  codec_valid_.store(true, std::memory_order_release);
}

void AsyncEncodeWorker::SetMetadataConfig(const EncoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}

AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  // frame_ and packet_ are RAII-managed, automatically cleaned up
}

void AsyncEncodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncEncodeWorker::WorkerThread, this);
}

void AsyncEncodeWorker::Stop() {
  // DARWIN-X64 FIX: Use stop_mutex_ to prevent double-stop race.
  // Cleanup() and destructor may both call Stop().
  std::lock_guard<std::mutex> stop_lock(stop_mutex_);

  if (!running_.load()) return;

  // DARWIN-X64 FIX: Invalidate codec FIRST, before signaling shutdown.
  // This prevents ProcessFrame from accessing codec_context_ during the
  // race window between setting running_=false and the worker thread exiting.
  codec_valid_.store(false, std::memory_order_release);

  {
    // CRITICAL: Hold mutex while modifying condition predicate to prevent
    // lost wakeup race on x86_64. Without mutex, there's a window where:
    // 1. Worker checks predicate (running_==true), starts entering wait()
    // 2. Main thread sets running_=false, calls notify_all()
    // 3. Worker enters wait() after notification - blocked forever
    std::lock_guard<std::mutex> lock(queue_mutex_);
    running_.store(false, std::memory_order_release);
  }
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

  // Wait for queue to drain AND all in-flight processing to complete
  {
    std::unique_lock<std::mutex> lock(queue_mutex_);
    queue_cv_.wait(lock, [this] {
      return (task_queue_.empty() && processing_.load() == 0) ||
             !running_.load();
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
      processing_++;  // Track that we're processing this task
    }

    ProcessFrame(task);

    // Decrement counter and notify under lock (fixes race condition).
    {
      std::lock_guard<std::mutex> lock(queue_mutex_);
      processing_--;
      if (task_queue_.empty() && processing_.load() == 0) {
        queue_cv_.notify_all();
      }
    }
  }
}

void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  // DARWIN-X64 FIX: Check codec_valid_ BEFORE acquiring mutex.
  // During shutdown, Stop() sets codec_valid_=false before running_=false.
  // This creates a window where the worker thread could still be running
  // but the codec is being destroyed. Early exit prevents the race.
  if (!codec_valid_.load(std::memory_order_acquire)) {
    return;
  }

  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }

  // Handle flush task - send NULL frame to drain encoder.
  // Note: After this, the codec enters EOF mode and won't accept new frames.
  // The VideoEncoder::Flush() method handles codec reinitialization after
  // the worker drains to allow continued encoding per W3C WebCodecs spec.
  if (task.is_flush) {
    avcodec_send_frame(codec_context_, nullptr);
    // Drain all remaining packets
    while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
      EmitChunk(packet_.get());
      av_packet_unref(packet_.get());
    }
    // Clear frame info map after flush
    frame_info_.clear();
    return;
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_data[1] = {task.rgba_data.data()};
  int src_linesize[1] = {width_ * 4};

  sws_scale(sws_context_, src_data, src_linesize, 0, height_, frame_->data,
            frame_->linesize);

  // Use frame_index as pts for consistent SVC layer computation
  // Store original timestamp/duration for lookup when emitting packets
  frame_->pts = task.frame_index;
  frame_info_[task.frame_index] =
      std::make_pair(task.timestamp, task.duration);

  // Apply per-frame quantizer if specified (matches sync path)
  if (task.quantizer >= 0) {
    frame_->quality = task.quantizer * FF_QP2LAMBDA;
  } else {
    frame_->quality = 0;  // Let encoder decide
  }

  int ret = avcodec_send_frame(codec_context_, frame_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    std::string error_msg = "Encode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          // If env is null, TSFN is closing during teardown. Just cleanup.
          if (env == nullptr) {
            delete msg;
            return;
          }
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }

  while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
    EmitChunk(packet_.get());
    av_packet_unref(packet_.get());
  }
}

// Structure to pass all chunk info through TSFN callback
struct ChunkCallbackData {
  std::vector<uint8_t> data;
  int64_t pts;
  int64_t duration;
  bool is_key;
  int64_t frame_index;  // For SVC layer computation
  EncoderMetadataConfig metadata;
  std::vector<uint8_t> extradata;  // Copy from codec_context at emit time
  // Use shared_ptr to pending counter so it remains valid even if worker is
  // destroyed before callback executes on main thread.
  std::shared_ptr<std::atomic<int>> pending;
};

void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Increment pending count before async operation
  pending_chunks_->fetch_add(1);

  // pkt->pts is the frame_index (set in ProcessFrame)
  int64_t frame_index = pkt->pts;

  // Look up original timestamp/duration from the map
  int64_t timestamp = 0;
  int64_t duration = 0;
  auto it = frame_info_.find(frame_index);
  if (it != frame_info_.end()) {
    timestamp = it->second.first;
    duration = it->second.second;
    frame_info_.erase(it);  // Clean up after use
  }

  // Create callback data with all info needed on main thread
  auto* cb_data = new ChunkCallbackData();
  cb_data->data.assign(pkt->data, pkt->data + pkt->size);
  cb_data->pts = timestamp;  // Use original timestamp, not frame_index
  cb_data->duration = duration;
  cb_data->is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;
  cb_data->frame_index = frame_index;  // For SVC layer computation
  cb_data->metadata = metadata_config_;
  // Copy extradata from codec_context at emit time (may be set after configure)
  if (codec_context_ && codec_context_->extradata &&
      codec_context_->extradata_size > 0) {
    cb_data->extradata.assign(
        codec_context_->extradata,
        codec_context_->extradata + codec_context_->extradata_size);
  }
  cb_data->pending = pending_chunks_;

  output_tsfn_.NonBlockingCall(cb_data, [](Napi::Env env, Napi::Function fn,
                                           ChunkCallbackData* info) {
    // CRITICAL: If env is null, the TSFN is being destroyed (environment teardown).
    // Must still clean up data and counters, then return to avoid crashing.
    // NOTE: Do NOT access static variables (like counterQueue) here - they may
    // already be destroyed due to static destruction order during process exit.
    if (env == nullptr) {
      info->pending->fetch_sub(1);
      // Skip counterQueue-- : static may be destroyed during process exit
      delete info;
      return;
    }

    // Decrement pending count before any operations
    info->pending->fetch_sub(1);
    webcodecs::counterQueue--;

    // Create native EncodedVideoChunk directly to avoid double-copy.
    // The data is copied once into the chunk's internal buffer.
    // Previously we created a plain JS object here, which the TS layer
    // would wrap in a new EncodedVideoChunk, causing a second copy.
    Napi::Object chunk = EncodedVideoChunk::CreateInstance(
        env, info->is_key ? "key" : "delta", info->pts, info->duration,
        info->data.data(), info->data.size());

    // Create metadata object matching sync path
    Napi::Object metadata = Napi::Object::New(env);

    // Add SVC metadata per W3C spec.
    // Compute temporal layer ID based on frame_index and scalabilityMode.
    Napi::Object svc = Napi::Object::New(env);
    int temporal_layer = ComputeTemporalLayerId(
        info->frame_index, info->metadata.temporal_layer_count);
    svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
    metadata.Set("svc", svc);

    // Add decoderConfig for keyframes per W3C spec
    if (info->is_key) {
      Napi::Object decoder_config = Napi::Object::New(env);
      decoder_config.Set("codec", info->metadata.codec_string);
      decoder_config.Set("codedWidth",
                         Napi::Number::New(env, info->metadata.coded_width));
      decoder_config.Set("codedHeight",
                         Napi::Number::New(env, info->metadata.coded_height));
      decoder_config.Set("displayAspectWidth",
                         Napi::Number::New(env, info->metadata.display_width));
      decoder_config.Set("displayAspectHeight",
                         Napi::Number::New(env, info->metadata.display_height));

      // Add description (extradata) if available
      if (!info->extradata.empty()) {
        decoder_config.Set("description", Napi::Buffer<uint8_t>::Copy(
                                              env, info->extradata.data(),
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

    // ChunkCallbackData is no longer tied to the buffer lifetime.
    // Delete it now that the data has been copied into the EncodedVideoChunk.
    delete info;
  });
}
