# SVC Layer Tracking and node-canvas Support Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-svc-layer-tracking-and-canvas-support.md` to implement task-by-task.

**Goal:** Implement actual temporal layer tracking for SVC video encoding and add node-canvas support for VideoFrame constructor.

**Architecture:**
- SVC: Frame-position-based layer computation since FFmpeg doesn't expose temporal layer IDs in packet output. Parse `scalabilityMode` during configure, compute layer ID at emit time.
- Canvas: Duck-typing to detect canvas objects, extract RGBA pixels via `getImageData()`, pass to existing native VideoFrame constructor.

**Tech Stack:** C++ (video_encoder.cc, async_encode_worker.cc), TypeScript (video-frame.ts, is.ts, types.ts)

---

## Task Group 1: SVC Temporal Layer Tracking (Serial - C++ changes)

### Task 1: Add temporal_layer_count to EncoderMetadataConfig

**Files:**
- Modify: `src/async_encode_worker.h:46-58`

**Step 1: Write failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('SVC temporal layer tracking', () => {
  it('should report temporalLayerId based on scalabilityMode L1T2', async () => {
    const chunks: Array<{ timestamp: number; layerId: number }> = [];

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push({
          timestamp: chunk.timestamp,
          layerId: metadata?.svc?.temporalLayerId ?? -1
        });
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 320,
      height: 240,
      bitrate: 500_000,
      scalabilityMode: 'L1T2',
    });

    for (let i = 0; i < 4; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // L1T2 pattern: [0, 1, 0, 1]
    expect(chunks[0].layerId).toBe(0);
    expect(chunks[1].layerId).toBe(1);
    expect(chunks[2].layerId).toBe(0);
    expect(chunks[3].layerId).toBe(1);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npm run test-unit -- --run -t "L1T2"
```

Expected: FAIL - all layerId values are 0 (hardcoded)

**Step 3: Add field to EncoderMetadataConfig** (2-5 min)

In `src/async_encode_worker.h`, add to the struct:

```cpp
struct EncoderMetadataConfig {
  std::string codec_string;
  int coded_width = 0;
  int coded_height = 0;
  int display_width = 0;
  int display_height = 0;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range = false;
  int temporal_layer_count = 1;  // ADD THIS LINE
};
```

**Step 4: Rebuild** (30 sec)

```bash
npm run build
```

Expected: Build succeeds

**Step 5: Commit** (30 sec)

```bash
git add src/async_encode_worker.h test/golden/video-encoder.test.ts
git commit -m "feat(encoder): add temporal_layer_count to metadata config"
```

---

### Task 2: Add ComputeTemporalLayerId helper and parse scalabilityMode

**Files:**
- Modify: `src/video_encoder.cc`

**Step 1: Add helper function** (2-5 min)

Add in anonymous namespace near top of file (after includes):

```cpp
namespace {

// Compute temporal layer ID based on frame position and layer count.
// Uses standard WebRTC temporal layering pattern.
int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count) {
  if (temporal_layer_count <= 1) return 0;

  if (temporal_layer_count == 2) {
    // L1T2: alternating pattern [0, 1, 0, 1, ...]
    return (frame_index % 2 == 0) ? 0 : 1;
  }

  // L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
  int pos = frame_index % 4;
  if (pos == 0) return 0;      // Base layer
  if (pos == 2) return 1;      // Middle layer
  return 2;                     // Enhancement layer (pos 1, 3)
}

}  // namespace
```

**Step 2: Add member variable to VideoEncoder class** (2-5 min)

In `src/video_encoder.h`, add private member:

```cpp
int temporal_layer_count_ = 1;
```

**Step 3: Parse scalabilityMode in Configure()** (2-5 min)

In `video_encoder.cc` Configure(), after parsing other options:

```cpp
// Parse scalabilityMode to determine temporal layer count
// Format: L{spatial}T{temporal}, e.g., "L1T2", "L1T3", "L2T2"
std::string scalability_mode = webcodecs::AttrAsStr(config, "scalabilityMode", "");
temporal_layer_count_ = 1;  // Default: no temporal layers
if (!scalability_mode.empty()) {
  size_t t_pos = scalability_mode.find('T');
  if (t_pos != std::string::npos && t_pos + 1 < scalability_mode.size()) {
    int t_count = scalability_mode[t_pos + 1] - '0';
    if (t_count >= 1 && t_count <= 3) {
      temporal_layer_count_ = t_count;
    }
  }
}
metadata_config_.temporal_layer_count = temporal_layer_count_;
```

**Step 4: Rebuild** (30 sec)

```bash
npm run build
```

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_encoder.h
git commit -m "feat(encoder): parse scalabilityMode for temporal layer count"
```

---

### Task 3: Use computed layer ID in sync encoding path

**Files:**
- Modify: `src/video_encoder.cc:571-575`

**Step 1: Track frame index** (2-5 min)

Add member variable to VideoEncoder class in `video_encoder.h`:

```cpp
int64_t frame_count_ = 0;
```

In `video_encoder.cc` Encode(), increment after encoding:

```cpp
// After avcodec_send_frame succeeds
frame_count_++;
```

**Step 2: Update EmitChunks to use computed layer** (2-5 min)

Replace hardcoded layer in EmitChunks():

```cpp
// Replace:
// svc.Set("temporalLayerId", Napi::Number::New(env, 0));

// With:
int temporal_layer = ComputeTemporalLayerId(packet_->pts, temporal_layer_count_);
svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
```

**Step 3: Rebuild and test** (30 sec)

```bash
npm run build && npm run test-unit -- --run -t "L1T2"
```

Expected: Test still fails (async path not updated yet)

**Step 4: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_encoder.h
git commit -m "feat(encoder): compute temporal layer ID in sync path"
```

---

### Task 4: Update async encoding path

**Files:**
- Modify: `src/async_encode_worker.cc:231-235`

**Step 1: Add ComputeTemporalLayerId helper** (2-5 min)

Add same helper function in anonymous namespace at top of file:

```cpp
namespace {

int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count) {
  if (temporal_layer_count <= 1) return 0;
  if (temporal_layer_count == 2) {
    return (frame_index % 2 == 0) ? 0 : 1;
  }
  int pos = frame_index % 4;
  if (pos == 0) return 0;
  if (pos == 2) return 1;
  return 2;
}

}  // namespace
```

**Step 2: Update TSFN callback** (2-5 min)

Replace hardcoded layer in EmitChunk callback:

```cpp
// Replace:
// svc.Set("temporalLayerId", Napi::Number::New(env, 0));

// With:
int temporal_layer = ComputeTemporalLayerId(info->pts, info->metadata.temporal_layer_count);
svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
```

**Step 3: Rebuild and test** (30 sec)

```bash
npm run build && npm run test-unit -- --run -t "L1T2"
```

Expected: PASS

**Step 4: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc
git commit -m "feat(encoder): compute temporal layer ID in async path"
```

---

### Task 5: Add comprehensive SVC tests

**Files:**
- Modify: `test/golden/video-encoder.test.ts`

**Step 1: Add L1T3 test** (2-5 min)

```typescript
it('should report temporalLayerId based on scalabilityMode L1T3', async () => {
  const layerIds: number[] = [];

  const encoder = new VideoEncoder({
    output: (_chunk, metadata) => {
      layerIds.push(metadata?.svc?.temporalLayerId ?? -1);
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001f',
    width: 320,
    height: 240,
    bitrate: 500_000,
    scalabilityMode: 'L1T3',
  });

  for (let i = 0; i < 8; i++) {
    const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });
    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  // L1T3 pattern: [0, 2, 1, 2, 0, 2, 1, 2]
  expect(layerIds).toEqual([0, 2, 1, 2, 0, 2, 1, 2]);
});
```

**Step 2: Add no-scalabilityMode test** (2-5 min)

```typescript
it('should report temporalLayerId 0 when scalabilityMode not set', async () => {
  const layerIds: number[] = [];

  const encoder = new VideoEncoder({
    output: (_chunk, metadata) => {
      layerIds.push(metadata?.svc?.temporalLayerId ?? -1);
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001f',
    width: 320,
    height: 240,
    bitrate: 500_000,
    // No scalabilityMode
  });

  for (let i = 0; i < 4; i++) {
    const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });
    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  expect(layerIds.every(id => id === 0)).toBe(true);
});
```

**Step 3: Run all tests** (30 sec)

```bash
npm run test-unit -- --run -t "SVC"
```

Expected: All 3 tests pass

**Step 4: Commit** (30 sec)

```bash
git add test/golden/video-encoder.test.ts
git commit -m "test(encoder): add comprehensive SVC temporal layer tests"
```

---

## Task Group 2: node-canvas Support (Serial - TypeScript changes)

### Task 6: Add isNodeCanvas type guard

**Files:**
- Modify: `lib/is.ts`

**Step 1: Write failing test** (2-5 min)

Add to `test/golden/is.test.ts`:

```typescript
describe('isNodeCanvas', () => {
  it('should detect canvas-like objects', () => {
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: () => ({}),
    };
    expect(is.isNodeCanvas(mockCanvas)).toBe(true);
  });

  it('should reject non-canvas objects', () => {
    expect(is.isNodeCanvas({})).toBe(false);
    expect(is.isNodeCanvas({ width: 100 })).toBe(false);
    expect(is.isNodeCanvas(null)).toBe(false);
    expect(is.isNodeCanvas(Buffer.alloc(100))).toBe(false);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npm run test-unit -- --run -t "isNodeCanvas"
```

Expected: FAIL - isNodeCanvas is not defined

**Step 3: Implement isNodeCanvas** (2-5 min)

Add to `lib/is.ts`:

```typescript
/**
 * Minimal interface for node-canvas Canvas objects.
 * Uses duck typing to avoid hard dependency on canvas package.
 */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasRenderingContext2DLike | null;
}

interface CanvasRenderingContext2DLike {
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike;
}

interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Is this value a node-canvas Canvas object?
 * Uses duck typing to detect canvas-like objects without requiring the canvas package.
 */
export function isNodeCanvas(val: unknown): val is CanvasLike {
  if (!object(val)) return false;
  const canvas = val as Record<string, unknown>;
  return (
    positiveInteger(canvas.width) &&
    positiveInteger(canvas.height) &&
    fn(canvas.getContext)
  );
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
npm run test-unit -- --run -t "isNodeCanvas"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add isNodeCanvas type guard for canvas detection"
```

---

### Task 7: Update types.ts with CanvasLike type

**Files:**
- Modify: `lib/types.ts:1073-1082`

**Step 1: Add CanvasLike export** (2-5 min)

Add near VideoFrameConstructor:

```typescript
/**
 * Minimal Canvas interface for node-canvas support.
 * Uses duck typing - no dependency on @types/canvas.
 */
export interface CanvasLike {
  readonly width: number;
  readonly height: number;
  getContext(contextId: '2d'): {
    getImageData(sx: number, sy: number, sw: number, sh: number): {
      data: Uint8ClampedArray;
      width: number;
      height: number;
    };
  } | null;
}
```

**Step 2: Update VideoFrameConstructor comment** (2-5 min)

```typescript
/**
 * Constructor for VideoFrame
 * WebIDL:
 *   constructor(CanvasImageSource image, optional VideoFrameInit init = {});
 *   constructor(AllowSharedBufferSource data, VideoFrameBufferInit init);
 *
 * Note: CanvasImageSource constructor supported via node-canvas (optional dependency)
 */
export interface VideoFrameConstructor {
  new (image: CanvasLike, init?: VideoFrameInit): VideoFrame;
  new (data: AllowSharedBufferSource, init: VideoFrameBufferInit): VideoFrame;
}
```

**Step 3: Run type check** (30 sec)

```bash
npm run lint-types
```

Expected: PASS

**Step 4: Commit** (30 sec)

```bash
git add lib/types.ts
git commit -m "feat(types): add CanvasLike type for node-canvas support"
```

---

### Task 8: Add canvas support to VideoFrame constructor

**Files:**
- Modify: `lib/video-frame.ts`

**Step 1: Write failing test** (2-5 min)

Add to `test/golden/video-frame-canvas.test.ts` (new file):

```typescript
import { describe, expect, it } from 'vitest';
import { VideoFrame } from '../..';
import * as is from '../../lib/is';

describe('VideoFrame constructor from Canvas', () => {
  describe('type guard', () => {
    it('should detect canvas-like objects', () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          getImageData: () => ({
            data: new Uint8ClampedArray(100 * 100 * 4),
            width: 100,
            height: 100,
          }),
        }),
      };
      expect(is.isNodeCanvas(mockCanvas)).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should create VideoFrame from canvas-like object', () => {
      const mockCanvas = {
        width: 4,
        height: 4,
        getContext: () => ({
          getImageData: () => ({
            data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
            width: 4,
            height: 4,
          }),
        }),
      };

      const frame = new VideoFrame(mockCanvas as any, { timestamp: 1000 });

      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(4);
      expect(frame.codedHeight).toBe(4);
      expect(frame.timestamp).toBe(1000);

      frame.close();
    });

    it('should apply VideoFrameInit overrides', () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          getImageData: () => ({
            data: new Uint8ClampedArray(100 * 100 * 4),
            width: 100,
            height: 100,
          }),
        }),
      };

      const frame = new VideoFrame(mockCanvas as any, {
        timestamp: 1000,
        duration: 5000,
      });

      expect(frame.timestamp).toBe(1000);
      expect(frame.duration).toBe(5000);

      frame.close();
    });

    it('should throw when canvas context is unavailable', () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => null,
      };

      expect(() => new VideoFrame(mockCanvas as any, { timestamp: 0 }))
        .toThrow('Cannot get 2D context');
    });
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npm run test-unit -- --run -t "Canvas"
```

Expected: FAIL - canvas not handled

**Step 3: Implement canvas support in VideoFrame** (2-5 min)

Update `lib/video-frame.ts` constructor:

```typescript
import { isNodeCanvas, type CanvasLike } from './is';

// Update constructor signature to include canvas
constructor(
  dataOrSourceOrCanvas: Buffer | Uint8Array | ArrayBuffer | VideoFrame | CanvasLike,
  init?: VideoFrameBufferInit | VideoFrameInit,
) {
  // Check if constructing from canvas (before VideoFrame check)
  if (isNodeCanvas(dataOrSourceOrCanvas)) {
    const canvas = dataOrSourceOrCanvas;
    const frameInit = init as VideoFrameInit | undefined;

    // Get 2D context and extract pixel data
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new DOMException(
        'Cannot get 2D context from canvas',
        'InvalidStateError',
      );
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dataBuffer = Buffer.from(imageData.data.buffer);

    // Build VideoFrameBufferInit from canvas dimensions
    const bufferInit: VideoFrameBufferInit = {
      format: 'RGBA',
      codedWidth: canvas.width,
      codedHeight: canvas.height,
      timestamp: frameInit?.timestamp ?? 0,
      duration: frameInit?.duration,
      visibleRect: frameInit?.visibleRect,
      displayWidth: frameInit?.displayWidth ?? canvas.width,
      displayHeight: frameInit?.displayHeight ?? canvas.height,
      metadata: frameInit?.metadata,
    };

    this._native = new native.VideoFrame(dataBuffer, bufferInit);
    this._metadata = bufferInit.metadata ?? {};
    this._closed = false;
    return;
  }

  // Existing code for VideoFrame and buffer sources...
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
npm run test-unit -- --run -t "Canvas"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/video-frame.ts test/golden/video-frame-canvas.test.ts
git commit -m "feat(video-frame): add node-canvas support to constructor"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `lib/index.ts:1-13`

**Step 1: Update header documentation** (2-5 min)

Update the module header:

```typescript
/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * W3C WebCodecs Specification Compliance Notes:
 * - VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder extend EventTarget via CodecBase
 * - VideoFrame visibleRect cropping implemented in native layer
 * - ArrayBuffer transfer semantics implemented (uses structuredClone with transfer)
 * - High bit-depth pixel formats for VideoFrame (I420P10, I420P12, etc.)
 *   Note: VideoEncoder input format conversion does not yet support high bit-depth formats
 * - NV21 pixel format supported (8-bit YUV420 semi-planar with VU ordering)
 * - VideoFrame constructor from CanvasImageSource supported via node-canvas (optional)
 *   Alternative: Use ImageDecoder to decode JPEG/PNG/WebP/GIF directly to VideoFrame
 * - 10-bit alpha formats (I420AP10, I422AP10, I444AP10) supported
 * - SVC temporal layer tracking via scalabilityMode (L1T1, L1T2, L1T3)
 */
```

**Step 2: Run lint** (30 sec)

```bash
npm run lint
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
git add lib/index.ts
git commit -m "docs: update module header with canvas and SVC support"
```

---

### Task 10: Code Review

**Files:**
- All modified files from Tasks 1-9

**Step 1: Run full test suite** (2-5 min)

```bash
npm test
```

Expected: All tests pass

**Step 2: Run lint** (30 sec)

```bash
npm run lint
```

Expected: No warnings or errors

**Step 3: Review changes** (2-5 min)

```bash
git diff main..HEAD --stat
git log --oneline main..HEAD
```

Verify:
- No unintended changes
- Commit messages are conventional
- No debug code left

**Step 4: Final commit if needed** (30 sec)

If any cleanup needed, commit with appropriate message.

---

## Parallel Groups Summary

| Group | Tasks | Files Modified | Can Parallelize |
|-------|-------|----------------|-----------------|
| 1 | 1-5 | C++ encoder files | Serial (C++ rebuild) |
| 2 | 6-9 | TypeScript lib files | Serial (dependent) |
| 3 | 10 | Review | After 1-2 |

---

## Removed TODOs After Implementation

1. `src/video_encoder.cc:571` - RESOLVED: Now computes actual layer ID
2. `src/async_encode_worker.cc:231` - RESOLVED: Now computes actual layer ID
3. `lib/index.ts:11` - UPDATED: Changed from "not supported" to "supported via node-canvas"
4. `lib/types.ts:1080` - UPDATED: Added canvas constructor overload
