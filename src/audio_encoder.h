// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef SRC_AUDIO_ENCODER_H_
#define SRC_AUDIO_ENCODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libswresample/swresample.h>
}

#include <napi.h>

#include <atomic>
#include <cstdint>
#include <string>

#include "src/ffmpeg_raii.h"

class AudioEncoder : public Napi::ObjectWrap<AudioEncoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit AudioEncoder(const Napi::CallbackInfo& info);
  ~AudioEncoder() override;

  // Prevent copy and assignment.
  AudioEncoder(const AudioEncoder&) = delete;
  AudioEncoder& operator=(const AudioEncoder&) = delete;

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

  // Static methods.
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitChunks(Napi::Env env);

  // FFmpeg state.
  const AVCodec* codec_;  // Not owned - references FFmpeg's static codec descriptor
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwrContextPtr swr_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  uint32_t sample_rate_;
  uint32_t number_of_channels_;
  int64_t timestamp_;
  int frame_count_;

  // Queue tracking for W3C WebCodecs spec compliance
  int encode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
};

#endif  // SRC_AUDIO_ENCODER_H_
