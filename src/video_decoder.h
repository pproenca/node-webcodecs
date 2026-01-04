// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecoder implementation wrapping FFmpeg decoders.

#ifndef SRC_VIDEO_DECODER_H_
#define SRC_VIDEO_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <memory>
#include <string>
#include <unordered_map>

#include "src/ffmpeg_raii.h"
#include "src/shared/control_message_queue.h"
#include "src/shared/safe_tsfn.h"
#include "src/video_decoder_worker.h"

// Forward declaration for backward compatibility
struct DecoderMetadataConfig;

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
  explicit VideoDecoder(const Napi::CallbackInfo& info);
  ~VideoDecoder() override;

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
  void SetupWorkerCallbacks(Napi::Env env);

  // TSFN callback data types
  struct FrameCallbackData {
    ffmpeg::AVFramePtr frame;
    webcodecs::VideoDecoderMetadataConfig metadata;
    std::atomic<int>* pending_frames_ptr;  // For decrementing in callback
  };

  struct FlushCallbackData {
    uint32_t promise_id;
    bool success;
    std::string error_message;
    VideoDecoder* decoder;  // For resolving promise in callback
  };

  struct ErrorCallbackData {
    int error_code;
    std::string message;
  };

  // TSFN callback handlers
  static void OnFrameCallback(Napi::Env env, Napi::Function fn,
                              std::nullptr_t*, FrameCallbackData* data);
  static void OnFlushCallback(Napi::Env env, Napi::Function fn,
                              std::nullptr_t*, FlushCallbackData* data);
  static void OnErrorCallback(Napi::Env env, Napi::Function fn,
                              std::nullptr_t*, ErrorCallbackData* data);
  static void OnDequeueCallback(Napi::Env env, Napi::Function fn,
                                std::nullptr_t*, uint32_t* data);

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

  // Worker-owned codec model
  std::unique_ptr<webcodecs::VideoControlQueue> control_queue_;
  std::unique_ptr<webcodecs::VideoDecoderWorker> worker_;

  // ThreadSafeFunctions for async callbacks
  using FrameTSFN =
      webcodecs::SafeThreadSafeFunction<std::nullptr_t, FrameCallbackData,
                                        OnFrameCallback>;
  using FlushTSFN =
      webcodecs::SafeThreadSafeFunction<std::nullptr_t, FlushCallbackData,
                                        OnFlushCallback>;
  using ErrorTSFN =
      webcodecs::SafeThreadSafeFunction<std::nullptr_t, ErrorCallbackData,
                                        OnErrorCallback>;
  using DequeueTSFN = webcodecs::SafeThreadSafeFunction<std::nullptr_t,
                                                        uint32_t, OnDequeueCallback>;

  FrameTSFN frame_tsfn_;
  FlushTSFN flush_tsfn_;
  ErrorTSFN error_tsfn_;
  DequeueTSFN dequeue_tsfn_;

  // Promise management for flush
  uint32_t next_promise_id_ = 0;
  std::unordered_map<uint32_t, Napi::Promise::Deferred> pending_flushes_;

  // Track pending frames for pendingFrames attribute
  std::atomic<int> pending_frames_{0};

  // Key chunk required flag (reset after flush/reset)
  bool key_chunk_required_ = true;
};

#endif  // SRC_VIDEO_DECODER_H_
