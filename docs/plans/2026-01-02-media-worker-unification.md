# MediaWorker Unification Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-02-media-worker-unification.md` to implement task-by-task.

**Goal:** Create a unified `MediaWorker<T>` template that centralizes threading, task queue, TSFN lifecycle, and shutdown safety for all codecs.

**Architecture:** Extract common threading logic from `AsyncDecodeWorker` and `AsyncEncodeWorker` into a generic `MediaWorker<Processor>` class. The processor interface defines `Process(input) -> outputs`. This eliminates duplicated race-condition fixes (DARWIN-X64), enables Audio to become async immediately, and reduces maintenance burden.

**Tech Stack:** C++17 templates, Napi::ThreadSafeFunction, std::thread, std::mutex, std::condition_variable, RAII smart pointers

---

## Task Group 1: Core Infrastructure (Serial - touches shared files)

### Task 1: Create MediaWorker Template Header

**Files:**
- Create: `src/media_worker.h`

**Step 1: Write the test** (2-5 min)

Create a compile-time test that verifies the template instantiates correctly with a mock processor:

```cpp
// test/native/media_worker_compile_test.cc
// This is a compile-only test - if it compiles, the template is valid

#include "src/media_worker.h"
#include <vector>
#include <cstdint>

// Mock processor for compile-time validation
struct MockDecodeTask {
  std::vector<uint8_t> data;
  int64_t timestamp;
};

struct MockDecodedOutput {
  std::vector<uint8_t> rgba_data;
  int width;
  int height;
  int64_t timestamp;
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

// Instantiate template to verify compilation
template class pipeline::MediaWorker<MockDecodeProcessor>;

int main() {
  // Compile-only test - just return success
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

Create `src/media_worker.h` with the template class skeleton:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// MediaWorker: Unified async worker template for encode/decode operations.
// Centralizes threading, task queue, TSFN lifecycle, and shutdown safety.

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

// Concept: Processor must define InputType, OutputType, and methods:
//   void Configure(void* context)
//   std::vector<OutputType> Process(const InputType& input)
//   std::vector<OutputType> Flush()
//   void Reset()
template <typename Processor>
class MediaWorker {
 public:
  using InputType = typename Processor::InputType;
  using OutputType = typename Processor::OutputType;
  using OutputCallback = std::function<void(const OutputType&)>;
  using ErrorCallback = std::function<void(const std::string&)>;

  MediaWorker(Napi::ThreadSafeFunction output_tsfn,
              Napi::ThreadSafeFunction error_tsfn);
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
  void EmitOutput(const OutputType& output);
  void EmitError(const std::string& message);

  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;

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
git commit -m "feat(native): add MediaWorker template header

Unified async worker template for encode/decode operations.
Centralizes threading, task queue, TSFN lifecycle, and shutdown safety."
```

---

### Task 2: Implement MediaWorker Template Methods

**Files:**
- Create: `src/media_worker_impl.h`

**Step 1: Write the test** (2-5 min)

Extend the compile test to verify all methods are callable:

```cpp
// Add to test/native/media_worker_compile_test.cc
void TestMethodsExist() {
  // Can't actually call these without a real Napi::Env, but we verify they exist
  // by taking their addresses
  using Worker = pipeline::MediaWorker<MockDecodeProcessor>;

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

**Step 3: Write minimal implementation** (5 min)

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
#include <utility>

namespace pipeline {

template <typename Processor>
MediaWorker<Processor>::MediaWorker(Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : output_tsfn_(output_tsfn), error_tsfn_(error_tsfn) {}

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

  // Invalidate before signaling shutdown (DARWIN-X64 FIX pattern)
  configured_.store(false, std::memory_order_release);

  {
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
    for (const auto& output : outputs) {
      EmitOutput(output);
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
    for (const auto& output : outputs) {
      EmitOutput(output);
    }
  } catch (const std::exception& e) {
    EmitError(e.what());
  }
}

template <typename Processor>
void MediaWorker<Processor>::EmitOutput(const OutputType& output) {
  pending_outputs_->fetch_add(1);

  auto pending = pending_outputs_;
  auto* output_copy = new OutputType(output);

  output_tsfn_.NonBlockingCall(
      output_copy,
      [pending](Napi::Env env, Napi::Function fn, OutputType* data) {
        if (env == nullptr) {
          delete data;
          pending->fetch_sub(1);
          return;
        }

        try {
          // Processor-specific conversion handled by caller's TSFN callback
          // For now, just call with undefined - real impl will convert
          fn.Call({});
        } catch (...) {
          // Log but don't propagate
        }

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
git commit -m "feat(native): implement MediaWorker template methods

Complete implementation of Start/Stop/Enqueue/Flush with:
- DARWIN-X64 shutdown race fix pattern
- Shared pending counter for TSFN safety
- Generic processor interface"
```

---

## Task Group 2: Video Decode Processor (Serial - touches video_decoder files)

### Task 3: Create VideoDecodeProcessor Class

**Files:**
- Create: `src/video_decode_processor.h`
- Create: `src/video_decode_processor.cc`

**Step 1: Write the test** (2-5 min)

```cpp
// test/native/video_decode_processor_test.cc
#include "src/video_decode_processor.h"
#include <cassert>
#include <iostream>

int main() {
  // Test that types are defined
  using Input = pipeline::VideoDecodeProcessor::InputType;
  using Output = pipeline::VideoDecodeProcessor::OutputType;

  // Verify InputType has expected fields
  Input task;
  task.data = {0x00, 0x00, 0x01};
  task.timestamp = 1000;
  task.duration = 33333;
  task.is_key = true;
  task.is_flush = false;

  // Verify OutputType has expected fields
  Output frame;
  frame.rgba_data = {255, 0, 0, 255};
  frame.width = 1920;
  frame.height = 1080;
  frame.timestamp = 1000;

  std::cout << "VideoDecodeProcessor types compile correctly" << std::endl;
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

**Step 3: Write minimal implementation** (5 min)

Create `src/video_decode_processor.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecodeProcessor: FFmpeg decode logic extracted from AsyncDecodeWorker.
// Conforms to MediaWorker Processor concept.

#ifndef SRC_VIDEO_DECODE_PROCESSOR_H_
#define SRC_VIDEO_DECODE_PROCESSOR_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include "src/ffmpeg_raii.h"

#include <cstdint>
#include <string>
#include <vector>

namespace pipeline {

struct VideoDecodeTask {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
  bool is_flush;
};

struct DecodedVideoFrame {
  std::vector<uint8_t> rgba_data;
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

**Step 4: Create implementation file** (5 min)

Create `src/video_decode_processor.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_decode_processor.h"

#include <cmath>
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

  // Convert to RGBA
  OutputType output;
  output.width = output_width_;
  output.height = output_height_;
  output.timestamp = frame->pts;
  output.duration = 0;  // Set by caller if needed

  size_t rgba_size = output.width * output.height * 4;
  output.rgba_data.resize(rgba_size);

  uint8_t* dst_data[1] = {output.rgba_data.data()};
  int dst_linesize[1] = {static_cast<int>(output.width * 4)};

  sws_scale(sws_context_.get(), frame->data, frame->linesize, 0,
            frame->height, dst_data, dst_linesize);

  // Copy metadata
  output.rotation = rotation_;
  output.flip = flip_;

  // Calculate display dimensions
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
git commit -m "feat(native): add VideoDecodeProcessor for MediaWorker

Extract decode logic from AsyncDecodeWorker into reusable Processor class.
Conforms to MediaWorker concept: Configure/Process/Flush/Reset interface."
```

---

### Task 4: Create VideoEncodeProcessor Class

**Files:**
- Create: `src/video_encode_processor.h`
- Create: `src/video_encode_processor.cc`

**Step 1: Write the test** (2-5 min)

```cpp
// test/native/video_encode_processor_test.cc
#include "src/video_encode_processor.h"
#include <cassert>
#include <iostream>

int main() {
  using Input = pipeline::VideoEncodeProcessor::InputType;
  using Output = pipeline::VideoEncodeProcessor::OutputType;

  Input task;
  task.rgba_data = {255, 0, 0, 255};
  task.width = 1920;
  task.height = 1080;
  task.timestamp = 0;
  task.duration = 33333;
  task.key_frame = true;
  task.is_flush = false;
  task.quantizer = -1;
  task.frame_index = 0;

  Output chunk;
  chunk.data = {0x00, 0x00, 0x01};
  chunk.timestamp = 0;
  chunk.duration = 33333;
  chunk.is_key = true;
  chunk.frame_index = 0;

  std::cout << "VideoEncodeProcessor types compile correctly" << std::endl;
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  $(pkg-config --cflags libavcodec libavutil libswscale) \
  -c test/native/video_encode_processor_test.cc -o /dev/null 2>&1 | head -10
```

Expected: FAIL

**Step 3: Write minimal implementation** (5 min)

Create `src/video_encode_processor.h` and `src/video_encode_processor.cc` following the same pattern as VideoDecodeProcessor, extracting encode logic from AsyncEncodeWorker.

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
g++ -std=c++20 -I. -I$(node -p "require('node-addon-api').include") \
  $(pkg-config --cflags libavcodec libavutil libswscale) \
  -c test/native/video_encode_processor_test.cc -o /dev/null && echo "PASS"
```

**Step 5: Commit** (30 sec)

```bash
git add src/video_encode_processor.h src/video_encode_processor.cc test/native/
git commit -m "feat(native): add VideoEncodeProcessor for MediaWorker

Extract encode logic from AsyncEncodeWorker into reusable Processor class."
```

---

## Task Group 3: Integration (Serial - modifies existing workers)

### Task 5: Add video_decode_processor.cc to Build

**Files:**
- Modify: `binding.gyp`

**Step 1: Write the test** (2-5 min)

```bash
# Build should succeed with new source file
npm run build 2>&1 | tail -20
```

**Step 2: Run test to verify current state** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build
```

Expected: PASS (current build works)

**Step 3: Add source file to binding.gyp** (2-5 min)

Add `"src/video_decode_processor.cc"` and `"src/video_encode_processor.cc"` to the sources list in `binding.gyp`.

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add binding.gyp
git commit -m "build: add Processor classes to binding.gyp"
```

---

### Task 6: Migrate AsyncDecodeWorker to Use MediaWorker

**Files:**
- Modify: `src/async_decode_worker.h`
- Modify: `src/async_decode_worker.cc`
- Modify: `src/video_decoder.cc`

**Step 1: Write the test** (2-5 min)

Run existing video decoder tests to establish baseline:

```bash
npm run test:unit -- --grep "VideoDecoder"
```

**Step 2: Run test to verify current state** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
npx vitest run test/golden/video-decoder.test.ts
```

Expected: PASS (baseline)

**Step 3: Refactor AsyncDecodeWorker** (5 min)

Option A (Recommended - incremental): Keep AsyncDecodeWorker as a thin wrapper around `MediaWorker<VideoDecodeProcessor>`, delegating all methods. This preserves the existing API while using the unified implementation.

Option B (Full replacement): Replace AsyncDecodeWorker entirely with MediaWorker instantiation in VideoDecoder. More invasive but cleaner long-term.

For Task 6, use Option A for safety:

```cpp
// src/async_decode_worker.h - simplified version
class AsyncDecodeWorker {
 public:
  // ... existing interface unchanged ...

 private:
  std::unique_ptr<pipeline::MediaWorker<pipeline::VideoDecodeProcessor>> worker_;
  // Remove: std::thread, queue, mutex, cv - all moved to MediaWorker
};
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && \
npx vitest run test/golden/video-decoder.test.ts
```

Expected: PASS

**Step 5: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 6: Commit** (30 sec)

```bash
git add src/async_decode_worker.h src/async_decode_worker.cc src/video_decoder.cc
git commit -m "refactor(native): migrate AsyncDecodeWorker to MediaWorker

AsyncDecodeWorker now delegates to MediaWorker<VideoDecodeProcessor>.
Centralizes threading logic, shutdown safety, and TSFN management."
```

---

### Task 7: Migrate AsyncEncodeWorker to Use MediaWorker

**Files:**
- Modify: `src/async_encode_worker.h`
- Modify: `src/async_encode_worker.cc`
- Modify: `src/video_encoder.cc`

**Step 1: Write the test** (2-5 min)

```bash
npx vitest run test/golden/video-encoder.test.ts
```

**Step 2: Run test to verify current state** (30 sec)

Expected: PASS (baseline)

**Step 3: Refactor AsyncEncodeWorker** (5 min)

Same approach as Task 6 - wrap `MediaWorker<VideoEncodeProcessor>`.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts
```

**Step 5: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 6: Commit** (30 sec)

```bash
git add src/async_encode_worker.h src/async_encode_worker.cc src/video_encoder.cc
git commit -m "refactor(native): migrate AsyncEncodeWorker to MediaWorker

AsyncEncodeWorker now delegates to MediaWorker<VideoEncodeProcessor>."
```

---

## Task Group 4: Audio Async Migration (Serial - new async code for Audio)

### Task 8: Create AudioDecodeProcessor Class

**Files:**
- Create: `src/audio_decode_processor.h`
- Create: `src/audio_decode_processor.cc`

**Step 1: Write the test** (2-5 min)

```cpp
// test/native/audio_decode_processor_test.cc
#include "src/audio_decode_processor.h"
#include <iostream>

int main() {
  using Input = pipeline::AudioDecodeProcessor::InputType;
  using Output = pipeline::AudioDecodeProcessor::OutputType;

  Input task;
  task.data = {0x00, 0x00};
  task.timestamp = 0;

  Output audio;
  audio.f32_data = {0.0f, 0.5f};
  audio.sample_rate = 48000;
  audio.channels = 2;
  audio.frames = 1024;
  audio.timestamp = 0;

  std::cout << "AudioDecodeProcessor types compile correctly" << std::endl;
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

Expected: FAIL

**Step 3: Write minimal implementation** (5 min)

Create `src/audio_decode_processor.h` and `.cc` extracting logic from `AudioDecoder::Decode` and `AudioDecoder::EmitAudioData`.

**Step 4: Run test to verify it passes** (30 sec)

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/audio_decode_processor.h src/audio_decode_processor.cc test/native/
git commit -m "feat(native): add AudioDecodeProcessor for async audio decoding

Extract decode logic from AudioDecoder into Processor class.
Enables async audio decoding via MediaWorker template."
```

---

### Task 9: Make AudioDecoder Async via MediaWorker

**Files:**
- Modify: `src/audio_decoder.h`
- Modify: `src/audio_decoder.cc`

**Step 1: Write the test** (2-5 min)

```bash
npx vitest run test/golden/audio-decoder.test.ts
```

**Step 2: Run test to verify current state** (30 sec)

Expected: PASS (baseline - sync implementation)

**Step 3: Add async worker to AudioDecoder** (5 min)

Add `MediaWorker<AudioDecodeProcessor>` to AudioDecoder, matching the pattern from VideoDecoder:

1. Add ThreadSafeFunction members
2. Create MediaWorker in Configure
3. Enqueue tasks in Decode instead of blocking
4. Add pendingFrames accessor
5. Update Flush to drain async queue

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts
```

**Step 5: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 6: Commit** (30 sec)

```bash
git add src/audio_decoder.h src/audio_decoder.cc
git commit -m "feat(native): make AudioDecoder async via MediaWorker

AudioDecoder now uses MediaWorker<AudioDecodeProcessor> for non-blocking
decoding. Fixes 'color of functions' problem where Audio was sync while
Video was async."
```

---

### Task 10: Create AudioEncodeProcessor and Make AudioEncoder Async

**Files:**
- Create: `src/audio_encode_processor.h`
- Create: `src/audio_encode_processor.cc`
- Modify: `src/audio_encoder.h`
- Modify: `src/audio_encoder.cc`
- Modify: `binding.gyp`

**Step 1: Write the test** (2-5 min)

```bash
npx vitest run test/golden/audio-encoder.test.ts
```

**Step 2: Run test to verify current state** (30 sec)

Expected: PASS

**Step 3: Create AudioEncodeProcessor and update AudioEncoder** (5 min)

Follow same pattern as AudioDecoder.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts
```

**Step 5: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 6: Commit** (30 sec)

```bash
git add src/audio_encode_processor.* src/audio_encoder.* binding.gyp
git commit -m "feat(native): make AudioEncoder async via MediaWorker

Complete async unification: all four codecs now use MediaWorker.
Audio and Video have consistent threading model."
```

---

## Task Group 5: Cleanup and Documentation (Can run in parallel with Group 4)

### Task 11: Remove Duplicated Code from Original Workers

**Files:**
- Modify: `src/async_decode_worker.cc`
- Modify: `src/async_encode_worker.cc`

**Step 1: Write the test** (2-5 min)

```bash
npm run check
```

**Step 2: Run test to verify current state** (30 sec)

Expected: PASS

**Step 3: Remove legacy implementations** (2-5 min)

After Tasks 6-7 migrate to MediaWorker, remove the now-unused:
- `WorkerThread()` implementations
- Direct threading code
- Buffer pool (if replaced by zero-copy in future)

Keep AsyncDecodeWorker/AsyncEncodeWorker as thin wrappers for API compatibility.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run check
```

**Step 5: Commit** (30 sec)

```bash
git add src/async_decode_worker.cc src/async_encode_worker.cc
git commit -m "refactor(native): remove duplicated threading code from workers

Legacy worker thread implementations removed. All threading now
centralized in MediaWorker template."
```

---

### Task 12: Code Review

**Files:**
- All modified files

**Step 1: Run full test suite** (2-5 min)

```bash
npm run check
```

**Step 2: Run lint** (30 sec)

```bash
npm run lint
```

**Step 3: Run memory leak tests** (2-5 min)

```bash
npm run test:stress
```

**Step 4: Review changes** (5 min)

Use git diff to review all changes for:
- Thread safety issues
- RAII compliance
- Memory leaks
- Error handling

**Step 5: Create summary commit if needed** (30 sec)

---

## Parallel Groups Summary

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Core template - must complete first |
| Group 2 | 3, 4 | Video processors - no file overlap with Group 1 |
| Group 3 | 5, 6, 7 | Integration - depends on Groups 1-2 |
| Group 4 | 8, 9, 10 | Audio async - depends on Group 1, parallel with Group 3 |
| Group 5 | 11, 12 | Cleanup - depends on Groups 3-4 |

## Final Verification

After all tasks complete:

```bash
# Full CI check
npm run check

# Memory leak detection
./test/leak/leak.sh

# Stress test
npx vitest run test/stress/

# Cross-platform build verification
npm run build
```
