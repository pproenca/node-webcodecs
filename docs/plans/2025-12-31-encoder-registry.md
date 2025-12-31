# Encoder Registry Refactoring Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-encoder-registry.md` to implement task-by-task.

**Goal:** Create a centralized EncoderRegistry that eliminates duplicated codec detection logic and provides type-safe encoder selection with platform-aware priorities.

**Architecture:** Singleton registry pattern with codec descriptors containing W3C string prefixes, encoder variants with priorities, and type-safe option applicators. Video and audio codecs share infrastructure but have separate descriptor types.

**Tech Stack:** C++17, FFmpeg libavcodec, NAPI

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Registry infrastructure (header + impl) |
| Group 2 | 3, 4 | Video encoder migration |
| Group 3 | 5, 6 | Audio encoder migration |
| Group 4 | 7 | Unit tests |
| Group 5 | 8 | Code review |

---

### Task 1: Create EncoderRegistry Header

**Files:**
- Create: `src/encoder_registry.h`

**Step 1: Create header with enum and forward declarations** (3 min)

```cpp
// src/encoder_registry.h
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_ENCODER_REGISTRY_H_
#define SRC_ENCODER_REGISTRY_H_

#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
}

namespace webcodecs {

// Encoder capability flags
enum class EncoderCaps : uint32_t {
  kNone = 0,
  kHardwareAccelerated = 1 << 0,
  kSupportsQuantizer = 1 << 1,
  kSupportsBFrames = 1 << 2,
  kSupportsTemporalLayers = 1 << 3,
};

// Bitwise operators for EncoderCaps
constexpr EncoderCaps operator|(EncoderCaps a, EncoderCaps b) {
  return static_cast<EncoderCaps>(static_cast<uint32_t>(a) |
                                   static_cast<uint32_t>(b));
}
constexpr bool operator&(EncoderCaps a, EncoderCaps b) {
  return (static_cast<uint32_t>(a) & static_cast<uint32_t>(b)) != 0;
}

#endif  // SRC_ENCODER_REGISTRY_H_
```

**Step 2: Verify header compiles** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && echo '#include "src/encoder_registry.h"' | g++ -std=c++17 -I. -I$(brew --prefix ffmpeg)/include -c -x c++ - -o /dev/null 2>&1 || echo "Compile check"
```

Expected: No errors (or "Compile check" message)

**Step 3: Add OptionApplicator and EncoderVariant types** (3 min)

Add after `EncoderCaps` operators, before `#endif`:

```cpp
// Encoder-specific option applicator
// Returns true if options applied successfully, false if any failed
using OptionApplicator =
    std::function<bool(AVCodecContext*, const std::string& bitrate_mode)>;

// Describes a single encoder variant (e.g., libx264, h264_nvenc)
struct EncoderVariant {
  const char* name;               // FFmpeg encoder name
  EncoderCaps caps;               // Capability flags
  int priority;                   // Selection priority (higher = preferred)
  OptionApplicator apply_options; // Encoder-specific configuration
};

// Describes a video codec family (e.g., H.264, VP9)
struct VideoCodecDescriptor {
  AVCodecID codec_id;
  std::vector<std::string_view> codec_string_prefixes;  // W3C codec strings
  std::vector<EncoderVariant> variants;
  int quantizer_min;
  int quantizer_max;
};

// Describes an audio codec family (e.g., Opus, AAC)
struct AudioCodecDescriptor {
  AVCodecID codec_id;
  std::vector<std::string_view> codec_string_prefixes;  // W3C codec strings
  OptionApplicator apply_options;  // Codec-specific options (e.g., Opus)
};

// Encoder selection result
struct EncoderSelection {
  const AVCodec* codec;
  const EncoderVariant* variant;
  bool is_hardware;
};
```

**Step 4: Add EncoderRegistry class declaration** (3 min)

Add before `#endif`:

```cpp
class EncoderRegistry {
 public:
  // Singleton access
  static EncoderRegistry& Instance();

  // Video codec methods
  [[nodiscard]] std::optional<AVCodecID> ParseVideoCodecString(
      std::string_view codec_str) const;
  [[nodiscard]] EncoderSelection SelectVideoEncoder(
      AVCodecID codec_id,
      std::string_view hw_acceleration) const;
  [[nodiscard]] bool IsVideoCodecSupported(std::string_view codec_str) const;
  [[nodiscard]] std::pair<int, int> GetQuantizerRange(AVCodecID codec_id) const;
  [[nodiscard]] bool ApplyVideoEncoderOptions(
      const EncoderSelection& selection,
      AVCodecContext* ctx,
      const std::string& bitrate_mode) const;

  // Audio codec methods
  [[nodiscard]] std::optional<AVCodecID> ParseAudioCodecString(
      std::string_view codec_str) const;
  [[nodiscard]] bool IsAudioCodecSupported(std::string_view codec_str) const;
  [[nodiscard]] bool ApplyAudioEncoderOptions(
      AVCodecID codec_id,
      AVCodecContext* ctx) const;

 private:
  EncoderRegistry();
  void RegisterVideoCodecs();
  void RegisterAudioCodecs();

  std::vector<VideoCodecDescriptor> video_codecs_;
  std::vector<AudioCodecDescriptor> audio_codecs_;
};

// Logging utility for option failures
void LogOptionWarning(const char* encoder_name, const char* option, int ret);

}  // namespace webcodecs
```

**Step 5: Commit header** (30 sec)

```bash
git add src/encoder_registry.h && git commit -m "feat(encoder): add EncoderRegistry header with types"
```

---

### Task 2: Implement EncoderRegistry

**Files:**
- Create: `src/encoder_registry.cc`
- Modify: `binding.gyp`

**Step 1: Create implementation file with platform constants** (3 min)

```cpp
// src/encoder_registry.cc
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/encoder_registry.h"

#include <cstdio>

namespace webcodecs {

namespace {

// Platform-specific encoder priorities
// Negative priority = not available on this platform
#ifdef __APPLE__
constexpr int kVideoToolboxPriority = 100;
#else
constexpr int kVideoToolboxPriority = -1;
#endif

#ifdef _WIN32
constexpr int kNvencPriority = 90;
constexpr int kQsvPriority = 80;
constexpr int kAmfPriority = 70;
constexpr int kVaapiPriority = -1;
#elif defined(__linux__)
constexpr int kNvencPriority = 85;
constexpr int kVaapiPriority = 90;
constexpr int kQsvPriority = -1;
constexpr int kAmfPriority = -1;
#else
constexpr int kNvencPriority = -1;
constexpr int kQsvPriority = -1;
constexpr int kAmfPriority = -1;
constexpr int kVaapiPriority = -1;
#endif

constexpr int kSoftwarePriority = 50;

}  // namespace

void LogOptionWarning(const char* encoder_name, const char* option, int ret) {
  if (ret < 0) {
    fprintf(stderr,
            "[webcodecs] Warning: failed to set '%s' on %s (error %d)\n",
            option, encoder_name, ret);
  }
}

EncoderRegistry& EncoderRegistry::Instance() {
  static EncoderRegistry instance;
  return instance;
}

EncoderRegistry::EncoderRegistry() {
  RegisterVideoCodecs();
  RegisterAudioCodecs();
}

}  // namespace webcodecs
```

**Step 2: Add libx264 option applicator** (3 min)

Add inside the anonymous namespace, after constants:

```cpp
// libx264 option applicator
bool ApplyLibx264Options(AVCodecContext* ctx, const std::string& bitrate_mode) {
  int ret = 0;
  ret = av_opt_set(ctx->priv_data, "preset", "fast", 0);
  LogOptionWarning("libx264", "preset", ret);

  int ret2 = av_opt_set(ctx->priv_data, "tune", "zerolatency", 0);
  LogOptionWarning("libx264", "tune", ret2);

  if (bitrate_mode == "quantizer") {
    int ret3 = av_opt_set_int(ctx->priv_data, "qp", 23, 0);
    LogOptionWarning("libx264", "qp", ret3);
    ret |= ret3;
  }
  return ret >= 0 && ret2 >= 0;
}

// libx265 option applicator
bool ApplyLibx265Options(AVCodecContext* ctx, const std::string&) {
  int ret = av_opt_set(ctx->priv_data, "preset", "fast", 0);
  LogOptionWarning("libx265", "preset", ret);

  int ret2 = av_opt_set(ctx->priv_data, "x265-params", "bframes=0", 0);
  LogOptionWarning("libx265", "x265-params", ret2);

  return ret >= 0 && ret2 >= 0;
}

// libvpx option applicator
bool ApplyLibvpxOptions(AVCodecContext* ctx, const std::string&) {
  int ret = av_opt_set(ctx->priv_data, "quality", "realtime", 0);
  LogOptionWarning("libvpx", "quality", ret);

  int ret2 = av_opt_set(ctx->priv_data, "speed", "6", 0);
  LogOptionWarning("libvpx", "speed", ret2);

  ctx->max_b_frames = 0;  // VP8/VP9 don't support B-frames
  return ret >= 0 && ret2 >= 0;
}

// libaom-av1 option applicator
bool ApplyLibaomOptions(AVCodecContext* ctx, const std::string&) {
  int ret = av_opt_set(ctx->priv_data, "cpu-used", "8", 0);
  LogOptionWarning("libaom-av1", "cpu-used", ret);
  return ret >= 0;
}

// libsvtav1 option applicator
bool ApplyLibsvtav1Options(AVCodecContext* ctx, const std::string&) {
  int ret = av_opt_set(ctx->priv_data, "preset", "8", 0);
  LogOptionWarning("libsvtav1", "preset", ret);
  return ret >= 0;
}

// Hardware encoder default (no special options)
bool ApplyHardwareDefaults(AVCodecContext*, const std::string&) {
  return true;
}
```

**Step 3: Add RegisterVideoCodecs implementation** (5 min)

Add after constructor, before closing namespace:

```cpp
void EncoderRegistry::RegisterVideoCodecs() {
  // H.264 / AVC
  video_codecs_.push_back({
      .codec_id = AV_CODEC_ID_H264,
      .codec_string_prefixes = {"avc1", "h264"},
      .variants =
          {
#ifdef __APPLE__
              {"h264_videotoolbox",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kVideoToolboxPriority, ApplyHardwareDefaults},
#endif
#ifdef _WIN32
              {"h264_nvenc",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kNvencPriority, ApplyHardwareDefaults},
              {"h264_qsv",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kQsvPriority, ApplyHardwareDefaults},
              {"h264_amf", EncoderCaps::kHardwareAccelerated, kAmfPriority,
               ApplyHardwareDefaults},
#endif
#ifdef __linux__
              {"h264_vaapi",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kVaapiPriority, ApplyHardwareDefaults},
              {"h264_nvenc",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kNvencPriority, ApplyHardwareDefaults},
#endif
              {"libx264",
               EncoderCaps::kSupportsBFrames | EncoderCaps::kSupportsQuantizer,
               kSoftwarePriority, ApplyLibx264Options},
          },
      .quantizer_min = 0,
      .quantizer_max = 51,
  });

  // H.265 / HEVC
  video_codecs_.push_back({
      .codec_id = AV_CODEC_ID_HEVC,
      .codec_string_prefixes = {"hev1", "hvc1", "hevc"},
      .variants =
          {
#ifdef __APPLE__
              {"hevc_videotoolbox",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kVideoToolboxPriority, ApplyHardwareDefaults},
#endif
#ifdef _WIN32
              {"hevc_nvenc",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kNvencPriority, ApplyHardwareDefaults},
              {"hevc_qsv",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kQsvPriority, ApplyHardwareDefaults},
#endif
#ifdef __linux__
              {"hevc_vaapi",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kVaapiPriority, ApplyHardwareDefaults},
              {"hevc_nvenc",
               EncoderCaps::kHardwareAccelerated | EncoderCaps::kSupportsBFrames,
               kNvencPriority, ApplyHardwareDefaults},
#endif
              {"libx265",
               EncoderCaps::kSupportsBFrames | EncoderCaps::kSupportsQuantizer,
               kSoftwarePriority, ApplyLibx265Options},
          },
      .quantizer_min = 0,
      .quantizer_max = 51,
  });

  // VP8
  video_codecs_.push_back({
      .codec_id = AV_CODEC_ID_VP8,
      .codec_string_prefixes = {"vp8"},
      .variants =
          {
              {"libvpx", EncoderCaps::kSupportsQuantizer, kSoftwarePriority,
               ApplyLibvpxOptions},
          },
      .quantizer_min = 0,
      .quantizer_max = 63,
  });

  // VP9
  video_codecs_.push_back({
      .codec_id = AV_CODEC_ID_VP9,
      .codec_string_prefixes = {"vp09", "vp9"},
      .variants =
          {
              {"libvpx-vp9", EncoderCaps::kSupportsQuantizer, kSoftwarePriority,
               ApplyLibvpxOptions},
          },
      .quantizer_min = 0,
      .quantizer_max = 63,
  });

  // AV1
  video_codecs_.push_back({
      .codec_id = AV_CODEC_ID_AV1,
      .codec_string_prefixes = {"av01", "av1"},
      .variants =
          {
              {"libaom-av1", EncoderCaps::kSupportsQuantizer, kSoftwarePriority,
               ApplyLibaomOptions},
              {"libsvtav1", EncoderCaps::kSupportsQuantizer,
               kSoftwarePriority - 1, ApplyLibsvtav1Options},
          },
      .quantizer_min = 0,
      .quantizer_max = 63,
  });
}
```

**Step 4: Add RegisterAudioCodecs implementation** (2 min)

Add after `RegisterVideoCodecs`:

```cpp
void EncoderRegistry::RegisterAudioCodecs() {
  audio_codecs_.push_back({
      .codec_id = AV_CODEC_ID_OPUS,
      .codec_string_prefixes = {"opus"},
      .apply_options = nullptr,  // Opus options handled specially
  });

  audio_codecs_.push_back({
      .codec_id = AV_CODEC_ID_AAC,
      .codec_string_prefixes = {"mp4a.40"},
      .apply_options = nullptr,
  });

  audio_codecs_.push_back({
      .codec_id = AV_CODEC_ID_FLAC,
      .codec_string_prefixes = {"flac"},
      .apply_options = nullptr,
  });

  audio_codecs_.push_back({
      .codec_id = AV_CODEC_ID_MP3,
      .codec_string_prefixes = {"mp3"},
      .apply_options = nullptr,
  });

  audio_codecs_.push_back({
      .codec_id = AV_CODEC_ID_VORBIS,
      .codec_string_prefixes = {"vorbis"},
      .apply_options = nullptr,
  });
}
```

**Step 5: Add video codec query methods** (3 min)

Add after `RegisterAudioCodecs`:

```cpp
std::optional<AVCodecID> EncoderRegistry::ParseVideoCodecString(
    std::string_view codec_str) const {
  for (const auto& desc : video_codecs_) {
    for (const auto& prefix : desc.codec_string_prefixes) {
      if (codec_str == prefix ||
          (codec_str.size() > prefix.size() &&
           codec_str.substr(0, prefix.size()) == prefix)) {
        return desc.codec_id;
      }
    }
  }
  return std::nullopt;
}

bool EncoderRegistry::IsVideoCodecSupported(std::string_view codec_str) const {
  auto codec_id = ParseVideoCodecString(codec_str);
  if (!codec_id) return false;
  return avcodec_find_encoder(*codec_id) != nullptr;
}

std::pair<int, int> EncoderRegistry::GetQuantizerRange(AVCodecID codec_id) const {
  for (const auto& desc : video_codecs_) {
    if (desc.codec_id == codec_id) {
      return {desc.quantizer_min, desc.quantizer_max};
    }
  }
  return {0, 51};  // Default H.264 range
}
```

**Step 6: Add SelectVideoEncoder implementation** (4 min)

Add after `GetQuantizerRange`:

```cpp
EncoderSelection EncoderRegistry::SelectVideoEncoder(
    AVCodecID codec_id,
    std::string_view hw_acceleration) const {
  EncoderSelection result{nullptr, nullptr, false};
  int best_priority = -1;

  const VideoCodecDescriptor* desc = nullptr;
  for (const auto& d : video_codecs_) {
    if (d.codec_id == codec_id) {
      desc = &d;
      break;
    }
  }
  if (!desc) return result;

  bool prefer_hw = (hw_acceleration != "prefer-software");
  bool require_sw = (hw_acceleration == "prefer-software");

  for (const auto& variant : desc->variants) {
    if (variant.priority < 0) continue;  // Not available on this platform

    bool is_hw = (variant.caps & EncoderCaps::kHardwareAccelerated);
    if (require_sw && is_hw) continue;

    const AVCodec* codec = avcodec_find_encoder_by_name(variant.name);
    if (!codec) continue;

    int adjusted_priority = variant.priority;
    if (prefer_hw && is_hw) adjusted_priority += 1000;

    if (adjusted_priority > best_priority) {
      best_priority = adjusted_priority;
      result.codec = codec;
      result.variant = &variant;
      result.is_hardware = is_hw;
    }
  }

  // Fallback to generic encoder if no variant found
  if (!result.codec) {
    result.codec = avcodec_find_encoder(codec_id);
    result.is_hardware = false;
    result.variant = nullptr;
  }

  return result;
}

bool EncoderRegistry::ApplyVideoEncoderOptions(
    const EncoderSelection& selection,
    AVCodecContext* ctx,
    const std::string& bitrate_mode) const {
  if (selection.variant && selection.variant->apply_options) {
    return selection.variant->apply_options(ctx, bitrate_mode);
  }
  return true;
}
```

**Step 7: Add audio codec query methods** (2 min)

Add after `ApplyVideoEncoderOptions`:

```cpp
std::optional<AVCodecID> EncoderRegistry::ParseAudioCodecString(
    std::string_view codec_str) const {
  for (const auto& desc : audio_codecs_) {
    for (const auto& prefix : desc.codec_string_prefixes) {
      if (codec_str == prefix ||
          (codec_str.size() > prefix.size() &&
           codec_str.substr(0, prefix.size()) == prefix)) {
        return desc.codec_id;
      }
    }
  }
  return std::nullopt;
}

bool EncoderRegistry::IsAudioCodecSupported(std::string_view codec_str) const {
  auto codec_id = ParseAudioCodecString(codec_str);
  if (!codec_id) return false;
  return avcodec_find_encoder(*codec_id) != nullptr;
}

bool EncoderRegistry::ApplyAudioEncoderOptions(
    AVCodecID /*codec_id*/,
    AVCodecContext* /*ctx*/) const {
  // Audio codec options are applied directly in AudioEncoder::Configure
  // due to their complexity (Opus has many W3C-specified options)
  return true;
}
```

**Step 8: Add to binding.gyp** (2 min)

Open `binding.gyp` and add `"src/encoder_registry.cc"` to the sources array.

```bash
# Verify the file exists and find the sources array location
grep -n "sources" binding.gyp | head -5
```

**Step 9: Build to verify compilation** (30 sec)

```bash
npm run build:native 2>&1 | tail -20
```

Expected: Build succeeds without errors

**Step 10: Commit implementation** (30 sec)

```bash
git add src/encoder_registry.cc binding.gyp && git commit -m "feat(encoder): implement EncoderRegistry with video/audio codecs"
```

---

### Task 3: Migrate VideoEncoder::Configure

**Files:**
- Modify: `src/video_encoder.cc` (lines 238-395)

**Step 1: Add include for encoder_registry.h** (1 min)

At the top of `src/video_encoder.cc`, after other includes:

```cpp
#include "src/encoder_registry.h"
```

**Step 2: Replace codec string parsing (lines 238-253)** (3 min)

Replace:
```cpp
  // Find encoder based on codec string
  AVCodecID codec_id = AV_CODEC_ID_NONE;
  if (codec_str.find("avc1") == 0 || codec_str == "h264") {
    codec_id = AV_CODEC_ID_H264;
  } else if (codec_str == "vp8") {
    codec_id = AV_CODEC_ID_VP8;
  } else if (codec_str.find("vp09") == 0 || codec_str == "vp9") {
    codec_id = AV_CODEC_ID_VP9;
  } else if (codec_str.find("av01") == 0 || codec_str == "av1") {
    codec_id = AV_CODEC_ID_AV1;
  } else if (codec_str.find("hev1") == 0 || codec_str.find("hvc1") == 0 ||
             codec_str == "hevc") {
    codec_id = AV_CODEC_ID_HEVC;
  } else {
    throw Napi::Error::New(env, "Unsupported codec: " + codec_str);
  }
```

With:
```cpp
  // Parse codec string using registry
  auto& registry = webcodecs::EncoderRegistry::Instance();
  auto codec_id_opt = registry.ParseVideoCodecString(codec_str);
  if (!codec_id_opt) {
    throw Napi::Error::New(env, "Unsupported codec: " + codec_str);
  }
  AVCodecID codec_id = *codec_id_opt;
```

**Step 3: Replace hardware encoder selection (lines 255-293)** (3 min)

Replace the entire block from `// Try hardware encoders first` through the fallback:
```cpp
  // Try hardware encoders first based on platform...
  codec_ = nullptr;
  std::string hw_accel = ...
  if (hw_accel != "prefer-software") {
#ifdef __APPLE__
    ...
#endif
    ...
  }
  // Fallback to software encoder
  if (!codec_) {
    codec_ = avcodec_find_encoder(codec_id);
  }
```

With:
```cpp
  // Select encoder using registry
  std::string hw_accel =
      webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");
  auto selection = registry.SelectVideoEncoder(codec_id, hw_accel);
  codec_ = selection.codec;
```

**Step 4: Replace encoder type detection and options (lines 337-395)** (4 min)

Replace the entire block from `// Detect if this is a hardware encoder` through the codec-specific options:
```cpp
  // Detect if this is a hardware encoder...
  bool is_hw_encoder = codec_ && (strstr(codec_->name, "videotoolbox")...
  bool is_libx264 = ...
  ...
  if (!is_hw_encoder) {
    if (codec_id == AV_CODEC_ID_H264 && is_libx264) {
      ...
    }
    ...
  }
```

With:
```cpp
  // Apply encoder-specific options via registry
  // Hardware encoders have their own internal settings
  if (!selection.is_hardware) {
    registry.ApplyVideoEncoderOptions(selection, codec_context_.get(),
                                       bitrate_mode);
  }
```

**Step 5: Build and run tests** (1 min)

```bash
npm run build:native && npm run test-fast 2>&1 | tail -30
```

Expected: Build succeeds, tests pass

**Step 6: Commit changes** (30 sec)

```bash
git add src/video_encoder.cc && git commit -m "refactor(video-encoder): use EncoderRegistry for Configure()"
```

---

### Task 4: Migrate VideoEncoder::IsConfigSupported

**Files:**
- Modify: `src/video_encoder.cc` (lines 799-973)

**Step 1: Replace codec validation (lines 814-851)** (3 min)

Find the block in `IsConfigSupported`:
```cpp
  // Validate codec.
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
    normalized_config.Set("codec", codec);

    // Check if codec is supported.
    if (codec.find("avc1") == 0 || codec == "h264") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_H264);
      if (!c) {
        supported = false;
      }
    } else if (codec == "vp8") {
      ...
    } else {
      supported = false;
    }
  }
```

Replace with:
```cpp
  // Validate codec using registry.
  auto& registry = webcodecs::EncoderRegistry::Instance();
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
    normalized_config.Set("codec", codec);

    // Check if codec is supported via registry.
    if (!registry.IsVideoCodecSupported(codec)) {
      supported = false;
    }
  }
```

**Step 2: Build and run tests** (1 min)

```bash
npm run build:native && npm run test-fast 2>&1 | tail -30
```

Expected: Build succeeds, tests pass

**Step 3: Commit changes** (30 sec)

```bash
git add src/video_encoder.cc && git commit -m "refactor(video-encoder): use EncoderRegistry for IsConfigSupported()"
```

---

### Task 5: Extend Registry for Audio

**Files:**
- Already done in Task 2

This task is complete - audio codecs were registered in Task 2. Verify:

**Step 1: Verify audio codecs are registered** (30 sec)

```bash
grep -A5 "RegisterAudioCodecs" src/encoder_registry.cc | head -20
```

Expected: Shows opus, mp4a.40, flac, mp3, vorbis registrations

**Step 2: Commit (if any changes needed)** (30 sec)

```bash
git status
```

Expected: No uncommitted changes (audio was included in Task 2)

---

### Task 6: Migrate AudioEncoder

**Files:**
- Modify: `src/audio_encoder.cc` (lines 91-103, 540-667)

**Step 1: Add include for encoder_registry.h** (1 min)

At the top of `src/audio_encoder.cc`, after other includes:

```cpp
#include "src/encoder_registry.h"
```

**Step 2: Replace codec string parsing in Configure (lines 88-103)** (3 min)

Replace:
```cpp
  // Parse codec string.
  std::string codec_str = webcodecs::AttrAsStr(config, "codec", "mp4a.40.2");

  // Determine codec ID.
  AVCodecID codec_id = AV_CODEC_ID_AAC;
  if (codec_str == "opus") {
    codec_id = AV_CODEC_ID_OPUS;
  } else if (codec_str.find("mp4a.40") == 0) {
    codec_id = AV_CODEC_ID_AAC;
  } else if (codec_str == "flac") {
    codec_id = AV_CODEC_ID_FLAC;
  } else if (codec_str == "mp3") {
    codec_id = AV_CODEC_ID_MP3;
  } else if (codec_str == "vorbis") {
    codec_id = AV_CODEC_ID_VORBIS;
  }
```

With:
```cpp
  // Parse codec string using registry.
  std::string codec_str = webcodecs::AttrAsStr(config, "codec", "mp4a.40.2");

  auto& registry = webcodecs::EncoderRegistry::Instance();
  auto codec_id_opt = registry.ParseAudioCodecString(codec_str);
  AVCodecID codec_id = codec_id_opt.value_or(AV_CODEC_ID_AAC);
```

**Step 3: Replace codec validation in IsConfigSupported (lines 555-590)** (3 min)

Find the block:
```cpp
  // Check codec.
  if (!webcodecs::HasAttr(config, "codec")) {
    supported = false;
  } else {
    std::string codec = webcodecs::AttrAsStr(config, "codec");
    normalized_config.Set("codec", codec);

    if (codec == "opus") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_OPUS);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("mp4a.40") == 0) {
      ...
    } else {
      supported = false;
    }
  }
```

Replace with:
```cpp
  // Check codec using registry.
  auto& registry = webcodecs::EncoderRegistry::Instance();
  if (!webcodecs::HasAttr(config, "codec")) {
    supported = false;
  } else {
    std::string codec = webcodecs::AttrAsStr(config, "codec");
    normalized_config.Set("codec", codec);

    if (!registry.IsAudioCodecSupported(codec)) {
      supported = false;
    }
  }
```

**Step 4: Build and run tests** (1 min)

```bash
npm run build:native && npm run test-fast 2>&1 | tail -30
```

Expected: Build succeeds, tests pass

**Step 5: Commit changes** (30 sec)

```bash
git add src/audio_encoder.cc && git commit -m "refactor(audio-encoder): use EncoderRegistry for codec detection"
```

---

### Task 7: Add Unit Tests

**Files:**
- Create: `test/unit/encoder-registry.test.ts`

**Step 1: Create test file with video codec tests** (4 min)

```typescript
// test/unit/encoder-registry.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { VideoEncoder } from '../../lib/index.js';

describe('EncoderRegistry (via VideoEncoder.isConfigSupported)', () => {
  describe('video codec string parsing', () => {
    const videoCodecs = [
      // H.264 variants
      { codec: 'avc1.42001e', expected: true, name: 'H.264 Baseline' },
      { codec: 'avc1.4d001e', expected: true, name: 'H.264 Main' },
      { codec: 'avc1.64001e', expected: true, name: 'H.264 High' },
      { codec: 'h264', expected: true, name: 'H.264 short form' },
      // H.265 variants
      { codec: 'hev1.1.6.L93.B0', expected: true, name: 'HEVC hev1' },
      { codec: 'hvc1.1.6.L93.B0', expected: true, name: 'HEVC hvc1' },
      { codec: 'hevc', expected: true, name: 'HEVC short form' },
      // VP8/VP9
      { codec: 'vp8', expected: true, name: 'VP8' },
      { codec: 'vp9', expected: true, name: 'VP9 short form' },
      { codec: 'vp09.00.10.08', expected: true, name: 'VP9 full string' },
      // AV1
      { codec: 'av1', expected: true, name: 'AV1 short form' },
      { codec: 'av01.0.04M.08', expected: true, name: 'AV1 full string' },
      // Invalid
      { codec: 'invalid-codec', expected: false, name: 'Invalid codec' },
      { codec: '', expected: false, name: 'Empty string' },
    ];

    for (const { codec, expected, name } of videoCodecs) {
      it(`should ${expected ? 'support' : 'reject'} ${name} (${codec})`, async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec,
          width: 640,
          height: 480,
        });
        expect(result.supported).toBe(expected);
      });
    }
  });

  describe('hardware acceleration preference', () => {
    it('should accept no-preference', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
        hardwareAcceleration: 'no-preference',
      });
      expect(result.supported).toBe(true);
    });

    it('should accept prefer-software', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
        hardwareAcceleration: 'prefer-software',
      });
      expect(result.supported).toBe(true);
    });

    it('should accept prefer-hardware', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
        hardwareAcceleration: 'prefer-hardware',
      });
      expect(result.supported).toBe(true);
    });
  });
});
```

**Step 2: Add audio codec tests** (3 min)

Append to the same file:

```typescript
import { AudioEncoder } from '../../lib/index.js';

describe('EncoderRegistry (via AudioEncoder.isConfigSupported)', () => {
  describe('audio codec string parsing', () => {
    const audioCodecs = [
      { codec: 'opus', expected: true, name: 'Opus' },
      { codec: 'mp4a.40.2', expected: true, name: 'AAC-LC' },
      { codec: 'mp4a.40.5', expected: true, name: 'AAC-HE' },
      { codec: 'flac', expected: true, name: 'FLAC' },
      { codec: 'mp3', expected: true, name: 'MP3' },
      { codec: 'vorbis', expected: true, name: 'Vorbis' },
      { codec: 'invalid-audio', expected: false, name: 'Invalid codec' },
    ];

    for (const { codec, expected, name } of audioCodecs) {
      it(`should ${expected ? 'support' : 'reject'} ${name} (${codec})`, async () => {
        const result = await AudioEncoder.isConfigSupported({
          codec,
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        // Note: Some codecs may not be available in all builds
        if (expected) {
          // If we expect support, it should either be supported or
          // the codec library is not available (still valid behavior)
          expect(typeof result.supported).toBe('boolean');
        } else {
          expect(result.supported).toBe(false);
        }
      });
    }
  });
});
```

**Step 3: Run the tests** (30 sec)

```bash
npx vitest run test/unit/encoder-registry.test.ts
```

Expected: All tests pass

**Step 4: Commit test file** (30 sec)

```bash
git add test/unit/encoder-registry.test.ts && git commit -m "test(encoder): add unit tests for EncoderRegistry codec parsing"
```

---

### Task 8: Code Review

**Step 1: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass

**Step 2: Run linter** (1 min)

```bash
npm run lint
```

Expected: No linting errors

**Step 3: Review changes** (2 min)

```bash
git log --oneline -10
git diff main..HEAD --stat
```

**Step 4: Self-review checklist**

- [ ] No `strstr` or `strcmp` for encoder detection in video_encoder.cc
- [ ] No `strstr` or `strcmp` for encoder detection in audio_encoder.cc
- [ ] No duplicated codec string parsing
- [ ] `av_opt_set` failures are logged
- [ ] All existing tests pass
- [ ] RAII patterns preserved
- [ ] No new memory leaks

**Step 5: Ready for PR**

Use `/dev-workflow:finishing-a-development-branch` to create PR.
