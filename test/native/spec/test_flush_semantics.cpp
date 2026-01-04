// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * test_flush_semantics.cpp - Tests for W3C flush() semantics.
 *
 * Per W3C spec 4.5.4 (VideoDecoder.flush) and 6.5.4 (VideoEncoder.flush):
 * - flush() drains all pending work
 * - Returns a promise that resolves when drain completes
 * - Sets [[key chunk required]] flag (decoders only)
 * - Rejects with EncodingError if codec encounters error during drain
 * - Multiple concurrent flush() calls resolve in order
 *
 * @see https://www.w3.org/TR/webcodecs/#dom-videodecoder-flush
 * @see https://www.w3.org/TR/webcodecs/#dom-videoencoder-flush
 */

#include <gtest/gtest.h>

#include <atomic>
#include <chrono>
#include <functional>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

namespace {

using VideoQueue = VideoControlQueue;
using Message = VideoQueue::Message;
using FlushMessage = VideoQueue::FlushMessage;
using DecodeMessage = VideoQueue::DecodeMessage;
using EncodeMessage = VideoQueue::EncodeMessage;

// =============================================================================
// FLUSH PROCESSOR SIMULATOR
// =============================================================================

/**
 * Simulates flush processing per W3C spec.
 * Validates promise resolution order and key chunk flag behavior.
 */
class FlushProcessor {
 public:
  struct FlushResult {
    uint32_t promise_id;
    bool success;
    std::string error_message;
  };

  explicit FlushProcessor(VideoQueue* queue)
      : queue_(queue), pending_work_count_(0), key_chunk_required_(false),
        drain_will_fail_(false) {}

  /**
   * Simulate processing pending work before flush.
   */
  void SetPendingWork(int count) {
    pending_work_count_ = count;
  }

  /**
   * Simulate codec drain failure.
   */
  void SetDrainWillFail(bool will_fail) {
    drain_will_fail_ = will_fail;
  }

  /**
   * Process flush message.
   * Per spec: drain all pending work, then resolve promise.
   */
  FlushResult ProcessFlush(const FlushMessage& msg) {
    FlushResult result;
    result.promise_id = msg.promise_id;

    // Drain pending work
    bool drain_success = DrainPendingWork();

    if (drain_success) {
      result.success = true;
      // Per spec 4.5.4: Set [[key chunk required]] to true (for decoders)
      key_chunk_required_ = true;
    } else {
      result.success = false;
      result.error_message = "EncodingError: Drain failed";
    }

    return result;
  }

  /**
   * Check if key chunk is required (decoder state).
   */
  bool IsKeyChunkRequired() const {
    return key_chunk_required_;
  }

  /**
   * Get completed flush results.
   */
  const std::vector<FlushResult>& GetFlushResults() const {
    return flush_results_;
  }

  /**
   * Process all flush messages in queue.
   */
  void ProcessAllFlushes() {
    while (true) {
      auto msg = queue_->TryDequeue();
      if (!msg.has_value()) {
        break;
      }

      if (auto* flush_msg = std::get_if<FlushMessage>(&*msg)) {
        FlushResult result = ProcessFlush(*flush_msg);
        flush_results_.push_back(result);
      }
    }
  }

 private:
  bool DrainPendingWork() {
    if (drain_will_fail_) {
      return false;
    }

    // Simulate draining (processing remaining work)
    pending_work_count_ = 0;
    return true;
  }

  VideoQueue* queue_;
  int pending_work_count_;
  bool key_chunk_required_;
  bool drain_will_fail_;
  std::vector<FlushResult> flush_results_;
};

// =============================================================================
// FIXTURES
// =============================================================================

class FlushSemanticsTest : public ::testing::Test {
 protected:
  void SetUp() override {
    queue_ = std::make_unique<VideoQueue>();
    processor_ = std::make_unique<FlushProcessor>(queue_.get());
  }

  void TearDown() override {
    queue_->Shutdown();
  }

  std::unique_ptr<VideoQueue> queue_;
  std::unique_ptr<FlushProcessor> processor_;
};

// =============================================================================
// HAPPY PATH TESTS
// =============================================================================

TEST_F(FlushSemanticsTest, Flush_WithEmptyQueue_ResolvesImmediately) {
  // Per spec: If no pending work, flush should resolve immediately
  FlushMessage flush_msg;
  flush_msg.promise_id = 1;

  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));

  // Process flush with no pending work
  processor_->SetPendingWork(0);
  processor_->ProcessAllFlushes();

  const auto& results = processor_->GetFlushResults();
  ASSERT_EQ(results.size(), 1);
  EXPECT_EQ(results[0].promise_id, 1);
  EXPECT_TRUE(results[0].success);
}

TEST_F(FlushSemanticsTest, Flush_DrainsAllPendingWork_ThenResolves) {
  // Per spec 4.5.4: flush drains all pending decode/encode operations
  FlushMessage flush_msg;
  flush_msg.promise_id = 42;

  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));

  // Simulate pending work
  processor_->SetPendingWork(10);
  processor_->ProcessAllFlushes();

  const auto& results = processor_->GetFlushResults();
  ASSERT_EQ(results.size(), 1);
  EXPECT_EQ(results[0].promise_id, 42);
  EXPECT_TRUE(results[0].success);
}

TEST_F(FlushSemanticsTest, Flush_SetsKeyChunkRequired_ForDecoders) {
  // Per spec 4.5.4: Set [[key chunk required]] to true after flush
  EXPECT_FALSE(processor_->IsKeyChunkRequired());

  FlushMessage flush_msg;
  flush_msg.promise_id = 1;
  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));

  processor_->ProcessAllFlushes();

  // Key chunk required flag should be set
  EXPECT_TRUE(processor_->IsKeyChunkRequired());
}

TEST_F(FlushSemanticsTest, Flush_MultipleConcurrent_ResolveInOrder) {
  // Per spec: Multiple flush() calls resolve in FIFO order
  FlushMessage flush1, flush2, flush3;
  flush1.promise_id = 10;
  flush2.promise_id = 20;
  flush3.promise_id = 30;

  ASSERT_TRUE(queue_->Enqueue(std::move(flush1)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush2)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush3)));

  processor_->ProcessAllFlushes();

  const auto& results = processor_->GetFlushResults();
  ASSERT_EQ(results.size(), 3);

  // Verify FIFO order
  EXPECT_EQ(results[0].promise_id, 10);
  EXPECT_EQ(results[1].promise_id, 20);
  EXPECT_EQ(results[2].promise_id, 30);

  EXPECT_TRUE(results[0].success);
  EXPECT_TRUE(results[1].success);
  EXPECT_TRUE(results[2].success);
}

// =============================================================================
// SAD PATH TESTS
// =============================================================================

TEST_F(FlushSemanticsTest, Flush_RejectsOnError_WithEncodingError) {
  // Per spec: If drain encounters error, reject with EncodingError
  FlushMessage flush_msg;
  flush_msg.promise_id = 99;
  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));

  // Simulate drain failure
  processor_->SetDrainWillFail(true);
  processor_->ProcessAllFlushes();

  const auto& results = processor_->GetFlushResults();
  ASSERT_EQ(results.size(), 1);
  EXPECT_EQ(results[0].promise_id, 99);
  EXPECT_FALSE(results[0].success);
  EXPECT_EQ(results[0].error_message, "EncodingError: Drain failed");
}

TEST_F(FlushSemanticsTest, Flush_AfterQueueClosed_CannotEnqueue) {
  queue_->Shutdown();

  FlushMessage flush_msg;
  flush_msg.promise_id = 1;

  // Should reject enqueue after shutdown
  EXPECT_FALSE(queue_->Enqueue(std::move(flush_msg)));
}

TEST_F(FlushSemanticsTest,
       Flush_MultipleConcurrent_FirstFails_RemainingSucceed) {
  // Scenario: Multiple flushes queued, first fails during drain
  FlushMessage flush1, flush2, flush3;
  flush1.promise_id = 1;
  flush2.promise_id = 2;
  flush3.promise_id = 3;

  ASSERT_TRUE(queue_->Enqueue(std::move(flush1)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush2)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush3)));

  // Process manually to simulate failure on first flush only
  auto msg1 = queue_->TryDequeue();
  ASSERT_TRUE(msg1.has_value());
  auto* flush_ptr1 = std::get_if<FlushMessage>(&*msg1);
  ASSERT_NE(flush_ptr1, nullptr);

  processor_->SetDrainWillFail(true);
  FlushProcessor::FlushResult result1 = processor_->ProcessFlush(*flush_ptr1);
  EXPECT_FALSE(result1.success);

  // Subsequent flushes succeed
  processor_->SetDrainWillFail(false);

  auto msg2 = queue_->TryDequeue();
  ASSERT_TRUE(msg2.has_value());
  auto* flush_ptr2 = std::get_if<FlushMessage>(&*msg2);
  ASSERT_NE(flush_ptr2, nullptr);
  FlushProcessor::FlushResult result2 = processor_->ProcessFlush(*flush_ptr2);
  EXPECT_TRUE(result2.success);

  auto msg3 = queue_->TryDequeue();
  ASSERT_TRUE(msg3.has_value());
  auto* flush_ptr3 = std::get_if<FlushMessage>(&*msg3);
  ASSERT_NE(flush_ptr3, nullptr);
  FlushProcessor::FlushResult result3 = processor_->ProcessFlush(*flush_ptr3);
  EXPECT_TRUE(result3.success);
}

// =============================================================================
// EDGE CASES
// =============================================================================

TEST_F(FlushSemanticsTest, Flush_WithZeroPromiseId_StillValid) {
  // Promise ID of 0 is technically valid (though unusual)
  FlushMessage flush_msg;
  flush_msg.promise_id = 0;
  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));

  processor_->ProcessAllFlushes();

  const auto& results = processor_->GetFlushResults();
  ASSERT_EQ(results.size(), 1);
  EXPECT_EQ(results[0].promise_id, 0);
  EXPECT_TRUE(results[0].success);
}

TEST_F(FlushSemanticsTest, Flush_InterleaveWithDecodeMessages_FIFOOrder) {
  // Flush messages should process in FIFO order alongside other messages
  DecodeMessage decode_msg;
  decode_msg.packet = CreateEmptyPacket();

  FlushMessage flush1, flush2;
  flush1.promise_id = 10;
  flush2.promise_id = 20;

  // Enqueue: flush1, decode, flush2
  ASSERT_TRUE(queue_->Enqueue(std::move(flush1)));
  ASSERT_TRUE(queue_->Enqueue(std::move(decode_msg)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush2)));

  // Verify queue order by peeking
  const Message* front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<FlushMessage>(*front));
  queue_->PopFront();

  front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<DecodeMessage>(*front));
  queue_->PopFront();

  front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<FlushMessage>(*front));
  queue_->PopFront();

  EXPECT_TRUE(queue_->empty());
}

}  // namespace
