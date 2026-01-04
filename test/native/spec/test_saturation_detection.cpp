// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * test_saturation_detection.cpp - Tests for C++ primitives supporting
 * saturation detection.
 *
 * NOTE: Saturation detection logic (threshold of 16 messages) is implemented
 * in the TypeScript layer (lib/codec-base.ts). These tests validate the C++
 * primitives that enable TypeScript to detect saturation:
 *
 * 1. Accurate queue size tracking
 * 2. Size changes during enqueue/dequeue
 * 3. Dequeue event callbacks
 *
 * Per W3C spec:
 * - [[codec saturation]] = (decodeQueueSize > 16) OR (encodeQueueSize > 16)
 * - dequeue event scheduled when queue size decreases
 *
 * @see https://www.w3.org/TR/webcodecs/#codec-saturation
 */

#include <gtest/gtest.h>

#include <atomic>
#include <chrono>
#include <thread>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

namespace {

using VideoQueue = VideoControlQueue;
using Message = VideoQueue::Message;
using DecodeMessage = VideoQueue::DecodeMessage;

// =============================================================================
// FIXTURES
// =============================================================================

class SaturationDetectionTest : public ::testing::Test {
 protected:
  void SetUp() override {
    queue_ = std::make_unique<VideoQueue>();
    dequeue_count_ = 0;
    last_queue_size_ = 0;
  }

  void TearDown() override { queue_->Shutdown(); }

  // Helper: Create dummy decode message
  Message CreateDecodeMessage() {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    return msg;
  }

  // Helper: Enqueue N messages
  void EnqueueMessages(size_t count) {
    for (size_t i = 0; i < count; ++i) {
      ASSERT_TRUE(queue_->Enqueue(CreateDecodeMessage()));
    }
  }

  // Mock dequeue callback
  void OnDequeue(size_t new_size) {
    dequeue_count_++;
    last_queue_size_ = new_size;
  }

  std::unique_ptr<VideoQueue> queue_;
  std::atomic<int> dequeue_count_;
  std::atomic<size_t> last_queue_size_;
};

// =============================================================================
// QUEUE SIZE TRACKING TESTS
// =============================================================================

TEST_F(SaturationDetectionTest, QueueSize_Empty_ReturnsZero) {
  EXPECT_EQ(queue_->size(), 0);
  EXPECT_TRUE(queue_->empty());
}

TEST_F(SaturationDetectionTest, QueueSize_AfterEnqueue_IncrementsCorrectly) {
  EnqueueMessages(5);
  EXPECT_EQ(queue_->size(), 5);
  EXPECT_FALSE(queue_->empty());
}

TEST_F(SaturationDetectionTest, QueueSize_AfterDequeue_DecrementsCorrectly) {
  EnqueueMessages(10);
  EXPECT_EQ(queue_->size(), 10);

  // Dequeue 3 messages
  for (int i = 0; i < 3; ++i) {
    [[maybe_unused]] auto msg = queue_->TryDequeue();
    ASSERT_TRUE(msg.has_value());
  }

  EXPECT_EQ(queue_->size(), 7);
}

TEST_F(SaturationDetectionTest, QueueSize_Above16_SupportsLargeCounts) {
  // TypeScript layer checks if size > 16 for saturation
  // Verify C++ queue can track sizes above threshold
  EnqueueMessages(20);
  EXPECT_EQ(queue_->size(), 20);

  EnqueueMessages(30);
  EXPECT_EQ(queue_->size(), 50);
}

TEST_F(SaturationDetectionTest, QueueSize_AfterClear_ReturnsZero) {
  EnqueueMessages(25);
  EXPECT_EQ(queue_->size(), 25);

  auto dropped = queue_->Clear();
  EXPECT_EQ(queue_->size(), 0);
  EXPECT_EQ(dropped.size(), 25);  // All packets returned for cleanup
}

// =============================================================================
// SIZE TRANSITIONS (SATURATION THRESHOLDS)
// =============================================================================

TEST_F(SaturationDetectionTest, QueueSize_CrossesSaturationThreshold) {
  // Simulate crossing the saturation threshold (16 messages)
  // TypeScript would detect: size() > 16 → saturated = true

  // Below threshold
  EnqueueMessages(10);
  EXPECT_EQ(queue_->size(), 10);
  EXPECT_LT(queue_->size(), 16);  // Not saturated (TS would see this)

  // Cross threshold
  EnqueueMessages(7);
  EXPECT_EQ(queue_->size(), 17);
  EXPECT_GT(queue_->size(), 16);  // Saturated (TS would see this)

  // Dequeue back below threshold
  for (int i = 0; i < 5; ++i) {
    [[maybe_unused]] auto msg = queue_->TryDequeue();
  }
  EXPECT_EQ(queue_->size(), 12);
  EXPECT_LE(queue_->size(), 16);  // Desaturated (TS would see this)
}

// =============================================================================
// PEEK/POPFRONT SIZE TRACKING
// =============================================================================

TEST_F(SaturationDetectionTest, QueueSize_Peek_DoesNotChangeSize) {
  EnqueueMessages(5);
  EXPECT_EQ(queue_->size(), 5);

  // Peek multiple times
  for (int i = 0; i < 10; ++i) {
    const Message* msg = queue_->Peek();
    ASSERT_NE(msg, nullptr);
    EXPECT_EQ(queue_->size(), 5);  // Size unchanged by Peek
  }
}

TEST_F(SaturationDetectionTest, QueueSize_PopFront_DecrementsSize) {
  EnqueueMessages(8);
  EXPECT_EQ(queue_->size(), 8);

  // Peek then PopFront (W3C spec 2.2 pattern)
  const Message* msg = queue_->Peek();
  ASSERT_NE(msg, nullptr);
  EXPECT_EQ(queue_->size(), 8);  // Still 8

  queue_->PopFront();
  EXPECT_EQ(queue_->size(), 7);  // Now decremented
}

TEST_F(SaturationDetectionTest,
       QueueSize_PeekPopFrontPattern_TracksSizeCorrectly) {
  EnqueueMessages(20);
  size_t expected_size = 20;

  // Process 10 messages using Peek/PopFront
  for (int i = 0; i < 10; ++i) {
    EXPECT_EQ(queue_->size(), expected_size);

    const Message* msg = queue_->Peek();
    ASSERT_NE(msg, nullptr);
    EXPECT_EQ(queue_->size(), expected_size);  // Peek doesn't change size

    queue_->PopFront();
    expected_size--;
    EXPECT_EQ(queue_->size(), expected_size);  // PopFront decrements
  }

  EXPECT_EQ(queue_->size(), 10);
}

// =============================================================================
// CONCURRENT SIZE TRACKING
// =============================================================================

TEST_F(SaturationDetectionTest, QueueSize_ConcurrentEnqueue_ThreadSafe) {
  // Multiple threads enqueue, verify size() is correct
  constexpr int kThreadCount = 4;
  constexpr int kMessagesPerThread = 25;
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this]() { EnqueueMessages(kMessagesPerThread); });
  }

  for (auto& t : threads) {
    t.join();
  }

  EXPECT_EQ(queue_->size(), kThreadCount * kMessagesPerThread);
}

TEST_F(SaturationDetectionTest,
       QueueSize_ConcurrentDequeue_ThreadSafeDecrement) {
  EnqueueMessages(100);
  EXPECT_EQ(queue_->size(), 100);

  constexpr int kThreadCount = 4;
  constexpr int kDequeuesPerThread = 10;
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this]() {
      for (int j = 0; j < kDequeuesPerThread; ++j) {
        [[maybe_unused]] auto msg = queue_->TryDequeue();
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  EXPECT_EQ(queue_->size(), 100 - (kThreadCount * kDequeuesPerThread));
}

// =============================================================================
// EDGE CASES
// =============================================================================

TEST_F(SaturationDetectionTest, QueueSize_ExactlyAtThreshold_Boundary) {
  // Exactly 16 messages (boundary case)
  EnqueueMessages(16);
  EXPECT_EQ(queue_->size(), 16);

  // TypeScript saturation check: size > 16
  // At exactly 16, NOT saturated
  EXPECT_FALSE(queue_->size() > 16);

  // Add one more to cross threshold
  EnqueueMessages(1);
  EXPECT_EQ(queue_->size(), 17);
  EXPECT_TRUE(queue_->size() > 16);  // Now saturated
}

TEST_F(SaturationDetectionTest, QueueSize_AfterShutdown_StillAccessible) {
  EnqueueMessages(10);
  EXPECT_EQ(queue_->size(), 10);

  queue_->Shutdown();

  // Size should still be queryable after shutdown
  EXPECT_EQ(queue_->size(), 10);
}

TEST_F(SaturationDetectionTest, QueueSize_PopFrontOnEmpty_NoUnderflow) {
  EXPECT_EQ(queue_->size(), 0);

  // PopFront on empty queue should not cause underflow
  queue_->PopFront();
  EXPECT_EQ(queue_->size(), 0);

  // Multiple PopFront calls
  for (int i = 0; i < 10; ++i) {
    queue_->PopFront();
    EXPECT_EQ(queue_->size(), 0);
  }
}

// =============================================================================
// DEQUEUE EVENT SEMANTICS (Note: Actual event scheduling is in TypeScript)
// =============================================================================

TEST_F(SaturationDetectionTest,
       DequeueCallback_CalledAfterSizeDecrease_IfImplemented) {
  // NOTE: The CodecWorker template has SignalDequeue() which would call
  // a dequeue callback after processing a message. This test validates
  // the pattern, though actual callback wiring is done by worker subclasses.

  // This is more of a documentation test - showing how dequeue events
  // should work at the C++ level to support TypeScript saturation detection.

  EnqueueMessages(20);

  // Simulate worker processing pattern
  auto msg = queue_->TryDequeue();
  ASSERT_TRUE(msg.has_value());

  // After dequeue, size decreased
  size_t new_size = queue_->size();
  EXPECT_EQ(new_size, 19);

  // In actual CodecWorker, this would trigger:
  // SignalDequeue(new_size) → calls dequeue_callback_ → TSFN to JS
  // → fires 'dequeue' event in TypeScript
}

}  // namespace
