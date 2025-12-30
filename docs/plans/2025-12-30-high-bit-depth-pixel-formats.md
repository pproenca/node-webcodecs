# High Bit-Depth Pixel Format Support (P10/P12)

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-high-bit-depth-pixel-formats.md` to implement task-by-task.

**Goal:** Add support for 10-bit and 12-bit HDR pixel formats (I420P10, I420P12, I422P10, I422P12, I444P10, I444P12, NV12P10) in the native layer.

**Architecture:** Clean architecture with a format metadata registry. A single `PixelFormatInfo` struct defines all format properties (name, FFmpeg mapping, bit depth, plane layout). All format-handling functions query this registry instead of using repetitive switch statements. Adding future formats becomes a 1-line change.

**Tech Stack:** C++17, node-addon-api (NAPI), FFmpeg libavutil

---

## Task Overview

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Core infrastructure (sequential - each builds on previous) |
| Group 2 | 4, 5, 6 | Refactor existing functions to use registry (can parallelize) |
| Group 3 | 7, 8 | Plane setup and CopyTo (sequential - depends on Group 2) |
| Group 4 | 9 | Integration tests (depends on all previous) |
| Group 5 | 10 | Code review |

---

### Task 1: Define PixelFormatInfo Struct and Extended Enum

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h:21-32`

**Step 1: Read current enum definition** (30 sec)

Review the current `PixelFormat` enum in video_frame.h to understand the existing structure.

**Step 2: Write the failing test** (3 min)

Create test file `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-high-bit-depth.test.ts`:

```typescript
import {describe, it, expect, beforeEach, afterEach} from 'vitest';

describe('VideoFrame High Bit-Depth Formats', () => {
  describe('format parsing', () => {
    it('should accept I420P10 format string', () => {
      const frame = new VideoFrame(
        new Uint16Array(1920 * 1080 * 3), // Y + U + V at 2 bytes/sample
        {
          format: 'I420P10',
          codedWidth: 1920,
          codedHeight: 1080,
          timestamp: 0,
        }
      );
      expect(frame.format).toBe('I420P10');
      frame.close();
    });

    it('should accept I420P12 format string', () => {
      const frame = new VideoFrame(
        new Uint16Array(1920 * 1080 * 3),
        {
          format: 'I420P12',
          codedWidth: 1920,
          codedHeight: 1080,
          timestamp: 0,
        }
      );
      expect(frame.format).toBe('I420P12');
      frame.close();
    });
  });
});
```

**Step 3: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "should accept I420P10"
```

Expected: FAIL with error about unknown format or format validation failure.

**Step 4: Add PixelFormatInfo struct to video_frame.h** (5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h`, add after the includes but before the PixelFormat enum:

```cpp
// Forward declaration for FFmpeg type
extern "C" {
#include <libavutil/pixfmt.h>
}

// Metadata describing a pixel format's properties
struct PixelFormatInfo {
  const char* name;           // WebCodecs format string (e.g., "I420P10")
  AVPixelFormat av_format;    // FFmpeg pixel format enum
  int bit_depth;              // Bits per sample (8, 10, or 12)
  int num_planes;             // Number of planes (3 for YUV, 4 for YUVA)
  int chroma_h_shift;         // Horizontal chroma subsampling (1 = half width)
  int chroma_v_shift;         // Vertical chroma subsampling (1 = half height)
  bool has_alpha;             // Whether format includes alpha plane
  bool is_semi_planar;        // NV12-style interleaved UV plane
};

// Get format metadata by enum value. Returns info with UNKNOWN if not found.
const PixelFormatInfo& GetFormatInfo(PixelFormat format);
```

**Step 5: Extend PixelFormat enum with high bit-depth values** (2 min)

Replace the existing enum in `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.h`:

```cpp
enum class PixelFormat {
  // 8-bit formats
  RGBA,
  RGBX,
  BGRA,
  BGRX,
  I420,
  I420A,
  I422,
  I444,
  NV12,
  // 10-bit formats
  I420P10,
  I422P10,
  I444P10,
  NV12P10,
  // 12-bit formats
  I420P12,
  I422P12,
  I444P12,
  // Unknown/invalid
  UNKNOWN
};
```

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.h
git commit -m "$(cat <<'EOF'
feat(video-frame): add PixelFormatInfo struct and high bit-depth enum values

Adds I420P10, I420P12, I422P10, I422P12, I444P10, I444P12, NV12P10 to
PixelFormat enum. Introduces PixelFormatInfo struct for format metadata
registry pattern.
EOF
)"
```

---

### Task 2: Implement Format Registry Table

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc:1-100`

**Step 1: Read current format functions** (1 min)

Review `ParsePixelFormat()`, `PixelFormatToString()`, and `PixelFormatToAV()` in video_frame.cc to understand their current implementation.

**Step 2: Add format registry table** (5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`, add after the includes:

```cpp
#include <unordered_map>

// Format registry: single source of truth for all pixel format metadata
static const std::unordered_map<PixelFormat, PixelFormatInfo> kFormatRegistry = {
    // 8-bit RGB formats
    {PixelFormat::RGBA,    {"RGBA",    AV_PIX_FMT_RGBA,         8, 1, 0, 0, true,  false}},
    {PixelFormat::RGBX,    {"RGBX",    AV_PIX_FMT_RGB0,         8, 1, 0, 0, false, false}},
    {PixelFormat::BGRA,    {"BGRA",    AV_PIX_FMT_BGRA,         8, 1, 0, 0, true,  false}},
    {PixelFormat::BGRX,    {"BGRX",    AV_PIX_FMT_BGR0,         8, 1, 0, 0, false, false}},
    // 8-bit YUV formats (4:2:0)
    {PixelFormat::I420,    {"I420",    AV_PIX_FMT_YUV420P,      8, 3, 1, 1, false, false}},
    {PixelFormat::I420A,   {"I420A",   AV_PIX_FMT_YUVA420P,     8, 4, 1, 1, true,  false}},
    // 8-bit YUV formats (4:2:2)
    {PixelFormat::I422,    {"I422",    AV_PIX_FMT_YUV422P,      8, 3, 1, 0, false, false}},
    // 8-bit YUV formats (4:4:4)
    {PixelFormat::I444,    {"I444",    AV_PIX_FMT_YUV444P,      8, 3, 0, 0, false, false}},
    // 8-bit semi-planar
    {PixelFormat::NV12,    {"NV12",    AV_PIX_FMT_NV12,         8, 2, 1, 1, false, true}},
    // 10-bit YUV formats
    {PixelFormat::I420P10, {"I420P10", AV_PIX_FMT_YUV420P10LE, 10, 3, 1, 1, false, false}},
    {PixelFormat::I422P10, {"I422P10", AV_PIX_FMT_YUV422P10LE, 10, 3, 1, 0, false, false}},
    {PixelFormat::I444P10, {"I444P10", AV_PIX_FMT_YUV444P10LE, 10, 3, 0, 0, false, false}},
    {PixelFormat::NV12P10, {"NV12P10", AV_PIX_FMT_P010LE,      10, 2, 1, 1, false, true}},
    // 12-bit YUV formats
    {PixelFormat::I420P12, {"I420P12", AV_PIX_FMT_YUV420P12LE, 12, 3, 1, 1, false, false}},
    {PixelFormat::I422P12, {"I422P12", AV_PIX_FMT_YUV422P12LE, 12, 3, 1, 0, false, false}},
    {PixelFormat::I444P12, {"I444P12", AV_PIX_FMT_YUV444P12LE, 12, 3, 0, 0, false, false}},
    // Unknown sentinel
    {PixelFormat::UNKNOWN, {"UNKNOWN", AV_PIX_FMT_NONE,         0, 0, 0, 0, false, false}},
};

// Reverse lookup: string name to PixelFormat enum
static const std::unordered_map<std::string, PixelFormat> kFormatNameLookup = []() {
    std::unordered_map<std::string, PixelFormat> lookup;
    for (const auto& [format, info] : kFormatRegistry) {
        if (format != PixelFormat::UNKNOWN) {
            lookup[info.name] = format;
        }
    }
    return lookup;
}();

// Sentinel for unknown formats
static const PixelFormatInfo kUnknownFormatInfo = {"UNKNOWN", AV_PIX_FMT_NONE, 0, 0, 0, 0, false, false};

const PixelFormatInfo& GetFormatInfo(PixelFormat format) {
    auto it = kFormatRegistry.find(format);
    if (it != kFormatRegistry.end()) {
        return it->second;
    }
    return kUnknownFormatInfo;
}
```

**Step 3: Build native addon to verify compilation** (1 min)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 4: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "$(cat <<'EOF'
feat(video-frame): add pixel format registry table

Single source of truth for all format metadata including FFmpeg mapping,
bit depth, plane count, chroma subsampling, and alpha/semi-planar flags.
EOF
)"
```

---

### Task 3: Refactor ParsePixelFormat to Use Registry

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (ParsePixelFormat function)

**Step 1: Locate current ParsePixelFormat implementation** (30 sec)

Find the `ParsePixelFormat` function in video_frame.cc (around line 35-60).

**Step 2: Refactor ParsePixelFormat to use registry** (3 min)

Replace the existing switch-based implementation with:

```cpp
PixelFormat ParsePixelFormat(const std::string& format_str) {
    auto it = kFormatNameLookup.find(format_str);
    if (it != kFormatNameLookup.end()) {
        return it->second;
    }
    return PixelFormat::UNKNOWN;
}
```

**Step 3: Build and run test** (1 min)

```bash
npm run build:native && npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "should accept I420P10"
```

Expected: Still fails (we haven't updated allocation size yet), but format parsing should work.

**Step 4: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "$(cat <<'EOF'
refactor(video-frame): ParsePixelFormat uses registry lookup

Replaces switch statement with O(1) hash map lookup from kFormatNameLookup.
EOF
)"
```

---

### Task 4: Refactor PixelFormatToString to Use Registry

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (PixelFormatToString function)

**Step 1: Refactor PixelFormatToString** (2 min)

Replace the existing implementation with:

```cpp
std::string PixelFormatToString(PixelFormat format) {
    return GetFormatInfo(format).name;
}
```

**Step 2: Build to verify** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds.

**Step 3: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "$(cat <<'EOF'
refactor(video-frame): PixelFormatToString uses registry

Single line implementation using GetFormatInfo().
EOF
)"
```

---

### Task 5: Refactor PixelFormatToAV to Use Registry

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (PixelFormatToAV function)

**Step 1: Refactor PixelFormatToAV** (2 min)

Replace the existing implementation with:

```cpp
AVPixelFormat PixelFormatToAV(PixelFormat format) {
    return GetFormatInfo(format).av_format;
}
```

**Step 2: Build to verify** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds.

**Step 3: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "$(cat <<'EOF'
refactor(video-frame): PixelFormatToAV uses registry

Single line implementation using GetFormatInfo().
EOF
)"
```

---

### Task 6: Refactor CalculateAllocationSize for High Bit-Depth

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (CalculateAllocationSize function)

**Step 1: Write test for allocation size** (3 min)

Add to `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-high-bit-depth.test.ts`:

```typescript
describe('allocation size', () => {
  it('should calculate correct size for I420P10 (2 bytes per sample)', () => {
    // I420P10: Y (w*h*2) + U (w/2 * h/2 * 2) + V (w/2 * h/2 * 2)
    // For 1920x1080: 1920*1080*2 + 960*540*2 + 960*540*2 = 4,147,200 + 1,036,800 + 1,036,800 = 6,220,800
    const width = 1920;
    const height = 1080;
    const expectedSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;

    // Create frame with exact buffer size
    const buffer = new ArrayBuffer(expectedSize);
    const frame = new VideoFrame(buffer, {
      format: 'I420P10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.format).toBe('I420P10');
    expect(frame.allocationSize()).toBe(expectedSize);
    frame.close();
  });

  it('should calculate correct size for I444P12 (no chroma subsampling)', () => {
    // I444P12: Y (w*h*2) + U (w*h*2) + V (w*h*2) = w*h*6
    const width = 1920;
    const height = 1080;
    const expectedSize = width * height * 2 * 3;

    const buffer = new ArrayBuffer(expectedSize);
    const frame = new VideoFrame(buffer, {
      format: 'I444P12',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.format).toBe('I444P12');
    expect(frame.allocationSize()).toBe(expectedSize);
    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "allocation size"
```

Expected: FAIL - allocation size calculation doesn't handle high bit-depth.

**Step 3: Refactor CalculateAllocationSize** (5 min)

Replace the existing implementation in `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`:

```cpp
size_t CalculateAllocationSize(PixelFormat format, uint32_t width, uint32_t height) {
    const auto& info = GetFormatInfo(format);

    if (info.bit_depth == 0) {
        return 0;  // Unknown format
    }

    // Bytes per sample: 1 for 8-bit, 2 for 10-bit and 12-bit
    size_t bytes_per_sample = (info.bit_depth + 7) / 8;

    // Handle packed RGB formats (single plane, 4 bytes per pixel for RGBA/BGRA)
    if (info.num_planes == 1) {
        size_t bytes_per_pixel = info.has_alpha ? 4 : 4;  // RGBA, RGBX, BGRA, BGRX all 4 bytes
        return width * height * bytes_per_pixel;
    }

    // Y plane size
    size_t y_size = width * height * bytes_per_sample;

    // Chroma plane dimensions
    size_t chroma_width = width >> info.chroma_h_shift;
    size_t chroma_height = height >> info.chroma_v_shift;

    if (info.is_semi_planar) {
        // NV12-style: Y plane + interleaved UV plane
        // UV plane has same height as chroma, but double width (U and V interleaved)
        size_t uv_size = chroma_width * 2 * chroma_height * bytes_per_sample;
        return y_size + uv_size;
    }

    // Planar YUV: Y + U + V (+ optional A)
    size_t uv_size = chroma_width * chroma_height * bytes_per_sample;
    size_t total = y_size + uv_size * 2;  // U and V planes

    if (info.has_alpha) {
        total += y_size;  // Alpha plane same size as Y
    }

    return total;
}
```

**Step 4: Build and run test** (1 min)

```bash
npm run build:native && npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "allocation size"
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_frame.cc test/golden/video-frame-high-bit-depth.test.ts
git commit -m "$(cat <<'EOF'
feat(video-frame): generic allocation size for all bit depths

Uses format registry metadata to calculate buffer sizes. Supports 8/10/12-bit
formats with correct bytes-per-sample calculation.
EOF
)"
```

---

### Task 7: Update Plane Setup Helpers for High Bit-Depth

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (SetupSourcePlanes, SetupDestPlanes functions)

**Step 1: Write test for plane layout** (3 min)

Add to `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-high-bit-depth.test.ts`:

```typescript
describe('copyTo with high bit-depth', () => {
  it('should copy I420P10 frame data correctly', async () => {
    const width = 64;
    const height = 64;
    // I420P10: 2 bytes per sample
    const ySize = width * height * 2;
    const uvSize = (width / 2) * (height / 2) * 2;
    const totalSize = ySize + uvSize * 2;

    // Create source buffer with known pattern
    const sourceBuffer = new ArrayBuffer(totalSize);
    const sourceView = new Uint16Array(sourceBuffer);
    // Fill Y plane with 0x0100 (256 in 10-bit range)
    for (let i = 0; i < (ySize / 2); i++) {
      sourceView[i] = 0x0100;
    }
    // Fill U plane with 0x0200
    for (let i = ySize / 2; i < (ySize + uvSize) / 2; i++) {
      sourceView[i] = 0x0200;
    }
    // Fill V plane with 0x0300
    for (let i = (ySize + uvSize) / 2; i < totalSize / 2; i++) {
      sourceView[i] = 0x0300;
    }

    const frame = new VideoFrame(sourceBuffer, {
      format: 'I420P10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Copy to destination
    const destBuffer = new ArrayBuffer(totalSize);
    await frame.copyTo(destBuffer);

    const destView = new Uint16Array(destBuffer);
    // Verify Y plane
    expect(destView[0]).toBe(0x0100);
    // Verify U plane
    expect(destView[ySize / 2]).toBe(0x0200);
    // Verify V plane
    expect(destView[(ySize + uvSize) / 2]).toBe(0x0300);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "copyTo with high bit-depth"
```

Expected: FAIL - plane setup doesn't handle 16-bit strides.

**Step 3: Update SetupSourcePlanes for high bit-depth** (5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`, update `SetupSourcePlanes()` to use format metadata for stride calculation:

```cpp
void SetupSourcePlanes(const uint8_t* data, PixelFormat format,
                       uint32_t width, uint32_t height,
                       uint8_t* planes[4], int linesize[4]) {
    const auto& info = GetFormatInfo(format);
    size_t bytes_per_sample = (info.bit_depth + 7) / 8;

    // Handle packed RGB formats
    if (info.num_planes == 1) {
        planes[0] = const_cast<uint8_t*>(data);
        linesize[0] = width * 4;  // RGBA/BGRA = 4 bytes per pixel
        return;
    }

    // Y plane
    size_t y_stride = width * bytes_per_sample;
    size_t y_size = y_stride * height;
    planes[0] = const_cast<uint8_t*>(data);
    linesize[0] = static_cast<int>(y_stride);

    // Chroma dimensions
    size_t chroma_width = width >> info.chroma_h_shift;
    size_t chroma_height = height >> info.chroma_v_shift;
    size_t chroma_stride = chroma_width * bytes_per_sample;

    if (info.is_semi_planar) {
        // NV12-style: interleaved UV
        planes[1] = const_cast<uint8_t*>(data + y_size);
        linesize[1] = static_cast<int>(chroma_width * 2 * bytes_per_sample);
        return;
    }

    // Planar U and V
    size_t uv_size = chroma_stride * chroma_height;
    planes[1] = const_cast<uint8_t*>(data + y_size);
    linesize[1] = static_cast<int>(chroma_stride);
    planes[2] = const_cast<uint8_t*>(data + y_size + uv_size);
    linesize[2] = static_cast<int>(chroma_stride);

    // Alpha plane if present
    if (info.has_alpha) {
        planes[3] = const_cast<uint8_t*>(data + y_size + uv_size * 2);
        linesize[3] = static_cast<int>(y_stride);
    }
}
```

**Step 4: Update SetupDestPlanes similarly** (3 min)

Apply the same pattern to `SetupDestPlanes()`:

```cpp
void SetupDestPlanes(uint8_t* data, PixelFormat format,
                     uint32_t width, uint32_t height,
                     uint8_t* planes[4], int linesize[4]) {
    // Same implementation as SetupSourcePlanes but with non-const data
    const auto& info = GetFormatInfo(format);
    size_t bytes_per_sample = (info.bit_depth + 7) / 8;

    if (info.num_planes == 1) {
        planes[0] = data;
        linesize[0] = width * 4;
        return;
    }

    size_t y_stride = width * bytes_per_sample;
    size_t y_size = y_stride * height;
    planes[0] = data;
    linesize[0] = static_cast<int>(y_stride);

    size_t chroma_width = width >> info.chroma_h_shift;
    size_t chroma_height = height >> info.chroma_v_shift;
    size_t chroma_stride = chroma_width * bytes_per_sample;

    if (info.is_semi_planar) {
        planes[1] = data + y_size;
        linesize[1] = static_cast<int>(chroma_width * 2 * bytes_per_sample);
        return;
    }

    size_t uv_size = chroma_stride * chroma_height;
    planes[1] = data + y_size;
    linesize[1] = static_cast<int>(chroma_stride);
    planes[2] = data + y_size + uv_size;
    linesize[2] = static_cast<int>(chroma_stride);

    if (info.has_alpha) {
        planes[3] = data + y_size + uv_size * 2;
        linesize[3] = static_cast<int>(y_stride);
    }
}
```

**Step 5: Build and run test** (1 min)

```bash
npm run build:native && npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "copyTo with high bit-depth"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.cc test/golden/video-frame-high-bit-depth.test.ts
git commit -m "$(cat <<'EOF'
feat(video-frame): plane setup supports high bit-depth formats

SetupSourcePlanes and SetupDestPlanes now use format metadata for
stride calculation, supporting 10-bit and 12-bit samples correctly.
EOF
)"
```

---

### Task 8: Update CopyTo PlaneLayout Output

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc` (CopyTo function's PlaneLayout output)

**Step 1: Write test for PlaneLayout metadata** (3 min)

Add to `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-high-bit-depth.test.ts`:

```typescript
describe('PlaneLayout for high bit-depth', () => {
  it('should return correct plane layout for I420P10', async () => {
    const width = 64;
    const height = 64;
    const totalSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;
    const buffer = new ArrayBuffer(totalSize);

    const frame = new VideoFrame(buffer, {
      format: 'I420P10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    const destBuffer = new ArrayBuffer(totalSize);
    const layout = await frame.copyTo(destBuffer);

    expect(layout).toHaveLength(3); // Y, U, V planes

    // Y plane: offset 0, stride = width * 2 bytes
    expect(layout[0].offset).toBe(0);
    expect(layout[0].stride).toBe(width * 2);

    // U plane: offset after Y, stride = (width/2) * 2 bytes
    const ySize = width * height * 2;
    expect(layout[1].offset).toBe(ySize);
    expect(layout[1].stride).toBe((width / 2) * 2);

    // V plane: offset after Y+U
    const uvSize = (width / 2) * (height / 2) * 2;
    expect(layout[2].offset).toBe(ySize + uvSize);
    expect(layout[2].stride).toBe((width / 2) * 2);

    frame.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "PlaneLayout for high bit-depth"
```

Expected: FAIL if PlaneLayout doesn't account for 16-bit samples.

**Step 3: Update CopyTo PlaneLayout generation** (5 min)

In `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_frame.cc`, update the `CopyTo` function's PlaneLayout output section to use format metadata:

```cpp
// In CopyTo function, where PlaneLayout is generated:
const auto& info = GetFormatInfo(format_);
size_t bytes_per_sample = (info.bit_depth + 7) / 8;

Napi::Array layout = Napi::Array::New(env);

if (info.num_planes == 1) {
    // Packed RGB format
    Napi::Object plane = Napi::Object::New(env);
    plane.Set("offset", Napi::Number::New(env, 0));
    plane.Set("stride", Napi::Number::New(env, coded_width_ * 4));
    layout.Set(uint32_t(0), plane);
} else {
    size_t y_stride = coded_width_ * bytes_per_sample;
    size_t y_size = y_stride * coded_height_;

    size_t chroma_width = coded_width_ >> info.chroma_h_shift;
    size_t chroma_height = coded_height_ >> info.chroma_v_shift;
    size_t chroma_stride = chroma_width * bytes_per_sample;
    size_t uv_size = chroma_stride * chroma_height;

    // Y plane
    Napi::Object yPlane = Napi::Object::New(env);
    yPlane.Set("offset", Napi::Number::New(env, 0));
    yPlane.Set("stride", Napi::Number::New(env, y_stride));
    layout.Set(uint32_t(0), yPlane);

    if (info.is_semi_planar) {
        // UV plane (interleaved)
        Napi::Object uvPlane = Napi::Object::New(env);
        uvPlane.Set("offset", Napi::Number::New(env, y_size));
        uvPlane.Set("stride", Napi::Number::New(env, chroma_width * 2 * bytes_per_sample));
        layout.Set(uint32_t(1), uvPlane);
    } else {
        // U plane
        Napi::Object uPlane = Napi::Object::New(env);
        uPlane.Set("offset", Napi::Number::New(env, y_size));
        uPlane.Set("stride", Napi::Number::New(env, chroma_stride));
        layout.Set(uint32_t(1), uPlane);

        // V plane
        Napi::Object vPlane = Napi::Object::New(env);
        vPlane.Set("offset", Napi::Number::New(env, y_size + uv_size));
        vPlane.Set("stride", Napi::Number::New(env, chroma_stride));
        layout.Set(uint32_t(2), vPlane);

        // Alpha plane if present
        if (info.has_alpha) {
            Napi::Object aPlane = Napi::Object::New(env);
            aPlane.Set("offset", Napi::Number::New(env, y_size + uv_size * 2));
            aPlane.Set("stride", Napi::Number::New(env, y_stride));
            layout.Set(uint32_t(3), aPlane);
        }
    }
}
```

**Step 4: Build and run test** (1 min)

```bash
npm run build:native && npx vitest run test/golden/video-frame-high-bit-depth.test.ts -t "PlaneLayout for high bit-depth"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_frame.cc test/golden/video-frame-high-bit-depth.test.ts
git commit -m "$(cat <<'EOF'
feat(video-frame): CopyTo returns correct PlaneLayout for high bit-depth

PlaneLayout offsets and strides now correctly account for 16-bit samples
in 10-bit and 12-bit formats.
EOF
)"
```

---

### Task 9: Integration Tests for All P10/P12 Formats

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/golden/video-frame-high-bit-depth.test.ts`

**Step 1: Write comprehensive tests for all formats** (5 min)

Add comprehensive test suite:

```typescript
describe('all high bit-depth formats', () => {
  const formats = [
    {name: 'I420P10', chromaH: 2, chromaV: 2, bitDepth: 10, planes: 3},
    {name: 'I420P12', chromaH: 2, chromaV: 2, bitDepth: 12, planes: 3},
    {name: 'I422P10', chromaH: 2, chromaV: 1, bitDepth: 10, planes: 3},
    {name: 'I422P12', chromaH: 2, chromaV: 1, bitDepth: 12, planes: 3},
    {name: 'I444P10', chromaH: 1, chromaV: 1, bitDepth: 10, planes: 3},
    {name: 'I444P12', chromaH: 1, chromaV: 1, bitDepth: 12, planes: 3},
    {name: 'NV12P10', chromaH: 2, chromaV: 2, bitDepth: 10, planes: 2},
  ];

  formats.forEach(({name, chromaH, chromaV, bitDepth, planes}) => {
    it(`should create and copy ${name} frame`, async () => {
      const width = 64;
      const height = 64;
      const bytesPerSample = Math.ceil(bitDepth / 8);

      // Calculate expected size
      const ySize = width * height * bytesPerSample;
      const chromaWidth = width / chromaH;
      const chromaHeight = height / chromaV;
      let totalSize: number;

      if (planes === 2) {
        // Semi-planar (NV12P10)
        totalSize = ySize + chromaWidth * 2 * chromaHeight * bytesPerSample;
      } else {
        totalSize = ySize + chromaWidth * chromaHeight * bytesPerSample * 2;
      }

      const buffer = new ArrayBuffer(totalSize);
      const frame = new VideoFrame(buffer, {
        format: name as VideoPixelFormat,
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe(name);
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);

      // Verify copyTo works
      const destBuffer = new ArrayBuffer(totalSize);
      const layout = await frame.copyTo(destBuffer);
      expect(layout).toHaveLength(planes);

      frame.close();
    });
  });
});
```

**Step 2: Run all high bit-depth tests** (1 min)

```bash
npx vitest run test/golden/video-frame-high-bit-depth.test.ts
```

Expected: All tests pass.

**Step 3: Run full test suite to verify no regressions** (2 min)

```bash
npm test
```

Expected: All existing tests still pass.

**Step 4: Commit** (30 sec)

```bash
git add test/golden/video-frame-high-bit-depth.test.ts
git commit -m "$(cat <<'EOF'
test(video-frame): comprehensive tests for all P10/P12 formats

Tests I420P10, I420P12, I422P10, I422P12, I444P10, I444P12, NV12P10
for frame creation, format parsing, allocation size, and copyTo.
EOF
)"
```

---

### Task 10: Update TODO.md and Documentation

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/TODO.md`
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/lib/index.ts` (header comment)

**Step 1: Update TODO.md** (2 min)

Mark the high bit-depth item as done:

```markdown
- [x] High bit-depth pixel formats (P10/P12 variants) not supported in native layer (line 10) - DONE
```

**Step 2: Update lib/index.ts header comment** (2 min)

Remove or update the line about high bit-depth not being supported.

**Step 3: Commit** (30 sec)

```bash
git add TODO.md lib/index.ts
git commit -m "$(cat <<'EOF'
docs: mark high bit-depth pixel formats as implemented

P10/P12 variants (I420P10, I420P12, I422P10, I422P12, I444P10, I444P12,
NV12P10) now supported in native layer.
EOF
)"
```

---

### Task 11: Code Review

**Files:**
- All modified files from previous tasks

**Step 1: Run linting** (1 min)

```bash
npm run lint
```

Fix any issues.

**Step 2: Run full test suite** (2 min)

```bash
npm test
```

Verify all tests pass.

**Step 3: Review changes** (5 min)

```bash
git log --oneline -10
git diff HEAD~10..HEAD --stat
```

Verify:
- [ ] All commits have descriptive messages
- [ ] No debug code left in
- [ ] No unnecessary changes
- [ ] Tests cover all new functionality

**Step 4: Final commit if any cleanup needed** (30 sec)

```bash
# Only if cleanup was needed
git add -A
git commit -m "chore: code review cleanup"
```
