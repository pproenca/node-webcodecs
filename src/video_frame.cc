// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_frame.h"

#include <cstring>
#include <string>

// Static constructor reference for clone().
Napi::FunctionReference VideoFrame::constructor;

PixelFormat ParsePixelFormat(const std::string& format_str) {
  if (format_str == "RGBA") {
    return PixelFormat::RGBA;
  } else if (format_str == "I420") {
    return PixelFormat::I420;
  } else if (format_str == "NV12") {
    return PixelFormat::NV12;
  }
  return PixelFormat::UNKNOWN;
}

std::string PixelFormatToString(PixelFormat format) {
  switch (format) {
    case PixelFormat::RGBA:
      return "RGBA";
    case PixelFormat::I420:
      return "I420";
    case PixelFormat::NV12:
      return "NV12";
    default:
      return "UNKNOWN";
  }
}

size_t CalculateAllocationSize(PixelFormat format, uint32_t width,
                                uint32_t height) {
  switch (format) {
    case PixelFormat::RGBA:
      return width * height * 4;
    case PixelFormat::I420:
      // Y plane: width * height
      // U plane: (width/2) * (height/2)
      // V plane: (width/2) * (height/2)
      return width * height + (width / 2) * (height / 2) * 2;
    case PixelFormat::NV12:
      // Y plane: width * height
      // UV plane: width * (height/2)
      return width * height + width * (height / 2);
    default:
      return 0;
  }
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
          InstanceAccessor("format", &VideoFrame::GetFormat, nullptr),
          InstanceAccessor("rotation", &VideoFrame::GetRotation, nullptr),
          InstanceAccessor("flip", &VideoFrame::GetFlip, nullptr),
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
    : Napi::ObjectWrap<VideoFrame>(info), closed_(false) {
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

Napi::Value VideoFrame::GetFormat(const Napi::CallbackInfo& info) {
  if (closed_) {
    throw Napi::Error::New(info.Env(), "VideoFrame is closed");
  }
  return Napi::String::New(info.Env(), PixelFormatToString(format_));
}

Napi::Value VideoFrame::GetRotation(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), rotation_);
}

Napi::Value VideoFrame::GetFlip(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), flip_);
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
  init.Set("format", PixelFormatToString(format_));
  init.Set("rotation", rotation_);
  init.Set("flip", flip_);

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

  size_t size =
      CalculateAllocationSize(target_format, coded_width_, coded_height_);
  return Napi::Number::New(env, size);
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

  // Verify buffer size
  size_t required_size =
      CalculateAllocationSize(target_format, coded_width_, coded_height_);
  if (dest.Length() < required_size) {
    throw Napi::Error::New(env, "Destination buffer too small");
  }

  // Copy data
  memcpy(dest.Data(), data_.data(), data_.size());

  // Build plane layout array
  Napi::Array layout = Napi::Array::New(env);

  if (target_format == PixelFormat::RGBA) {
    Napi::Object plane = Napi::Object::New(env);
    plane.Set("offset", 0);
    plane.Set("stride", coded_width_ * 4);
    layout.Set(static_cast<uint32_t>(0), plane);
  } else if (target_format == PixelFormat::I420) {
    uint32_t ySize = coded_width_ * coded_height_;
    uint32_t uvSize = (coded_width_ / 2) * (coded_height_ / 2);

    // Y plane
    Napi::Object yPlane = Napi::Object::New(env);
    yPlane.Set("offset", 0);
    yPlane.Set("stride", coded_width_);
    layout.Set(static_cast<uint32_t>(0), yPlane);

    // U plane
    Napi::Object uPlane = Napi::Object::New(env);
    uPlane.Set("offset", ySize);
    uPlane.Set("stride", coded_width_ / 2);
    layout.Set(static_cast<uint32_t>(1), uPlane);

    // V plane
    Napi::Object vPlane = Napi::Object::New(env);
    vPlane.Set("offset", ySize + uvSize);
    vPlane.Set("stride", coded_width_ / 2);
    layout.Set(static_cast<uint32_t>(2), vPlane);
  } else if (target_format == PixelFormat::NV12) {
    uint32_t ySize = coded_width_ * coded_height_;

    // Y plane
    Napi::Object yPlane = Napi::Object::New(env);
    yPlane.Set("offset", 0);
    yPlane.Set("stride", coded_width_);
    layout.Set(static_cast<uint32_t>(0), yPlane);

    // UV plane
    Napi::Object uvPlane = Napi::Object::New(env);
    uvPlane.Set("offset", ySize);
    uvPlane.Set("stride", coded_width_);
    layout.Set(static_cast<uint32_t>(1), uvPlane);
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
