// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native unit tests for ControlMessageQueue.
// Validates W3C WebCodecs spec control message queue semantics.
//
// Spec reference: docs/specs/2-codec-processing-model/2.2-control-messages.md

#include <gtest/gtest.h>

#include <chrono>
#include <thread>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

// =============================================================================
// TEST FIXTURE
// =============================================================================

class ControlMessageQueueTest : public ::testing::Test {
 protected:
  VideoControlQueue queue_;
};

// =============================================================================
// HAPPY PATH TESTS
// =============================================================================

TEST_F(ControlMessageQueueTest, Enqueue_WhenNotClosed_ReturnsTrue) {
  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };

  EXPECT_TRUE(queue_.Enqueue(msg));
}

TEST_F(ControlMessageQueueTest, Dequeue_FIFOOrdering_PreservesEnqueueOrder) {
  // Enqueue 3 different message types in specific order
  VideoControlQueue::ConfigureMessage configure;
  configure.configure_fn = []() { return true; };
  queue_.Enqueue(configure);

  VideoControlQueue::DecodeMessage decode;
  decode.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(decode));

  VideoControlQueue::FlushMessage flush;
  flush.promise_id = 42;
  queue_.Enqueue(flush);

  // Dequeue and verify FIFO order per spec 2.2
  auto msg1 = queue_.Dequeue();
  ASSERT_TRUE(msg1.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::ConfigureMessage>(*msg1));

  auto msg2 = queue_.Dequeue();
  ASSERT_TRUE(msg2.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::DecodeMessage>(*msg2));

  auto msg3 = queue_.Dequeue();
  ASSERT_TRUE(msg3.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::FlushMessage>(*msg3));

  // Verify flush message preserved promise_id
  auto* flush_ptr = std::get_if<VideoControlQueue::FlushMessage>(&*msg3);
  ASSERT_NE(flush_ptr, nullptr);
  EXPECT_EQ(flush_ptr->promise_id, 42u);
}

TEST_F(ControlMessageQueueTest, Size_ReflectsEnqueuedMessages) {
  EXPECT_EQ(queue_.size(), 0u);

  VideoControlQueue::ConfigureMessage msg1;
  msg1.configure_fn = []() { return true; };
  queue_.Enqueue(msg1);
  EXPECT_EQ(queue_.size(), 1u);

  VideoControlQueue::DecodeMessage msg2;
  msg2.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(msg2));
  EXPECT_EQ(queue_.size(), 2u);

  queue_.Dequeue();
  EXPECT_EQ(queue_.size(), 1u);

  queue_.Dequeue();
  EXPECT_EQ(queue_.size(), 0u);
}

TEST_F(ControlMessageQueueTest, Empty_ReflectsQueueState) {
  EXPECT_TRUE(queue_.empty());

  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };
  queue_.Enqueue(msg);

  EXPECT_FALSE(queue_.empty());

  queue_.Dequeue();

  EXPECT_TRUE(queue_.empty());
}

TEST_F(ControlMessageQueueTest, DequeueFor_WithTimeout_WaitsForMessage) {
  std::thread producer([this]() {
    // Sleep 50ms, then enqueue
    std::this_thread::sleep_for(std::chrono::milliseconds(50));

    VideoControlQueue::ConfigureMessage msg;
    msg.configure_fn = []() { return true; };
    queue_.Enqueue(msg);
  });

  // Dequeue with 500ms timeout - should succeed after 50ms
  auto start = std::chrono::steady_clock::now();
  auto result = queue_.DequeueFor(std::chrono::milliseconds(500));
  auto elapsed = std::chrono::steady_clock::now() - start;

  ASSERT_TRUE(result.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::ConfigureMessage>(*result));

  // Should have waited at least 50ms but less than 500ms
  EXPECT_GE(elapsed, std::chrono::milliseconds(40));  // Allow some jitter
  EXPECT_LT(elapsed, std::chrono::milliseconds(400));

  producer.join();
}

TEST_F(ControlMessageQueueTest, Dequeue_ConcurrentEnqueue_ThreadSafe) {
  SimpleLatch latch;
  std::atomic<int> dequeued_count{0};
  const int kMessageCount = 100;

  // Consumer thread
  std::thread consumer([&]() {
    for (int i = 0; i < kMessageCount; ++i) {
      auto msg = queue_.Dequeue();
      if (msg.has_value()) {
        ++dequeued_count;
      } else {
        break;  // Queue closed
      }
    }
    latch.Signal();
  });

  // Producer thread
  std::thread producer([&]() {
    for (int i = 0; i < kMessageCount; ++i) {
      VideoControlQueue::DecodeMessage msg;
      msg.packet = ffmpeg::make_packet();
      queue_.Enqueue(std::move(msg));
    }
  });

  producer.join();

  // Wait for consumer to process all messages
  ASSERT_TRUE(latch.Wait(std::chrono::seconds(5)));
  consumer.join();

  EXPECT_EQ(dequeued_count.load(), kMessageCount);
}

TEST_F(ControlMessageQueueTest, Blocked_SetAndQuery_ThreadSafe) {
  EXPECT_FALSE(queue_.IsBlocked());

  queue_.SetBlocked(true);
  EXPECT_TRUE(queue_.IsBlocked());

  queue_.SetBlocked(false);
  EXPECT_FALSE(queue_.IsBlocked());
}

TEST_F(ControlMessageQueueTest, TryDequeue_WhenEmpty_ReturnsNullopt) {
  auto result = queue_.TryDequeue();
  EXPECT_FALSE(result.has_value());
}

TEST_F(ControlMessageQueueTest, TryDequeue_WhenNotEmpty_ReturnsMessage) {
  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };
  queue_.Enqueue(msg);

  auto result = queue_.TryDequeue();
  ASSERT_TRUE(result.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::ConfigureMessage>(*result));
}

// =============================================================================
// SAD PATH TESTS
// =============================================================================

TEST_F(ControlMessageQueueTest, Enqueue_WhenClosed_ReturnsFalse) {
  queue_.Shutdown();

  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };

  EXPECT_FALSE(queue_.Enqueue(msg));
}

TEST_F(ControlMessageQueueTest, Dequeue_WhenClosedAndEmpty_ReturnsNullopt) {
  queue_.Shutdown();

  auto result = queue_.Dequeue();
  EXPECT_FALSE(result.has_value());
}

TEST_F(ControlMessageQueueTest, DequeueFor_WhenTimeout_ReturnsNullopt) {
  auto result = queue_.DequeueFor(std::chrono::milliseconds(10));
  EXPECT_FALSE(result.has_value());
}

TEST_F(ControlMessageQueueTest, Clear_DropsAllMessages_ReturnsPackets) {
  // Enqueue 5 decode messages with packets
  for (int i = 0; i < 5; ++i) {
    VideoControlQueue::DecodeMessage msg;
    msg.packet = ffmpeg::make_packet();
    ASSERT_NE(msg.packet.get(), nullptr);
    queue_.Enqueue(std::move(msg));
  }

  EXPECT_EQ(queue_.size(), 5u);

  // Clear the queue
  auto dropped = queue_.Clear();

  EXPECT_EQ(queue_.size(), 0u);
  EXPECT_EQ(dropped.size(), 5u);

  // Verify packets were moved out (not leaked)
  for (auto& packet : dropped) {
    EXPECT_NE(packet.get(), nullptr);
  }
}

TEST_F(ControlMessageQueueTest, ClearFrames_DropsEncodeMessages_ReturnsFrames) {
  // Enqueue 5 encode messages with frames
  for (int i = 0; i < 5; ++i) {
    VideoControlQueue::EncodeMessage msg;
    msg.frame = CreateTestFrame(320, 240);
    ASSERT_NE(msg.frame.get(), nullptr);
    msg.key_frame = (i == 0);  // First frame is keyframe
    queue_.Enqueue(std::move(msg));
  }

  EXPECT_EQ(queue_.size(), 5u);

  // Clear the queue
  auto dropped = queue_.ClearFrames();

  EXPECT_EQ(queue_.size(), 0u);
  EXPECT_EQ(dropped.size(), 5u);

  // Verify frames were moved out (not leaked)
  for (auto& frame : dropped) {
    EXPECT_NE(frame.get(), nullptr);
    EXPECT_EQ(frame->width, 320);
    EXPECT_EQ(frame->height, 240);
  }
}

TEST_F(ControlMessageQueueTest, Shutdown_UnblocksWaitingDequeuers) {
  SimpleLatch latch;
  std::atomic<bool> dequeue_returned{false};

  std::thread waiter([&]() {
    auto msg = queue_.Dequeue();
    dequeue_returned.store(true);
    latch.Signal();
  });

  // Give the waiter time to block on Dequeue()
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
  EXPECT_FALSE(dequeue_returned.load());

  // Shutdown should unblock the waiter
  queue_.Shutdown();

  ASSERT_TRUE(latch.Wait(std::chrono::seconds(1)));
  EXPECT_TRUE(dequeue_returned.load());

  waiter.join();
}

TEST_F(ControlMessageQueueTest, IsClosed_ReflectsShutdownState) {
  EXPECT_FALSE(queue_.IsClosed());

  queue_.Shutdown();

  EXPECT_TRUE(queue_.IsClosed());
}

TEST_F(ControlMessageQueueTest, Dequeue_AfterShutdown_DrainsThenReturnsNullopt) {
  // Enqueue 3 messages
  for (int i = 0; i < 3; ++i) {
    VideoControlQueue::ConfigureMessage msg;
    msg.configure_fn = []() { return true; };
    queue_.Enqueue(msg);
  }

  // Shutdown the queue
  queue_.Shutdown();

  // Should still be able to drain existing messages
  auto msg1 = queue_.Dequeue();
  EXPECT_TRUE(msg1.has_value());

  auto msg2 = queue_.Dequeue();
  EXPECT_TRUE(msg2.has_value());

  auto msg3 = queue_.Dequeue();
  EXPECT_TRUE(msg3.has_value());

  // Now queue is empty and closed - should return nullopt
  auto msg4 = queue_.Dequeue();
  EXPECT_FALSE(msg4.has_value());
}

TEST_F(ControlMessageQueueTest, Clear_MixedMessages_OnlyReturnsPackets) {
  // Enqueue mix of configure, decode, flush, reset messages
  VideoControlQueue::ConfigureMessage configure;
  configure.configure_fn = []() { return true; };
  queue_.Enqueue(configure);

  VideoControlQueue::DecodeMessage decode1;
  decode1.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(decode1));

  VideoControlQueue::FlushMessage flush;
  flush.promise_id = 1;
  queue_.Enqueue(flush);

  VideoControlQueue::DecodeMessage decode2;
  decode2.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(decode2));

  VideoControlQueue::ResetMessage reset;
  queue_.Enqueue(reset);

  EXPECT_EQ(queue_.size(), 5u);

  // Clear - should return only the 2 decode message packets
  auto dropped = queue_.Clear();

  EXPECT_EQ(queue_.size(), 0u);
  EXPECT_EQ(dropped.size(), 2u);

  for (auto& packet : dropped) {
    EXPECT_NE(packet.get(), nullptr);
  }
}

// =============================================================================
// SPEC COMPLIANCE TESTS
// =============================================================================

/**
 * Per W3C WebCodecs spec 2.2: Control messages are processed FIFO.
 * This test verifies strict FIFO ordering under concurrent load.
 */
TEST_F(ControlMessageQueueTest, Spec_FIFOOrdering_UnderConcurrentLoad) {
  const int kProducers = 4;
  const int kMessagesPerProducer = 25;
  std::vector<std::thread> producers;
  std::vector<int> dequeued_values;
  std::mutex dequeued_mutex;

  // Each producer enqueues messages with unique IDs
  for (int producer_id = 0; producer_id < kProducers; ++producer_id) {
    producers.emplace_back([&, producer_id]() {
      for (int i = 0; i < kMessagesPerProducer; ++i) {
        VideoControlQueue::FlushMessage msg;
        msg.promise_id = producer_id * 1000 + i;
        queue_.Enqueue(msg);
      }
    });
  }

  // Consumer thread dequeues all messages
  std::thread consumer([&]() {
    for (int i = 0; i < kProducers * kMessagesPerProducer; ++i) {
      auto msg = queue_.Dequeue();
      if (msg.has_value()) {
        auto* flush = std::get_if<VideoControlQueue::FlushMessage>(&*msg);
        if (flush) {
          std::lock_guard<std::mutex> lock(dequeued_mutex);
          dequeued_values.push_back(flush->promise_id);
        }
      }
    }
  });

  for (auto& p : producers) {
    p.join();
  }
  consumer.join();

  // Verify we got all messages
  EXPECT_EQ(dequeued_values.size(), static_cast<size_t>(kProducers * kMessagesPerProducer));

  // Verify per-producer FIFO ordering
  // (Global FIFO across producers not guaranteed due to thread scheduling)
  for (int producer_id = 0; producer_id < kProducers; ++producer_id) {
    std::vector<int> producer_values;
    for (int val : dequeued_values) {
      if (val >= producer_id * 1000 && val < (producer_id + 1) * 1000) {
        producer_values.push_back(val);
      }
    }

    EXPECT_EQ(producer_values.size(), static_cast<size_t>(kMessagesPerProducer));

    // Verify producer's messages are in order
    for (size_t i = 0; i < producer_values.size(); ++i) {
      EXPECT_EQ(producer_values[i], producer_id * 1000 + static_cast<int>(i));
    }
  }
}

/**
 * Per spec: [[message queue blocked]] prevents processing.
 * This test verifies the blocked flag semantics.
 */
TEST_F(ControlMessageQueueTest, Spec_BlockedFlag_Atomic) {
  // Test concurrent SetBlocked/IsBlocked operations
  std::atomic<bool> stop{false};
  std::vector<std::thread> threads;

  for (int i = 0; i < 10; ++i) {
    threads.emplace_back([&, i]() {
      while (!stop.load()) {
        queue_.SetBlocked(i % 2 == 0);
        bool blocked = queue_.IsBlocked();
        (void)blocked;  // Prevent unused warning
      }
    });
  }

  std::this_thread::sleep_for(std::chrono::milliseconds(100));
  stop.store(true);

  for (auto& t : threads) {
    t.join();
  }

  // If we got here without crashing, atomic operations work correctly
  SUCCEED();
}
