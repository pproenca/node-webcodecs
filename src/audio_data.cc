// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_data.h"

extern "C" {
#include <libswresample/swresample.h>
}

#include <cstring>
#include <string>

namespace {
constexpr int kMicrosecondsPerSecond = 1000000;

// Map WebCodecs format string to FFmpeg AVSampleFormat.
AVSampleFormat ParseAudioFormat(const std::string& format) {
  if (format == "u8") return AV_SAMPLE_FMT_U8;
  if (format == "s16") return AV_SAMPLE_FMT_S16;
  if (format == "s32") return AV_SAMPLE_FMT_S32;
  if (format == "f32") return AV_SAMPLE_FMT_FLT;
  if (format == "u8-planar") return AV_SAMPLE_FMT_U8P;
  if (format == "s16-planar") return AV_SAMPLE_FMT_S16P;
  if (format == "s32-planar") return AV_SAMPLE_FMT_S32P;
  if (format == "f32-planar") return AV_SAMPLE_FMT_FLTP;
  return AV_SAMPLE_FMT_NONE;
}

// Get bytes per sample for a format string.
size_t GetFormatBytesPerSample(const std::string& format) {
  if (format == "u8" || format == "u8-planar") return 1;
  if (format == "s16" || format == "s16-planar") return 2;
  return 4;  // s32, f32, and their planar variants
}

// Check if format is planar.
bool IsPlanarFormat(const std::string& format) {
  return format.find("-planar") != std::string::npos;
}
}  // namespace

Napi::FunctionReference AudioData::constructor_;

Napi::Object InitAudioData(Napi::Env env, Napi::Object exports) {
  return AudioData::Init(env, exports);
}

Napi::Object AudioData::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "AudioData",
      {
          InstanceAccessor("format", &AudioData::GetFormat, nullptr),
          InstanceAccessor("sampleRate", &AudioData::GetSampleRate, nullptr),
          InstanceAccessor("numberOfFrames", &AudioData::GetNumberOfFrames,
                           nullptr),
          InstanceAccessor("numberOfChannels", &AudioData::GetNumberOfChannels,
                           nullptr),
          InstanceAccessor("duration", &AudioData::GetDuration, nullptr),
          InstanceAccessor("timestamp", &AudioData::GetTimestamp, nullptr),
          InstanceMethod("allocationSize", &AudioData::AllocationSize),
          InstanceMethod("copyTo", &AudioData::CopyTo),
          InstanceMethod("clone", &AudioData::Clone),
          InstanceMethod("close", &AudioData::Close),
      });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("AudioData", func);
  return exports;
}

Napi::Object AudioData::CreateInstance(Napi::Env env, const std::string& format,
                                       uint32_t sample_rate,
                                       uint32_t number_of_frames,
                                       uint32_t number_of_channels,
                                       int64_t timestamp, const uint8_t* data,
                                       size_t data_size) {
  Napi::Object init = Napi::Object::New(env);
  init.Set("format", format);
  init.Set("sampleRate", sample_rate);
  init.Set("numberOfFrames", number_of_frames);
  init.Set("numberOfChannels", number_of_channels);
  init.Set("timestamp", Napi::Number::New(env, static_cast<double>(timestamp)));
  init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, data_size));
  return constructor_.New({init});
}

AudioData::AudioData(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioData>(info),
      sample_rate_(0),
      number_of_frames_(0),
      number_of_channels_(0),
      timestamp_(0),
      closed_(false) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "AudioData requires init object")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Required: format.
  if (!init.Has("format") || !init.Get("format").IsString()) {
    Napi::TypeError::New(env, "init.format is required")
        .ThrowAsJavaScriptException();
    return;
  }
  format_ = init.Get("format").As<Napi::String>().Utf8Value();

  // Validate format.
  if (format_ != "u8" && format_ != "s16" && format_ != "s32" &&
      format_ != "f32" && format_ != "u8-planar" && format_ != "s16-planar" &&
      format_ != "s32-planar" && format_ != "f32-planar") {
    Napi::TypeError::New(env, "Invalid audio sample format")
        .ThrowAsJavaScriptException();
    return;
  }

  // Required: sampleRate.
  if (!init.Has("sampleRate") || !init.Get("sampleRate").IsNumber()) {
    Napi::TypeError::New(env, "init.sampleRate is required")
        .ThrowAsJavaScriptException();
    return;
  }
  sample_rate_ = init.Get("sampleRate").As<Napi::Number>().Uint32Value();

  // Required: numberOfFrames.
  if (!init.Has("numberOfFrames") || !init.Get("numberOfFrames").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfFrames is required")
        .ThrowAsJavaScriptException();
    return;
  }
  number_of_frames_ =
      init.Get("numberOfFrames").As<Napi::Number>().Uint32Value();

  // Required: numberOfChannels.
  if (!init.Has("numberOfChannels") ||
      !init.Get("numberOfChannels").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfChannels is required")
        .ThrowAsJavaScriptException();
    return;
  }
  number_of_channels_ =
      init.Get("numberOfChannels").As<Napi::Number>().Uint32Value();

  // Required: timestamp.
  if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
    Napi::TypeError::New(env, "init.timestamp is required")
        .ThrowAsJavaScriptException();
    return;
  }
  timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

  // Required: data.
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "init.data is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_val = init.Get("data");
  if (data_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_val.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = data_val.As<Napi::ArrayBuffer>();
    data_.assign(static_cast<uint8_t*>(ab.Data()),
                 static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
  } else if (data_val.IsTypedArray()) {
    Napi::TypedArray ta = data_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    size_t offset = ta.ByteOffset();
    size_t length = ta.ByteLength();
    data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                 static_cast<uint8_t*>(ab.Data()) + offset + length);
  } else {
    Napi::TypeError::New(env, "init.data must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
  }

  // Validate data size.
  size_t expected_size =
      number_of_frames_ * number_of_channels_ * GetBytesPerSample();
  if (data_.size() < expected_size) {
    Napi::TypeError::New(env, "init.data is too small for specified parameters")
        .ThrowAsJavaScriptException();
    return;
  }
}

size_t AudioData::GetBytesPerSample() const {
  if (format_ == "u8" || format_ == "u8-planar") {
    return 1;
  }
  if (format_ == "s16" || format_ == "s16-planar") {
    return 2;
  }
  if (format_ == "s32" || format_ == "s32-planar" || format_ == "f32" ||
      format_ == "f32-planar") {
    return 4;
  }
  return 4;  // Default.
}

bool AudioData::IsPlanar() const {
  return format_.find("-planar") != std::string::npos;
}

Napi::Value AudioData::GetFormat(const Napi::CallbackInfo& info) {
  if (closed_) {
    return info.Env().Null();
  }
  return Napi::String::New(info.Env(), format_);
}

Napi::Value AudioData::GetSampleRate(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), sample_rate_);
}

Napi::Value AudioData::GetNumberOfFrames(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), number_of_frames_);
}

Napi::Value AudioData::GetNumberOfChannels(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), number_of_channels_);
}

Napi::Value AudioData::GetDuration(const Napi::CallbackInfo& info) {
  // Duration in microseconds.
  int64_t duration = static_cast<int64_t>(number_of_frames_) *
                     kMicrosecondsPerSecond / sample_rate_;
  return Napi::Number::New(info.Env(), static_cast<double>(duration));
}

Napi::Value AudioData::GetTimestamp(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(timestamp_));
}

Napi::Value AudioData::AllocationSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse options object (required per W3C spec).
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "allocationSize requires options object")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object options = info[0].As<Napi::Object>();

  // Required: planeIndex.
  if (!options.Has("planeIndex") || !options.Get("planeIndex").IsNumber()) {
    Napi::TypeError::New(env, "options.planeIndex is required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  uint32_t plane_index =
      options.Get("planeIndex").As<Napi::Number>().Uint32Value();

  // Validate planeIndex.
  bool is_planar = IsPlanar();
  if (!is_planar && plane_index != 0) {
    Napi::RangeError::New(env,
                          "planeIndex must be 0 for interleaved formats")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  if (is_planar && plane_index >= number_of_channels_) {
    Napi::RangeError::New(env, "planeIndex out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Optional: frameOffset (default 0).
  uint32_t frame_offset = 0;
  if (options.Has("frameOffset") && options.Get("frameOffset").IsNumber()) {
    frame_offset = options.Get("frameOffset").As<Napi::Number>().Uint32Value();
  }
  if (frame_offset >= number_of_frames_) {
    Napi::RangeError::New(env, "frameOffset out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Optional: frameCount (default remaining frames).
  uint32_t frame_count = number_of_frames_ - frame_offset;
  if (options.Has("frameCount") && options.Get("frameCount").IsNumber()) {
    frame_count = options.Get("frameCount").As<Napi::Number>().Uint32Value();
    if (frame_offset + frame_count > number_of_frames_) {
      frame_count = number_of_frames_ - frame_offset;
    }
  }

  // Optional: format (default current format).
  std::string target_format = format_;
  if (options.Has("format") && options.Get("format").IsString()) {
    target_format = options.Get("format").As<Napi::String>().Utf8Value();
  }

  // Calculate allocation size.
  size_t bytes_per_sample = GetFormatBytesPerSample(target_format);
  bool target_planar = IsPlanarFormat(target_format);

  size_t size;
  if (target_planar) {
    // Planar output: single channel plane.
    size = frame_count * bytes_per_sample;
  } else {
    // Interleaved output: all channels.
    size = frame_count * number_of_channels_ * bytes_per_sample;
  }

  return Napi::Number::New(env, static_cast<double>(size));
}

void AudioData::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed")
        .ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "copyTo requires destination buffer")
        .ThrowAsJavaScriptException();
    return;
  }

  // TODO(user): Handle options for planeIndex, frameOffset, frameCount, format.

  Napi::Value dest_val = info[0];
  uint8_t* dest_data = nullptr;
  size_t dest_size = 0;

  if (dest_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = dest_val.As<Napi::Buffer<uint8_t>>();
    dest_data = buf.Data();
    dest_size = buf.Length();
  } else if (dest_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = dest_val.As<Napi::ArrayBuffer>();
    dest_data = static_cast<uint8_t*>(ab.Data());
    dest_size = ab.ByteLength();
  } else if (dest_val.IsTypedArray()) {
    Napi::TypedArray ta = dest_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    dest_data = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
    dest_size = ta.ByteLength();
  } else {
    Napi::TypeError::New(env, "destination must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
  }

  if (dest_size < data_.size()) {
    Napi::TypeError::New(env, "destination buffer too small")
        .ThrowAsJavaScriptException();
    return;
  }

  std::memcpy(dest_data, data_.data(), data_.size());
}

Napi::Value AudioData::Clone(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: Cannot clone closed AudioData")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return CreateInstance(env, format_, sample_rate_, number_of_frames_,
                        number_of_channels_, timestamp_, data_.data(),
                        data_.size());
}

void AudioData::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
