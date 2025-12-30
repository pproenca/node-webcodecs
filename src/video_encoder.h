// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoder implementation wrapping FFmpeg libx264.

#ifndef SRC_VIDEO_ENCODER_H_
#define SRC_VIDEO_ENCODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <cstdint>
#include <string>

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
  explicit VideoEncoder(const Napi::CallbackInfo& info);
  ~VideoEncoder();

  // Disallow copy and assign.
  VideoEncoder(const VideoEncoder&) = delete;
  VideoEncoder& operator=(const VideoEncoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Encode(const Napi::CallbackInfo& info);
  Napi::Value Flush(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);
  Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);
  Napi::Value GetCodecSaturated(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitChunks(Napi::Env env);

  // FFmpeg state.
  const AVCodec* codec_;
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
  AVFrame* frame_;
  AVPacket* packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  int width_;
  int height_;
  int display_width_;
  int display_height_;
  std::string codec_string_;
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_;
  int64_t frame_count_;
  int encode_queue_size_;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;  // Saturation threshold

  // Saturation status accessor
  bool IsCodecSaturated() const { return codec_saturated_.load(); }
};

#endif  // SRC_VIDEO_ENCODER_H_
