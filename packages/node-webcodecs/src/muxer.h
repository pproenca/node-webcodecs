// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef PACKAGES_NODE_WEBCODECS_SRC_MUXER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_MUXER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
}

#include <napi.h>

#include <memory>
#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"

class Muxer : public Napi::ObjectWrap<Muxer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;

  explicit Muxer(const Napi::CallbackInfo& info);
  ~Muxer();

  // Disallow copy and assign.
  Muxer(const Muxer&) = delete;
  Muxer& operator=(const Muxer&) = delete;

 private:
  Napi::Value AddVideoTrack(const Napi::CallbackInfo& info);
  Napi::Value AddAudioTrack(const Napi::CallbackInfo& info);
  Napi::Value WriteVideoChunk(const Napi::CallbackInfo& info);
  Napi::Value WriteAudioChunk(const Napi::CallbackInfo& info);
  Napi::Value FinalizeOutput(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);

  void Cleanup();
  AVCodecID CodecIdFromString(const std::string& codec);

  ffmpeg::AVFormatContextOutputPtr format_context_;
  std::string filename_;
  bool header_written_;
  bool finalized_;
  int video_stream_index_;
  int audio_stream_index_;
};

Napi::Object InitMuxer(Napi::Env env, Napi::Object exports);

#endif  // PACKAGES_NODE_WEBCODECS_SRC_MUXER_H_
