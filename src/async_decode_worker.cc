// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker implementation for non-blocking video decoding.

#include "async_decode_worker.h"

#include "video_decoder.h"
#include "video_frame.h"

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
  // This will be called from worker thread
  // Actual FFmpeg decoding happens here
  // Results are posted back via ThreadSafeFunction

  // Note: Implementation delegates to VideoDecoder's internal methods
  // which need to be made thread-safe
}

void AsyncDecodeWorker::EmitFrame(AVFrame* frame) {
  // Convert to RGBA and emit via ThreadSafeFunction
  // This is called from worker thread
}
