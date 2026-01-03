// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecoder implementation wrapping FFmpeg decoders.

#ifndef PACKAGES_NODE_WEBCODECS_SRC_VIDEO_DECODER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_VIDEO_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <memory>
#include <string>

#include "src/async_decode_worker.h"
#include "src/ffmpeg_raii.h"

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
  explicit VideoDecoder(const Napi::CallbackInfo& info);
  ~VideoDecoder();

  // Disallow copy and assign.
  VideoDecoder(const VideoDecoder&) = delete;
  VideoDecoder& operator=(const VideoDecoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Decode(const Napi::CallbackInfo& info);
  Napi::Value Flush(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);
  Napi::Value GetDecodeQueueSize(const Napi::CallbackInfo& info);
  Napi::Value GetCodecSaturated(const Napi::CallbackInfo& info);
  Napi::Value GetPendingFrames(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitFrames(Napi::Env env);

  // FFmpeg state.
  const AVCodec*
      codec_;  // Not owned - references FFmpeg's static codec descriptor
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  int coded_width_;
  int coded_height_;
  int decode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
  static constexpr size_t kMaxHardQueueSize = 64;

  // Rotation and flip config (per W3C spec).
  int rotation_ = 0;   // 0, 90, 180, 270
  bool flip_ = false;  // horizontal flip

  // Display aspect ratio (per W3C spec).
  int display_aspect_width_ = 0;
  int display_aspect_height_ = 0;

  // Color space config (per W3C spec).
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_ = false;
  bool has_color_space_ = false;

  // Low-latency optimization (per W3C spec).
  bool optimize_for_latency_ = false;

  // Hardware acceleration config (per W3C spec).
  // Note: This is a stub - FFmpeg uses software decoding.
  std::string hardware_acceleration_ = "no-preference";

  // Track last frame format/dimensions for sws_context recreation.
  AVPixelFormat last_frame_format_ = AV_PIX_FMT_NONE;
  int last_frame_width_ = 0;
  int last_frame_height_ = 0;

  // Async decoding via worker thread (non-blocking).
  bool async_mode_ = false;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;
  std::unique_ptr<AsyncDecodeWorker> async_worker_;
  std::atomic<int> pending_frames_{0};  // Track frames in flight for flush
};

#endif  // PACKAGES_NODE_WEBCODECS_SRC_VIDEO_DECODER_H_
