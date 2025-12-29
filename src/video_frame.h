// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoFrame represents a single frame of video data.

#ifndef SRC_VIDEO_FRAME_H_
#define SRC_VIDEO_FRAME_H_

#include <napi.h>

#include <cstdint>
#include <string>
#include <vector>

enum class PixelFormat {
  RGBA,
  I420,    // YUV420p planar
  NV12,    // YUV420 semi-planar
  UNKNOWN
};

PixelFormat ParsePixelFormat(const std::string& format_str);
std::string PixelFormatToString(PixelFormat format);
size_t CalculateAllocationSize(PixelFormat format, uint32_t width,
                                uint32_t height);

class VideoFrame : public Napi::ObjectWrap<VideoFrame> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env, const uint8_t* data,
                                     size_t data_size, int width, int height,
                                     int64_t timestamp,
                                     const std::string& format);
  explicit VideoFrame(const Napi::CallbackInfo& info);
  ~VideoFrame();

  // Disallow copy and assign.
  VideoFrame(const VideoFrame&) = delete;
  VideoFrame& operator=(const VideoFrame&) = delete;

  // Internal accessors for VideoEncoder.
  uint8_t* GetData() { return data_.data(); }
  size_t GetDataSize() const { return data_.size(); }
  int GetWidth() const { return coded_width_; }
  int GetHeight() const { return coded_height_; }
  int64_t GetTimestampValue() const { return timestamp_; }

  // Static constructor reference for clone().
  static Napi::FunctionReference constructor;

 private:
  // Property getters.
  Napi::Value GetCodedWidth(const Napi::CallbackInfo& info);
  Napi::Value GetCodedHeight(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
  Napi::Value GetFormat(const Napi::CallbackInfo& info);

  // Methods.
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetDataBuffer(const Napi::CallbackInfo& info);
  Napi::Value Clone(const Napi::CallbackInfo& info);
  Napi::Value AllocationSize(const Napi::CallbackInfo& info);
  Napi::Value CopyTo(const Napi::CallbackInfo& info);

  std::vector<uint8_t> data_;
  int coded_width_;
  int coded_height_;
  int64_t timestamp_;
  PixelFormat format_;
  bool closed_;
};

#endif  // SRC_VIDEO_FRAME_H_
