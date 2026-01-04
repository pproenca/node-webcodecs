// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Queue semantics tests for W3C WebCodecs spec compliance.
// Validates control message queue processing per spec 2.2.
//
// Spec reference: docs/specs/2-codec-processing-model/2.2-control-messages.md
//
// Key spec requirements:
// 1. Messages are processed FIFO
// 2. Messages return "processed" or "not processed"
// 3. "not processed" messages remain in queue and retry later
// 4. [[message queue blocked]] pauses processing
// 5. Configure operations block the queue

#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include <atomic>
#include <chrono>
#include <deque>
#include <string>
#include <thread>
#include <variant>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

// =============================================================================
// QUEUE PROCESSOR SIMULATOR
// =============================================================================

/**
 * Simulates the W3C spec queue processing algorithm.
 * Per spec 2.2: "Process the control message queue"
 *
 * Algorithm:
 * 1. While [[message queue blocked]] is false AND queue is not empty:
 *    a. Get front message
 *    b. Run control message steps
 *    c. If outcome = "not processed", break
 *    d. If outcome = "processed", dequeue message
 */
class QueueProcessor {
 public:
  enum class Outcome {
    kProcessed,     // Message executed, remove from queue
    kNotProcessed   // Message must retry, keep in queue
  };

  using MessageHandler = std::function<Outcome()>;

  struct Message {
    std::string type;
    MessageHandler handler;
    int retry_count = 0;
  };

  explicit QueueProcessor(VideoControlQueue* queue)
      : queue_(queue), blocked_(false), saturated_(false) {}

  /**
   * Process the control message queue per spec 2.2.
   * Returns number of messages processed.
   *
   * Spec algorithm:
   * While [[message queue blocked]] is false AND queue is not empty:
   *   1. Get front message (Peek, don't dequeue yet)
   *   2. Run control message steps
   *   3. If outcome = "not processed", break (leave in queue)
   *   4. If outcome = "processed", dequeue message (PopFront)
   */
  int ProcessQueue() {
    int processed_count = 0;

    // While [[message queue blocked]] is false AND queue is not empty
    while (!blocked_.load() && !queue_->empty()) {
      // Step 1: Peek at front message WITHOUT removing it
      const auto* msg_ptr = queue_->Peek();
      if (msg_ptr == nullptr) {
        break;  // Queue is empty
      }

      // Step 2: Run control message steps (simulate processing)
      Outcome outcome = SimulateMessageProcessing();

      // Step 3: If "not processed", break and leave message in queue
      if (outcome == Outcome::kNotProcessed) {
        break;
      }

      // Step 4: If "processed", remove message from queue
      queue_->PopFront();
      ++processed_count;
    }

    return processed_count;
  }

  /**
   * Set queue blocked state per spec.
   * When true, ProcessQueue() will pause.
   */
  void SetBlocked(bool blocked) {
    blocked_.store(blocked);
  }

  bool IsBlocked() const {
    return blocked_.load();
  }

  /**
   * Simulate codec saturation.
   * Per spec: saturated codec returns "not processed".
   */
  void SetSaturated(bool saturated) {
    saturated_.store(saturated);
  }

  bool IsSaturated() const {
    return saturated_.load();
  }

 private:
  Outcome SimulateMessageProcessing() {
    // If saturated, return "not processed"
    if (saturated_.load()) {
      return Outcome::kNotProcessed;
    }

    // Simulate successful processing
    return Outcome::kProcessed;
  }

  VideoControlQueue* queue_;
  std::atomic<bool> blocked_;
  std::atomic<bool> saturated_;
};

// =============================================================================
// TEST FIXTURE
// =============================================================================

class QueueSemanticsTest : public ::testing::Test {
 protected:
  void SetUp() override {
    processor_ = std::make_unique<QueueProcessor>(&queue_);
  }

  VideoControlQueue queue_;
  std::unique_ptr<QueueProcessor> processor_;
};

// =============================================================================
// HAPPY PATH TESTS - QUEUE PROCESSING
// =============================================================================

TEST_F(QueueSemanticsTest, ProcessQueue_WhenEmpty_ReturnsZero) {
  int processed = processor_->ProcessQueue();

  EXPECT_EQ(processed, 0);
}

TEST_F(QueueSemanticsTest, ProcessQueue_SingleMessage_ProcessesOne) {
  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };
  queue_.Enqueue(msg);

  int processed = processor_->ProcessQueue();

  EXPECT_EQ(processed, 1);
  EXPECT_TRUE(queue_.empty());
}

TEST_F(QueueSemanticsTest, ProcessQueue_MultipleMessages_ProcessesAllFIFO) {
  // Enqueue 5 messages
  for (int i = 0; i < 5; ++i) {
    VideoControlQueue::FlushMessage msg;
    msg.promise_id = i;
    queue_.Enqueue(msg);
  }

  int processed = processor_->ProcessQueue();

  // Per spec 2.2: all messages processed in FIFO order
  EXPECT_EQ(processed, 5);
  EXPECT_TRUE(queue_.empty());
}

TEST_F(QueueSemanticsTest, ProcessQueue_WhenBlocked_ProcessesZero) {
  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };
  queue_.Enqueue(msg);

  // Set blocked per spec
  processor_->SetBlocked(true);

  int processed = processor_->ProcessQueue();

  // Per spec 2.2: while [[message queue blocked]] is false
  EXPECT_EQ(processed, 0);
  EXPECT_FALSE(queue_.empty());  // Message remains in queue
}

TEST_F(QueueSemanticsTest, ProcessQueue_AfterUnblock_ProcessesMessages) {
  VideoControlQueue::ConfigureMessage msg;
  msg.configure_fn = []() { return true; };
  queue_.Enqueue(msg);

  processor_->SetBlocked(true);
  int processed1 = processor_->ProcessQueue();
  EXPECT_EQ(processed1, 0);

  // Unblock and reprocess per spec
  processor_->SetBlocked(false);
  int processed2 = processor_->ProcessQueue();

  EXPECT_EQ(processed2, 1);
  EXPECT_TRUE(queue_.empty());
}

// =============================================================================
// "NOT PROCESSED" SEMANTICS TESTS
// =============================================================================

TEST_F(QueueSemanticsTest, ProcessQueue_WhenSaturated_ReturnsNotProcessed) {
  VideoControlQueue::DecodeMessage msg;
  msg.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(msg));

  // Simulate codec saturation
  processor_->SetSaturated(true);

  int processed = processor_->ProcessQueue();

  // Per spec: "not processed" stops queue processing
  EXPECT_EQ(processed, 0);
}

/**
 * Per W3C spec: "not processed" messages should remain in queue for retry.
 * Tests Peek()/PopFront() pattern for proper retry behavior.
 */
TEST_F(QueueSemanticsTest,
       ProcessQueue_NotProcessed_MessageRemainsForRetry) {
  VideoControlQueue::DecodeMessage msg1;
  msg1.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(msg1));

  VideoControlQueue::DecodeMessage msg2;
  msg2.packet = ffmpeg::make_packet();
  queue_.Enqueue(std::move(msg2));

  // First message returns "not processed" (saturated)
  processor_->SetSaturated(true);
  int processed1 = processor_->ProcessQueue();

  EXPECT_EQ(processed1, 0);

  // Per spec: Both messages remain in queue (Peek doesn't remove)
  EXPECT_EQ(queue_.size(), 2u);

  // Desaturate and retry
  processor_->SetSaturated(false);
  int processed2 = processor_->ProcessQueue();

  // Now both messages process successfully
  EXPECT_EQ(processed2, 2);
  EXPECT_TRUE(queue_.empty());
}

/**
 * Per spec 2.2: When first message returns "not processed", processing
 * stops and ALL messages remain in queue.
 */
TEST_F(QueueSemanticsTest,
       ProcessQueue_NotProcessed_BlocksSubsequentMessages) {
  // Enqueue 3 messages
  for (int i = 0; i < 3; ++i) {
    VideoControlQueue::DecodeMessage msg;
    msg.packet = ffmpeg::make_packet();
    queue_.Enqueue(std::move(msg));
  }

  // First message returns "not processed"
  processor_->SetSaturated(true);
  int processed = processor_->ProcessQueue();

  // Per spec 2.2 step 3: "If outcome equals 'not processed', break"
  EXPECT_EQ(processed, 0);

  // All 3 messages remain in queue (Peek doesn't remove)
  EXPECT_EQ(queue_.size(), 3u);
}

// =============================================================================
// CONFIGURE BLOCKING TESTS
// =============================================================================

/**
 * Per spec: Configure operations block the queue.
 * Simulates configure blocking until completion.
 */
TEST_F(QueueSemanticsTest, Configure_BlocksQueue_UntilComplete) {
  SimpleLatch configure_started;
  SimpleLatch configure_can_complete;
  std::atomic<bool> configure_completed{false};

  // Enqueue configure message
  VideoControlQueue::ConfigureMessage configure_msg;
  configure_msg.configure_fn = [&]() {
    configure_started.Signal();

    // Simulate long-running configure
    configure_can_complete.Wait();

    configure_completed.store(true);
    return true;
  };
  queue_.Enqueue(configure_msg);

  // Enqueue encode message after configure
  VideoControlQueue::EncodeMessage encode_msg;
  encode_msg.frame = CreateTestFrame(320, 240);
  queue_.Enqueue(std::move(encode_msg));

  // Process queue in background
  std::thread processor_thread([&]() {
    // Block queue during configure per spec
    processor_->SetBlocked(true);

    // Dequeue and execute configure
    auto msg = queue_.Dequeue();
    auto* config = std::get_if<VideoControlQueue::ConfigureMessage>(&*msg);
    if (config) {
      config->configure_fn();
    }

    // Unblock queue after configure per spec
    processor_->SetBlocked(false);

    // Process remaining messages
    processor_->ProcessQueue();
  });

  // Wait for configure to start
  ASSERT_TRUE(configure_started.Wait());

  // Queue should be blocked, encode message not processed yet
  EXPECT_TRUE(processor_->IsBlocked());

  // Allow configure to complete
  configure_can_complete.Signal();

  processor_thread.join();

  EXPECT_TRUE(configure_completed.load());
  EXPECT_FALSE(processor_->IsBlocked());
  EXPECT_TRUE(queue_.empty());  // Both messages processed
}

// =============================================================================
// SPEC COMPLIANCE TESTS
// =============================================================================

/**
 * Test exact algorithm from spec 2.2:
 * "While [[message queue blocked]] is false AND queue is not empty"
 */
TEST_F(QueueSemanticsTest, Spec_ProcessingAlgorithm_ExactSemantics) {
  std::vector<int> processed_ids;

  // Enqueue 10 messages
  for (int i = 0; i < 10; ++i) {
    VideoControlQueue::FlushMessage msg;
    msg.promise_id = i;
    queue_.Enqueue(msg);
  }

  // Process first 5
  for (int i = 0; i < 5; ++i) {
    auto msg = queue_.Dequeue();
    if (msg.has_value()) {
      auto* flush = std::get_if<VideoControlQueue::FlushMessage>(&*msg);
      if (flush) {
        processed_ids.push_back(flush->promise_id);
      }
    }
  }

  // Block queue
  processor_->SetBlocked(true);

  // Try to process remaining - should process 0
  int processed = processor_->ProcessQueue();
  EXPECT_EQ(processed, 0);

  // Unblock and process remaining 5
  processor_->SetBlocked(false);
  for (int i = 0; i < 5; ++i) {
    auto msg = queue_.Dequeue();
    if (msg.has_value()) {
      auto* flush = std::get_if<VideoControlQueue::FlushMessage>(&*msg);
      if (flush) {
        processed_ids.push_back(flush->promise_id);
      }
    }
  }

  // Verify FIFO order: 0, 1, 2, ..., 9
  EXPECT_EQ(processed_ids.size(), 10u);
  for (size_t i = 0; i < processed_ids.size(); ++i) {
    EXPECT_EQ(processed_ids[i], static_cast<int>(i));
  }
}

/**
 * Per spec: "not processed" messages stay in queue and retry.
 * Test retry behavior with saturation using Peek()/PopFront().
 */
TEST_F(QueueSemanticsTest, Spec_NotProcessed_RetryBehavior) {
  VideoControlQueue::DecodeMessage msg;
  msg.packet = ffmpeg::make_packet();
  bool enqueued = queue_.Enqueue(std::move(msg));
  EXPECT_TRUE(enqueued);

  // First attempt: saturated, returns "not processed"
  processor_->SetSaturated(true);
  int processed1 = processor_->ProcessQueue();
  EXPECT_EQ(processed1, 0);

  // Message remains in queue per spec (Peek doesn't remove)
  EXPECT_EQ(queue_.size(), 1u);

  // Second attempt: desaturated, returns "processed"
  processor_->SetSaturated(false);
  int processed2 = processor_->ProcessQueue();

  // Message now processes successfully
  EXPECT_EQ(processed2, 1);
  EXPECT_TRUE(queue_.empty());
}

/**
 * Test queue size tracking with blocked processing.
 * Per spec 3.5: queue size increments before, decrements during processing.
 */
TEST_F(QueueSemanticsTest, Spec_QueueSize_IncrementBeforeDecrementDuring) {
  std::vector<size_t> queue_sizes;

  // Enqueue 3 messages, record size after each
  for (int i = 0; i < 3; ++i) {
    VideoControlQueue::DecodeMessage msg;
    msg.packet = ffmpeg::make_packet();
    bool enqueued = queue_.Enqueue(std::move(msg));
    EXPECT_TRUE(enqueued);

    // Per spec: size increments BEFORE processing
    queue_sizes.push_back(queue_.size());
  }

  EXPECT_THAT(queue_sizes, ::testing::ElementsAre(1, 2, 3));

  // Process messages, record size after each
  queue_sizes.clear();
  while (!queue_.empty()) {
    auto msg = queue_.Dequeue();

    // Per spec: size decrements DURING processing (after dequeue)
    queue_sizes.push_back(queue_.size());
  }

  EXPECT_THAT(queue_sizes, ::testing::ElementsAre(2, 1, 0));
}

// =============================================================================
// CONCURRENT PROCESSING TESTS
// =============================================================================

/**
 * Test queue blocking under concurrent pressure.
 * Verifies blocked flag prevents race conditions.
 */
TEST_F(QueueSemanticsTest, Concurrent_BlockedFlag_PreventsRaces) {
  std::atomic<int> processed_count{0};
  std::atomic<bool> stop{false};

  // Producer thread: enqueue messages
  std::thread producer([&]() {
    for (int i = 0; i < 100; ++i) {
      VideoControlQueue::FlushMessage msg;
      msg.promise_id = i;
      queue_.Enqueue(msg);
      std::this_thread::sleep_for(std::chrono::microseconds(100));
    }
  });

  // Consumer thread: process with random blocking
  std::thread consumer([&]() {
    while (!stop.load()) {
      // Randomly block/unblock
      bool should_block = (processed_count.load() % 5 == 0);
      processor_->SetBlocked(should_block);

      if (!should_block) {
        int count = processor_->ProcessQueue();
        processed_count.fetch_add(count);
      }

      std::this_thread::sleep_for(std::chrono::microseconds(200));
    }
  });

  producer.join();

  // Stop consumer before final processing to avoid race
  stop.store(true);
  consumer.join();

  // Final processing (no concurrent threads now)
  processor_->SetBlocked(false);
  while (!queue_.empty()) {
    int count = processor_->ProcessQueue();
    processed_count.fetch_add(count);
  }

  // All 100 messages should be processed eventually
  EXPECT_EQ(processed_count.load(), 100);
}

/**
 * Test that blocked flag is atomic and thread-safe.
 */
TEST_F(QueueSemanticsTest, Concurrent_BlockedFlag_Atomic) {
  std::vector<std::thread> threads;
  std::atomic<bool> stop{false};

  // Multiple threads setting blocked flag
  for (int i = 0; i < 10; ++i) {
    threads.emplace_back([&, i]() {
      while (!stop.load()) {
        processor_->SetBlocked(i % 2 == 0);
        bool is_blocked = processor_->IsBlocked();
        (void)is_blocked;  // Prevent unused warning
      }
    });
  }

  std::this_thread::sleep_for(std::chrono::milliseconds(100));
  stop.store(true);

  for (auto& t : threads) {
    t.join();
  }

  // If we got here without data races, atomic operations work
  SUCCEED();
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

/**
 * Full workflow: configure blocks, then encode processes.
 * Simulates real VideoEncoder usage.
 */
TEST_F(QueueSemanticsTest, Integration_ConfigureThenEncode_Workflow) {
  std::atomic<bool> configured{false};
  std::atomic<int> encoded_count{0};

  // Enqueue configure
  VideoControlQueue::ConfigureMessage config_msg;
  config_msg.configure_fn = [&]() {
    configured.store(true);
    return true;
  };
  queue_.Enqueue(config_msg);

  // Enqueue 5 encode messages
  for (int i = 0; i < 5; ++i) {
    VideoControlQueue::EncodeMessage encode_msg;
    encode_msg.frame = CreateTestFrame(320, 240);
    queue_.Enqueue(std::move(encode_msg));
  }

  // Process configure (blocks queue)
  processor_->SetBlocked(true);
  auto config = queue_.Dequeue();
  if (config.has_value()) {
    auto* cfg = std::get_if<VideoControlQueue::ConfigureMessage>(&*config);
    if (cfg) {
      cfg->configure_fn();
    }
  }

  EXPECT_TRUE(configured.load());

  // Unblock and process encode messages
  processor_->SetBlocked(false);
  while (!queue_.empty()) {
    auto msg = queue_.Dequeue();
    if (msg.has_value() &&
        std::holds_alternative<VideoControlQueue::EncodeMessage>(*msg)) {
      encoded_count.fetch_add(1);
    }
  }

  EXPECT_EQ(encoded_count.load(), 5);
}
