// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libavutil/error.h>
#include <libavutil/pixdesc.h>
}

#include <napi.h>

#include <atomic>
#include <functional>
#include <mutex>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>

// Verify FFmpeg version compatibility
#if LIBAVCODEC_VERSION_MAJOR < 59
#error "FFmpeg 5.0+ (libavcodec 59+) is required"
#endif

// AVFrame::duration was added in FFmpeg 5.1 (libavutil 57.28.100)
// Before that, use pkt_duration (deprecated in 5.1+)
#if LIBAVUTIL_VERSION_INT >= AV_VERSION_INT(57, 28, 100)
#define AV_FRAME_DURATION(frame) ((frame)->duration)
#define AV_FRAME_SET_DURATION(frame, val) ((frame)->duration = (val))
#else
#define AV_FRAME_DURATION(frame) ((frame)->pkt_duration)
#define AV_FRAME_SET_DURATION(frame, val) ((frame)->pkt_duration = (val))
#endif

namespace webcodecs {

//==============================================================================
// Napi::Object Attribute Helpers
//==============================================================================

bool HasAttr(Napi::Object obj, const std::string& attr);
std::string AttrAsStr(Napi::Object obj, const std::string& attr);
std::string AttrAsStr(Napi::Object obj, const std::string& attr,
                      const std::string& default_val);
uint32_t AttrAsUint32(Napi::Object obj, const std::string& attr);
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr);
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr,
                    int32_t default_val);
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr);
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr,
                    int64_t default_val);
double AttrAsDouble(Napi::Object obj, const std::string& attr);
double AttrAsDouble(Napi::Object obj, const std::string& attr,
                    double default_val);
bool AttrAsBool(Napi::Object obj, const std::string& attr);
bool AttrAsBool(Napi::Object obj, const std::string& attr, bool default_val);
std::tuple<const uint8_t*, size_t> AttrAsBuffer(Napi::Object obj,
                                                const std::string& attr);

//==============================================================================
// Template Enum Helpers
//==============================================================================

// Template for FFmpeg enums with string mapping
template <typename T>
T AttrAsEnum(Napi::Object obj, const std::string& attr, T default_val,
             const std::unordered_map<std::string, T>& mapping) {
  std::string val = AttrAsStr(obj, attr);
  if (val.empty()) return default_val;
  auto it = mapping.find(val);
  return (it != mapping.end()) ? it->second : default_val;
}

// Predefined enum mappings
extern const std::unordered_map<std::string, AVColorPrimaries>
    kColorPrimariesMap;
extern const std::unordered_map<std::string, AVColorTransferCharacteristic>
    kTransferMap;
extern const std::unordered_map<std::string, AVColorSpace> kMatrixMap;

// String conversion for enums
std::string ColorPrimariesToString(AVColorPrimaries primaries);
std::string TransferToString(AVColorTransferCharacteristic transfer);
std::string MatrixToString(AVColorSpace matrix);

//==============================================================================
// Validation Helpers (throw on failure)
//==============================================================================

void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr);
void RequirePositiveInt(Napi::Env env, const std::string& name, int32_t value);
void RequireNonNegativeInt(Napi::Env env, const std::string& name,
                           int32_t value);
void RequireInRange(Napi::Env env, const std::string& name, int32_t value,
                    int32_t min, int32_t max);
void RequireOneOf(Napi::Env env, const std::string& name,
                  const std::string& value,
                  const std::vector<std::string>& allowed);

//==============================================================================
// Error Helpers
//==============================================================================

Napi::Error InvalidParameterError(Napi::Env env, const std::string& name,
                                  const std::string& expected,
                                  const Napi::Value& actual);
Napi::Error FFmpegError(Napi::Env env, const std::string& operation,
                        int errnum);
std::string FFmpegErrorString(int errnum);

//==============================================================================
// Pixel Format Utilities
//==============================================================================

AVPixelFormat PixelFormatFromString(const std::string& format);
std::string PixelFormatToString(AVPixelFormat format);

//==============================================================================
// Global Counters (for monitoring and leak detection)
//==============================================================================

// Per-class instance counters for deterministic leak detection.
// Increment in constructor, decrement in destructor.
// NOTE: These are references to heap-allocated "immortal" atomics to prevent
// static destruction order issues during process exit (darwin-x64 fix).
extern std::atomic<int64_t>& counterVideoFrames;
extern std::atomic<int64_t>& counterAudioData;
extern std::atomic<int64_t>& counterVideoEncoders;
extern std::atomic<int64_t>& counterVideoDecoders;
extern std::atomic<int64_t>& counterAudioEncoders;
extern std::atomic<int64_t>& counterAudioDecoders;

// Legacy counters (maintained for backwards compatibility)
extern std::atomic<int>& counterQueue;
extern std::atomic<int>& counterProcess;
extern std::atomic<int>& counterFrames;  // Legacy frame counter (use counterVideoFrames)

//==============================================================================
// Memory Management (following sharp pattern for Windows compatibility)
//==============================================================================

// FreeCallback for consistent buffer deallocation across platforms.
// Windows mixed runtime libraries can have issues with different allocators,
// so using a consistent deallocation function avoids potential crashes.
extern std::function<void(void*, uint8_t*)> FreeCallback;

//==============================================================================
// String Utilities
//==============================================================================

// Trim whitespace from end of string (following sharp pattern)
std::string TrimEnd(const std::string& str);

//==============================================================================
// FFmpeg Initialization
//==============================================================================

void InitFFmpeg();

//==============================================================================
// FFmpeg Log Capture
//==============================================================================

void InitFFmpegLogging();
void ShutdownFFmpegLogging();
std::vector<std::string> GetFFmpegWarnings();
void ClearFFmpegWarnings();

}  // namespace webcodecs

#endif  // SRC_COMMON_H_
