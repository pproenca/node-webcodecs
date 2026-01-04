// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * raii_overhead.cpp - RAII wrapper performance benchmarks.
 *
 * Measures overhead of ffmpeg::AVPacketPtr and ffmpeg::AVFramePtr wrappers
 * compared to raw FFmpeg allocation/deallocation:
 * - Allocation speed (packets/sec, frames/sec)
 * - Deallocation speed
 * - Move semantics overhead
 * - Vector storage overhead
 *
 * Run with: make run_benchmarks
 */

#include <benchmark/benchmark.h>

#include <thread>
#include <vector>

#include "src/ffmpeg_raii.h"

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/frame.h>
}

namespace {

// =============================================================================
// AVPACKET ALLOCATION
// =============================================================================

/**
 * Benchmark: RAII AVPacketPtr allocation.
 * Measures smart pointer wrapper overhead.
 */
static void BM_AVPacketPtr_Allocation(benchmark::State& state) {
  for (auto _ : state) {
    ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
    benchmark::DoNotOptimize(packet);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("packets/sec");
}
BENCHMARK(BM_AVPacketPtr_Allocation);

/**
 * Benchmark: Raw AVPacket allocation (baseline).
 * Compares against RAII wrapper.
 */
static void BM_AVPacket_Raw_Allocation(benchmark::State& state) {
  for (auto _ : state) {
    AVPacket* packet = av_packet_alloc();
    benchmark::DoNotOptimize(packet);
    av_packet_free(&packet);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("packets/sec");
}
BENCHMARK(BM_AVPacket_Raw_Allocation);

/**
 * Benchmark: AVPacketPtr move semantics.
 * Tests overhead of std::move operations.
 */
static void BM_AVPacketPtr_Move(benchmark::State& state) {
  for (auto _ : state) {
    ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
    ffmpeg::AVPacketPtr moved = std::move(packet);
    benchmark::DoNotOptimize(moved);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("moves/sec");
}
BENCHMARK(BM_AVPacketPtr_Move);

/**
 * Benchmark: AVPacketPtr vector storage.
 * Measures overhead of storing pointers in containers.
 */
static void BM_AVPacketPtr_VectorPush(benchmark::State& state) {
  const int kVectorSize = state.range(0);

  for (auto _ : state) {
    std::vector<ffmpeg::AVPacketPtr> packets;
    packets.reserve(kVectorSize);

    for (int i = 0; i < kVectorSize; ++i) {
      packets.push_back(ffmpeg::make_packet());
    }

    benchmark::DoNotOptimize(packets);
  }

  state.SetItemsProcessed(state.iterations() * kVectorSize);
  state.SetLabel("packets/sec");
}
BENCHMARK(BM_AVPacketPtr_VectorPush)
    ->Arg(10)
    ->Arg(100)
    ->Arg(1000);

// =============================================================================
// AVFRAME ALLOCATION
// =============================================================================

/**
 * Benchmark: RAII AVFramePtr allocation.
 */
static void BM_AVFramePtr_Allocation(benchmark::State& state) {
  for (auto _ : state) {
    ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
    benchmark::DoNotOptimize(frame);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("frames/sec");
}
BENCHMARK(BM_AVFramePtr_Allocation);

/**
 * Benchmark: Raw AVFrame allocation (baseline).
 */
static void BM_AVFrame_Raw_Allocation(benchmark::State& state) {
  for (auto _ : state) {
    AVFrame* frame = av_frame_alloc();
    benchmark::DoNotOptimize(frame);
    av_frame_free(&frame);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("frames/sec");
}
BENCHMARK(BM_AVFrame_Raw_Allocation);

/**
 * Benchmark: AVFramePtr with buffer allocation.
 * Measures cost of allocating frame buffers (realistic scenario).
 */
static void BM_AVFramePtr_WithBuffer(benchmark::State& state) {
  const int width = state.range(0);
  const int height = state.range(1);

  for (auto _ : state) {
    ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
    frame->format = AV_PIX_FMT_YUV420P;
    frame->width = width;
    frame->height = height;

    int ret = av_frame_get_buffer(frame.get(), 0);
    benchmark::DoNotOptimize(ret);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("frames/sec");
}
BENCHMARK(BM_AVFramePtr_WithBuffer)
    ->Args({320, 240})    // QVGA
    ->Args({640, 480})    // VGA
    ->Args({1280, 720})   // HD
    ->Args({1920, 1080})  // Full HD
    ->Args({3840, 2160});  // 4K

/**
 * Benchmark: AVFramePtr move semantics.
 */
static void BM_AVFramePtr_Move(benchmark::State& state) {
  for (auto _ : state) {
    ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
    ffmpeg::AVFramePtr moved = std::move(frame);
    benchmark::DoNotOptimize(moved);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("moves/sec");
}
BENCHMARK(BM_AVFramePtr_Move);

// =============================================================================
// REFERENCE COUNTING OVERHEAD
// =============================================================================

/**
 * Benchmark: AVFrame reference counting (av_frame_ref).
 * Measures cost of reference counting vs ownership transfer.
 */
static void BM_AVFrame_RefCounting(benchmark::State& state) {
  ffmpeg::AVFramePtr source = ffmpeg::make_frame();
  source->format = AV_PIX_FMT_YUV420P;
  source->width = 1920;
  source->height = 1080;
  av_frame_get_buffer(source.get(), 0);

  for (auto _ : state) {
    ffmpeg::AVFramePtr clone = ffmpeg::make_frame();
    int ret = av_frame_ref(clone.get(), source.get());
    benchmark::DoNotOptimize(ret);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("refs/sec");
}
BENCHMARK(BM_AVFrame_RefCounting);

/**
 * Benchmark: AVFrame deep copy (av_frame_clone).
 * Measures cost of full frame duplication.
 */
static void BM_AVFrame_Clone(benchmark::State& state) {
  ffmpeg::AVFramePtr source = ffmpeg::make_frame();
  source->format = AV_PIX_FMT_YUV420P;
  source->width = 1920;
  source->height = 1080;
  av_frame_get_buffer(source.get(), 0);

  for (auto _ : state) {
    AVFrame* cloned = av_frame_clone(source.get());
    benchmark::DoNotOptimize(cloned);
    av_frame_free(&cloned);
  }

  state.SetItemsProcessed(state.iterations());
  state.SetLabel("clones/sec");
}
BENCHMARK(BM_AVFrame_Clone);

// =============================================================================
// CONCURRENT ALLOCATION
// =============================================================================

/**
 * Benchmark: Concurrent AVPacketPtr allocation.
 * Tests thread-safety and contention.
 */
static void BM_AVPacketPtr_Concurrent(benchmark::State& state) {
  const int kThreads = state.range(0);

  for (auto _ : state) {
    std::vector<std::thread> threads;

    for (int i = 0; i < kThreads; ++i) {
      threads.emplace_back([&]() {
        ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
        benchmark::DoNotOptimize(packet);
      });
    }

    for (auto& t : threads) {
      t.join();
    }
  }

  state.SetItemsProcessed(state.iterations() * kThreads);
  state.SetLabel("packets/sec");
}
BENCHMARK(BM_AVPacketPtr_Concurrent)
    ->Arg(1)
    ->Arg(2)
    ->Arg(4)
    ->Arg(8)
    ->UseRealTime();

}  // namespace
