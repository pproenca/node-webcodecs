// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/common.h"

#include <cstring>
#include <queue>

namespace webcodecs {

// Global counters
std::atomic<int> counterQueue{0};
std::atomic<int> counterProcess{0};
std::atomic<int> counterFrames{0};

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
    return {static_cast<const uint8_t*>(ta.ArrayBuffer().Data()) +
                ta.ByteOffset(),
            ta.ByteLength()};
  }
  return {nullptr, 0};
}

//==============================================================================
// Validation Helpers
//==============================================================================

void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) {
    throw Napi::Error::New(env, "Missing required parameter: " + attr);
  }
}

void RequirePositiveInt(Napi::Env env, const std::string& name,
                        int32_t value) {
  if (value <= 0) {
    throw Napi::Error::New(
        env, "Expected positive integer for " + name + " but received " +
                 std::to_string(value));
  }
}

void RequireNonNegativeInt(Napi::Env env, const std::string& name,
                           int32_t value) {
  if (value < 0) {
    throw Napi::Error::New(
        env, "Expected non-negative integer for " + name + " but received " +
                 std::to_string(value));
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

  return Napi::Error::New(
      env, "Expected " + expected + " for " + name + " but received " +
               actualStr + " of type " + actualType);
}

Napi::Error FFmpegError(Napi::Env env, const std::string& operation,
                        int errnum) {
  return Napi::Error::New(env, operation + ": " + FFmpegErrorString(errnum));
}

std::string FFmpegErrorString(int errnum) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(errnum, errbuf, sizeof(errbuf));
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

static std::queue<std::string> ffmpegWarnings;
static std::mutex ffmpegWarningsMutex;

void InitFFmpegLogging() {
  static std::once_flag log_init_once;
  std::call_once(log_init_once, []() {
    av_log_set_callback([](void* ptr, int level, const char* fmt, va_list vl) {
      if (level <= AV_LOG_WARNING) {
        char buf[1024];
        vsnprintf(buf, sizeof(buf), fmt, vl);

        // Remove trailing newline
        size_t len = strlen(buf);
        if (len > 0 && buf[len - 1] == '\n') buf[len - 1] = '\0';

        // Skip empty messages
        if (strlen(buf) == 0) return;

        std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
        ffmpegWarnings.push(buf);
      }
    });
    av_log_set_level(AV_LOG_WARNING);
  });
}

std::vector<std::string> GetFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
  std::vector<std::string> result;
  while (!ffmpegWarnings.empty()) {
    result.push_back(ffmpegWarnings.front());
    ffmpegWarnings.pop();
  }
  return result;
}

void ClearFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
  while (!ffmpegWarnings.empty()) {
    ffmpegWarnings.pop();
  }
}

}  // namespace webcodecs
