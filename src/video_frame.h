// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoFrame represents a single frame of video data.

#ifndef SRC_VIDEO_FRAME_H_
#define SRC_VIDEO_FRAME_H_

#include <napi.h>

extern "C" {
#include <libavutil/frame.h>
#include <libavutil/pixfmt.h>
#include <libswscale/swscale.h>
}

#include <cstdint>
#include <string>
#include <vector>

enum class PixelFormat {
  // 8-bit formats
  RGBA,
  RGBX,     // RGB with padding (no alpha)
  BGRA,
  BGRX,     // BGR with padding (no alpha)
  I420,     // YUV420p planar
  I420A,    // YUV420p with alpha plane
  I422,     // YUV422p planar
  I422A,    // YUV422p with alpha plane (W3C WebCodecs spec)
  I444,     // YUV444p planar
  I444A,    // YUV444p with alpha plane (W3C WebCodecs spec)
  NV12,     // YUV420 semi-planar (Y plane + interleaved UV)
  NV21,     // YUV420 semi-planar (Y plane + interleaved VU)
  NV12A,    // YUV420 semi-planar with alpha (W3C WebCodecs spec)
  // 10-bit formats
  I420P10,  // YUV420p 10-bit planar
  I422P10,  // YUV422p 10-bit planar
  I444P10,  // YUV444p 10-bit planar
  NV12P10,  // YUV420 10-bit semi-planar (P010)
  // 10-bit alpha formats
  I420AP10, // YUV420p 10-bit with alpha
  I422AP10, // YUV422p 10-bit with alpha
  I444AP10, // YUV444p 10-bit with alpha
  // 12-bit formats
  I420P12,  // YUV420p 12-bit planar
  I422P12,  // YUV422p 12-bit planar
  I444P12,  // YUV444p 12-bit planar
  // Note: 12-bit YUVA formats not supported by FFmpeg
  // Unknown/invalid
  UNKNOWN
};

// Metadata describing a pixel format's properties
struct PixelFormatInfo {
  const char* name;        // WebCodecs format string (e.g., "I420P10")
  AVPixelFormat av_format; // FFmpeg pixel format enum
  int bit_depth;           // Bits per sample (8, 10, or 12)
  int num_planes;          // Number of planes (1 for packed, 2-4 for planar)
  int chroma_h_shift;      // Horizontal chroma subsampling (1 = half width)
  int chroma_v_shift;      // Vertical chroma subsampling (1 = half height)
  bool has_alpha;          // Whether format includes alpha plane
  bool is_semi_planar;     // NV12-style interleaved UV plane
};

// Get format metadata by enum value. Returns info with UNKNOWN if not found.
const PixelFormatInfo& GetFormatInfo(PixelFormat format);

// Visible rectangle within coded frame (for cropping)
struct VisibleRect {
  int x = 0;
  int y = 0;
  int width = 0;   // 0 = use coded_width_
  int height = 0;  // 0 = use coded_height_
};

PixelFormat ParsePixelFormat(const std::string& format_str);
std::string PixelFormatToString(PixelFormat format);
AVPixelFormat PixelFormatToAV(PixelFormat format);
size_t CalculateAllocationSize(PixelFormat format, uint32_t width,
                                uint32_t height);

class VideoFrame : public Napi::ObjectWrap<VideoFrame> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env, const uint8_t* data,
                                     size_t data_size, int width, int height,
                                     int64_t timestamp,
                                     const std::string& format);
  static Napi::Object CreateInstance(Napi::Env env, const uint8_t* data,
                                     size_t data_size, int width, int height,
                                     int64_t timestamp,
                                     const std::string& format, int rotation,
                                     bool flip);
  static Napi::Object CreateInstance(Napi::Env env, const uint8_t* data,
                                     size_t data_size, int width, int height,
                                     int64_t timestamp,
                                     const std::string& format, int rotation,
                                     bool flip, int display_width,
                                     int display_height);
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
  PixelFormat GetFormat() const { return format_; }

  // Static constructor reference for clone().
  static Napi::FunctionReference constructor;

 private:
  // Property getters.
  Napi::Value GetCodedWidth(const Napi::CallbackInfo& info);
  Napi::Value GetCodedHeight(const Napi::CallbackInfo& info);
  Napi::Value GetDisplayWidth(const Napi::CallbackInfo& info);
  Napi::Value GetDisplayHeight(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
  Napi::Value GetDuration(const Napi::CallbackInfo& info);
  Napi::Value GetFormat(const Napi::CallbackInfo& info);
  Napi::Value GetRotation(const Napi::CallbackInfo& info);
  Napi::Value GetFlip(const Napi::CallbackInfo& info);
  Napi::Value GetVisibleRect(const Napi::CallbackInfo& info);

  // Methods.
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetDataBuffer(const Napi::CallbackInfo& info);
  Napi::Value Clone(const Napi::CallbackInfo& info);
  Napi::Value AllocationSize(const Napi::CallbackInfo& info);
  Napi::Value CopyTo(const Napi::CallbackInfo& info);

  std::vector<uint8_t> data_;
  int coded_width_;
  int coded_height_;
  int display_width_;
  int display_height_;
  int64_t timestamp_;
  int64_t duration_;
  bool has_duration_;
  PixelFormat format_;
  bool closed_;
  int rotation_;
  bool flip_;
  VisibleRect visible_rect_;
};

#endif  // SRC_VIDEO_FRAME_H_
