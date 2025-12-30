// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef SRC_AUDIO_DECODER_H_
#define SRC_AUDIO_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswresample/swresample.h>
}

#include <napi.h>

#include <cstdint>
#include <string>

class AudioDecoder : public Napi::ObjectWrap<AudioDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit AudioDecoder(const Napi::CallbackInfo& info);
  ~AudioDecoder() override;

  // Prevent copy and assignment.
  AudioDecoder(const AudioDecoder&) = delete;
  AudioDecoder& operator=(const AudioDecoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Decode(const Napi::CallbackInfo& info);
  Napi::Value Flush(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);
  Napi::Value GetDecodeQueueSize(const Napi::CallbackInfo& info);

  // Static methods.
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitAudioData(Napi::Env env);

  // FFmpeg state.
  const AVCodec* codec_;
  AVCodecContext* codec_context_;
  SwrContext* swr_context_;
  AVFrame* frame_;
  AVPacket* packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  uint32_t sample_rate_;
  uint32_t number_of_channels_;

  // Queue tracking for W3C WebCodecs spec compliance
  int decode_queue_size_ = 0;
};

#endif  // SRC_AUDIO_DECODER_H_
