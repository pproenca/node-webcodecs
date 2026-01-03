---
title: '17. Pixel Format Mapping'
---

> WebCodecs VideoPixelFormat to FFmpeg AVPixelFormat mapping

## VideoPixelFormat to AVPixelFormat Mapping

This document provides the mapping between WebCodecs `VideoPixelFormat` values and FFmpeg `AVPixelFormat` constants.

Consider adding this as `src/shared/pixel_format.h`.

### Complete Mapping Table

| WebCodecs Format | FFmpeg AVPixelFormat     | Bits  | Planes | Description                       |
| ---------------- | ------------------------ | ----- | ------ | --------------------------------- |
| `I420`           | `AV_PIX_FMT_YUV420P`     | 8     | 3      | YUV 4:2:0 planar                  |
| `I420A`          | `AV_PIX_FMT_YUVA420P`    | 8     | 4      | YUV 4:2:0 planar + alpha          |
| `I422`           | `AV_PIX_FMT_YUV422P`     | 8     | 3      | YUV 4:2:2 planar                  |
| `I444`           | `AV_PIX_FMT_YUV444P`     | 8     | 3      | YUV 4:4:4 planar                  |
| `NV12`           | `AV_PIX_FMT_NV12`        | 8     | 2      | YUV 4:2:0 semi-planar             |
| `RGBA`           | `AV_PIX_FMT_RGBA`        | 8     | 1      | RGBA interleaved                  |
| `RGBX`           | `AV_PIX_FMT_RGB0`        | 8     | 1      | RGBX (alpha ignored)              |
| `BGRA`           | `AV_PIX_FMT_BGRA`        | 8     | 1      | BGRA interleaved                  |
| `BGRX`           | `AV_PIX_FMT_BGR0`        | 8     | 1      | BGRX (alpha ignored)              |
| `I420P10`        | `AV_PIX_FMT_YUV420P10LE` | 10    | 3      | YUV 4:2:0 10-bit                  |
| `I420P12`        | `AV_PIX_FMT_YUV420P12LE` | 12    | 3      | YUV 4:2:0 12-bit                  |
| `I422P10`        | `AV_PIX_FMT_YUV422P10LE` | 10    | 3      | YUV 4:2:2 10-bit                  |
| `I422P12`        | `AV_PIX_FMT_YUV422P12LE` | 12    | 3      | YUV 4:2:2 12-bit                  |
| `I444P10`        | `AV_PIX_FMT_YUV444P10LE` | 10    | 3      | YUV 4:4:4 10-bit                  |
| `I444P12`        | `AV_PIX_FMT_YUV444P12LE` | 12    | 3      | YUV 4:4:4 12-bit                  |
| `NV12P10`        | `AV_PIX_FMT_P010LE`      | 10    | 2      | YUV 4:2:0 10-bit semi-planar      |
| `RGBAP10`        | `AV_PIX_FMT_RGBA64LE`    | 10/16 | 1      | RGBA 10-bit (in 16-bit container) |
| `RGBAP12`        | `AV_PIX_FMT_RGBA64LE`    | 12/16 | 1      | RGBA 12-bit (in 16-bit container) |

### C++ Implementation

Suggested file: `src/shared/pixel_format.h`

```cpp
#pragma once

#include <string>
#include <unordered_map>

extern "C" {
#include <libavutil/pixfmt.h>
}

namespace webcodecs {

/**
 * Convert WebCodecs VideoPixelFormat string to FFmpeg AVPixelFormat.
 * Returns AV_PIX_FMT_NONE if format is not recognized.
 */
inline AVPixelFormat VideoPixelFormatToAv(const std::string& format) {
  static const std::unordered_map<std::string, AVPixelFormat> kFormatMap = {
    {"I420", AV_PIX_FMT_YUV420P},
    {"I420A", AV_PIX_FMT_YUVA420P},
    {"I422", AV_PIX_FMT_YUV422P},
    {"I444", AV_PIX_FMT_YUV444P},
    {"NV12", AV_PIX_FMT_NV12},
    {"RGBA", AV_PIX_FMT_RGBA},
    {"RGBX", AV_PIX_FMT_RGB0},
    {"BGRA", AV_PIX_FMT_BGRA},
    {"BGRX", AV_PIX_FMT_BGR0},
    {"I420P10", AV_PIX_FMT_YUV420P10LE},
    {"I420P12", AV_PIX_FMT_YUV420P12LE},
    {"I422P10", AV_PIX_FMT_YUV422P10LE},
    {"I422P12", AV_PIX_FMT_YUV422P12LE},
    {"I444P10", AV_PIX_FMT_YUV444P10LE},
    {"I444P12", AV_PIX_FMT_YUV444P12LE},
    {"NV12P10", AV_PIX_FMT_P010LE},
  };

  auto it = kFormatMap.find(format);
  if (it != kFormatMap.end()) {
    return it->second;
  }
  return AV_PIX_FMT_NONE;
}

/**
 * Convert FFmpeg AVPixelFormat to WebCodecs VideoPixelFormat string.
 * Returns empty string if format is not supported.
 */
inline std::string AvToVideoPixelFormat(AVPixelFormat format) {
  static const std::unordered_map<AVPixelFormat, std::string> kReverseMap = {
    {AV_PIX_FMT_YUV420P, "I420"},
    {AV_PIX_FMT_YUVA420P, "I420A"},
    {AV_PIX_FMT_YUV422P, "I422"},
    {AV_PIX_FMT_YUV444P, "I444"},
    {AV_PIX_FMT_NV12, "NV12"},
    {AV_PIX_FMT_RGBA, "RGBA"},
    {AV_PIX_FMT_RGB0, "RGBX"},
    {AV_PIX_FMT_BGRA, "BGRA"},
    {AV_PIX_FMT_BGR0, "BGRX"},
    {AV_PIX_FMT_YUV420P10LE, "I420P10"},
    {AV_PIX_FMT_YUV420P12LE, "I420P12"},
    {AV_PIX_FMT_YUV422P10LE, "I422P10"},
    {AV_PIX_FMT_YUV422P12LE, "I422P12"},
    {AV_PIX_FMT_YUV444P10LE, "I444P10"},
    {AV_PIX_FMT_YUV444P12LE, "I444P12"},
    {AV_PIX_FMT_P010LE, "NV12P10"},
  };

  auto it = kReverseMap.find(format);
  if (it != kReverseMap.end()) {
    return it->second;
  }
  return "";  // null in WebCodecs
}

}  // namespace webcodecs
```

### Plane Layout

Each format has a specific plane layout:

| Format | Plane 0          | Plane 1              | Plane 2 | Plane 3  |
| ------ | ---------------- | -------------------- | ------- | -------- |
| I420   | Y (full)         | U (1/4)              | V (1/4) | -        |
| I420A  | Y (full)         | U (1/4)              | V (1/4) | A (full) |
| NV12   | Y (full)         | UV interleaved (1/2) | -       | -        |
| RGBA   | RGBA interleaved | -                    | -       | -        |

### Stride Calculation

```cpp
// In src/video_frame.cpp or src/shared/pixel_format.h

namespace webcodecs {

/**
 * Calculate stride for a given format, width, and plane index.
 */
inline size_t CalculateStride(const std::string& format, size_t width, int plane) {
  if (format == "I420" || format == "I420A") {
    // Y plane and Alpha plane have full width, U/V planes have half width
    return plane == 0 || plane == 3 ? width : (width + 1) / 2;
  }
  if (format == "NV12") {
    return width;  // Both planes have same stride
  }
  if (format == "RGBA" || format == "BGRA" || format == "RGBX" || format == "BGRX") {
    return width * 4;
  }
  // Handle 10/12-bit formats
  if (format.find("P10") != std::string::npos ||
      format.find("P12") != std::string::npos) {
    // 10/12-bit formats use 2 bytes per sample
    if (format.substr(0, 4) == "I420") {
      return plane == 0 ? width * 2 : (width + 1) / 2 * 2;
    }
  }
  return 0;  // Unknown format
}

}  // namespace webcodecs
```
