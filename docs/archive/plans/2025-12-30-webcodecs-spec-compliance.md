# WebCodecs W3C Spec Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-webcodecs-spec-compliance.md` to implement task-by-task.

**Goal:** Close remaining gaps between node-webcodecs and W3C WebCodecs specification using minimal, pragmatic changes suitable for server-side Node.js usage.

**Architecture:** Extend existing TypeScript type definitions for color space enums, add NV21 pixel format support in native layer, implement VideoFrame.metadata() with timestamp fields, and add high bit-depth alpha pixel formats. All changes follow the existing two-layer architecture (TypeScript API + C++ native bindings).

**Tech Stack:** TypeScript, C++17, node-addon-api (NAPI), FFmpeg (libavcodec, libavutil, libswscale)

---

## Task Parallelization

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Independent type-only changes to lib/types.ts sections |
| Group 2 | 4 | NV21 requires native layer changes |
| Group 3 | 5 | VideoFrame.metadata() is independent feature |
| Group 4 | 6 | High bit-depth alpha formats require native layer |
| Group 5 | 7 | Integration tests depend on all above |
| Group 6 | 8 | Code review after all implementation |

---

### Task 1: Extend VideoColorPrimaries enum

**Files:**
- Modify: `lib/types.ts:168-173`
- Test: `test/golden/types-color-space.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

Create test file to verify all VideoColorPrimaries values are valid:

```typescript
// test/golden/types-color-space.test.ts
import {describe, it, expect} from 'vitest';
import type {VideoColorPrimaries} from '../../lib/types.js';

describe('VideoColorPrimaries', () => {
  it('should support all W3C spec values', () => {
    const validPrimaries: VideoColorPrimaries[] = [
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020',
      'smpte432',
      // New values from W3C spec
      'srgb',
      'bt470m',
      'smpte240m',
      'film',
      'xyz',
      'smpte431',
    ];
    expect(validPrimaries).toHaveLength(11);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoColorPrimaries"
```

Expected: FAIL with TypeScript error - `'srgb'` and other new values not assignable to type `VideoColorPrimaries`

**Step 3: Write minimal implementation** (2-5 min)

Edit `lib/types.ts` lines 168-173 to add missing values:

```typescript
export type VideoColorPrimaries =
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020'
  | 'smpte432'
  | 'srgb'
  | 'bt470m'
  | 'smpte240m'
  | 'film'
  | 'xyz'
  | 'smpte431';
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoColorPrimaries"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/types-color-space.test.ts
git commit -m "feat(types): extend VideoColorPrimaries with W3C spec values"
```

---

### Task 2: Extend VideoTransferCharacteristics enum

**Files:**
- Modify: `lib/types.ts:179-185`
- Test: `test/golden/types-color-space.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/types-color-space.test.ts`:

```typescript
import type {VideoTransferCharacteristics} from '../../lib/types.js';

describe('VideoTransferCharacteristics', () => {
  it('should support all W3C spec values', () => {
    const validTransfer: VideoTransferCharacteristics[] = [
      'bt709',
      'smpte170m',
      'iec61966-2-1',
      'linear',
      'pq',
      'hlg',
      // New values from W3C spec
      'gamma22curve',
      'gamma28curve',
      'smpte240m',
      'log',
      'logrt',
      'iec61966-2-4',
      'bt1361',
      'bt2020-10bit',
      'bt2020-12bit',
      'smpte2084',
      'smpte428',
      'arib-std-b67',
    ];
    expect(validTransfer).toHaveLength(18);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoTransferCharacteristics"
```

Expected: FAIL with TypeScript error - new values not assignable

**Step 3: Write minimal implementation** (2-5 min)

Edit `lib/types.ts` lines 179-185:

```typescript
export type VideoTransferCharacteristics =
  | 'bt709'
  | 'smpte170m'
  | 'iec61966-2-1'
  | 'linear'
  | 'pq'
  | 'hlg'
  | 'gamma22curve'
  | 'gamma28curve'
  | 'smpte240m'
  | 'log'
  | 'logrt'
  | 'iec61966-2-4'
  | 'bt1361'
  | 'bt2020-10bit'
  | 'bt2020-12bit'
  | 'smpte2084'
  | 'smpte428'
  | 'arib-std-b67';
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoTransferCharacteristics"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/types-color-space.test.ts
git commit -m "feat(types): extend VideoTransferCharacteristics with W3C spec values"
```

---

### Task 3: Extend VideoMatrixCoefficients enum

**Files:**
- Modify: `lib/types.ts:191-196`
- Test: `test/golden/types-color-space.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/types-color-space.test.ts`:

```typescript
import type {VideoMatrixCoefficients} from '../../lib/types.js';

describe('VideoMatrixCoefficients', () => {
  it('should support all W3C spec values', () => {
    const validMatrix: VideoMatrixCoefficients[] = [
      'rgb',
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020-ncl',
      // New values from W3C spec
      'smpte240m',
      'bt2020-cl',
      'smpte2085',
    ];
    expect(validMatrix).toHaveLength(8);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoMatrixCoefficients"
```

Expected: FAIL with TypeScript error - new values not assignable

**Step 3: Write minimal implementation** (2-5 min)

Edit `lib/types.ts` lines 191-196:

```typescript
export type VideoMatrixCoefficients =
  | 'rgb'
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020-ncl'
  | 'smpte240m'
  | 'bt2020-cl'
  | 'smpte2085';
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/types-color-space.test.ts -t "VideoMatrixCoefficients"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/types-color-space.test.ts
git commit -m "feat(types): extend VideoMatrixCoefficients with W3C spec values"
```

---

### Task 4: Add NV21 pixel format support

**Files:**
- Modify: `lib/types.ts:145-163` (VideoPixelFormat)
- Modify: `src/video_frame.cc` (native pixel format handling)
- Modify: `src/video_frame.h` (format enum if needed)
- Test: `test/golden/video-frame-nv21.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-nv21.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('VideoFrame NV21 format', () => {
  it('should create VideoFrame with NV21 format', () => {
    // NV21 is like NV12 but with V and U planes swapped
    // For a 4x4 frame: Y plane = 16 bytes, VU plane = 8 bytes (interleaved)
    const width = 4;
    const height = 4;
    const yPlaneSize = width * height; // 16
    const vuPlaneSize = (width / 2) * (height / 2) * 2; // 8 (interleaved V, U)
    const totalSize = yPlaneSize + vuPlaneSize; // 24

    const data = new Uint8Array(totalSize);
    // Fill Y plane with luma values
    for (let i = 0; i < yPlaneSize; i++) {
      data[i] = 128; // mid-gray
    }
    // Fill VU plane (V first, then U, interleaved)
    for (let i = yPlaneSize; i < totalSize; i += 2) {
      data[i] = 128; // V
      data[i + 1] = 128; // U
    }

    const frame = new VideoFrame(data, {
      format: 'NV21',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.format).toBe('NV21');
    expect(frame.codedWidth).toBe(width);
    expect(frame.codedHeight).toBe(height);

    frame.close();
  });

  it('should calculate correct allocationSize for NV21', () => {
    const width = 1920;
    const height = 1080;
    // NV21 same size as NV12: Y + interleaved VU
    const expectedSize = width * height + (width * height) / 2;

    const data = new Uint8Array(expectedSize);
    const frame = new VideoFrame(data, {
      format: 'NV21',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.allocationSize()).toBe(expectedSize);

    frame.close();
  });

  it('should copyTo buffer with NV21 format', async () => {
    const width = 4;
    const height = 4;
    const totalSize = width * height + (width * height) / 2;

    const sourceData = new Uint8Array(totalSize);
    for (let i = 0; i < totalSize; i++) {
      sourceData[i] = i % 256;
    }

    const frame = new VideoFrame(sourceData, {
      format: 'NV21',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    const destBuffer = new Uint8Array(frame.allocationSize());
    await frame.copyTo(destBuffer);

    // Verify Y plane data matches
    for (let i = 0; i < width * height; i++) {
      expect(destBuffer[i]).toBe(sourceData[i]);
    }

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-nv21.test.ts
```

Expected: FAIL with error about invalid format 'NV21'

**Step 3: Add NV21 to TypeScript types** (2-5 min)

Edit `lib/types.ts` around line 145, add `'NV21'` to VideoPixelFormat:

```typescript
export type VideoPixelFormat =
  | 'I420'
  | 'I420A'
  | 'I422'
  | 'I444'
  | 'NV12'
  | 'NV21'  // Add this line
  | 'RGBA'
  | 'RGBX'
  | 'BGRA'
  | 'BGRX'
  // ... high bit-depth formats
```

**Step 4: Add NV21 to native layer format mapping** (2-5 min)

Edit `src/video_frame.cc`, find the format string to AVPixelFormat mapping and add NV21:

In the `StringToPixelFormat` function (or equivalent), add:

```cpp
if (format == "NV21") return AV_PIX_FMT_NV21;
```

And in `PixelFormatToString` (or equivalent), add:

```cpp
case AV_PIX_FMT_NV21: return "NV21";
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-nv21.test.ts
```

Expected: PASS (3 passed)

**Step 6: Commit** (30 sec)

```bash
git add lib/types.ts src/video_frame.cc src/video_frame.h test/golden/video-frame-nv21.test.ts
git commit -m "feat(video-frame): add NV21 pixel format support"
```

---

### Task 5: Implement VideoFrame.metadata() with timestamp fields

**Files:**
- Modify: `lib/types.ts` (add VideoFrameMetadata interface)
- Modify: `lib/index.ts:296-298` (VideoFrame.metadata() method)
- Test: `test/golden/video-frame-metadata.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-metadata.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('VideoFrame.metadata()', () => {
  it('should return VideoFrameMetadata object', () => {
    const data = new Uint8Array(4 * 4 * 4); // 4x4 RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    const metadata = frame.metadata();

    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe('object');

    frame.close();
  });

  it('should include captureTime when provided in init', () => {
    const captureTime = 12345.67;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime,
      },
    });

    const metadata = frame.metadata();

    expect(metadata.captureTime).toBe(captureTime);

    frame.close();
  });

  it('should include receiveTime when provided in init', () => {
    const receiveTime = 98765.43;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        receiveTime,
      },
    });

    const metadata = frame.metadata();

    expect(metadata.receiveTime).toBe(receiveTime);

    frame.close();
  });

  it('should include rtpTimestamp when provided in init', () => {
    const rtpTimestamp = 3000000;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        rtpTimestamp,
      },
    });

    const metadata = frame.metadata();

    expect(metadata.rtpTimestamp).toBe(rtpTimestamp);

    frame.close();
  });

  it('should preserve metadata through clone()', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime: 111.11,
        receiveTime: 222.22,
        rtpTimestamp: 333333,
      },
    });

    const cloned = frame.clone();
    const metadata = cloned.metadata();

    expect(metadata.captureTime).toBe(111.11);
    expect(metadata.receiveTime).toBe(222.22);
    expect(metadata.rtpTimestamp).toBe(333333);

    frame.close();
    cloned.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-metadata.test.ts
```

Expected: FAIL - metadata not supported in init, metadata() returns empty object

**Step 3: Add VideoFrameMetadata interface to types** (2-5 min)

Edit `lib/types.ts`, add after VideoColorSpace interface (around line 210):

```typescript
/**
 * Metadata associated with a VideoFrame per W3C VideoFrame Metadata Registry.
 * @see https://www.w3.org/TR/webcodecs-video-frame-metadata-registry/
 */
export interface VideoFrameMetadata {
  /**
   * The time at which the frame was captured, in microseconds.
   */
  captureTime?: number;
  /**
   * The time at which the frame was received, in microseconds.
   */
  receiveTime?: number;
  /**
   * The RTP timestamp associated with this frame.
   */
  rtpTimestamp?: number;
}
```

**Step 4: Add metadata to VideoFrameInit and VideoFrameBufferInit** (2-5 min)

Edit `lib/types.ts`, find VideoFrameInit (around line 290) and add:

```typescript
export interface VideoFrameInit {
  // ... existing properties
  metadata?: VideoFrameMetadata;
}
```

And in VideoFrameBufferInit (around line 305):

```typescript
export interface VideoFrameBufferInit {
  // ... existing properties
  metadata?: VideoFrameMetadata;
}
```

**Step 5: Implement metadata storage and retrieval in VideoFrame class** (2-5 min)

Edit `lib/index.ts`, in the VideoFrame class:

1. Add private field after line 149:
```typescript
private _metadata: VideoFrameMetadata;
```

2. In constructor (around line 160), store metadata:
```typescript
this._metadata = init.metadata ?? {};
```

3. Replace the metadata() method (around line 296-298):
```typescript
metadata(): VideoFrameMetadata {
  return {...this._metadata};
}
```

4. In clone() method, preserve metadata:
```typescript
// In the clone() method, pass metadata to the new frame
```

**Step 6: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-metadata.test.ts
```

Expected: PASS (5 passed)

**Step 7: Commit** (30 sec)

```bash
git add lib/types.ts lib/index.ts test/golden/video-frame-metadata.test.ts
git commit -m "feat(video-frame): implement metadata() with W3C registry fields"
```

---

### Task 6: Add high bit-depth alpha pixel format support

**Files:**
- Modify: `src/video_frame.cc` (native format handling)
- Test: `test/golden/video-frame-high-bit-depth-alpha.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-high-bit-depth-alpha.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('VideoFrame high bit-depth alpha formats', () => {
  // I420AP10: 10-bit I420 with alpha plane
  describe('I420AP10', () => {
    it('should create VideoFrame with I420AP10 format', () => {
      const width = 4;
      const height = 4;
      // 10-bit uses 2 bytes per sample
      // I420AP10: Y (w*h*2) + U (w/2*h/2*2) + V (w/2*h/2*2) + A (w*h*2)
      const ySize = width * height * 2;
      const uvSize = (width / 2) * (height / 2) * 2;
      const aSize = width * height * 2;
      const totalSize = ySize + uvSize + uvSize + aSize;

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I420AP10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I420AP10');
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);

      frame.close();
    });
  });

  // I420AP12: 12-bit I420 with alpha plane
  describe('I420AP12', () => {
    it('should create VideoFrame with I420AP12 format', () => {
      const width = 4;
      const height = 4;
      const ySize = width * height * 2;
      const uvSize = (width / 2) * (height / 2) * 2;
      const aSize = width * height * 2;
      const totalSize = ySize + uvSize + uvSize + aSize;

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I420AP12',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I420AP12');
      frame.close();
    });
  });

  // I422AP10: 10-bit I422 with alpha plane
  describe('I422AP10', () => {
    it('should create VideoFrame with I422AP10 format', () => {
      const width = 4;
      const height = 4;
      // I422: U and V are half width, full height
      const ySize = width * height * 2;
      const uvSize = (width / 2) * height * 2;
      const aSize = width * height * 2;
      const totalSize = ySize + uvSize + uvSize + aSize;

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I422AP10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I422AP10');
      frame.close();
    });
  });

  // I422AP12: 12-bit I422 with alpha plane
  describe('I422AP12', () => {
    it('should create VideoFrame with I422AP12 format', () => {
      const width = 4;
      const height = 4;
      const ySize = width * height * 2;
      const uvSize = (width / 2) * height * 2;
      const aSize = width * height * 2;
      const totalSize = ySize + uvSize + uvSize + aSize;

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I422AP12',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I422AP12');
      frame.close();
    });
  });

  // I444AP10: 10-bit I444 with alpha plane
  describe('I444AP10', () => {
    it('should create VideoFrame with I444AP10 format', () => {
      const width = 4;
      const height = 4;
      // I444: all planes full resolution
      const planeSize = width * height * 2;
      const totalSize = planeSize * 4; // Y, U, V, A

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I444AP10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I444AP10');
      frame.close();
    });
  });

  // I444AP12: 12-bit I444 with alpha plane
  describe('I444AP12', () => {
    it('should create VideoFrame with I444AP12 format', () => {
      const width = 4;
      const height = 4;
      const planeSize = width * height * 2;
      const totalSize = planeSize * 4;

      const data = new Uint8Array(totalSize);
      const frame = new VideoFrame(data, {
        format: 'I444AP12',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I444AP12');
      frame.close();
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth-alpha.test.ts
```

Expected: FAIL - formats not recognized in native layer

**Step 3: Add alpha format mappings to native layer** (2-5 min)

Edit `src/video_frame.cc`, in the format mapping functions:

For `StringToPixelFormat`:
```cpp
// High bit-depth alpha formats
if (format == "I420AP10") return AV_PIX_FMT_YUVA420P10LE;
if (format == "I420AP12") return AV_PIX_FMT_YUVA420P12LE;
if (format == "I422AP10") return AV_PIX_FMT_YUVA422P10LE;
if (format == "I422AP12") return AV_PIX_FMT_YUVA422P12LE;
if (format == "I444AP10") return AV_PIX_FMT_YUVA444P10LE;
if (format == "I444AP12") return AV_PIX_FMT_YUVA444P12LE;
```

For `PixelFormatToString`:
```cpp
case AV_PIX_FMT_YUVA420P10LE: return "I420AP10";
case AV_PIX_FMT_YUVA420P12LE: return "I420AP12";
case AV_PIX_FMT_YUVA422P10LE: return "I422AP10";
case AV_PIX_FMT_YUVA422P12LE: return "I422AP12";
case AV_PIX_FMT_YUVA444P10LE: return "I444AP10";
case AV_PIX_FMT_YUVA444P12LE: return "I444AP12";
```

**Step 4: Add allocation size calculations for alpha formats** (2-5 min)

In `src/video_frame.cc`, find the `GetAllocationSize` or similar function and add cases for the alpha formats. Each alpha format is the base format size plus an alpha plane of Y-plane size.

**Step 5: Rebuild native module** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 6: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth-alpha.test.ts
```

Expected: PASS (6 passed)

**Step 7: Commit** (30 sec)

```bash
git add src/video_frame.cc src/video_frame.h test/golden/video-frame-high-bit-depth-alpha.test.ts
git commit -m "feat(video-frame): add high bit-depth alpha pixel format support (I420AP10/12, I422AP10/12, I444AP10/12)"
```

---

### Task 7: Update TODO.md and add integration tests

**Files:**
- Modify: `TODO.md`
- Test: `test/golden/webcodecs-spec-compliance.test.ts` (create)

**Step 1: Create comprehensive spec compliance test** (2-5 min)

Create `test/golden/webcodecs-spec-compliance.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';
import type {
  VideoColorPrimaries,
  VideoTransferCharacteristics,
  VideoMatrixCoefficients,
  VideoPixelFormat,
} from '../../lib/types.js';

describe('W3C WebCodecs Spec Compliance', () => {
  describe('VideoColorPrimaries', () => {
    it('should include all 11 W3C spec values', () => {
      const allPrimaries: VideoColorPrimaries[] = [
        'bt709', 'bt470bg', 'smpte170m', 'bt2020', 'smpte432',
        'srgb', 'bt470m', 'smpte240m', 'film', 'xyz', 'smpte431',
      ];
      expect(allPrimaries).toHaveLength(11);
    });
  });

  describe('VideoTransferCharacteristics', () => {
    it('should include all 18 W3C spec values', () => {
      const allTransfer: VideoTransferCharacteristics[] = [
        'bt709', 'smpte170m', 'iec61966-2-1', 'linear', 'pq', 'hlg',
        'gamma22curve', 'gamma28curve', 'smpte240m', 'log', 'logrt',
        'iec61966-2-4', 'bt1361', 'bt2020-10bit', 'bt2020-12bit',
        'smpte2084', 'smpte428', 'arib-std-b67',
      ];
      expect(allTransfer).toHaveLength(18);
    });
  });

  describe('VideoMatrixCoefficients', () => {
    it('should include all 8 W3C spec values', () => {
      const allMatrix: VideoMatrixCoefficients[] = [
        'rgb', 'bt709', 'bt470bg', 'smpte170m', 'bt2020-ncl',
        'smpte240m', 'bt2020-cl', 'smpte2085',
      ];
      expect(allMatrix).toHaveLength(8);
    });
  });

  describe('VideoPixelFormat', () => {
    it('should include NV21 format', () => {
      const formats: VideoPixelFormat[] = ['NV12', 'NV21'];
      expect(formats).toContain('NV21');
    });

    it('should include high bit-depth alpha formats', () => {
      const alphaFormats: VideoPixelFormat[] = [
        'I420AP10', 'I420AP12',
        'I422AP10', 'I422AP12',
        'I444AP10', 'I444AP12',
      ];
      expect(alphaFormats).toHaveLength(6);
    });
  });

  describe('VideoFrame.metadata()', () => {
    it('should return metadata object with timestamp fields', () => {
      const data = new Uint8Array(64);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 0,
        metadata: {
          captureTime: 100,
          receiveTime: 200,
          rtpTimestamp: 300,
        },
      });

      const metadata = frame.metadata();
      expect(metadata.captureTime).toBe(100);
      expect(metadata.receiveTime).toBe(200);
      expect(metadata.rtpTimestamp).toBe(300);

      frame.close();
    });
  });
});
```

**Step 2: Run integration test** (30 sec)

```bash
npx vitest run test/golden/webcodecs-spec-compliance.test.ts
```

Expected: PASS (all tests pass)

**Step 3: Update TODO.md** (2-5 min)

Edit `TODO.md` to mark completed items and note remaining browser-specific limitations:

```markdown
# TODO

## Native Layer - Audio (`src/audio_data.cc`)

- [x] Handle options for partial copy or format conversion (line 224) - DONE
- [x] Handle options for planeIndex, frameOffset, frameCount, format (line 243) - DONE

## Native Layer - Video (`src/video_decoder.cc`)

- [x] Implement proper queue size tracking (line 266) - DONE (also AudioEncoder, AudioDecoder)

## TypeScript (`src/index.ts`)

- [ ] Add more examples (line 26)

## Library (`lib/index.ts`)

- [ ] W3C spec requires VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder (line 5)
- [ ] VideoFrame constructor from CanvasImageSource not supported - Node.js limitation (line 7)
- [x] visibleRect cropping not fully implemented in native layer (line 8) - DONE
- [x] ArrayBuffer transfer semantics not implemented (line 9) - DONE
- [x] High bit-depth pixel formats (P10/P12 variants) not supported in native layer (line 10) - DONE
- [x] High bit-depth alpha pixel formats (I420AP10, I422AP10, I444AP10, etc.) - DONE

## Types (`lib/types.ts`)

- [x] EventTarget inheritance not implemented for VideoEncoder (line 805) - DONE
- [x] EventTarget inheritance not implemented for VideoDecoder (line 830) - DONE
- [x] EventTarget inheritance not implemented for AudioEncoder (line 855) - DONE
- [x] EventTarget inheritance not implemented for AudioDecoder (line 880) - DONE
- [ ] CanvasImageSource constructor not supported in Node.js (line 933)
- [x] VideoColorPrimaries extended with all W3C spec values - DONE
- [x] VideoTransferCharacteristics extended with all W3C spec values - DONE
- [x] VideoMatrixCoefficients extended with all W3C spec values - DONE
- [x] NV21 pixel format added - DONE
- [x] VideoFrame.metadata() implemented with W3C registry fields - DONE

## Known Limitations (Node.js specific)

- VideoFrame from CanvasImageSource (HTMLVideoElement, HTMLCanvasElement, etc.) cannot be supported in Node.js
- Browser-specific metadata fields (segments, backgroundBlur, backgroundSegmentationMask) not implemented
```

**Step 4: Commit** (30 sec)

```bash
git add TODO.md test/golden/webcodecs-spec-compliance.test.ts
git commit -m "docs: update TODO.md with spec compliance status"
```

---

### Task 8: Code Review

**Files:**
- All modified files from Tasks 1-7

**Step 1: Run full test suite** (2-5 min)

```bash
npm test
```

Expected: All tests pass

**Step 2: Run linter** (30 sec)

```bash
npm run lint
```

Expected: No errors

**Step 3: Run TypeScript build** (30 sec)

```bash
npm run build:ts
```

Expected: Build succeeds with no errors

**Step 4: Verify native build** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 5: Review changes** (2-5 min)

```bash
git diff HEAD~7..HEAD --stat
git log --oneline HEAD~7..HEAD
```

Verify:
- All commits have descriptive messages following conventional commits
- No unintended files included
- Type definitions are consistent

**Step 6: Final commit (if any fixes needed)** (30 sec)

If any issues found, fix and commit:

```bash
git add -A
git commit -m "fix: address code review feedback"
```
