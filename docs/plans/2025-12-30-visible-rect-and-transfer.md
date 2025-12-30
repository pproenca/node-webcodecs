# visibleRect Cropping and ArrayBuffer Transfer Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-visible-rect-and-transfer.md` to implement task-by-task.

**Goal:** Implement W3C WebCodecs spec-compliant visibleRect cropping in native layer and ArrayBuffer transfer semantics for VideoFrame.

**Architecture:** Clean architecture with native C++ implementation. visibleRect stored in C++ VideoFrame class, applied during CopyTo via sws_scale source region. ArrayBuffer transfer handled in TypeScript with detachment after native copy. Native layer gains VisibleRect struct, parsing, and cropped copy operations.

**Tech Stack:** C++17 (node-addon-api), TypeScript, FFmpeg libswscale, Vitest

---

## Task Dependency Graph

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Foundation: C++ struct and member |
| Group 2 | 2 | C++ constructor parsing |
| Group 3 | 3 | C++ getter for native access |
| Group 4 | 4 | Native CopyTo cropping |
| Group 5 | 5 | TypeScript integration |
| Group 6 | 6 | ArrayBuffer transfer semantics |
| Group 7 | 7 | Integration tests |
| Group 8 | 8 | Code Review |

---

### Task 1: Add VisibleRect struct and member to VideoFrame C++ class

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h:21-60`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Write the failing test** (2-5 min)

Create test that expects visibleRect property on VideoFrame:

```typescript
// Add to test/golden/video-frame.test.ts
describe('VideoFrame visibleRect', () => {
  it('should return default visibleRect equal to codedRect when not specified', () => {
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 4); // RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.visibleRect).toBeDefined();
    expect(frame.visibleRect.x).toBe(0);
    expect(frame.visibleRect.y).toBe(0);
    expect(frame.visibleRect.width).toBe(width);
    expect(frame.visibleRect.height).toBe(height);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts -t "should return default visibleRect"
```

Expected: Test may pass if visibleRect returns codedRect stub, or fail if native doesn't expose visibleRect properly.

**Step 3: Add VisibleRect struct to video_frame.h** (2-5 min)

Add after line 31 (after PixelFormat enum):

```cpp
// Visible rectangle within coded frame (for cropping)
struct VisibleRect {
  int x = 0;
  int y = 0;
  int width = 0;   // 0 = use coded_width_
  int height = 0;  // 0 = use coded_height_
};
```

**Step 4: Add visible_rect_ member to VideoFrame class** (2-5 min)

Add to private members section (around line 75):

```cpp
  VisibleRect visible_rect_;
```

**Step 5: Build to verify compilation** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.h
git commit -m "feat(video-frame): add VisibleRect struct and member"
```

---

### Task 2: Parse visibleRect from init options in C++ constructor

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc:155-210`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/video-frame.test.ts in 'VideoFrame visibleRect' describe block
it('should store custom visibleRect from init options', () => {
  const width = 640;
  const height = 480;
  const data = new Uint8Array(width * height * 4); // RGBA
  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
    visibleRect: { x: 10, y: 20, width: 100, height: 80 },
  });

  expect(frame.visibleRect.x).toBe(10);
  expect(frame.visibleRect.y).toBe(20);
  expect(frame.visibleRect.width).toBe(100);
  expect(frame.visibleRect.height).toBe(80);

  frame.close();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts -t "should store custom visibleRect"
```

Expected: FAIL - visibleRect not parsed from options.

**Step 3: Add visibleRect parsing to constructor** (2-5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`, in the constructor after parsing other options (around line 190-200), add:

```cpp
  // Parse visibleRect from options
  if (options.Has("visibleRect") && options.Get("visibleRect").IsObject()) {
    Napi::Object rect = options.Get("visibleRect").As<Napi::Object>();
    if (rect.Has("x")) {
      visible_rect_.x = rect.Get("x").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("y")) {
      visible_rect_.y = rect.Get("y").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("width")) {
      visible_rect_.width = rect.Get("width").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("height")) {
      visible_rect_.height = rect.Get("height").As<Napi::Number>().Int32Value();
    }
  }

  // Default visibleRect to full coded dimensions if not specified
  if (visible_rect_.width == 0) {
    visible_rect_.width = coded_width_;
  }
  if (visible_rect_.height == 0) {
    visible_rect_.height = coded_height_;
  }
```

**Step 4: Add bounds validation** (2-5 min)

Add after the parsing code:

```cpp
  // Validate visibleRect bounds
  if (visible_rect_.x < 0 || visible_rect_.y < 0 ||
      visible_rect_.x + visible_rect_.width > coded_width_ ||
      visible_rect_.y + visible_rect_.height > coded_height_) {
    Napi::Error::New(env, "visibleRect exceeds coded dimensions")
        .ThrowAsJavaScriptException();
    return;
  }
```

**Step 5: Build and run test** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-frame.test.ts -t "should store custom visibleRect"
```

Expected: Still fails - need getter implementation in Task 3.

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "feat(video-frame): parse visibleRect from init options"
```

---

### Task 3: Implement GetVisibleRect accessor in C++

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h`
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Declare GetVisibleRect in header** (2-5 min)

Add to public methods in `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h` (around line 50):

```cpp
  Napi::Value GetVisibleRect(const Napi::CallbackInfo& info);
```

**Step 2: Implement GetVisibleRect in video_frame.cc** (2-5 min)

Add implementation (after other getters, around line 300):

```cpp
Napi::Value VideoFrame::GetVisibleRect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object rect = Napi::Object::New(env);
  rect.Set("x", Napi::Number::New(env, visible_rect_.x));
  rect.Set("y", Napi::Number::New(env, visible_rect_.y));
  rect.Set("width", Napi::Number::New(env, visible_rect_.width));
  rect.Set("height", Napi::Number::New(env, visible_rect_.height));
  return rect;
}
```

**Step 3: Register getter in Init method** (2-5 min)

In the `Init` method of VideoFrame (around line 130), add to the InstanceAccessor list:

```cpp
    InstanceAccessor<&VideoFrame::GetVisibleRect>("visibleRect"),
```

**Step 4: Build and run tests** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-frame.test.ts -t "visibleRect"
```

Expected: PASS - both visibleRect tests should pass.

**Step 5: Commit** (30 sec)

```bash
git add src/video_frame.h src/video_frame.cc
git commit -m "feat(video-frame): implement GetVisibleRect native accessor"
```

---

### Task 4: Implement cropped CopyTo using visibleRect

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc:517-707`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/video-frame.test.ts
describe('VideoFrame copyTo with visibleRect', () => {
  it('should copy only the visible region when visibleRect is set', async () => {
    // Create a 4x4 RGBA frame with distinct colors in each quadrant
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    // Fill with pattern: top-left=red, top-right=green, bottom-left=blue, bottom-right=white
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x < 2 && y < 2) {
          data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255; // Red
        } else if (x >= 2 && y < 2) {
          data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255; // Green
        } else if (x < 2 && y >= 2) {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255; // Blue
        } else {
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255; // White
        }
      }
    }

    // Create frame with visibleRect = top-left quadrant only
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 0, y: 0, width: 2, height: 2 },
    });

    // Copy to buffer sized for visible region
    const destSize = 2 * 2 * 4; // 2x2 RGBA
    const dest = new Uint8Array(destSize);
    await frame.copyTo(dest);

    // All pixels should be red (the top-left quadrant)
    for (let i = 0; i < destSize; i += 4) {
      expect(dest[i]).toBe(255);     // R
      expect(dest[i + 1]).toBe(0);   // G
      expect(dest[i + 2]).toBe(0);   // B
      expect(dest[i + 3]).toBe(255); // A
    }

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts -t "should copy only the visible region"
```

Expected: FAIL - copyTo doesn't apply visibleRect cropping.

**Step 3: Modify CopyTo to use visible_rect_ for source region** (5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`, modify the `CopyTo` method. Find where `sws_scale` is called (around line 680-700) and update to use visible_rect_ offset:

```cpp
  // Calculate source offset for visibleRect cropping
  int src_offset_x = visible_rect_.x;
  int src_offset_y = visible_rect_.y;
  int crop_width = visible_rect_.width;
  int crop_height = visible_rect_.height;

  // Adjust source plane pointers for the offset
  uint8_t* src_planes_offset[4] = {nullptr};
  for (int i = 0; i < 4 && src_planes[i]; i++) {
    // For packed formats (RGBA/BGRA), offset is y * stride + x * bytes_per_pixel
    if (format_ == PixelFormat::RGBA || format_ == PixelFormat::RGBX ||
        format_ == PixelFormat::BGRA || format_ == PixelFormat::BGRX) {
      src_planes_offset[i] = src_planes[i] + src_offset_y * src_linesize[i] + src_offset_x * 4;
    } else {
      // For planar formats, handle Y and UV planes separately
      // Y plane: offset by x + y * stride
      // UV planes: offset by x/2 + y/2 * stride (for 4:2:0)
      if (i == 0) {  // Y plane
        src_planes_offset[i] = src_planes[i] + src_offset_y * src_linesize[i] + src_offset_x;
      } else {  // U/V planes
        int chroma_x = src_offset_x / 2;
        int chroma_y = src_offset_y / 2;
        src_planes_offset[i] = src_planes[i] + chroma_y * src_linesize[i] + chroma_x;
      }
    }
  }

  // Use cropped dimensions for sws_scale
  sws_scale(sws_ctx, src_planes_offset, src_linesize, 0, crop_height,
            dst_planes, dst_linesize);
```

**Step 4: Update destination buffer size calculation** (2-5 min)

Also update `AllocationSize` method to return size based on visible dimensions:

```cpp
Napi::Value VideoFrame::AllocationSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Use visible dimensions for allocation size
  int width = visible_rect_.width > 0 ? visible_rect_.width : coded_width_;
  int height = visible_rect_.height > 0 ? visible_rect_.height : coded_height_;

  // If options provided with format, calculate for that format
  // Otherwise use current format
  PixelFormat target_format = format_;
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object options = info[0].As<Napi::Object>();
    if (options.Has("format")) {
      std::string fmt = options.Get("format").As<Napi::String>().Utf8Value();
      target_format = ParsePixelFormat(fmt);
    }
  }

  size_t size = CalculateAllocationSize(target_format, width, height);
  return Napi::Number::New(env, static_cast<double>(size));
}
```

**Step 5: Build and run test** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-frame.test.ts -t "should copy only the visible region"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "feat(video-frame): implement cropped CopyTo using visibleRect"
```

---

### Task 5: Update TypeScript layer for visibleRect

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts:174-192`
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/native-types.ts`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Write test for TypeScript visibleRect getter** (2-5 min)

```typescript
// Add to test/golden/video-frame.test.ts
it('should return DOMRectReadOnly-like object from visibleRect getter', () => {
  const width = 640;
  const height = 480;
  const data = new Uint8Array(width * height * 4);
  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
    visibleRect: { x: 10, y: 20, width: 100, height: 80 },
  });

  const rect = frame.visibleRect;
  expect(rect.x).toBe(10);
  expect(rect.y).toBe(20);
  expect(rect.width).toBe(100);
  expect(rect.height).toBe(80);
  // DOMRectReadOnly also has right and bottom
  expect(rect.right).toBe(110);  // x + width
  expect(rect.bottom).toBe(100); // y + height

  frame.close();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts -t "DOMRectReadOnly-like"
```

Expected: FAIL - right and bottom properties not computed.

**Step 3: Update native-types.ts** (2-5 min)

Add visibleRect to NativeVideoFrame interface in `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/native-types.ts`:

```typescript
export interface NativeVideoFrame {
  // ... existing properties
  readonly visibleRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

**Step 4: Update TypeScript VideoFrame visibleRect getter** (2-5 min)

Modify `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts` around line 189-192:

```typescript
  get visibleRect(): DOMRectReadOnly {
    this._throwIfClosed();
    const rect = this._native.visibleRect;
    // Return DOMRectReadOnly-compatible object with computed right/bottom
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON() {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      },
    } as DOMRectReadOnly;
  }
```

**Step 5: Build and run test** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/video-frame.test.ts -t "DOMRectReadOnly-like"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add lib/index.ts lib/native-types.ts
git commit -m "feat(video-frame): update TypeScript visibleRect getter with DOMRectReadOnly"
```

---

### Task 6: Implement ArrayBuffer transfer semantics

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts:126-145`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/video-frame.test.ts
describe('VideoFrame ArrayBuffer transfer', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);
    const data = new Uint8Array(arrayBuffer);
    data.fill(128); // Fill with gray

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [arrayBuffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    expect(arrayBuffer.byteLength).toBe(0);

    // Frame should still be usable
    expect(frame.codedWidth).toBe(width);
    expect(frame.codedHeight).toBe(height);

    frame.close();
  });

  it('should work normally when transfer is not specified', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);
    const data = new Uint8Array(arrayBuffer);
    data.fill(128);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      // No transfer specified
    });

    // ArrayBuffer should NOT be detached
    expect(arrayBuffer.byteLength).toBe(width * height * 4);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts -t "should detach transferred ArrayBuffer"
```

Expected: FAIL - ArrayBuffer not detached.

**Step 3: Add detachArrayBuffer utility function** (2-5 min)

Add to `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts` (before VideoFrame class, around line 120):

```typescript
/**
 * Detach ArrayBuffers per W3C WebCodecs transfer semantics.
 * Uses structuredClone with transfer to detach, or falls back to manual zeroing.
 */
function detachArrayBuffers(buffers: ArrayBuffer[]): void {
  for (const buffer of buffers) {
    if (buffer.byteLength === 0) continue; // Already detached
    try {
      // Modern approach: use structuredClone with transfer to detach
      // This makes the original buffer unusable (byteLength becomes 0)
      structuredClone(buffer, { transfer: [buffer] });
    } catch {
      // Fallback for environments without transfer support
      // We can't truly detach, but the data has been copied to native
      console.warn('ArrayBuffer transfer not supported, data copied instead');
    }
  }
}
```

**Step 4: Call detachArrayBuffers in VideoFrame constructor** (2-5 min)

Modify the VideoFrame constructor in `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts` (around line 145-160). After the native VideoFrame is created, add:

```typescript
    // Handle ArrayBuffer transfer semantics
    if (init.transfer && Array.isArray(init.transfer)) {
      detachArrayBuffers(init.transfer);
    }
```

**Step 5: Build and run test** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/video-frame.test.ts -t "ArrayBuffer transfer"
```

Expected: PASS for both transfer tests.

**Step 6: Commit** (30 sec)

```bash
git add lib/index.ts
git commit -m "feat(video-frame): implement ArrayBuffer transfer semantics"
```

---

### Task 7: Integration tests for visibleRect and transfer

**Files:**
- Create: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-visible-rect.test.ts`

**Step 1: Create comprehensive integration test file** (5 min)

```typescript
// test/golden/video-frame-visible-rect.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('VideoFrame visibleRect Integration', () => {
  describe('edge cases', () => {
    it('should throw when visibleRect exceeds coded dimensions', () => {
      const width = 100;
      const height = 100;
      const data = new Uint8Array(width * height * 4);

      expect(() => {
        new VideoFrame(data, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: 0,
          visibleRect: { x: 50, y: 50, width: 100, height: 100 }, // Exceeds bounds
        });
      }).toThrow();
    });

    it('should handle visibleRect at frame boundary', () => {
      const width = 100;
      const height = 100;
      const data = new Uint8Array(width * height * 4);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        visibleRect: { x: 0, y: 0, width: 100, height: 100 }, // Exact match
      });

      expect(frame.visibleRect.width).toBe(100);
      expect(frame.visibleRect.height).toBe(100);
      frame.close();
    });

    it('should handle small visibleRect (1x1)', () => {
      const width = 100;
      const height = 100;
      const data = new Uint8Array(width * height * 4);
      // Set pixel at (50, 50) to known color
      const idx = (50 * width + 50) * 4;
      data[idx] = 255;     // R
      data[idx + 1] = 128; // G
      data[idx + 2] = 64;  // B
      data[idx + 3] = 255; // A

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        visibleRect: { x: 50, y: 50, width: 1, height: 1 },
      });

      const dest = new Uint8Array(4); // 1x1 RGBA
      frame.copyTo(dest);

      expect(dest[0]).toBe(255);
      expect(dest[1]).toBe(128);
      expect(dest[2]).toBe(64);
      expect(dest[3]).toBe(255);

      frame.close();
    });
  });

  describe('format conversion with visibleRect', () => {
    it('should apply visibleRect when converting RGBA to I420', async () => {
      const width = 8;
      const height = 8;
      const data = new Uint8Array(width * height * 4);
      // Fill entire frame with red
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 255; // A
      }

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        visibleRect: { x: 0, y: 0, width: 4, height: 4 },
      });

      // Get allocation size for I420 at visible dimensions
      const size = frame.allocationSize({ format: 'I420' });
      // I420: Y = 4*4, U = 2*2, V = 2*2 = 16 + 4 + 4 = 24
      expect(size).toBe(24);

      frame.close();
    });
  });
});

describe('VideoFrame ArrayBuffer transfer edge cases', () => {
  it('should handle empty transfer array', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [], // Empty array
    });

    expect(frame.codedWidth).toBe(width);
    frame.close();
  });

  it('should handle already-detached ArrayBuffer in transfer', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);
    const data = new Uint8Array(arrayBuffer);

    // Pre-detach the buffer
    structuredClone(arrayBuffer, { transfer: [arrayBuffer] });
    expect(arrayBuffer.byteLength).toBe(0);

    // Should not throw when transfer includes already-detached buffer
    // Note: This creates frame from data view which still holds reference
    // The transfer of already-detached buffer should be no-op
    const newBuffer = new ArrayBuffer(width * height * 4);
    const newData = new Uint8Array(newBuffer);

    const frame = new VideoFrame(newData, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [arrayBuffer], // Already detached
    });

    expect(frame.codedWidth).toBe(width);
    frame.close();
  });
});
```

**Step 2: Run all integration tests** (30 sec)

```bash
npx vitest run test/golden/video-frame-visible-rect.test.ts
```

Expected: All tests PASS.

**Step 3: Run full test suite** (1 min)

```bash
npm test
```

Expected: All tests PASS.

**Step 4: Commit** (30 sec)

```bash
git add test/golden/video-frame-visible-rect.test.ts
git commit -m "test(video-frame): add integration tests for visibleRect and transfer"
```

---

### Task 8: Code Review

**Files:**
- All modified files from Tasks 1-7

**Step 1: Review C++ memory safety** (2-5 min)

Check `src/video_frame.cc` for:
- Bounds validation before array access
- No buffer overflows in CopyTo with visibleRect offset
- Proper null checks on plane pointers

**Step 2: Review TypeScript type safety** (2-5 min)

Check `lib/index.ts` for:
- Proper type narrowing for transfer array
- DOMRectReadOnly interface compliance

**Step 3: Run linter** (30 sec)

```bash
npm run lint
```

Expected: No errors.

**Step 4: Run full build and test** (1 min)

```bash
npm run build && npm test
```

Expected: Build succeeds, all tests pass.

**Step 5: Update TODO.md** (2-5 min)

Mark completed items in `/Users/pedroproenca/Documents/Projects/node-webcodecs/TODO.md`:

```markdown
- [x] visibleRect cropping not fully implemented in native layer (line 8) - DONE
- [x] ArrayBuffer transfer semantics not implemented (line 9) - DONE
```

**Step 6: Final commit** (30 sec)

```bash
git add TODO.md
git commit -m "docs: mark visibleRect and transfer tasks as complete"
```
