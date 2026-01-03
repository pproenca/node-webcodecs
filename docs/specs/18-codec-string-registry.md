---
title: '18. Codec String Registry'
---

> Codec string formats from [WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/)

## Codec String Format Reference

This document describes the codec string formats used in WebCodecs `config.codec` and how to parse them for FFmpeg codec selection.

Consider adding this as `src/shared/codec_string.h`.

### Video Codecs

#### AVC (H.264)

**Format:** `avc1.PPCCLL` or `avc3.PPCCLL`

| Part            | Meaning                | Example                                   |
| --------------- | ---------------------- | ----------------------------------------- |
| `avc1` / `avc3` | Codec identifier       | `avc1` (with in-band SPS/PPS)             |
| `PP`            | Profile (hex)          | `42` = Baseline, `4D` = Main, `64` = High |
| `CC`            | Constraint flags (hex) | `00`, `40`, etc.                          |
| `LL`            | Level (hex)            | `1E` = 3.0, `1F` = 3.1, `28` = 4.0        |

**Examples:**

- `avc1.42001E` - Baseline Profile, Level 3.0
- `avc1.4D0028` - Main Profile, Level 4.0
- `avc1.640028` - High Profile, Level 4.0

**FFmpeg Mapping** (suggested: `src/shared/codec_string.h`):

```cpp
#pragma once

#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
}

#include "error_builder.h"

namespace webcodecs {

struct H264Config {
  int profile;      // FF_PROFILE_H264_*
  int level;        // Level * 10 (e.g., 30 for 3.0)
  int constraints;
};

/**
 * Parse AVC/H.264 codec string.
 * Throws TypeError if invalid.
 */
inline H264Config ParseAvcCodecString(Napi::Env env, const std::string& codec) {
  // "avc1.PPCCLL" or "avc3.PPCCLL"
  if (codec.size() < 11 ||
      (codec.substr(0, 4) != "avc1" && codec.substr(0, 4) != "avc3")) {
    errors::ThrowTypeError(env, "Invalid AVC codec string: " + codec);
    return {};
  }

  H264Config config;
  try {
    config.profile = std::stoi(codec.substr(5, 2), nullptr, 16);
    config.constraints = std::stoi(codec.substr(7, 2), nullptr, 16);
    config.level = std::stoi(codec.substr(9, 2), nullptr, 16);
  } catch (const std::exception&) {
    errors::ThrowTypeError(env, "Invalid AVC codec string: " + codec);
    return {};
  }

  return config;
}

/**
 * Map H.264 profile_idc to FFmpeg profile constant.
 */
inline int H264ProfileToFfmpeg(int profile_idc) {
  switch (profile_idc) {
    case 66: return FF_PROFILE_H264_BASELINE;
    case 77: return FF_PROFILE_H264_MAIN;
    case 88: return FF_PROFILE_H264_EXTENDED;
    case 100: return FF_PROFILE_H264_HIGH;
    case 110: return FF_PROFILE_H264_HIGH_10;
    case 122: return FF_PROFILE_H264_HIGH_422;
    case 244: return FF_PROFILE_H264_HIGH_444_PREDICTIVE;
    default: return FF_PROFILE_UNKNOWN;
  }
}

}  // namespace webcodecs
```

---

#### HEVC (H.265)

**Format:** `hev1.P.C.TLL.CC` or `hvc1.P.C.TLL.CC`

| Part | Meaning                                           |
| ---- | ------------------------------------------------- |
| `P`  | General profile space + profile_idc               |
| `C`  | General profile compatibility flags (hex, 32-bit) |
| `T`  | General tier flag (`L` = Main, `H` = High)        |
| `LL` | Level (decimal, divided by 30)                    |
| `CC` | Constraint indicator flags                        |

**Examples:**

- `hev1.1.6.L93.B0` - Main Profile, Level 3.1
- `hev1.2.4.L120.B0` - Main 10 Profile, Level 4.0

---

#### VP8

**Format:** `vp8`

Simple codec string with no parameters.

---

#### VP9

**Format:** `vp09.PP.LL.DD.CC.CP.TC.MC.FF`

| Part | Meaning                  |
| ---- | ------------------------ |
| `PP` | Profile (00-03)          |
| `LL` | Level (10-62)            |
| `DD` | Bit depth (08, 10, 12)   |
| `CC` | Chroma subsampling       |
| `CP` | Color primaries          |
| `TC` | Transfer characteristics |
| `MC` | Matrix coefficients      |
| `FF` | Full range flag          |

**Examples:**

- `vp09.00.10.08` - Profile 0, Level 1.0, 8-bit
- `vp09.02.10.10` - Profile 2, Level 1.0, 10-bit

---

#### AV1

**Format:** `av01.P.LLT.DD.M.CCC.CP.TC.MC.F`

| Part             | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `P`              | Profile (0 = Main, 1 = High, 2 = Professional) |
| `LL`             | Level (00-23)                                  |
| `T`              | Tier (M = Main, H = High)                      |
| `DD`             | Bit depth (08, 10, 12)                         |
| `M`              | Monochrome flag (0 or 1)                       |
| `CCC`            | Chroma subsampling                             |
| `CP`, `TC`, `MC` | Color info                                     |
| `F`              | Full range flag                                |

**Examples:**

- `av01.0.04M.08` - Main Profile, Level 3.0, 8-bit
- `av01.0.08M.10.0.110` - Main Profile, Level 4.0, 10-bit

---

### Audio Codecs

#### AAC

**Format:** `mp4a.40.X`

| `X`  | AAC Profile             |
| ---- | ----------------------- |
| `2`  | AAC-LC (Low Complexity) |
| `5`  | HE-AAC (SBR)            |
| `29` | HE-AAC v2 (SBR+PS)      |

---

#### Opus

**Format:** `opus`

---

#### FLAC

**Format:** `flac`

---

#### MP3

**Format:** `mp3`

---

#### Vorbis

**Format:** `vorbis`

---

### Complete Codec Parser

Suggested file: `src/shared/codec_string.h`

```cpp
#pragma once

#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
}

namespace webcodecs {

struct CodecInfo {
  AVCodecID codec_id;
  int profile;
  int level;
  int bit_depth;
};

/**
 * Parse WebCodecs codec string to FFmpeg codec info.
 * Returns codec_id = AV_CODEC_ID_NONE if not recognized.
 */
inline CodecInfo ParseCodecString(const std::string& codec) {
  CodecInfo info = {AV_CODEC_ID_NONE, FF_PROFILE_UNKNOWN, 0, 8};

  // Video codecs
  if (codec.size() >= 4 &&
      (codec.substr(0, 4) == "avc1" || codec.substr(0, 4) == "avc3")) {
    info.codec_id = AV_CODEC_ID_H264;
  }
  else if (codec.size() >= 4 &&
           (codec.substr(0, 4) == "hev1" || codec.substr(0, 4) == "hvc1")) {
    info.codec_id = AV_CODEC_ID_HEVC;
  }
  else if (codec == "vp8") {
    info.codec_id = AV_CODEC_ID_VP8;
  }
  else if (codec.size() >= 4 && codec.substr(0, 4) == "vp09") {
    info.codec_id = AV_CODEC_ID_VP9;
  }
  else if (codec.size() >= 4 && codec.substr(0, 4) == "av01") {
    info.codec_id = AV_CODEC_ID_AV1;
  }
  // Audio codecs
  else if (codec.size() >= 7 && codec.substr(0, 7) == "mp4a.40") {
    info.codec_id = AV_CODEC_ID_AAC;
  }
  else if (codec == "opus") {
    info.codec_id = AV_CODEC_ID_OPUS;
  }
  else if (codec == "flac") {
    info.codec_id = AV_CODEC_ID_FLAC;
  }
  else if (codec == "mp3") {
    info.codec_id = AV_CODEC_ID_MP3;
  }
  else if (codec == "vorbis") {
    info.codec_id = AV_CODEC_ID_VORBIS;
  }

  return info;
}

}  // namespace webcodecs
```
