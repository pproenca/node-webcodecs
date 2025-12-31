// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker implementation for non-blocking video decoding.

#include "src/async_decode_worker.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

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
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
  // sws_context_ is created lazily by this worker, so we own it
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
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
  codec_context_ = ctx;
  // sws_context_ is created lazily in EmitFrame when we know the frame format
  sws_context_ = nullptr;
  output_width_ = width;
  output_height_ = height;
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
}

void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  metadata_config_ = config;
}

void AsyncDecodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncDecodeWorker::WorkerThread, this);
}

void AsyncDecodeWorker::Stop() {
  if (!running_.load()) return;

  running_.store(false);
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
  flushing_.store(true);
  queue_cv_.notify_one();

  // Wait for queue to drain
  std::unique_lock<std::mutex> lock(queue_mutex_);
  queue_cv_.wait(lock,
                 [this] { return task_queue_.empty() || !running_.load(); });

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
    }

    ProcessPacket(task);

    if (task_queue_.empty()) {
      queue_cv_.notify_all();
    }
  }
}

void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }

  // Set up packet from task data
  av_packet_unref(packet_);
  packet_->data = const_cast<uint8_t*>(task.data.data());
  packet_->size = static_cast<int>(task.data.size());
  packet_->pts = task.timestamp;

  int ret = avcodec_send_packet(codec_context_, packet_);
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    // Post error to main thread
    std::string error_msg = "Decode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }

  while (avcodec_receive_frame(codec_context_, frame_) == 0) {
    EmitFrame(frame_);
    av_frame_unref(frame_);
  }
}

void AsyncDecodeWorker::EmitFrame(AVFrame* frame) {
  // Initialize or recreate SwsContext if frame format/dimensions change
  // (convert from decoder's pixel format to RGBA).
  AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame->format);

  if (!sws_context_ || last_frame_format_ != frame_format ||
      last_frame_width_ != frame->width ||
      last_frame_height_ != frame->height) {
    if (sws_context_) {
      sws_freeContext(sws_context_);
    }
    sws_context_ =
        sws_getContext(frame->width, frame->height, frame_format, frame->width,
                       frame->height, AV_PIX_FMT_RGBA, SWS_BILINEAR, nullptr,
                       nullptr, nullptr);

    if (!sws_context_) {
      std::string error_msg = "Could not create sws context";
      error_tsfn_.NonBlockingCall(
          new std::string(error_msg),
          [](Napi::Env env, Napi::Function fn, std::string* msg) {
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

  // Convert YUV to RGBA
  size_t rgba_size = output_width_ * output_height_ * 4;
  auto* rgba_data = AcquireBuffer(rgba_size);

  uint8_t* dst_data[1] = {rgba_data->data()};
  int dst_linesize[1] = {output_width_ * 4};

  sws_scale(sws_context_, frame->data, frame->linesize, 0, frame->height,
            dst_data, dst_linesize);

  int64_t timestamp = frame->pts;
  int width = output_width_;
  int height = output_height_;

  // Capture metadata for lambda
  int rotation = metadata_config_.rotation;
  bool flip = metadata_config_.flip;

  // Calculate display dimensions based on aspect ratio (per W3C spec).
  // If displayAspectWidth/displayAspectHeight are set, compute display
  // dimensions maintaining the height and adjusting width to match ratio.
  int disp_width = width;
  int disp_height = height;
  if (metadata_config_.display_width > 0 && metadata_config_.display_height > 0) {
    // Per W3C spec: displayWidth = codedHeight * aspectWidth / aspectHeight
    disp_width = static_cast<int>(
        std::round(static_cast<double>(height) *
                   static_cast<double>(metadata_config_.display_width) /
                   static_cast<double>(metadata_config_.display_height)));
    disp_height = height;
  }
  std::string color_primaries = metadata_config_.color_primaries;
  std::string color_transfer = metadata_config_.color_transfer;
  std::string color_matrix = metadata_config_.color_matrix;
  bool color_full_range = metadata_config_.color_full_range;
  bool has_color_space = metadata_config_.has_color_space;

  // Increment pending BEFORE queueing callback for accurate tracking
  pending_frames_++;

  // Capture this pointer for buffer pool release and pending decrement
  AsyncDecodeWorker* worker = this;
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [worker, width, height, timestamp, rotation, flip, disp_width,
       disp_height, color_primaries, color_transfer, color_matrix,
       color_full_range,
       has_color_space](Napi::Env env, Napi::Function fn,
                        std::vector<uint8_t>* data) {
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
        // Always release buffer and decrement pending
        worker->ReleaseBuffer(data);
        worker->pending_frames_--;
      });
}
