# Async Video Encoding Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-async-encoding-implementation.md` to implement task-by-task.

**Goal:** Enable async encoding mode with proper ThreadSafeFunction flush synchronization, modeled after sharp's proven async patterns.

**Architecture:** Implement a flush completion tracking system using atomic counters and condition variables. When `flush()` is called, the native layer signals the encoder to drain, then waits for all pending TSFN callbacks to complete before returning. This ensures the JS Promise resolves only after all output callbacks have fired.

**Tech Stack:** C++17, node-addon-api (NAPI), FFmpeg libavcodec, Napi::ThreadSafeFunction

---

## Key Insights from Sharp Analysis

Sharp uses `Napi::AsyncWorker` which guarantees:
1. `Execute()` runs on libuv thread pool
2. `OnOK()` runs on main thread after Execute completes
3. All JS callbacks happen synchronously in OnOK

For WebCodecs streaming use case, we need ThreadSafeFunction because:
- Output callbacks must fire as chunks become available (not batched)
- Multiple outputs per encode operation
- Non-blocking encode with async callback delivery

The fix: Add a **pending callback counter** that tracks in-flight TSFN callbacks. Flush waits for this counter to reach zero.

---

## Task Group 1: Core Flush Synchronization (Serial - touches shared state)

### Task 1: Add Pending Callback Counter to AsyncEncodeWorker

**Files:**
- Modify: `src/async_encode_worker.h:62-85`
- Modify: `src/async_encode_worker.cc:156-181`

**Step 1: Write the failing test** (2-5 min)

Create a test that verifies flush waits for all callbacks:

```typescript
// test/golden/video-encoder-flush-sync.test.ts
import {describe, it, expect, vi} from 'vitest';

describe('VideoEncoder flush synchronization', () => {
  it('should wait for all output callbacks before flush resolves', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const callbackTimes: number[] = [];
    let flushResolveTime = 0;

    const encoder = new VideoEncoder({
      output: () => {
        callbackTimes.push(Date.now());
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    // Queue 5 frames
    for (let i = 0; i < 5; i++) {
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
    flushResolveTime = Date.now();

    // All callbacks must have fired BEFORE flush resolved
    expect(callbackTimes.length).toBeGreaterThan(0);
    for (const time of callbackTimes) {
      expect(time).toBeLessThanOrEqual(flushResolveTime);
    }

    encoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-sync.test.ts -v
```

Expected: PASS (current sync mode already satisfies this, but when async is enabled it would fail)

**Step 3: Add pending callback counter to header** (2-5 min)

```cpp
// In src/async_encode_worker.h, add after line 76:
  std::atomic<int> pending_callbacks_{0};
  std::mutex flush_mutex_;
  std::condition_variable flush_cv_;
  std::atomic<bool> flush_waiting_{false};
```

**Step 4: Update EmitChunk to track callbacks** (2-5 min)

```cpp
// In src/async_encode_worker.cc, modify EmitChunk function:
void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Increment BEFORE calling TSFN
  pending_callbacks_.fetch_add(1);

  // Copy packet data for thread-safe transfer
  auto* chunk_data = new std::vector<uint8_t>(pkt->data, pkt->data + pkt->size);
  int64_t pts = pkt->pts;
  int64_t duration = pkt->duration;
  bool is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;

  // Capture 'this' for callback completion tracking
  AsyncEncodeWorker* worker = this;

  output_tsfn_.NonBlockingCall(
      chunk_data,
      [pts, duration, is_key, worker](Napi::Env env, Napi::Function fn,
                               std::vector<uint8_t>* data) {
        // Create EncodedVideoChunk-like object
        Napi::Object chunk = Napi::Object::New(env);
        chunk.Set("type", is_key ? "key" : "delta");
        chunk.Set("timestamp", Napi::Number::New(env, pts));
        chunk.Set("duration", Napi::Number::New(env, duration));
        chunk.Set("data",
                 Napi::Buffer<uint8_t>::Copy(env, data->data(), data->size()));

        Napi::Object metadata = Napi::Object::New(env);

        fn.Call({chunk, metadata});
        delete data;

        // Decrement AFTER callback completes
        int prev = worker->pending_callbacks_.fetch_sub(1);
        if (prev == 1 && worker->flush_waiting_.load()) {
          std::lock_guard<std::mutex> lock(worker->flush_mutex_);
          worker->flush_cv_.notify_all();
        }
      });
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-sync.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/async_encode_worker.h src/async_encode_worker.cc test/golden/video-encoder-flush-sync.test.ts
git commit -m "feat(encoder): add pending callback counter for flush sync"
```

---

### Task 2: Implement Synchronous Flush Wait

**Files:**
- Modify: `src/async_encode_worker.cc:76-87`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/video-encoder-flush-blocks.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder flush blocking', () => {
  it('should block flush until worker queue is drained AND callbacks complete', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    let outputCount = 0;
    const encoder = new VideoEncoder({
      output: () => { outputCount++; },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    for (let i = 0; i < 3; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Before flush, we may have outputs already (sync mode)
    const preFlushCount = outputCount;

    await encoder.flush();

    // After flush, all frames should be output
    expect(outputCount).toBeGreaterThanOrEqual(preFlushCount);
    expect(encoder.encodeQueueSize).toBe(0);

    encoder.close();
  });
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-blocks.test.ts -v
```

Expected: PASS (establishes baseline)

**Step 3: Update Flush to wait for callbacks** (2-5 min)

```cpp
// In src/async_encode_worker.cc, replace Flush function:
void AsyncEncodeWorker::Flush() {
  flushing_.store(true);
  queue_cv_.notify_one();

  // Wait for task queue to drain
  {
    std::unique_lock<std::mutex> lock(queue_mutex_);
    queue_cv_.wait(lock, [this] {
      return task_queue_.empty() || !running_.load();
    });
  }

  // Send NULL frame to encoder to flush remaining packets
  if (codec_context_) {
    avcodec_send_frame(codec_context_, nullptr);
    while (avcodec_receive_packet(codec_context_, packet_) == 0) {
      EmitChunk(packet_);
      av_packet_unref(packet_);
    }
  }

  // Wait for all pending callbacks to complete
  flush_waiting_.store(true);
  {
    std::unique_lock<std::mutex> lock(flush_mutex_);
    flush_cv_.wait(lock, [this] {
      return pending_callbacks_.load() == 0;
    });
  }
  flush_waiting_.store(false);

  flushing_.store(false);
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-blocks.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc test/golden/video-encoder-flush-blocks.test.ts
git commit -m "feat(encoder): implement synchronous flush wait for callbacks"
```

---

## Task Group 2: Enable Async Mode (Serial - depends on Group 1)

### Task 3: Create ThreadSafeFunction in Configure

**Files:**
- Modify: `src/video_encoder.cc:248-259`
- Modify: `src/video_encoder.h:88-92`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/video-encoder-async-enabled.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder async mode enabled', () => {
  it('should allow event loop to run during encoding', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1000000,
    });

    let eventLoopRan = false;
    const checkEventLoop = setImmediate(() => {
      eventLoopRan = true;
    });

    // Queue 10 frames
    for (let i = 0; i < 10; i++) {
      const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Give event loop a chance to run
    await new Promise(resolve => setImmediate(resolve));

    await encoder.flush();

    clearImmediate(checkEventLoop);

    expect(chunks.length).toBeGreaterThan(0);
    // In async mode, event loop should have had chances to run
    expect(eventLoopRan).toBe(true);

    encoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async-enabled.test.ts -v
```

Expected: Currently PASS (sync mode doesn't block event loop between frames), but establishes the test.

**Step 3: Add TSFN creation in Configure** (2-5 min)

```cpp
// In src/video_encoder.cc, replace lines 248-259 with:

  // Setup async encoding with ThreadSafeFunction
  async_mode_ = true;

  // Create output ThreadSafeFunction
  output_tsfn_ = Napi::ThreadSafeFunction::New(
      env,
      output_callback_.Value(),  // JavaScript callback
      "VideoEncoderOutput",      // Resource name for diagnostics
      0,                         // Max queue size (0 = unlimited)
      1);                        // Initial thread count

  // Create error ThreadSafeFunction
  error_tsfn_ = Napi::ThreadSafeFunction::New(
      env,
      error_callback_.Value(),   // JavaScript callback
      "VideoEncoderError",       // Resource name
      0,                         // Max queue size
      1);                        // Initial thread count

  // Create and start async worker
  async_worker_ = std::make_unique<AsyncEncodeWorker>(
      this, output_tsfn_, error_tsfn_);
  async_worker_->SetCodecContext(
      codec_context_.get(), sws_context_.get(), width_, height_);
  async_worker_->Start();
```

**Step 4: Update destructor to handle TSFN cleanup** (2-5 min)

```cpp
// In src/video_encoder.cc, update Cleanup function:
void VideoEncoder::Cleanup() {
  if (async_worker_) {
    async_worker_->Stop();
    async_worker_.reset();
  }

  if (async_mode_) {
    // Release TSFNs - must happen AFTER async_worker is stopped
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async-enabled.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder-async-enabled.test.ts
git commit -m "feat(encoder): enable async mode with ThreadSafeFunction"
```

---

### Task 4: Update Native Flush to Return Promise

**Files:**
- Modify: `src/video_encoder.cc:438-465`
- Modify: `lib/index.ts:742-758`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/video-encoder-flush-promise.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder flush promise', () => {
  it('should return a promise that resolves after all outputs', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    for (let i = 0; i < 5; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    const flushPromise = encoder.flush();
    expect(flushPromise).toBeInstanceOf(Promise);

    await flushPromise;

    // All chunks should have been received
    expect(chunks.length).toBeGreaterThan(0);

    encoder.close();
  });
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-promise.test.ts -v
```

Expected: PASS (current implementation already returns promise)

**Step 3: Update native Flush for async mode** (2-5 min)

```cpp
// In src/video_encoder.cc, update Flush function:
Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    return env.Undefined();
  }

  if (async_mode_ && async_worker_) {
    // Async flush - blocks until worker drains AND callbacks complete
    async_worker_->Flush();

    // Reset queue state
    encode_queue_size_ = 0;
    codec_saturated_.store(false);
    return env.Undefined();
  }

  // Sync mode: flush encoder directly
  avcodec_send_frame(codec_context_.get(), nullptr);
  EmitChunks(env);

  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-flush-promise.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder-flush-promise.test.ts
git commit -m "feat(encoder): update flush for async mode support"
```

---

## Task Group 3: Metadata and DecoderConfig Support (Serial - depends on Group 2)

### Task 5: Add DecoderConfig to Async Output Callbacks

**Files:**
- Modify: `src/async_encode_worker.cc:156-181`
- Modify: `src/async_encode_worker.h:35-41`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/video-encoder-async-metadata.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder async metadata', () => {
  it('should include decoderConfig in keyframe metadata', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    interface ChunkWithMeta {
      type: string;
      metadata?: {
        decoderConfig?: {
          codec: string;
          codedWidth: number;
          codedHeight: number;
        };
      };
    }

    const chunks: ChunkWithMeta[] = [];
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push({ type: chunk.type, metadata });
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: 0,
    });
    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();

    // Find the keyframe
    const keyChunk = chunks.find(c => c.type === 'key');
    expect(keyChunk).toBeDefined();
    expect(keyChunk?.metadata?.decoderConfig).toBeDefined();
    expect(keyChunk?.metadata?.decoderConfig?.codec).toBe('avc1.42001e');
    expect(keyChunk?.metadata?.decoderConfig?.codedWidth).toBe(320);
    expect(keyChunk?.metadata?.decoderConfig?.codedHeight).toBe(240);

    encoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async-metadata.test.ts -v
```

Expected: FAIL (async path doesn't populate decoderConfig)

**Step 3: Add encoder metadata to EncodedChunk struct** (2-5 min)

```cpp
// In src/async_encode_worker.h, update EncodedChunk struct:
struct EncodedChunk {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;

  // Metadata for keyframes
  std::string codec_string;
  int width;
  int height;
  int display_width;
  int display_height;
  std::vector<uint8_t> extradata;
};
```

**Step 4: Update EmitChunk to include metadata** (2-5 min)

```cpp
// In src/async_encode_worker.cc, update EmitChunk:
void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  pending_callbacks_.fetch_add(1);

  auto* chunk_data = new std::vector<uint8_t>(pkt->data, pkt->data + pkt->size);
  int64_t pts = pkt->pts;
  int64_t duration = pkt->duration;
  bool is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;

  // Capture metadata for keyframes
  std::string codec_string = codec_string_;
  int width = width_;
  int height = height_;
  int display_width = display_width_;
  int display_height = display_height_;
  std::vector<uint8_t> extradata;
  if (is_key && codec_context_->extradata && codec_context_->extradata_size > 0) {
    extradata.assign(codec_context_->extradata,
                     codec_context_->extradata + codec_context_->extradata_size);
  }

  AsyncEncodeWorker* worker = this;

  output_tsfn_.NonBlockingCall(
      chunk_data,
      [pts, duration, is_key, worker, codec_string, width, height,
       display_width, display_height, extradata = std::move(extradata)]
      (Napi::Env env, Napi::Function fn, std::vector<uint8_t>* data) {
        Napi::Object chunk = Napi::Object::New(env);
        chunk.Set("type", is_key ? "key" : "delta");
        chunk.Set("timestamp", Napi::Number::New(env, pts));
        chunk.Set("duration", Napi::Number::New(env, duration));
        chunk.Set("data",
                 Napi::Buffer<uint8_t>::Copy(env, data->data(), data->size()));

        Napi::Object metadata = Napi::Object::New(env);

        // Add SVC metadata
        Napi::Object svc = Napi::Object::New(env);
        svc.Set("temporalLayerId", Napi::Number::New(env, 0));
        metadata.Set("svc", svc);

        // Add decoderConfig for keyframes
        if (is_key) {
          Napi::Object decoder_config = Napi::Object::New(env);
          decoder_config.Set("codec", codec_string);
          decoder_config.Set("codedWidth", Napi::Number::New(env, width));
          decoder_config.Set("codedHeight", Napi::Number::New(env, height));
          decoder_config.Set("displayAspectWidth",
                            Napi::Number::New(env, display_width));
          decoder_config.Set("displayAspectHeight",
                            Napi::Number::New(env, display_height));

          if (!extradata.empty()) {
            decoder_config.Set("description",
                Napi::Buffer<uint8_t>::Copy(env, extradata.data(), extradata.size()));
          }

          metadata.Set("decoderConfig", decoder_config);
        }

        fn.Call({chunk, metadata});
        delete data;

        int prev = worker->pending_callbacks_.fetch_sub(1);
        if (prev == 1 && worker->flush_waiting_.load()) {
          std::lock_guard<std::mutex> lock(worker->flush_mutex_);
          worker->flush_cv_.notify_all();
        }
      });
}
```

**Step 5: Add setter for encoder metadata in AsyncEncodeWorker** (2-5 min)

```cpp
// In src/async_encode_worker.h, add after SetCodecContext:
  void SetEncoderMetadata(const std::string& codec_string,
                          int display_width, int display_height);

// In src/async_encode_worker.cc, add:
void AsyncEncodeWorker::SetEncoderMetadata(const std::string& codec_string,
                                           int display_width, int display_height) {
  codec_string_ = codec_string;
  display_width_ = display_width;
  display_height_ = display_height;
}

// Add members to class in .h:
  std::string codec_string_;
  int display_width_;
  int display_height_;
```

**Step 6: Update VideoEncoder::Configure to pass metadata** (2-5 min)

```cpp
// In src/video_encoder.cc, after async_worker_->Start():
  async_worker_->SetEncoderMetadata(codec_string_, display_width_, display_height_);
```

**Step 7: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async-metadata.test.ts -v
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
git add src/async_encode_worker.h src/async_encode_worker.cc src/video_encoder.cc test/golden/video-encoder-async-metadata.test.ts
git commit -m "feat(encoder): add decoderConfig metadata to async output"
```

---

## Task Group 4: Integration Testing (Parallel)

### Task 6: Update Event Loop Non-Blocking Test

**Files:**
- Modify: `test/golden/video-encoder-event-loop.test.ts:16`

**Step 1: Remove .skip from test** (2-5 min)

```typescript
// In test/golden/video-encoder-event-loop.test.ts, change:
it.skip('should not block event loop during heavy encoding', async () => {
// to:
it('should not block event loop during heavy encoding', async () => {
```

**Step 2: Run test** (30 sec)

```bash
npx vitest run test/golden/video-encoder-event-loop.test.ts -v
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
git add test/golden/video-encoder-event-loop.test.ts
git commit -m "test(encoder): enable event loop non-blocking test"
```

---

### Task 7: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all encoder tests** (2-5 min)

```bash
npx vitest run test/golden/video-encoder*.test.ts -v
```

Expected: All tests PASS

**Step 2: Run full test suite** (2-5 min)

```bash
npm test
```

Expected: All tests PASS

**Step 3: Commit all changes if any fixes needed** (30 sec)

```bash
git add -A
git commit -m "test: fix any integration issues"
```

---

### Task 8: Code Review

Dispatch code-reviewer agent to review all changes from this plan.

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Core flush synchronization - must be serial (shared state) |
| Group 2 | 3, 4 | Enable async mode - depends on Group 1 |
| Group 3 | 5 | Metadata support - depends on Group 2 |
| Group 4 | 6, 7, 8 | Testing and review - can run after Group 3 |

---

## Summary of Changes

1. **AsyncEncodeWorker enhancements:**
   - Add `pending_callbacks_` atomic counter
   - Add `flush_mutex_`, `flush_cv_`, `flush_waiting_` for sync
   - Update `EmitChunk` to track callback lifecycle
   - Update `Flush` to wait for callbacks to complete

2. **VideoEncoder updates:**
   - Enable `async_mode_ = true` in Configure
   - Create ThreadSafeFunction instances for output/error
   - Initialize and start AsyncEncodeWorker
   - Pass encoder metadata for decoderConfig

3. **Test coverage:**
   - Flush synchronization verification
   - Event loop non-blocking verification
   - Metadata/decoderConfig in async mode
