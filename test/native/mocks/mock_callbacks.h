// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Mock callbacks for testing codec workers.
// Provides thread-safe capture of callback invocations for verification.

#ifndef TEST_NATIVE_MOCKS_MOCK_CALLBACKS_H_
#define TEST_NATIVE_MOCKS_MOCK_CALLBACKS_H_

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "src/video_encoder_worker.h"

namespace webcodecs {
namespace testing {

/**
 * MockPacketOutputCallback - Captures output packets from encoder.
 * Thread-safe for use with worker threads and TSFNs.
 */
class MockPacketOutputCallback {
 public:
  MockPacketOutputCallback() = default;

  void OnPacket(std::unique_ptr<EncodedPacketData> packet) {
    std::lock_guard<std::mutex> lock(mutex_);
    packets_.push_back(std::move(packet));
    count_.fetch_add(1, std::memory_order_relaxed);
  }

  // Get callback function for worker
  auto GetCallback() {
    return [this](std::unique_ptr<EncodedPacketData> packet) {
      OnPacket(std::move(packet));
    };
  }

  // Query captured packets
  size_t GetCount() const {
    return count_.load(std::memory_order_relaxed);
  }

  std::vector<std::unique_ptr<EncodedPacketData>> GetPackets() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::unique_ptr<EncodedPacketData>> result;
    result.reserve(packets_.size());
    for (auto& packet : packets_) {
      result.push_back(std::move(packet));
    }
    packets_.clear();
    return result;
  }

  void Clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    packets_.clear();
    count_.store(0, std::memory_order_relaxed);
  }

 private:
  std::mutex mutex_;
  std::vector<std::unique_ptr<EncodedPacketData>> packets_;
  std::atomic<size_t> count_{0};
};

/**
 * MockErrorCallback - Captures error callbacks.
 * Thread-safe for use with worker threads and TSFNs.
 */
class MockErrorCallback {
 public:
  struct ErrorEvent {
    int code;
    std::string message;
  };

  MockErrorCallback() = default;

  void OnError(int code, const std::string& message) {
    std::lock_guard<std::mutex> lock(mutex_);
    errors_.push_back(ErrorEvent{code, message});
    count_.fetch_add(1, std::memory_order_relaxed);
  }

  // Get callback function for worker
  auto GetCallback() {
    return [this](int code, const std::string& message) {
      OnError(code, message);
    };
  }

  // Query captured errors
  size_t GetCount() const {
    return count_.load(std::memory_order_relaxed);
  }

  std::vector<ErrorEvent> GetErrors() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<ErrorEvent> result = errors_;
    errors_.clear();
    return result;
  }

  ErrorEvent GetLastError() {
    std::lock_guard<std::mutex> lock(mutex_);
    return errors_.empty() ? ErrorEvent{0, ""} : errors_.back();
  }

  void Clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    errors_.clear();
    count_.store(0, std::memory_order_relaxed);
  }

 private:
  std::mutex mutex_;
  std::vector<ErrorEvent> errors_;
  std::atomic<size_t> count_{0};
};

/**
 * MockFlushCallback - Captures flush completion callbacks.
 * Thread-safe for use with worker threads and TSFNs.
 */
class MockFlushCallback {
 public:
  struct FlushEvent {
    uint32_t promise_id;
    bool success;
    std::string error;
  };

  MockFlushCallback() = default;

  void OnFlush(uint32_t promise_id, bool success, const std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    flushes_.push_back(FlushEvent{promise_id, success, error});
    count_.fetch_add(1, std::memory_order_relaxed);
  }

  // Get callback function for worker
  auto GetCallback() {
    return [this](uint32_t promise_id, bool success, const std::string& error) {
      OnFlush(promise_id, success, error);
    };
  }

  // Query captured flushes
  size_t GetCount() const {
    return count_.load(std::memory_order_relaxed);
  }

  std::vector<FlushEvent> GetFlushes() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<FlushEvent> result = flushes_;
    flushes_.clear();
    return result;
  }

  FlushEvent GetLastFlush() {
    std::lock_guard<std::mutex> lock(mutex_);
    return flushes_.empty() ? FlushEvent{0, false, ""} : flushes_.back();
  }

  void Clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    flushes_.clear();
    count_.store(0, std::memory_order_relaxed);
  }

 private:
  std::mutex mutex_;
  std::vector<FlushEvent> flushes_;
  std::atomic<size_t> count_{0};
};

/**
 * MockDequeueCallback - Captures dequeue event callbacks.
 * Thread-safe for use with worker threads and TSFNs.
 */
class MockDequeueCallback {
 public:
  MockDequeueCallback() = default;

  void OnDequeue(uint32_t new_queue_size) {
    std::lock_guard<std::mutex> lock(mutex_);
    queue_sizes_.push_back(new_queue_size);
    count_.fetch_add(1, std::memory_order_relaxed);
  }

  // Get callback function for worker
  auto GetCallback() {
    return [this](uint32_t new_queue_size) {
      OnDequeue(new_queue_size);
    };
  }

  // Query captured dequeue events
  size_t GetCount() const {
    return count_.load(std::memory_order_relaxed);
  }

  std::vector<uint32_t> GetQueueSizes() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<uint32_t> result = queue_sizes_;
    queue_sizes_.clear();
    return result;
  }

  uint32_t GetLastQueueSize() {
    std::lock_guard<std::mutex> lock(mutex_);
    return queue_sizes_.empty() ? 0 : queue_sizes_.back();
  }

  void Clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    queue_sizes_.clear();
    count_.store(0, std::memory_order_relaxed);
  }

 private:
  std::mutex mutex_;
  std::vector<uint32_t> queue_sizes_;
  std::atomic<size_t> count_{0};
};

}  // namespace testing
}  // namespace webcodecs

#endif  // TEST_NATIVE_MOCKS_MOCK_CALLBACKS_H_
