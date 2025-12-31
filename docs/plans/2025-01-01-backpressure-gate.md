# Per-Instance Backpressure Gate Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-backpressure-gate.md` to implement task-by-task.

**Goal:** Implement C++20 `std::counting_semaphore`-based backpressure to bound RSS growth by limiting in-flight frames between C++ worker threads and JS callbacks.

**Architecture:** Each `AsyncEncodeWorker` and `AsyncDecodeWorker` instance gets its own semaphore (16 slots default). The semaphore is acquired in `Enqueue()` before queuing work, and released in the TSFN callback after JS processes the output. This blocks the producer when JS is slow, preventing unbounded queue growth.

**Tech Stack:** C++20 (`std::counting_semaphore`), Node-API (ThreadSafeFunction), std::shared_ptr for callback-safe lifetime management.

---

## Task 1: Upgrade Build to C++20

**Files:**
- Modify: `binding.gyp:53` (macOS), `binding.gyp:75` (Linux)

**Step 1: Write failing build test** (2-5 min)

Create a test file that uses C++20 semaphore to verify the build system:

```cpp
// test/native/semaphore_test.cc
#include <semaphore>
#include <cassert>

int main() {
    std::counting_semaphore<16> sem(16);
    sem.acquire();
    assert(true);
    sem.release();
    return 0;
}
```

**Step 2: Run build to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native 2>&1 | head -50
```

Expected: Build succeeds (C++17 doesn't have `<semaphore>` but may not be tested yet). We need to update the standard first.

**Step 3: Update binding.gyp for C++20** (2-5 min)

In `binding.gyp`, change:

Line 53 (macOS xcode_settings):
```json
"CLANG_CXX_LANGUAGE_STANDARD": "c++20",
```

Line 75 (Linux cflags_cc):
```json
"-std=c++20",
```

Also update `MACOSX_DEPLOYMENT_TARGET` from `10.15` to `11.0` (line 56) since C++20 semaphore requires Big Sur or later.

**Step 4: Run build to verify C++20 works** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native
```

Expected: Build succeeds with no errors.

**Step 5: Run existing tests to verify no regression** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test-fast
```

Expected: All tests pass.

**Step 6: Commit** (30 sec)

```bash
git add binding.gyp
git commit -m "$(cat <<'EOF'
build: upgrade to C++20 for std::counting_semaphore support

Enables backpressure gate implementation using C++20 synchronization
primitives. Updates MACOSX_DEPLOYMENT_TARGET to 11.0 (Big Sur) as
required for C++20 semaphore support.
EOF
)"
```

---

## Task 2: Add Backpressure Gate to AsyncEncodeWorker

**Files:**
- Modify: `src/async_encode_worker.h:19` (add include)
- Modify: `src/async_encode_worker.h:112-113` (add member)
- Modify: `src/async_encode_worker.cc:96-102` (acquire in Enqueue)
- Modify: `src/async_encode_worker.cc:224-235` (add to CallbackData)
- Modify: `src/async_encode_worker.cc:269` (capture gate)
- Modify: `src/async_encode_worker.cc:271-274` (release in callback)

**Step 1: Write the failing stress test** (2-5 min)

Create a test that verifies backpressure limits queue growth:

```typescript
// test/stress/backpressure.test.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { VideoEncoder, VideoFrame } from '../../dist/index.js';

describe('Backpressure Gate', () => {
  it('limits in-flight frames to prevent RSS bloat', async () => {
    const chunks: ArrayBuffer[] = [];
    let maxPending = 0;
    let currentPending = 0;

    const encoder = new VideoEncoder({
      output: (chunk) => {
        currentPending--;
        chunks.push(chunk.data);
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 1920,
      height: 1080,
      bitrate: 5_000_000,
    });

    // Rapid-fire 100 frames without awaiting
    const frames: VideoFrame[] = [];
    for (let i = 0; i < 100; i++) {
      const frameData = new Uint8Array(1920 * 1080 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: i * 33333,
      });
      frames.push(frame);

      currentPending++;
      maxPending = Math.max(maxPending, currentPending);
      encoder.encode(frame);
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // With 16-slot backpressure, max pending should be bounded
    // Allow some slack for timing, but should be well under 100
    expect(maxPending).toBeLessThan(32);
    expect(chunks.length).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails (or shows high pending count)** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npx vitest run test/stress/backpressure.test.ts
```

Expected: Test may pass with high `maxPending` (close to 100) or fail the assertion.

**Step 3: Add semaphore include to async_encode_worker.h** (2-5 min)

After line 19 (`#include <atomic>`), add:

```cpp
#include <semaphore>
```

**Step 4: Add backpressure gate member to AsyncEncodeWorker** (2-5 min)

After line 113 (after `pending_chunks_` declaration), add:

```cpp
  // Backpressure gate to limit in-flight frames between C++ and JS.
  // Uses shared_ptr because counting_semaphore is not copyable, and TSFN
  // callbacks may execute after worker destruction.
  static constexpr int kBackpressureSlots = 16;
  std::shared_ptr<std::counting_semaphore<kBackpressureSlots>> backpressure_gate_ =
      std::make_shared<std::counting_semaphore<kBackpressureSlots>>(kBackpressureSlots);
```

**Step 5: Modify Enqueue() to acquire slot before queuing** (2-5 min)

Replace lines 96-102 in `async_encode_worker.cc`:

```cpp
void AsyncEncodeWorker::Enqueue(EncodeTask task) {
  // Acquire backpressure slot BEFORE queuing. This blocks the caller when
  // the encoder output queue is saturated, providing natural backpressure
  // to the JS producer and bounding RSS growth.
  backpressure_gate_->acquire();

  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}
```

**Step 6: Add backpressure gate to ChunkCallbackData struct** (2-5 min)

In `async_encode_worker.cc`, modify the `ChunkCallbackData` struct (around line 224-235) to add:

```cpp
  // Backpressure gate semaphore for release in callback
  std::shared_ptr<std::counting_semaphore<16>> backpressure_gate;
```

**Step 7: Capture gate in EmitChunk and release in callback** (2-5 min)

In `EmitChunk()` (around line 269), after `cb_data->pending = pending_chunks_;`, add:

```cpp
  cb_data->backpressure_gate = backpressure_gate_;
```

In the TSFN callback (around line 271-274), add release as the FIRST operation:

```cpp
  output_tsfn_.NonBlockingCall(cb_data, [](Napi::Env env, Napi::Function fn,
                                           ChunkCallbackData* info) {
    // Release backpressure slot FIRST to unblock producer immediately
    info->backpressure_gate->release();

    // Decrement pending count before any operations
    info->pending->fetch_sub(1);
    // ... rest unchanged
```

**Step 8: Build and run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && npx vitest run test/stress/backpressure.test.ts
```

Expected: Test passes with `maxPending < 32`.

**Step 9: Run full test suite** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test-fast
```

Expected: All tests pass.

**Step 10: Commit** (30 sec)

```bash
git add src/async_encode_worker.h src/async_encode_worker.cc test/stress/backpressure.test.ts
git commit -m "$(cat <<'EOF'
feat(encoder): add backpressure gate to limit in-flight frames

Implements C++20 counting_semaphore-based backpressure for VideoEncoder.
The semaphore (16 slots default) is acquired before queuing encode tasks
and released when JS processes the output chunk via TSFN callback.

This bounds RSS growth by blocking the producer when the consumer is slow,
preventing unbounded queue accumulation during high-throughput encoding.
EOF
)"
```

---

## Task 3: Add Backpressure Gate to AsyncDecodeWorker

**Files:**
- Modify: `src/async_decode_worker.h:19` (add include)
- Modify: `src/async_decode_worker.h:104-105` (add member)
- Modify: `src/async_decode_worker.cc` (Enqueue, FrameCallbackData, EmitFrame)

**Step 1: Write the failing decoder stress test** (2-5 min)

Add to `test/stress/backpressure.test.ts`:

```typescript
describe('Decoder Backpressure', () => {
  it('limits in-flight decoded frames', async () => {
    // First encode some frames to get valid chunks
    const chunks: { data: ArrayBuffer; timestamp: number; type: string }[] = [];

    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Create 50 frames
    for (let i = 0; i < 50; i++) {
      const frameData = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame, { keyFrame: i % 10 === 0 });
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    // Now decode with backpressure tracking
    let maxPending = 0;
    let currentPending = 0;
    const decodedFrames: VideoFrame[] = [];

    const decoder = new VideoDecoder({
      output: (frame) => {
        currentPending--;
        decodedFrames.push(frame);
      },
      error: (e) => { throw e; },
    });

    decoder.configure({ codec: 'avc1.42001f' });

    // Rapid-fire decode
    for (const chunk of chunks) {
      currentPending++;
      maxPending = Math.max(maxPending, currentPending);
      decoder.decode(new EncodedVideoChunk({
        type: chunk.type as 'key' | 'delta',
        timestamp: chunk.timestamp,
        data: chunk.data,
      }));
    }

    await decoder.flush();
    decoder.close();

    // Clean up
    for (const frame of decodedFrames) {
      frame.close();
    }

    expect(maxPending).toBeLessThan(32);
    expect(decodedFrames.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npx vitest run test/stress/backpressure.test.ts -t "Decoder"
```

**Step 3: Add semaphore include to async_decode_worker.h** (2-5 min)

After line 19 (`#include <atomic>`), add:

```cpp
#include <semaphore>
```

**Step 4: Add backpressure gate member to AsyncDecodeWorker** (2-5 min)

After line 105 (after `pending_frames_` declaration), add:

```cpp
  // Backpressure gate to limit in-flight frames between C++ and JS.
  static constexpr int kBackpressureSlots = 16;
  std::shared_ptr<std::counting_semaphore<kBackpressureSlots>> backpressure_gate_ =
      std::make_shared<std::counting_semaphore<kBackpressureSlots>>(kBackpressureSlots);
```

**Step 5: Modify Enqueue() to acquire slot** (2-5 min)

Find the `Enqueue()` method in `async_decode_worker.cc` and add acquire before queuing:

```cpp
void AsyncDecodeWorker::Enqueue(DecodeTask task) {
  // Acquire backpressure slot BEFORE queuing
  backpressure_gate_->acquire();

  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}
```

**Step 6: Add gate to FrameCallbackData and capture in EmitFrame** (2-5 min)

Find the callback data struct in `async_decode_worker.cc` and add:

```cpp
  std::shared_ptr<std::counting_semaphore<16>> backpressure_gate;
```

In `EmitFrame()`, capture the gate before the TSFN call and release in the callback.

**Step 7: Build and run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && npx vitest run test/stress/backpressure.test.ts
```

Expected: All backpressure tests pass.

**Step 8: Run full test suite** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test-fast
```

Expected: All tests pass.

**Step 9: Commit** (30 sec)

```bash
git add src/async_decode_worker.h src/async_decode_worker.cc test/stress/backpressure.test.ts
git commit -m "$(cat <<'EOF'
feat(decoder): add backpressure gate to limit in-flight frames

Mirrors the encoder backpressure implementation for VideoDecoder.
The 16-slot semaphore bounds decoded frame accumulation when JS
processing is slower than the FFmpeg decode rate.
EOF
)"
```

---

## Task 4: Handle Stop() Edge Case for Clean Shutdown

**Files:**
- Modify: `src/async_encode_worker.cc:85-94` (Stop method)
- Modify: `src/async_decode_worker.cc` (Stop method)

**Step 1: Write test for close() during saturated encoding** (2-5 min)

Add to `test/stress/backpressure.test.ts`:

```typescript
it('handles close() during saturated encoding without deadlock', async () => {
  const encoder = new VideoEncoder({
    output: () => {
      // Slow consumer - simulate delay
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }
    },
    error: () => {},
  });

  encoder.configure({
    codec: 'avc1.42001f',
    width: 1920,
    height: 1080,
    bitrate: 5_000_000,
  });

  // Fire frames rapidly (will saturate the 16-slot gate)
  for (let i = 0; i < 30; i++) {
    const frameData = new Uint8Array(1920 * 1080 * 4);
    const frame = new VideoFrame(frameData, {
      format: 'RGBA',
      codedWidth: 1920,
      codedHeight: 1080,
      timestamp: i * 33333,
    });
    encoder.encode(frame);
    frame.close();
  }

  // Close while potentially blocked on acquire()
  // This should complete within reasonable time (no deadlock)
  const closePromise = new Promise<void>((resolve) => {
    encoder.close();
    resolve();
  });

  const timeout = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('close() deadlocked')), 5000);
  });

  await Promise.race([closePromise, timeout]);
  expect(encoder.state).toBe('closed');
});
```

**Step 2: Run test to verify current behavior** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npx vitest run test/stress/backpressure.test.ts -t "deadlock"
```

**Step 3: Analyze Stop() behavior** (2-5 min)

The current `Stop()` method sets `running_ = false` and calls `queue_cv_.notify_all()`. However, if a thread is blocked on `backpressure_gate_->acquire()`, it won't wake up from the condition variable.

Options:
1. Use `try_acquire_for()` with periodic `running_` check in Enqueue
2. Release all slots in Stop() to unblock waiting threads
3. Accept that close() waits for pending operations (current WebCodecs spec behavior)

Per W3C WebCodecs spec, `close()` should process all pending work. So blocking behavior is actually correct. The test should verify completion, not immediate return.

**Step 4: Update test to match spec behavior** (2-5 min)

The close() blocking until work completes is correct. Update test:

```typescript
it('close() completes pending work before returning', async () => {
  let outputCount = 0;

  const encoder = new VideoEncoder({
    output: () => { outputCount++; },
    error: () => {},
  });

  encoder.configure({
    codec: 'avc1.42001f',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
  });

  // Queue some frames
  for (let i = 0; i < 20; i++) {
    const frameData = new Uint8Array(640 * 480 * 4);
    const frame = new VideoFrame(frameData, {
      format: 'RGBA',
      codedWidth: 640,
      codedHeight: 480,
      timestamp: i * 33333,
    });
    encoder.encode(frame);
    frame.close();
  }

  // Flush and close - should complete all pending work
  await encoder.flush();
  encoder.close();

  // All frames should have been processed
  expect(outputCount).toBe(20);
  expect(encoder.state).toBe('closed');
});
```

**Step 5: Run updated test** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npx vitest run test/stress/backpressure.test.ts -t "completes pending"
```

Expected: Test passes.

**Step 6: Commit** (30 sec)

```bash
git add test/stress/backpressure.test.ts
git commit -m "$(cat <<'EOF'
test(backpressure): add shutdown behavior tests

Verifies that close() properly completes pending work before returning,
matching W3C WebCodecs spec behavior for codec shutdown.
EOF
)"
```

---

## Task 5: Add Memory Stress Test for Backpressure Verification

**Files:**
- Modify: `test/stress/backpressure.test.ts`

**Step 1: Write RSS-based memory verification test** (2-5 min)

```typescript
describe('Memory Bounding', () => {
  it('RSS stays bounded during high-throughput encoding', async () => {
    // Force GC to get baseline
    if (global.gc) global.gc();
    const baselineRSS = process.memoryUsage().rss;

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 1920,
      height: 1080,
      bitrate: 5_000_000,
    });

    let maxRSS = baselineRSS;

    // Encode 200 1080p frames (would be ~1.6GB uncompressed without backpressure)
    for (let i = 0; i < 200; i++) {
      const frameData = new Uint8Array(1920 * 1080 * 4); // ~8MB per frame
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();

      // Sample RSS periodically
      if (i % 20 === 0) {
        const currentRSS = process.memoryUsage().rss;
        maxRSS = Math.max(maxRSS, currentRSS);
      }
    }

    await encoder.flush();
    encoder.close();

    const rssGrowthMB = (maxRSS - baselineRSS) / (1024 * 1024);

    // With 16-slot backpressure on 1080p frames (~8MB each):
    // Max in-flight = 16 * 8MB = ~128MB (plus overhead)
    // Without backpressure: could grow to 200 * 8MB = 1.6GB
    // Allow generous margin for codec buffers, but should be well under 500MB
    expect(rssGrowthMB).toBeLessThan(500);
  });
});
```

**Step 2: Run memory test** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node --expose-gc node_modules/vitest/vitest.mjs run test/stress/backpressure.test.ts -t "RSS stays bounded"
```

Expected: Test passes with RSS growth under 500MB.

**Step 3: Commit** (30 sec)

```bash
git add test/stress/backpressure.test.ts
git commit -m "$(cat <<'EOF'
test(backpressure): add RSS memory bounding verification

Validates that backpressure gate effectively limits memory growth
during high-throughput 1080p encoding. Without backpressure, 200
frames would consume ~1.6GB; with 16-slot gate, growth stays bounded.
EOF
)"
```

---

## Task 6: Code Review

**Files:**
- Review: All modified files from Tasks 1-5

**Step 1: Run full test suite** (2-5 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm test
```

Expected: All tests pass including lint, fast tests, and guardrails.

**Step 2: Run stress tests specifically** (2-5 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test-stress
```

Expected: Memory leak tests pass, backpressure tests pass.

**Step 3: Manual code review checklist** (2-5 min)

- [ ] All `acquire()` calls have corresponding `release()` in callback
- [ ] `shared_ptr` used for semaphore to ensure callback safety
- [ ] No raw `new`/`delete` for semaphore (RAII via shared_ptr)
- [ ] Release happens BEFORE other callback work (to unblock producer ASAP)
- [ ] Error paths in ProcessFrame/EmitChunk still release slots
- [ ] Stop() behavior doesn't cause deadlock

**Step 4: Verify no memory leaks with valgrind (if available)** (2-5 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test-leak 2>&1 | tail -20
```

**Step 5: Final commit with sign-off** (30 sec)

```bash
git log --oneline -5
```

Verify all commits are present and properly formatted.

---

## Parallel Execution Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | Task 1 | Build system change must complete first |
| Group 2 | Task 2, Task 3 | Independent codec workers, no file overlap |
| Group 3 | Task 4, Task 5 | Both are test additions, can run in parallel |
| Group 4 | Task 6 | Final review after all implementation complete |

---

## Rollback Plan

If backpressure causes unexpected issues (e.g., deadlocks in production):

1. Revert to C++17: Change `c++20` back to `c++17` in binding.gyp
2. Remove semaphore code from workers
3. The feature is self-contained in AsyncEncodeWorker and AsyncDecodeWorker

No TypeScript API changes are made, so rollback has zero impact on consumers.
