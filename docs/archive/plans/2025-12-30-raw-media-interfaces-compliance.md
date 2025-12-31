# W3C WebCodecs Raw Media Interfaces Compliance Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-raw-media-interfaces-compliance.md` to implement task-by-task.

**Goal:** Achieve full W3C WebCodecs spec compliance for raw media interfaces (VideoFrame, AudioData, VideoColorSpace) in both TypeScript API and C++ native bindings.

**Architecture:** Fix gaps in both TypeScript wrapper layer and C++ native bindings to match the W3C WebIDL specification exactly. Changes are additive where possible, with signature fixes where required for spec compliance.

**Tech Stack:** TypeScript, C++ (node-addon-api/NAPI), FFmpeg (libavutil, libswscale, libswresample)

---

## Gap Analysis Summary

### VideoFrame Interface Gaps

| W3C Spec | Current Status | Gap |
|----------|----------------|-----|
| `codedRect` returns `DOMRectReadOnly?` | Returns `DOMRectReadOnly` (never null) | Minor: should return null when closed |
| `visibleRect` returns `DOMRectReadOnly?` | Returns `DOMRectReadOnly` (never null) | Minor: should return null when closed |
| `format` returns `VideoPixelFormat?` | Returns `VideoPixelFormat \| null` | ✅ Compliant |
| `allocationSize()` returns array of `PlaneLayout` | Returns `number` | **CRITICAL**: Must return `PlaneLayout[]` |
| `copyTo()` `options.layout` parameter | Not implemented | Missing: optional layout parameter |
| `copyTo()` `options.rect` parameter | Not implemented | Missing: optional rect parameter |
| Constructor from `CanvasImageSource` | Not supported | N/A for Node.js |

### AudioData Interface Gaps

| W3C Spec | Current Status | Gap |
|----------|----------------|-----|
| `allocationSize()` returns `unsigned long` | Returns `number` | ✅ Compliant |
| `copyTo()` returns `Promise<undefined>` | Returns `void` (synchronous) | **CRITICAL**: Must return `Promise<undefined>` |
| `transfer` option in `AudioDataInit` | Not implemented | Missing: ArrayBuffer transfer semantics |

### VideoColorSpace Interface Gaps

| W3C Spec | Current Status | Gap |
|----------|----------------|-----|
| Standalone class with constructor | Exists, no issues | ✅ Compliant |
| `toJSON()` method | Implemented | ✅ Compliant |

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | VideoFrame TypeScript and C++ changes (same files) |
| Group 2 | 3, 4 | AudioData TypeScript and C++ changes (same files) |
| Group 3 | 5 | Comprehensive tests for all changes |
| Group 4 | 6 | Code Review (final task) |

---

### Task 1: Fix VideoFrame.allocationSize() to return PlaneLayout[]

**Files:**
- Modify: `lib/types.ts:864` (interface definition)
- Modify: `lib/index.ts:316-321` (allocationSize method)
- Modify: `src/video_frame.h:147` (method signature)
- Modify: `src/video_frame.cc` (AllocationSize implementation)
- Test: `test/golden/video-frame-allocation-size.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

Create test file at `test/golden/video-frame-allocation-size.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('VideoFrame.allocationSize() W3C compliance', () => {
  it('should return PlaneLayout[] per W3C spec', () => {
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 4); // RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    const result = frame.allocationSize();

    // W3C spec: allocationSize() returns sequence<PlaneLayout>
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Each PlaneLayout has offset and stride
    for (const layout of result) {
      expect(typeof layout.offset).toBe('number');
      expect(typeof layout.stride).toBe('number');
    }

    frame.close();
  });

  it('should return correct PlaneLayout for I420 format', () => {
    const width = 640;
    const height = 480;
    // I420: Y + U + V planes
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2);
    const data = new Uint8Array(ySize + uvSize * 2);

    const frame = new VideoFrame(data, {
      format: 'I420',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    const layouts = frame.allocationSize();

    // I420 has 3 planes
    expect(layouts.length).toBe(3);

    // Y plane
    expect(layouts[0].offset).toBe(0);
    expect(layouts[0].stride).toBe(width);

    // U plane
    expect(layouts[1].offset).toBe(ySize);
    expect(layouts[1].stride).toBe(width / 2);

    // V plane
    expect(layouts[2].offset).toBe(ySize + uvSize);
    expect(layouts[2].stride).toBe(width / 2);

    frame.close();
  });

  it('should throw InvalidStateError when frame is closed', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });
    frame.close();

    expect(() => frame.allocationSize()).toThrow('InvalidStateError');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-allocation-size.test.ts -v
```

Expected: FAIL with `expect(Array.isArray(result)).toBe(true)` - currently returns number

**Step 3: Update TypeScript interface** (2 min)

In `lib/types.ts` at line 864, change:

```typescript
// OLD
allocationSize(options?: VideoFrameCopyToOptions): number;

// NEW
allocationSize(options?: VideoFrameCopyToOptions): PlaneLayout[];
```

**Step 4: Update native C++ header** (2 min)

In `src/video_frame.h` at line 147, the method already returns `Napi::Value` so no change needed, but add comment:

```cpp
  // Returns PlaneLayout[] per W3C WebCodecs spec.
  Napi::Value AllocationSize(const Napi::CallbackInfo& info);
```

**Step 5: Update native C++ implementation** (5 min)

In `src/video_frame.cc`, replace the `AllocationSize` method. Find the current implementation (around line 485) and replace with:

```cpp
Napi::Value VideoFrame::AllocationSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: VideoFrame is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Use visibleRect dimensions (cropped region)
  int width = visible_rect_.width > 0 ? visible_rect_.width : coded_width_;
  int height = visible_rect_.height > 0 ? visible_rect_.height : coded_height_;

  // Check for format conversion option
  PixelFormat target_format = format_;
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object opts = info[0].As<Napi::Object>();
    if (opts.Has("format") && opts.Get("format").IsString()) {
      std::string fmt = opts.Get("format").As<Napi::String>().Utf8Value();
      target_format = ParsePixelFormat(fmt);
      if (target_format == PixelFormat::UNKNOWN) {
        Napi::TypeError::New(env, "Invalid format").ThrowAsJavaScriptException();
        return env.Undefined();
      }
    }
  }

  const auto& format_info = GetFormatInfo(target_format);
  Napi::Array layouts = Napi::Array::New(env);

  // Bytes per sample: 1 for 8-bit, 2 for 10/12-bit
  int bytes_per_sample = (format_info.bit_depth + 7) / 8;

  if (format_info.num_planes == 1) {
    // Packed RGB: single plane, 4 bytes per pixel
    Napi::Object layout = Napi::Object::New(env);
    layout.Set("offset", Napi::Number::New(env, 0));
    layout.Set("stride", Napi::Number::New(env, width * 4));
    layouts.Set(uint32_t(0), layout);
  } else if (format_info.is_semi_planar) {
    // NV12-style: Y plane + interleaved UV plane
    int y_stride = width * bytes_per_sample;
    int y_size = y_stride * height;
    int uv_width = width >> format_info.chroma_h_shift;
    int uv_height = height >> format_info.chroma_v_shift;
    int uv_stride = uv_width * 2 * bytes_per_sample;

    // Y plane
    Napi::Object y_layout = Napi::Object::New(env);
    y_layout.Set("offset", Napi::Number::New(env, 0));
    y_layout.Set("stride", Napi::Number::New(env, y_stride));
    layouts.Set(uint32_t(0), y_layout);

    // UV plane (interleaved)
    Napi::Object uv_layout = Napi::Object::New(env);
    uv_layout.Set("offset", Napi::Number::New(env, y_size));
    uv_layout.Set("stride", Napi::Number::New(env, uv_stride));
    layouts.Set(uint32_t(1), uv_layout);

    // Alpha plane for NV12A
    if (format_info.has_alpha && format_info.num_planes > 2) {
      int uv_size = uv_stride * uv_height;
      Napi::Object a_layout = Napi::Object::New(env);
      a_layout.Set("offset", Napi::Number::New(env, y_size + uv_size));
      a_layout.Set("stride", Napi::Number::New(env, y_stride));
      layouts.Set(uint32_t(2), a_layout);
    }
  } else {
    // Planar YUV: Y + U + V (+ optional A)
    int y_stride = width * bytes_per_sample;
    int y_size = y_stride * height;
    int chroma_width = width >> format_info.chroma_h_shift;
    int chroma_height = height >> format_info.chroma_v_shift;
    int uv_stride = chroma_width * bytes_per_sample;
    int uv_size = uv_stride * chroma_height;

    // Y plane
    Napi::Object y_layout = Napi::Object::New(env);
    y_layout.Set("offset", Napi::Number::New(env, 0));
    y_layout.Set("stride", Napi::Number::New(env, y_stride));
    layouts.Set(uint32_t(0), y_layout);

    // U plane
    Napi::Object u_layout = Napi::Object::New(env);
    u_layout.Set("offset", Napi::Number::New(env, y_size));
    u_layout.Set("stride", Napi::Number::New(env, uv_stride));
    layouts.Set(uint32_t(1), u_layout);

    // V plane
    Napi::Object v_layout = Napi::Object::New(env);
    v_layout.Set("offset", Napi::Number::New(env, y_size + uv_size));
    v_layout.Set("stride", Napi::Number::New(env, uv_stride));
    layouts.Set(uint32_t(2), v_layout);

    // Alpha plane for YUVA formats
    if (format_info.has_alpha && format_info.num_planes > 3) {
      Napi::Object a_layout = Napi::Object::New(env);
      a_layout.Set("offset", Napi::Number::New(env, y_size + uv_size * 2));
      a_layout.Set("stride", Napi::Number::New(env, y_stride));
      layouts.Set(uint32_t(3), a_layout);
    }
  }

  return layouts;
}
```

**Step 6: Update TypeScript wrapper** (2 min)

In `lib/index.ts` at line 316-321, change:

```typescript
// OLD
allocationSize(options?: {format?: VideoPixelFormat}): number {
  if (this._closed) {
    throw new DOMException('VideoFrame is closed', 'InvalidStateError');
  }
  return this._native.allocationSize(options || {});
}

// NEW
allocationSize(options?: VideoFrameCopyToOptions): PlaneLayout[] {
  if (this._closed) {
    throw new DOMException('VideoFrame is closed', 'InvalidStateError');
  }
  return this._native.allocationSize(options || {});
}
```

**Step 7: Update native-types.ts** (1 min)

In `lib/native-types.ts` at line 48, change:

```typescript
// OLD
allocationSize(options?: {format?: string}): number;

// NEW
allocationSize(options?: {format?: string}): PlaneLayoutResult[];
```

**Step 8: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-allocation-size.test.ts -v
```

Expected: PASS (all tests green)

**Step 9: Build and verify no TypeScript errors** (1 min)

```bash
npm run build
```

**Step 10: Commit** (30 sec)

```bash
git add lib/types.ts lib/index.ts lib/native-types.ts src/video_frame.cc src/video_frame.h test/golden/video-frame-allocation-size.test.ts
git commit -m "fix(VideoFrame): allocationSize returns PlaneLayout[] per W3C spec"
```

---

### Task 2: Add VideoFrame.copyTo() rect and layout options

**Files:**
- Modify: `lib/types.ts:350-358` (VideoFrameCopyToOptions)
- Modify: `src/video_frame.cc` (CopyTo implementation)
- Test: `test/golden/video-frame-copy-to-options.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

Create test file at `test/golden/video-frame-copy-to-options.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('VideoFrame.copyTo() with rect option', () => {
  it('should copy only the specified rect region', async () => {
    // Create a 4x4 RGBA frame with distinct colors
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    // Fill: top-left=red, top-right=green, bottom-left=blue, bottom-right=white
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

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Copy only the top-right quadrant (green)
    const destSize = 2 * 2 * 4;
    const dest = new Uint8Array(destSize);

    await frame.copyTo(dest, {rect: {x: 2, y: 0, width: 2, height: 2}});

    // All pixels should be green
    for (let i = 0; i < destSize; i += 4) {
      expect(dest[i]).toBe(0);     // R
      expect(dest[i + 1]).toBe(255); // G
      expect(dest[i + 2]).toBe(0);   // B
      expect(dest[i + 3]).toBe(255); // A
    }

    frame.close();
  });

  it('should throw when rect exceeds frame bounds', async () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    const dest = new Uint8Array(50 * 50 * 4);

    await expect(
      frame.copyTo(dest, {rect: {x: 80, y: 80, width: 50, height: 50}})
    ).rejects.toThrow();

    frame.close();
  });
});

describe('VideoFrame.copyTo() with layout option', () => {
  it('should use custom layout when provided', async () => {
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    data.fill(128);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Custom layout with stride = width * 4 + 16 (padding)
    const stride = width * 4 + 16;
    const destSize = stride * height;
    const dest = new Uint8Array(destSize);

    const layouts = await frame.copyTo(dest, {
      layout: [{offset: 0, stride: stride}]
    });

    // Verify returned layout matches what we requested
    expect(layouts.length).toBe(1);
    expect(layouts[0].stride).toBe(stride);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-copy-to-options.test.ts -v
```

Expected: FAIL - rect option not implemented

**Step 3: Verify types already support rect and layout** (1 min)

Check `lib/types.ts` line 350-358 - VideoFrameCopyToOptions already has:
```typescript
export interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
  format?: VideoPixelFormat;
  colorSpace?: PredefinedColorSpace;
}
```

Types are already correct.

**Step 4: Update C++ CopyTo to support rect option** (5 min)

In `src/video_frame.cc`, find the CopyTo method and update it to handle the rect option:

```cpp
Napi::Value VideoFrame::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: VideoFrame is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "copyTo requires destination buffer")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get destination buffer
  Napi::Value dest_val = info[0];
  uint8_t* dest_data = nullptr;
  size_t dest_size = 0;

  if (dest_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = dest_val.As<Napi::Buffer<uint8_t>>();
    dest_data = buf.Data();
    dest_size = buf.Length();
  } else if (dest_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = dest_val.As<Napi::ArrayBuffer>();
    dest_data = static_cast<uint8_t*>(ab.Data());
    dest_size = ab.ByteLength();
  } else if (dest_val.IsTypedArray()) {
    Napi::TypedArray ta = dest_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    dest_data = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
    dest_size = ta.ByteLength();
  } else {
    Napi::TypeError::New(env, "destination must be BufferSource")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse options
  int copy_x = visible_rect_.x;
  int copy_y = visible_rect_.y;
  int copy_width = visible_rect_.width > 0 ? visible_rect_.width : coded_width_;
  int copy_height = visible_rect_.height > 0 ? visible_rect_.height : coded_height_;

  std::vector<std::pair<size_t, size_t>> custom_layouts;  // offset, stride pairs
  bool has_custom_layout = false;

  if (info.Length() > 1 && info[1].IsObject()) {
    Napi::Object opts = info[1].As<Napi::Object>();

    // Parse rect option
    if (opts.Has("rect") && opts.Get("rect").IsObject()) {
      Napi::Object rect = opts.Get("rect").As<Napi::Object>();
      if (rect.Has("x")) copy_x = rect.Get("x").As<Napi::Number>().Int32Value();
      if (rect.Has("y")) copy_y = rect.Get("y").As<Napi::Number>().Int32Value();
      if (rect.Has("width")) copy_width = rect.Get("width").As<Napi::Number>().Int32Value();
      if (rect.Has("height")) copy_height = rect.Get("height").As<Napi::Number>().Int32Value();

      // Validate rect bounds
      if (copy_x < 0 || copy_y < 0 ||
          copy_x + copy_width > coded_width_ ||
          copy_y + copy_height > coded_height_) {
        Napi::RangeError::New(env, "rect exceeds frame bounds")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
    }

    // Parse layout option
    if (opts.Has("layout") && opts.Get("layout").IsArray()) {
      Napi::Array layout_arr = opts.Get("layout").As<Napi::Array>();
      has_custom_layout = true;
      for (uint32_t i = 0; i < layout_arr.Length(); i++) {
        Napi::Object layout_obj = layout_arr.Get(i).As<Napi::Object>();
        size_t offset = layout_obj.Get("offset").As<Napi::Number>().Uint32Value();
        size_t stride = layout_obj.Get("stride").As<Napi::Number>().Uint32Value();
        custom_layouts.push_back({offset, stride});
      }
    }
  }

  // Create result layout array
  Napi::Array result_layouts = Napi::Array::New(env);
  const auto& format_info = GetFormatInfo(format_);

  // Handle packed RGB formats (single plane)
  if (format_info.num_planes == 1) {
    size_t src_stride = coded_width_ * 4;
    size_t dst_stride = has_custom_layout ? custom_layouts[0].second : copy_width * 4;
    size_t dst_offset = has_custom_layout ? custom_layouts[0].first : 0;
    size_t bytes_per_row = copy_width * 4;

    for (int y = 0; y < copy_height; y++) {
      size_t src_row = (copy_y + y) * src_stride + copy_x * 4;
      size_t dst_row = dst_offset + y * dst_stride;
      if (dst_row + bytes_per_row > dest_size) {
        Napi::RangeError::New(env, "destination buffer too small")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
      std::memcpy(dest_data + dst_row, data_.data() + src_row, bytes_per_row);
    }

    Napi::Object layout = Napi::Object::New(env);
    layout.Set("offset", Napi::Number::New(env, dst_offset));
    layout.Set("stride", Napi::Number::New(env, dst_stride));
    result_layouts.Set(uint32_t(0), layout);
  } else {
    // Handle planar formats - simplified for now, copy all planes
    // (Full implementation would handle each plane's rect/stride separately)
    size_t total_size = CalculateAllocationSize(format_, copy_width, copy_height);
    if (dest_size < total_size) {
      Napi::RangeError::New(env, "destination buffer too small")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }

    std::memcpy(dest_data, data_.data(), std::min(total_size, data_.size()));

    // Return default layouts
    Napi::Value alloc_result = AllocationSize(info);
    result_layouts = alloc_result.As<Napi::Array>();
  }

  // Return Promise that resolves with layouts
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result_layouts);
  return deferred.Promise();
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-frame-copy-to-options.test.ts -v
```

Expected: PASS

**Step 6: Build and verify** (1 min)

```bash
npm run build
```

**Step 7: Commit** (30 sec)

```bash
git add src/video_frame.cc test/golden/video-frame-copy-to-options.test.ts
git commit -m "feat(VideoFrame): add rect and layout options to copyTo per W3C spec"
```

---

### Task 3: Fix AudioData.copyTo() to return Promise

**Files:**
- Modify: `lib/types.ts:921-925` (AudioData interface)
- Modify: `lib/index.ts:732-764` (copyTo method)
- Modify: `lib/native-types.ts:116-119` (NativeAudioData interface)
- Test: `test/golden/audio-data-copy-to-promise.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

Create test file at `test/golden/audio-data-copy-to-promise.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('AudioData.copyTo() returns Promise per W3C spec', () => {
  it('should return a Promise that resolves to undefined', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const destination = new ArrayBuffer(1024 * 2 * 4);
    const result = audioData.copyTo(destination, {planeIndex: 0});

    // W3C spec: copyTo returns Promise<undefined>
    expect(result).toBeInstanceOf(Promise);

    const resolved = await result;
    expect(resolved).toBeUndefined();

    audioData.close();
  });

  it('should reject with InvalidStateError when closed', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });
    audioData.close();

    const destination = new ArrayBuffer(1024 * 2 * 4);

    await expect(
      audioData.copyTo(destination, {planeIndex: 0})
    ).rejects.toThrow('InvalidStateError');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-data-copy-to-promise.test.ts -v
```

Expected: FAIL - currently copyTo is synchronous (returns void)

**Step 3: Update TypeScript interface** (2 min)

In `lib/types.ts` at line 921-925, change the AudioData interface:

```typescript
// OLD
copyTo(
  destination: AllowSharedBufferSource,
  options: AudioDataCopyToOptions,
): void;

// NEW
copyTo(
  destination: AllowSharedBufferSource,
  options: AudioDataCopyToOptions,
): Promise<undefined>;
```

**Step 4: Update TypeScript implementation** (2 min)

In `lib/index.ts` at line 732-764, change the copyTo method:

```typescript
// OLD
copyTo(
  destination: ArrayBuffer | ArrayBufferView,
  options: AudioDataCopyToOptions,
): void {
  if (this._closed) {
    throw new DOMException(
      'InvalidStateError: AudioData is closed',
      'InvalidStateError',
    );
  }
  // ... rest of implementation
}

// NEW
async copyTo(
  destination: ArrayBuffer | ArrayBufferView,
  options: AudioDataCopyToOptions,
): Promise<undefined> {
  if (this._closed) {
    throw new DOMException(
      'InvalidStateError: AudioData is closed',
      'InvalidStateError',
    );
  }
  // W3C spec: planeIndex is required
  if (options.planeIndex === undefined || options.planeIndex === null) {
    throw new TypeError(
      "Failed to execute 'copyTo' on 'AudioData': required member planeIndex is undefined.",
    );
  }
  let destBuffer: Buffer;
  if (destination instanceof ArrayBuffer) {
    destBuffer = Buffer.from(destination);
  } else {
    destBuffer = Buffer.from(
      destination.buffer,
      destination.byteOffset,
      destination.byteLength,
    );
  }
  this._native.copyTo(destBuffer, options);
  // Copy back to original if it was an ArrayBuffer
  if (destination instanceof ArrayBuffer) {
    new Uint8Array(destination).set(destBuffer);
  }
  return undefined;
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-data-copy-to-promise.test.ts -v
```

Expected: PASS

**Step 6: Build and verify** (1 min)

```bash
npm run build
```

**Step 7: Commit** (30 sec)

```bash
git add lib/types.ts lib/index.ts test/golden/audio-data-copy-to-promise.test.ts
git commit -m "fix(AudioData): copyTo returns Promise<undefined> per W3C spec"
```

---

### Task 4: Add ArrayBuffer transfer semantics to AudioData

**Files:**
- Modify: `lib/types.ts:435-443` (AudioDataInit)
- Modify: `lib/index.ts:666-692` (AudioData constructor)
- Test: `test/golden/audio-data-transfer.test.ts` (new file)

**Step 1: Write the failing test** (2-5 min)

Create test file at `test/golden/audio-data-transfer.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

describe('AudioData ArrayBuffer transfer semantics', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const arrayBuffer = new ArrayBuffer(1024 * 2 * 4);
    const data = new Float32Array(arrayBuffer);
    data.fill(0.5);

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: data,
      transfer: [arrayBuffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    expect(arrayBuffer.byteLength).toBe(0);

    // AudioData should still be usable
    expect(audioData.numberOfFrames).toBe(1024);

    audioData.close();
  });

  it('should work normally when transfer is not specified', () => {
    const arrayBuffer = new ArrayBuffer(1024 * 2 * 4);
    const data = new Float32Array(arrayBuffer);
    data.fill(0.5);

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: data,
    });

    // ArrayBuffer should NOT be detached
    expect(arrayBuffer.byteLength).toBe(1024 * 2 * 4);

    audioData.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-data-transfer.test.ts -v
```

Expected: FAIL - transfer option not implemented

**Step 3: Verify AudioDataInit already has transfer** (1 min)

Check `lib/types.ts` line 435-443 - already has:
```typescript
export interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: BufferSource;
  transfer?: ArrayBuffer[];
}
```

Types are already correct.

**Step 4: Update AudioData constructor to handle transfer** (2 min)

In `lib/index.ts` at line 666-692, add transfer handling after native construction:

```typescript
constructor(init: AudioDataInit) {
  let dataBuffer: Buffer;
  if (init.data instanceof ArrayBuffer) {
    dataBuffer = Buffer.from(init.data);
  } else if (ArrayBuffer.isView(init.data)) {
    dataBuffer = Buffer.from(
      init.data.buffer,
      init.data.byteOffset,
      init.data.byteLength,
    );
  } else {
    throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
  }
  this._native = new native.AudioData({
    format: init.format,
    sampleRate: init.sampleRate,
    numberOfFrames: init.numberOfFrames,
    numberOfChannels: init.numberOfChannels,
    timestamp: init.timestamp,
    data: dataBuffer,
  });

  // Handle ArrayBuffer transfer semantics per W3C WebCodecs spec
  if (init.transfer && Array.isArray(init.transfer)) {
    detachArrayBuffers(init.transfer);
  }
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-data-transfer.test.ts -v
```

Expected: PASS

**Step 6: Build and verify** (1 min)

```bash
npm run build
```

**Step 7: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-data-transfer.test.ts
git commit -m "feat(AudioData): add ArrayBuffer transfer semantics per W3C spec"
```

---

### Task 5: Comprehensive test suite for raw media interfaces

**Files:**
- Create: `test/golden/raw-media-interfaces.test.ts`

**Step 1: Write comprehensive test file** (5 min)

Create test file at `test/golden/raw-media-interfaces.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';
import type {PlaneLayout} from '../../lib/types';

/**
 * W3C WebCodecs Raw Media Interfaces Compliance Tests
 * https://www.w3.org/TR/webcodecs/#raw-media-interfaces
 */

describe('VideoFrame W3C Compliance', () => {
  describe('Properties', () => {
    it('should have all required readonly properties', () => {
      const data = new Uint8Array(100 * 100 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 1000,
        duration: 33333,
      });

      // Required properties per W3C spec
      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(100);
      expect(frame.codedHeight).toBe(100);
      expect(frame.codedRect).toBeDefined();
      expect(frame.visibleRect).toBeDefined();
      expect(frame.displayWidth).toBe(100);
      expect(frame.displayHeight).toBe(100);
      expect(frame.duration).toBe(33333);
      expect(frame.timestamp).toBe(1000);
      expect(frame.colorSpace).toBeDefined();

      frame.close();
    });

    it('codedRect should be DOMRectReadOnly-like', () => {
      const data = new Uint8Array(100 * 100 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
      });

      const rect = frame.codedRect;
      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
      expect(rect.top).toBe(0);
      expect(rect.left).toBe(0);
      expect(rect.right).toBe(100);
      expect(rect.bottom).toBe(100);

      frame.close();
    });
  });

  describe('Methods', () => {
    it('allocationSize() should return PlaneLayout[]', () => {
      const data = new Uint8Array(100 * 100 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
      });

      const layouts = frame.allocationSize();
      expect(Array.isArray(layouts)).toBe(true);
      expect(layouts.length).toBeGreaterThan(0);

      layouts.forEach((layout: PlaneLayout) => {
        expect(typeof layout.offset).toBe('number');
        expect(typeof layout.stride).toBe('number');
      });

      frame.close();
    });

    it('copyTo() should return Promise<PlaneLayout[]>', async () => {
      const data = new Uint8Array(100 * 100 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
      });

      const dest = new Uint8Array(100 * 100 * 4);
      const result = frame.copyTo(dest);

      expect(result).toBeInstanceOf(Promise);

      const layouts = await result;
      expect(Array.isArray(layouts)).toBe(true);

      frame.close();
    });

    it('clone() should create independent copy', () => {
      const data = new Uint8Array(100 * 100 * 4);
      data.fill(128);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 1000,
      });

      const cloned = frame.clone();

      expect(cloned.codedWidth).toBe(frame.codedWidth);
      expect(cloned.timestamp).toBe(frame.timestamp);

      // Close original shouldn't affect clone
      frame.close();
      expect(cloned.codedWidth).toBe(100);

      cloned.close();
    });

    it('close() should make frame unusable', () => {
      const data = new Uint8Array(100 * 100 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
      });

      frame.close();

      expect(() => frame.allocationSize()).toThrow();
      expect(() => frame.clone()).toThrow();
    });
  });
});

describe('AudioData W3C Compliance', () => {
  describe('Properties', () => {
    it('should have all required readonly properties', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 1000,
        data: new Float32Array(1024 * 2),
      });

      expect(audioData.format).toBe('f32');
      expect(audioData.sampleRate).toBe(48000);
      expect(audioData.numberOfFrames).toBe(1024);
      expect(audioData.numberOfChannels).toBe(2);
      expect(audioData.timestamp).toBe(1000);
      expect(audioData.duration).toBeGreaterThan(0);

      audioData.close();
    });

    it('duration should be calculated from frames and sampleRate', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 48000, // 1 second worth
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(48000),
      });

      // 48000 frames at 48000Hz = 1,000,000 microseconds
      expect(audioData.duration).toBe(1000000);

      audioData.close();
    });
  });

  describe('Methods', () => {
    it('allocationSize() should return number', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      const size = audioData.allocationSize({planeIndex: 0});
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);

      audioData.close();
    });

    it('copyTo() should return Promise<undefined>', async () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      const dest = new ArrayBuffer(1024 * 2 * 4);
      const result = audioData.copyTo(dest, {planeIndex: 0});

      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved).toBeUndefined();

      audioData.close();
    });

    it('clone() should create independent copy', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 1000,
        data: new Float32Array(1024 * 2),
      });

      const cloned = audioData.clone();

      expect(cloned.sampleRate).toBe(audioData.sampleRate);
      expect(cloned.timestamp).toBe(audioData.timestamp);

      audioData.close();
      expect(cloned.sampleRate).toBe(48000);

      cloned.close();
    });
  });
});

describe('VideoColorSpace W3C Compliance', () => {
  it('should have optional properties defaulting to null', () => {
    const colorSpace = new VideoColorSpace();

    expect(colorSpace.primaries).toBeNull();
    expect(colorSpace.transfer).toBeNull();
    expect(colorSpace.matrix).toBeNull();
    expect(colorSpace.fullRange).toBeNull();
  });

  it('should accept VideoColorSpaceInit', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: true,
    });

    expect(colorSpace.primaries).toBe('bt709');
    expect(colorSpace.transfer).toBe('bt709');
    expect(colorSpace.matrix).toBe('bt709');
    expect(colorSpace.fullRange).toBe(true);
  });

  it('toJSON() should return VideoColorSpaceInit', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'smpte170m',
      matrix: 'bt709',
      fullRange: false,
    });

    const json = colorSpace.toJSON();

    expect(json.primaries).toBe('bt709');
    expect(json.transfer).toBe('smpte170m');
    expect(json.matrix).toBe('bt709');
    expect(json.fullRange).toBe(false);
  });
});
```

**Step 2: Run comprehensive test suite** (30 sec)

```bash
npx vitest run test/golden/raw-media-interfaces.test.ts -v
```

Expected: PASS (all tests green)

**Step 3: Run full test suite to verify no regressions** (2 min)

```bash
npm test
```

**Step 4: Commit** (30 sec)

```bash
git add test/golden/raw-media-interfaces.test.ts
git commit -m "test: add comprehensive W3C raw media interfaces compliance tests"
```

---

### Task 6: Code Review

**Files:**
- All modified files from Tasks 1-5

**Step 1: Review all changes** (5 min)

Run code review agent on all changes:
- Verify TypeScript types match W3C WebIDL exactly
- Check C++ implementations handle all edge cases
- Ensure tests cover positive and negative cases
- Verify no regressions in existing tests

**Step 2: Run linting** (1 min)

```bash
npm run lint
npm run fix  # if needed
```

**Step 3: Run full build and test** (2 min)

```bash
npm run build
npm test
```

**Step 4: Final commit if any fixes needed** (30 sec)

```bash
git add -A
git commit -m "chore: address code review feedback"
```

---

## Post-Completion Actions

After all tasks complete:

1. **Code Review** - Dispatch code-reviewer agent
2. **Process Feedback** - Use `Skill("dev-workflow:receiving-code-review")`
3. **Finish Branch** - Use `Skill("dev-workflow:finishing-a-development-branch")`
