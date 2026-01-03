---
title: '15. Error Types Reference'
---

> DOMException types used throughout the W3C WebCodecs specification

## Error Types and When They Are Thrown

This document provides a complete reference of all DOMException types used in WebCodecs, when they are thrown, and how to handle them in FFmpeg implementations.

See `src/error_builder.h` for the implementation of these error types.

### Error Type Summary

| Error Type           | When Thrown                                                 | FFmpeg Mapping                        |
| -------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `TypeError`          | Invalid config, detached frame, wrong argument type         | Validation failures                   |
| `InvalidStateError`  | State is "closed", operation invalid for current state      | State machine violations              |
| `DataError`          | Key chunk required but delta provided, orientation mismatch | Codec protocol violations             |
| `NotSupportedError`  | Config not supported by UA                                  | `avcodec_find_decoder()` returns null |
| `EncodingError`      | Codec error during encode/decode                            | FFmpeg `AVERROR` codes                |
| `QuotaExceededError` | Resource reclamation (section 11)                           | System resource limits                |
| `AbortError`         | Used internally for reset/close                             | User-initiated cancellation           |
| `DataCloneError`     | Transfer/serialize of detached object                       | Structured clone failures             |
| `RangeError`         | copyTo buffer too small, invalid plane index                | Bounds checking                       |
| `SecurityError`      | Non-origin-clean VideoFrame source                          | Origin violations (browser)           |

---

### TypeError

**When Thrown:**

- `configure()`: Config is not valid (empty codec string, zero dimensions)
- `decode()`/`encode()`: Frame/chunk is detached
- `new VideoFrame()`: Missing required `timestamp` for certain sources
- Any method: Wrong argument types

**FFmpeg Mapping** (see `src/video_decoder.cpp`):

```cpp
#include "error_builder.h"

Napi::Value VideoDecoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Validation that throws TypeError
  if (config.codec.empty()) {
    webcodecs::errors::ThrowTypeError(env, "codec string cannot be empty");
    return env.Undefined();
  }
  if (config.codedWidth == 0 || config.codedHeight == 0) {
    webcodecs::errors::ThrowTypeError(env, "codedWidth and codedHeight must be non-zero");
    return env.Undefined();
  }
  // ...
}
```

---

### InvalidStateError

**When Thrown:**

- `configure()`: State is "closed"
- `decode()`/`encode()`: State is not "configured"
- `flush()`: State is not "configured"
- `reset()`/`close()`: State is "closed"
- `clone()`/`copyTo()`: Frame is detached

**FFmpeg Mapping** (see `src/video_decoder.cpp`):

```cpp
#include "error_builder.h"
#include "ffmpeg_raii.h"

Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Use helper from error_builder.h
  if (!webcodecs::errors::RequireConfiguredState(env, state_, "decode")) {
    return env.Undefined();
  }
  // ... decode logic
}
```

---

### DataError

**When Thrown:**

- `decode()`: Key chunk required but `chunk.type` is "delta"
- `decode()`: Chunk inspection reveals it's not actually a key frame
- `encode()`: Frame orientation doesn't match first encoded frame

**FFmpeg Mapping** (see `src/video_decoder.cpp`):

```cpp
#include "error_builder.h"

Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (key_chunk_required_.load() && chunk_type != "key") {
    webcodecs::errors::ThrowDataError(env,
        "A key frame is required after configure() or flush()");
    return env.Undefined();
  }

  key_chunk_required_.store(false);
  // ...
}
```

---

### NotSupportedError

**When Thrown:**

- `configure()`: Codec not supported by user agent
- `isConfigSupported()`: Never thrown (returns `{supported: false}` instead)

**FFmpeg Mapping** (see `src/video_decoder.cpp`):

```cpp
#include "error_builder.h"
#include "ffmpeg_raii.h"

void VideoDecoder::ConfigureInternal(const VideoDecoderConfig& config) {
  AVCodecID codec_id = ParseCodecString(config.codec);
  const AVCodec* codec = avcodec_find_decoder(codec_id);

  if (!codec) {
    webcodecs::errors::ThrowNotSupportedError(env,
        "Codec not supported: " + config.codec);
    return;
  }

  // Create codec context with RAII wrapper
  codec_ctx_ = raii::MakeAvCodecContext(codec);
  if (!codec_ctx_) {
    webcodecs::errors::ThrowNotSupportedError(env, "Failed to allocate codec context");
    return;
  }
}
```

---

### EncodingError

**When Thrown:**

- `decode()`: Codec encounters unrecoverable decode error
- `encode()`: Codec encounters unrecoverable encode error

**FFmpeg Mapping** (see `src/video_decoder.cpp`, `src/error_builder.h`):

```cpp
#include "error_builder.h"
#include "ffmpeg_raii.h"

void VideoDecoder::DecodeInternal(raii::AVPacketPtr packet) {
  int ret = avcodec_send_packet(codec_ctx_.get(), packet.get());

  // Use error classification from error_builder.h
  auto error_class = webcodecs::errors::ClassifyFfmpegError(ret);

  switch (error_class) {
    case webcodecs::errors::FFmpegErrorClass::Success:
    case webcodecs::errors::FFmpegErrorClass::Again:
    case webcodecs::errors::FFmpegErrorClass::Eof:
      // Normal state transitions - not errors
      break;
    case webcodecs::errors::FFmpegErrorClass::Error:
      // Actual error - close codec and invoke error callback
      webcodecs::errors::ThrowEncodingError(env, ret, "Decode failed");
      state_.Close();
      break;
  }
}
```

---

### QuotaExceededError

**When Thrown:**

- Resource reclamation: System needs to reclaim codec resources

**FFmpeg Mapping:**

```cpp
#include "error_builder.h"

// Called when system is under memory pressure
void CodecManager::ReclaimResources(Napi::Env env) {
  // Find inactive/background codecs to reclaim
  for (auto& codec : codecs_) {
    if (codec->IsInactive() || codec->IsBackground()) {
      // Invoke error callback with QuotaExceededError
      // (custom implementation needed - not in error_builder.h)
      codec->state_.Close();
    }
  }
}
```

---

### AbortError

**When Thrown:**

- Used internally for `reset()` and `close()`
- Does NOT trigger error callback (special case)

**FFmpeg Mapping** (see `src/video_decoder.cpp`):

```cpp
#include "error_builder.h"
#include "ffmpeg_raii.h"

Napi::Value VideoDecoder::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Close state machine
  state_.Close();

  // Release FFmpeg resources (RAII handles cleanup)
  codec_ctx_.reset();

  // Clear decode queue
  {
    std::lock_guard<std::mutex> lock(mutex_);
    while (!decode_queue_.empty()) {
      decode_queue_.pop();
    }
  }

  return env.Undefined();
}
```

---

### Error Callback Behavior

**Important**: The error callback is NOT called for user-initiated operations:

| Operation            | Error Callback Called?      |
| -------------------- | --------------------------- |
| `reset()`            | ❌ No (AbortError)          |
| `close()`            | ❌ No (AbortError)          |
| Decode error         | ✅ Yes (EncodingError)      |
| Config not supported | ✅ Yes (NotSupportedError)  |
| Resource reclaimed   | ✅ Yes (QuotaExceededError) |
