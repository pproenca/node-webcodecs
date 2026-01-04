// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * test_reset_semantics.cpp - Tests for W3C reset() semantics.
 *
 * Per W3C spec 4.5.2 (VideoDecoder.reset) and 6.5.2 (VideoEncoder.reset):
 * - reset() clears all pending work immediately
 * - Rejects pending flush() promises with Abort Error
 * - Sets [[key chunk required]] flag (decoders only)
 * - Resets decodeQueueSize/encodeQueueSize to 0
 * - Does NOT change [[state]] (remains configured)
 *
 * @see https://www.w3.org/TR/webcodecs/#dom-videodecoder-reset
 * @see https://www.w3.org/TR/webcodecs/#dom-videoencoder-reset
 */

#include <gtest/gtest.h>

#include <atomic>
#include <functional>
#include <string>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

namespace {

using VideoQueue = VideoControlQueue;
using Message = VideoQueue::Message;
using ResetMessage = VideoQueue::ResetMessage;
using DecodeMessage = VideoQueue::DecodeMessage;
using FlushMessage = VideoQueue::FlushMessage;

// =============================================================================
// RESET PROCESSOR SIMULATOR
// =============================================================================

/**
 * Simulates reset processing per W3C spec.
 * Validates queue clearing, flush rejection, and flag reset behavior.
 */
class ResetProcessor {
 public:
  struct FlushRejection {
    uint32_t promise_id;
    std::string error_type;  // "AbortError"
    std::string error_message;
  };

  explicit ResetProcessor(VideoQueue* queue)
      : queue_(queue), key_chunk_required_(false) {}

  /**
   * Process reset message.
   * Per spec:
   * 1. Clear all pending work from queue
   * 2. Reject pending flush promises with AbortError
   * 3. Set [[key chunk required]] to true (decoders)
   * 4. Reset queue size to 0
   */
  void ProcessReset(const ResetMessage& /* msg */) {
    // 1. Clear pending work
    auto dropped_packets = queue_->Clear();
    dropped_count_ = dropped_packets.size();

    // 2. Reject pending flushes (tracked separately in real implementation)
    for (const auto& promise_id : pending_flush_promises_) {
      FlushRejection rejection;
      rejection.promise_id = promise_id;
      rejection.error_type = "AbortError";
      rejection.error_message = "Reset called while flush pending";
      flush_rejections_.push_back(rejection);
    }
    pending_flush_promises_.clear();

    // 3. Set [[key chunk required]] for decoders
    key_chunk_required_ = true;

    // 4. Queue size is now 0 (checked via queue_->size())
  }

  /**
   * Track a pending flush promise (for rejection on reset).
   */
  void TrackFlushPromise(uint32_t promise_id) {
    pending_flush_promises_.push_back(promise_id);
  }

  /**
   * Check if key chunk is required (decoder state).
   */
  bool IsKeyChunkRequired() const {
    return key_chunk_required_;
  }

  /**
   * Get count of dropped packets during reset.
   */
  size_t GetDroppedCount() const {
    return dropped_count_;
  }

  /**
   * Get flush promise rejections.
   */
  const std::vector<FlushRejection>& GetFlushRejections() const {
    return flush_rejections_;
  }

 private:
  VideoQueue* queue_;
  bool key_chunk_required_;
  size_t dropped_count_ = 0;
  std::vector<uint32_t> pending_flush_promises_;
  std::vector<FlushRejection> flush_rejections_;
};

// =============================================================================
// FIXTURES
// =============================================================================

class ResetSemanticsTest : public ::testing::Test {
 protected:
  void SetUp() override {
    queue_ = std::make_unique<VideoQueue>();
    processor_ = std::make_unique<ResetProcessor>(queue_.get());
  }

  void TearDown() override {
    queue_->Shutdown();
  }

  void EnqueueDecodeMessages(int count) {
    for (int i = 0; i < count; ++i) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
    }
  }

  std::unique_ptr<VideoQueue> queue_;
  std::unique_ptr<ResetProcessor> processor_;
};

// =============================================================================
// HAPPY PATH TESTS
// =============================================================================

TEST_F(ResetSemanticsTest, Reset_ClearsQueue_DiscardsPendingWork) {
  // Per spec 4.6: reset() clears all pending work
  // Test validates that Clear() removes all pending messages
  EnqueueDecodeMessages(10);
  EXPECT_EQ(queue_->size(), 10);

  // Simulate reset processing (calls Clear() internally)
  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // Queue should be empty after Clear() was called
  EXPECT_EQ(queue_->size(), 0);
  EXPECT_EQ(processor_->GetDroppedCount(), 10);
}

TEST_F(ResetSemanticsTest, Reset_ResetsDecodeQueueSize_ToZero) {
  // Per spec: decodeQueueSize/encodeQueueSize reset to 0
  EnqueueDecodeMessages(25);
  EXPECT_EQ(queue_->size(), 25);

  // Process reset (clears all pending work)
  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // Queue size should be 0 after Clear()
  EXPECT_EQ(queue_->size(), 0);
}

TEST_F(ResetSemanticsTest, Reset_SetsKeyChunkRequired_ForDecoders) {
  // Per spec 4.5.2: Set [[key chunk required]] to true
  EXPECT_FALSE(processor_->IsKeyChunkRequired());

  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // Key chunk required flag should be set
  EXPECT_TRUE(processor_->IsKeyChunkRequired());
}

TEST_F(ResetSemanticsTest, Reset_RejectsPendingFlushes_WithAbortError) {
  // Per spec: Pending flush() promises rejected with AbortError
  EnqueueDecodeMessages(5);

  // Track pending flush promises
  processor_->TrackFlushPromise(100);
  processor_->TrackFlushPromise(200);

  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // Both flush promises should be rejected
  const auto& rejections = processor_->GetFlushRejections();
  ASSERT_EQ(rejections.size(), 2);

  EXPECT_EQ(rejections[0].promise_id, 100);
  EXPECT_EQ(rejections[0].error_type, "AbortError");
  EXPECT_EQ(rejections[0].error_message, "Reset called while flush pending");

  EXPECT_EQ(rejections[1].promise_id, 200);
  EXPECT_EQ(rejections[1].error_type, "AbortError");
}

// =============================================================================
// SAD PATH TESTS
// =============================================================================

TEST_F(ResetSemanticsTest, Reset_WithNoWork_StillSucceeds) {
  // Reset on empty queue should succeed
  EXPECT_EQ(queue_->size(), 0);

  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // No packets dropped, but reset still sets flags
  EXPECT_EQ(processor_->GetDroppedCount(), 0);
  EXPECT_TRUE(processor_->IsKeyChunkRequired());
}

TEST_F(ResetSemanticsTest, Reset_AfterQueueClosed_CannotEnqueue) {
  queue_->Shutdown();

  ResetMessage reset_msg;

  // Should reject enqueue after shutdown
  EXPECT_FALSE(queue_->Enqueue(std::move(reset_msg)));
}

// =============================================================================
// EDGE CASES
// =============================================================================

TEST_F(ResetSemanticsTest, Reset_MultipleResets_BehaviorIdempotent) {
  // Multiple reset() calls should be safe
  EnqueueDecodeMessages(5);

  // First reset
  ResetMessage reset1;
  processor_->ProcessReset(reset1);

  EXPECT_EQ(queue_->size(), 0);
  EXPECT_TRUE(processor_->IsKeyChunkRequired());

  // Second reset (on already-empty queue)
  ResetMessage reset2;
  ResetProcessor processor2(queue_.get());
  processor2.ProcessReset(reset2);

  EXPECT_EQ(queue_->size(), 0);
  EXPECT_TRUE(processor2.IsKeyChunkRequired());
}

TEST_F(ResetSemanticsTest, Reset_InterleaveWithFlush_FIFOOrder) {
  // Reset and flush messages should process in FIFO order
  DecodeMessage decode_msg;
  decode_msg.packet = CreateEmptyPacket();

  FlushMessage flush_msg;
  flush_msg.promise_id = 42;

  ResetMessage reset_msg;

  // Enqueue: decode, flush, reset
  ASSERT_TRUE(queue_->Enqueue(std::move(decode_msg)));
  ASSERT_TRUE(queue_->Enqueue(std::move(flush_msg)));
  ASSERT_TRUE(queue_->Enqueue(std::move(reset_msg)));

  // Verify FIFO order
  const Message* front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<DecodeMessage>(*front));
  queue_->PopFront();

  front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<FlushMessage>(*front));
  queue_->PopFront();

  front = queue_->Peek();
  ASSERT_NE(front, nullptr);
  EXPECT_TRUE(std::holds_alternative<ResetMessage>(*front));
  queue_->PopFront();

  EXPECT_TRUE(queue_->empty());
}

TEST_F(ResetSemanticsTest, Reset_ReturnsDroppedPackets_ForCleanup) {
  // Per RAII principles: Clear() returns packets for proper cleanup
  EnqueueDecodeMessages(15);
  EXPECT_EQ(queue_->size(), 15);

  ResetMessage reset_msg;
  processor_->ProcessReset(reset_msg);

  // Verify packets were returned for cleanup (via dropped_count)
  EXPECT_EQ(processor_->GetDroppedCount(), 15);
  EXPECT_EQ(queue_->size(), 0);

  // In real implementation, these packets would be properly unreferenced
  // via RAII (AVPacketPtr destructors called)
}

}  // namespace
