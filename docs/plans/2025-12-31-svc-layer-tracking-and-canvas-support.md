# SVC Layer Tracking and ImageData Support Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-svc-layer-tracking-and-canvas-support.md` to implement task-by-task.

**Goal:** Implement actual temporal layer tracking for SVC video encoding and add ImageData support for VideoFrame constructor (enabling canvas integration).

**Architecture:**
- SVC: Frame-position-based layer computation since FFmpeg doesn't expose temporal layer IDs in packet output. Parse `scalabilityMode` during configure, compute layer ID at emit time.
- ImageData: Accept ImageData objects (from `canvas.getImageData()`) directly in VideoFrame constructor. This follows sharp's pattern of NOT wrapping Canvas directly - users extract ImageData themselves, which is cleaner and more portable.

**Tech Stack:** C++ (video_encoder.cc, async_encode_worker.cc), TypeScript (video-frame.ts, is.ts, types.ts)

**Design Insight from sharp library:**
Sharp accepts raw pixel buffers with `{ width, height, channels }` metadata and auto-detects bit depth from TypedArray type. Similarly, ImageData already contains `width`, `height`, and `data` (Uint8ClampedArray), making it self-describing. This is cleaner than accepting Canvas objects and calling getContext/getImageData internally.

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

## Task Group 2: ImageData Support (Serial - TypeScript changes)

> **Design pattern from sharp:** Accept ImageData directly rather than Canvas objects.
> Users call `canvas.getContext('2d').getImageData()` themselves - this is cleaner
> because ImageData is self-describing (has width, height, data).

### Task 6: Add isImageData type guard

**Files:**
- Modify: `lib/is.ts`

**Step 1: Write failing test** (2-5 min)

Add to `test/golden/is.test.ts`:

```typescript
describe('isImageData', () => {
  it('should detect ImageData-like objects', () => {
    const mockImageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4),
    };
    expect(is.isImageData(mockImageData)).toBe(true);
  });

  it('should reject non-ImageData objects', () => {
    expect(is.isImageData({})).toBe(false);
    expect(is.isImageData({ width: 100, height: 100 })).toBe(false);
    expect(is.isImageData({ data: new Uint8Array(100) })).toBe(false);
    expect(is.isImageData(null)).toBe(false);
    expect(is.isImageData(Buffer.alloc(100))).toBe(false);
  });

  it('should require Uint8ClampedArray for data', () => {
    const wrongType = {
      width: 10,
      height: 10,
      data: new Uint8Array(400), // Wrong type - should be Uint8ClampedArray
    };
    expect(is.isImageData(wrongType)).toBe(false);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npm run test-unit -- --run -t "isImageData"
```

Expected: FAIL - isImageData is not defined

**Step 3: Implement isImageData** (2-5 min)

Add to `lib/is.ts`:

```typescript
/**
 * ImageData-like interface (from canvas.getContext('2d').getImageData()).
 * Self-describing: contains width, height, and RGBA pixel data.
 */
export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Is this value an ImageData object (from canvas.getImageData)?
 * ImageData is self-describing: contains width, height, and Uint8ClampedArray data.
 * This follows sharp's pattern of accepting self-describing pixel buffers.
 */
export function isImageData(val: unknown): val is ImageDataLike {
  if (!object(val)) return false;
  const img = val as Record<string, unknown>;
  return (
    positiveInteger(img.width) &&
    positiveInteger(img.height) &&
    img.data instanceof Uint8ClampedArray
  );
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
npm run test-unit -- --run -t "isImageData"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add isImageData type guard for canvas ImageData detection"
```

---

### Task 7: Update types.ts with ImageDataLike type

**Files:**
- Modify: `lib/types.ts:1073-1082`

**Step 1: Add ImageDataLike export** (2-5 min)

Add near VideoFrameConstructor:

```typescript
/**
 * ImageData interface for canvas integration.
 * Matches the return type of canvas.getContext('2d').getImageData().
 * Self-describing: contains width, height, and RGBA pixel data.
 *
 * Usage:
 *   const ctx = canvas.getContext('2d');
 *   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
 *   const frame = new VideoFrame(imageData, { timestamp: 0 });
 */
export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}
```

**Step 2: Update VideoFrameConstructor** (2-5 min)

```typescript
/**
 * Constructor for VideoFrame
 * WebIDL:
 *   constructor(CanvasImageSource image, optional VideoFrameInit init = {});
 *   constructor(AllowSharedBufferSource data, VideoFrameBufferInit init);
 *
 * Node.js implementation:
 *   - ImageData from canvas.getImageData() is supported (self-describing RGBA)
 *   - Raw buffer with VideoFrameBufferInit for other formats
 *   - VideoFrame cloning with optional overrides
 */
export interface VideoFrameConstructor {
  new (imageData: ImageDataLike, init?: VideoFrameInit): VideoFrame;
  new (data: AllowSharedBufferSource, init: VideoFrameBufferInit): VideoFrame;
  new (source: VideoFrame, init?: VideoFrameInit): VideoFrame;
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
git commit -m "feat(types): add ImageDataLike type for canvas integration"
```

---

### Task 8: Add ImageData support to VideoFrame constructor

> **W3C Compliance Note:** The W3C spec defines `CanvasImageSource` which includes
> HTMLCanvasElement, HTMLVideoElement, ImageBitmap, etc. - these don't exist in Node.js.
> ImageData is the underlying pixel data format that CanvasImageSource elements provide.
> By accepting ImageData, we provide equivalent functionality for Node.js users who can
> obtain ImageData from node-canvas via `ctx.getImageData()`. This is a practical
> Node.js extension that maintains the spirit of the W3C spec.

**Files:**
- Modify: `lib/video-frame.ts`
- Create: `test/golden/video-frame-imagedata.test.ts`

**Step 1: Write failing test** (2-5 min)

Create `test/golden/video-frame-imagedata.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { VideoFrame } from '../..';
import * as is from '../../lib/is';

describe('VideoFrame constructor from ImageData', () => {
  describe('type guard', () => {
    it('should detect ImageData-like objects', () => {
      const imageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };
      expect(is.isImageData(imageData)).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should create VideoFrame from ImageData', () => {
      // Simulate canvas.getContext('2d').getImageData() result
      const imageData = {
        width: 4,
        height: 4,
        data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
      };

      const frame = new VideoFrame(imageData, { timestamp: 1000 });

      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(4);
      expect(frame.codedHeight).toBe(4);
      expect(frame.timestamp).toBe(1000);

      frame.close();
    });

    it('should apply VideoFrameInit overrides', () => {
      const imageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };

      const frame = new VideoFrame(imageData, {
        timestamp: 1000,
        duration: 5000,
      });

      expect(frame.timestamp).toBe(1000);
      expect(frame.duration).toBe(5000);

      frame.close();
    });

    it('should support visibleRect cropping', () => {
      const imageData = {
        width: 200,
        height: 200,
        data: new Uint8ClampedArray(200 * 200 * 4),
      };

      const frame = new VideoFrame(imageData, {
        timestamp: 0,
        visibleRect: { x: 50, y: 50, width: 100, height: 100 },
      });

      expect(frame.visibleRect?.x).toBe(50);
      expect(frame.visibleRect?.width).toBe(100);

      frame.close();
    });

    it('should validate ImageData has correct data size', () => {
      const badImageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(10), // Wrong size!
      };

      expect(() => new VideoFrame(badImageData, { timestamp: 0 }))
        .toThrow();
    });
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npm run test-unit -- --run -t "ImageData"
```

Expected: FAIL - ImageData not handled in constructor

**Step 3: Implement ImageData support in VideoFrame** (2-5 min)

Update `lib/video-frame.ts` constructor:

```typescript
import { isImageData, type ImageDataLike } from './is';

// Update constructor signature to include ImageData
constructor(
  dataOrSourceOrImageData: Buffer | Uint8Array | ArrayBuffer | VideoFrame | ImageDataLike,
  init?: VideoFrameBufferInit | VideoFrameInit,
) {
  // Check if constructing from ImageData (self-describing RGBA)
  if (isImageData(dataOrSourceOrImageData)) {
    const imageData = dataOrSourceOrImageData;
    const frameInit = init as VideoFrameInit | undefined;

    // Validate data size matches dimensions
    const expectedSize = imageData.width * imageData.height * 4;
    if (imageData.data.length !== expectedSize) {
      throw new TypeError(
        `ImageData.data length (${imageData.data.length}) does not match ` +
        `expected size (${expectedSize}) for ${imageData.width}x${imageData.height} RGBA`
      );
    }

    // Convert Uint8ClampedArray to Buffer for native binding
    const dataBuffer = Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);

    // Build VideoFrameBufferInit from ImageData dimensions
    // ImageData is always RGBA format from canvas
    const bufferInit: VideoFrameBufferInit = {
      format: 'RGBA',
      codedWidth: imageData.width,
      codedHeight: imageData.height,
      timestamp: frameInit?.timestamp ?? 0,
      duration: frameInit?.duration,
      visibleRect: frameInit?.visibleRect,
      displayWidth: frameInit?.displayWidth ?? imageData.width,
      displayHeight: frameInit?.displayHeight ?? imageData.height,
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
npm run test-unit -- --run -t "ImageData"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/video-frame.ts test/golden/video-frame-imagedata.test.ts
git commit -m "feat(video-frame): add ImageData support for canvas integration"
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
 * - VideoFrame constructor accepts ImageData (from canvas.getImageData()) - Node.js extension
 *   Usage: const frame = new VideoFrame(ctx.getImageData(0, 0, w, h), { timestamp: 0 })
 * - ImageDecoder decodes JPEG/PNG/WebP/GIF directly to VideoFrame
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
git commit -m "docs: update module header with ImageData and SVC support"
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

1. `src/video_encoder.cc:571` - RESOLVED: Now computes actual temporal layer ID based on scalabilityMode
2. `src/async_encode_worker.cc:231` - RESOLVED: Now computes actual temporal layer ID based on scalabilityMode
3. `lib/index.ts:11` - UPDATED: Changed from "not supported" to "ImageData support via canvas.getImageData()"
4. `lib/types.ts:1080` - UPDATED: Added ImageDataLike constructor overload for W3C CanvasImageSource equivalent

## W3C Compliance Summary

| W3C Feature | Implementation | Status |
|-------------|----------------|--------|
| `VideoFrame(CanvasImageSource)` | `VideoFrame(ImageData)` | Node.js equivalent - ImageData is what CanvasImageSource provides |
| `SvcOutputMetadata.temporalLayerId` | Computed from frame position + scalabilityMode | Compliant |
| `scalabilityMode` parsing | L1T1, L1T2, L1T3 supported | Compliant |
| Buffer-based construction | `VideoFrame(buffer, init)` | Compliant |
| VideoFrame cloning | `VideoFrame(frame, init)` | Compliant |
