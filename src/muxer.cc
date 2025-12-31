// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/muxer.h"

#include <cstring>
#include <string>

#include "src/common.h"

Napi::FunctionReference Muxer::constructor;

Napi::Object InitMuxer(Napi::Env env, Napi::Object exports) {
  return Muxer::Init(env, exports);
}

Napi::Object Muxer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "Muxer",
      {
          InstanceMethod("addVideoTrack", &Muxer::AddVideoTrack),
          InstanceMethod("addAudioTrack", &Muxer::AddAudioTrack),
          InstanceMethod("writeVideoChunk", &Muxer::WriteVideoChunk),
          InstanceMethod("writeAudioChunk", &Muxer::WriteAudioChunk),
          InstanceMethod("finalize", &Muxer::Finalize),
          InstanceMethod("close", &Muxer::Close),
      });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Muxer", func);
  return exports;
}

Muxer::Muxer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<Muxer>(info),
      header_written_(false),
      finalized_(false),
      video_stream_index_(-1),
      audio_stream_index_(-1) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Options object required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object options = info[0].As<Napi::Object>();

  if (!options.Has("filename")) {
    Napi::TypeError::New(env, "filename is required")
        .ThrowAsJavaScriptException();
    return;
  }

  filename_ = options.Get("filename").As<Napi::String>().Utf8Value();

  // Allocate output format context for MP4.
  AVFormatContext* raw_ctx = nullptr;
  int ret = avformat_alloc_output_context2(&raw_ctx, nullptr, "mp4",
                                            filename_.c_str());
  if (ret < 0 || !raw_ctx) {
    Napi::Error::New(env, "Failed to allocate output format context")
        .ThrowAsJavaScriptException();
    return;
  }
  format_context_.reset(raw_ctx);

  // Open output file.
  ret = avio_open(&format_context_->pb, filename_.c_str(), AVIO_FLAG_WRITE);
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to open output file: ") + err)
        .ThrowAsJavaScriptException();
    return;
  }
}

Muxer::~Muxer() { Cleanup(); }

void Muxer::Cleanup() {
  if (format_context_ && !finalized_ && header_written_) {
    // Try to write trailer if header was written but not finalized.
    av_write_trailer(format_context_.get());
  }
  format_context_.reset();
}

AVCodecID Muxer::CodecIdFromString(const std::string& codec) {
  // Parse codec string to FFmpeg codec ID.
  if (codec.find("avc1") == 0 || codec.find("h264") == 0) {
    return AV_CODEC_ID_H264;
  } else if (codec.find("hvc1") == 0 || codec.find("hev1") == 0 ||
             codec.find("hevc") == 0) {
    return AV_CODEC_ID_HEVC;
  } else if (codec.find("vp09") == 0 || codec.find("vp9") == 0) {
    return AV_CODEC_ID_VP9;
  } else if (codec.find("av01") == 0 || codec.find("av1") == 0) {
    return AV_CODEC_ID_AV1;
  } else if (codec.find("mp4a") == 0 || codec.find("aac") == 0) {
    return AV_CODEC_ID_AAC;
  } else if (codec.find("opus") == 0) {
    return AV_CODEC_ID_OPUS;
  }
  return AV_CODEC_ID_NONE;
}

Napi::Value Muxer::AddVideoTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (header_written_) {
    Napi::Error::New(env, "Cannot add track after writing has started")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  int width = webcodecs::AttrAsInt32(config, "width");
  int height = webcodecs::AttrAsInt32(config, "height");
  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", 2000000);
  int framerate = webcodecs::AttrAsInt32(config, "framerate", 30);

  AVCodecID codec_id = CodecIdFromString(codec);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::Error::New(env, "Unsupported video codec: " + codec)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  AVStream* stream = avformat_new_stream(format_context_.get(), nullptr);
  if (!stream) {
    Napi::Error::New(env, "Failed to create video stream")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  stream->codecpar->codec_type = AVMEDIA_TYPE_VIDEO;
  stream->codecpar->codec_id = codec_id;
  stream->codecpar->width = width;
  stream->codecpar->height = height;
  stream->codecpar->bit_rate = bitrate;
  stream->time_base = {1, 1000000};  // Microseconds (WebCodecs timestamps)

  // Copy extradata (description) if provided.
  if (config.Has("description")) {
    auto [data, size] = webcodecs::AttrAsBuffer(config, "description");
    if (data && size > 0) {
      stream->codecpar->extradata =
          static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));
      if (stream->codecpar->extradata) {
        memcpy(stream->codecpar->extradata, data, size);
        stream->codecpar->extradata_size = static_cast<int>(size);
      }
    }
  }

  video_stream_index_ = stream->index;
  return Napi::Number::New(env, stream->index);
}

Napi::Value Muxer::AddAudioTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (header_written_) {
    Napi::Error::New(env, "Cannot add track after writing has started")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  int sample_rate = webcodecs::AttrAsInt32(config, "sampleRate", 48000);
  int channels = webcodecs::AttrAsInt32(config, "numberOfChannels", 2);
  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", 128000);

  AVCodecID codec_id = CodecIdFromString(codec);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::Error::New(env, "Unsupported audio codec: " + codec)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  AVStream* stream = avformat_new_stream(format_context_.get(), nullptr);
  if (!stream) {
    Napi::Error::New(env, "Failed to create audio stream")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  stream->codecpar->codec_type = AVMEDIA_TYPE_AUDIO;
  stream->codecpar->codec_id = codec_id;
  stream->codecpar->sample_rate = sample_rate;
  av_channel_layout_default(&stream->codecpar->ch_layout, channels);
  stream->codecpar->bit_rate = bitrate;
  stream->time_base = {1, 1000000};

  // Copy extradata if provided.
  if (config.Has("description")) {
    auto [data, size] = webcodecs::AttrAsBuffer(config, "description");
    if (data && size > 0) {
      stream->codecpar->extradata =
          static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));
      if (stream->codecpar->extradata) {
        memcpy(stream->codecpar->extradata, data, size);
        stream->codecpar->extradata_size = static_cast<int>(size);
      }
    }
  }

  audio_stream_index_ = stream->index;
  return Napi::Number::New(env, stream->index);
}

Napi::Value Muxer::WriteVideoChunk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (video_stream_index_ < 0) {
    Napi::Error::New(env, "No video track added")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Chunk object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Write header on first chunk.
  if (!header_written_) {
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  Napi::Object chunk = info[0].As<Napi::Object>();

  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    Napi::Error::New(env, "Failed to allocate packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get chunk data.
  auto [data, size] = webcodecs::AttrAsBuffer(chunk, "data");
  if (!data || size == 0) {
    // Try to call copyTo method if data is not a direct buffer.
    if (chunk.Has("byteLength") && chunk.Has("copyTo")) {
      int byte_length = chunk.Get("byteLength").As<Napi::Number>().Int32Value();
      Napi::Buffer<uint8_t> buf = Napi::Buffer<uint8_t>::New(env, byte_length);
      chunk.Get("copyTo").As<Napi::Function>().Call(chunk, {buf});
      data = buf.Data();
      size = byte_length;

      // Copy to packet.
      int ret = av_new_packet(packet.get(), static_cast<int>(size));
      if (ret < 0) {
        Napi::Error::New(env, "Failed to allocate packet data")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
      memcpy(packet->data, data, size);
    } else {
      Napi::Error::New(env, "Chunk must have data buffer or copyTo method")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  } else {
    int ret = av_new_packet(packet.get(), static_cast<int>(size));
    if (ret < 0) {
      Napi::Error::New(env, "Failed to allocate packet data")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    memcpy(packet->data, data, size);
  }

  // Set packet metadata.
  int64_t timestamp = webcodecs::AttrAsInt64(chunk, "timestamp");
  int64_t duration = webcodecs::AttrAsInt64(chunk, "duration", 0);
  std::string type = webcodecs::AttrAsStr(chunk, "type", "delta");

  packet->stream_index = video_stream_index_;
  packet->pts = timestamp;
  packet->dts = timestamp;
  packet->duration = duration;

  if (type == "key") {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  // Rescale timestamps from microseconds to stream time base.
  AVStream* stream = format_context_->streams[video_stream_index_];
  av_packet_rescale_ts(packet.get(), {1, 1000000}, stream->time_base);

  int ret = av_interleaved_write_frame(format_context_.get(), packet.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write packet: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

Napi::Value Muxer::WriteAudioChunk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (audio_stream_index_ < 0) {
    Napi::Error::New(env, "No audio track added")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Write header on first chunk if not already written.
  if (!header_written_) {
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Chunk object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object chunk = info[0].As<Napi::Object>();

  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    Napi::Error::New(env, "Failed to allocate packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto [data, size] = webcodecs::AttrAsBuffer(chunk, "data");
  if (!data || size == 0) {
    if (chunk.Has("byteLength") && chunk.Has("copyTo")) {
      int byte_length = chunk.Get("byteLength").As<Napi::Number>().Int32Value();
      Napi::Buffer<uint8_t> buf = Napi::Buffer<uint8_t>::New(env, byte_length);
      chunk.Get("copyTo").As<Napi::Function>().Call(chunk, {buf});
      data = buf.Data();
      size = byte_length;

      int ret = av_new_packet(packet.get(), static_cast<int>(size));
      if (ret < 0) {
        Napi::Error::New(env, "Failed to allocate packet data")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
      memcpy(packet->data, data, size);
    } else {
      Napi::Error::New(env, "Chunk must have data buffer or copyTo method")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  } else {
    int ret = av_new_packet(packet.get(), static_cast<int>(size));
    if (ret < 0) {
      Napi::Error::New(env, "Failed to allocate packet data")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    memcpy(packet->data, data, size);
  }

  int64_t timestamp = webcodecs::AttrAsInt64(chunk, "timestamp");
  int64_t duration = webcodecs::AttrAsInt64(chunk, "duration", 0);
  std::string type = webcodecs::AttrAsStr(chunk, "type", "delta");

  packet->stream_index = audio_stream_index_;
  packet->pts = timestamp;
  packet->dts = timestamp;
  packet->duration = duration;

  if (type == "key") {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  AVStream* stream = format_context_->streams[audio_stream_index_];
  av_packet_rescale_ts(packet.get(), {1, 1000000}, stream->time_base);

  int ret = av_interleaved_write_frame(format_context_.get(), packet.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write packet: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

Napi::Value Muxer::Finalize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (finalized_) {
    return env.Undefined();
  }

  if (!header_written_) {
    // Write header if no chunks were written.
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  int ret = av_write_trailer(format_context_.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write trailer: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  finalized_ = true;
  return env.Undefined();
}

Napi::Value Muxer::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  return info.Env().Undefined();
}
