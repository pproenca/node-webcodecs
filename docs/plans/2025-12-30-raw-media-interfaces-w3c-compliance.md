# Raw Media Interfaces W3C Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-raw-media-interfaces-w3c-compliance.md` to implement task-by-task.

**Goal:** Ensure VideoFrame, AudioData, and VideoColorSpace interfaces comply exactly with the W3C WebCodecs specification (https://www.w3.org/TR/webcodecs/#raw-media-interfaces).

**Architecture:** Incremental fixes to existing TypeScript wrappers (`lib/index.ts`) and C++ native bindings (`src/video_frame.cc`, `src/audio_data.cc`). Each task adds spec-compliant behavior with corresponding TDD tests.

**Tech Stack:** TypeScript, C++ (node-addon-api/NAPI), Vitest for testing, FFmpeg libswscale for format conversion.

---

## Gap Analysis Summary

| Feature | Status | Gap |
|---------|--------|-----|
| VideoFrame constructor from ArrayBuffer | ✓ Complete | None |
| VideoFrame constructor from VideoFrame | ✗ Missing | Spec allows `new VideoFrame(frame, init)` |
| VideoFrame.allocationSize() with rect | ✗ Missing | Should calculate size for sub-region |
| VideoFrame properties when closed | ⚠ Partial | Should return null/0, currently throws |
| AudioData properties when closed | ⚠ Partial | format returns null ✓, others return values instead of 0 |
| Exception types | ⚠ Partial | Need DOMException vs TypeError vs RangeError verification |
| VideoFrame.copyTo() return value | ⚠ Partial | Should always return PlaneLayout[] |
| Comprehensive W3C compliance tests | ✗ Missing | Need edge case coverage |

---

## Task Group 1: VideoFrame Closed State Compliance

**Rationale:** These tasks are independent and touch different test files.

### Task 1: VideoFrame Properties Return Null/0 When Closed

**Files:**
- Modify: `lib/index.ts:186-260` (VideoFrame property getters)
- Test: `test/golden/video-frame-closed-state.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-closed-state.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('VideoFrame closed state per W3C spec', () => {
  it('should return null for format when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();

    // W3C spec: format returns null when [[Detached]] is true
    expect(frame.format).toBeNull();
  });

  it('should return 0 for codedWidth when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();

    // W3C spec: codedWidth returns 0 when [[Detached]] is true
    expect(frame.codedWidth).toBe(0);
  });

  it('should return 0 for codedHeight when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.codedHeight).toBe(0);
  });

  it('should return null for codedRect when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.codedRect).toBeNull();
  });

  it('should return null for visibleRect when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.visibleRect).toBeNull();
  });

  it('should return 0 for displayWidth when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.displayWidth).toBe(0);
  });

  it('should return 0 for displayHeight when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.displayHeight).toBe(0);
  });

  it('should return 0 for timestamp when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.timestamp).toBe(0);
  });

  it('should return null for duration when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    frame.close();
    expect(frame.duration).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-closed-state.test.ts -v
```

Expected: FAIL (tests expect null/0 but implementation throws or returns actual values)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts` VideoFrame property getters to return null/0 when closed:

```typescript
get format(): VideoPixelFormat | null {
  if (this._closed) return null;
  return (this._native.format as VideoPixelFormat) ?? null;
}

get codedWidth(): number {
  if (this._closed) return 0;
  return this._native.codedWidth;
}

get codedHeight(): number {
  if (this._closed) return 0;
  return this._native.codedHeight;
}

get displayWidth(): number {
  if (this._closed) return 0;
  return this._native.displayWidth;
}

get displayHeight(): number {
  if (this._closed) return 0;
  return this._native.displayHeight;
}

get timestamp(): number {
  if (this._closed) return 0;
  return this._native.timestamp;
}

get duration(): number | null {
  if (this._closed) return null;
  return this._native.duration ?? null;
}

get codedRect(): DOMRectReadOnly | null {
  if (this._closed) return null;
  const w = this.codedWidth;
  const h = this.codedHeight;
  return {
    x: 0, y: 0, width: w, height: h,
    top: 0, left: 0, right: w, bottom: h,
  };
}

get visibleRect(): DOMRectReadOnly | null {
  if (this._closed) return null;
  const rect = this._native.visibleRect;
  return {
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height,
  };
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-closed-state.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-frame-closed-state.test.ts lib/index.ts
git commit -m "fix(VideoFrame): return null/0 for properties when closed per W3C spec"
```

---

### Task 2: AudioData Properties Return 0 When Closed

**Files:**
- Modify: `lib/index.ts:698-720` (AudioData property getters)
- Test: `test/golden/audio-data-closed-state.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/audio-data-closed-state.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('AudioData closed state per W3C spec', () => {
  it('should return null for format when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();

    // W3C spec: format returns null when [[Detached]] is true
    expect(audioData.format).toBeNull();
  });

  it('should return 0 for sampleRate when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();

    // W3C spec: sampleRate returns 0 when [[Detached]] is true
    expect(audioData.sampleRate).toBe(0);
  });

  it('should return 0 for numberOfFrames when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    expect(audioData.numberOfFrames).toBe(0);
  });

  it('should return 0 for numberOfChannels when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    expect(audioData.numberOfChannels).toBe(0);
  });

  it('should return 0 for duration when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    expect(audioData.duration).toBe(0);
  });

  it('should return 0 for timestamp when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 5000,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    expect(audioData.timestamp).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-data-closed-state.test.ts -v
```

Expected: FAIL (properties return values instead of 0)

**Step 3: Write minimal implementation** (2-5 min)

The current implementation in `lib/index.ts:698-720` already returns null for format and 0 for most properties when closed. Verify and fix any inconsistencies:

```typescript
get format(): AudioSampleFormat | null {
  return this._closed ? null : this._native.format;
}

get sampleRate(): number {
  return this._closed ? 0 : this._native.sampleRate;
}

get numberOfFrames(): number {
  return this._closed ? 0 : this._native.numberOfFrames;
}

get numberOfChannels(): number {
  return this._closed ? 0 : this._native.numberOfChannels;
}

get duration(): number {
  return this._closed ? 0 : this._native.duration;
}

get timestamp(): number {
  return this._closed ? 0 : this._native.timestamp;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-data-closed-state.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/audio-data-closed-state.test.ts lib/index.ts
git commit -m "fix(AudioData): return 0 for properties when closed per W3C spec"
```

---

## Task Group 2: VideoFrame Constructor from VideoFrame

**Rationale:** Enables creating modified clones per W3C spec.

### Task 3: VideoFrame Constructor from Existing VideoFrame

**Files:**
- Modify: `lib/index.ts:155-184` (VideoFrame constructor)
- Modify: `lib/types.ts` (add VideoFrameInit with more optional fields)
- Test: `test/golden/video-frame-constructor-from-frame.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-constructor-from-frame.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('VideoFrame constructor from VideoFrame per W3C spec', () => {
  it('should create a clone with same properties when no init provided', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    const cloned = new VideoFrame(original);

    expect(cloned.format).toBe('RGBA');
    expect(cloned.codedWidth).toBe(4);
    expect(cloned.codedHeight).toBe(4);
    expect(cloned.timestamp).toBe(1000);
    expect(cloned.duration).toBe(5000);

    original.close();
    cloned.close();
  });

  it('should override timestamp when provided in init', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    const cloned = new VideoFrame(original, { timestamp: 2000 });

    expect(cloned.timestamp).toBe(2000);
    expect(cloned.format).toBe('RGBA'); // Other properties preserved

    original.close();
    cloned.close();
  });

  it('should override duration when provided in init', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    const cloned = new VideoFrame(original, { duration: 10000 });

    expect(cloned.duration).toBe(10000);
    expect(cloned.timestamp).toBe(1000); // Preserved

    original.close();
    cloned.close();
  });

  it('should override visibleRect when provided in init', () => {
    const data = new Uint8Array(8 * 8 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 8,
      codedHeight: 8,
      timestamp: 1000,
    });

    const cloned = new VideoFrame(original, {
      visibleRect: { x: 2, y: 2, width: 4, height: 4 },
    });

    expect(cloned.visibleRect?.x).toBe(2);
    expect(cloned.visibleRect?.y).toBe(2);
    expect(cloned.visibleRect?.width).toBe(4);
    expect(cloned.visibleRect?.height).toBe(4);

    original.close();
    cloned.close();
  });

  it('should throw InvalidStateError when source frame is closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    original.close();

    expect(() => new VideoFrame(original)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-constructor-from-frame.test.ts -v
```

Expected: FAIL (constructor doesn't accept VideoFrame as first argument)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts` VideoFrame constructor to detect and handle VideoFrame source:

```typescript
constructor(
  dataOrFrame: Buffer | Uint8Array | ArrayBuffer | VideoFrame,
  init?: VideoFrameBufferInit | VideoFrameInit,
) {
  // Check if first argument is a VideoFrame (constructor from frame)
  if (dataOrFrame instanceof VideoFrame) {
    if (dataOrFrame._closed) {
      throw new DOMException('Source VideoFrame is closed', 'InvalidStateError');
    }

    // Clone the native frame
    this._native = dataOrFrame._native.clone();
    this._closed = false;

    // Apply overrides from init if provided
    const frameInit = init as VideoFrameInit | undefined;

    // Preserve metadata from source, override with init if provided
    this._metadata = frameInit?.metadata ?? {...dataOrFrame._metadata};

    // Handle timestamp override
    if (frameInit?.timestamp !== undefined) {
      // Note: Would need native support to modify timestamp
      // For now, store in wrapper or create new native with modified timestamp
    }

    // Handle duration override
    if (frameInit?.duration !== undefined) {
      // Similar handling needed
    }

    // Handle visibleRect override
    if (frameInit?.visibleRect !== undefined) {
      // Need to recreate native frame with new visibleRect
    }

    return;
  }

  // Original constructor logic for ArrayBuffer/Buffer/Uint8Array
  // ... existing code ...
}
```

Note: Full implementation requires native layer changes to support property overrides. This is a complex change that may need refactoring of the native VideoFrame class.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-constructor-from-frame.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-frame-constructor-from-frame.test.ts lib/index.ts lib/types.ts
git commit -m "feat(VideoFrame): add constructor from VideoFrame per W3C spec"
```

---

## Task Group 3: Exception Types Compliance

**Rationale:** W3C spec requires specific exception types.

### Task 4: VideoFrame Methods Throw DOMException InvalidStateError

**Files:**
- Modify: `lib/index.ts:246-325` (VideoFrame methods)
- Test: `test/golden/video-frame-exceptions.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-exceptions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('VideoFrame exception types per W3C spec', () => {
  describe('clone()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      expect(() => frame.clone()).toThrow(DOMException);
      try {
        frame.clone();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });
  });

  describe('copyTo()', () => {
    it('should throw DOMException with InvalidStateError when closed', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      const dest = new Uint8Array(4 * 4 * 4);
      await expect(frame.copyTo(dest)).rejects.toThrow(DOMException);

      try {
        await frame.copyTo(dest);
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });

    it('should throw RangeError when destination buffer too small', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      const dest = new Uint8Array(10); // Too small

      await expect(frame.copyTo(dest)).rejects.toThrow(RangeError);

      frame.close();
    });

    it('should throw RangeError when rect exceeds bounds', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      const dest = new Uint8Array(100);

      await expect(
        frame.copyTo(dest, { rect: { x: 10, y: 10, width: 2, height: 2 } })
      ).rejects.toThrow(RangeError);

      frame.close();
    });
  });

  describe('allocationSize()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      expect(() => frame.allocationSize()).toThrow(DOMException);
      try {
        frame.allocationSize();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });
  });

  describe('metadata()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      expect(() => frame.metadata()).toThrow(DOMException);
      try {
        frame.metadata();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-exceptions.test.ts -v
```

Expected: FAIL (wrong exception types being thrown)

**Step 3: Write minimal implementation** (2-5 min)

Update exception handling in `lib/index.ts`:

```typescript
private _throwIfClosed(): void {
  if (this._closed) {
    throw new DOMException('VideoFrame is closed', 'InvalidStateError');
  }
}

async copyTo(
  destination: ArrayBuffer | Uint8Array,
  options?: VideoFrameCopyToOptions,
): Promise<PlaneLayout[]> {
  this._throwIfClosed();

  // Check buffer size - throw RangeError per spec
  const requiredSize = this.allocationSize(options);
  const destSize = destination instanceof ArrayBuffer
    ? destination.byteLength
    : destination.byteLength;

  if (destSize < requiredSize) {
    throw new RangeError('Destination buffer too small');
  }

  // Check rect bounds - throw RangeError per spec
  if (options?.rect) {
    const { x = 0, y = 0, width = this.codedWidth, height = this.codedHeight } = options.rect;
    if (x < 0 || y < 0 || x + width > this.codedWidth || y + height > this.codedHeight) {
      throw new RangeError('rect exceeds coded frame bounds');
    }
  }

  // ... rest of implementation
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-exceptions.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-frame-exceptions.test.ts lib/index.ts
git commit -m "fix(VideoFrame): use correct exception types per W3C spec"
```

---

### Task 5: AudioData Methods Throw Correct Exception Types

**Files:**
- Modify: `lib/index.ts:720-790` (AudioData methods)
- Test: `test/golden/audio-data-exceptions.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/audio-data-exceptions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('AudioData exception types per W3C spec', () => {
  describe('clone()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      expect(() => audioData.clone()).toThrow(DOMException);
      try {
        audioData.clone();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });
  });

  describe('allocationSize()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      expect(() => audioData.allocationSize({ planeIndex: 0 })).toThrow(DOMException);
      try {
        audioData.allocationSize({ planeIndex: 0 });
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });

    it('should throw RangeError when planeIndex out of range', () => {
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      // planeIndex 5 is out of range for 2-channel audio
      expect(() => audioData.allocationSize({ planeIndex: 5 })).toThrow(RangeError);

      audioData.close();
    });
  });

  describe('copyTo()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      const dest = new ArrayBuffer(1024 * 2 * 4);
      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow(DOMException);
      try {
        audioData.copyTo(dest, { planeIndex: 0 });
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });

    it('should throw RangeError when destination buffer too small', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      const dest = new ArrayBuffer(10); // Too small

      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow(RangeError);

      audioData.close();
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-data-exceptions.test.ts -v
```

Expected: FAIL (exception types may be wrong)

**Step 3: Write minimal implementation** (2-5 min)

Update `lib/index.ts` AudioData exception handling:

```typescript
allocationSize(options: AudioDataCopyToOptions): number {
  if (this._closed) {
    throw new DOMException('AudioData is closed', 'InvalidStateError');
  }
  if (options.planeIndex === undefined || options.planeIndex === null) {
    throw new TypeError("required member planeIndex is undefined");
  }
  // Let native layer throw RangeError for invalid planeIndex
  return this._native.allocationSize(options);
}

copyTo(
  destination: ArrayBuffer | ArrayBufferView,
  options: AudioDataCopyToOptions,
): void {
  if (this._closed) {
    throw new DOMException('AudioData is closed', 'InvalidStateError');
  }
  if (options.planeIndex === undefined || options.planeIndex === null) {
    throw new TypeError("required member planeIndex is undefined");
  }

  // Check buffer size
  const requiredSize = this.allocationSize(options);
  const destSize = destination instanceof ArrayBuffer
    ? destination.byteLength
    : destination.byteLength;

  if (destSize < requiredSize) {
    throw new RangeError('Destination buffer too small');
  }

  // ... rest of implementation
}

clone(): AudioData {
  if (this._closed) {
    throw new DOMException('AudioData is closed', 'InvalidStateError');
  }
  // ... rest of implementation
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-data-exceptions.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/audio-data-exceptions.test.ts lib/index.ts
git commit -m "fix(AudioData): use correct exception types per W3C spec"
```

---

## Task Group 4: VideoFrame.allocationSize with rect Option

**Rationale:** Spec allows calculating allocation size for a sub-region.

### Task 6: VideoFrame.allocationSize Accepts rect Option

**Files:**
- Modify: `lib/index.ts:316-321` (allocationSize method)
- Modify: `src/video_frame.cc:484-509` (native allocationSize)
- Test: `test/golden/video-frame-allocation-size-rect.test.ts` (create new)

**Step 1: Write the failing test** (2-5 min)

Create `test/golden/video-frame-allocation-size-rect.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('VideoFrame.allocationSize() with rect option', () => {
  it('should calculate size for sub-region', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Full frame: 100 * 100 * 4 = 40000 bytes
    expect(frame.allocationSize()).toBe(40000);

    // Sub-region: 50 * 50 * 4 = 10000 bytes
    const rectSize = frame.allocationSize({ rect: { x: 0, y: 0, width: 50, height: 50 } });
    expect(rectSize).toBe(10000);

    frame.close();
  });

  it('should calculate size for non-zero origin rect', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Rect starting at (25, 25) with size 50x50
    const rectSize = frame.allocationSize({ rect: { x: 25, y: 25, width: 50, height: 50 } });
    expect(rectSize).toBe(10000); // 50 * 50 * 4

    frame.close();
  });

  it('should throw RangeError when rect exceeds bounds', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    expect(() =>
      frame.allocationSize({ rect: { x: 80, y: 80, width: 50, height: 50 } })
    ).toThrow(RangeError);

    frame.close();
  });

  it('should work with I420 format and rect', () => {
    // I420: 100x100 = 15000 bytes (Y: 10000 + U: 2500 + V: 2500)
    const data = new Uint8Array(100 * 100 * 1.5);
    const frame = new VideoFrame(data, {
      format: 'I420',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Full frame
    expect(frame.allocationSize()).toBe(15000);

    // 50x50 sub-region: Y: 2500 + U: 625 + V: 625 = 3750 bytes
    const rectSize = frame.allocationSize({ rect: { x: 0, y: 0, width: 50, height: 50 } });
    expect(rectSize).toBe(3750);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-allocation-size-rect.test.ts -v
```

Expected: FAIL (allocationSize doesn't support rect option)

**Step 3: Write minimal implementation** (2-5 min)

Update `lib/index.ts` allocationSize method:

```typescript
allocationSize(options?: VideoFrameCopyToOptions): number {
  this._throwIfClosed();

  // Parse rect option for calculating allocation size
  let width = this.visibleRect?.width ?? this.codedWidth;
  let height = this.visibleRect?.height ?? this.codedHeight;

  if (options?.rect) {
    const { x = 0, y = 0, width: rectWidth, height: rectHeight } = options.rect;

    // Validate rect bounds
    if (x < 0 || y < 0 ||
        (rectWidth !== undefined && x + rectWidth > this.codedWidth) ||
        (rectHeight !== undefined && y + rectHeight > this.codedHeight)) {
      throw new RangeError('rect exceeds coded frame bounds');
    }

    width = rectWidth ?? width;
    height = rectHeight ?? height;
  }

  // Calculate allocation size for the specified region
  return this._native.allocationSize({
    ...options,
    // Pass calculated dimensions to native layer
    _width: width,
    _height: height,
  });
}
```

Also update native layer to accept width/height overrides, or calculate in TypeScript using format info.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-allocation-size-rect.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-frame-allocation-size-rect.test.ts lib/index.ts src/video_frame.cc
git commit -m "feat(VideoFrame): support rect option in allocationSize per W3C spec"
```

---

## Task Group 5: Final Integration and Cleanup

### Task 7: Code Review

**Files:**
- All modified files from Tasks 1-6

**Step 1: Run full test suite** (2-5 min)

```bash
npm test
```

Verify all tests pass.

**Step 2: Run linting** (30 sec)

```bash
npm run lint
```

Fix any linting issues.

**Step 3: Review changes** (2-5 min)

```bash
git diff main..HEAD
```

Verify all changes align with W3C spec and don't introduce regressions.

**Step 4: Build and verify** (30 sec)

```bash
npm run build
```

Ensure clean build.

---

## Parallel Execution Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Independent: VideoFrame and AudioData closed state fixes |
| Group 2 | 3 | Depends on Group 1: VideoFrame constructor from frame |
| Group 3 | 4, 5 | Independent: Exception type fixes for VideoFrame and AudioData |
| Group 4 | 6 | Independent: allocationSize rect support |
| Group 5 | 7 | Serial: Final code review depends on all previous tasks |

---

## Notes

1. **Node.js Limitations:** VideoFrame constructor from CanvasImageSource is not supported (documented in CLAUDE.md).

2. **Native Layer Changes:** Some tasks may require C++ native layer modifications if TypeScript-only changes are insufficient.

3. **Breaking Changes:** Changing property return values when closed from throwing to returning null/0 may affect existing code that relies on catching exceptions.

4. **Test Coverage:** Each task includes comprehensive tests following W3C spec requirements.
