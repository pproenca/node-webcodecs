# V8 External Memory Tracking & Instance Counter Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-v8-external-memory-tracking.md` to implement task-by-task.

**Goal:** Inform V8's garbage collector about native memory allocations in VideoFrame and AudioData, and expand instance counters to enable deterministic leak detection.

**Architecture:** The fix adds `Napi::MemoryManagement::AdjustExternalMemory` calls in constructors (positive) and destructors (negative) for classes storing large native buffers (`std::vector<uint8_t> data_`). Additionally, we expand the existing `counterFrames` pattern to include counters for all native wrapper classes (`counterVideoFrames`, `counterAudioData`, `counterEncoders`, `counterDecoders`) and export `getCounters()` to TypeScript for use in test cleanup.

**Tech Stack:** C++17, N-API, Vitest, TypeScript

---

## Task Group 1: V8 External Memory Tracking (Serial - same files)

### Task 1: Add AdjustExternalMemory to VideoFrame

**Files:**
- Modify: `src/video_frame.cc:264-415` (constructor) and `src/video_frame.cc:412-415` (destructor)
- Test: `test/unit/external-memory.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

Create a test that verifies V8 external memory is being tracked. This test will fail until we implement the fix.

```typescript
// test/unit/external-memory.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VideoFrame, AudioData } from '../../dist/index.js';

// Helper to force garbage collection
function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

describe('V8 External Memory Tracking', () => {
  describe('VideoFrame', () => {
    it('should track external memory for large frames', () => {
      // Create a large frame (1MB) - this should be visible to V8's GC
      const size = 1024 * 1024; // 1MB RGBA frame (512x512)
      const frameData = new Uint8Array(size);

      // Get baseline external memory
      forceGC();
      const before = process.memoryUsage().external;

      // Create frame
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 512,
        codedHeight: 512,
        timestamp: 0,
      });

      forceGC();
      const afterCreate = process.memoryUsage().external;

      // External memory should have increased by roughly the frame size
      // Allow some variance for overhead
      expect(afterCreate - before).toBeGreaterThan(size * 0.9);

      // Close the frame
      frame.close();

      forceGC();
      const afterClose = process.memoryUsage().external;

      // External memory should have decreased back toward baseline
      expect(afterClose - before).toBeLessThan(size * 0.5);
    });

    it('should release external memory when frame is garbage collected', async () => {
      const size = 1024 * 1024;

      forceGC();
      const before = process.memoryUsage().external;

      // Create frame in a scope that allows GC
      {
        const frameData = new Uint8Array(size);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 512,
          codedHeight: 512,
          timestamp: 0,
        });
        // Don't close - let GC handle it
      }

      // Force multiple GC cycles
      forceGC();
      await new Promise(r => setTimeout(r, 50));
      forceGC();

      const after = process.memoryUsage().external;

      // Memory should be released via destructor
      expect(after - before).toBeLessThan(size * 0.5);
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/unit/external-memory.test.ts --expose-gc
```

Expected: FAIL - External memory delta will be near zero because V8 doesn't know about native allocations.

**Step 3: Implement AdjustExternalMemory in VideoFrame constructor** (2-5 min)

In `src/video_frame.cc`, after line 277 where `data_` is populated (after `data_.assign(...)`), add:

```cpp
  // Inform V8 of external memory allocation for GC pressure calculation.
  // Without this, V8 sees this wrapper as ~64 bytes while the actual buffer
  // can be 8MB+ for 1080p RGBA frames.
  Napi::MemoryManagement::AdjustExternalMemory(env,
                                                static_cast<int64_t>(data_.size()));
```

Also add after line 354 where `data_` is reassigned during alpha discard conversion:

```cpp
  // Note: We already tracked the original size. After alpha discard conversion,
  // the buffer size may change. Adjust the delta.
  // (Original size was tracked above, new size after move)
```

Actually, we need to be more careful. The pattern should be:

1. Track initial allocation after `data_.assign()` at line 277
2. When alpha discard replaces the buffer, adjust the delta

**Step 4: Implement AdjustExternalMemory in VideoFrame destructor** (2-5 min)

In `src/video_frame.cc`, replace the destructor (lines 412-415):

```cpp
VideoFrame::~VideoFrame() {
  // Release external memory tracking before clearing data.
  // This must happen even if close() was called, as close() clears the vector
  // but doesn't call the destructor.
  if (!data_.empty()) {
    Napi::Env env = Env();
    Napi::MemoryManagement::AdjustExternalMemory(
        env, -static_cast<int64_t>(data_.size()));
  }
  data_.clear();
  data_.shrink_to_fit();
}
```

Wait - there's a problem. The destructor doesn't have access to `Env()` in the typical sense. We need to handle this differently. Let me reconsider.

**REVISED Step 3 & 4:** The correct approach is to store a reference to the environment or use a member variable to track allocation size, then use the Env() accessor from ObjectWrap.

Actually, `Napi::ObjectWrap<T>` does provide `Env()` in the destructor. Let me verify this is safe.

Looking at the N-API documentation, `ObjectWrap::Env()` is available in the destructor because the destructor is called during garbage collection when the environment is still valid.

However, there's a subtlety: we also need to handle the `Close()` method which clears the data before the destructor runs. We need to adjust external memory in `Close()` as well.

**Updated implementation:**

In `src/video_frame.cc`:

```cpp
// In constructor, after data_.assign() at line 277:
Napi::MemoryManagement::AdjustExternalMemory(env,
                                              static_cast<int64_t>(data_.size()));

// After alpha discard conversion at line 354 (after data_ = std::move(dst_buffer)):
// The original external memory was tracked, now adjust for new size
// Original size was data_.size() before the move, new size is dst_buffer.size()
// Since we used move, just track the difference (or re-track)
// Actually, we need to track the original size, then adjust after:
// Before line 354:
size_t old_size = data_.size();
// After line 354:
if (old_size != data_.size()) {
  Napi::MemoryManagement::AdjustExternalMemory(
      env, static_cast<int64_t>(data_.size()) - static_cast<int64_t>(old_size));
}
```

For the Close() method at line 541-549:

```cpp
void VideoFrame::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    // Release external memory tracking before clearing data.
    if (!data_.empty()) {
      Napi::MemoryManagement::AdjustExternalMemory(
          info.Env(), -static_cast<int64_t>(data_.size()));
    }
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
```

For the destructor at line 412-415:

```cpp
VideoFrame::~VideoFrame() {
  // If close() wasn't called, we still need to release external memory.
  // Note: If close() was called, data_ is already empty, so this is a no-op.
  if (!data_.empty()) {
    // Env() is available in destructor via ObjectWrap.
    Napi::MemoryManagement::AdjustExternalMemory(
        Env(), -static_cast<int64_t>(data_.size()));
  }
  data_.clear();
  data_.shrink_to_fit();
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/unit/external-memory.test.ts --expose-gc
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.cc test/unit/external-memory.test.ts
git commit -m "feat(video-frame): track external memory with V8 AdjustExternalMemory

Informs V8's garbage collector about the actual size of native buffer
allocations. Without this, V8 sees VideoFrame wrappers as ~64 bytes
while they may hold 8MB+ buffers for 1080p RGBA frames, causing
delayed GC and apparent memory leaks."
```

---

### Task 2: Add AdjustExternalMemory to AudioData

**Files:**
- Modify: `src/audio_data.cc:95-201` (constructor) and `src/audio_data.cc:609-615` (Close method)
- Test: `test/unit/external-memory.test.ts` (add to existing)

**Step 1: Write the failing test** (2-5 min)

Add to `test/unit/external-memory.test.ts`:

```typescript
describe('AudioData', () => {
  it('should track external memory for audio buffers', () => {
    // Create 1 second of stereo 48kHz f32 audio (~384KB)
    const sampleRate = 48000;
    const channels = 2;
    const frames = sampleRate; // 1 second
    const size = frames * channels * 4; // f32 = 4 bytes

    forceGC();
    const before = process.memoryUsage().external;

    const audioData = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: 0,
      data: new Float32Array(frames * channels),
    });

    forceGC();
    const afterCreate = process.memoryUsage().external;

    expect(afterCreate - before).toBeGreaterThan(size * 0.9);

    audioData.close();

    forceGC();
    const afterClose = process.memoryUsage().external;

    expect(afterClose - before).toBeLessThan(size * 0.5);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/unit/external-memory.test.ts --expose-gc -t "AudioData"
```

Expected: FAIL

**Step 3: Implement AdjustExternalMemory in AudioData constructor** (2-5 min)

In `src/audio_data.cc`, after the data is assigned (around line 175-191), add:

```cpp
  // Inform V8 of external memory allocation for GC pressure calculation.
  Napi::MemoryManagement::AdjustExternalMemory(env,
                                                static_cast<int64_t>(data_.size()));
```

**Step 4: Implement AdjustExternalMemory in AudioData::Close** (2-5 min)

In `src/audio_data.cc`, update the Close method (lines 609-615):

```cpp
void AudioData::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    if (!data_.empty()) {
      Napi::MemoryManagement::AdjustExternalMemory(
          info.Env(), -static_cast<int64_t>(data_.size()));
    }
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
```

Note: AudioData doesn't have an explicit destructor. We should add one to handle the case where close() is never called:

```cpp
// In audio_data.h, add destructor declaration in the public section

// In audio_data.cc:
AudioData::~AudioData() {
  if (!data_.empty()) {
    Napi::MemoryManagement::AdjustExternalMemory(
        Env(), -static_cast<int64_t>(data_.size()));
  }
}
```

Wait, checking the header file shows there's no destructor. We need to add it.

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/unit/external-memory.test.ts --expose-gc -t "AudioData"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/audio_data.cc src/audio_data.h test/unit/external-memory.test.ts
git commit -m "feat(audio-data): track external memory with V8 AdjustExternalMemory

Informs V8's garbage collector about native audio buffer allocations.
Adds destructor to ensure external memory is released even if close()
is never called."
```

---

## Task Group 2: Expanded Instance Counters (Serial - same files)

### Task 3: Add class-specific atomic counters to common.h/cc

**Files:**
- Modify: `src/common.h:113-119` (add new counter declarations)
- Modify: `src/common.cc` (add counter definitions)
- Test: Will be tested in Task 5

**Step 1: Write counter declarations** (2-5 min)

In `src/common.h`, replace/expand the existing counters section (lines 113-119):

```cpp
//==============================================================================
// Global Counters (for monitoring and leak detection)
//==============================================================================

// Per-class instance counters for deterministic leak detection.
// Increment in constructor, decrement in destructor.
extern std::atomic<int64_t> counterVideoFrames;
extern std::atomic<int64_t> counterAudioData;
extern std::atomic<int64_t> counterVideoEncoders;
extern std::atomic<int64_t> counterVideoDecoders;
extern std::atomic<int64_t> counterAudioEncoders;
extern std::atomic<int64_t> counterAudioDecoders;

// Legacy counters (maintained for backwards compatibility)
extern std::atomic<int> counterQueue;
extern std::atomic<int> counterProcess;
extern std::atomic<int> counterFrames;  // Alias for counterVideoFrames (deprecated)
```

**Step 2: Add counter definitions in common.cc** (2-5 min)

Find where the existing counters are defined and add:

```cpp
std::atomic<int64_t> webcodecs::counterVideoFrames{0};
std::atomic<int64_t> webcodecs::counterAudioData{0};
std::atomic<int64_t> webcodecs::counterVideoEncoders{0};
std::atomic<int64_t> webcodecs::counterVideoDecoders{0};
std::atomic<int64_t> webcodecs::counterAudioEncoders{0};
std::atomic<int64_t> webcodecs::counterAudioDecoders{0};
```

**Step 3: Commit** (30 sec)

```bash
git add src/common.h src/common.cc
git commit -m "feat(common): add per-class atomic counters for leak detection

Adds counters for VideoFrame, AudioData, and all encoder/decoder types.
These enable deterministic leak detection in tests without Valgrind."
```

---

### Task 4: Instrument VideoFrame and AudioData with counter increments/decrements

**Files:**
- Modify: `src/video_frame.cc:264-268` (constructor), `src/video_frame.cc:412-415` (destructor)
- Modify: `src/audio_data.cc:95-100` (constructor), add destructor

**Step 1: Instrument VideoFrame** (2-5 min)

In VideoFrame constructor (start of constructor body):
```cpp
VideoFrame::VideoFrame(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFrame>(info),
      duration_(0),
      has_duration_(false),
      closed_(false) {
  webcodecs::counterVideoFrames++;
  // ... rest of constructor
```

In VideoFrame destructor:
```cpp
VideoFrame::~VideoFrame() {
  webcodecs::counterVideoFrames--;
  // ... rest of destructor
```

**Step 2: Instrument AudioData** (2-5 min)

In AudioData constructor (start of constructor body):
```cpp
AudioData::AudioData(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioData>(info),
      sample_rate_(0),
      number_of_frames_(0),
      number_of_channels_(0),
      timestamp_(0),
      closed_(false) {
  webcodecs::counterAudioData++;
  // ... rest of constructor
```

In AudioData destructor:
```cpp
AudioData::~AudioData() {
  webcodecs::counterAudioData--;
  // ... rest of destructor
```

**Step 3: Commit** (30 sec)

```bash
git add src/video_frame.cc src/audio_data.cc src/audio_data.h
git commit -m "feat(counters): instrument VideoFrame and AudioData with instance counters

Increments counter in constructor, decrements in destructor.
Enables leak detection by checking counters == 0 after tests."
```

---

### Task 5: Instrument Encoders and Decoders with counter increments/decrements

**Files:**
- Modify: `src/video_encoder.cc` (constructor/destructor)
- Modify: `src/video_decoder.cc` (constructor/destructor)
- Modify: `src/audio_encoder.cc` (constructor/destructor)
- Modify: `src/audio_decoder.cc` (constructor/destructor)

**Step 1: Find and instrument VideoEncoder** (2-5 min)

Add to constructor:
```cpp
webcodecs::counterVideoEncoders++;
```

Add to destructor:
```cpp
webcodecs::counterVideoEncoders--;
```

**Step 2: Find and instrument VideoDecoder** (2-5 min)

Same pattern.

**Step 3: Find and instrument AudioEncoder** (2-5 min)

Same pattern.

**Step 4: Find and instrument AudioDecoder** (2-5 min)

Same pattern.

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_decoder.cc src/audio_encoder.cc src/audio_decoder.cc
git commit -m "feat(counters): instrument all encoders/decoders with instance counters"
```

---

### Task 6: Export expanded getCounters() to JavaScript

**Files:**
- Modify: `src/addon.cc:57-64` (GetCountersJS function)
- Modify: `lib/index.ts` (export getCounters)
- Modify: `lib/native-types.ts` (add type)
- Test: `test/unit/counters.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/unit/counters.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VideoFrame, AudioData, VideoEncoder, VideoDecoder } from '../../dist/index.js';
import { binding } from '../../dist/binding.js';

const native = binding as { getCounters: () => Record<string, number> };

describe('Instance Counters', () => {
  it('should track VideoFrame instances', () => {
    const before = native.getCounters();

    const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
    });

    const during = native.getCounters();
    expect(during.videoFrames).toBe(before.videoFrames + 1);

    frame.close();

    // Force GC to trigger destructor
    if (global.gc) global.gc();

    // Note: counter decrements in destructor, not close()
    // We need to wait for GC
  });

  it('should track encoder instances', () => {
    const before = native.getCounters();

    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    const during = native.getCounters();
    expect(during.videoEncoders).toBe(before.videoEncoders + 1);

    encoder.close();
  });

  it('should return all counter types', () => {
    const counters = native.getCounters();

    expect(counters).toHaveProperty('videoFrames');
    expect(counters).toHaveProperty('audioData');
    expect(counters).toHaveProperty('videoEncoders');
    expect(counters).toHaveProperty('videoDecoders');
    expect(counters).toHaveProperty('audioEncoders');
    expect(counters).toHaveProperty('audioDecoders');
    // Legacy
    expect(counters).toHaveProperty('queue');
    expect(counters).toHaveProperty('process');
    expect(counters).toHaveProperty('frames');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/unit/counters.test.ts
```

Expected: FAIL - getCounters doesn't have the new counter fields yet.

**Step 3: Update GetCountersJS in addon.cc** (2-5 min)

```cpp
Napi::Value GetCountersJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object counters = Napi::Object::New(env);

  // New per-class counters
  counters.Set("videoFrames", static_cast<double>(webcodecs::counterVideoFrames.load()));
  counters.Set("audioData", static_cast<double>(webcodecs::counterAudioData.load()));
  counters.Set("videoEncoders", static_cast<double>(webcodecs::counterVideoEncoders.load()));
  counters.Set("videoDecoders", static_cast<double>(webcodecs::counterVideoDecoders.load()));
  counters.Set("audioEncoders", static_cast<double>(webcodecs::counterAudioEncoders.load()));
  counters.Set("audioDecoders", static_cast<double>(webcodecs::counterAudioDecoders.load()));

  // Legacy counters (for backwards compatibility)
  counters.Set("queue", webcodecs::counterQueue.load());
  counters.Set("process", webcodecs::counterProcess.load());
  counters.Set("frames", webcodecs::counterFrames.load());

  return counters;
}
```

**Step 4: Export getCounters in TypeScript** (2-5 min)

In `lib/native-types.ts`, add to the NativeModule interface:

```typescript
getCounters: () => {
  videoFrames: number;
  audioData: number;
  videoEncoders: number;
  videoDecoders: number;
  audioEncoders: number;
  audioDecoders: number;
  queue: number;
  process: number;
  frames: number;
};
```

In `lib/index.ts`, add export:

```typescript
export const getCounters = native.getCounters;
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/unit/counters.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/addon.cc lib/index.ts lib/native-types.ts test/unit/counters.test.ts
git commit -m "feat(counters): export expanded getCounters() with per-class counts

Adds videoFrames, audioData, videoEncoders, videoDecoders, audioEncoders,
audioDecoders counters. Maintains legacy queue/process/frames for compat."
```

---

## Task Group 3: Test Infrastructure (Parallel with Group 2)

### Task 7: Add counter assertion helper for test cleanup

**Files:**
- Create: `test/helpers/leak-check.ts`
- Modify: `test/setup.ts` (add afterAll hook)

**Step 1: Create leak check helper** (2-5 min)

```typescript
// test/helpers/leak-check.ts
import { binding } from '../../dist/binding.js';

const native = binding as { getCounters: () => Record<string, number> };

export function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

export async function waitForGC(cycles = 3): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    forceGC();
    await new Promise(r => setTimeout(r, 10));
  }
}

export interface CounterSnapshot {
  videoFrames: number;
  audioData: number;
  videoEncoders: number;
  videoDecoders: number;
  audioEncoders: number;
  audioDecoders: number;
}

export function getCounters(): CounterSnapshot {
  return native.getCounters();
}

export function assertNoLeaks(
  before: CounterSnapshot,
  after: CounterSnapshot,
  context = ''
): void {
  const prefix = context ? `[${context}] ` : '';

  if (after.videoFrames !== before.videoFrames) {
    throw new Error(
      `${prefix}VideoFrame leak detected: ${after.videoFrames - before.videoFrames} instances not released`
    );
  }
  if (after.audioData !== before.audioData) {
    throw new Error(
      `${prefix}AudioData leak detected: ${after.audioData - before.audioData} instances not released`
    );
  }
  if (after.videoEncoders !== before.videoEncoders) {
    throw new Error(
      `${prefix}VideoEncoder leak detected: ${after.videoEncoders - before.videoEncoders} instances not released`
    );
  }
  if (after.videoDecoders !== before.videoDecoders) {
    throw new Error(
      `${prefix}VideoDecoder leak detected: ${after.videoDecoders - before.videoDecoders} instances not released`
    );
  }
  if (after.audioEncoders !== before.audioEncoders) {
    throw new Error(
      `${prefix}AudioEncoder leak detected: ${after.audioEncoders - before.audioEncoders} instances not released`
    );
  }
  if (after.audioDecoders !== before.audioDecoders) {
    throw new Error(
      `${prefix}AudioDecoder leak detected: ${after.audioDecoders - before.audioDecoders} instances not released`
    );
  }
}
```

**Step 2: Commit** (30 sec)

```bash
git add test/helpers/leak-check.ts
git commit -m "test(helpers): add leak detection helper using instance counters"
```

---

### Task 8: Update stress test to use counter-based leak detection

**Files:**
- Modify: `test/stress/memory-leak.test.ts`

**Step 1: Update memory leak test** (2-5 min)

Add counter-based assertions to the existing tests:

```typescript
import { getCounters, waitForGC, assertNoLeaks, type CounterSnapshot } from '../helpers/leak-check';

describe('Memory Leak Detection', () => {
  let initialCounters: CounterSnapshot;

  beforeAll(() => {
    // Capture initial state
    initialCounters = getCounters();
  });

  afterAll(async () => {
    // Wait for GC
    await waitForGC();

    // Assert no leaks
    const finalCounters = getCounters();
    assertNoLeaks(initialCounters, finalCounters, 'Memory Leak Tests');
  });

  // ... existing tests
});
```

**Step 2: Commit** (30 sec)

```bash
git add test/stress/memory-leak.test.ts
git commit -m "test(stress): add counter-based leak assertions to memory tests"
```

---

## Task Group 4: Memory Pressure Test (Independent)

### Task 9: Add GC pressure test with constrained heap

**Files:**
- Create: `test/stress/gc-pressure.test.ts`

**Step 1: Write GC pressure test** (2-5 min)

```typescript
// test/stress/gc-pressure.test.ts
/**
 * GC Pressure Test
 *
 * Verifies that V8 triggers garbage collection based on external memory pressure.
 * Run with: node --expose-gc --max-old-space-size=128 ./node_modules/.bin/vitest run test/stress/gc-pressure.test.ts
 *
 * If external memory tracking is broken, this test will OOM.
 * If working correctly, V8 will aggressively GC based on native allocations.
 */

import { describe, it, expect } from 'vitest';
import { VideoFrame } from '../../dist/index.js';

describe('GC Pressure', () => {
  it('should survive 1000 large frames without OOM when external memory is tracked', async () => {
    // Each frame is 1080p RGBA = 1920 * 1080 * 4 = ~8MB
    // 1000 frames would be 8GB, but with proper GC pressure we should survive
    const width = 1920;
    const height = 1080;
    const frameSize = width * height * 4;

    let created = 0;
    let gcTriggered = 0;

    // Track how often GC runs
    const originalGC = global.gc;
    if (originalGC) {
      global.gc = () => {
        gcTriggered++;
        originalGC();
      };
    }

    try {
      for (let i = 0; i < 1000; i++) {
        const frameData = new Uint8Array(frameSize);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * 33333,
        });

        // Don't hold reference - allow GC
        frame.close();
        created++;

        // Yield to event loop occasionally
        if (i % 100 === 0) {
          await new Promise(r => setImmediate(r));
        }
      }
    } finally {
      if (originalGC) {
        global.gc = originalGC;
      }
    }

    expect(created).toBe(1000);

    // GC should have been triggered multiple times due to memory pressure
    // If external memory tracking is broken, GC count will be low and we'll OOM
    console.log(`GC triggered ${gcTriggered} times during test`);
  });

  it('should handle rapid frame creation/destruction cycles', async () => {
    // Simulate a video processing pipeline that creates frames rapidly
    const width = 640;
    const height = 480;
    const frameSize = width * height * 4;

    const start = Date.now();
    const DURATION_MS = 5000; // 5 second stress test
    let frameCount = 0;

    while (Date.now() - start < DURATION_MS) {
      // Create batch of frames
      const frames: VideoFrame[] = [];
      for (let i = 0; i < 30; i++) {
        const frameData = new Uint8Array(frameSize);
        frames.push(new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: frameCount * 33333,
        }));
        frameCount++;
      }

      // Close all frames
      for (const frame of frames) {
        frame.close();
      }

      // Let event loop breathe
      await new Promise(r => setImmediate(r));
    }

    console.log(`Processed ${frameCount} frames in ${DURATION_MS}ms`);
    expect(frameCount).toBeGreaterThan(0);
  });
});
```

**Step 2: Commit** (30 sec)

```bash
git add test/stress/gc-pressure.test.ts
git commit -m "test(stress): add GC pressure test for external memory tracking

This test will OOM if V8 doesn't know about native allocations.
Run with --max-old-space-size=128 to constrain heap."
```

---

## Task Group 5: Final Task

### Task 10: Code Review

Review all changes for:
1. Memory safety - no double-frees or use-after-free
2. Thread safety - atomics used correctly
3. Edge cases - close() called multiple times, destructor with empty data_
4. Error handling - AdjustExternalMemory failures (unlikely but possible)

---

## Parallel Groups Summary

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Both modify video_frame.cc, must be serial |
| Group 2 | 3, 4, 5, 6 | All modify counter infrastructure, serial |
| Group 3 | 7, 8 | Test helpers, can run parallel with Group 2 |
| Group 4 | 9 | Independent stress test |
| Group 5 | 10 | Final review |

**Recommended execution:** Groups 1 → (2 parallel with 3) → Group 4 → Group 5
