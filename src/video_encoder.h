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
#include <memory>
#include <string>
#include <unordered_map>

#include "src/ffmpeg_raii.h"
#include "src/shared/control_message_queue.h"
#include "src/shared/safe_tsfn.h"
#include "src/video_encoder_worker.h"

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

  // TSFN callback helpers
  static void OnOutputTSFN(Napi::Env env, Napi::Function fn, VideoEncoder* ctx,
                           webcodecs::EncodedPacketData* data);
  static void OnErrorTSFN(Napi::Env env, Napi::Function fn, VideoEncoder* ctx,
                          webcodecs::ErrorOutputData* data);
  static void OnFlushTSFN(Napi::Env env, Napi::Function fn, VideoEncoder* ctx,
                          webcodecs::FlushCompleteData* data);

  // Callbacks from JS
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State
  std::string state_;
  int width_ = 0;
  int height_ = 0;
  int display_width_ = 0;
  int display_height_ = 0;
  std::string codec_string_;
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_ = false;
  int temporal_layer_count_ = 1;
  std::string bitstream_format_;
  int64_t frame_count_ = 0;

  // Saturation tracking
  int encode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
  static constexpr size_t kMaxHardQueueSize = 64;

  // Lifecycle safety flag - prevents use-after-free in callbacks
  // Set to false at the start of Cleanup() before any member access
  std::atomic<bool> alive_{true};

  // Worker-based encoding (new architecture)
  std::unique_ptr<webcodecs::VideoControlQueue> control_queue_;
  std::unique_ptr<webcodecs::VideoEncoderWorker> worker_;

  // ThreadSafeFunctions for async callbacks
  using OutputTSFN = webcodecs::SafeThreadSafeFunction<
      VideoEncoder, webcodecs::EncodedPacketData, OnOutputTSFN>;
  using ErrorTSFN = webcodecs::SafeThreadSafeFunction<
      VideoEncoder, webcodecs::ErrorOutputData, OnErrorTSFN>;
  using FlushTSFN = webcodecs::SafeThreadSafeFunction<
      VideoEncoder, webcodecs::FlushCompleteData, OnFlushTSFN>;

  OutputTSFN output_tsfn_;
  ErrorTSFN error_tsfn_;
  FlushTSFN flush_tsfn_;

  // Promise tracking for flush
  uint32_t next_promise_id_ = 0;
  std::unordered_map<uint32_t, Napi::Promise::Deferred> pending_flush_promises_;
  std::mutex flush_promise_mutex_;

  // Encoder configuration for worker
  webcodecs::VideoEncoderConfig encoder_config_;
};

#endif  // SRC_VIDEO_ENCODER_H_
