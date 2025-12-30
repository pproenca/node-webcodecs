// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// ImageDecoder implementation wrapping FFmpeg image decoders.

#ifndef SRC_IMAGE_DECODER_H_
#define SRC_IMAGE_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <memory>
#include <string>
#include <vector>

class ImageDecoder : public Napi::ObjectWrap<ImageDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsTypeSupported(const Napi::CallbackInfo& info);
  explicit ImageDecoder(const Napi::CallbackInfo& info);
  ~ImageDecoder();

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
  static AVCodecID MimeTypeToCodecId(const std::string& mime_type);

  // Image data.
  std::vector<uint8_t> data_;
  std::string type_;

  // FFmpeg state.
  const AVCodec* codec_;
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
  AVFrame* frame_;
  AVPacket* packet_;

  // Decoded frame data.
  std::vector<uint8_t> decoded_data_;
  int decoded_width_;
  int decoded_height_;
  bool complete_;
  bool closed_;
};

#endif  // SRC_IMAGE_DECODER_H_
