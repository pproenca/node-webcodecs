// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker implementation for non-blocking video decoding.

#include "src/async_decode_worker.h"

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include <string>
#include <utility>
#include <vector>

#include "src/video_decoder.h"
#include "src/video_frame.h"

AsyncDecodeWorker::AsyncDecodeWorker(VideoDecoder* decoder,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : decoder_(decoder),
      output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr) {}

AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
  // Note: codec_context_ and sws_context_ are owned by VideoDecoder
  // They are cleaned up there, not here
}

void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  codec_context_ = ctx;
  sws_context_ = sws;
  output_width_ = width;
  output_height_ = height;
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
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
  queue_cv_.wait(lock, [this] {
    return task_queue_.empty() || !running_.load();
  });

  flushing_.store(false);
}

size_t AsyncDecodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(queue_mutex_));
  return task_queue_.size();
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
  if (!sws_context_) {
    return;
  }

  // Convert YUV to RGBA
  size_t rgba_size = output_width_ * output_height_ * 4;
  auto* rgba_data = new std::vector<uint8_t>(rgba_size);

  uint8_t* dst_data[1] = {rgba_data->data()};
  int dst_linesize[1] = {output_width_ * 4};

  sws_scale(sws_context_, frame->data, frame->linesize, 0,
            frame->height, dst_data, dst_linesize);

  int64_t timestamp = frame->pts;
  int width = output_width_;
  int height = output_height_;

  output_tsfn_.NonBlockingCall(
      rgba_data,
      [width, height, timestamp](Napi::Env env, Napi::Function fn,
                                  std::vector<uint8_t>* data) {
        Napi::Object frame_obj = VideoFrame::CreateInstance(
            env, data->data(), data->size(),
            width, height, timestamp, "RGBA");
        fn.Call({frame_obj});
        delete data;
      });
}
