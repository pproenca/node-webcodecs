// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker implementation for non-blocking video decoding.

#include "src/async_decode_worker.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <string>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include "src/common.h"
#include "src/video_decoder.h"
#include "src/video_frame.h"

AsyncDecodeWorker::AsyncDecodeWorker(VideoDecoder* /* decoder */,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      output_width_(0),
      output_height_(0) {}

AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  // frame_, packet_, and sws_context_ are RAII-managed, automatically cleaned up
  // Note: codec_context_ is owned by VideoDecoder

  // Clean up buffer pool
  for (auto* buffer : buffer_pool_) {
    delete buffer;
  }
  buffer_pool_.clear();
}

void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx,
                                        SwsContext* /* sws_unused */,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  // sws_context_ is created lazily in EmitFrame when we know the frame format
  sws_context_.reset();
  output_width_ = width;
  output_height_ = height;
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();

  // DARWIN-X64 FIX: Mark codec as valid only after successful initialization.
  // ProcessPacket checks this flag to avoid accessing codec during shutdown.
  codec_valid_.store(true, std::memory_order_release);
}

void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}

void AsyncDecodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncDecodeWorker::WorkerThread, this);
}

void AsyncDecodeWorker::Stop() {
  // DARWIN-X64 FIX: Use stop_mutex_ to prevent double-stop race.
  // Cleanup() and destructor may both call Stop().
  std::lock_guard<std::mutex> stop_lock(stop_mutex_);

  if (!running_.load()) return;

  // DARWIN-X64 FIX: Invalidate codec FIRST, before signaling shutdown.
  // This prevents ProcessPacket from accessing codec_context_ during the
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

void AsyncDecodeWorker::Enqueue(DecodeTask task) {
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}

void AsyncDecodeWorker::Flush() {
  // Enqueue a flush task to drain FFmpeg's internal frame buffers
  DecodeTask flush_task;
  flush_task.is_flush = true;
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(flush_task));
  }
  queue_cv_.notify_one();

  flushing_.store(true);

  // Wait for queue to drain AND all in-flight processing to complete
  std::unique_lock<std::mutex> lock(queue_mutex_);
  queue_cv_.wait(lock, [this] {
    return (task_queue_.empty() && processing_.load() == 0) || !running_.load();
  });

  flushing_.store(false);
}

size_t AsyncDecodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return task_queue_.size();
}

std::vector<uint8_t>* AsyncDecodeWorker::AcquireBuffer(size_t size) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  for (auto it = buffer_pool_.begin(); it != buffer_pool_.end(); ++it) {
    if ((*it)->capacity() >= size) {
      auto* buffer = *it;
      buffer_pool_.erase(it);
      buffer->resize(size);
      return buffer;
    }
  }
  return new std::vector<uint8_t>(size);
}

void AsyncDecodeWorker::ReleaseBuffer(std::vector<uint8_t>* buffer) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  if (buffer_pool_.size() < 4) {  // Keep up to 4 buffers
    buffer_pool_.push_back(buffer);
  } else {
    delete buffer;
  }
}

void AsyncDecodeWorker::WorkerThread() {
  while (running_.load()) {
    DecodeTask task;
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

    ProcessPacket(task);

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

void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  // DARWIN-X64 FIX: Check codec_valid_ BEFORE acquiring mutex.
  // During shutdown, Stop() sets codec_valid_=false before running_=false.
  // This creates a window where the worker thread could still be running
  // but the codec is being destroyed. Early exit prevents the race.
  if (!codec_valid_.load(std::memory_order_acquire)) {
    return;
  }

  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }

  // Handle flush task - send NULL packet to drain decoder
  if (task.is_flush) {
    avcodec_send_packet(codec_context_, nullptr);
    // Drain all remaining frames from the decoder
    while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
      EmitFrame(frame_.get());
      av_frame_unref(frame_.get());
    }
    // Reset decoder to accept new packets after drain.
    // Without this, decoder stays in drain mode and rejects further input.
    avcodec_flush_buffers(codec_context_);
    return;
  }

  // Set up packet from task data
  av_packet_unref(packet_.get());
  packet_->data = const_cast<uint8_t*>(task.data.data());
  packet_->size = static_cast<int>(task.data.size());
  packet_->pts = task.timestamp;

  int ret = avcodec_send_packet(codec_context_, packet_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    // Post error to main thread
    std::string error_msg = "Decode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          // If env is null, TSFN is closing during teardown. Just cleanup.
          if (env == nullptr) {
            delete msg;
            return;
          }
          try {
            fn.Call({Napi::Error::New(env, *msg).Value()});
          } catch (...) {
            // User callback threw an exception. Log it but don't propagate to N-API
            // layer, as this would cause undefined behavior in TSFN context.
          }
          delete msg;
        });
    return;
  }

  while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
    EmitFrame(frame_.get());
    av_frame_unref(frame_.get());
  }
}

void AsyncDecodeWorker::EmitFrame(AVFrame* frame) {
  // Initialize or recreate SwsContext if frame format/dimensions change
  // (convert from decoder's pixel format to RGBA). RAII managed.
  AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame->format);

  if (!sws_context_ || last_frame_format_ != frame_format ||
      last_frame_width_ != frame->width ||
      last_frame_height_ != frame->height) {
    // RAII handles cleanup of old context automatically via reset()
    sws_context_.reset(
        sws_getContext(frame->width, frame->height, frame_format, frame->width,
                       frame->height, AV_PIX_FMT_RGBA, SWS_BILINEAR, nullptr,
                       nullptr, nullptr));

    if (!sws_context_) {
      std::string error_msg = "Could not create sws context";
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

    last_frame_format_ = frame_format;
    last_frame_width_ = frame->width;
    last_frame_height_ = frame->height;
    // Update output dimensions based on actual frame
    output_width_ = frame->width;
    output_height_ = frame->height;
  }

  // Copy metadata under lock to prevent torn reads
  // Note: codec_mutex_ is already held by ProcessPacket caller
  DecoderMetadataConfig metadata_copy = metadata_config_;

  // Convert YUV to RGBA
  size_t rgba_size = output_width_ * output_height_ * 4;
  auto* rgba_data = AcquireBuffer(rgba_size);

  uint8_t* dst_data[1] = {rgba_data->data()};
  int dst_linesize[1] = {output_width_ * 4};

  sws_scale(sws_context_.get(), frame->data, frame->linesize, 0, frame->height,
            dst_data, dst_linesize);

  int64_t timestamp = frame->pts;
  int width = output_width_;
  int height = output_height_;

  // Capture metadata for lambda
  int rotation = metadata_copy.rotation;
  bool flip = metadata_copy.flip;

  // Calculate display dimensions based on aspect ratio (per W3C spec).
  // If displayAspectWidth/displayAspectHeight are set, compute display
  // dimensions maintaining the height and adjusting width to match ratio.
  int disp_width = width;
  int disp_height = height;
  if (metadata_copy.display_width > 0 && metadata_copy.display_height > 0) {
    // Per W3C spec: displayWidth = codedHeight * aspectWidth / aspectHeight
    disp_width = static_cast<int>(
        std::round(static_cast<double>(height) *
                   static_cast<double>(metadata_copy.display_width) /
                   static_cast<double>(metadata_copy.display_height)));
    disp_height = height;
  }
  std::string color_primaries = metadata_copy.color_primaries;
  std::string color_transfer = metadata_copy.color_transfer;
  std::string color_matrix = metadata_copy.color_matrix;
  bool color_full_range = metadata_copy.color_full_range;
  bool has_color_space = metadata_copy.has_color_space;

  // Increment pending BEFORE queueing callback for accurate tracking
  (*pending_frames_)++;

  // Capture shared_ptr to pending counter, NOT raw worker pointer.
  // This ensures the counter remains valid even if the worker is destroyed
  // before the TSFN callback executes on the main thread.
  // Note: Buffer is managed via raw delete since buffer pool access is unsafe
  // after worker destruction.
  auto pending_counter = pending_frames_;
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [pending_counter, width, height, timestamp, rotation, flip, disp_width,
       disp_height, color_primaries, color_transfer, color_matrix,
       color_full_range,
       has_color_space](Napi::Env env, Napi::Function fn,
                        std::vector<uint8_t>* data) {
        // CRITICAL: If env is null, TSFN is closing during teardown.
        // Must still clean up data and counters, then return.
        // NOTE: Do NOT access static variables (like counterQueue) here - they may
        // already be destroyed due to static destruction order during process exit.
        if (env == nullptr) {
          delete data;
          (*pending_counter)--;
          // Skip counterQueue-- : static may be destroyed during process exit
          return;
        }

        // Always clean up, even if callback throws
        try {
          Napi::Object frame_obj;
          if (has_color_space) {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp,
                "RGBA", rotation, flip, disp_width, disp_height, color_primaries,
                color_transfer, color_matrix, color_full_range);
          } else {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp,
                "RGBA", rotation, flip, disp_width, disp_height);
          }
          fn.Call({frame_obj});
        } catch (const std::exception& e) {
          // Log but don't propagate - cleanup must happen
          fprintf(stderr, "AsyncDecodeWorker callback error: %s\n", e.what());
        } catch (...) {
          fprintf(stderr,
                  "AsyncDecodeWorker callback error: unknown exception\n");
        }
        // Delete buffer directly (can't use pool after worker destruction)
        delete data;
        // Decrement pending counter via shared_ptr (safe after worker destruction)
        (*pending_counter)--;
        webcodecs::counterQueue--;  // Decrement global queue counter
      });
}
