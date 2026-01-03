// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef PACKAGES_NODE_WEBCODECS_SRC_DEMUXER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_DEMUXER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
}

#include <napi.h>

#include <memory>
#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"

struct TrackInfo {
  int index;
  std::string type;  // "video" or "audio"
  std::string codec;
  int width;
  int height;
  int sample_rate;
  int channels;
  std::vector<uint8_t> extradata;
};

class Demuxer : public Napi::ObjectWrap<Demuxer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;

  explicit Demuxer(const Napi::CallbackInfo& info);
  ~Demuxer();

  // Disallow copy and assign.
  Demuxer(const Demuxer&) = delete;
  Demuxer& operator=(const Demuxer&) = delete;

 private:
  Napi::Value Open(const Napi::CallbackInfo& info);
  Napi::Value DemuxPackets(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value GetVideoTrack(const Napi::CallbackInfo& info);
  Napi::Value GetAudioTrack(const Napi::CallbackInfo& info);

  void Cleanup();
  void EmitTrack(Napi::Env env, const TrackInfo& track);
  void EmitChunk(Napi::Env env, AVPacket* packet, int track_index);

  ffmpeg::AVFormatContextPtr format_context_;
  std::vector<TrackInfo> tracks_;
  int video_stream_index_;
  int audio_stream_index_;

  Napi::FunctionReference on_track_callback_;
  Napi::FunctionReference on_chunk_callback_;
  Napi::FunctionReference on_error_callback_;
};

Napi::Object InitDemuxer(Napi::Env env, Napi::Object exports);

#endif  // PACKAGES_NODE_WEBCODECS_SRC_DEMUXER_H_
