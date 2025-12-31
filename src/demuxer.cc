// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/demuxer.h"

#include <cstring>
#include <string>

#include "src/common.h"

Napi::FunctionReference Demuxer::constructor;

Napi::Object InitDemuxer(Napi::Env env, Napi::Object exports) {
  return Demuxer::Init(env, exports);
}

Napi::Object Demuxer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env, "Demuxer",
                  {
                      InstanceMethod("open", &Demuxer::Open),
                      InstanceMethod("demux", &Demuxer::DemuxPackets),
                      InstanceMethod("close", &Demuxer::Close),
                      InstanceMethod("getVideoTrack", &Demuxer::GetVideoTrack),
                      InstanceMethod("getAudioTrack", &Demuxer::GetAudioTrack),
                  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Demuxer", func);
  return exports;
}

Demuxer::Demuxer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<Demuxer>(info),
      video_stream_index_(-1),
      audio_stream_index_(-1) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw webcodecs::InvalidParameterError(env, "init", "object", info[0]);
  }

  Napi::Object options = info[0].As<Napi::Object>();

  if (webcodecs::HasAttr(options, "onTrack")) {
    on_track_callback_ =
        Napi::Persistent(options.Get("onTrack").As<Napi::Function>());
  }
  if (webcodecs::HasAttr(options, "onChunk")) {
    on_chunk_callback_ =
        Napi::Persistent(options.Get("onChunk").As<Napi::Function>());
  }
  if (webcodecs::HasAttr(options, "onError")) {
    on_error_callback_ =
        Napi::Persistent(options.Get("onError").As<Napi::Function>());
  }
}

Demuxer::~Demuxer() { Cleanup(); }

void Demuxer::Cleanup() {
  format_context_.reset();
  tracks_.clear();
  video_stream_index_ = -1;
  audio_stream_index_ = -1;

  // Clear callback references
  on_track_callback_.Reset();
  on_chunk_callback_.Reset();
  on_error_callback_.Reset();
}

Napi::Value Demuxer::Open(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw webcodecs::InvalidParameterError(env, "path", "string", info[0]);
  }

  std::string path = info[0].As<Napi::String>().Utf8Value();

  // Open input file.
  AVFormatContext* raw_ctx = nullptr;
  int ret = avformat_open_input(&raw_ctx, path.c_str(), nullptr, nullptr);
  if (ret < 0) {
    throw webcodecs::FFmpegError(env, "open file", ret);
  }
  format_context_.reset(raw_ctx);

  // Find stream info.
  ret = avformat_find_stream_info(format_context_.get(), nullptr);
  if (ret < 0) {
    Cleanup();
    throw webcodecs::FFmpegError(env, "find stream info", ret);
  }

  // Enumerate tracks.
  for (unsigned int i = 0; i < format_context_->nb_streams; i++) {
    AVStream* stream = format_context_.get()->streams[i];
    AVCodecParameters* codecpar = stream->codecpar;

    TrackInfo track;
    track.index = i;
    track.width = 0;
    track.height = 0;
    track.sample_rate = 0;
    track.channels = 0;

    if (codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
      track.type = "video";
      track.width = codecpar->width;
      track.height = codecpar->height;
      video_stream_index_ = i;

      const AVCodecDescriptor* desc =
          avcodec_descriptor_get(codecpar->codec_id);
      track.codec = desc ? desc->name : "unknown";

      if (codecpar->extradata && codecpar->extradata_size > 0) {
        track.extradata.assign(codecpar->extradata,
                               codecpar->extradata + codecpar->extradata_size);
      }
    } else if (codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
      track.type = "audio";
      track.sample_rate = codecpar->sample_rate;
      track.channels = codecpar->ch_layout.nb_channels;
      audio_stream_index_ = i;

      const AVCodecDescriptor* desc =
          avcodec_descriptor_get(codecpar->codec_id);
      track.codec = desc ? desc->name : "unknown";

      if (codecpar->extradata && codecpar->extradata_size > 0) {
        track.extradata.assign(codecpar->extradata,
                               codecpar->extradata + codecpar->extradata_size);
      }
    } else {
      continue;  // Skip other track types.
    }

    tracks_.push_back(track);
    EmitTrack(env, track);
  }

  return env.Undefined();
}

void Demuxer::EmitTrack(Napi::Env env, const TrackInfo& track) {
  if (on_track_callback_.IsEmpty()) return;

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("index", Napi::Number::New(env, track.index));
  obj.Set("type", Napi::String::New(env, track.type));
  obj.Set("codec", Napi::String::New(env, track.codec));

  if (track.type == "video") {
    obj.Set("width", Napi::Number::New(env, track.width));
    obj.Set("height", Napi::Number::New(env, track.height));
  } else if (track.type == "audio") {
    obj.Set("sampleRate", Napi::Number::New(env, track.sample_rate));
    obj.Set("channels", Napi::Number::New(env, track.channels));
  }

  if (!track.extradata.empty()) {
    Napi::Buffer<uint8_t> extradata = Napi::Buffer<uint8_t>::Copy(
        env, track.extradata.data(), track.extradata.size());
    obj.Set("extradata", extradata);
  }

  on_track_callback_.Call({obj});
}

Napi::Value Demuxer::DemuxPackets(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!format_context_) {
    Napi::Error::New(env, "Demuxer not opened").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    Napi::Error::New(env, "Failed to allocate packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  while (av_read_frame(format_context_.get(), packet.get()) >= 0) {
    if (packet->stream_index == video_stream_index_ ||
        packet->stream_index == audio_stream_index_) {
      EmitChunk(env, packet.get(), packet->stream_index);
    }
    av_packet_unref(packet.get());
  }

  return env.Undefined();
}

void Demuxer::EmitChunk(Napi::Env env, AVPacket* packet, int track_index) {
  if (on_chunk_callback_.IsEmpty()) return;

  // Create EncodedVideoChunk-compatible object.
  Napi::Object chunk = Napi::Object::New(env);

  bool is_key = (packet->flags & AV_PKT_FLAG_KEY) != 0;
  chunk.Set("type", Napi::String::New(env, is_key ? "key" : "delta"));

  AVStream* stream = format_context_.get()->streams[track_index];
  int64_t timestamp_us =
      av_rescale_q(packet->pts, stream->time_base, {1, 1000000});
  chunk.Set("timestamp",
            Napi::Number::New(env, static_cast<double>(timestamp_us)));

  int64_t duration_us =
      av_rescale_q(packet->duration, stream->time_base, {1, 1000000});
  chunk.Set("duration",
            Napi::Number::New(env, static_cast<double>(duration_us)));

  Napi::Buffer<uint8_t> data =
      Napi::Buffer<uint8_t>::Copy(env, packet->data, packet->size);
  chunk.Set("data", data);

  on_chunk_callback_.Call({chunk, Napi::Number::New(env, track_index)});
}

Napi::Value Demuxer::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  return info.Env().Undefined();
}

Napi::Value Demuxer::GetVideoTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  for (const auto& track : tracks_) {
    if (track.type == "video") {
      Napi::Object obj = Napi::Object::New(env);
      obj.Set("index", Napi::Number::New(env, track.index));
      obj.Set("type", Napi::String::New(env, track.type));
      obj.Set("codec", Napi::String::New(env, track.codec));
      obj.Set("width", Napi::Number::New(env, track.width));
      obj.Set("height", Napi::Number::New(env, track.height));
      return obj;
    }
  }

  return env.Null();
}

Napi::Value Demuxer::GetAudioTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  for (const auto& track : tracks_) {
    if (track.type == "audio") {
      Napi::Object obj = Napi::Object::New(env);
      obj.Set("index", Napi::Number::New(env, track.index));
      obj.Set("type", Napi::String::New(env, track.type));
      obj.Set("codec", Napi::String::New(env, track.codec));
      obj.Set("sampleRate", Napi::Number::New(env, track.sample_rate));
      obj.Set("channels", Napi::Number::New(env, track.channels));
      return obj;
    }
  }

  return env.Null();
}
