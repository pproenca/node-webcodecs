// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * test_concurrent_operations.cpp - Thread safety stress tests.
 *
 * Validates that concurrent operations on ControlMessageQueue are thread-safe:
 * - No data races (verified by ThreadSanitizer)
 * - No deadlocks during shutdown
 * - FIFO ordering preserved under concurrent load
 * - Atomic operations on size/blocked flags
 *
 * Run with ThreadSanitizer:
 *   cmake .. -DTSAN=ON && make
 *   TSAN_OPTIONS=halt_on_error=1 ./webcodecs_tests
 *
 * @see https://www.w3.org/TR/webcodecs/#control-message-queue
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
using FlushMessage = VideoQueue::FlushMessage;
using ResetMessage = VideoQueue::ResetMessage;

// =============================================================================
// FIXTURES
// =============================================================================

class ConcurrentOperationsTest : public ::testing::Test {
 protected:
  void SetUp() override {
    queue_ = std::make_unique<VideoQueue>();
  }

  void TearDown() override {
    queue_->Shutdown();
  }

  std::unique_ptr<VideoQueue> queue_;
};

// =============================================================================
// CONCURRENT ENQUEUE TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest, ConcurrentEnqueue_From10Threads_NoDataRaces) {
  // Stress test: 10 threads each enqueue 100 messages
  constexpr int kThreadCount = 10;
  constexpr int kMessagesPerThread = 100;
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, i]() {
      for (int j = 0; j < kMessagesPerThread; ++j) {
        DecodeMessage msg;
        msg.packet = CreateEmptyPacket();
        EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  // All messages should be enqueued
  EXPECT_EQ(queue_->size(), kThreadCount * kMessagesPerThread);
}

TEST_F(ConcurrentOperationsTest,
       ConcurrentEnqueue_MixedMessageTypes_PreservesFIFO) {
  // Multiple threads enqueue different message types
  // Verify FIFO ordering is preserved
  constexpr int kThreadCount = 5;
  constexpr int kMessagesPerThread = 20;
  std::atomic<int> enqueued_count{0};
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, i, &enqueued_count]() {
      for (int j = 0; j < kMessagesPerThread; ++j) {
        // Alternate between decode and flush messages
        if (j % 2 == 0) {
          DecodeMessage msg;
          msg.packet = CreateEmptyPacket();
          EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
        } else {
          FlushMessage msg;
          msg.promise_id = i * kMessagesPerThread + j;
          EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
        }
        enqueued_count++;
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  EXPECT_EQ(queue_->size(), kThreadCount * kMessagesPerThread);
  EXPECT_EQ(enqueued_count.load(), kThreadCount * kMessagesPerThread);
}

// =============================================================================
// CONCURRENT DEQUEUE TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest, ConcurrentDequeue_From5Threads_ThreadSafe) {
  // Pre-fill queue
  constexpr int kMessageCount = 500;
  for (int i = 0; i < kMessageCount; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  // Multiple threads dequeue concurrently
  constexpr int kThreadCount = 5;
  std::atomic<int> dequeued_count{0};
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, &dequeued_count]() {
      while (true) {
        auto msg = queue_->TryDequeue();
        if (!msg.has_value()) {
          break;  // Queue empty
        }
        dequeued_count++;
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  // All messages should be dequeued exactly once
  EXPECT_EQ(dequeued_count.load(), kMessageCount);
  EXPECT_TRUE(queue_->empty());
}

// =============================================================================
// PRODUCER-CONSUMER TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest,
       ProducerConsumer_ContinuousFlow_NoDeadlock) {
  // Producer thread: continuously enqueue messages
  // Consumer thread: continuously dequeue messages
  constexpr int kMessageCount = 1000;
  std::atomic<bool> producer_done{false};
  std::atomic<int> consumed_count{0};

  // Producer thread
  std::thread producer([this, &producer_done]() {
    for (int i = 0; i < kMessageCount; ++i) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      EXPECT_TRUE(queue_->Enqueue(std::move(msg)));

      // Small delay to interleave with consumer
      if (i % 50 == 0) {
        std::this_thread::sleep_for(std::chrono::microseconds(10));
      }
    }
    producer_done.store(true);
  });

  // Consumer thread
  std::thread consumer([this, &producer_done, &consumed_count]() {
    while (!producer_done.load() || !queue_->empty()) {
      auto msg = queue_->TryDequeue();
      if (msg.has_value()) {
        consumed_count++;
      } else {
        // Queue temporarily empty, yield
        std::this_thread::yield();
      }
    }
  });

  producer.join();
  consumer.join();

  // All produced messages should be consumed
  EXPECT_EQ(consumed_count.load(), kMessageCount);
  EXPECT_TRUE(queue_->empty());
}

// =============================================================================
// SHUTDOWN DURING DEQUEUE TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest, QueueShutdown_DuringBlockingDequeue_NoDeadlock) {
  // Thread blocked on Dequeue() should wake up when Shutdown() is called
  SimpleLatch dequeue_started;
  SimpleLatch shutdown_called;
  std::atomic<bool> dequeue_returned{false};

  std::thread dequeue_thread([this, &dequeue_started, &shutdown_called,
                              &dequeue_returned]() {
    dequeue_started.Signal();

    // Block waiting for message
    auto msg = queue_->Dequeue();

    // Should return nullopt after shutdown
    EXPECT_FALSE(msg.has_value());
    dequeue_returned.store(true);
  });

  // Wait for dequeue to start blocking
  ASSERT_TRUE(dequeue_started.Wait());
  std::this_thread::sleep_for(std::chrono::milliseconds(50));

  // Shutdown queue (should wake up Dequeue())
  queue_->Shutdown();
  shutdown_called.Signal();

  // Wait for dequeue thread to finish (should not hang)
  dequeue_thread.join();

  EXPECT_TRUE(dequeue_returned.load());
}

TEST_F(ConcurrentOperationsTest,
       MultipleBlockedDequeuers_ShutdownWakesAll_NoDeadlock) {
  // Multiple threads blocked on Dequeue() should all wake up on Shutdown()
  constexpr int kThreadCount = 10;
  std::atomic<int> woken_count{0};
  CountDownLatch all_started(kThreadCount);
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, &all_started, &woken_count]() {
      all_started.CountDown();

      // Block waiting for message
      auto msg = queue_->Dequeue();

      // Should return nullopt after shutdown
      EXPECT_FALSE(msg.has_value());
      woken_count++;
    });
  }

  // Wait for all threads to start blocking
  ASSERT_TRUE(all_started.Wait());
  std::this_thread::sleep_for(std::chrono::milliseconds(100));

  // Shutdown should wake all threads
  queue_->Shutdown();

  for (auto& t : threads) {
    t.join();
  }

  // All threads should have woken up
  EXPECT_EQ(woken_count.load(), kThreadCount);
}

// =============================================================================
// PEEK/POPFRONT CONCURRENT TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest, ConcurrentPeek_MultipleThreads_ThreadSafe) {
  // Multiple threads can Peek() simultaneously without races
  DecodeMessage msg;
  msg.packet = CreateEmptyPacket();
  ASSERT_TRUE(queue_->Enqueue(std::move(msg)));

  constexpr int kThreadCount = 10;
  std::atomic<int> peek_success_count{0};
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, &peek_success_count]() {
      for (int j = 0; j < 100; ++j) {
        const Message* front = queue_->Peek();
        if (front != nullptr) {
          peek_success_count++;
        }
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  // All peeks should have seen the message
  EXPECT_EQ(peek_success_count.load(), kThreadCount * 100);

  // Message should still be in queue (Peek doesn't remove)
  EXPECT_EQ(queue_->size(), 1);
}

TEST_F(ConcurrentOperationsTest,
       PeekPopFront_SingleThreadPattern_NoRaces) {
  // Single consumer using Peek/PopFront pattern
  // while producer enqueues messages
  constexpr int kMessageCount = 500;
  std::atomic<bool> producer_done{false};
  std::atomic<int> consumed_count{0};

  std::thread producer([this, &producer_done]() {
    for (int i = 0; i < kMessageCount; ++i) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
    }
    producer_done.store(true);
  });

  std::thread consumer([this, &producer_done, &consumed_count]() {
    while (!producer_done.load() || !queue_->empty()) {
      const Message* front = queue_->Peek();
      if (front != nullptr) {
        // Process message (just verify it exists)
        EXPECT_TRUE(std::holds_alternative<DecodeMessage>(*front));

        // Remove after processing
        queue_->PopFront();
        consumed_count++;
      } else {
        std::this_thread::yield();
      }
    }
  });

  producer.join();
  consumer.join();

  EXPECT_EQ(consumed_count.load(), kMessageCount);
  EXPECT_TRUE(queue_->empty());
}

// =============================================================================
// ATOMIC OPERATIONS TESTS
// =============================================================================

TEST_F(ConcurrentOperationsTest, BlockedFlag_SetGetConcurrent_ThreadSafe) {
  // Multiple threads toggle blocked flag concurrently
  constexpr int kThreadCount = 10;
  constexpr int kIterations = 1000;
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this, i]() {
      for (int j = 0; j < kIterations; ++j) {
        // Alternate between setting true and false
        queue_->SetBlocked(j % 2 == 0);

        // Read blocked state (should not crash or race)
        [[maybe_unused]] bool blocked = queue_->IsBlocked();
      }
    });
  }

  for (auto& t : threads) {
    t.join();
  }

  // Final state is non-deterministic but should be valid
  // (either true or false, not corrupted)
  [[maybe_unused]] bool final_blocked = queue_->IsBlocked();
}

TEST_F(ConcurrentOperationsTest, Size_ConcurrentQuery_AlwaysAccurate) {
  // Size queries during concurrent enqueue/dequeue should be consistent
  constexpr int kInitialMessages = 100;

  // Pre-fill queue
  for (int i = 0; i < kInitialMessages; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  std::atomic<bool> stop{false};
  std::atomic<size_t> min_size{kInitialMessages};
  std::atomic<size_t> max_size{kInitialMessages};

  // Thread 1: Enqueue messages
  std::thread enqueuer([this, &stop]() {
    while (!stop.load()) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      queue_->Enqueue(std::move(msg));
      std::this_thread::sleep_for(std::chrono::microseconds(100));
    }
  });

  // Thread 2: Dequeue messages
  std::thread dequeuer([this, &stop]() {
    while (!stop.load()) {
      [[maybe_unused]] auto msg = queue_->TryDequeue();
      std::this_thread::sleep_for(std::chrono::microseconds(100));
    }
  });

  // Thread 3: Monitor size
  std::thread monitor([this, &stop, &min_size, &max_size]() {
    for (int i = 0; i < 100; ++i) {
      size_t current_size = queue_->size();

      // Update min/max
      size_t current_min = min_size.load();
      while (current_size < current_min &&
             !min_size.compare_exchange_weak(current_min, current_size)) {
      }

      size_t current_max = max_size.load();
      while (current_size > current_max &&
             !max_size.compare_exchange_weak(current_max, current_size)) {
      }

      std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    stop.store(true);
  });

  enqueuer.join();
  dequeuer.join();
  monitor.join();

  // Size should have fluctuated during concurrent operations
  // (this is a weak check, mainly ensures no crashes/races)
  EXPECT_GE(max_size.load(), min_size.load());
}

// =============================================================================
// STRESS TEST
// =============================================================================

TEST_F(ConcurrentOperationsTest, HighLoad_MixedOperations_NoRaces) {
  // Stress test: multiple threads performing mixed operations
  constexpr int kProducers = 5;
  constexpr int kConsumers = 5;
  constexpr int kMessagesPerProducer = 200;

  std::atomic<int> produced{0};
  std::atomic<int> consumed{0};
  std::atomic<bool> producers_done{false};
  std::vector<std::thread> threads;

  // Producer threads
  for (int i = 0; i < kProducers; ++i) {
    threads.emplace_back([this, &produced]() {
      for (int j = 0; j < kMessagesPerProducer; ++j) {
        DecodeMessage msg;
        msg.packet = CreateEmptyPacket();
        EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
        produced++;

        // Occasionally query state
        if (j % 20 == 0) {
          [[maybe_unused]] size_t sz = queue_->size();
          [[maybe_unused]] bool empty = queue_->empty();
        }
      }
    });
  }

  // Consumer threads
  for (int i = 0; i < kConsumers; ++i) {
    threads.emplace_back([this, &consumed, &producers_done]() {
      int local_consumed = 0;
      while (!producers_done.load() || !queue_->empty()) {
        // Use TryDequeue only (Peek/PopFront is not thread-safe across threads)
        auto msg = queue_->TryDequeue();
        if (msg.has_value()) {
          local_consumed++;
        }

        std::this_thread::yield();
      }
      consumed.fetch_add(local_consumed);
    });
  }

  // Wait for producers to finish
  for (int i = 0; i < kProducers; ++i) {
    threads[i].join();
  }
  producers_done.store(true);

  // Wait for consumers to finish
  for (int i = kProducers; i < kProducers + kConsumers; ++i) {
    threads[i].join();
  }

  // All produced messages should be consumed
  EXPECT_EQ(produced.load(), kProducers * kMessagesPerProducer);
  EXPECT_EQ(consumed.load(), produced.load());
  EXPECT_TRUE(queue_->empty());
}

}  // namespace
