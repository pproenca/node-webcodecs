// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_data.h"

#include <cstring>
#include <string>
#include <vector>

#include "src/common.h"
#include "src/ffmpeg_raii.h"

extern "C" {
#include <libavutil/channel_layout.h>
#include <libavutil/opt.h>
#include <libswresample/swresample.h>
}

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
  if (!webcodecs::HasAttr(init, "format") || !init.Get("format").IsString()) {
    Napi::TypeError::New(env, "init.format is required")
        .ThrowAsJavaScriptException();
    return;
  }
  format_ = webcodecs::AttrAsStr(init, "format");

  // Validate format.
  if (format_ != "u8" && format_ != "s16" && format_ != "s32" &&
      format_ != "f32" && format_ != "u8-planar" && format_ != "s16-planar" &&
      format_ != "s32-planar" && format_ != "f32-planar") {
    Napi::TypeError::New(env, "Invalid audio sample format")
        .ThrowAsJavaScriptException();
    return;
  }

  // Required: sampleRate.
  if (!webcodecs::HasAttr(init, "sampleRate") ||
      !init.Get("sampleRate").IsNumber()) {
    Napi::TypeError::New(env, "init.sampleRate is required")
        .ThrowAsJavaScriptException();
    return;
  }
  sample_rate_ = webcodecs::AttrAsUint32(init, "sampleRate");

  // Required: numberOfFrames.
  if (!webcodecs::HasAttr(init, "numberOfFrames") ||
      !init.Get("numberOfFrames").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfFrames is required")
        .ThrowAsJavaScriptException();
    return;
  }
  number_of_frames_ = webcodecs::AttrAsUint32(init, "numberOfFrames");

  // Required: numberOfChannels.
  if (!webcodecs::HasAttr(init, "numberOfChannels") ||
      !init.Get("numberOfChannels").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfChannels is required")
        .ThrowAsJavaScriptException();
    return;
  }
  number_of_channels_ = webcodecs::AttrAsUint32(init, "numberOfChannels");

  // Required: timestamp.
  if (!webcodecs::HasAttr(init, "timestamp") ||
      !init.Get("timestamp").IsNumber()) {
    Napi::TypeError::New(env, "init.timestamp is required")
        .ThrowAsJavaScriptException();
    return;
  }
  timestamp_ = webcodecs::AttrAsInt64(init, "timestamp");

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
  if (!webcodecs::HasAttr(options, "planeIndex") ||
      !options.Get("planeIndex").IsNumber()) {
    Napi::TypeError::New(env, "options.planeIndex is required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  uint32_t plane_index = webcodecs::AttrAsUint32(options, "planeIndex");

  // Validate planeIndex.
  bool is_planar = IsPlanar();
  if (!is_planar && plane_index != 0) {
    Napi::RangeError::New(env, "planeIndex must be 0 for interleaved formats")
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
  if (webcodecs::HasAttr(options, "frameOffset") &&
      options.Get("frameOffset").IsNumber()) {
    frame_offset = webcodecs::AttrAsUint32(options, "frameOffset");
  }
  if (frame_offset >= number_of_frames_) {
    Napi::RangeError::New(env, "frameOffset out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Optional: frameCount (default remaining frames).
  uint32_t frame_count = number_of_frames_ - frame_offset;
  if (webcodecs::HasAttr(options, "frameCount") &&
      options.Get("frameCount").IsNumber()) {
    frame_count = webcodecs::AttrAsUint32(options, "frameCount");
    if (frame_offset + frame_count > number_of_frames_) {
      Napi::RangeError::New(env,
                            "frameOffset + frameCount exceeds numberOfFrames")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  }

  // Optional: format (default current format).
  std::string target_format = format_;
  if (webcodecs::HasAttr(options, "format") &&
      options.Get("format").IsString()) {
    target_format = webcodecs::AttrAsStr(options, "format");
    // Validate target format.
    if (ParseAudioFormat(target_format) == AV_SAMPLE_FMT_NONE) {
      Napi::TypeError::New(env, "Invalid audio sample format")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
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

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "copyTo requires destination and options")
        .ThrowAsJavaScriptException();
    return;
  }

  // Extract destination buffer.
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

  // Parse options object.
  if (!info[1].IsObject()) {
    Napi::TypeError::New(env, "options must be an object")
        .ThrowAsJavaScriptException();
    return;
  }
  Napi::Object options = info[1].As<Napi::Object>();

  // Required: planeIndex.
  if (!webcodecs::HasAttr(options, "planeIndex") ||
      !options.Get("planeIndex").IsNumber()) {
    Napi::TypeError::New(env, "options.planeIndex is required")
        .ThrowAsJavaScriptException();
    return;
  }
  uint32_t plane_index = webcodecs::AttrAsUint32(options, "planeIndex");

  // Validate planeIndex.
  bool is_planar = IsPlanar();
  if (!is_planar && plane_index != 0) {
    Napi::RangeError::New(env, "planeIndex must be 0 for interleaved formats")
        .ThrowAsJavaScriptException();
    return;
  }
  if (is_planar && plane_index >= number_of_channels_) {
    Napi::RangeError::New(env, "planeIndex out of range")
        .ThrowAsJavaScriptException();
    return;
  }

  // Optional: frameOffset (default 0).
  uint32_t frame_offset = 0;
  if (webcodecs::HasAttr(options, "frameOffset") &&
      options.Get("frameOffset").IsNumber()) {
    frame_offset = webcodecs::AttrAsUint32(options, "frameOffset");
  }
  if (frame_offset >= number_of_frames_) {
    Napi::RangeError::New(env, "frameOffset out of range")
        .ThrowAsJavaScriptException();
    return;
  }

  // Optional: frameCount (default remaining frames).
  uint32_t frame_count = number_of_frames_ - frame_offset;
  if (webcodecs::HasAttr(options, "frameCount") &&
      options.Get("frameCount").IsNumber()) {
    frame_count = webcodecs::AttrAsUint32(options, "frameCount");
    if (frame_offset + frame_count > number_of_frames_) {
      Napi::RangeError::New(env,
                            "frameOffset + frameCount exceeds numberOfFrames")
          .ThrowAsJavaScriptException();
      return;
    }
  }

  // Optional: format (default current format).
  std::string target_format = format_;
  if (webcodecs::HasAttr(options, "format") &&
      options.Get("format").IsString()) {
    target_format = webcodecs::AttrAsStr(options, "format");
    // Validate target format.
    if (ParseAudioFormat(target_format) == AV_SAMPLE_FMT_NONE) {
      Napi::TypeError::New(env, "Invalid audio sample format")
          .ThrowAsJavaScriptException();
      return;
    }
  }

  // Calculate required size.
  size_t bytes_per_sample = GetBytesPerSample();
  size_t target_bytes_per_sample = GetFormatBytesPerSample(target_format);
  bool target_planar = IsPlanarFormat(target_format);

  size_t required_size;
  if (target_planar) {
    required_size = frame_count * target_bytes_per_sample;
  } else {
    required_size = frame_count * number_of_channels_ * target_bytes_per_sample;
  }

  if (dest_size < required_size) {
    Napi::TypeError::New(env, "destination buffer too small")
        .ThrowAsJavaScriptException();
    return;
  }

  // Same format: direct copy.
  if (target_format == format_) {
    size_t src_offset;
    size_t copy_size;

    if (is_planar) {
      // Planar: each plane is numberOfFrames * bytesPerSample.
      size_t plane_size = number_of_frames_ * bytes_per_sample;
      src_offset = plane_index * plane_size + frame_offset * bytes_per_sample;
      copy_size = frame_count * bytes_per_sample;
    } else {
      // Interleaved: samples are channel-interleaved.
      src_offset = frame_offset * number_of_channels_ * bytes_per_sample;
      copy_size = frame_count * number_of_channels_ * bytes_per_sample;
    }

    std::memcpy(dest_data, data_.data() + src_offset, copy_size);
    return;
  }

  // Format conversion using libswresample.
  // Validate channel count for planar format arrays (max 8 channels supported).
  if (number_of_channels_ > 8) {
    Napi::RangeError::New(env, "Format conversion supports maximum 8 channels")
        .ThrowAsJavaScriptException();
    return;
  }

  AVSampleFormat src_fmt = ParseAudioFormat(format_);
  AVSampleFormat dst_fmt = ParseAudioFormat(target_format);

  if (src_fmt == AV_SAMPLE_FMT_NONE || dst_fmt == AV_SAMPLE_FMT_NONE) {
    Napi::Error::New(env, "Unsupported audio format")
        .ThrowAsJavaScriptException();
    return;
  }

  // Create resampler context (RAII managed).
  ffmpeg::SwrContextPtr swr(swr_alloc());
  if (!swr) {
    Napi::Error::New(env, "Failed to allocate SwrContext")
        .ThrowAsJavaScriptException();
    return;
  }

  // Configure channel layout (same number of channels, just reordering for
  // planar/interleaved).
  AVChannelLayout ch_layout;
  av_channel_layout_default(&ch_layout, number_of_channels_);

  // Set input parameters.
  av_opt_set_chlayout(swr.get(), "in_chlayout", &ch_layout, 0);
  av_opt_set_int(swr.get(), "in_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr.get(), "in_sample_fmt", src_fmt, 0);

  // Set output parameters.
  av_opt_set_chlayout(swr.get(), "out_chlayout", &ch_layout, 0);
  av_opt_set_int(swr.get(), "out_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr.get(), "out_sample_fmt", dst_fmt, 0);

  int ret = swr_init(swr.get());
  if (ret < 0) {
    av_channel_layout_uninit(&ch_layout);
    Napi::Error::New(env, "Failed to initialize SwrContext")
        .ThrowAsJavaScriptException();
    return;
  }

  // Prepare source data pointers.
  const uint8_t* src_data[8] = {nullptr};

  if (is_planar) {
    // Source is planar: set up pointers to each channel plane.
    size_t plane_size = number_of_frames_ * bytes_per_sample;
    for (uint32_t c = 0; c < number_of_channels_; c++) {
      src_data[c] =
          data_.data() + c * plane_size + frame_offset * bytes_per_sample;
    }
  } else {
    // Source is interleaved: single data pointer.
    src_data[0] =
        data_.data() + frame_offset * number_of_channels_ * bytes_per_sample;
  }

  // Prepare destination data pointers.
  uint8_t* dst_data[8] = {nullptr};

  if (target_planar) {
    // For planar output, we only copy the requested plane.
    // Need temporary buffer for all planes, then extract one.
    size_t total_out_size =
        frame_count * number_of_channels_ * target_bytes_per_sample;
    std::vector<uint8_t> temp_buffer(total_out_size);

    for (uint32_t c = 0; c < number_of_channels_; c++) {
      dst_data[c] =
          temp_buffer.data() + c * frame_count * target_bytes_per_sample;
    }

    ret = swr_convert(swr.get(), dst_data, frame_count, src_data, frame_count);
    if (ret < 0) {
      av_channel_layout_uninit(&ch_layout);
      Napi::Error::New(env, "swr_convert failed").ThrowAsJavaScriptException();
      return;
    }

    // Copy requested plane to destination.
    std::memcpy(dest_data, dst_data[plane_index],
                frame_count * target_bytes_per_sample);
  } else {
    // Interleaved output: write directly to destination.
    dst_data[0] = dest_data;

    ret = swr_convert(swr.get(), dst_data, frame_count, src_data, frame_count);
    if (ret < 0) {
      av_channel_layout_uninit(&ch_layout);
      Napi::Error::New(env, "swr_convert failed").ThrowAsJavaScriptException();
      return;
    }
  }

  // RAII handles swr cleanup
  av_channel_layout_uninit(&ch_layout);
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
