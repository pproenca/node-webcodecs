// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/common.h"

#include <cstdio>
#include <cstring>
#include <queue>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>

namespace webcodecs {

// STATIC DESTRUCTION ORDER FIX: Use heap-allocated "immortal" counters.
// During process exit, static destructors may run in unpredictable order.
// Codec destructors access these counters, so we must ensure they're never
// destroyed. We trade a tiny memory leak at exit for crash-free shutdown.
// This matches the pattern used for FFmpeg logging queue/mutex.

// Per-class instance counters for deterministic leak detection
static std::atomic<int64_t>& GetCounterVideoFrames() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}
static std::atomic<int64_t>& GetCounterAudioData() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}
static std::atomic<int64_t>& GetCounterVideoEncoders() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}
static std::atomic<int64_t>& GetCounterVideoDecoders() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}
static std::atomic<int64_t>& GetCounterAudioEncoders() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}
static std::atomic<int64_t>& GetCounterAudioDecoders() {
  static auto* counter = new std::atomic<int64_t>(0);
  return *counter;
}

// Legacy counters (maintained for backwards compatibility)
static std::atomic<int>& GetCounterQueue() {
  static auto* counter = new std::atomic<int>(0);
  return *counter;
}
static std::atomic<int>& GetCounterProcess() {
  static auto* counter = new std::atomic<int>(0);
  return *counter;
}
static std::atomic<int>& GetCounterFrames() {
  static auto* counter = new std::atomic<int>(0);
  return *counter;
}

// References to immortal counters for extern linkage
std::atomic<int64_t>& counterVideoFrames = GetCounterVideoFrames();
std::atomic<int64_t>& counterAudioData = GetCounterAudioData();
std::atomic<int64_t>& counterVideoEncoders = GetCounterVideoEncoders();
std::atomic<int64_t>& counterVideoDecoders = GetCounterVideoDecoders();
std::atomic<int64_t>& counterAudioEncoders = GetCounterAudioEncoders();
std::atomic<int64_t>& counterAudioDecoders = GetCounterAudioDecoders();

std::atomic<int>& counterQueue = GetCounterQueue();
std::atomic<int>& counterProcess = GetCounterProcess();
std::atomic<int>& counterFrames = GetCounterFrames();

// FreeCallback for consistent buffer deallocation (following sharp pattern).
// Default implementation uses delete[]. Can be overridden for platform-specific
// memory management (e.g., Windows mixed runtime scenarios).
std::function<void(void*, uint8_t*)> FreeCallback = [](void*, uint8_t* data) {
  delete[] data;
};

//==============================================================================
// Attribute Helpers
//==============================================================================

bool HasAttr(Napi::Object obj, const std::string& attr) {
  return obj.Has(attr) && !obj.Get(attr).IsUndefined();
}

std::string AttrAsStr(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return "";
  Napi::Value val = obj.Get(attr);
  if (!val.IsString()) return "";
  return val.As<Napi::String>().Utf8Value();
}

std::string AttrAsStr(Napi::Object obj, const std::string& attr,
                      const std::string& default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsString()) return default_val;
  return val.As<Napi::String>().Utf8Value();
}

uint32_t AttrAsUint32(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Uint32Value();
}

int32_t AttrAsInt32(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Int32Value();
}

int32_t AttrAsInt32(Napi::Object obj, const std::string& attr,
                    int32_t default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().Int32Value();
}

int64_t AttrAsInt64(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Int64Value();
}

int64_t AttrAsInt64(Napi::Object obj, const std::string& attr,
                    int64_t default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().Int64Value();
}

double AttrAsDouble(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0.0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0.0;
  return val.As<Napi::Number>().DoubleValue();
}

double AttrAsDouble(Napi::Object obj, const std::string& attr,
                    double default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().DoubleValue();
}

bool AttrAsBool(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return false;
  Napi::Value val = obj.Get(attr);
  if (!val.IsBoolean()) return false;
  return val.As<Napi::Boolean>().Value();
}

bool AttrAsBool(Napi::Object obj, const std::string& attr, bool default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsBoolean()) return default_val;
  return val.As<Napi::Boolean>().Value();
}

std::tuple<const uint8_t*, size_t> AttrAsBuffer(Napi::Object obj,
                                                const std::string& attr) {
  if (!HasAttr(obj, attr)) return {nullptr, 0};
  Napi::Value val = obj.Get(attr);

  if (val.IsBuffer()) {
    auto buf = val.As<Napi::Buffer<uint8_t>>();
    return {buf.Data(), buf.Length()};
  }
  if (val.IsArrayBuffer()) {
    auto ab = val.As<Napi::ArrayBuffer>();
    return {static_cast<const uint8_t*>(ab.Data()), ab.ByteLength()};
  }
  if (val.IsTypedArray()) {
    auto ta = val.As<Napi::TypedArray>();
    return {
        static_cast<const uint8_t*>(ta.ArrayBuffer().Data()) + ta.ByteOffset(),
        ta.ByteLength()};
  }
  return {nullptr, 0};
}

//==============================================================================
// Template Enum Mappings
//==============================================================================

const std::unordered_map<std::string, AVColorPrimaries> kColorPrimariesMap = {
    {"bt709", AVCOL_PRI_BT709},         {"bt470bg", AVCOL_PRI_BT470BG},
    {"smpte170m", AVCOL_PRI_SMPTE170M}, {"bt2020", AVCOL_PRI_BT2020},
    {"smpte432", AVCOL_PRI_SMPTE432},
};

const std::unordered_map<std::string, AVColorTransferCharacteristic>
    kTransferMap = {
        {"bt709", AVCOL_TRC_BT709},
        {"smpte170m", AVCOL_TRC_SMPTE170M},
        {"iec61966-2-1", AVCOL_TRC_IEC61966_2_1},  // sRGB
        {"linear", AVCOL_TRC_LINEAR},
        {"pq", AVCOL_TRC_SMPTE2084},
        {"hlg", AVCOL_TRC_ARIB_STD_B67},
};

const std::unordered_map<std::string, AVColorSpace> kMatrixMap = {
    {"bt709", AVCOL_SPC_BT709},
    {"bt470bg", AVCOL_SPC_BT470BG},
    {"smpte170m", AVCOL_SPC_SMPTE170M},
    {"bt2020-ncl", AVCOL_SPC_BT2020_NCL},
    {"rgb", AVCOL_SPC_RGB},
};

std::string ColorPrimariesToString(AVColorPrimaries primaries) {
  for (const auto& [name, val] : kColorPrimariesMap) {
    if (val == primaries) return name;
  }
  return "bt709";
}

std::string TransferToString(AVColorTransferCharacteristic transfer) {
  for (const auto& [name, val] : kTransferMap) {
    if (val == transfer) return name;
  }
  return "bt709";
}

std::string MatrixToString(AVColorSpace matrix) {
  for (const auto& [name, val] : kMatrixMap) {
    if (val == matrix) return name;
  }
  return "bt709";
}

//==============================================================================
// Validation Helpers
//==============================================================================

void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) {
    throw Napi::Error::New(env, "Missing required parameter: " + attr);
  }
}

void RequirePositiveInt(Napi::Env env, const std::string& name, int32_t value) {
  if (value <= 0) {
    throw Napi::Error::New(env, "Expected positive integer for " + name +
                                    " but received " + std::to_string(value));
  }
}

void RequireNonNegativeInt(Napi::Env env, const std::string& name,
                           int32_t value) {
  if (value < 0) {
    throw Napi::Error::New(env, "Expected non-negative integer for " + name +
                                    " but received " + std::to_string(value));
  }
}

void RequireInRange(Napi::Env env, const std::string& name, int32_t value,
                    int32_t min, int32_t max) {
  if (value < min || value > max) {
    throw Napi::Error::New(env, "Expected " + name + " between " +
                                    std::to_string(min) + " and " +
                                    std::to_string(max) + " but received " +
                                    std::to_string(value));
  }
}

void RequireOneOf(Napi::Env env, const std::string& name,
                  const std::string& value,
                  const std::vector<std::string>& allowed) {
  for (const auto& a : allowed) {
    if (value == a) return;
  }
  std::string allowed_str = "[";
  for (size_t i = 0; i < allowed.size(); ++i) {
    if (i > 0) allowed_str += ", ";
    allowed_str += allowed[i];
  }
  allowed_str += "]";
  throw Napi::Error::New(env, "Expected one of " + allowed_str + " for " +
                                  name + " but received '" + value + "'");
}

//==============================================================================
// Error Helpers
//==============================================================================

Napi::Error InvalidParameterError(Napi::Env env, const std::string& name,
                                  const std::string& expected,
                                  const Napi::Value& actual) {
  std::string actualType;
  std::string actualStr;

  if (actual.IsNull()) {
    actualType = "null";
    actualStr = "null";
  } else if (actual.IsUndefined()) {
    actualType = "undefined";
    actualStr = "undefined";
  } else if (actual.IsString()) {
    actualType = "string";
    actualStr = "'" + actual.As<Napi::String>().Utf8Value() + "'";
  } else if (actual.IsNumber()) {
    actualType = "number";
    actualStr = std::to_string(actual.As<Napi::Number>().DoubleValue());
  } else if (actual.IsBoolean()) {
    actualType = "boolean";
    actualStr = actual.As<Napi::Boolean>().Value() ? "true" : "false";
  } else if (actual.IsArray()) {
    actualType = "array";
    actualStr = "array";
  } else if (actual.IsObject()) {
    actualType = "object";
    actualStr = "object";
  } else {
    actualType = "unknown";
    actualStr = "unknown";
  }

  return Napi::Error::New(env, "Expected " + expected + " for " + name +
                                   " but received " + actualStr + " of type " +
                                   actualType);
}

Napi::Error FFmpegError(Napi::Env env, const std::string& operation,
                        int errnum) {
  return Napi::Error::New(env, operation + ": " + FFmpegErrorString(errnum));
}

std::string FFmpegErrorString(int errnum) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE] = {0};
  int ret = av_strerror(errnum, errbuf, sizeof(errbuf));
  // Check for explicit failure OR empty buffer (ABI mismatch with strerror_r).
  // FFmpeg built on musl expects XSI strerror_r (returns int, writes to buffer).
  // When running on glibc, GNU strerror_r returns char* without writing to buffer.
  if (ret < 0 || errbuf[0] == '\0') {
    snprintf(errbuf, sizeof(errbuf), "Error code %d", errnum);
  }
  return std::string(errbuf);
}

//==============================================================================
// Pixel Format Utilities
//==============================================================================

AVPixelFormat PixelFormatFromString(const std::string& format) {
  // WebCodecs format names to FFmpeg pixel formats
  if (format == "I420" || format == "YUV420P") return AV_PIX_FMT_YUV420P;
  if (format == "I420A") return AV_PIX_FMT_YUVA420P;
  if (format == "I422") return AV_PIX_FMT_YUV422P;
  if (format == "I444") return AV_PIX_FMT_YUV444P;
  if (format == "NV12") return AV_PIX_FMT_NV12;
  if (format == "NV21") return AV_PIX_FMT_NV21;
  if (format == "RGBA") return AV_PIX_FMT_RGBA;
  if (format == "RGBX") return AV_PIX_FMT_RGB0;
  if (format == "BGRA") return AV_PIX_FMT_BGRA;
  if (format == "BGRX") return AV_PIX_FMT_BGR0;
  if (format == "RGB24") return AV_PIX_FMT_RGB24;
  if (format == "BGR24") return AV_PIX_FMT_BGR24;
  return AV_PIX_FMT_NONE;
}

std::string PixelFormatToString(AVPixelFormat format) {
  switch (format) {
    case AV_PIX_FMT_YUV420P:
      return "I420";
    case AV_PIX_FMT_YUVA420P:
      return "I420A";
    case AV_PIX_FMT_YUV422P:
      return "I422";
    case AV_PIX_FMT_YUV444P:
      return "I444";
    case AV_PIX_FMT_NV12:
      return "NV12";
    case AV_PIX_FMT_NV21:
      return "NV21";
    case AV_PIX_FMT_RGBA:
      return "RGBA";
    case AV_PIX_FMT_RGB0:
      return "RGBX";
    case AV_PIX_FMT_BGRA:
      return "BGRA";
    case AV_PIX_FMT_BGR0:
      return "BGRX";
    case AV_PIX_FMT_RGB24:
      return "RGB24";
    case AV_PIX_FMT_BGR24:
      return "BGR24";
    default:
      return "";
  }
}

//==============================================================================
// String Utilities
//==============================================================================

std::string TrimEnd(const std::string& str) {
  size_t end = str.find_last_not_of(" \t\n\r\f\v");
  return (end == std::string::npos) ? "" : str.substr(0, end + 1);
}

//==============================================================================
// FFmpeg Initialization
//==============================================================================

static std::once_flag ffmpeg_init_flag;

void InitFFmpeg() {
  std::call_once(ffmpeg_init_flag, []() {
    // FFmpeg 5.0+ does not require explicit avcodec_register_all()
    // Set log level to suppress debug output
    av_log_set_level(AV_LOG_ERROR);
  });
}

//==============================================================================
// FFmpeg Logging
//==============================================================================

// STATIC DESTRUCTION ORDER FIX: Use heap-allocated "immortal" objects to prevent
// crashes during process exit. When vitest worker processes exit, static
// destructors may run in unpredictable order, causing FFmpeg's log callback
// to access destroyed mutex/queue. By never destroying these, we trade a tiny
// memory leak at exit for crash-free shutdown.
static std::queue<std::string>& GetWarningsQueue() {
  static auto* queue = new std::queue<std::string>();
  return *queue;
}
static std::mutex& GetWarningsMutex() {
  static auto* mutex = new std::mutex();
  return *mutex;
}
static std::atomic<bool> ffmpegLoggingActive{false};

void InitFFmpegLogging() {
  static std::once_flag log_init_once;
  std::call_once(log_init_once, []() {
    ffmpegLoggingActive.store(true, std::memory_order_release);
    av_log_set_callback([](void* ptr, int level, const char* fmt, va_list vl) {
      // Guard against callbacks during/after shutdown to prevent
      // static destruction order fiasco on process exit.
      if (!ffmpegLoggingActive.load(std::memory_order_acquire)) {
        return;
      }
      if (level <= AV_LOG_WARNING) {
        char buf[1024];
        vsnprintf(buf, sizeof(buf), fmt, vl);

        // Remove trailing newline
        size_t len = strlen(buf);
        if (len > 0 && buf[len - 1] == '\n') buf[len - 1] = '\0';

        // Skip empty messages
        if (strlen(buf) == 0) return;

        std::lock_guard<std::mutex> lock(GetWarningsMutex());
        GetWarningsQueue().push(buf);
      }
    });
    av_log_set_level(AV_LOG_WARNING);
  });
}

void ShutdownFFmpegLogging() {
  // Ensure shutdown runs exactly once - multiple concurrent calls from
  // encoder/decoder destructors and cleanup hook could race on av_log_set_callback.
  static std::once_flag shutdown_once;
  std::call_once(shutdown_once, []() {
    // Disable logging callback before static destructors run.
    // This prevents the callback from accessing destroyed statics
    // during process exit (static destruction order fiasco).
    ffmpegLoggingActive.store(false, std::memory_order_release);
    av_log_set_callback(nullptr);
  });
}

std::vector<std::string> GetFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(GetWarningsMutex());
  std::vector<std::string> result;
  auto& queue = GetWarningsQueue();
  while (!queue.empty()) {
    result.push_back(queue.front());
    queue.pop();
  }
  return result;
}

void ClearFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(GetWarningsMutex());
  auto& queue = GetWarningsQueue();
  while (!queue.empty()) {
    queue.pop();
  }
}

}  // namespace webcodecs
