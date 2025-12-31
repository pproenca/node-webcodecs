# Sharp Advanced Patterns Design

**Date:** 2024-12-31
**Status:** Draft - Pending Review
**Goal:** Document advanced C++ and production patterns from sharp that extend beyond the existing 2024-12-31-sharp-patterns-adoption-design.md

## Overview

This document captures **additional** patterns from lovell/sharp that were not covered in the initial adoption design. These patterns focus on:
- Advanced C++ idioms (descriptors, templates, tuples)
- Signal/progress handling
- Logging and warning infrastructure
- Enhanced error handling
- Memory management patterns
- Production infrastructure improvements

---

## Section 1: Advanced C++ Patterns

### 1.1 InputDescriptor Pattern

Sharp uses comprehensive descriptor structs with **in-class initialization** for clean default values:

```cpp
// Sharp pattern - common.h
struct InputDescriptor {
  // Input identification with defaults
  std::string name = "";
  bool failOnError = true;

  // Processing options
  int density = 72;
  int limitInputPixels = 0;
  bool unlimited = false;

  // Raw input parameters
  int rawWidth = 0;
  int rawHeight = 0;
  int rawChannels = 0;
  int rawDepth = 8;
  bool rawPremultiplied = false;

  InputDescriptor() = default;
  ~InputDescriptor() = default;
};
```

**node-webcodecs application:**

```cpp
// src/descriptors.h
namespace webcodecs {

struct VideoFrameDescriptor {
  // Source identification
  std::string format = "RGBA";
  int64_t timestamp = 0;
  int64_t duration = 0;

  // Dimensions with validation-friendly defaults
  uint32_t codedWidth = 0;
  uint32_t codedHeight = 0;
  uint32_t displayWidth = 0;  // Falls back to codedWidth
  uint32_t displayHeight = 0; // Falls back to codedHeight

  // Visible rect (optional cropping)
  uint32_t visibleRectX = 0;
  uint32_t visibleRectY = 0;
  uint32_t visibleRectWidth = 0;  // Falls back to codedWidth
  uint32_t visibleRectHeight = 0; // Falls back to codedHeight

  // Color space
  std::string colorPrimaries = "bt709";
  std::string colorTransfer = "bt709";
  std::string colorMatrix = "bt709";
  bool fullRange = false;

  VideoFrameDescriptor() = default;
};

struct VideoEncoderConfigDescriptor {
  std::string codec = "";
  uint32_t width = 0;
  uint32_t height = 0;
  uint32_t displayWidth = 0;
  uint32_t displayHeight = 0;
  int64_t bitrate = 0;
  double framerate = 0.0;
  std::string latencyMode = "quality";
  std::string bitrateMode = "variable";
  std::string scalabilityMode = "";
  std::string hardwareAcceleration = "no-preference";
  std::string avc = "avc";  // or "annexb"
  std::string hevc = "hevc"; // or "annexb"

  // Color space
  std::string colorPrimaries = "";
  std::string colorTransfer = "";
  std::string colorMatrix = "";
  bool colorFullRange = false;

  VideoEncoderConfigDescriptor() = default;
};

// Factory function
VideoFrameDescriptor* CreateVideoFrameDescriptor(
    Napi::Env env, Napi::Object obj);
VideoEncoderConfigDescriptor* CreateEncoderConfigDescriptor(
    Napi::Env env, Napi::Object obj);

}  // namespace webcodecs
```

### 1.2 Template Enum Conversion Pattern

Sharp uses generic `AttrAsEnum<T>` for type-safe enum extraction:

```cpp
// Sharp pattern
template<typename T>
T AttrAsEnum(Napi::Object obj, std::string attr, T def);

// Usage:
VipsAccess access = AttrAsEnum<VipsAccess>(obj, "access", VIPS_ACCESS_RANDOM);
```

**node-webcodecs application:**

```cpp
// src/common.h additions
namespace webcodecs {

// Template for FFmpeg enums with string mapping
template<typename T>
T AttrAsEnum(Napi::Object obj, const std::string& attr, T default_val,
             const std::unordered_map<std::string, T>& mapping) {
  std::string val = AttrAsStr(obj, attr);
  if (val.empty()) return default_val;
  auto it = mapping.find(val);
  return (it != mapping.end()) ? it->second : default_val;
}

// Predefined mappings for WebCodecs enums
extern const std::unordered_map<std::string, AVColorPrimaries> kColorPrimariesMap;
extern const std::unordered_map<std::string, AVColorTransferCharacteristic> kTransferMap;
extern const std::unordered_map<std::string, AVColorSpace> kMatrixMap;
extern const std::unordered_map<std::string, AVPixelFormat> kPixelFormatMap;

}  // namespace webcodecs

// Usage example:
AVColorPrimaries primaries = AttrAsEnum(config, "colorPrimaries",
    AVCOL_PRI_BT709, kColorPrimariesMap);
```

### 1.3 Tuple Return Types Pattern

Sharp returns multiple values via `std::tuple` with C++17 structured bindings:

```cpp
// Sharp pattern
std::tuple<VImage, ImageType> OpenInput(InputDescriptor* descriptor);
std::tuple<int, int> CalculateCrop(int width, int height, ...);

// Auto structured bindings (C++17)
auto [image, type] = OpenInput(descriptor);
```

**node-webcodecs application:**

```cpp
// src/common.h additions
namespace webcodecs {

// Multi-value returns for decoding
std::tuple<AVFrame*, AVPixelFormat, int64_t> DecodePacket(
    AVCodecContext* ctx, AVPacket* packet);

// Dimension calculation with aspect ratio
std::tuple<int, int, int, int> CalculateVisibleRect(
    int codedWidth, int codedHeight,
    const VideoFrameDescriptor& desc);

// Codec parsing result
std::tuple<AVCodecID, std::string, int> ParseCodecString(
    const std::string& codec);

}  // namespace webcodecs

// Usage:
auto [codecId, profile, level] = ParseCodecString("avc1.42E01E");
```

---

## Section 2: Signal, Progress, and Logging Patterns

### 2.1 Progress Callback Pattern

Sharp implements progress monitoring with timeout detection:

```cpp
// Sharp pattern - pipeline.cc
void SetTimeout(VImage image, int seconds) {
  if (seconds > 0) {
    image.set_progress(true);
    image.signal_connect("eval", VipsProgressCallBack);
  }
}

void VipsProgressCallBack(VImage* image, void* progress, void*) {
  VipsProgress* p = static_cast<VipsProgress*>(progress);
  if (p->percent > 0 && TimeElapsed() > timeout) {
    vips_image_set_kill(image->get_image(), TRUE);
  }
}
```

**node-webcodecs application:**

```cpp
// src/progress.h
namespace webcodecs {

struct ProgressInfo {
  int64_t frames_processed;
  int64_t frames_total;
  double elapsed_seconds;
  bool cancelled;
};

using ProgressCallback = std::function<void(const ProgressInfo&)>;

class TimeoutGuard {
 public:
  explicit TimeoutGuard(double timeout_seconds);
  bool IsExpired() const;
  double ElapsedSeconds() const;
  void Reset();

 private:
  std::chrono::steady_clock::time_point start_;
  double timeout_seconds_;
};

// Integration with async workers
class ProgressTracker {
 public:
  void SetCallback(ProgressCallback callback);
  void SetTimeout(double seconds);
  void ReportProgress(int64_t current, int64_t total);
  bool ShouldCancel() const;

 private:
  ProgressCallback callback_;
  TimeoutGuard timeout_;
  std::atomic<bool> cancelled_{false};
};

}  // namespace webcodecs
```

### 2.2 Debug Logging Integration

Sharp passes JS debuglog to C++ for diagnostic messages:

```cpp
// Sharp stores as persistent reference
Napi::FunctionReference debuglog;

// In OnOK() - surfaces VIPS warnings through JS
std::vector<std::string> warnings = GetVipsWarnings();
for (const auto& warning : warnings) {
  debuglog.Call({Napi::String::New(env, warning)});
}
```

**node-webcodecs application:**

```cpp
// src/logger.h
namespace webcodecs {

class Logger {
 public:
  // Singleton access
  static Logger& Instance();

  // Set JS callback for debug output
  void SetDebugCallback(Napi::Env env, Napi::Function callback);
  void ClearDebugCallback();

  // Log methods (thread-safe)
  void Log(const std::string& message);
  void LogWarning(const std::string& message);
  void LogError(const std::string& message);

  // FFmpeg log handler
  static void FFmpegLogCallback(void* ptr, int level, const char* fmt, va_list vl);

 private:
  Logger() = default;
  Napi::FunctionReference debug_callback_;
  std::mutex log_mutex_;
  std::queue<std::string> pending_logs_;
};

// Registration in addon.cc init
void InitLogging(Napi::Env env, Napi::Object exports);

}  // namespace webcodecs
```

### 2.3 Warning Queue Pattern

Sharp accumulates warnings thread-safely during processing:

```cpp
// Sharp pattern - common.cc
std::queue<std::string> vipsWarnings;
std::mutex vipsWarningsMutex;

void AddWarning(const std::string& msg) {
  std::lock_guard<std::mutex> lock(vipsWarningsMutex);
  vipsWarnings.push(msg);
}

std::vector<std::string> GetWarnings() {
  std::lock_guard<std::mutex> lock(vipsWarningsMutex);
  std::vector<std::string> result;
  while (!vipsWarnings.empty()) {
    result.push_back(vipsWarnings.front());
    vipsWarnings.pop();
  }
  return result;
}
```

**node-webcodecs application:**

```cpp
// src/warnings.h
namespace webcodecs {

class WarningAccumulator {
 public:
  void Add(const std::string& warning);
  std::vector<std::string> Drain();
  bool HasWarnings() const;
  size_t Count() const;

 private:
  std::queue<std::string> warnings_;
  mutable std::mutex mutex_;
};

// Per-operation warning context (attached to baton)
struct EncodeBaton {
  // ... existing fields ...
  WarningAccumulator warnings;
};

// Global accumulator for FFmpeg log messages
extern WarningAccumulator globalWarnings;

}  // namespace webcodecs
```

---

## Section 3: Enhanced Error Handling

### 3.1 Composite Error Wrapping

Sharp wraps underlying library errors with context:

```cpp
// Sharp pattern
catch (vips::VError const &err) {
  throw vips::VError(
    std::string("Input buffer has corrupt header: ") + err.what());
}

// Accumulates errors in baton
baton->err = "Resize failed: " + FFmpegErrorString(ret);
```

**node-webcodecs enhancement:**

```cpp
// src/error_builder.h
namespace webcodecs {

class ErrorBuilder {
 public:
  explicit ErrorBuilder(const std::string& operation);

  ErrorBuilder& WithFFmpegCode(int errnum);
  ErrorBuilder& WithContext(const std::string& context);
  ErrorBuilder& WithValue(const std::string& name, int64_t value);
  ErrorBuilder& WithValue(const std::string& name, const std::string& value);

  std::string Build() const;
  Napi::Error BuildNapi(Napi::Env env) const;

 private:
  std::string operation_;
  int ffmpeg_code_ = 0;
  std::vector<std::string> context_;
  std::vector<std::pair<std::string, std::string>> values_;
};

}  // namespace webcodecs

// Usage:
if (ret < 0) {
  throw ErrorBuilder("avcodec_send_frame")
    .WithFFmpegCode(ret)
    .WithContext("while encoding frame")
    .WithValue("pts", frame->pts)
    .WithValue("format", PixelFormatToString(frame->format))
    .BuildNapi(env);
}

// Output: "avcodec_send_frame failed: Invalid argument (while encoding frame, pts=12345, format=I420)"
```

### 3.2 Native Error Stack Preservation

Already implemented in `lib/is.ts`:

```typescript
export function nativeError(native: Error, context: Error): Error {
  context.message = native.message;
  if ('code' in native) {
    (context as Error & {code: unknown}).code = native.code;
  }
  return context;
}
```

Usage pattern in lib/index.ts:

```typescript
try {
  this._native.encode(frame);
} catch (err) {
  throw is.nativeError(err as Error, new Error());
}
```

---

## Section 4: Memory and Resource Patterns

### 4.1 External Buffer Cleanup Callback

Sharp uses callbacks for external memory deallocation:

```cpp
// Sharp pattern
extern std::function<void(void*, char*)> FreeCallback;

FreeCallback = [](void* data, char* hint) {
  g_free(data);  // Use glib's allocator for Windows DLL compatibility
};

// Usage with Napi::Buffer
Napi::Buffer<char>::New(
  env,
  data,
  length,
  [](Napi::Env, char* data) { FreeCallback(data, nullptr); }
);
```

**node-webcodecs application:**

```cpp
// src/buffer_utils.h
namespace webcodecs {

using BufferFinalizer = std::function<void(uint8_t*)>;

// Factory for buffers from different sources
Napi::Buffer<uint8_t> CreateOutputBuffer(
    Napi::Env env,
    uint8_t* data,
    size_t length,
    BufferFinalizer finalizer = nullptr);

// Default finalizer for av_malloc'd buffers
inline void AVFree(uint8_t* data) {
  av_free(data);
}

// Finalizer that frees the packet after buffer is released
inline BufferFinalizer PacketFinalizer(AVPacket* packet) {
  return [packet](uint8_t*) { av_packet_free(&packet); };
}

// Create buffer that owns an AVPacket
Napi::Buffer<uint8_t> CreatePacketBuffer(
    Napi::Env env, AVPacket* packet);

}  // namespace webcodecs

// Usage:
AVPacket* pkt = av_packet_alloc();
// ... fill packet ...
auto buffer = CreatePacketBuffer(env, pkt);
// packet is automatically freed when buffer is garbage collected
```

### 4.2 Reference Counting for Shared Resources

Clear ownership semantics in baton pattern:

```cpp
// src/encode_baton.h
namespace webcodecs {

struct EncodeBaton {
  // ========== References (NOT owned) ==========
  AVCodecContext* codec_ctx;  // Owned by VideoEncoder

  // ========== Owned data (copied for thread safety) ==========
  std::vector<uint8_t> frame_data;  // Deep copy of input
  AVPixelFormat input_format;
  int width;
  int height;
  int64_t timestamp;
  int64_t duration;
  bool key_frame;

  // ========== Output (transferred to JS) ==========
  ffmpeg::AVPacketPtr packet;  // Unique ownership

  // ========== Metadata ==========
  std::string err;
  WarningAccumulator warnings;

  EncodeBaton() : packet(ffmpeg::make_packet()) {}
  ~EncodeBaton() = default;

  // Disable copy, enable move
  EncodeBaton(const EncodeBaton&) = delete;
  EncodeBaton& operator=(const EncodeBaton&) = delete;
  EncodeBaton(EncodeBaton&&) = default;
  EncodeBaton& operator=(EncodeBaton&&) = default;
};

}  // namespace webcodecs
```

---

## Section 5: Production Infrastructure Patterns

### 5.1 Comprehensive Platform Detection

Enhanced `lib/platform.ts`:

```typescript
// lib/platform.ts
import { familySync } from 'detect-libc';

export function runtimePlatformArch(): string {
  const platform = process.platform;
  const arch = process.arch;

  // Handle musl vs glibc on Linux
  if (platform === 'linux') {
    const libc = familySync();
    if (libc === 'musl') {
      return `linuxmusl-${arch}`;
    }
  }

  return `${platform}-${arch}`;
}

export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'linuxmusl-x64',
  'linuxmusl-arm64',
  'win32-x64',
  'win32-arm64',
] as const;

export type PrebuiltPlatform = typeof prebuiltPlatforms[number];

export function isPrebuiltAvailable(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}

export function getPrebuiltPackageName(): string {
  return `@ffmpeg/node-webcodecs-${runtimePlatformArch()}`;
}
```

### 5.2 Multi-Fallback Binding Loader

Enhanced `lib/binding.ts`:

```typescript
// lib/binding.ts
import { runtimePlatformArch, isPrebuiltAvailable, getPrebuiltPackageName } from './platform';
import type { NativeBinding } from './native-types';

const candidates: Array<string | (() => NativeBinding)> = [
  // Development build (Release)
  '../build/Release/node_webcodecs.node',

  // Development build (Debug)
  '../build/Debug/node_webcodecs.node',

  // node-gyp-build output
  () => require('node-gyp-build')(__dirname + '/..'),

  // Platform-specific prebuilt
  () => {
    const pkg = getPrebuiltPackageName();
    return require(pkg);
  },
];

function loadBinding(): NativeBinding {
  const errors: Array<{path: string; error: Error}> = [];

  for (const candidate of candidates) {
    try {
      if (typeof candidate === 'function') {
        return candidate();
      }
      return require(candidate);
    } catch (err) {
      errors.push({
        path: typeof candidate === 'string' ? candidate : 'node-gyp-build or prebuilt',
        error: err as Error
      });
    }
  }

  throw new Error(buildHelpMessage(errors));
}

function buildHelpMessage(errors: Array<{path: string; error: Error}>): string {
  const platform = runtimePlatformArch();
  const hasPrebuilt = isPrebuiltAvailable();

  let msg = `Could not load native binding for ${platform}.\n\n`;

  msg += 'Attempted paths:\n';
  for (const {path, error} of errors) {
    msg += `  - ${path}: ${error.message}\n`;
  }

  msg += '\nPossible solutions:\n';

  if (hasPrebuilt) {
    msg += `  1. Install with optional dependencies:\n`;
    msg += `     npm install --include=optional\n\n`;
  }

  msg += `  ${hasPrebuilt ? '2' : '1'}. Build from source:\n`;
  msg += getPlatformBuildInstructions(platform);

  return msg;
}

function getPlatformBuildInstructions(platform: string): string {
  if (platform.startsWith('darwin')) {
    return `     brew install ffmpeg\n     npm run build:native\n`;
  }
  if (platform.startsWith('linux')) {
    return `     sudo apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev\n     npm run build:native\n`;
  }
  if (platform.startsWith('win32')) {
    return `     Download FFmpeg from https://github.com/BtbN/FFmpeg-Builds/releases\n     Set FFMPEG_PATH environment variable\n     npm run build:native\n`;
  }
  return `     Install FFmpeg development libraries\n     npm run build:native\n`;
}

export const binding = loadBinding();

export const platformInfo = {
  platform: runtimePlatformArch(),
  prebuilt: isPrebuiltAvailable(),
};
```

### 5.3 FFmpeg Log Redirection

```cpp
// src/addon.cc or src/common.cc
namespace webcodecs {

void InitFFmpegLogging() {
  static std::once_flag log_init_once;
  std::call_once(log_init_once, []() {
    av_log_set_callback([](void* ptr, int level, const char* fmt, va_list vl) {
      if (level <= AV_LOG_WARNING) {
        char buf[1024];
        vsnprintf(buf, sizeof(buf), fmt, vl);

        // Remove trailing newline
        size_t len = strlen(buf);
        if (len > 0 && buf[len-1] == '\n') buf[len-1] = '\0';

        // Route to warning accumulator
        globalWarnings.Add(buf);

        // Also log to stderr in debug mode
        #ifdef DEBUG
        fprintf(stderr, "[FFmpeg] %s\n", buf);
        #endif
      }
    });

    // Set default log level
    av_log_set_level(AV_LOG_WARNING);
  });
}

}  // namespace webcodecs
```

---

## Section 6: Coding Style Improvements

### 6.1 Const-Correctness Audit

Current state vs. recommended:

```cpp
// Current (some methods missing const)
class VideoEncoder {
  Napi::Value GetState(const Napi::CallbackInfo& info);
  bool IsCodecSaturated() const;  // ✅ Already const
};

// Recommended additions
class VideoEncoder {
  // Accessor methods should be const
  std::string GetCodecString() const;
  int GetWidth() const;
  int GetHeight() const;
  int64_t GetFrameCount() const;

  // State queries should be const
  bool IsConfigured() const;
  bool IsClosed() const;
};
```

### 6.2 Enhanced Factory Functions

Already have `ffmpeg::make_*` in `ffmpeg_raii.h`. Additional factories:

```cpp
// src/factories.h
namespace webcodecs {

// High-level encoder creation
struct EncoderOptions {
  std::string codec;
  int width;
  int height;
  int64_t bitrate = 0;
  int fps_num = 30;
  int fps_den = 1;
  std::string preset = "medium";
  int gop_size = 0;  // 0 = auto
};

ffmpeg::AVCodecContextPtr CreateEncoderContext(
    const EncoderOptions& options);

// High-level decoder creation
struct DecoderOptions {
  std::string codec;
  int threads = 0;  // 0 = auto
};

ffmpeg::AVCodecContextPtr CreateDecoderContext(
    const DecoderOptions& options);

}  // namespace webcodecs
```

---

## Section 7: Implementation Priority

| Pattern | Priority | Effort | Impact |
|---------|----------|--------|--------|
| InputDescriptor structs | High | Low | High - cleaner configuration |
| Composite error wrapping | High | Low | High - better debugging |
| Warning queue | High | Low | Medium - FFmpeg diagnostics |
| Template AttrAsEnum<T> | Medium | Low | Medium - type safety |
| Tuple return types | Medium | Low | Medium - cleaner APIs |
| Debug logging integration | Medium | Medium | Medium - observability |
| External buffer callbacks | Medium | Low | Low - edge cases |
| Progress/Timeout callbacks | Low | Medium | Low - long operations |
| Platform detection enhancement | Medium | Low | High - install experience |
| FFmpeg log redirection | Medium | Low | Medium - diagnostics |
| Const-correctness audit | Low | Low | Low - code quality |
| Factory pattern expansion | Low | Low | Low - convenience |

### Recommended Implementation Order

**Phase 1: Error & Diagnostics (1-2 days)**
1. Composite error wrapping (ErrorBuilder)
2. Warning queue implementation
3. FFmpeg log redirection

**Phase 2: Configuration Patterns (1 day)**
4. InputDescriptor structs
5. Template AttrAsEnum<T>

**Phase 3: Return Patterns (0.5 day)**
6. Tuple return types where applicable

**Phase 4: Production (1 day)**
7. Platform detection enhancement
8. External buffer callbacks

**Phase 5: Observability (0.5-1 day)**
9. Debug logging integration
10. Progress/Timeout callbacks (optional)

---

## Success Criteria

- [ ] Error messages include FFmpeg error codes and context
- [ ] Warnings from FFmpeg are surfaced to JS layer
- [ ] Configuration uses descriptor structs with defaults
- [ ] Enum extraction is type-safe via templates
- [ ] Install experience includes helpful platform-specific instructions
- [ ] All accessor methods are const-correct
