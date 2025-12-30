// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_frame.h"

#include <cstring>
#include <string>
#include <unordered_map>

// Static constructor reference for clone().
Napi::FunctionReference VideoFrame::constructor;

// Sentinel for unknown formats (trivially destructible - safe as file-scope static)
static const PixelFormatInfo kUnknownFormatInfo = {
    "UNKNOWN", AV_PIX_FMT_NONE, 0, 0, 0, 0, false, false};

// Format registry accessor using function-local static with heap allocation.
// This pattern avoids the "static initialization order fiasco" and destruction
// order issues per Google C++ Style Guide - the object is never destroyed.
// clang-format off
static const std::unordered_map<PixelFormat, PixelFormatInfo>& GetFormatRegistry() {
  static const auto* registry = new std::unordered_map<PixelFormat, PixelFormatInfo>{
      // 8-bit RGB formats (packed, single plane)
      {PixelFormat::RGBA,    {"RGBA",    AV_PIX_FMT_RGBA,         8, 1, 0, 0, true,  false}},
      {PixelFormat::RGBX,    {"RGBX",    AV_PIX_FMT_RGB0,         8, 1, 0, 0, false, false}},
      {PixelFormat::BGRA,    {"BGRA",    AV_PIX_FMT_BGRA,         8, 1, 0, 0, true,  false}},
      {PixelFormat::BGRX,    {"BGRX",    AV_PIX_FMT_BGR0,         8, 1, 0, 0, false, false}},
      // 8-bit YUV formats (4:2:0)
      {PixelFormat::I420,    {"I420",    AV_PIX_FMT_YUV420P,      8, 3, 1, 1, false, false}},
      {PixelFormat::I420A,   {"I420A",   AV_PIX_FMT_YUVA420P,     8, 4, 1, 1, true,  false}},
      // 8-bit YUV formats (4:2:2)
      {PixelFormat::I422,    {"I422",    AV_PIX_FMT_YUV422P,      8, 3, 1, 0, false, false}},
      {PixelFormat::I422A,   {"I422A",   AV_PIX_FMT_YUVA422P,     8, 4, 1, 0, true,  false}},
      // 8-bit YUV formats (4:4:4)
      {PixelFormat::I444,    {"I444",    AV_PIX_FMT_YUV444P,      8, 3, 0, 0, false, false}},
      {PixelFormat::I444A,   {"I444A",   AV_PIX_FMT_YUVA444P,     8, 4, 0, 0, true,  false}},
      // 8-bit semi-planar
      {PixelFormat::NV12,    {"NV12",    AV_PIX_FMT_NV12,         8, 2, 1, 1, false, true}},
      {PixelFormat::NV21,    {"NV21",    AV_PIX_FMT_NV21,         8, 2, 1, 1, false, true}},
      // NV12A: NV12 with alpha plane (Y + interleaved UV + A) - W3C WebCodecs spec
      // Note: FFmpeg doesn't have native NV12A, we treat as 3-plane semi-planar with alpha
      {PixelFormat::NV12A,   {"NV12A",   AV_PIX_FMT_NV12,         8, 3, 1, 1, true,  true}},
      // 10-bit YUV formats
      {PixelFormat::I420P10, {"I420P10", AV_PIX_FMT_YUV420P10LE, 10, 3, 1, 1, false, false}},
      {PixelFormat::I422P10, {"I422P10", AV_PIX_FMT_YUV422P10LE, 10, 3, 1, 0, false, false}},
      {PixelFormat::I444P10, {"I444P10", AV_PIX_FMT_YUV444P10LE, 10, 3, 0, 0, false, false}},
      {PixelFormat::NV12P10, {"NV12P10", AV_PIX_FMT_P010LE,      10, 2, 1, 1, false, true}},
      // 10-bit YUV formats with alpha
      {PixelFormat::I420AP10, {"I420AP10", AV_PIX_FMT_YUVA420P10LE, 10, 4, 1, 1, true, false}},
      {PixelFormat::I422AP10, {"I422AP10", AV_PIX_FMT_YUVA422P10LE, 10, 4, 1, 0, true, false}},
      {PixelFormat::I444AP10, {"I444AP10", AV_PIX_FMT_YUVA444P10LE, 10, 4, 0, 0, true, false}},
      // 12-bit YUV formats
      {PixelFormat::I420P12, {"I420P12", AV_PIX_FMT_YUV420P12LE, 12, 3, 1, 1, false, false}},
      {PixelFormat::I422P12, {"I422P12", AV_PIX_FMT_YUV422P12LE, 12, 3, 1, 0, false, false}},
      {PixelFormat::I444P12, {"I444P12", AV_PIX_FMT_YUV444P12LE, 12, 3, 0, 0, false, false}},
      // Note: 12-bit YUVA formats (I420AP12, etc.) not supported by FFmpeg
      // Unknown sentinel
      {PixelFormat::UNKNOWN, {"UNKNOWN", AV_PIX_FMT_NONE,         0, 0, 0, 0, false, false}},
  };
  return *registry;
}
// clang-format on

// Reverse lookup accessor: string name to PixelFormat enum
// Uses function-local static with heap allocation (never destroyed).
static const std::unordered_map<std::string, PixelFormat>& GetFormatNameLookup() {
  static const auto* lookup = new std::unordered_map<std::string, PixelFormat>([]() {
    std::unordered_map<std::string, PixelFormat> result;
    for (const auto& [format, info] : GetFormatRegistry()) {
      if (format != PixelFormat::UNKNOWN) {
        result[info.name] = format;
      }
    }
    return result;
  }());
  return *lookup;
}

const PixelFormatInfo& GetFormatInfo(PixelFormat format) {
  const auto& registry = GetFormatRegistry();
  auto it = registry.find(format);
  if (it != registry.end()) {
    return it->second;
  }
  return kUnknownFormatInfo;
}

PixelFormat ParsePixelFormat(const std::string& format_str) {
  const auto& lookup = GetFormatNameLookup();
  auto it = lookup.find(format_str);
  if (it != lookup.end()) {
    return it->second;
  }
  return PixelFormat::UNKNOWN;
}

std::string PixelFormatToString(PixelFormat format) {
  return GetFormatInfo(format).name;
}

AVPixelFormat PixelFormatToAV(PixelFormat format) {
  return GetFormatInfo(format).av_format;
}

size_t CalculateAllocationSize(PixelFormat format, uint32_t width,
                                uint32_t height) {
  const auto& info = GetFormatInfo(format);

  if (info.bit_depth == 0) {
    return 0;  // Unknown format
  }

  // Bytes per sample: 1 for 8-bit, 2 for 10-bit and 12-bit
  size_t bytes_per_sample = (info.bit_depth + 7) / 8;

  // Handle packed RGB formats (single plane, 4 bytes per pixel for RGBA/BGRA)
  if (info.num_planes == 1) {
    return width * height * 4;
  }

  // Y plane size
  size_t y_size = width * height * bytes_per_sample;

  // Chroma plane dimensions (using bit shifts for subsampling)
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

  if (info.has_alpha && info.num_planes > 3) {
    total += y_size;  // Alpha plane same size as Y
  }

  return total;
}

Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports) {
  return VideoFrame::Init(env, exports);
}

Napi::Object VideoFrame::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "VideoFrame",
      {
          InstanceAccessor("codedWidth", &VideoFrame::GetCodedWidth, nullptr),
          InstanceAccessor("codedHeight", &VideoFrame::GetCodedHeight, nullptr),
          InstanceAccessor("displayWidth", &VideoFrame::GetDisplayWidth,
                           nullptr),
          InstanceAccessor("displayHeight", &VideoFrame::GetDisplayHeight,
                           nullptr),
          InstanceAccessor("timestamp", &VideoFrame::GetTimestamp, nullptr),
          InstanceAccessor("duration", &VideoFrame::GetDuration, nullptr),
          InstanceAccessor("format", &VideoFrame::GetFormat, nullptr),
          InstanceAccessor("rotation", &VideoFrame::GetRotation, nullptr),
          InstanceAccessor("flip", &VideoFrame::GetFlip, nullptr),
          InstanceAccessor("visibleRect", &VideoFrame::GetVisibleRect, nullptr),
          InstanceMethod("close", &VideoFrame::Close),
          InstanceMethod("getData", &VideoFrame::GetDataBuffer),
          InstanceMethod("clone", &VideoFrame::Clone),
          InstanceMethod("allocationSize", &VideoFrame::AllocationSize),
          InstanceMethod("copyTo", &VideoFrame::CopyTo),
      });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("VideoFrame", func);
  return exports;
}

VideoFrame::VideoFrame(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFrame>(info),
      duration_(0),
      has_duration_(false),
      closed_(false) {
  Napi::Env env = info.Env();

  if (info.Length() < 2) {
    throw Napi::Error::New(env, "VideoFrame requires buffer and options");
  }

  // Get buffer data.
  Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
  data_.assign(buffer.Data(), buffer.Data() + buffer.Length());

  // Get options.
  Napi::Object opts = info[1].As<Napi::Object>();
  coded_width_ = opts.Get("codedWidth").As<Napi::Number>().Int32Value();
  coded_height_ = opts.Get("codedHeight").As<Napi::Number>().Int32Value();
  timestamp_ = opts.Get("timestamp").As<Napi::Number>().Int64Value();

  // Parse optional duration.
  if (opts.Has("duration") && opts.Get("duration").IsNumber()) {
    duration_ = opts.Get("duration").As<Napi::Number>().Int64Value();
    has_duration_ = true;
  }

  // displayWidth/displayHeight default to codedWidth/codedHeight per W3C spec
  if (opts.Has("displayWidth")) {
    display_width_ = opts.Get("displayWidth").As<Napi::Number>().Int32Value();
  } else {
    display_width_ = coded_width_;
  }
  if (opts.Has("displayHeight")) {
    display_height_ = opts.Get("displayHeight").As<Napi::Number>().Int32Value();
  } else {
    display_height_ = coded_height_;
  }

  if (opts.Has("format")) {
    std::string format_str = opts.Get("format").As<Napi::String>().Utf8Value();
    format_ = ParsePixelFormat(format_str);
  } else {
    format_ = PixelFormat::RGBA;
  }

  rotation_ = 0;
  flip_ = false;
  if (opts.Has("rotation")) {
    rotation_ = opts.Get("rotation").As<Napi::Number>().Int32Value();
  }
  if (opts.Has("flip")) {
    flip_ = opts.Get("flip").As<Napi::Boolean>().Value();
  }

  // Parse visibleRect from options
  if (opts.Has("visibleRect") && opts.Get("visibleRect").IsObject()) {
    Napi::Object rect = opts.Get("visibleRect").As<Napi::Object>();
    if (rect.Has("x")) {
      visible_rect_.x = rect.Get("x").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("y")) {
      visible_rect_.y = rect.Get("y").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("width")) {
      visible_rect_.width = rect.Get("width").As<Napi::Number>().Int32Value();
    }
    if (rect.Has("height")) {
      visible_rect_.height = rect.Get("height").As<Napi::Number>().Int32Value();
    }
  }

  // Default visibleRect to full coded dimensions if not specified
  if (visible_rect_.width == 0) {
    visible_rect_.width = coded_width_;
  }
  if (visible_rect_.height == 0) {
    visible_rect_.height = coded_height_;
  }

  // Validate visibleRect bounds
  if (visible_rect_.x < 0 || visible_rect_.y < 0 ||
      visible_rect_.x + visible_rect_.width > coded_width_ ||
      visible_rect_.y + visible_rect_.height > coded_height_) {
    Napi::Error::New(env, "visibleRect exceeds coded dimensions")
        .ThrowAsJavaScriptException();
    return;
  }
}

VideoFrame::~VideoFrame() {
  data_.clear();
  data_.shrink_to_fit();
}

Napi::Value VideoFrame::GetCodedWidth(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), coded_width_);
}

Napi::Value VideoFrame::GetCodedHeight(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), coded_height_);
}

Napi::Value VideoFrame::GetDisplayWidth(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), display_width_);
}

Napi::Value VideoFrame::GetDisplayHeight(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), display_height_);
}

Napi::Value VideoFrame::GetTimestamp(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value VideoFrame::GetDuration(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  // Return null if duration was not set, otherwise return the value.
  if (!has_duration_) {
    return info.Env().Null();
  }
  return Napi::Number::New(info.Env(), duration_);
}

Napi::Value VideoFrame::GetFormat(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::String::New(info.Env(), PixelFormatToString(format_));
}

Napi::Value VideoFrame::GetRotation(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Number::New(info.Env(), rotation_);
}

Napi::Value VideoFrame::GetFlip(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Boolean::New(info.Env(), flip_);
}

Napi::Value VideoFrame::GetVisibleRect(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  Napi::Env env = info.Env();
  Napi::Object rect = Napi::Object::New(env);
  rect.Set("x", Napi::Number::New(env, visible_rect_.x));
  rect.Set("y", Napi::Number::New(env, visible_rect_.y));
  rect.Set("width", Napi::Number::New(env, visible_rect_.width));
  rect.Set("height", Napi::Number::New(env, visible_rect_.height));
  return rect;
}

void VideoFrame::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    // clear() + shrink_to_fit() actually releases memory
    // (clear() alone keeps capacity allocated).
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}

Napi::Value VideoFrame::GetDataBuffer(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::Buffer<uint8_t>::Copy(info.Env(), data_.data(), data_.size());
}

Napi::Value VideoFrame::Clone(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    throw Napi::Error::New(
        env, "InvalidStateError: Cannot clone a closed VideoFrame");
  }

  // Create init object with current properties.
  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", coded_width_);
  init.Set("codedHeight", coded_height_);
  init.Set("displayWidth", display_width_);
  init.Set("displayHeight", display_height_);
  init.Set("timestamp", Napi::Number::New(env, timestamp_));
  if (has_duration_) {
    init.Set("duration", Napi::Number::New(env, duration_));
  }
  init.Set("format", PixelFormatToString(format_));
  init.Set("rotation", rotation_);
  init.Set("flip", flip_);

  // Copy visibleRect
  Napi::Object rect = Napi::Object::New(env);
  rect.Set("x", visible_rect_.x);
  rect.Set("y", visible_rect_.y);
  rect.Set("width", visible_rect_.width);
  rect.Set("height", visible_rect_.height);
  init.Set("visibleRect", rect);

  // Copy data to new buffer.
  Napi::Buffer<uint8_t> data_buffer =
      Napi::Buffer<uint8_t>::Copy(env, data_.data(), data_.size());

  // Create new VideoFrame instance.
  return constructor.New({data_buffer, init});
}

Napi::Value VideoFrame::AllocationSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    throw Napi::Error::New(env, "VideoFrame is closed");
  }

  // Use visible dimensions for allocation size
  int width = visible_rect_.width > 0 ? visible_rect_.width : coded_width_;
  int height = visible_rect_.height > 0 ? visible_rect_.height : coded_height_;

  PixelFormat target_format = format_;

  // Check if options object with format is provided
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object opts = info[0].As<Napi::Object>();
    if (opts.Has("format")) {
      std::string format_str =
          opts.Get("format").As<Napi::String>().Utf8Value();
      target_format = ParsePixelFormat(format_str);
    }
  }

  size_t size = CalculateAllocationSize(target_format, width, height);
  return Napi::Number::New(env, size);
}

// Helper function to set up source data pointers and line sizes
static void SetupSourcePlanes(PixelFormat format, const uint8_t* data,
                               int width, int height,
                               const uint8_t* src_data[4],
                               int src_linesize[4]) {
  const auto& info = GetFormatInfo(format);
  size_t bytes_per_sample = (info.bit_depth + 7) / 8;

  src_data[0] = data;
  src_data[1] = nullptr;
  src_data[2] = nullptr;
  src_data[3] = nullptr;
  src_linesize[0] = 0;
  src_linesize[1] = 0;
  src_linesize[2] = 0;
  src_linesize[3] = 0;

  // Handle packed RGB formats
  if (info.num_planes == 1) {
    src_linesize[0] = width * 4;  // RGBA/BGRA = 4 bytes per pixel
    return;
  }

  // Y plane
  size_t y_stride = width * bytes_per_sample;
  size_t y_size = y_stride * height;
  src_data[0] = data;
  src_linesize[0] = static_cast<int>(y_stride);

  // Chroma dimensions
  size_t chroma_width = width >> info.chroma_h_shift;
  size_t chroma_height = height >> info.chroma_v_shift;
  size_t chroma_stride = chroma_width * bytes_per_sample;

  if (info.is_semi_planar) {
    // NV12-style: interleaved UV
    src_data[1] = data + y_size;
    src_linesize[1] = static_cast<int>(chroma_width * 2 * bytes_per_sample);
    return;
  }

  // Planar U and V
  size_t uv_size = chroma_stride * chroma_height;
  src_data[1] = data + y_size;
  src_linesize[1] = static_cast<int>(chroma_stride);
  src_data[2] = data + y_size + uv_size;
  src_linesize[2] = static_cast<int>(chroma_stride);

  // Alpha plane if present
  if (info.has_alpha && info.num_planes > 3) {
    src_data[3] = data + y_size + uv_size * 2;
    src_linesize[3] = static_cast<int>(y_stride);
  }
}

// Helper function to set up destination data pointers and line sizes
static void SetupDestPlanes(PixelFormat format, uint8_t* data,
                             int width, int height,
                             uint8_t* dst_data[4], int dst_linesize[4]) {
  const auto& info = GetFormatInfo(format);
  size_t bytes_per_sample = (info.bit_depth + 7) / 8;

  dst_data[0] = data;
  dst_data[1] = nullptr;
  dst_data[2] = nullptr;
  dst_data[3] = nullptr;
  dst_linesize[0] = 0;
  dst_linesize[1] = 0;
  dst_linesize[2] = 0;
  dst_linesize[3] = 0;

  // Handle packed RGB formats
  if (info.num_planes == 1) {
    dst_linesize[0] = width * 4;
    return;
  }

  // Y plane
  size_t y_stride = width * bytes_per_sample;
  size_t y_size = y_stride * height;
  dst_data[0] = data;
  dst_linesize[0] = static_cast<int>(y_stride);

  // Chroma dimensions
  size_t chroma_width = width >> info.chroma_h_shift;
  size_t chroma_height = height >> info.chroma_v_shift;
  size_t chroma_stride = chroma_width * bytes_per_sample;

  if (info.is_semi_planar) {
    // NV12-style: interleaved UV
    dst_data[1] = data + y_size;
    dst_linesize[1] = static_cast<int>(chroma_width * 2 * bytes_per_sample);
    return;
  }

  // Planar U and V
  size_t uv_size = chroma_stride * chroma_height;
  dst_data[1] = data + y_size;
  dst_linesize[1] = static_cast<int>(chroma_stride);
  dst_data[2] = data + y_size + uv_size;
  dst_linesize[2] = static_cast<int>(chroma_stride);

  // Alpha plane if present
  if (info.has_alpha && info.num_planes > 3) {
    dst_data[3] = data + y_size + uv_size * 2;
    dst_linesize[3] = static_cast<int>(y_stride);
  }
}

Napi::Value VideoFrame::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    throw Napi::Error::New(env, "VideoFrame is closed");
  }

  if (info.Length() < 1) {
    throw Napi::Error::New(env, "CopyTo requires a destination buffer");
  }

  // Get destination buffer
  Napi::Buffer<uint8_t> dest = info[0].As<Napi::Buffer<uint8_t>>();

  PixelFormat target_format = format_;

  // Check if options object with format is provided
  if (info.Length() > 1 && info[1].IsObject()) {
    Napi::Object opts = info[1].As<Napi::Object>();
    if (opts.Has("format")) {
      std::string format_str =
          opts.Get("format").As<Napi::String>().Utf8Value();
      target_format = ParsePixelFormat(format_str);
    }
  }

  // Use visible dimensions for destination size
  int dest_width = visible_rect_.width > 0 ? visible_rect_.width : coded_width_;
  int dest_height = visible_rect_.height > 0 ? visible_rect_.height : coded_height_;

  // Verify buffer size
  size_t required_size =
      CalculateAllocationSize(target_format, dest_width, dest_height);
  if (dest.Length() < required_size) {
    throw Napi::Error::New(env, "Destination buffer too small");
  }

  // Check if we're doing a full copy (no cropping needed)
  bool full_copy = (visible_rect_.x == 0 && visible_rect_.y == 0 &&
                    dest_width == coded_width_ && dest_height == coded_height_);

  // If same format and full copy, just copy the data directly
  if (target_format == format_ && full_copy) {
    memcpy(dest.Data(), data_.data(), data_.size());
  } else {
    // Perform format conversion and/or cropping using sws_scale
    AVPixelFormat src_av_fmt = PixelFormatToAV(format_);
    AVPixelFormat dst_av_fmt = PixelFormatToAV(target_format);

    if (src_av_fmt == AV_PIX_FMT_NONE || dst_av_fmt == AV_PIX_FMT_NONE) {
      throw Napi::Error::New(env, "Unsupported pixel format for conversion");
    }

    // Create sws context with source=visible rect dimensions, dest=visible dimensions
    SwsContext* sws_ctx = sws_getContext(
        dest_width, dest_height, src_av_fmt,
        dest_width, dest_height, dst_av_fmt,
        SWS_BILINEAR, nullptr, nullptr, nullptr);

    if (!sws_ctx) {
      throw Napi::Error::New(env, "Failed to create sws context");
    }

    // Set up source planes with full coded dimensions
    const uint8_t* src_data[4];
    int src_linesize[4];
    SetupSourcePlanes(format_, data_.data(), coded_width_, coded_height_,
                      src_data, src_linesize);

    // Offset source planes for visibleRect cropping using format metadata
    const auto& src_fmt_info = GetFormatInfo(format_);
    size_t src_bytes_per_sample = (src_fmt_info.bit_depth + 7) / 8;

    const uint8_t* src_data_offset[4] = {nullptr, nullptr, nullptr, nullptr};
    int src_offset_x = visible_rect_.x;
    int src_offset_y = visible_rect_.y;

    for (int i = 0; i < 4 && src_data[i]; i++) {
      if (src_fmt_info.num_planes == 1) {
        // Packed RGB formats: offset = y * stride + x * bytes_per_pixel
        src_data_offset[i] = src_data[i] + src_offset_y * src_linesize[i] +
                             src_offset_x * 4;
      } else if (i == 0) {
        // Y plane: offset = y * stride + x * bytes_per_sample
        src_data_offset[i] = src_data[i] + src_offset_y * src_linesize[i] +
                             src_offset_x * src_bytes_per_sample;
      } else if (src_fmt_info.has_alpha && i == 3) {
        // Alpha plane (same as Y)
        src_data_offset[i] = src_data[i] + src_offset_y * src_linesize[i] +
                             src_offset_x * src_bytes_per_sample;
      } else if (src_fmt_info.is_semi_planar) {
        // Semi-planar UV plane
        int chroma_x = src_offset_x;  // UV is interleaved, x offset scaled by 2 in stride
        int chroma_y = src_offset_y >> src_fmt_info.chroma_v_shift;
        src_data_offset[i] = src_data[i] + chroma_y * src_linesize[i] +
                             chroma_x * src_bytes_per_sample;
      } else {
        // U/V planes - use chroma subsampling from format info
        int chroma_x = src_offset_x >> src_fmt_info.chroma_h_shift;
        int chroma_y = src_offset_y >> src_fmt_info.chroma_v_shift;
        src_data_offset[i] = src_data[i] + chroma_y * src_linesize[i] +
                             chroma_x * src_bytes_per_sample;
      }
    }

    // Set up destination planes with visible dimensions
    uint8_t* dst_data[4];
    int dst_linesize[4];
    SetupDestPlanes(target_format, dest.Data(), dest_width, dest_height,
                    dst_data, dst_linesize);

    // Perform the conversion/crop
    sws_scale(sws_ctx, src_data_offset, src_linesize, 0, dest_height,
              dst_data, dst_linesize);

    sws_freeContext(sws_ctx);
  }

  // Build plane layout array using visible dimensions and format metadata
  const auto& fmt_info = GetFormatInfo(target_format);
  size_t bytes_per_sample = (fmt_info.bit_depth + 7) / 8;

  Napi::Array layout = Napi::Array::New(env);

  if (fmt_info.num_planes == 1) {
    // Packed RGB format
    Napi::Object plane = Napi::Object::New(env);
    plane.Set("offset", 0);
    plane.Set("stride", dest_width * 4);
    layout.Set(static_cast<uint32_t>(0), plane);
  } else {
    size_t y_stride = dest_width * bytes_per_sample;
    size_t y_size = y_stride * dest_height;

    size_t chroma_width = dest_width >> fmt_info.chroma_h_shift;
    size_t chroma_height = dest_height >> fmt_info.chroma_v_shift;
    size_t chroma_stride = chroma_width * bytes_per_sample;
    size_t uv_size = chroma_stride * chroma_height;

    // Y plane
    Napi::Object yPlane = Napi::Object::New(env);
    yPlane.Set("offset", 0);
    yPlane.Set("stride", y_stride);
    layout.Set(static_cast<uint32_t>(0), yPlane);

    if (fmt_info.is_semi_planar) {
      // UV plane (interleaved)
      Napi::Object uvPlane = Napi::Object::New(env);
      uvPlane.Set("offset", y_size);
      uvPlane.Set("stride", chroma_width * 2 * bytes_per_sample);
      layout.Set(static_cast<uint32_t>(1), uvPlane);
    } else {
      // U plane
      Napi::Object uPlane = Napi::Object::New(env);
      uPlane.Set("offset", y_size);
      uPlane.Set("stride", chroma_stride);
      layout.Set(static_cast<uint32_t>(1), uPlane);

      // V plane
      Napi::Object vPlane = Napi::Object::New(env);
      vPlane.Set("offset", y_size + uv_size);
      vPlane.Set("stride", chroma_stride);
      layout.Set(static_cast<uint32_t>(2), vPlane);

      // Alpha plane if present
      if (fmt_info.has_alpha && fmt_info.num_planes > 3) {
        Napi::Object aPlane = Napi::Object::New(env);
        aPlane.Set("offset", y_size + uv_size * 2);
        aPlane.Set("stride", y_stride);
        layout.Set(static_cast<uint32_t>(3), aPlane);
      }
    }
  }

  return layout;
}

Napi::Object VideoFrame::CreateInstance(Napi::Env env, const uint8_t* data,
                                        size_t data_size, int width, int height,
                                        int64_t timestamp,
                                        const std::string& format) {
  // Create init object with properties.
  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", width);
  init.Set("codedHeight", height);
  init.Set("timestamp", Napi::Number::New(env, timestamp));
  init.Set("format", format);

  // Copy data to buffer.
  Napi::Buffer<uint8_t> data_buffer =
      Napi::Buffer<uint8_t>::Copy(env, data, data_size);

  // Create new VideoFrame instance.
  return constructor.New({data_buffer, init});
}

Napi::Object VideoFrame::CreateInstance(Napi::Env env, const uint8_t* data,
                                        size_t data_size, int width, int height,
                                        int64_t timestamp,
                                        const std::string& format, int rotation,
                                        bool flip) {
  // Create init object with properties.
  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", width);
  init.Set("codedHeight", height);
  init.Set("timestamp", Napi::Number::New(env, timestamp));
  init.Set("format", format);
  init.Set("rotation", rotation);
  init.Set("flip", flip);

  // Copy data to buffer.
  Napi::Buffer<uint8_t> data_buffer =
      Napi::Buffer<uint8_t>::Copy(env, data, data_size);

  // Create new VideoFrame instance.
  return constructor.New({data_buffer, init});
}
