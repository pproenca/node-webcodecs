// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// ImageDecoder implementation wrapping FFmpeg image decoders.
// Supports both static images and animated formats (GIF, WebP).

#ifndef SRC_IMAGE_DECODER_H_
#define SRC_IMAGE_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <cmath>
#include <memory>
#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"

// Represents a single decoded frame from an animated image
struct DecodedFrame {
  std::vector<uint8_t> data;
  int width;
  int height;
  int64_t timestamp;  // in microseconds
  int64_t duration;   // in microseconds
};

class ImageDecoder : public Napi::ObjectWrap<ImageDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsTypeSupported(const Napi::CallbackInfo& info);
  explicit ImageDecoder(const Napi::CallbackInfo& info);
  ~ImageDecoder();

  // Static constructor reference for NAPI class registration
  static Napi::FunctionReference constructor_;

  // Disallow copy and assign.
  ImageDecoder(const ImageDecoder&) = delete;
  ImageDecoder& operator=(const ImageDecoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Decode(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetType(const Napi::CallbackInfo& info);
  Napi::Value GetComplete(const Napi::CallbackInfo& info);
  Napi::Value GetTracks(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  bool DecodeImage();
  bool DecodeFrame(int frame_index);
  bool ParseAnimatedImageMetadata();
  bool ConvertFrameToRGBA(AVFrame* frame, std::vector<uint8_t>* output);
  static AVCodecID MimeTypeToCodecId(const std::string& mime_type);
  static bool IsAnimatedFormat(const std::string& mime_type);

  // Image data.
  std::vector<uint8_t> data_;
  std::string type_;

  // FFmpeg state for static image decoding.
  const AVCodec* codec_;
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // FFmpeg state for animated image parsing.
  ffmpeg::ImageFormatContextPtr format_context_;  // For container parsing
  ffmpeg::AVIOContextPtr avio_context_;           // Custom I/O for memory buffer
  ffmpeg::MemoryBufferContextPtr mem_ctx_;        // Owned, RAII managed
  int video_stream_index_;                        // Stream index for video track

  // Decoded frame data (static images).
  std::vector<uint8_t> decoded_data_;
  int decoded_width_;
  int decoded_height_;

  // Animated image metadata and frame cache.
  std::vector<DecodedFrame> decoded_frames_;
  bool animated_;
  int frame_count_;
  double repetition_count_;  // Infinity for infinite loop

  bool complete_;
  bool closed_;

  // Premultiply alpha option: "none", "premultiply", or "default"
  std::string premultiply_alpha_;
};

#endif  // SRC_IMAGE_DECODER_H_
