# Fix Memory Leak in Async Encode Path

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-fix-memory-leak-async-encode.md` to implement task-by-task.

**Goal:** Fix the ~770MB memory leak detected by `memory_sentinel.js` when encoding 10,000 frames, caused by improper resource cleanup in the async encode path.

**Architecture:** The fix addresses three root causes identified through code analysis:
1. `frame_info_` map in AsyncEncodeWorker accumulates entries when B-frame reordering causes packet/frame mismatch
2. `ChunkCallbackData` ownership tied to V8 GC which may not run promptly
3. `encode_queue_size_` counter in VideoEncoder never decrements in async path (decrement happens in TS layer, but native counter stays high)

**Tech Stack:** C++17 NAPI addon, FFmpeg libavcodec/libswscale, RAII patterns from `ffmpeg_raii.h`

---

## Task Group 1: Diagnostic Infrastructure (Parallel)

These tasks can run in parallel - no file overlap.

### Task 1: Add Memory Tracking Test That Isolates the Leak

**Files:**
- Create: `test/guardrails/memory_leak_diagnostic.js`

**Step 1: Write the diagnostic test** (3-5 min)

```javascript
/**
 * Diagnostic test to isolate memory leak location.
 * Runs variations of the encode loop to identify which path leaks.
 */
const { VideoEncoder, VideoFrame } = require('../../dist');

const FRAMES = 1000; // Smaller count for faster iteration

async function testScenario(name, scenario) {
  if (global.gc) global.gc();
  const startRSS = process.memoryUsage().rss;

  await scenario();

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 100)); // Let TSFN callbacks settle
  if (global.gc) global.gc();

  const endRSS = process.memoryUsage().rss;
  const growthMB = (endRSS - startRSS) / 1024 / 1024;
  console.log(`${name}: ${growthMB.toFixed(2)} MB growth`);
  return growthMB;
}

async function run() {
  console.log(`Memory Leak Diagnostic (${FRAMES} frames per scenario)\n`);

  // Scenario 1: Just create/destroy VideoFrames (isolate frame leak)
  const frameOnlyGrowth = await testScenario('VideoFrame only', async () => {
    const buf = Buffer.alloc(640 * 480 * 4);
    for (let i = 0; i < FRAMES; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33000,
      });
      frame.close();
    }
  });

  // Scenario 2: Encode without flush (isolate queue accumulation)
  const noFlushGrowth = await testScenario('Encode without flush', async () => {
    const encoder = new VideoEncoder({
      output: (chunk) => { if (chunk.close) chunk.close(); },
      error: (e) => { throw e; },
    });
    encoder.configure({ codec: 'avc1.42001E', width: 640, height: 480 });

    const buf = Buffer.alloc(640 * 480 * 4);
    for (let i = 0; i < FRAMES; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33000,
      });
      encoder.encode(frame);
      frame.close();
    }
    encoder.close(); // Close without flush
  });

  // Scenario 3: Encode with periodic flush (test flush cleanup)
  const periodicFlushGrowth = await testScenario('Encode with periodic flush', async () => {
    const encoder = new VideoEncoder({
      output: (chunk) => { if (chunk.close) chunk.close(); },
      error: (e) => { throw e; },
    });
    encoder.configure({ codec: 'avc1.42001E', width: 640, height: 480 });

    const buf = Buffer.alloc(640 * 480 * 4);
    for (let i = 0; i < FRAMES; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33000,
      });
      encoder.encode(frame);
      frame.close();

      // Flush every 100 frames
      if ((i + 1) % 100 === 0) {
        await encoder.flush();
      }
    }
    await encoder.flush();
    encoder.close();
  });

  // Scenario 4: Full encode (baseline - should match memory_sentinel)
  const fullEncodeGrowth = await testScenario('Full encode with final flush', async () => {
    const encoder = new VideoEncoder({
      output: (chunk) => { if (chunk.close) chunk.close(); },
      error: (e) => { throw e; },
    });
    encoder.configure({ codec: 'avc1.42001E', width: 640, height: 480 });

    const buf = Buffer.alloc(640 * 480 * 4);
    for (let i = 0; i < FRAMES; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33000,
      });
      encoder.encode(frame);
      frame.close();
    }
    await encoder.flush();
    encoder.close();
  });

  console.log('\n--- Analysis ---');
  if (frameOnlyGrowth > 10) {
    console.log('LEAK: VideoFrame creation/close path');
  }
  if (noFlushGrowth > fullEncodeGrowth * 1.5) {
    console.log('LEAK: Missing flush causes accumulation');
  }
  if (periodicFlushGrowth < fullEncodeGrowth * 0.5) {
    console.log('CLUE: Periodic flush reduces leak - frame_info_ map suspected');
  }
  if (fullEncodeGrowth > 10) {
    console.log('LEAK: Async encode path has memory leak');
  }
}

run().catch(e => {
  console.error('FAILURE:', e.message);
  process.exit(1);
});
```

**Step 2: Run the diagnostic test** (30 sec)

```bash
node --expose-gc test/guardrails/memory_leak_diagnostic.js
```

Expected output: Shows memory growth per scenario, identifying which path leaks most.

**Step 3: Commit** (30 sec)

```bash
git add test/guardrails/memory_leak_diagnostic.js
git commit -m "test(guardrails): add diagnostic test to isolate memory leak"
```

---

### Task 2: Add Native Memory Counters for Debugging

**Files:**
- Modify: `src/common.h` (add counters)
- Modify: `src/async_encode_worker.cc` (instrument allocations)

**Step 1: Add memory tracking counters to common.h** (2-3 min)

In `src/common.h`, after the existing counter declarations (around line 65), add:

```cpp
// Memory debugging counters (only in debug builds)
#ifdef DEBUG
extern std::atomic<int64_t> counterFrameInfoEntries;  // Tracks frame_info_ map size
extern std::atomic<int64_t> counterChunkCallbackData; // Tracks ChunkCallbackData allocations
extern std::atomic<int64_t> counterEncodeTasks;       // Tracks EncodeTask queue depth
#endif
```

**Step 2: Define counters in common.cc or inline** (2 min)

The counters are extern, so they need definition. Since this project doesn't have a common.cc, add definitions in async_encode_worker.cc at the top:

```cpp
#ifdef DEBUG
namespace webcodecs {
std::atomic<int64_t> counterFrameInfoEntries{0};
std::atomic<int64_t> counterChunkCallbackData{0};
std::atomic<int64_t> counterEncodeTasks{0};
}  // namespace webcodecs
#endif
```

**Step 3: Run build to verify compilation** (30 sec)

```bash
npm run build:native:debug
```

Expected: Build succeeds with no errors.

**Step 4: Commit** (30 sec)

```bash
git add src/common.h src/async_encode_worker.cc
git commit -m "feat(debug): add memory tracking counters for leak diagnosis"
```

---

## Task Group 2: Fix frame_info_ Map Leak (Serial - same file)

### Task 3: Add frame_info_ Cleanup on Encoder Close

**Files:**
- Modify: `src/async_encode_worker.cc:181` (ensure map is cleared)
- Modify: `src/async_encode_worker.h:128` (add cleanup method)

**Step 1: Write test to verify frame_info_ cleanup** (3-5 min)

Add to `test/guardrails/memory_leak_diagnostic.js` a scenario that encodes without receiving all packets (simulates B-frame situation):

Actually, the test already exists in Task 1. For this task, we focus on the fix.

**Step 2: Add ClearFrameInfo method to header** (2 min)

In `src/async_encode_worker.h`, add a public method after line 91:

```cpp
  // Clear frame_info_ map (called on close/reset to prevent leaks)
  void ClearFrameInfo();
```

**Step 3: Implement ClearFrameInfo in async_encode_worker.cc** (2 min)

Add after the destructor (after line 76):

```cpp
void AsyncEncodeWorker::ClearFrameInfo() {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  frame_info_.clear();
}
```

**Step 4: Call ClearFrameInfo from VideoEncoder::Cleanup** (2 min)

In `src/video_encoder.cc:Cleanup()`, before `async_worker_.reset()` (around line 144), add:

```cpp
  // Clear frame_info_ map to prevent leak from B-frame reordering mismatches
  if (async_worker_) {
    async_worker_->ClearFrameInfo();
  }
```

**Step 5: Run the build** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds.

**Step 6: Run memory sentinel to check improvement** (30 sec)

```bash
node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: Memory growth should be reduced (may not fully pass yet).

**Step 7: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc src/async_encode_worker.h src/video_encoder.cc
git commit -m "fix(memory): clear frame_info_ map on encoder close"
```

---

### Task 4: Bound frame_info_ Map Size

**Files:**
- Modify: `src/async_encode_worker.cc:195-196`

**Step 1: Add max size check before inserting to frame_info_** (3-5 min)

In `src/async_encode_worker.cc:ProcessFrame()`, modify the frame_info_ insertion (around line 195):

```cpp
  // Use frame_index as pts for consistent SVC layer computation
  // Store original timestamp/duration for lookup when emitting packets
  // Bound map size to prevent unbounded growth from B-frame reordering
  constexpr size_t kMaxFrameInfoEntries = 256;  // Generous buffer for B-frame reordering
  if (frame_info_.size() >= kMaxFrameInfoEntries) {
    // Evict oldest entry (smallest frame_index) to prevent unbounded growth
    frame_info_.erase(frame_info_.begin());
  }
  frame_->pts = task.frame_index;
  frame_info_[task.frame_index] =
      std::make_pair(task.timestamp, task.duration);
```

**Step 2: Build and test** (30 sec)

```bash
npm run build:native && node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: Build succeeds, memory growth should be improved.

**Step 3: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc
git commit -m "fix(memory): bound frame_info_ map size to prevent leak"
```

---

## Task Group 3: Fix ChunkCallbackData Leak (Serial - same file)

### Task 5: Ensure Prompt ChunkCallbackData Cleanup

**Files:**
- Modify: `src/async_encode_worker.cc:255-290` (review ownership)

**Step 1: Analyze current ownership model** (2 min)

The current code at lines 255-290:
1. `new ChunkCallbackData()` allocates on heap (line 255)
2. Ownership transfers to `Napi::Buffer::New()` via custom finalizer (lines 285-290)
3. Finalizer calls `delete hint` when buffer is GC'd

**Issue**: The buffer may not be GC'd promptly because:
- It's passed to JS callback
- If JS holds a reference, GC never runs
- The memory_sentinel test closes chunks, but `close()` doesn't trigger GC

**Step 2: Verify EncodedVideoChunk close() releases buffer** (3 min)

Check if the TypeScript `EncodedVideoChunk.close()` releases the underlying buffer reference.

Read `lib/encoded-chunks.ts`:

```bash
cat lib/encoded-chunks.ts | grep -A 20 "close()"
```

If `close()` sets `this._data = null`, the buffer becomes eligible for GC.

**Step 3: The fix approach** (3-5 min)

The real issue is that the test's output callback receives chunks but doesn't strongly dereference them before GC. The fix is in how we test, not in the native code.

However, we can add explicit cleanup. Modify the callback data deletion strategy:

In `src/async_encode_worker.cc:EmitChunk()`, change the buffer creation to NOT tie deletion to GC. Instead, copy the data and delete immediately:

```cpp
    // Option A: Copy data to buffer (no custom finalizer needed, immediate cleanup)
    auto buffer = Napi::Buffer<uint8_t>::Copy(
        env, info->data.data(), info->data.size());
    chunk.Set("data", buffer);

    // Delete callback data immediately after copying
    delete info;
```

This trades a copy for immediate cleanup. For a 10KB-100KB packet, this is acceptable.

**Step 4: Implement the fix** (2 min)

In `src/async_encode_worker.cc`, replace lines 279-290 with:

```cpp
    // Copy packet data to JS buffer. The copy ensures immediate cleanup of
    // ChunkCallbackData rather than waiting for V8 GC (which may not run
    // promptly). For typical packet sizes (10KB-100KB), copy overhead is
    // acceptable.
    auto buffer = Napi::Buffer<uint8_t>::Copy(
        env, info->data.data(), info->data.size());
    chunk.Set("data", buffer);

    // Immediately delete callback data now that we've copied everything
    delete info;
```

**Step 5: Build and test** (30 sec)

```bash
npm run build:native && node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: Significant improvement in memory growth.

**Step 6: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc
git commit -m "fix(memory): copy packet data to avoid GC-dependent cleanup"
```

---

## Task Group 4: Fix encode_queue_size_ Counter (Parallel)

### Task 6: Decrement Native Queue Counter in Async Path

**Files:**
- Modify: `src/video_encoder.cc:527-529`
- Modify: `src/async_encode_worker.cc` (add callback for queue decrement)

**Step 1: Understand the current flow** (2 min)

Current:
1. `VideoEncoder::Encode()` increments `encode_queue_size_++` (line 527)
2. TypeScript `outputCallback` decrements `this._encodeQueueSize--`
3. Native `encode_queue_size_` never decrements in async path

This doesn't cause a memory leak directly, but the counter becomes meaningless.

Actually, looking at the code more carefully:
- Line 527-528: `encode_queue_size_++` and `webcodecs::counterQueue++`
- The TypeScript wrapper at `lib/video-encoder.ts:38` decrements `this._encodeQueueSize`
- But the native counter at `encode_queue_size_` stays high

For memory leak purposes, this counter doesn't hold memory. However, `webcodecs::counterQueue` is decremented in the TSFN callback (line 284), so that's fine.

This task can be skipped as it doesn't contribute to the memory leak.

**Skip this task** - the counter issue doesn't affect memory.

---

## Task Group 5: Fix image_decoder.cc RAII Violation (Parallel)

### Task 7: Convert image_decoder.cc to RAII

**Files:**
- Modify: `src/image_decoder.cc:179-180, 452-453`

**Step 1: Read the current code** (2 min)

The file uses raw `av_frame_alloc()`/`av_packet_alloc()` instead of RAII wrappers.

**Step 2: Replace raw allocations with RAII** (5 min)

In `src/image_decoder.cc`, at line 179-180, replace:

```cpp
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
```

With:

```cpp
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();
```

At lines 452-453, replace:

```cpp
  AVPacket* pkt = av_packet_alloc();
  AVFrame* frm = av_frame_alloc();
```

With:

```cpp
  ffmpeg::AVPacketPtr pkt = ffmpeg::make_packet();
  ffmpeg::AVFramePtr frm = ffmpeg::make_frame();
```

And update the manual cleanup code later in that function to use `.get()` for accessing the raw pointer.

**Step 3: Check header includes** (1 min)

Ensure `src/image_decoder.cc` includes `src/ffmpeg_raii.h`.

**Step 4: Update manual cleanup to use RAII** (3 min)

Find where `av_frame_free()` and `av_packet_free()` are called and remove them - RAII handles cleanup.

**Step 5: Build and run tests** (30 sec)

```bash
npm run build:native && npm run test-fast
```

Expected: All tests pass.

**Step 6: Commit** (30 sec)

```bash
git add src/image_decoder.cc
git commit -m "refactor(image-decoder): use RAII wrappers for FFmpeg types"
```

---

## Task Group 6: Verification (Serial)

### Task 8: Run Full Test Suite and Memory Sentinel

**Files:**
- None (verification only)

**Step 1: Run memory sentinel test** (30 sec)

```bash
node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: `SUCCESS: Memory stable.` with growth < 50MB.

**Step 2: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass.

**Step 3: Run stress tests** (1 min)

```bash
npm run test-stress
```

Expected: All stress tests pass.

**Step 4: Run guardrails** (1 min)

```bash
npm run test-guardrails
```

Expected: All guardrails pass including memory sentinel.

---

## Task Group 7: Code Review

### Task 9: Code Review

Final task - review all changes made.

---

## Parallel Execution Summary

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Independent: diagnostic test vs. native counters |
| Group 2 | 3, 4 | Serial: both modify async_encode_worker.cc |
| Group 3 | 5 | Depends on Group 2 completing |
| Group 4 | (skipped) | Counter doesn't affect memory |
| Group 5 | 7 | Independent: different file (image_decoder.cc) |
| Group 6 | 8 | Serial: verification after all fixes |
| Group 7 | 9 | Serial: code review |

**Note:** Tasks 1, 2, and 7 can run in parallel as they modify different files.

---

## Expected Outcome

After completing all tasks:
1. Memory sentinel test passes with < 50MB growth
2. `frame_info_` map is bounded and cleared on close
3. `ChunkCallbackData` is cleaned up promptly via copy instead of GC
4. `image_decoder.cc` uses RAII consistently
5. All existing tests continue to pass
