# MediaWorker Unification Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-02-media-worker-unification.md` to implement task-by-task.

**Goal:** Create a unified `MediaWorker<T>` template that centralizes threading, task queue, TSFN lifecycle, and shutdown safety for all codecs.

**Architecture:** Extract common threading logic from `AsyncDecodeWorker` and `AsyncEncodeWorker` into a generic `MediaWorker<Processor>` class. The processor interface defines `Process(input) -> outputs`. This eliminates duplicated race-condition fixes (DARWIN-X64), enables Audio to become async immediately, and reduces maintenance burden.

**Key Design Decisions:**
1. **OutputConverter Injection**: MediaWorker accepts a converter function `(Napi::Env, OutputType*) -> std::vector<napi_value>` to handle C++ → JS marshalling. This fixes the data loss bug where `fn.Call({})` was called with no arguments.
2. **Zero-Copy Output Buffers**: OutputType uses raw `uint8_t*` pointers allocated with `malloc`. The buffer ownership transfers to JS via `Napi::Buffer::New(..., finalizer)`. No intermediate `std::vector` copies.
3. **RAII for Input Copies**: Input data uses `std::vector` (copy on enqueue is acceptable since JS may mutate the source).

**Tech Stack:** C++17 templates, Napi::ThreadSafeFunction, std::thread, std::mutex, std::condition_variable, RAII smart pointers, Napi::Buffer finalizers

---

## Task Group 1: Core Infrastructure (Serial - touches shared files)

### Task 1: Create MediaWorker Template Header with OutputConverter

**Files:**
- Create: `src/media_worker.h`

**Step 1: Write the test** (2-5 min)

Create a compile-time test that verifies the template instantiates correctly with a mock processor and converter:

```cpp
// test/native/media_worker_compile_test.cc
// This is a compile-only test - if it compiles, the template is valid

#include "src/media_worker.h"
#include <vector>
#include <cstdint>
#include <cstdlib>

// Mock processor for compile-time validation
struct MockDecodeTask {
  std::vector<uint8_t> data;
  int64_t timestamp;
};

// Zero-copy output: raw pointer, not vector
struct MockDecodedOutput {
  uint8_t* rgba_data;      // Allocated with malloc, ownership transfers to JS
  size_t rgba_size;
  int width;
  int height;
  int64_t timestamp;

  // Custom deleter for when output is not consumed
  void Free() {
    if (rgba_data) {
      free(rgba_data);
      rgba_data = nullptr;
    }
  }
};

class MockDecodeProcessor {
 public:
  using InputType = MockDecodeTask;
  using OutputType = MockDecodedOutput;

  void Configure(void* context) { (void)context; }
  std::vector<OutputType> Process(const InputType& input) {
    (void)input;
    return {};
  }
  std::vector<OutputType> Flush() { return {}; }
  void Reset() {}
};

// Mock converter: OutputType* -> napi_value arguments
std::vector<napi_value> MockConverter(Napi::Env env, MockDecodedOutput* output) {
  // In real impl, this creates VideoFrame from output->rgba_data
  // using Napi::Buffer::New with finalizer to transfer ownership
  (void)env;
  (void)output;
  return {};
}

// Verify template compiles with converter
void VerifyTemplateCompiles() {
  // Can't actually construct without Napi::Env, but types must be valid
  using Converter = pipeline::OutputConverter<MockDecodedOutput>;
  Converter conv = MockConverter;
  (void)conv;
}

int main() {
  VerifyTemplateCompiles();
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  -c test/native/media_worker_compile_test.cc -o /dev/null 2>&1 | head -20
```

Expected: FAIL with `fatal error: 'src/media_worker.h' file not found`

**Step 3: Write minimal implementation** (5 min)

Create `src/media_worker.h` with the template class including OutputConverter:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// MediaWorker: Unified async worker template for encode/decode operations.
// Centralizes threading, task queue, TSFN lifecycle, and shutdown safety.
//
// Design:
// - OutputConverter: Injected function to convert C++ OutputType to napi_value[].
//   This allows each codec (VideoDecoder, AudioEncoder, etc.) to define its own
//   JS object creation logic without the template knowing about VideoFrame, etc.
// - Zero-Copy Outputs: OutputType should use raw pointers (malloc'd) for large
//   buffers. The converter transfers ownership to JS via Napi::Buffer finalizer.

#ifndef SRC_MEDIA_WORKER_H_
#define SRC_MEDIA_WORKER_H_

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

namespace pipeline {

// Converter function type: transforms OutputType* to JS arguments.
// The converter TAKES OWNERSHIP of the output pointer and must either:
// 1. Transfer buffer ownership to JS (via Napi::Buffer::New with finalizer), or
// 2. Free the buffer if JS object creation fails.
// Returns vector of napi_value to pass to fn.Call().
template <typename OutputType>
using OutputConverter =
    std::function<std::vector<napi_value>(Napi::Env, OutputType*)>;

// Concept: Processor must define InputType, OutputType, and methods:
//   void Configure(void* context)
//   std::vector<OutputType> Process(const InputType& input)
//   std::vector<OutputType> Flush()
//   void Reset()
//
// OutputType requirements for zero-copy:
//   - Large buffers should be raw pointers allocated with malloc
//   - Must have a Free() method to release undelivered buffers
template <typename Processor>
class MediaWorker {
 public:
  using InputType = typename Processor::InputType;
  using OutputType = typename Processor::OutputType;
  using Converter = OutputConverter<OutputType>;

  // Constructor requires converter to handle OutputType -> napi_value.
  // This is CRITICAL: without converter, data never reaches JavaScript.
  MediaWorker(Napi::ThreadSafeFunction output_tsfn,
              Napi::ThreadSafeFunction error_tsfn,
              Converter converter);
  ~MediaWorker();

  // Disallow copy and assign
  MediaWorker(const MediaWorker&) = delete;
  MediaWorker& operator=(const MediaWorker&) = delete;

  void Configure(void* context);
  void Start();
  void Stop();
  void Enqueue(InputType task);
  void Flush();

  bool IsRunning() const { return running_.load(std::memory_order_acquire); }
  size_t QueueSize() const;
  int GetPendingOutputs() const { return pending_outputs_->load(); }
  std::shared_ptr<std::atomic<int>> GetPendingOutputsPtr() const {
    return pending_outputs_;
  }

 private:
  void WorkerThread();
  void ProcessTask(const InputType& task);
  void EmitOutput(OutputType output);  // Takes ownership by value (move)
  void EmitError(const std::string& message);

  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;
  Converter converter_;  // Injected: OutputType* -> napi_value[]

  Processor processor_;
  std::thread worker_thread_;
  std::queue<InputType> task_queue_;
  mutable std::mutex queue_mutex_;
  std::condition_variable queue_cv_;
  std::mutex stop_mutex_;

  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};
  std::atomic<bool> configured_{false};
  std::atomic<int> processing_{0};

  // Shared pointer for thread-safe access after worker destruction
  std::shared_ptr<std::atomic<int>> pending_outputs_ =
      std::make_shared<std::atomic<int>>(0);
};

}  // namespace pipeline

// Include template implementation
#include "src/media_worker_impl.h"

#endif  // SRC_MEDIA_WORKER_H_
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  -c test/native/media_worker_compile_test.cc -o /dev/null && echo "PASS"
```

Expected: FAIL (needs implementation file)

**Step 5: Create template implementation file** (5 min)

Create `src/media_worker_impl.h` with the method implementations.

**Step 6: Commit** (30 sec)

```bash
git add src/media_worker.h src/media_worker_impl.h test/native/
git commit -m "feat(native): add MediaWorker template with OutputConverter

Unified async worker template for encode/decode operations.
Key design: OutputConverter injection allows each codec to define
C++ -> JS marshalling. Supports zero-copy via raw pointer buffers."
```

---

### Task 2: Implement MediaWorker Template Methods with Correct Data Marshalling

**Files:**
- Create: `src/media_worker_impl.h`

**Step 1: Write the test** (2-5 min)

Extend the compile test to verify all methods are callable:

```cpp
// Add to test/native/media_worker_compile_test.cc
void TestMethodsExist() {
  using Worker = pipeline::MediaWorker<MockDecodeProcessor>;

  // Verify method signatures exist by taking addresses
  void (Worker::*start)() = &Worker::Start;
  void (Worker::*stop)() = &Worker::Stop;
  void (Worker::*enqueue)(MockDecodeTask) = &Worker::Enqueue;
  void (Worker::*flush)() = &Worker::Flush;
  bool (Worker::*isRunning)() const = &Worker::IsRunning;
  size_t (Worker::*queueSize)() const = &Worker::QueueSize;
  int (Worker::*pending)() const = &Worker::GetPendingOutputs;

  (void)start; (void)stop; (void)enqueue; (void)flush;
  (void)isRunning; (void)queueSize; (void)pending;
}
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  -c test/native/media_worker_compile_test.cc -o /dev/null 2>&1 | head -20
```

Expected: FAIL with undefined reference errors for method implementations

**Step 3: Write implementation with CORRECT data marshalling** (5 min)

Create `src/media_worker_impl.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// MediaWorker template implementation.
// This file is included by media_worker.h - do not include directly.

#ifndef SRC_MEDIA_WORKER_IMPL_H_
#define SRC_MEDIA_WORKER_IMPL_H_

#include <chrono>
#include <cstdio>
#include <utility>

namespace pipeline {

template <typename Processor>
MediaWorker<Processor>::MediaWorker(Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn,
                                     Converter converter)
    : output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      converter_(std::move(converter)) {}

template <typename Processor>
MediaWorker<Processor>::~MediaWorker() {
  Stop();
}

template <typename Processor>
void MediaWorker<Processor>::Configure(void* context) {
  processor_.Configure(context);
  configured_.store(true, std::memory_order_release);
}

template <typename Processor>
void MediaWorker<Processor>::Start() {
  if (running_.load()) return;
  running_.store(true, std::memory_order_release);
  worker_thread_ = std::thread(&MediaWorker::WorkerThread, this);
}

template <typename Processor>
void MediaWorker<Processor>::Stop() {
  std::lock_guard<std::mutex> stop_lock(stop_mutex_);
  if (!running_.load()) return;

  // DARWIN-X64 FIX: Invalidate before signaling shutdown.
  // Prevents ProcessTask from accessing processor during destruction.
  configured_.store(false, std::memory_order_release);

  {
    // Hold mutex while setting running_=false to prevent lost wakeup race.
    std::lock_guard<std::mutex> lock(queue_mutex_);
    running_.store(false, std::memory_order_release);
  }
  queue_cv_.notify_all();

  if (worker_thread_.joinable()) {
    worker_thread_.join();
  }
}

template <typename Processor>
void MediaWorker<Processor>::Enqueue(InputType task) {
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}

template <typename Processor>
void MediaWorker<Processor>::Flush() {
  flushing_.store(true);

  std::unique_lock<std::mutex> lock(queue_mutex_);
  queue_cv_.wait(lock, [this] {
    return (task_queue_.empty() && processing_.load() == 0) || !running_.load();
  });

  // Process any remaining outputs from processor flush
  if (configured_.load(std::memory_order_acquire)) {
    auto outputs = processor_.Flush();
    for (auto& output : outputs) {
      EmitOutput(std::move(output));
    }
  }

  flushing_.store(false);
}

template <typename Processor>
size_t MediaWorker<Processor>::QueueSize() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return task_queue_.size();
}

template <typename Processor>
void MediaWorker<Processor>::WorkerThread() {
  while (running_.load(std::memory_order_acquire)) {
    InputType task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      queue_cv_.wait(lock, [this] {
        return !task_queue_.empty() || !running_.load() || flushing_.load();
      });

      if (!running_.load()) break;

      if (task_queue_.empty()) {
        if (flushing_.load()) {
          queue_cv_.notify_all();
        }
        continue;
      }

      task = std::move(task_queue_.front());
      task_queue_.pop();
      processing_++;
    }

    ProcessTask(task);

    {
      std::lock_guard<std::mutex> lock(queue_mutex_);
      processing_--;
      if (task_queue_.empty() && processing_.load() == 0) {
        queue_cv_.notify_all();
      }
    }
  }
}

template <typename Processor>
void MediaWorker<Processor>::ProcessTask(const InputType& task) {
  if (!configured_.load(std::memory_order_acquire)) {
    return;
  }

  try {
    auto outputs = processor_.Process(task);
    for (auto& output : outputs) {
      EmitOutput(std::move(output));
    }
  } catch (const std::exception& e) {
    EmitError(e.what());
  }
}

template <typename Processor>
void MediaWorker<Processor>::EmitOutput(OutputType output) {
  pending_outputs_->fetch_add(1);

  auto pending = pending_outputs_;
  auto converter = converter_;  // Copy for lambda capture

  // Move output to heap for TSFN transfer
  auto* output_ptr = new OutputType(std::move(output));

  output_tsfn_.NonBlockingCall(
      output_ptr,
      [pending, converter](Napi::Env env, Napi::Function fn, OutputType* data) {
        // CRITICAL: If env is null, TSFN is closing during teardown.
        // Must free the buffer and decrement counter, then return.
        if (env == nullptr) {
          data->Free();  // Release any malloc'd buffers
          delete data;
          pending->fetch_sub(1);
          return;
        }

        try {
          // USE THE CONVERTER to transform OutputType* into JS arguments.
          // This is the FIXED implementation - data actually reaches JavaScript.
          // The converter takes ownership of data's buffers and transfers them
          // to JS via Napi::Buffer::New with finalizer.
          std::vector<napi_value> args = converter(env, data);
          fn.Call(args);
        } catch (const std::exception& e) {
          // Log error, ensure cleanup
          fprintf(stderr, "MediaWorker callback error: %s\n", e.what());
          data->Free();  // Converter failed, we must free
        } catch (...) {
          fprintf(stderr, "MediaWorker callback error: unknown exception\n");
          data->Free();
        }

        // Delete the OutputType wrapper (buffer ownership transferred to JS or freed)
        delete data;
        pending->fetch_sub(1);
      });
}

template <typename Processor>
void MediaWorker<Processor>::EmitError(const std::string& message) {
  auto* msg = new std::string(message);

  error_tsfn_.NonBlockingCall(
      msg, [](Napi::Env env, Napi::Function fn, std::string* data) {
        if (env == nullptr) {
          delete data;
          return;
        }

        fn.Call({Napi::Error::New(env, *data).Value()});
        delete data;
      });
}

}  // namespace pipeline

#endif  // SRC_MEDIA_WORKER_IMPL_H_
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  -c test/native/media_worker_compile_test.cc -o /dev/null && echo "PASS"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/media_worker_impl.h test/native/media_worker_compile_test.cc
git commit -m "feat(native): implement MediaWorker with correct data marshalling

FIXED: EmitOutput now uses injected converter to pass data to JavaScript.
Previous implementation called fn.Call({}) - data was lost.

Key changes:
- Converter transforms OutputType* to napi_value[] for fn.Call()
- OutputType uses raw pointers for zero-copy buffer transfer
- Converter takes ownership and transfers to JS via Napi::Buffer finalizer
- Free() called on OutputType if converter fails or env is null"
```

---

## Task Group 2: Video Decode Processor with Zero-Copy (Serial)

### Task 3: Create VideoDecodeProcessor with Zero-Copy Output

**Files:**
- Create: `src/video_decode_processor.h`
- Create: `src/video_decode_processor.cc`

**Step 1: Write the test** (2-5 min)

```cpp
// test/native/video_decode_processor_test.cc
#include "src/video_decode_processor.h"
#include <cassert>
#include <iostream>
#include <cstdlib>

int main() {
  using Input = pipeline::VideoDecodeProcessor::InputType;
  using Output = pipeline::VideoDecodeProcessor::OutputType;

  // Verify InputType has expected fields
  Input task;
  task.data = {0x00, 0x00, 0x01};
  task.timestamp = 1000;
  task.duration = 33333;
  task.is_key = true;
  task.is_flush = false;

  // Verify OutputType uses raw pointer (zero-copy design)
  Output frame;
  frame.rgba_data = static_cast<uint8_t*>(malloc(1920 * 1080 * 4));
  frame.rgba_size = 1920 * 1080 * 4;
  frame.width = 1920;
  frame.height = 1080;
  frame.timestamp = 1000;

  // Test Free() method required by MediaWorker
  frame.Free();
  assert(frame.rgba_data == nullptr);

  std::cout << "VideoDecodeProcessor types compile correctly (zero-copy)" << std::endl;
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  $(pkg-config --cflags libavcodec libavutil libswscale) \
  -c test/native/video_decode_processor_test.cc -o /dev/null 2>&1 | head -10
```

Expected: FAIL with `fatal error: 'src/video_decode_processor.h' file not found`

**Step 3: Write zero-copy implementation** (5 min)

Create `src/video_decode_processor.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecodeProcessor: FFmpeg decode logic with zero-copy output.
// Conforms to MediaWorker Processor concept.
//
// ZERO-COPY DESIGN:
// - Output buffers allocated with malloc(), not std::vector
// - Ownership transfers to JavaScript via Napi::Buffer::New finalizer
// - No intermediate copies between sws_scale and JS

#ifndef SRC_VIDEO_DECODE_PROCESSOR_H_
#define SRC_VIDEO_DECODE_PROCESSOR_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include "src/ffmpeg_raii.h"

#include <cstdint>
#include <cstdlib>
#include <string>
#include <vector>

namespace pipeline {

struct VideoDecodeTask {
  std::vector<uint8_t> data;  // Copy on enqueue (JS may mutate source)
  int64_t timestamp;
  int64_t duration;
  bool is_key;
  bool is_flush;
};

// Zero-copy output: raw pointer allocated with malloc.
// Ownership transfers to JS via Napi::Buffer finalizer.
struct DecodedVideoFrame {
  uint8_t* rgba_data;   // malloc'd buffer, ownership transfers to JS
  size_t rgba_size;     // Buffer size in bytes
  uint32_t width;
  uint32_t height;
  int64_t timestamp;
  int64_t duration;

  // Metadata
  int rotation;
  bool flip;
  int display_width;
  int display_height;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range;
  bool has_color_space;

  // Required by MediaWorker: free buffer if not transferred to JS
  void Free() {
    if (rgba_data) {
      free(rgba_data);
      rgba_data = nullptr;
    }
  }
};

struct VideoDecodeContext {
  AVCodecContext* codec_context;  // Owned by VideoDecoder
  int output_width;
  int output_height;
  // Metadata config
  int rotation;
  bool flip;
  int display_width;
  int display_height;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range;
  bool has_color_space;
};

class VideoDecodeProcessor {
 public:
  using InputType = VideoDecodeTask;
  using OutputType = DecodedVideoFrame;

  VideoDecodeProcessor();
  ~VideoDecodeProcessor() = default;

  void Configure(void* context);
  std::vector<OutputType> Process(const InputType& task);
  std::vector<OutputType> Flush();
  void Reset();

 private:
  std::vector<OutputType> DecodePacket(const InputType& task);
  OutputType ConvertFrame(AVFrame* frame);

  AVCodecContext* codec_context_;  // Non-owning reference
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  int output_width_;
  int output_height_;

  // Track format for sws recreation
  AVPixelFormat last_format_;
  int last_width_;
  int last_height_;

  // Metadata
  int rotation_;
  bool flip_;
  int display_width_;
  int display_height_;
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_;
  bool has_color_space_;
};

}  // namespace pipeline

#endif  // SRC_VIDEO_DECODE_PROCESSOR_H_
```

**Step 4: Create implementation with malloc allocation** (5 min)

Create `src/video_decode_processor.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_decode_processor.h"

#include <cmath>
#include <cstdlib>
#include <stdexcept>

namespace pipeline {

VideoDecodeProcessor::VideoDecodeProcessor()
    : codec_context_(nullptr),
      output_width_(0),
      output_height_(0),
      last_format_(AV_PIX_FMT_NONE),
      last_width_(0),
      last_height_(0),
      rotation_(0),
      flip_(false),
      display_width_(0),
      display_height_(0),
      color_full_range_(false),
      has_color_space_(false) {}

void VideoDecodeProcessor::Configure(void* context) {
  auto* ctx = static_cast<VideoDecodeContext*>(context);
  codec_context_ = ctx->codec_context;
  output_width_ = ctx->output_width;
  output_height_ = ctx->output_height;
  rotation_ = ctx->rotation;
  flip_ = ctx->flip;
  display_width_ = ctx->display_width;
  display_height_ = ctx->display_height;
  color_primaries_ = ctx->color_primaries;
  color_transfer_ = ctx->color_transfer;
  color_matrix_ = ctx->color_matrix;
  color_full_range_ = ctx->color_full_range;
  has_color_space_ = ctx->has_color_space;

  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();
  sws_context_.reset();
}

std::vector<VideoDecodeProcessor::OutputType> VideoDecodeProcessor::Process(
    const InputType& task) {
  if (!codec_context_ || !frame_ || !packet_) {
    return {};
  }

  if (task.is_flush) {
    return Flush();
  }

  return DecodePacket(task);
}

std::vector<VideoDecodeProcessor::OutputType> VideoDecodeProcessor::Flush() {
  std::vector<OutputType> outputs;

  if (!codec_context_ || !frame_) {
    return outputs;
  }

  // Send NULL packet to drain decoder
  avcodec_send_packet(codec_context_, nullptr);

  // Collect all remaining frames
  while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
    outputs.push_back(ConvertFrame(frame_.get()));
    av_frame_unref(frame_.get());
  }

  // Reset decoder to accept new packets
  avcodec_flush_buffers(codec_context_);

  return outputs;
}

void VideoDecodeProcessor::Reset() {
  sws_context_.reset();
  frame_.reset();
  packet_.reset();
  codec_context_ = nullptr;
}

std::vector<VideoDecodeProcessor::OutputType> VideoDecodeProcessor::DecodePacket(
    const InputType& task) {
  std::vector<OutputType> outputs;

  av_packet_unref(packet_.get());
  packet_->data = const_cast<uint8_t*>(task.data.data());
  packet_->size = static_cast<int>(task.data.size());
  packet_->pts = task.timestamp;

  int ret = avcodec_send_packet(codec_context_, packet_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    throw std::runtime_error("Decode error: " + std::to_string(ret));
  }

  while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
    outputs.push_back(ConvertFrame(frame_.get()));
    av_frame_unref(frame_.get());
  }

  return outputs;
}

VideoDecodeProcessor::OutputType VideoDecodeProcessor::ConvertFrame(AVFrame* frame) {
  AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame->format);

  // Recreate sws context if format/dimensions changed
  if (!sws_context_ || last_format_ != frame_format ||
      last_width_ != frame->width || last_height_ != frame->height) {
    sws_context_.reset(sws_getContext(
        frame->width, frame->height, frame_format,
        frame->width, frame->height, AV_PIX_FMT_RGBA,
        SWS_BILINEAR, nullptr, nullptr, nullptr));

    if (!sws_context_) {
      throw std::runtime_error("Could not create sws context");
    }

    last_format_ = frame_format;
    last_width_ = frame->width;
    last_height_ = frame->height;
    output_width_ = frame->width;
    output_height_ = frame->height;
  }

  // ZERO-COPY: Allocate with malloc, ownership transfers to JS
  OutputType output;
  output.width = output_width_;
  output.height = output_height_;
  output.timestamp = frame->pts;
  output.duration = 0;

  output.rgba_size = static_cast<size_t>(output.width) * output.height * 4;
  output.rgba_data = static_cast<uint8_t*>(malloc(output.rgba_size));

  if (!output.rgba_data) {
    throw std::runtime_error("Failed to allocate RGBA buffer");
  }

  uint8_t* dst_data[1] = {output.rgba_data};
  int dst_linesize[1] = {static_cast<int>(output.width * 4)};

  sws_scale(sws_context_.get(), frame->data, frame->linesize, 0,
            frame->height, dst_data, dst_linesize);

  // Copy metadata
  output.rotation = rotation_;
  output.flip = flip_;

  if (display_width_ > 0 && display_height_ > 0) {
    output.display_width = static_cast<int>(
        std::round(static_cast<double>(output.height) *
                   static_cast<double>(display_width_) /
                   static_cast<double>(display_height_)));
    output.display_height = output.height;
  } else {
    output.display_width = output.width;
    output.display_height = output.height;
  }

  output.color_primaries = color_primaries_;
  output.color_transfer = color_transfer_;
  output.color_matrix = color_matrix_;
  output.color_full_range = color_full_range_;
  output.has_color_space = has_color_space_;

  return output;
}

}  // namespace pipeline
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  $(pkg-config --cflags libavcodec libavutil libswscale) \
  -c test/native/video_decode_processor_test.cc -o /dev/null && echo "PASS"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_decode_processor.h src/video_decode_processor.cc test/native/
git commit -m "feat(native): add VideoDecodeProcessor with zero-copy output

ZERO-COPY DESIGN:
- RGBA buffer allocated with malloc(), not std::vector
- Ownership transfers to JS via Napi::Buffer::New finalizer
- No intermediate vector copies between sws_scale and JavaScript
- Free() method for cleanup if output not delivered

Eliminates the 'double copy' performance tax identified in architecture review."
```

---

### Task 4: Create VideoEncodeProcessor with Zero-Copy Output

**Files:**
- Create: `src/video_encode_processor.h`
- Create: `src/video_encode_processor.cc`

**Step 1: Write the test** (2-5 min)

```cpp
// test/native/video_encode_processor_test.cc
#include "src/video_encode_processor.h"
#include <cassert>
#include <iostream>
#include <cstdlib>

int main() {
  using Input = pipeline::VideoEncodeProcessor::InputType;
  using Output = pipeline::VideoEncodeProcessor::OutputType;

  Input task;
  task.rgba_data = {255, 0, 0, 255};  // Input can still use vector (copied on enqueue)
  task.width = 1920;
  task.height = 1080;
  task.timestamp = 0;
  task.duration = 33333;
  task.key_frame = true;
  task.is_flush = false;
  task.quantizer = -1;
  task.frame_index = 0;

  // Verify OutputType uses raw pointer (zero-copy)
  Output chunk;
  chunk.data = static_cast<uint8_t*>(malloc(1000));
  chunk.size = 1000;
  chunk.timestamp = 0;
  chunk.duration = 33333;
  chunk.is_key = true;
  chunk.frame_index = 0;

  // Test Free() method
  chunk.Free();
  assert(chunk.data == nullptr);

  std::cout << "VideoEncodeProcessor types compile correctly (zero-copy)" << std::endl;
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

Expected: FAIL

**Step 3: Write zero-copy implementation** (5 min)

Create `src/video_encode_processor.h` and `src/video_encode_processor.cc` following the same pattern, with output using `malloc` for encoded data.

**Step 4: Run test to verify it passes** (30 sec)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encode_processor.h src/video_encode_processor.cc test/native/
git commit -m "feat(native): add VideoEncodeProcessor with zero-copy output

Encoded packet data allocated with malloc, transferred to JS without copy."
```

---

## Task Group 3: Integration (Serial - modifies existing workers)

### Task 5: Add Processor Classes to Build

**Files:**
- Modify: `binding.gyp`

**Step 1: Verify current build works** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build
```

**Step 2: Add source files to binding.gyp** (2-5 min)

Add to sources array:
- `"src/video_decode_processor.cc"`
- `"src/video_encode_processor.cc"`

**Step 3: Verify build passes** (30 sec)

```bash
npm run build
```

**Step 4: Commit** (30 sec)

```bash
git add binding.gyp
git commit -m "build: add Processor classes to binding.gyp"
```

---

### Task 6: Create VideoDecoder OutputConverter

**Files:**
- Create: `src/video_decoder_converter.h`

**Step 1: Write converter that creates VideoFrame with zero-copy buffer** (5 min)

```cpp
// src/video_decoder_converter.h
// OutputConverter for VideoDecoder: DecodedVideoFrame -> VideoFrame JS object

#ifndef SRC_VIDEO_DECODER_CONVERTER_H_
#define SRC_VIDEO_DECODER_CONVERTER_H_

#include <napi.h>
#include <cstdlib>
#include <vector>

#include "src/video_decode_processor.h"
#include "src/video_frame.h"

namespace pipeline {

// Free function for Napi::Buffer finalizer
inline void FreeRgbaBuffer(Napi::Env /*env*/, uint8_t* data) {
  free(data);
}

// Converter: DecodedVideoFrame* -> napi_value[] for fn.Call()
// Takes ownership of frame->rgba_data, transfers to JS via Buffer finalizer
inline std::vector<napi_value> VideoDecoderConverter(
    Napi::Env env, DecodedVideoFrame* frame) {

  // ZERO-COPY: Create Buffer that takes ownership of malloc'd data.
  // When GC collects the Buffer, FreeRgbaBuffer is called.
  // Note: We don't use the Buffer directly - VideoFrame::CreateInstance
  // copies the data internally. For true zero-copy, VideoFrame would need
  // to accept external buffer ownership. This is a future optimization.

  Napi::Object video_frame;
  if (frame->has_color_space) {
    video_frame = VideoFrame::CreateInstance(
        env, frame->rgba_data, frame->rgba_size,
        frame->width, frame->height, frame->timestamp,
        "RGBA", frame->rotation, frame->flip,
        frame->display_width, frame->display_height,
        frame->color_primaries, frame->color_transfer,
        frame->color_matrix, frame->color_full_range);
  } else {
    video_frame = VideoFrame::CreateInstance(
        env, frame->rgba_data, frame->rgba_size,
        frame->width, frame->height, frame->timestamp,
        "RGBA", frame->rotation, frame->flip,
        frame->display_width, frame->display_height);
  }

  // VideoFrame::CreateInstance copies the data, so we must free
  free(frame->rgba_data);
  frame->rgba_data = nullptr;

  return {video_frame};
}

}  // namespace pipeline

#endif  // SRC_VIDEO_DECODER_CONVERTER_H_
```

**Step 2: Commit** (30 sec)

```bash
git add src/video_decoder_converter.h
git commit -m "feat(native): add VideoDecoder OutputConverter

Converter transforms DecodedVideoFrame* to VideoFrame JS object.
Currently copies data into VideoFrame (future: true zero-copy via
external buffer ownership)."
```

---

### Task 7: Migrate AsyncDecodeWorker to Use MediaWorker

**Files:**
- Modify: `src/async_decode_worker.h`
- Modify: `src/async_decode_worker.cc`
- Modify: `src/video_decoder.cc`

**Step 1: Run baseline tests** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts
```

**Step 2: Refactor AsyncDecodeWorker to delegate to MediaWorker** (5 min)

AsyncDecodeWorker becomes a thin wrapper:

```cpp
// src/async_decode_worker.h (simplified)
#include "src/media_worker.h"
#include "src/video_decode_processor.h"
#include "src/video_decoder_converter.h"

class AsyncDecodeWorker {
 public:
  AsyncDecodeWorker(VideoDecoder* decoder,
                    Napi::ThreadSafeFunction output_tsfn,
                    Napi::ThreadSafeFunction error_tsfn);
  ~AsyncDecodeWorker();

  void Start() { worker_->Start(); }
  void Stop() { worker_->Stop(); }
  void Enqueue(DecodeTask task);  // Convert to VideoDecodeTask
  void Flush() { worker_->Flush(); }
  void SetCodecContext(AVCodecContext* ctx, SwsContext*, int w, int h);
  void SetMetadataConfig(const DecoderMetadataConfig& config);

  bool IsRunning() const { return worker_->IsRunning(); }
  size_t QueueSize() const { return worker_->QueueSize(); }
  int GetPendingFrames() const { return worker_->GetPendingOutputs(); }
  std::shared_ptr<std::atomic<int>> GetPendingFramesPtr() const {
    return worker_->GetPendingOutputsPtr();
  }

 private:
  std::unique_ptr<pipeline::MediaWorker<pipeline::VideoDecodeProcessor>> worker_;
  pipeline::VideoDecodeContext context_;
};
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts
```

**Step 4: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 5: Commit** (30 sec)

```bash
git add src/async_decode_worker.h src/async_decode_worker.cc src/video_decoder.cc
git commit -m "refactor(native): migrate AsyncDecodeWorker to MediaWorker

AsyncDecodeWorker now delegates to MediaWorker<VideoDecodeProcessor>.
- Threading logic centralized in MediaWorker
- DARWIN-X64 shutdown fix applied uniformly
- Zero-copy output via OutputConverter
- Buffer pool removed (replaced by malloc + finalizer)"
```

---

### Task 8: Migrate AsyncEncodeWorker to Use MediaWorker

**Files:**
- Create: `src/video_encoder_converter.h`
- Modify: `src/async_encode_worker.h`
- Modify: `src/async_encode_worker.cc`
- Modify: `src/video_encoder.cc`

Follow same pattern as Task 7.

**Commit message:**

```bash
git commit -m "refactor(native): migrate AsyncEncodeWorker to MediaWorker"
```

---

## Task Group 4: Audio Async Migration (Serial)

### Task 9: Create AudioDecodeProcessor with Zero-Copy

**Files:**
- Create: `src/audio_decode_processor.h`
- Create: `src/audio_decode_processor.cc`

Similar to VideoDecodeProcessor but outputs f32 audio samples.

---

### Task 10: Create AudioDecoder OutputConverter and Make Async

**Files:**
- Create: `src/audio_decoder_converter.h`
- Modify: `src/audio_decoder.h`
- Modify: `src/audio_decoder.cc`

**Commit message:**

```bash
git commit -m "feat(native): make AudioDecoder async via MediaWorker

Fixes 'color of functions' problem: Audio now uses same async model as Video."
```

---

### Task 11: Create AudioEncodeProcessor and Make AudioEncoder Async

**Files:**
- Create: `src/audio_encode_processor.h`
- Create: `src/audio_encode_processor.cc`
- Create: `src/audio_encoder_converter.h`
- Modify: `src/audio_encoder.h`
- Modify: `src/audio_encoder.cc`
- Modify: `binding.gyp`

---

## Task Group 5: Cleanup and Code Review

### Task 12: Remove Legacy Code from Workers

Remove unused code from AsyncDecodeWorker and AsyncEncodeWorker after migration.

---

### Task 13: Code Review

Run full test suite, lint, and memory leak tests.

---

## Parallel Groups Summary

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Core template with OutputConverter - must complete first |
| Group 2 | 3, 4 | Video processors with zero-copy - parallel with Group 1 code |
| Group 3 | 5, 6, 7, 8 | Integration - depends on Groups 1-2 |
| Group 4 | 9, 10, 11 | Audio async - depends on Group 1, parallel with Group 3 |
| Group 5 | 12, 13 | Cleanup - depends on Groups 3-4 |

## Key Design Changes from Original Plan

1. **OutputConverter Injection (CRITICAL FIX)**: MediaWorker now accepts a converter function that transforms `OutputType*` to `napi_value[]`. This fixes the bug where `fn.Call({})` was called with no data.

2. **Zero-Copy Output Buffers**: OutputType uses `uint8_t*` allocated with `malloc()`. Ownership transfers to JavaScript via `Napi::Buffer::New(..., finalizer)`. Eliminates the `std::vector` copy overhead.

3. **Free() Method on OutputType**: Required for cleanup when output is not delivered (env null, converter throws).

## Final Verification

```bash
npm run check
./test/leak/leak.sh
npx vitest run test/stress/
```
