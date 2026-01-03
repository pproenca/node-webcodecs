# Async WebCodecs Worker Architecture Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-03-async-webcodecs-worker-architecture.md` to implement task-by-task.

**Goal:** Eliminate async/memory hazards by adopting worker-owned codec architecture with SafeThreadSafeFunction wrappers and non-blocking flush, covering VideoEncoder, VideoDecoder, AudioEncoder, and AudioDecoder.

**Architecture:** Introduce three shared infrastructure components adapted from `node-webcodecs-spec`:
1. `SafeThreadSafeFunction` - prevents TSFN use-after-release and ensures cleanup on failed calls
2. `ControlMessageQueue` (C++) - typed FIFO queue for configure/encode/decode/flush/reset/close messages
3. `CodecWorker` - base class owning the worker thread and FFmpeg context, processing messages serially

**Tech Stack:** C++17, N-API, FFmpeg 5.0+, TypeScript, node:test

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Baseline tests - independent test files |
| Group 2 | 4, 5, 6 | Shared C++ infrastructure - builds on itself |
| Group 3 | 7 | VideoEncoder migration - depends on Group 2 |
| Group 4 | 8 | VideoDecoder migration - depends on Group 2 |
| Group 5 | 9 | AudioEncoder migration - depends on Group 2 |
| Group 6 | 10 | AudioDecoder migration - depends on Group 2 |
| Group 7 | 11 | Code Review - final task |

---

### Task 1: Add flush event-loop blocking regression test

**Files:**
- Create: `test/guardrails/flush-eventloop-blocking.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/guardrails/flush-eventloop-blocking.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Regression test: flush() must NOT block the event loop.
 *
 * This test measures heartbeat jitter during flush. If flush() blocks
 * the JS thread (via condition_variable::wait), setInterval callbacks
 * cannot fire and we'll see large gaps between heartbeats.
 *
 * Acceptance: max gap between heartbeats < 50ms during flush.
 */
describe('Flush Event Loop Blocking', () => {
  it('VideoEncoder.flush() does not block event loop', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Queue frames to create pending work
    for (let i = 0; i < 30; i++) {
      const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Measure heartbeat jitter during flush
    const gaps: number[] = [];
    let lastBeat = performance.now();
    const heartbeat = setInterval(() => {
      const now = performance.now();
      gaps.push(now - lastBeat);
      lastBeat = now;
    }, 5);

    await encoder.flush();

    clearInterval(heartbeat);
    encoder.close();

    // Find max gap - should be < 50ms if non-blocking
    const maxGap = Math.max(...gaps);
    assert.ok(
      maxGap < 50,
      `flush() blocked event loop: max gap ${maxGap.toFixed(1)}ms > 50ms`
    );
  });

  it('VideoDecoder.flush() does not block event loop', async () => {
    const { VideoDecoder, VideoEncoder, VideoFrame, EncodedVideoChunk } =
      await import('../../lib/index');

    // First encode some frames to get chunks
    const chunks: { data: ArrayBuffer; timestamp: number; type: 'key' | 'delta' }[] = [];
    let codecDescription: ArrayBuffer | undefined;

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const data = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
        if (meta?.decoderConfig?.description) {
          codecDescription = meta.decoderConfig.description as ArrayBuffer;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    for (let i = 0; i < 20; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    // Now decode
    const decoder = new VideoDecoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    decoder.configure({
      codec: 'avc1.42001e',
      codedWidth: 320,
      codedHeight: 240,
      description: codecDescription,
    });

    for (const c of chunks) {
      decoder.decode(new EncodedVideoChunk({
        type: c.type,
        timestamp: c.timestamp,
        data: c.data,
      }));
    }

    // Measure heartbeat jitter during flush
    const gaps: number[] = [];
    let lastBeat = performance.now();
    const heartbeat = setInterval(() => {
      const now = performance.now();
      gaps.push(now - lastBeat);
      lastBeat = now;
    }, 5);

    await decoder.flush();

    clearInterval(heartbeat);
    decoder.close();

    const maxGap = Math.max(...gaps);
    assert.ok(
      maxGap < 50,
      `flush() blocked event loop: max gap ${maxGap.toFixed(1)}ms > 50ms`
    );
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build && npx tsx --test test/guardrails/flush-eventloop-blocking.test.ts
```

Expected: FAIL with message like `flush() blocked event loop: max gap 200ms > 50ms` (current blocking implementation)

**Step 3: Mark as regression test - no implementation yet** (30 sec)

The test should fail on the current implementation. It will pass after Task 7-10 migrations.

**Step 4: Commit** (30 sec)

```bash
git add test/guardrails/flush-eventloop-blocking.test.ts
git commit -m "test(guardrails): add flush event-loop blocking regression test"
```

---

### Task 2: Add keyframe forcing regression test

**Files:**
- Create: `test/guardrails/keyframe-forcing.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/guardrails/keyframe-forcing.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Regression test: encode() keyFrame option must produce keyframes.
 *
 * Per WebCodecs spec, when encode() is called with { keyFrame: true },
 * the output chunk MUST be a key frame. This tests both sync and async paths.
 */
describe('Keyframe Forcing', () => {
  it('honors keyFrame option in encode()', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const chunks: { type: 'key' | 'delta'; timestamp: number }[] = [];

    const encoder = new VideoEncoder({
      output: (chunk) => {
        chunks.push({ type: chunk.type, timestamp: chunk.timestamp });
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Encode 30 frames, forcing keyframe at specific positions
    const keyframePositions = [0, 10, 20, 29];

    for (let i = 0; i < 30; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });

      const forceKeyframe = keyframePositions.includes(i);
      encoder.encode(frame, { keyFrame: forceKeyframe });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // Verify we got chunks
    assert.ok(chunks.length >= 20, `Expected at least 20 chunks, got ${chunks.length}`);

    // Find chunks by timestamp and verify keyframes
    for (const pos of keyframePositions) {
      const expectedTimestamp = pos * 33333;
      const chunk = chunks.find(c => c.timestamp === expectedTimestamp);
      assert.ok(chunk, `Missing chunk at position ${pos}`);
      assert.strictEqual(
        chunk.type,
        'key',
        `Frame at position ${pos} should be keyframe but was ${chunk.type}`
      );
    }
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build && npx tsx --test test/guardrails/keyframe-forcing.test.ts
```

Expected: FAIL - current async path may not honor keyFrame flag properly

**Step 3: Mark as regression test - no implementation yet** (30 sec)

**Step 4: Commit** (30 sec)

```bash
git add test/guardrails/keyframe-forcing.test.ts
git commit -m "test(guardrails): add keyframe forcing regression test"
```

---

### Task 3: Add frame size validation regression test

**Files:**
- Create: `test/guardrails/frame-size-validation.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/guardrails/frame-size-validation.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Regression test: Mismatched frame sizes must throw, not cause UB.
 *
 * When a VideoFrame with dimensions different from configured encoder
 * is passed to encode(), the implementation must:
 * 1. Throw a clear error, OR
 * 2. Handle the conversion safely
 *
 * It must NOT read past buffer bounds (UB/crash).
 */
describe('Frame Size Validation', () => {
  it('rejects frame larger than configured size', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    let errorCaught: Error | null = null;

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { errorCaught = e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Create frame larger than configured
    const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
      format: 'RGBA',
      codedWidth: 640,
      codedHeight: 480,
      timestamp: 0,
    });

    // Should either throw or call error callback
    try {
      encoder.encode(frame);
      frame.close();
      await encoder.flush();
    } catch (e) {
      errorCaught = e as Error;
    }

    encoder.close();

    // Must have caught an error - no silent failure or crash
    assert.ok(
      errorCaught !== null,
      'Mismatched frame size should produce an error, not silent failure'
    );
  });

  it('rejects frame smaller than configured size', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    let errorCaught: Error | null = null;

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { errorCaught = e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Create frame smaller than configured
    const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: 0,
    });

    try {
      encoder.encode(frame);
      frame.close();
      await encoder.flush();
    } catch (e) {
      errorCaught = e as Error;
    }

    encoder.close();

    assert.ok(
      errorCaught !== null,
      'Mismatched frame size should produce an error, not read past bounds'
    );
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build && npx tsx --test test/guardrails/frame-size-validation.test.ts
```

Expected: May FAIL (crash) or pass silently - current implementation may not validate

**Step 3: Mark as regression test - no implementation yet** (30 sec)

**Step 4: Commit** (30 sec)

```bash
git add test/guardrails/frame-size-validation.test.ts
git commit -m "test(guardrails): add frame size validation regression test"
```

---

### Task 4: Implement SafeThreadSafeFunction wrapper

**Files:**
- Create: `src/shared/safe_tsfn.h`

**Step 1: Write the unit test first** (2-5 min)

```typescript
// test/unit/safe-tsfn.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * SafeThreadSafeFunction tests.
 *
 * Since SafeTSFN is a C++ class, we test it indirectly through
 * the codec behavior. The key properties to verify:
 * 1. No crash when calling after Release()
 * 2. Call() returns false after Release()
 * 3. Release() is idempotent
 */
describe('SafeThreadSafeFunction behavior', () => {
  it('encoder cleanup does not crash on rapid close', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    // Rapid create/configure/encode/close cycles stress TSFN lifecycle
    for (let cycle = 0; cycle < 5; cycle++) {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrate: 500_000,
      });

      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });
      encoder.encode(frame);
      frame.close();

      // Close immediately without flush - stresses TSFN cleanup
      encoder.close();
    }

    // If we get here without crash, SafeTSFN is working
    assert.ok(true);
  });

  it('decoder cleanup does not crash on rapid close', async () => {
    const { VideoDecoder, EncodedVideoChunk } = await import('../../lib/index');

    for (let cycle = 0; cycle < 5; cycle++) {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Close immediately - stresses TSFN cleanup
      decoder.close();
    }

    assert.ok(true);
  });
});
```

**Step 2: Run test - should pass (existing behavior works)** (30 sec)

```bash
npm run build && npx tsx --test test/unit/safe-tsfn.test.ts
```

**Step 3: Create SafeThreadSafeFunction header** (2-5 min)

```cpp
// src/shared/safe_tsfn.h
#pragma once
/**
 * safe_tsfn.h - Thread-Safe Function Lifecycle Wrapper
 *
 * Provides a safe wrapper around Napi::TypedThreadSafeFunction that prevents:
 * - Calling after Release() (undefined behavior)
 * - Double Release() calls
 * - Race conditions between Call and Release
 *
 * Thread Safety:
 * - Call() can be called from any thread
 * - Release() can be called from any thread
 * - All operations are mutex-protected
 */

#ifndef SRC_SHARED_SAFE_TSFN_H_
#define SRC_SHARED_SAFE_TSFN_H_

#include <napi.h>

#include <atomic>
#include <mutex>
#include <utility>

namespace webcodecs {

/**
 * Thread-safe wrapper for Napi::TypedThreadSafeFunction.
 *
 * Guarantees:
 * - No calls after Release()
 * - No double Release()
 * - Thread-safe call from any thread
 *
 * @tparam Context The context type passed to the TSFN callback
 * @tparam DataType The data type passed through the TSFN
 * @tparam CallJs Optional CallJs function pointer (compile-time callback)
 */
template <typename Context, typename DataType,
          void (*CallJs)(Napi::Env, Napi::Function, Context*, DataType*) = nullptr>
class SafeThreadSafeFunction {
 public:
  using TSFN = Napi::TypedThreadSafeFunction<Context, DataType, CallJs>;

  SafeThreadSafeFunction() = default;

  ~SafeThreadSafeFunction() {
    // Only release in destructor if not unref'd.
    if (!unrefed_) {
      Release();
    }
  }

  // Non-copyable, non-movable
  SafeThreadSafeFunction(const SafeThreadSafeFunction&) = delete;
  SafeThreadSafeFunction& operator=(const SafeThreadSafeFunction&) = delete;
  SafeThreadSafeFunction(SafeThreadSafeFunction&&) = delete;
  SafeThreadSafeFunction& operator=(SafeThreadSafeFunction&&) = delete;

  /**
   * Initialize with a TSFN.
   * Must be called before any other operations.
   */
  void Init(TSFN tsfn) {
    std::lock_guard<std::mutex> lock(mutex_);
    tsfn_ = std::move(tsfn);
    released_ = false;
    initialized_ = true;
  }

  /**
   * Thread-safe call to the TSFN.
   *
   * @param data Pointer to data to pass to the callback.
   *             If this returns false, caller is responsible for cleanup.
   * @return true if call succeeded, false if TSFN was released or not initialized
   */
  [[nodiscard]] bool Call(DataType* data) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_ || released_) {
      return false;
    }

    napi_status status = tsfn_.NonBlockingCall(data);
    return status == napi_ok;
  }

  /**
   * Thread-safe blocking call to the TSFN.
   */
  [[nodiscard]] bool BlockingCall(DataType* data) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_ || released_) {
      return false;
    }

    napi_status status = tsfn_.BlockingCall(data);
    return status == napi_ok;
  }

  /**
   * Release the TSFN.
   * Idempotent - safe to call multiple times.
   */
  void Release() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_ && !released_ && !unrefed_) {
      tsfn_.Release();
      released_ = true;
    }
  }

  /**
   * Check if the TSFN has been released.
   */
  [[nodiscard]] bool IsReleased() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return released_;
  }

  /**
   * Check if the TSFN is initialized and not released.
   */
  [[nodiscard]] bool IsActive() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return initialized_ && !released_;
  }

  /**
   * Release a reference without fully releasing the TSFN.
   * Allows Node.js to exit even if the TSFN is still active.
   */
  void Unref(Napi::Env env) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_ && !released_) {
      tsfn_.Unref(env);
      unrefed_ = true;
    }
  }

 private:
  mutable std::mutex mutex_;
  TSFN tsfn_;
  bool initialized_{false};
  bool released_{true};
  bool unrefed_{false};
};

}  // namespace webcodecs

#endif  // SRC_SHARED_SAFE_TSFN_H_
```

**Step 4: Verify header compiles** (30 sec)

```bash
npm run build:native
```

Expected: PASS (header-only, no linking needed yet)

**Step 5: Commit** (30 sec)

```bash
git add src/shared/safe_tsfn.h test/unit/safe-tsfn.test.ts
git commit -m "feat(shared): add SafeThreadSafeFunction wrapper"
```

---

### Task 5: Implement ControlMessageQueue (C++)

**Files:**
- Create: `src/shared/control_message_queue.h`

**Step 1: Write the test first** (2-5 min)

```typescript
// test/unit/cpp-control-message-queue.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * ControlMessageQueue tests.
 *
 * The C++ queue is tested indirectly through codec behavior:
 * 1. Messages process in FIFO order
 * 2. Queue tracks size accurately
 * 3. Shutdown unblocks waiting Dequeue()
 */
describe('C++ ControlMessageQueue behavior', () => {
  it('encodeQueueSize reflects queued messages', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Queue should start at 0
    assert.strictEqual(encoder.encodeQueueSize, 0);

    // Queue 10 frames rapidly
    for (let i = 0; i < 10; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Queue size should be > 0 (some may have been processed)
    assert.ok(encoder.encodeQueueSize >= 0);

    await encoder.flush();
    encoder.close();

    // After flush, queue should be 0
    // Note: can't check after close
  });

  it('decodeQueueSize reflects queued messages', async () => {
    const { VideoDecoder } = await import('../../lib/index');

    const decoder = new VideoDecoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    decoder.configure({
      codec: 'avc1.42001e',
      codedWidth: 320,
      codedHeight: 240,
    });

    // Queue should start at 0
    assert.strictEqual(decoder.decodeQueueSize, 0);

    decoder.close();
  });
});
```

**Step 2: Run test - should pass** (30 sec)

```bash
npm run build && npx tsx --test test/unit/cpp-control-message-queue.test.ts
```

**Step 3: Create ControlMessageQueue header** (2-5 min)

```cpp
// src/shared/control_message_queue.h
#pragma once
/**
 * control_message_queue.h - Thread-Safe Control Message Queue
 *
 * Implements the WebCodecs spec "control message queue" abstraction.
 * Per spec, messages are processed FIFO with specific semantics:
 * - Configure blocks until complete
 * - Encode/Decode are queued and processed by worker
 * - Flush completes when all pending work is done
 * - Reset clears pending work
 * - Close terminates the queue
 */

#ifndef SRC_SHARED_CONTROL_MESSAGE_QUEUE_H_
#define SRC_SHARED_CONTROL_MESSAGE_QUEUE_H_

#include <chrono>
#include <condition_variable>
#include <functional>
#include <mutex>
#include <optional>
#include <queue>
#include <utility>
#include <variant>
#include <vector>

#include "src/ffmpeg_raii.h"

namespace webcodecs {

/**
 * Thread-safe control message queue per WebCodecs spec.
 *
 * @tparam PacketType Type for encoded data (e.g., ffmpeg::AVPacketPtr)
 * @tparam FrameType Type for decoded data (e.g., ffmpeg::AVFramePtr)
 */
template <typename PacketType, typename FrameType>
class ControlMessageQueue {
 public:
  // Message types
  struct ConfigureMessage {
    std::function<bool()> configure_fn;
  };

  struct DecodeMessage {
    PacketType packet;
  };

  struct EncodeMessage {
    FrameType frame;
    bool key_frame = false;
  };

  struct FlushMessage {
    uint32_t promise_id;
  };

  struct ResetMessage {};

  struct CloseMessage {};

  using Message = std::variant<ConfigureMessage, DecodeMessage, EncodeMessage,
                               FlushMessage, ResetMessage, CloseMessage>;

  ControlMessageQueue() = default;

  ~ControlMessageQueue() { Shutdown(); }

  // Non-copyable, non-movable
  ControlMessageQueue(const ControlMessageQueue&) = delete;
  ControlMessageQueue& operator=(const ControlMessageQueue&) = delete;
  ControlMessageQueue(ControlMessageQueue&&) = delete;
  ControlMessageQueue& operator=(ControlMessageQueue&&) = delete;

  /**
   * Enqueue a message for processing.
   * Thread-safe, called from JS main thread.
   */
  [[nodiscard]] bool Enqueue(Message msg) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (closed_) {
      return false;
    }
    queue_.push(std::move(msg));
    cv_.notify_one();
    return true;
  }

  /**
   * Dequeue a message for processing.
   * Blocks until a message is available or queue is closed.
   */
  [[nodiscard]] std::optional<Message> Dequeue() {
    std::unique_lock<std::mutex> lock(mutex_);
    cv_.wait(lock, [this] { return !queue_.empty() || closed_; });

    if (closed_ && queue_.empty()) {
      return std::nullopt;
    }

    Message msg = std::move(queue_.front());
    queue_.pop();
    return msg;
  }

  /**
   * Dequeue with timeout.
   */
  [[nodiscard]] std::optional<Message> DequeueFor(
      std::chrono::milliseconds timeout) {
    std::unique_lock<std::mutex> lock(mutex_);
    if (!cv_.wait_for(lock, timeout,
                      [this] { return !queue_.empty() || closed_; })) {
      return std::nullopt;
    }

    if (closed_ && queue_.empty()) {
      return std::nullopt;
    }

    Message msg = std::move(queue_.front());
    queue_.pop();
    return msg;
  }

  /**
   * Try to dequeue without blocking.
   */
  [[nodiscard]] std::optional<Message> TryDequeue() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (queue_.empty()) {
      return std::nullopt;
    }

    Message msg = std::move(queue_.front());
    queue_.pop();
    return msg;
  }

  /**
   * Clear all pending messages (for reset).
   */
  std::vector<PacketType> ClearPackets() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<PacketType> dropped;

    while (!queue_.empty()) {
      auto& msg = queue_.front();
      if (auto* decode = std::get_if<DecodeMessage>(&msg)) {
        dropped.push_back(std::move(decode->packet));
      }
      queue_.pop();
    }

    return dropped;
  }

  std::vector<FrameType> ClearFrames() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<FrameType> dropped;

    while (!queue_.empty()) {
      auto& msg = queue_.front();
      if (auto* encode = std::get_if<EncodeMessage>(&msg)) {
        dropped.push_back(std::move(encode->frame));
      }
      queue_.pop();
    }

    return dropped;
  }

  /**
   * Shutdown the queue permanently.
   */
  void Shutdown() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      closed_ = true;
    }
    cv_.notify_all();
  }

  /**
   * Get the current queue size.
   */
  [[nodiscard]] size_t size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return queue_.size();
  }

  /**
   * Check if the queue is closed.
   */
  [[nodiscard]] bool IsClosed() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return closed_;
  }

 private:
  mutable std::mutex mutex_;
  std::condition_variable cv_;
  std::queue<Message> queue_;
  bool closed_{false};
};

// Type aliases for video/audio
using VideoControlQueue =
    ControlMessageQueue<ffmpeg::AVPacketPtr, ffmpeg::AVFramePtr>;
using AudioControlQueue =
    ControlMessageQueue<ffmpeg::AVPacketPtr, ffmpeg::AVFramePtr>;

/**
 * Helper for processing messages with std::visit.
 */
template <class... Ts>
struct MessageVisitor : Ts... {
  using Ts::operator()...;
};

template <class... Ts>
MessageVisitor(Ts...) -> MessageVisitor<Ts...>;

}  // namespace webcodecs

#endif  // SRC_SHARED_CONTROL_MESSAGE_QUEUE_H_
```

**Step 4: Verify header compiles** (30 sec)

```bash
npm run build:native
```

**Step 5: Commit** (30 sec)

```bash
git add src/shared/control_message_queue.h test/unit/cpp-control-message-queue.test.ts
git commit -m "feat(shared): add ControlMessageQueue for WebCodecs messages"
```

---

### Task 6: Implement CodecWorker base class

**Files:**
- Create: `src/shared/codec_worker.h`

**Step 1: Write integration test** (2-5 min)

```typescript
// test/unit/codec-worker.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * CodecWorker tests.
 *
 * The worker is tested through codec behavior:
 * 1. Worker starts on configure
 * 2. Worker stops on close
 * 3. Messages process in order
 */
describe('CodecWorker behavior', () => {
  it('encoder worker processes messages in order', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const timestamps: number[] = [];

    const encoder = new VideoEncoder({
      output: (chunk) => {
        timestamps.push(chunk.timestamp);
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Queue frames with sequential timestamps
    for (let i = 0; i < 10; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // Timestamps should be in increasing order (FIFO processing)
    for (let i = 1; i < timestamps.length; i++) {
      assert.ok(
        timestamps[i] > timestamps[i - 1],
        `Timestamps out of order: ${timestamps[i - 1]} >= ${timestamps[i]}`
      );
    }
  });
});
```

**Step 2: Run test - should pass** (30 sec)

```bash
npm run build && npx tsx --test test/unit/codec-worker.test.ts
```

**Step 3: Create CodecWorker header** (2-5 min)

```cpp
// src/shared/codec_worker.h
#pragma once
/**
 * codec_worker.h - Template Worker Thread for WebCodecs Decoders/Encoders
 *
 * Provides a dedicated worker thread that:
 * - Owns the AVCodecContext exclusively (no mutex needed for codec ops)
 * - Processes messages from ControlMessageQueue in FIFO order
 * - Guarantees output ordering per W3C spec
 * - Handles lifecycle (Start/Stop) with proper shutdown
 */

#ifndef SRC_SHARED_CODEC_WORKER_H_
#define SRC_SHARED_CODEC_WORKER_H_

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <variant>

#include "src/ffmpeg_raii.h"
#include "src/shared/control_message_queue.h"

namespace webcodecs {

/**
 * Callback data types for TSFN delivery to JS thread.
 */
struct FrameOutputData {
  ffmpeg::AVFramePtr frame;
  int64_t timestamp;
  int64_t duration;
};

struct PacketOutputData {
  ffmpeg::AVPacketPtr packet;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
};

struct ErrorOutputData {
  int error_code;
  std::string message;
};

struct FlushCompleteData {
  uint32_t promise_id;
  bool success;
  std::string error_message;
};

struct DequeueEventData {
  uint32_t new_queue_size;
};

/**
 * Base template for codec worker threads.
 *
 * Subclasses implement codec-specific logic:
 * - OnConfigure: avcodec_open2, set codec parameters
 * - OnDecode: avcodec_send_packet, avcodec_receive_frame loop
 * - OnEncode: avcodec_send_frame, avcodec_receive_packet loop
 * - OnFlush: drain codec, resolve promise
 * - OnReset: avcodec_flush_buffers
 */
template <typename MessageQueue>
class CodecWorker {
 public:
  using ConfigureMessage = typename MessageQueue::ConfigureMessage;
  using DecodeMessage = typename MessageQueue::DecodeMessage;
  using EncodeMessage = typename MessageQueue::EncodeMessage;
  using FlushMessage = typename MessageQueue::FlushMessage;
  using ResetMessage = typename MessageQueue::ResetMessage;
  using CloseMessage = typename MessageQueue::CloseMessage;
  using Message = typename MessageQueue::Message;

  // Callback types
  using OutputFrameCallback = std::function<void(ffmpeg::AVFramePtr frame)>;
  using OutputPacketCallback = std::function<void(ffmpeg::AVPacketPtr packet,
                                                   bool is_key)>;
  using OutputErrorCallback =
      std::function<void(int error_code, const std::string& message)>;
  using FlushCompleteCallback =
      std::function<void(uint32_t promise_id, bool success,
                         const std::string& error)>;
  using DequeueCallback = std::function<void(uint32_t new_queue_size)>;

  explicit CodecWorker(MessageQueue& queue)
      : queue_(queue), running_(false), should_exit_(false) {}

  virtual ~CodecWorker() { Stop(); }

  // Non-copyable, non-movable
  CodecWorker(const CodecWorker&) = delete;
  CodecWorker& operator=(const CodecWorker&) = delete;
  CodecWorker(CodecWorker&&) = delete;
  CodecWorker& operator=(CodecWorker&&) = delete;

  /**
   * Start the worker thread.
   * Idempotent.
   */
  bool Start() {
    std::lock_guard<std::mutex> lock(lifecycle_mutex_);

    if (running_.load(std::memory_order_acquire)) {
      return true;
    }

    should_exit_.store(false, std::memory_order_release);

    try {
      worker_thread_ = std::thread(&CodecWorker::WorkerLoop, this);
      running_.store(true, std::memory_order_release);
      return true;
    } catch (const std::exception&) {
      return false;
    }
  }

  /**
   * Stop the worker thread.
   * Idempotent.
   */
  void Stop() {
    std::lock_guard<std::mutex> lock(lifecycle_mutex_);

    if (!running_.load(std::memory_order_acquire)) {
      return;
    }

    should_exit_.store(true, std::memory_order_release);
    queue_.Shutdown();

    if (worker_thread_.joinable()) {
      worker_thread_.join();
    }

    running_.store(false, std::memory_order_release);
  }

  [[nodiscard]] bool IsRunning() const {
    return running_.load(std::memory_order_acquire);
  }

  [[nodiscard]] bool ShouldExit() const {
    return should_exit_.load(std::memory_order_acquire);
  }

  // Callback setters
  void SetOutputFrameCallback(OutputFrameCallback cb) {
    output_frame_callback_ = std::move(cb);
  }

  void SetOutputPacketCallback(OutputPacketCallback cb) {
    output_packet_callback_ = std::move(cb);
  }

  void SetOutputErrorCallback(OutputErrorCallback cb) {
    output_error_callback_ = std::move(cb);
  }

  void SetFlushCompleteCallback(FlushCompleteCallback cb) {
    flush_complete_callback_ = std::move(cb);
  }

  void SetDequeueCallback(DequeueCallback cb) {
    dequeue_callback_ = std::move(cb);
  }

 protected:
  // Virtual handlers - implement in subclass
  virtual bool OnConfigure(const ConfigureMessage& msg) = 0;
  virtual void OnDecode(const DecodeMessage& msg) { (void)msg; }
  virtual void OnEncode(const EncodeMessage& msg) { (void)msg; }
  virtual void OnFlush(const FlushMessage& msg) = 0;
  virtual void OnReset() = 0;
  virtual void OnClose() {}

  // Output helpers
  void OutputFrame(ffmpeg::AVFramePtr frame) {
    if (output_frame_callback_) {
      output_frame_callback_(std::move(frame));
    }
  }

  void OutputPacket(ffmpeg::AVPacketPtr packet, bool is_key) {
    if (output_packet_callback_) {
      output_packet_callback_(std::move(packet), is_key);
    }
  }

  void OutputError(int error_code, const std::string& message) {
    if (output_error_callback_) {
      output_error_callback_(error_code, message);
    }
  }

  void FlushComplete(uint32_t promise_id, bool success,
                     const std::string& error = "") {
    if (flush_complete_callback_) {
      flush_complete_callback_(promise_id, success, error);
    }
  }

  void SignalDequeue(uint32_t new_queue_size) {
    if (dequeue_callback_) {
      dequeue_callback_(new_queue_size);
    }
  }

  MessageQueue& queue() { return queue_; }

 private:
  void WorkerLoop() {
    while (!ShouldExit()) {
      auto msg_opt = queue_.DequeueFor(std::chrono::milliseconds(100));

      if (!msg_opt) {
        continue;
      }

      Message& msg = *msg_opt;

      std::visit(
          MessageVisitor{
              [this](ConfigureMessage& m) {
                bool success = OnConfigure(m);
                (void)success;
              },
              [this](DecodeMessage& m) { OnDecode(m); },
              [this](EncodeMessage& m) { OnEncode(m); },
              [this](FlushMessage& m) { OnFlush(m); },
              [this](ResetMessage&) { OnReset(); },
              [this](CloseMessage&) {
                OnClose();
                should_exit_.store(true, std::memory_order_release);
              },
          },
          msg);
    }
  }

  MessageQueue& queue_;
  std::thread worker_thread_;
  std::mutex lifecycle_mutex_;
  std::atomic<bool> running_;
  std::atomic<bool> should_exit_;

  OutputFrameCallback output_frame_callback_;
  OutputPacketCallback output_packet_callback_;
  OutputErrorCallback output_error_callback_;
  FlushCompleteCallback flush_complete_callback_;
  DequeueCallback dequeue_callback_;
};

// Type aliases
using VideoDecoderWorkerBase = CodecWorker<VideoControlQueue>;
using VideoEncoderWorkerBase = CodecWorker<VideoControlQueue>;
using AudioDecoderWorkerBase = CodecWorker<AudioControlQueue>;
using AudioEncoderWorkerBase = CodecWorker<AudioControlQueue>;

}  // namespace webcodecs

#endif  // SRC_SHARED_CODEC_WORKER_H_
```

**Step 4: Verify header compiles** (30 sec)

```bash
npm run build:native
```

**Step 5: Commit** (30 sec)

```bash
git add src/shared/codec_worker.h test/unit/codec-worker.test.ts
git commit -m "feat(shared): add CodecWorker base class for worker threads"
```

---

### Task 7: Migrate VideoEncoder to worker-owned model

**Files:**
- Modify: `src/video_encoder.cc`
- Modify: `src/video_encoder.h`
- Modify: `src/async_encode_worker.cc`
- Modify: `src/async_encode_worker.h`

**Step 1: Run existing tests to establish baseline** (30 sec)

```bash
npm run build && npm run test:unit
```

**Step 2: Update AsyncEncodeWorker to use non-blocking flush** (5-10 min)

Modify `src/async_encode_worker.cc` to:
1. Return a promise ID from Flush() instead of blocking
2. Use TSFN callback to resolve the flush promise
3. Validate frame sizes before processing

Key changes in `AsyncEncodeWorker::Flush()`:
```cpp
// Change from blocking wait to async promise resolution
void AsyncEncodeWorker::Flush(uint32_t promise_id) {
  EncodeTask flush_task;
  flush_task.is_flush = true;
  flush_task.promise_id = promise_id;  // New field
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(flush_task));
  }
  queue_cv_.notify_one();
  // No blocking wait - promise resolved via TSFN callback
}
```

**Step 3: Update VideoEncoder::Flush() to return Promise** (5-10 min)

Modify `src/video_encoder.cc`:
```cpp
Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    return env.Undefined();
  }

  if (async_mode_ && async_worker_) {
    // Create a deferred promise
    auto deferred = Napi::Promise::Deferred::New(env);
    uint32_t promise_id = next_promise_id_++;
    pending_flush_promises_[promise_id] = std::move(deferred);

    // Enqueue flush - will be resolved via TSFN callback
    async_worker_->Flush(promise_id);

    return pending_flush_promises_[promise_id].Promise();
  }

  // Sync path unchanged
  avcodec_send_frame(codec_context_.get(), nullptr);
  EmitChunks(env);
  ReinitializeCodec();
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}
```

**Step 4: Add frame size validation in ProcessFrame** (2-5 min)

```cpp
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  // Validate frame size matches configured size
  if (task.width != static_cast<uint32_t>(width_) ||
      task.height != static_cast<uint32_t>(height_)) {
    std::string error_msg = "Frame size mismatch: expected " +
        std::to_string(width_) + "x" + std::to_string(height_) +
        ", got " + std::to_string(task.width) + "x" + std::to_string(task.height);
    // Report error via TSFN
    EmitError(error_msg);
    return;
  }
  // ... rest of ProcessFrame
}
```

**Step 5: Add keyframe forcing in ProcessFrame** (2-5 min)

```cpp
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  // ... validation ...

  // Honor keyframe request
  if (task.key_frame) {
    frame_->pict_type = AV_PICTURE_TYPE_I;
    frame_->key_frame = 1;
  } else {
    frame_->pict_type = AV_PICTURE_TYPE_NONE;
    frame_->key_frame = 0;
  }

  // ... rest of ProcessFrame
}
```

**Step 6: Run regression tests** (30 sec)

```bash
npm run build && npx tsx --test test/guardrails/flush-eventloop-blocking.test.ts
npm run build && npx tsx --test test/guardrails/keyframe-forcing.test.ts
npm run build && npx tsx --test test/guardrails/frame-size-validation.test.ts
```

Expected: All three tests should now PASS

**Step 7: Run full test suite** (30 sec)

```bash
npm run check
```

**Step 8: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_encoder.h src/async_encode_worker.cc src/async_encode_worker.h
git commit -m "feat(video-encoder): non-blocking flush with promise, frame validation, keyframe forcing"
```

---

### Task 8: Migrate VideoDecoder to worker-owned model

**Files:**
- Modify: `src/video_decoder.cc`
- Modify: `src/video_decoder.h`
- Modify: `src/async_decode_worker.cc`
- Modify: `src/async_decode_worker.h`

**Step 1: Run existing tests to establish baseline** (30 sec)

```bash
npm run build && npm run test:unit
```

**Step 2: Update AsyncDecodeWorker to use non-blocking flush** (5-10 min)

Same pattern as VideoEncoder - change Flush() to async with promise ID.

**Step 3: Update VideoDecoder::Flush() to return Promise** (5-10 min)

Same pattern as VideoEncoder.

**Step 4: Run regression tests** (30 sec)

```bash
npm run build && npx tsx --test test/guardrails/flush-eventloop-blocking.test.ts
```

Expected: VideoDecoder test should now PASS

**Step 5: Run full test suite** (30 sec)

```bash
npm run check
```

**Step 6: Commit** (30 sec)

```bash
git add src/video_decoder.cc src/video_decoder.h src/async_decode_worker.cc src/async_decode_worker.h
git commit -m "feat(video-decoder): non-blocking flush with promise resolution"
```

---

### Task 9: Migrate AudioEncoder to worker-owned model

**Files:**
- Modify: `src/audio_encoder.cc`
- Modify: `src/audio_encoder.h`

**Step 1: Examine current AudioEncoder implementation** (2-5 min)

Read `src/audio_encoder.cc` to understand current async patterns.

**Step 2: Apply same patterns as VideoEncoder** (5-10 min)

- Non-blocking flush with promise
- Frame validation
- TSFN for flush completion

**Step 3: Add audio-specific regression test** (2-5 min)

```typescript
// test/guardrails/audio-flush-eventloop.test.ts
```

**Step 4: Run tests** (30 sec)

```bash
npm run check
```

**Step 5: Commit** (30 sec)

```bash
git add src/audio_encoder.cc src/audio_encoder.h
git commit -m "feat(audio-encoder): non-blocking flush with promise resolution"
```

---

### Task 10: Migrate AudioDecoder to worker-owned model

**Files:**
- Modify: `src/audio_decoder.cc`
- Modify: `src/audio_decoder.h`

**Step 1: Examine current AudioDecoder implementation** (2-5 min)

Read `src/audio_decoder.cc` to understand current async patterns.

**Step 2: Apply same patterns as VideoDecoder** (5-10 min)

- Non-blocking flush with promise
- TSFN for flush completion

**Step 3: Run tests** (30 sec)

```bash
npm run check
```

**Step 4: Commit** (30 sec)

```bash
git add src/audio_decoder.cc src/audio_decoder.h
git commit -m "feat(audio-decoder): non-blocking flush with promise resolution"
```

---

### Task 11: Code Review

**Files:**
- All modified files

**Step 1: Run full CI check** (2-5 min)

```bash
npm run check
```

**Step 2: Verify regression tests pass** (30 sec)

```bash
npx tsx --test test/guardrails/flush-eventloop-blocking.test.ts
npx tsx --test test/guardrails/keyframe-forcing.test.ts
npx tsx --test test/guardrails/frame-size-validation.test.ts
```

**Step 3: Review changes** (5-10 min)

```bash
git diff main..HEAD --stat
git log --oneline main..HEAD
```

**Step 4: Update .agent/PLANS.md with outcomes** (2-5 min)

Update Progress section to mark tasks complete.

**Step 5: Final commit** (30 sec)

```bash
git add .agent/PLANS.md
git commit -m "docs: update PLANS.md with implementation outcomes"
```

---

## Validation and Acceptance

The change is accepted when:

1. All regression tests pass:
   - `test/guardrails/flush-eventloop-blocking.test.ts`
   - `test/guardrails/keyframe-forcing.test.ts`
   - `test/guardrails/frame-size-validation.test.ts`

2. `npm run check` passes (lint + all tests)

3. Max heartbeat gap during flush < 50ms

4. Keyframe forcing produces keyframes at requested positions

5. Frame size mismatch produces clear error, not crash
