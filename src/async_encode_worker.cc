// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncEncodeWorker implementation for non-blocking video encoding.

#include "src/async_encode_worker.h"

#include <utility>

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

AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
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
  // This will be called from worker thread
  // Actual FFmpeg encoding happens here
  // Results are posted back via ThreadSafeFunction

  // Note: Implementation delegates to VideoEncoder's internal methods
  // which need to be made thread-safe
}

void AsyncEncodeWorker::EmitChunk(AVPacket* packet) {
  // Convert to EncodedVideoChunk and emit via ThreadSafeFunction
  // This is called from worker thread
}
