# AudioData Partial Copy and Format Conversion Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-audiodata-partial-copy-format-conversion.md` to implement task-by-task.

**Goal:** Implement W3C WebCodecs-compliant `AudioData.allocationSize()` and `AudioData.copyTo()` with partial copy (planeIndex, frameOffset, frameCount) and format conversion support.

**Architecture:** Minimal changes approach - all logic inline in `src/audio_data.cc`. Add format-to-AVSampleFormat mapping, options parsing, partial copy with memcpy, and format conversion using libswresample. No new abstractions.

**Tech Stack:** C++ (N-API), FFmpeg libswresample, Vitest for tests

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Foundation: format mapping and helpers |
| Group 2 | 2, 3 | AllocationSize and tests can run in parallel |
| Group 3 | 4, 5 | CopyTo same-format and tests |
| Group 4 | 6, 7 | CopyTo format conversion and tests |
| Group 5 | 8 | Code review |

---

### Task 1: Add FFmpeg Format Mapping Helper

**Files:**
- Modify: `src/audio_data.cc:1-12` (add include and helper in anonymous namespace)

**Step 1: Add swresample include** (2 min)

In `src/audio_data.cc`, add the FFmpeg swresample include after line 4:

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_data.h"

extern "C" {
#include <libswresample/swresample.h>
}

#include <cstring>
#include <string>
```

**Step 2: Add format mapping helper** (3 min)

In `src/audio_data.cc`, expand the anonymous namespace after line 11:

```cpp
namespace {
constexpr int kMicrosecondsPerSecond = 1000000;

// Map WebCodecs format string to FFmpeg AVSampleFormat.
AVSampleFormat ParseAudioFormat(const std::string& format) {
  if (format == "u8") return AV_SAMPLE_FMT_U8;
  if (format == "s16") return AV_SAMPLE_FMT_S16;
  if (format == "s32") return AV_SAMPLE_FMT_S32;
  if (format == "f32") return AV_SAMPLE_FMT_FLT;
  if (format == "u8-planar") return AV_SAMPLE_FMT_U8P;
  if (format == "s16-planar") return AV_SAMPLE_FMT_S16P;
  if (format == "s32-planar") return AV_SAMPLE_FMT_S32P;
  if (format == "f32-planar") return AV_SAMPLE_FMT_FLTP;
  return AV_SAMPLE_FMT_NONE;
}

// Get bytes per sample for a format string.
size_t GetFormatBytesPerSample(const std::string& format) {
  if (format == "u8" || format == "u8-planar") return 1;
  if (format == "s16" || format == "s16-planar") return 2;
  return 4;  // s32, f32, and their planar variants
}

// Check if format is planar.
bool IsPlanarFormat(const std::string& format) {
  return format.find("-planar") != std::string::npos;
}
}  // namespace
```

**Step 3: Verify build compiles** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 4: Commit** (30 sec)

```bash
git add src/audio_data.cc
git commit -m "$(cat <<'EOF'
feat(audio): add FFmpeg format mapping helpers for AudioData

Add ParseAudioFormat, GetFormatBytesPerSample, and IsPlanarFormat
helpers to support upcoming partial copy and format conversion.
EOF
)"
```

---

### Task 2: Implement AllocationSize with Options

**Files:**
- Modify: `src/audio_data.cc:215-226` (AllocationSize method)

**Step 1: Write failing test for AllocationSize with planeIndex** (3 min)

Create or update `test/golden/core-types.test.ts`. Add after line 231 (inside the `allocationSize` describe block):

```typescript
    it('should throw RangeError for invalid planeIndex on interleaved', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      expect(() => audioData.allocationSize({ planeIndex: 1 })).toThrow();
      audioData.close();
    });

    it('should return correct size with frameOffset and frameCount', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Request only 100 frames starting at offset 50
      const size = audioData.allocationSize({
        planeIndex: 0,
        frameOffset: 50,
        frameCount: 100,
      });
      expect(size).toBe(100 * numberOfChannels * 4); // 100 frames * 2 channels * 4 bytes

      audioData.close();
    });
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm test -- --run -t "should throw RangeError for invalid planeIndex"
```

Expected: FAIL (current implementation ignores options)

**Step 3: Implement AllocationSize with options parsing** (5 min)

Replace the `AllocationSize` method in `src/audio_data.cc` (lines 215-226):

```cpp
Napi::Value AudioData::AllocationSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse options object (required per W3C spec).
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "allocationSize requires options object")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object options = info[0].As<Napi::Object>();

  // Required: planeIndex.
  if (!options.Has("planeIndex") || !options.Get("planeIndex").IsNumber()) {
    Napi::TypeError::New(env, "options.planeIndex is required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  uint32_t plane_index =
      options.Get("planeIndex").As<Napi::Number>().Uint32Value();

  // Validate planeIndex.
  bool is_planar = IsPlanar();
  if (!is_planar && plane_index != 0) {
    Napi::RangeError::New(env,
                          "planeIndex must be 0 for interleaved formats")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  if (is_planar && plane_index >= number_of_channels_) {
    Napi::RangeError::New(env, "planeIndex out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Optional: frameOffset (default 0).
  uint32_t frame_offset = 0;
  if (options.Has("frameOffset") && options.Get("frameOffset").IsNumber()) {
    frame_offset = options.Get("frameOffset").As<Napi::Number>().Uint32Value();
  }
  if (frame_offset >= number_of_frames_) {
    Napi::RangeError::New(env, "frameOffset out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Optional: frameCount (default remaining frames).
  uint32_t frame_count = number_of_frames_ - frame_offset;
  if (options.Has("frameCount") && options.Get("frameCount").IsNumber()) {
    frame_count = options.Get("frameCount").As<Napi::Number>().Uint32Value();
    if (frame_offset + frame_count > number_of_frames_) {
      frame_count = number_of_frames_ - frame_offset;
    }
  }

  // Optional: format (default current format).
  std::string target_format = format_;
  if (options.Has("format") && options.Get("format").IsString()) {
    target_format = options.Get("format").As<Napi::String>().Utf8Value();
  }

  // Calculate allocation size.
  size_t bytes_per_sample = GetFormatBytesPerSample(target_format);
  bool target_planar = IsPlanarFormat(target_format);

  size_t size;
  if (target_planar) {
    // Planar output: single channel plane.
    size = frame_count * bytes_per_sample;
  } else {
    // Interleaved output: all channels.
    size = frame_count * number_of_channels_ * bytes_per_sample;
  }

  return Napi::Number::New(env, static_cast<double>(size));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build && npm test -- --run -t "allocationSize"
```

Expected: All allocationSize tests PASS

**Step 5: Commit** (30 sec)

```bash
git add src/audio_data.cc test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): implement AudioData.allocationSize with options

Support planeIndex, frameOffset, frameCount, and format options
per W3C WebCodecs spec. Validates planeIndex for planar vs
interleaved formats.
EOF
)"
```

---

### Task 3: Add AllocationSize Tests for Planar and Format Conversion

**Files:**
- Modify: `test/golden/core-types.test.ts` (add more allocationSize tests)

**Step 1: Write test for planar format planeIndex** (3 min)

Add after the previous allocationSize tests:

```typescript
    it('should return per-plane size for planar format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Each plane is just one channel
      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(numberOfFrames * 4);
      expect(audioData.allocationSize({ planeIndex: 1 })).toBe(numberOfFrames * 4);

      audioData.close();
    });

    it('should calculate size for format conversion', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert f32 (4 bytes) to s16 (2 bytes)
      const size = audioData.allocationSize({
        planeIndex: 0,
        format: 's16',
      });
      expect(size).toBe(numberOfFrames * numberOfChannels * 2);

      audioData.close();
    });
```

**Step 2: Run tests to verify they pass** (30 sec)

```bash
npm test -- --run -t "allocationSize"
```

Expected: All PASS (implementation from Task 2 already supports these)

**Step 3: Commit** (30 sec)

```bash
git add test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
test(audio): add allocationSize tests for planar and format conversion
EOF
)"
```

---

### Task 4: Implement CopyTo Same-Format Partial Copy

**Files:**
- Modify: `src/audio_data.cc:228-275` (CopyTo method)

**Step 1: Write failing test for partial copy** (3 min)

Add a new describe block in `test/golden/core-types.test.ts` after the `allocationSize` block:

```typescript
  describe('copyTo', () => {
    it('should copy partial frames with frameOffset and frameCount', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Create data with recognizable pattern: frame index * 0.01
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        for (let c = 0; c < numberOfChannels; c++) {
          data[i * numberOfChannels + c] = i * 0.01;
        }
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Copy frames 10-19 (10 frames)
      const copySize = audioData.allocationSize({
        planeIndex: 0,
        frameOffset: 10,
        frameCount: 10,
      });
      const dest = new Float32Array(copySize / 4);
      audioData.copyTo(dest, { planeIndex: 0, frameOffset: 10, frameCount: 10 });

      // Verify first sample is from frame 10
      expect(dest[0]).toBeCloseTo(0.10, 5);
      // Verify last sample is from frame 19
      expect(dest[dest.length - 1]).toBeCloseTo(0.19, 5);

      audioData.close();
    });

    it('should copy single plane from planar format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Planar: all channel 0 samples, then all channel 1 samples
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      // Channel 0: values 0.0 to 0.99
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = i * 0.01;
      }
      // Channel 1: values 1.0 to 1.99
      for (let i = 0; i < numberOfFrames; i++) {
        data[numberOfFrames + i] = 1.0 + i * 0.01;
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Copy plane 1 (channel 1)
      const copySize = audioData.allocationSize({ planeIndex: 1 });
      const dest = new Float32Array(copySize / 4);
      audioData.copyTo(dest, { planeIndex: 1 });

      // Verify values are from channel 1
      expect(dest[0]).toBeCloseTo(1.0, 5);
      expect(dest[99]).toBeCloseTo(1.99, 5);

      audioData.close();
    });
  });
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm test -- --run -t "should copy partial frames"
```

Expected: FAIL (current implementation ignores options, copies all data)

**Step 3: Implement CopyTo with options parsing and same-format path** (5 min)

Replace the `CopyTo` method in `src/audio_data.cc`:

```cpp
void AudioData::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed")
        .ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "copyTo requires destination and options")
        .ThrowAsJavaScriptException();
    return;
  }

  // Extract destination buffer.
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
    return;
  }

  // Parse options object.
  if (!info[1].IsObject()) {
    Napi::TypeError::New(env, "options must be an object")
        .ThrowAsJavaScriptException();
    return;
  }
  Napi::Object options = info[1].As<Napi::Object>();

  // Required: planeIndex.
  if (!options.Has("planeIndex") || !options.Get("planeIndex").IsNumber()) {
    Napi::TypeError::New(env, "options.planeIndex is required")
        .ThrowAsJavaScriptException();
    return;
  }
  uint32_t plane_index =
      options.Get("planeIndex").As<Napi::Number>().Uint32Value();

  // Validate planeIndex.
  bool is_planar = IsPlanar();
  if (!is_planar && plane_index != 0) {
    Napi::RangeError::New(env, "planeIndex must be 0 for interleaved formats")
        .ThrowAsJavaScriptException();
    return;
  }
  if (is_planar && plane_index >= number_of_channels_) {
    Napi::RangeError::New(env, "planeIndex out of range")
        .ThrowAsJavaScriptException();
    return;
  }

  // Optional: frameOffset (default 0).
  uint32_t frame_offset = 0;
  if (options.Has("frameOffset") && options.Get("frameOffset").IsNumber()) {
    frame_offset = options.Get("frameOffset").As<Napi::Number>().Uint32Value();
  }
  if (frame_offset >= number_of_frames_) {
    Napi::RangeError::New(env, "frameOffset out of range")
        .ThrowAsJavaScriptException();
    return;
  }

  // Optional: frameCount (default remaining frames).
  uint32_t frame_count = number_of_frames_ - frame_offset;
  if (options.Has("frameCount") && options.Get("frameCount").IsNumber()) {
    frame_count = options.Get("frameCount").As<Napi::Number>().Uint32Value();
    if (frame_offset + frame_count > number_of_frames_) {
      frame_count = number_of_frames_ - frame_offset;
    }
  }

  // Optional: format (default current format).
  std::string target_format = format_;
  if (options.Has("format") && options.Get("format").IsString()) {
    target_format = options.Get("format").As<Napi::String>().Utf8Value();
  }

  // Calculate required size.
  size_t bytes_per_sample = GetBytesPerSample();
  size_t target_bytes_per_sample = GetFormatBytesPerSample(target_format);
  bool target_planar = IsPlanarFormat(target_format);

  size_t required_size;
  if (target_planar) {
    required_size = frame_count * target_bytes_per_sample;
  } else {
    required_size = frame_count * number_of_channels_ * target_bytes_per_sample;
  }

  if (dest_size < required_size) {
    Napi::TypeError::New(env, "destination buffer too small")
        .ThrowAsJavaScriptException();
    return;
  }

  // Same format: direct copy.
  if (target_format == format_) {
    size_t src_offset;
    size_t copy_size;

    if (is_planar) {
      // Planar: each plane is numberOfFrames * bytesPerSample.
      size_t plane_size = number_of_frames_ * bytes_per_sample;
      src_offset = plane_index * plane_size + frame_offset * bytes_per_sample;
      copy_size = frame_count * bytes_per_sample;
    } else {
      // Interleaved: samples are channel-interleaved.
      src_offset = frame_offset * number_of_channels_ * bytes_per_sample;
      copy_size = frame_count * number_of_channels_ * bytes_per_sample;
    }

    std::memcpy(dest_data, data_.data() + src_offset, copy_size);
    return;
  }

  // Format conversion required - implemented in Task 6.
  Napi::Error::New(env, "Format conversion not yet implemented")
      .ThrowAsJavaScriptException();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build && npm test -- --run -t "copyTo"
```

Expected: Partial copy tests PASS

**Step 5: Commit** (30 sec)

```bash
git add src/audio_data.cc test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): implement AudioData.copyTo with partial copy support

Support planeIndex, frameOffset, frameCount options for extracting
subsets of audio data. Format conversion to be added in next commit.
EOF
)"
```

---

### Task 5: Add CopyTo Edge Case Tests

**Files:**
- Modify: `test/golden/core-types.test.ts` (add edge case tests)

**Step 1: Write edge case tests** (3 min)

Add to the `copyTo` describe block:

```typescript
    it('should throw if AudioData is closed', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      audioData.close();

      const dest = new Float32Array(1024 * 2);
      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow(/InvalidStateError/);
    });

    it('should throw if destination buffer too small', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      const dest = new Float32Array(10); // Too small
      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow();

      audioData.close();
    });

    it('should throw RangeError for invalid planeIndex on planar', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      const dest = new Float32Array(1024);
      expect(() => audioData.copyTo(dest, { planeIndex: 2 })).toThrow();

      audioData.close();
    });
```

**Step 2: Run tests to verify they pass** (30 sec)

```bash
npm test -- --run -t "copyTo"
```

Expected: All PASS

**Step 3: Commit** (30 sec)

```bash
git add test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
test(audio): add copyTo edge case tests for closed state and validation
EOF
)"
```

---

### Task 6: Implement CopyTo Format Conversion with libswresample

**Files:**
- Modify: `src/audio_data.cc` (add format conversion in CopyTo)

**Step 1: Write failing test for format conversion** (3 min)

Add to the `copyTo` describe block in `test/golden/core-types.test.ts`:

```typescript
    it('should convert f32 to s16 format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 1;
      // Create f32 data with values that map nicely to s16
      const data = new Float32Array(numberOfFrames);
      for (let i = 0; i < numberOfFrames; i++) {
        // Range -1.0 to ~1.0
        data[i] = (i / numberOfFrames) * 2 - 1;
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to s16
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 's16' });
      expect(allocSize).toBe(numberOfFrames * 2); // 2 bytes per s16 sample

      const dest = new Int16Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 's16' });

      // First sample should be near -32768 (min s16)
      expect(dest[0]).toBeLessThan(-30000);
      // Last sample should be near +32767 (max s16)
      expect(dest[numberOfFrames - 1]).toBeGreaterThan(30000);

      audioData.close();
    });

    it('should convert interleaved to planar format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Interleaved: L0 R0 L1 R1 ...
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i * 2] = 0.5;      // Left channel: all 0.5
        data[i * 2 + 1] = -0.5; // Right channel: all -0.5
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to f32-planar and get plane 0 (left channel)
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32-planar' });
      expect(allocSize).toBe(numberOfFrames * 4); // Single channel

      const dest = new Float32Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32-planar' });

      // All values should be 0.5 (left channel)
      expect(dest[0]).toBeCloseTo(0.5, 5);
      expect(dest[numberOfFrames - 1]).toBeCloseTo(0.5, 5);

      audioData.close();
    });
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm test -- --run -t "should convert f32 to s16"
```

Expected: FAIL with "Format conversion not yet implemented"

**Step 3: Implement format conversion with libswresample** (10 min)

Replace the format conversion section at the end of `CopyTo` in `src/audio_data.cc` (replace the "Format conversion not yet implemented" error):

```cpp
  // Format conversion using libswresample.
  AVSampleFormat src_fmt = ParseAudioFormat(format_);
  AVSampleFormat dst_fmt = ParseAudioFormat(target_format);

  if (src_fmt == AV_SAMPLE_FMT_NONE || dst_fmt == AV_SAMPLE_FMT_NONE) {
    Napi::Error::New(env, "Unsupported audio format")
        .ThrowAsJavaScriptException();
    return;
  }

  // Create resampler context.
  SwrContext* swr = swr_alloc();
  if (!swr) {
    Napi::Error::New(env, "Failed to allocate SwrContext")
        .ThrowAsJavaScriptException();
    return;
  }

  // Configure channel layout (same number of channels, just reordering for planar/interleaved).
  AVChannelLayout ch_layout;
  av_channel_layout_default(&ch_layout, number_of_channels_);

  // Set input parameters.
  av_opt_set_chlayout(swr, "in_chlayout", &ch_layout, 0);
  av_opt_set_int(swr, "in_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr, "in_sample_fmt", src_fmt, 0);

  // Set output parameters.
  av_opt_set_chlayout(swr, "out_chlayout", &ch_layout, 0);
  av_opt_set_int(swr, "out_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr, "out_sample_fmt", dst_fmt, 0);

  int ret = swr_init(swr);
  if (ret < 0) {
    swr_free(&swr);
    av_channel_layout_uninit(&ch_layout);
    Napi::Error::New(env, "Failed to initialize SwrContext")
        .ThrowAsJavaScriptException();
    return;
  }

  // Prepare source data pointers.
  const uint8_t* src_data[8] = {nullptr};
  int src_linesize = 0;

  if (is_planar) {
    // Source is planar: set up pointers to each channel plane.
    size_t plane_size = number_of_frames_ * bytes_per_sample;
    for (uint32_t c = 0; c < number_of_channels_; c++) {
      src_data[c] = data_.data() + c * plane_size + frame_offset * bytes_per_sample;
    }
    src_linesize = frame_count * bytes_per_sample;
  } else {
    // Source is interleaved: single data pointer.
    src_data[0] = data_.data() + frame_offset * number_of_channels_ * bytes_per_sample;
    src_linesize = frame_count * number_of_channels_ * bytes_per_sample;
  }

  // Prepare destination data pointers.
  uint8_t* dst_data[8] = {nullptr};

  if (target_planar) {
    // For planar output, we only copy the requested plane.
    // Need temporary buffer for all planes, then extract one.
    size_t total_out_size = frame_count * number_of_channels_ * target_bytes_per_sample;
    std::vector<uint8_t> temp_buffer(total_out_size);

    for (uint32_t c = 0; c < number_of_channels_; c++) {
      dst_data[c] = temp_buffer.data() + c * frame_count * target_bytes_per_sample;
    }

    ret = swr_convert(swr, dst_data, frame_count, src_data, frame_count);
    if (ret < 0) {
      swr_free(&swr);
      av_channel_layout_uninit(&ch_layout);
      Napi::Error::New(env, "swr_convert failed")
          .ThrowAsJavaScriptException();
      return;
    }

    // Copy requested plane to destination.
    std::memcpy(dest_data, dst_data[plane_index], frame_count * target_bytes_per_sample);
  } else {
    // Interleaved output: write directly to destination.
    dst_data[0] = dest_data;

    ret = swr_convert(swr, dst_data, frame_count, src_data, frame_count);
    if (ret < 0) {
      swr_free(&swr);
      av_channel_layout_uninit(&ch_layout);
      Napi::Error::New(env, "swr_convert failed")
          .ThrowAsJavaScriptException();
      return;
    }
  }

  swr_free(&swr);
  av_channel_layout_uninit(&ch_layout);
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build && npm test -- --run -t "should convert"
```

Expected: Format conversion tests PASS

**Step 5: Commit** (30 sec)

```bash
git add src/audio_data.cc test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): implement AudioData.copyTo format conversion

Use libswresample for sample format conversion (e.g., f32 to s16)
and layout conversion (interleaved to planar and vice versa).
Completes W3C WebCodecs AudioData.copyTo specification.
EOF
)"
```

---

### Task 7: Add Format Conversion Edge Case Tests

**Files:**
- Modify: `test/golden/core-types.test.ts` (add conversion edge cases)

**Step 1: Write additional format conversion tests** (3 min)

Add to the `copyTo` describe block:

```typescript
    it('should convert s16 to f32 format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 1;
      // Create s16 data
      const data = new Int16Array(numberOfFrames);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = Math.floor((i / numberOfFrames) * 65535 - 32768);
      }

      const audioData = new AudioData({
        format: 's16',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: new Uint8Array(data.buffer),
      });

      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32' });
      expect(allocSize).toBe(numberOfFrames * 4);

      const dest = new Float32Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32' });

      // Values should be in -1.0 to 1.0 range
      expect(dest[0]).toBeCloseTo(-1.0, 1);
      expect(dest[numberOfFrames - 1]).toBeCloseTo(1.0, 1);

      audioData.close();
    });

    it('should convert planar to interleaved format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Planar: plane 0 all 0.25, plane 1 all 0.75
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = 0.25;                  // Plane 0
        data[numberOfFrames + i] = 0.75; // Plane 1
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to interleaved f32
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32' });
      expect(allocSize).toBe(numberOfFrames * numberOfChannels * 4);

      const dest = new Float32Array(numberOfFrames * numberOfChannels);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32' });

      // Interleaved: L0 R0 L1 R1 ...
      expect(dest[0]).toBeCloseTo(0.25, 5);  // L0
      expect(dest[1]).toBeCloseTo(0.75, 5);  // R0

      audioData.close();
    });
```

**Step 2: Run tests to verify they pass** (30 sec)

```bash
npm test -- --run -t "copyTo"
```

Expected: All PASS

**Step 3: Commit** (30 sec)

```bash
git add test/golden/core-types.test.ts
git commit -m "$(cat <<'EOF'
test(audio): add format conversion edge case tests

Cover s16 to f32 conversion and planar to interleaved conversion.
EOF
)"
```

---

### Task 8: Code Review

**Files:**
- Review: `src/audio_data.cc`, `test/golden/core-types.test.ts`

**Step 1: Run full test suite** (1 min)

```bash
npm run build && npm test
```

Expected: All tests PASS

**Step 2: Run linter** (30 sec)

```bash
npm run lint
```

Expected: No errors

**Step 3: Check C++ lint** (30 sec)

```bash
cpplint --recursive src/audio_data.cc
```

Expected: No significant errors (some style warnings acceptable)

**Step 4: Verify TODO is resolved** (30 sec)

Check that TODO comments at lines 224 and 243 in original `src/audio_data.cc` have been addressed by the implementation.

**Step 5: Final commit if needed** (30 sec)

If any lint fixes were needed:

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(audio): lint fixes for AudioData implementation
EOF
)"
```

**Step 6: Update TODO.md** (2 min)

Remove completed items from `TODO.md`:

```bash
# Edit TODO.md to remove:
# - [ ] Handle options for partial copy or format conversion (line 224)
# - [ ] Handle options for planeIndex, frameOffset, frameCount, format (line 243)
git add TODO.md
git commit -m "docs: mark AudioData copyTo TODO items as complete"
```

---

## Summary

| Task | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | FFmpeg format mapping helper | `src/audio_data.cc` | 8 min |
| 2 | AllocationSize with options | `src/audio_data.cc`, tests | 12 min |
| 3 | AllocationSize planar/format tests | tests | 5 min |
| 4 | CopyTo same-format partial copy | `src/audio_data.cc`, tests | 12 min |
| 5 | CopyTo edge case tests | tests | 5 min |
| 6 | CopyTo format conversion | `src/audio_data.cc`, tests | 15 min |
| 7 | Format conversion edge case tests | tests | 5 min |
| 8 | Code review | all | 5 min |

**Total estimated time:** ~67 minutes
