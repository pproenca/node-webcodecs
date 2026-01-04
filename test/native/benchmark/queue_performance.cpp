// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * queue_performance.cpp - Queue throughput benchmarks.
 *
 * Measures ControlMessageQueue performance under various loads:
 * - Single-threaded enqueue/dequeue throughput
 * - Concurrent producer-consumer throughput
 * - Peek/PopFront vs TryDequeue patterns
 * - Queue size impact on performance
 *
 * Run with: make run_benchmarks
 */

#include <benchmark/benchmark.h>

#include <thread>
#include <vector>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

namespace {

using VideoQueue = VideoControlQueue;
using DecodeMessage = VideoQueue::DecodeMessage;
using FlushMessage = VideoQueue::FlushMessage;

// =============================================================================
// SINGLE-THREADED THROUGHPUT
// =============================================================================

/**
 * Benchmark: Enqueue throughput (messages/sec).
 * Measures raw enqueue performance without dequeue.
 */
static void BM_Enqueue_SingleThread(benchmark::State& state) {
  VideoQueue queue;

  for (auto _ : state) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    benchmark::DoNotOptimize(queue.Enqueue(std::move(msg)));
  }

  // Cleanup
  queue.Shutdown();

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_Enqueue_SingleThread);

/**
 * Benchmark: Dequeue throughput (messages/sec).
 * Measures raw dequeue performance with pre-filled queue.
 */
static void BM_Dequeue_SingleThread(benchmark::State& state) {
  VideoQueue queue;
  const int kPreFill = 10000;

  // Pre-fill queue
  for (int i = 0; i < kPreFill; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    queue.Enqueue(std::move(msg));
  }

  int dequeued = 0;
  for (auto _ : state) {
    auto msg = queue.TryDequeue();
    if (msg.has_value()) {
      benchmark::DoNotOptimize(msg);
      dequeued++;
    } else {
      // Refill when empty
      for (int i = 0; i < kPreFill; ++i) {
        DecodeMessage refill_msg;
        refill_msg.packet = CreateEmptyPacket();
        queue.Enqueue(std::move(refill_msg));
      }
    }
  }

  queue.Shutdown();

  state.SetItemsProcessed(dequeued);
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_Dequeue_SingleThread);

/**
 * Benchmark: Enqueue + Dequeue roundtrip.
 * Measures full cycle latency.
 */
static void BM_EnqueueDequeue_Roundtrip(benchmark::State& state) {
  VideoQueue queue;

  for (auto _ : state) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    queue.Enqueue(std::move(msg));

    auto dequeued = queue.TryDequeue();
    benchmark::DoNotOptimize(dequeued);
  }

  queue.Shutdown();

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("roundtrips/sec");
}
BENCHMARK(BM_EnqueueDequeue_Roundtrip);

// =============================================================================
// PEEK/POPFRONT VS TRYDEQUEUE
// =============================================================================

/**
 * Benchmark: TryDequeue pattern (atomic).
 */
static void BM_TryDequeue_Pattern(benchmark::State& state) {
  VideoQueue queue;
  const int kPreFill = 10000;

  // Pre-fill
  for (int i = 0; i < kPreFill; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    queue.Enqueue(std::move(msg));
  }

  int processed = 0;
  for (auto _ : state) {
    auto msg = queue.TryDequeue();
    if (msg.has_value()) {
      benchmark::DoNotOptimize(msg);
      processed++;
    }

    // Refill when empty
    if (queue.empty()) {
      for (int i = 0; i < kPreFill; ++i) {
        DecodeMessage refill_msg;
        refill_msg.packet = CreateEmptyPacket();
        queue.Enqueue(std::move(refill_msg));
      }
    }
  }

  queue.Shutdown();

  state.SetItemsProcessed(processed);
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_TryDequeue_Pattern);

/**
 * Benchmark: Peek + PopFront pattern.
 * Should be slower than TryDequeue (two mutex locks).
 */
static void BM_PeekPopFront_Pattern(benchmark::State& state) {
  VideoQueue queue;
  const int kPreFill = 10000;

  // Pre-fill
  for (int i = 0; i < kPreFill; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    queue.Enqueue(std::move(msg));
  }

  int processed = 0;
  for (auto _ : state) {
    const auto* front = queue.Peek();
    if (front != nullptr) {
      benchmark::DoNotOptimize(front);
      queue.PopFront();
      processed++;
    }

    // Refill when empty
    if (queue.empty()) {
      for (int i = 0; i < kPreFill; ++i) {
        DecodeMessage refill_msg;
        refill_msg.packet = CreateEmptyPacket();
        queue.Enqueue(std::move(refill_msg));
      }
    }
  }

  queue.Shutdown();

  state.SetItemsProcessed(processed);
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_PeekPopFront_Pattern);

// =============================================================================
// QUEUE SIZE IMPACT
// =============================================================================

/**
 * Benchmark: Dequeue performance with varying queue sizes.
 * Tests if large queue size impacts dequeue speed.
 */
static void BM_Dequeue_VaryingSize(benchmark::State& state) {
  VideoQueue queue;
  const int queue_size = state.range(0);

  // Fill queue to target size
  for (int i = 0; i < queue_size; ++i) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    queue.Enqueue(std::move(msg));
  }

  int dequeued = 0;
  for (auto _ : state) {
    // Dequeue one
    auto msg = queue.TryDequeue();
    if (msg.has_value()) {
      benchmark::DoNotOptimize(msg);
      dequeued++;

      // Enqueue one to maintain size
      DecodeMessage refill_msg;
      refill_msg.packet = CreateEmptyPacket();
      queue.Enqueue(std::move(refill_msg));
    }
  }

  queue.Shutdown();

  state.SetItemsProcessed(dequeued);
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_Dequeue_VaryingSize)
    ->Arg(10)      // Small queue
    ->Arg(100)     // Medium queue
    ->Arg(1000)    // Large queue
    ->Arg(10000);  // Very large queue

// =============================================================================
// CONCURRENT THROUGHPUT
// =============================================================================

/**
 * Benchmark: Concurrent producer-consumer throughput.
 * Measures messages/sec with N producers and N consumers.
 */
static void BM_ProducerConsumer_Concurrent(benchmark::State& state) {
  VideoQueue queue;
  const int kThreadPairs = state.range(0);
  const int kMessagesPerThread = 1000;

  for (auto _ : state) {
    std::atomic<int> produced{0};
    std::atomic<int> consumed{0};
    std::atomic<bool> producers_done{false};
    std::vector<std::thread> threads;

    // Producer threads
    for (int i = 0; i < kThreadPairs; ++i) {
      threads.emplace_back([&]() {
        for (int j = 0; j < kMessagesPerThread; ++j) {
          DecodeMessage msg;
          msg.packet = CreateEmptyPacket();
          queue.Enqueue(std::move(msg));
          produced.fetch_add(1);
        }
      });
    }

    // Consumer threads
    for (int i = 0; i < kThreadPairs; ++i) {
      threads.emplace_back([&]() {
        while (!producers_done.load() || !queue.empty()) {
          auto msg = queue.TryDequeue();
          if (msg.has_value()) {
            consumed.fetch_add(1);
          } else {
            std::this_thread::yield();
          }
        }
      });
    }

    // Wait for producers
    for (int i = 0; i < kThreadPairs; ++i) {
      threads[i].join();
    }
    producers_done.store(true);

    // Wait for consumers
    for (int i = kThreadPairs; i < 2 * kThreadPairs; ++i) {
      threads[i].join();
    }

    benchmark::DoNotOptimize(consumed.load());
  }

  queue.Shutdown();

  const int total_messages = kThreadPairs * kMessagesPerThread;
  state.SetItemsProcessed(state.iterations() * total_messages);
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_ProducerConsumer_Concurrent)
    ->Arg(1)   // 1 producer, 1 consumer
    ->Arg(2)   // 2 producers, 2 consumers
    ->Arg(4)   // 4 producers, 4 consumers
    ->Arg(8);  // 8 producers, 8 consumers

// =============================================================================
// MESSAGE TYPE OVERHEAD
// =============================================================================

/**
 * Benchmark: Different message types (decode vs flush).
 * Measures if variant size impacts performance.
 */
static void BM_Enqueue_DecodeMessage(benchmark::State& state) {
  VideoQueue queue;

  for (auto _ : state) {
    DecodeMessage msg;
    msg.packet = CreateEmptyPacket();
    benchmark::DoNotOptimize(queue.Enqueue(std::move(msg)));
  }

  queue.Shutdown();

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_Enqueue_DecodeMessage);

static void BM_Enqueue_FlushMessage(benchmark::State& state) {
  VideoQueue queue;

  for (auto _ : state) {
    FlushMessage msg;
    msg.promise_id = 42;
    benchmark::DoNotOptimize(queue.Enqueue(std::move(msg)));
  }

  queue.Shutdown();

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("messages/sec");
}
BENCHMARK(BM_Enqueue_FlushMessage);

}  // namespace
