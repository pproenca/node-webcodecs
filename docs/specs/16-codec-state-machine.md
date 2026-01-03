---
title: '16. Codec State Machine'
---

> State machine for VideoDecoder, AudioDecoder, VideoEncoder, AudioEncoder

## Codec State Machine

All codec interfaces (VideoDecoder, AudioDecoder, VideoEncoder, AudioEncoder) follow the same state machine.

See `src/ffmpeg_raii.h` for the `AtomicCodecState` implementation.

### State Diagram

```
                      configure()
     ┌──────────────────────────────────────┐
     │                                      ▼
┌────────────┐       reset()        ┌─────────────┐
│unconfigured│◄─────────────────────│ configured  │
└────────────┘                      └─────────────┘
     │                                      │
     │ close()                       close()│
     │                                      │
     ▼                                      ▼
┌───────────────────────────────────────────────┐
│                    closed                      │
└───────────────────────────────────────────────┘
```

### CodecState Enum

```webidl
enum CodecState {
  "unconfigured",  // Initial state, after reset()
  "configured",    // After successful configure()
  "closed"         // Terminal state, after close() or error
};
```

### State Transitions

| Current State | Method              | New State    | Notes                                    |
| ------------- | ------------------- | ------------ | ---------------------------------------- |
| unconfigured  | `configure()`       | configured   | Async - may fail with NotSupportedError  |
| unconfigured  | `decode()/encode()` | -            | Throws InvalidStateError                 |
| unconfigured  | `flush()`           | -            | Returns rejected promise                 |
| unconfigured  | `reset()`           | -            | Throws InvalidStateError                 |
| unconfigured  | `close()`           | closed       | Releases resources                       |
| configured    | `configure()`       | configured   | Reconfigures codec                       |
| configured    | `decode()/encode()` | configured   | Queues work                              |
| configured    | `flush()`           | configured   | Returns promise, sets key_chunk_required |
| configured    | `reset()`           | unconfigured | Clears queues, rejects pending promises  |
| configured    | `close()`           | closed       | Releases resources                       |
| closed        | Any method          | -            | Throws InvalidStateError                 |

### Internal State: [[key chunk required]]

Decoders track whether the next chunk must be a key frame:

| Event                      | [[key chunk required]] |
| -------------------------- | ---------------------- |
| Constructor                | true                   |
| After `configure()`        | true                   |
| After `flush()` resolves   | true                   |
| After decoding a key frame | false                  |

**Implementation** (see `src/video_decoder.h`):

```cpp
#include "ffmpeg_raii.h"
#include "error_builder.h"

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
  // Atomic for thread-safe access
  std::atomic<bool> key_chunk_required_{true};

  Napi::Value Configure(const Napi::CallbackInfo& info) {
    // ...
    key_chunk_required_.store(true);  // Reset on configure
    // ...
  }

  Napi::Value Flush(const Napi::CallbackInfo& info) {
    // After flush completes (in async worker):
    key_chunk_required_.store(true);  // Reset after flush
    // ...
  }

  Napi::Value Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (key_chunk_required_.load() && chunk_type != "key") {
      webcodecs::errors::ThrowDataError(env, "Key frame required");
      return env.Undefined();
    }
    key_chunk_required_.store(false);
    // ...
  }
};
```

### Internal State: [[codec saturated]]

Tracks backpressure from underlying codec:

```
┌──────────────────────────────────────────────────────┐
│                    decode() called                    │
└──────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │ [[codec saturated]]?  │
              └───────────────────────┘
                    │           │
               true │           │ false
                    ▼           ▼
          ┌─────────────┐  ┌─────────────────────┐
          │ Return "not │  │ Queue to codec work │
          │ processed"  │  │ queue, decrement    │
          │             │  │ decodeQueueSize     │
          └─────────────┘  └─────────────────────┘
```

### FFmpeg Implementation

See `src/video_decoder.h` and `src/ffmpeg_raii.h`:

```cpp
#include <napi.h>
#include <queue>
#include "ffmpeg_raii.h"
#include "error_builder.h"

namespace webcodecs {

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
 private:
  // --- FFmpeg Resources (RAII managed) ---
  raii::AVCodecContextPtr codec_ctx_;

  // --- Thread-Safe State (from ffmpeg_raii.h) ---
  raii::AtomicCodecState state_;

  // --- Synchronization ---
  mutable std::mutex mutex_;

  // --- Decode Queue ---
  std::queue<raii::AVPacketPtr> decode_queue_;
  std::atomic<uint32_t> decode_queue_size_{0};

  // --- Key Chunk Tracking ---
  std::atomic<bool> key_chunk_required_{true};

  // --- Callbacks ---
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  Napi::Value Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_.IsClosed()) {
      webcodecs::errors::ThrowInvalidStateError(env, "Codec is closed");
      return env.Undefined();
    }

    // Transition to configured
    state_.transition(raii::AtomicCodecState::State::Unconfigured,
                      raii::AtomicCodecState::State::Configured);
    key_chunk_required_.store(true);

    // Queue configure on worker thread
    // ...
    return env.Undefined();
  }

  Napi::Value Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!state_.IsConfigured()) {
      webcodecs::errors::ThrowInvalidStateError(env, "Codec not configured");
      return env.Undefined();
    }

    if (key_chunk_required_.load() && chunk_type != "key") {
      webcodecs::errors::ThrowDataError(env, "Key frame required");
      return env.Undefined();
    }
    key_chunk_required_.store(false);

    decode_queue_size_++;

    // Queue decode work
    // ...
    return env.Undefined();
  }

  Napi::Value Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_.IsClosed()) {
      webcodecs::errors::ThrowInvalidStateError(env, "Codec is closed");
      return env.Undefined();
    }

    // Clear queues
    {
      std::lock_guard<std::mutex> lock(mutex_);
      while (!decode_queue_.empty()) {
        decode_queue_.pop();
      }
    }

    // Reset decode queue size
    uint32_t prev_size = decode_queue_size_.exchange(0);
    if (prev_size > 0) {
      // Schedule dequeue event
    }

    return env.Undefined();
  }

  Napi::Value Close(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Force transition to closed
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
};

}  // namespace webcodecs
```

### Dequeue Event

The `dequeue` event fires when `decodeQueueSize` or `encodeQueueSize` decreases:

```cpp
// In video_decoder.cpp
void VideoDecoder::ScheduleDequeueEvent() {
  if (dequeue_event_scheduled_) {
    return;  // Prevent event spam
  }

  dequeue_event_scheduled_ = true;

  // Call ondequeue callback if set
  if (!ondequeue_callback_.IsEmpty()) {
    ondequeue_callback_.Call({});
  }
  dequeue_event_scheduled_ = false;
}
```
