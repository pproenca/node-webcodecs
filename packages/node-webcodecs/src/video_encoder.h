// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoder implementation wrapping FFmpeg libx264.

#ifndef PACKAGES_NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>

#include "src/async_encode_worker.h"
#include "src/ffmpeg_raii.h"

class AsyncEncodeWorker;

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
  Napi::Value GetPendingChunks(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitChunks(Napi::Env env);
  void ReinitializeCodec();  // Recreates codec context after flush

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
  int width_;
  int height_;
  int display_width_;
  int display_height_;
  std::string codec_string_;
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_;
  int temporal_layer_count_;
  // Bitstream format for AVC/HEVC (per W3C codec registration).
  // "avc"/"hevc": Description (SPS/PPS) provided separately
  // "annexb": Description embedded in bitstream (default for backwards compat)
  std::string bitstream_format_;
  int64_t frame_count_;

  // Stored configuration for codec reinitialization after flush.
  // FFmpeg encoders enter EOF mode after flush (sending NULL frame),
  // requiring full reinitialization to accept new frames per W3C spec.
  int bitrate_;
  int framerate_;
  int max_b_frames_;
  bool use_qscale_;
  int encode_queue_size_;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;  // Saturation threshold

  // HARD LIMIT: The "Circuit Breaker".
  // If the user ignores backpressure signals and keeps pushing frames,
  // we reject requests to prevent OOM.
  // 64 frames @ 4K RGBA (3840x2160x4) is ~2GB of RAM.
  static constexpr size_t kMaxHardQueueSize = 64;

  // Saturation status accessor
  bool IsCodecSaturated() const { return codec_saturated_.load(); }

  // Async encoding support
  std::unique_ptr<AsyncEncodeWorker> async_worker_;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;
  bool async_mode_ = false;
};

#endif  // PACKAGES_NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_
