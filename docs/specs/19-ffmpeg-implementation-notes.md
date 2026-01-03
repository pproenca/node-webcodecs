---
title: '19. FFmpeg Implementation Notes'
---

> Critical implementation details for FFmpeg-backed WebCodecs

## FFmpeg Implementation Notes

This document covers critical implementation details for building a WebCodecs-compliant API using FFmpeg.

See `src/ffmpeg_raii.h` and `src/error_builder.h` for core utilities.

### 1. Flush Semantics

**W3C Requirement:**

> "The underlying codec implementation MUST emit all outputs in response to a flush."

**FFmpeg Implementation** (see `src/video_decoder.cpp`):

```cpp
#include "ffmpeg_raii.h"
#include "error_builder.h"

// In VideoDecoder async flush worker
void FlushInternal() {
  // Send NULL packet to trigger flush
  int ret = avcodec_send_packet(codec_ctx_.get(), nullptr);
  if (ret < 0 && ret != AVERROR_EOF) {
    // Handle error
    return;
  }

  // Drain all pending frames using RAII
  raii::AVFramePtr frame = raii::MakeAvFrame();
  while (true) {
    ret = avcodec_receive_frame(codec_ctx_.get(), frame.get());

    auto error_class = errors::ClassifyFfmpegError(ret);
    if (error_class == errors::FFmpegErrorClass::Again ||
        error_class == errors::FFmpegErrorClass::Eof) {
      break;  // No more frames
    }
    if (error_class == errors::FFmpegErrorClass::Error) {
      // Handle decode error
      return;
    }

    // Output the frame
    OutputFrame(frame.get());
    av_frame_unref(frame.get());
  }

  // Reset key chunk requirement
  key_chunk_required_.store(true);
}
```

---

### 2. EAGAIN and EOF Handling

**CRITICAL:** `AVERROR(EAGAIN)` and `AVERROR_EOF` are NOT errors - they are normal state transitions.

See `src/error_builder.h` for `ClassifyFfmpegError()`:

```cpp
#include "ffmpeg_raii.h"
#include "error_builder.h"

void DecodePacket(raii::AVPacketPtr& packet) {
  int ret = avcodec_send_packet(codec_ctx_.get(), packet.get());

  auto error_class = errors::ClassifyFfmpegError(ret);

  switch (error_class) {
    case errors::FFmpegErrorClass::Success:
      // Packet accepted
      break;

    case errors::FFmpegErrorClass::Again:
      // Codec needs to output frames before accepting more input
      DrainFrames();
      ret = avcodec_send_packet(codec_ctx_.get(), packet.get());
      break;

    case errors::FFmpegErrorClass::Eof:
      // Codec has been flushed - need to reset for new stream
      avcodec_flush_buffers(codec_ctx_.get());
      ret = avcodec_send_packet(codec_ctx_.get(), packet.get());
      break;

    case errors::FFmpegErrorClass::Error:
      // Actual error - close codec and invoke error callback
      errors::ThrowEncodingError(env_, ret, "Decode failed");
      state_.Close();
      break;
  }
}
```

---

### 3. Output Order Guarantee

**W3C Requirement:** Outputs MUST be emitted in decode/encode order, not completion order.

```cpp
// In src/shared/ or video_decoder.cpp

class OutputQueue {
  uint64_t next_sequence_ = 0;
  uint64_t next_output_ = 0;
  std::map<uint64_t, raii::AVFramePtr> pending_outputs_;
  std::mutex mutex_;

public:
  uint64_t AllocateSequence() { return next_sequence_++; }

  void EnqueueOutput(uint64_t sequence, raii::AVFramePtr frame) {
    std::lock_guard<std::mutex> lock(mutex_);
    pending_outputs_[sequence] = std::move(frame);
    FlushInOrder();
  }

private:
  void FlushInOrder() {
    while (pending_outputs_.count(next_output_)) {
      // Output frame via callback
      OutputCallback(std::move(pending_outputs_[next_output_]));
      pending_outputs_.erase(next_output_);
      next_output_++;
    }
  }
};
```

---

### 4. Thread Safety

**W3C Requirement:** `AVCodecContext` must never be accessed concurrently.

See `src/video_decoder.h` for the pattern:

```cpp
#include "ffmpeg_raii.h"

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
  // RAII-managed codec context
  raii::AVCodecContextPtr codec_ctx_;

  // Mutex protects codec context access
  mutable std::mutex mutex_;

  // Decode queue for async processing
  std::queue<raii::AVPacketPtr> decode_queue_;

  Napi::Value Decode(const Napi::CallbackInfo& info) {
    // Queue work - never access codec_ctx_ directly from JS thread
    {
      std::lock_guard<std::mutex> lock(mutex_);
      decode_queue_.push(std::move(packet));
    }
    // ... trigger async worker
  }
};
```

---

### 5. RAII Resource Management

**Always use RAII wrappers** from `src/ffmpeg_raii.h`:

```cpp
#include "ffmpeg_raii.h"

namespace webcodecs {

void Example() {
  // Use factory functions - never raw av_*_alloc()
  raii::AVFramePtr frame = raii::MakeAvFrame();
  raii::AVPacketPtr packet = raii::MakeAvPacket();
  raii::AVCodecContextPtr ctx = raii::MakeAvCodecContext(codec);

  // Check for allocation failure
  if (!frame || !packet || !ctx) {
    // Handle allocation failure
    return;
  }

  // Clone with reference counting
  raii::AVFramePtr frame_copy = raii::CloneAvFrame(frame.get());

  // All resources freed automatically on scope exit
}

}  // namespace webcodecs
```

---

### 6. Configuration Deep Copy

**W3C Requirement:** Configurations must be deep-copied before async processing.

```cpp
Napi::Value VideoDecoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Parse config from JS object
  VideoDecoderConfig config = ParseConfig(info[0].As<Napi::Object>());

  // Config is copied by value into lambda capture
  // Queue async work with captured config copy
  QueueConfigureWork([this, config = std::move(config)]() {
    ConfigureInternal(config);
  });

  return env.Undefined();
}
```

---

### 7. Backpressure (Saturation)

Implement backpressure to prevent memory exhaustion:

```cpp
class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
  static constexpr size_t kMaxPendingDecodes = 32;
  std::atomic<bool> codec_saturated_{false};
  std::atomic<uint32_t> decode_queue_size_{0};

  Napi::Value Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (codec_saturated_.load()) {
      // Queue is full - caller should wait for dequeue event
      return env.Undefined();
    }

    uint32_t new_size = ++decode_queue_size_;
    if (new_size >= kMaxPendingDecodes) {
      codec_saturated_.store(true);
    }

    // Queue decode work...
    return env.Undefined();
  }
};
```

---

### 8. VideoFrame Rotation and Flip

**W3C Requirement:** Encoders must verify all frames have the same orientation.

```cpp
#include "error_builder.h"

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
  std::optional<std::pair<int, bool>> active_orientation_;

  Napi::Value Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    int rotation = frame.rotation();
    bool flip = frame.flip();

    if (active_orientation_.has_value()) {
      auto [expected_rotation, expected_flip] = *active_orientation_;
      if (rotation != expected_rotation || flip != expected_flip) {
        errors::ThrowDataError(env,
            "Frame orientation must match first encoded frame");
        return env.Undefined();
      }
    } else {
      active_orientation_ = {rotation, flip};
    }

    // Continue with encode...
    return env.Undefined();
  }
};
```

---

### 9. Error Callback Invocation Rules

| Event                | Call error callback? |
| -------------------- | -------------------- |
| `reset()`            | ❌ No                |
| `close()`            | ❌ No                |
| Decode/encode error  | ✅ Yes               |
| Config not supported | ✅ Yes               |
| Resource reclaimed   | ✅ Yes               |
