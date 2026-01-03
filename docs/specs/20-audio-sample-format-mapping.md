---
title: '20. Audio Sample Format Mapping'
---

> WebCodecs AudioSampleFormat to FFmpeg AVSampleFormat mapping

## AudioSampleFormat to AVSampleFormat Mapping

Consider adding this as `src/shared/sample_format.h`.

### Complete Mapping Table

| WebCodecs Format | FFmpeg AVSampleFormat | Bits | Layout      | Description           |
| ---------------- | --------------------- | ---- | ----------- | --------------------- |
| `u8`             | `AV_SAMPLE_FMT_U8`    | 8    | Interleaved | Unsigned 8-bit        |
| `s16`            | `AV_SAMPLE_FMT_S16`   | 16   | Interleaved | Signed 16-bit         |
| `s32`            | `AV_SAMPLE_FMT_S32`   | 32   | Interleaved | Signed 32-bit         |
| `f32`            | `AV_SAMPLE_FMT_FLT`   | 32   | Interleaved | 32-bit float          |
| `u8-planar`      | `AV_SAMPLE_FMT_U8P`   | 8    | Planar      | Unsigned 8-bit planar |
| `s16-planar`     | `AV_SAMPLE_FMT_S16P`  | 16   | Planar      | Signed 16-bit planar  |
| `s32-planar`     | `AV_SAMPLE_FMT_S32P`  | 32   | Planar      | Signed 32-bit planar  |
| `f32-planar`     | `AV_SAMPLE_FMT_FLTP`  | 32   | Planar      | 32-bit float planar   |

### C++ Implementation

Suggested file: `src/shared/sample_format.h`

```cpp
#pragma once

#include <string>
#include <unordered_map>

extern "C" {
#include <libavutil/samplefmt.h>
}

namespace webcodecs {

/**
 * Convert WebCodecs AudioSampleFormat string to FFmpeg AVSampleFormat.
 * Returns AV_SAMPLE_FMT_NONE if format is not recognized.
 */
inline AVSampleFormat AudioSampleFormatToAv(const std::string& format) {
  static const std::unordered_map<std::string, AVSampleFormat> kFormatMap = {
    {"u8", AV_SAMPLE_FMT_U8},
    {"s16", AV_SAMPLE_FMT_S16},
    {"s32", AV_SAMPLE_FMT_S32},
    {"f32", AV_SAMPLE_FMT_FLT},
    {"u8-planar", AV_SAMPLE_FMT_U8P},
    {"s16-planar", AV_SAMPLE_FMT_S16P},
    {"s32-planar", AV_SAMPLE_FMT_S32P},
    {"f32-planar", AV_SAMPLE_FMT_FLTP},
  };

  auto it = kFormatMap.find(format);
  return it != kFormatMap.end() ? it->second : AV_SAMPLE_FMT_NONE;
}

/**
 * Convert FFmpeg AVSampleFormat to WebCodecs AudioSampleFormat string.
 * Returns empty string if format is not supported.
 */
inline std::string AvToAudioSampleFormat(AVSampleFormat format) {
  static const std::unordered_map<AVSampleFormat, std::string> kReverseMap = {
    {AV_SAMPLE_FMT_U8, "u8"},
    {AV_SAMPLE_FMT_S16, "s16"},
    {AV_SAMPLE_FMT_S32, "s32"},
    {AV_SAMPLE_FMT_FLT, "f32"},
    {AV_SAMPLE_FMT_U8P, "u8-planar"},
    {AV_SAMPLE_FMT_S16P, "s16-planar"},
    {AV_SAMPLE_FMT_S32P, "s32-planar"},
    {AV_SAMPLE_FMT_FLTP, "f32-planar"},
  };

  auto it = kReverseMap.find(format);
  return it != kReverseMap.end() ? it->second : "";
}

/**
 * Check if format is planar (separate channel buffers).
 */
inline bool IsPlanarFormat(const std::string& format) {
  return format.find("-planar") != std::string::npos;
}

/**
 * Get bytes per sample for a format.
 */
inline size_t BytesPerSample(const std::string& format) {
  if (format.size() >= 2 && format.substr(0, 2) == "u8") return 1;
  if (format.size() >= 3 && format.substr(0, 3) == "s16") return 2;
  if (format.size() >= 3 && format.substr(0, 3) == "s32") return 4;
  if (format.size() >= 3 && format.substr(0, 3) == "f32") return 4;
  return 0;
}

}  // namespace webcodecs
```

### Sample Value Ranges

| Format | Min Value   | Bias (Silence) | Max Value  |
| ------ | ----------- | -------------- | ---------- |
| u8     | 0           | 128            | 255        |
| s16    | -32768      | 0              | 32767      |
| s32    | -2147483648 | 0              | 2147483647 |
| f32    | -1.0        | 0.0            | 1.0        |

### 24-bit Audio Handling

WebCodecs does not have a native 24-bit format. 24-bit audio should be stored in `s32` (left-shifted by 8 bits) or converted to `f32`.

### Conversion Requirements

**W3C Requirement:**

> "Conversion from any AudioSampleFormat to f32-planar MUST always be supported."

Use `raii::SwrContextPtr` from `src/ffmpeg_raii.h` for format conversion:

```cpp
#include "ffmpeg_raii.h"

namespace webcodecs {

raii::SwrContextPtr CreateFormatConverter(
    AVSampleFormat src_fmt, int src_rate, const AVChannelLayout* src_layout,
    AVSampleFormat dst_fmt, int dst_rate, const AVChannelLayout* dst_layout) {

  return raii::MakeSwrContextInitialized(
      dst_layout, dst_fmt, dst_rate,
      src_layout, src_fmt, src_rate);
}

}  // namespace webcodecs
```

### Memory Layout

**Interleaved (e.g., `s16`):**

```
[L0][R0][L1][R1][L2][R2]...
```

**Planar (e.g., `s16-planar`):**

```
Plane 0 (Left):  [L0][L1][L2]...
Plane 1 (Right): [R0][R1][R2]...
```
