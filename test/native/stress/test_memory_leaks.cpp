// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * test_memory_leaks.cpp - Memory safety validation with ASan/LSan.
 *
 * Validates that RAII wrappers and queue operations don't leak memory:
 * - AVFramePtr/AVPacketPtr cleanup under load
 * - Queue Clear() returns resources for proper cleanup
 * - No leaks during concurrent operations
 * - Shutdown releases all resources
 *
 * Run with AddressSanitizer + LeakSanitizer:
 *   cmake .. -DSANITIZE=ON && make
 *   ASAN_OPTIONS=detect_leaks=1 ./webcodecs_tests
 *
 * @see src/ffmpeg_raii.h for RAII wrapper implementation
 */

#include <gtest/gtest.h>

#include <atomic>
#include <chrono>
#include <thread>
#include <vector>

#include "src/ffmpeg_raii.h"
#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

namespace {

using VideoQueue = VideoControlQueue;
using DecodeMessage = VideoQueue::DecodeMessage;
using EncodeMessage = VideoQueue::EncodeMessage;

// =============================================================================
// FIXTURES
// =============================================================================

class MemoryLeakTest : public ::testing::Test {
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
// RAII WRAPPER LEAK TESTS
// =============================================================================

TEST_F(MemoryLeakTest, CreateDestroy1000Packets_NoLeaks) {
  // Create and destroy 1000 packets
  // ASan/LSan should detect leaks if av_packet_free() isn't called
  for (int i = 0; i < 1000; ++i) {
    ffmpeg::AVPacketPtr packet = CreateEmptyPacket();
    ASSERT_NE(packet, nullptr);
    // Packet destroyed at end of scope via RAII
  }

  // All packets should be freed (verified by LSan at program exit)
}

TEST_F(MemoryLeakTest, CreateDestroy1000Frames_NoLeaks) {
  // Create and destroy 1000 frames
  // ASan/LSan should detect leaks if av_frame_free() isn't called
  for (int i = 0; i < 1000; ++i) {
    ffmpeg::AVFramePtr frame = CreateTestFrame(320, 240);
    ASSERT_NE(frame, nullptr);
    // Frame destroyed at end of scope via RAII
  }

  // All frames should be freed (verified by LSan at program exit)
}

TEST_F(MemoryLeakTest, MoveSemantics_TransferOwnership_NoLeaks) {
  // Test that move semantics correctly transfer ownership
  std::vector<ffmpeg::AVPacketPtr> packets;

  for (int i = 0; i < 100; ++i) {
    ffmpeg::AVPacketPtr packet = CreateEmptyPacket();
    ASSERT_NE(packet, nullptr);

    // Move packet into vector (ownership transferred)
    packets.push_back(std::move(packet));

    // Original packet should be null after move
    EXPECT_EQ(packet, nullptr);
  }

  // Vector owns all packets
  EXPECT_EQ(packets.size(), 100);

  // Clear vector - should call destructors for all packets
  packets.clear();

  // All packets should be freed (verified by LSan)
}

// =============================================================================
// QUEUE CLEAR() LEAK TESTS
// =============================================================================

TEST_F(MemoryLeakTest, QueueClear_Returns1000Packets_NoLeaks) {
  // Enqueue 1000 decode messages with packets
  for (int i = 0; i < 1000; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    ASSERT_NE(msg.packet, nullptr);
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  EXPECT_EQ(queue_->size(), 1000);

  // Clear() should return all packets for cleanup
  auto dropped_packets = queue_->Clear();
  EXPECT_EQ(dropped_packets.size(), 1000);

  // Packets go out of scope and are freed via RAII
  // LSan verifies no leaks
}

TEST_F(MemoryLeakTest, QueueClearFrames_Returns1000Frames_NoLeaks) {
  // Enqueue 1000 encode messages with frames
  for (int i = 0; i < 1000; ++i) {
    EncodeMessage msg;
    msg.frame = CreateTestFrame(640, 480);
    ASSERT_NE(msg.frame, nullptr);
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  EXPECT_EQ(queue_->size(), 1000);

  // ClearFrames() should return all frames for cleanup
  auto dropped_frames = queue_->ClearFrames();
  EXPECT_EQ(dropped_frames.size(), 1000);

  // Frames go out of scope and are freed via RAII
  // LSan verifies no leaks
}

// =============================================================================
// SHUTDOWN CLEANUP TESTS
// =============================================================================

TEST_F(MemoryLeakTest, ShutdownWithPending_ReleasesAllResources_NoLeaks) {
  // Enqueue messages, then shutdown without dequeuing
  // Queue destructor should clean up all messages
  for (int i = 0; i < 500; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  EXPECT_EQ(queue_->size(), 500);

  // Shutdown queue (destructor will be called in TearDown)
  // Messages should be cleaned up automatically
  // LSan verifies no leaks
}

TEST_F(MemoryLeakTest, MultipleClearCalls_NoDoubleFreeBug) {
  // Test that multiple Clear() calls don't cause double-free
  for (int i = 0; i < 100; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
  }

  // First clear
  auto packets1 = queue_->Clear();
  EXPECT_EQ(packets1.size(), 100);
  EXPECT_EQ(queue_->size(), 0);

  // Second clear on empty queue
  auto packets2 = queue_->Clear();
  EXPECT_EQ(packets2.size(), 0);
  EXPECT_EQ(queue_->size(), 0);

  // No double-free (ASan would detect)
}

// =============================================================================
// CONCURRENT OPERATION LEAK TESTS
// =============================================================================

TEST_F(MemoryLeakTest, ConcurrentEnqueue_1000Messages_NoLeaks) {
  // Multiple threads enqueue messages concurrently
  constexpr int kThreadCount = 10;
  constexpr int kMessagesPerThread = 100;
  std::vector<std::thread> threads;

  for (int i = 0; i < kThreadCount; ++i) {
    threads.emplace_back([this]() {
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

  EXPECT_EQ(queue_->size(), kThreadCount * kMessagesPerThread);

  // Clear all messages
  auto dropped = queue_->Clear();
  EXPECT_EQ(dropped.size(), kThreadCount * kMessagesPerThread);

  // All packets freed via RAII (LSan verifies)
}

TEST_F(MemoryLeakTest, ProducerConsumer_NoLeaks) {
  // Producer-consumer pattern with 1000 messages
  constexpr int kMessageCount = 1000;
  std::atomic<bool> producer_done{false};
  std::vector<ffmpeg::AVPacketPtr> consumed_packets;
  consumed_packets.reserve(kMessageCount);

  std::thread producer([this, &producer_done]() {
    for (int i = 0; i < kMessageCount; ++i) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      EXPECT_TRUE(queue_->Enqueue(std::move(msg)));
    }
    producer_done.store(true);
  });

  std::thread consumer([this, &producer_done, &consumed_packets]() {
    while (!producer_done.load() || !queue_->empty()) {
      auto msg = queue_->TryDequeue();
      if (msg.has_value()) {
        if (auto* decode = std::get_if<DecodeMessage>(&*msg)) {
          // Move packet out of message (take ownership)
          consumed_packets.push_back(std::move(decode->packet));
        }
      } else {
        std::this_thread::yield();
      }
    }
  });

  producer.join();
  consumer.join();

  // All packets consumed
  EXPECT_EQ(consumed_packets.size(), kMessageCount);

  // Packets go out of scope when vector is destroyed
  consumed_packets.clear();

  // LSan verifies no leaks
}

// =============================================================================
// STRESS TEST UNDER LOAD
// =============================================================================

TEST_F(MemoryLeakTest, HighLoad_CreateDestroyCycle_NoLeaks) {
  // Stress test: Create queue, fill it, clear it, destroy it
  // Repeat 100 times to stress memory allocator
  for (int cycle = 0; cycle < 100; ++cycle) {
    auto temp_queue = std::make_unique<VideoQueue>();

    // Fill queue with 100 messages
    for (int i = 0; i < 100; ++i) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      ASSERT_TRUE(temp_queue->Enqueue(std::move(msg)));
    }

    // Clear queue
    auto dropped = temp_queue->Clear();
    EXPECT_EQ(dropped.size(), 100);

    // Shutdown and destroy queue
    temp_queue->Shutdown();
    temp_queue.reset();
  }

  // 10,000 packets created and destroyed
  // LSan verifies no leaks accumulated
}

TEST_F(MemoryLeakTest, MixedFramesAndPackets_NoLeaks) {
  // Enqueue both decode (packets) and encode (frames) messages
  for (int i = 0; i < 500; ++i) {
    if (i % 2 == 0) {
      DecodeMessage msg;
      msg.packet = CreateEmptyPacket();
      ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
    } else {
      EncodeMessage msg;
      msg.frame = CreateTestFrame(320, 240);
      ASSERT_TRUE(queue_->Enqueue(std::move(msg)));
    }
  }

  EXPECT_EQ(queue_->size(), 500);

  // Dequeue and verify cleanup
  int decode_count = 0;
  int encode_count = 0;

  while (!queue_->empty()) {
    auto msg = queue_->TryDequeue();
    ASSERT_TRUE(msg.has_value());

    if (std::holds_alternative<DecodeMessage>(*msg)) {
      decode_count++;
    } else if (std::holds_alternative<EncodeMessage>(*msg)) {
      encode_count++;
    }

    // Message destroyed at end of loop iteration
  }

  EXPECT_EQ(decode_count, 250);
  EXPECT_EQ(encode_count, 250);

  // All packets and frames should be freed (LSan verifies)
}

// =============================================================================
// EDGE CASE LEAK TESTS
// =============================================================================

TEST_F(MemoryLeakTest, EmptyPacketStillFreed) {
  // Even empty packets should be freed properly
  for (int i = 0; i < 1000; ++i) {
    ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
    ASSERT_NE(packet, nullptr);
    // Packet has no data, but still needs av_packet_free()
  }

  // LSan verifies all packets freed
}

TEST_F(MemoryLeakTest, LargeFrame_PropertyFreed) {
  // Large frames (4K) should be freed without leaks
  for (int i = 0; i < 10; ++i) {
    ffmpeg::AVFramePtr frame = CreateTestFrame(3840, 2160, AV_PIX_FMT_YUV420P);
    ASSERT_NE(frame, nullptr);

    // Large buffer allocated (~20MB per frame)
    EXPECT_GT(frame->linesize[0], 0);
  }

  // All large frames should be freed (LSan verifies)
}

TEST_F(MemoryLeakTest, NullptrInMessage_HandledSafely) {
  // Test that null packets in messages don't cause issues
  DecodeMessage msg;
  msg.packet = nullptr;  // Explicitly null

  // Should be safe to move null packet
  ASSERT_TRUE(queue_->Enqueue(std::move(msg)));

  auto retrieved = queue_->TryDequeue();
  ASSERT_TRUE(retrieved.has_value());

  auto* decode = std::get_if<DecodeMessage>(&*retrieved);
  ASSERT_NE(decode, nullptr);
  EXPECT_EQ(decode->packet, nullptr);

  // No leaks, no crashes
}

}  // namespace
