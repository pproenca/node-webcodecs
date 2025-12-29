// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "audio_encoder.h"

#include "audio_data.h"
#include "encoded_audio_chunk.h"

Napi::Object InitAudioEncoder(Napi::Env env, Napi::Object exports)
{
  return AudioEncoder::Init(env, exports);
}

Napi::Object AudioEncoder::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func = DefineClass(env, "AudioEncoder", {
      InstanceMethod("configure", &AudioEncoder::Configure),
      InstanceMethod("encode", &AudioEncoder::Encode),
      InstanceMethod("flush", &AudioEncoder::Flush),
      InstanceMethod("reset", &AudioEncoder::Reset),
      InstanceMethod("close", &AudioEncoder::Close),
      InstanceAccessor("state", &AudioEncoder::GetState, nullptr),
      InstanceAccessor("encodeQueueSize", &AudioEncoder::GetEncodeQueueSize,
                       nullptr),
      StaticMethod("isConfigSupported", &AudioEncoder::IsConfigSupported),
  });

  exports.Set("AudioEncoder", func);
  return exports;
}

AudioEncoder::AudioEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioEncoder>(info),
      codec_(nullptr),
      codec_context_(nullptr),
      swr_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      sample_rate_(0),
      number_of_channels_(0),
      timestamp_(0),
      frame_count_(0)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Error::New(env, "AudioEncoder requires init object")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  if (!init.Has("output") || !init.Get("output").IsFunction()) {
    Napi::Error::New(env, "init.output must be a function")
        .ThrowAsJavaScriptException();
    return;
  }
  if (!init.Has("error") || !init.Get("error").IsFunction()) {
    Napi::Error::New(env, "init.error must be a function")
        .ThrowAsJavaScriptException();
    return;
  }

  output_callback_ = Napi::Persistent(init.Get("output").As<Napi::Function>());
  error_callback_ = Napi::Persistent(init.Get("error").As<Napi::Function>());
}

AudioEncoder::~AudioEncoder()
{
  Cleanup();
}

void AudioEncoder::Cleanup()
{
  if (frame_) {
    av_frame_free(&frame_);
    frame_ = nullptr;
  }
  if (packet_) {
    av_packet_free(&packet_);
    packet_ = nullptr;
  }
  if (swr_context_) {
    swr_free(&swr_context_);
    swr_context_ = nullptr;
  }
  if (codec_context_) {
    avcodec_free_context(&codec_context_);
    codec_context_ = nullptr;
  }
  codec_ = nullptr;
}

Napi::Value AudioEncoder::Configure(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "InvalidStateError: Encoder is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Error::New(env, "configure requires config object")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Parse codec string.
  std::string codec_str = "mp4a.40.2";  // Default to AAC-LC.
  if (config.Has("codec") && config.Get("codec").IsString()) {
    codec_str = config.Get("codec").As<Napi::String>().Utf8Value();
  }

  // Determine codec ID.
  AVCodecID codec_id = AV_CODEC_ID_AAC;
  if (codec_str == "opus") {
    codec_id = AV_CODEC_ID_OPUS;
  } else if (codec_str.find("mp4a.40") == 0) {
    codec_id = AV_CODEC_ID_AAC;
  }

  // Find encoder.
  const AVCodec* encoder = avcodec_find_encoder(codec_id);
  if (!encoder) {
    Napi::Error::New(env, "NotSupportedError: Encoder not found for codec")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Clean up any previous context.
  Cleanup();

  // Store the found encoder.
  codec_ = encoder;
  codec_context_ = avcodec_alloc_context3(codec_);
  if (!codec_context_) {
    Napi::Error::New(env, "Could not allocate codec context")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse sample rate.
  if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
    sample_rate_ = config.Get("sampleRate").As<Napi::Number>().Uint32Value();
  } else {
    sample_rate_ = 48000;
  }
  codec_context_->sample_rate = sample_rate_;

  // Parse number of channels.
  if (config.Has("numberOfChannels") &&
      config.Get("numberOfChannels").IsNumber()) {
    number_of_channels_ =
        config.Get("numberOfChannels").As<Napi::Number>().Uint32Value();
  } else {
    number_of_channels_ = 2;
  }

  // Set channel layout based on number of channels.
  if (number_of_channels_ == 1) {
    av_channel_layout_default(&codec_context_->ch_layout, 1);
  } else {
    av_channel_layout_default(&codec_context_->ch_layout, 2);
  }

  // Parse bitrate.
  if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
    codec_context_->bit_rate =
        config.Get("bitrate").As<Napi::Number>().Int64Value();
  } else {
    codec_context_->bit_rate = 128000;
  }

  // Set sample format - AAC/Opus typically use fltp (float planar).
  codec_context_->sample_fmt = AV_SAMPLE_FMT_FLTP;

  // Time base.
  codec_context_->time_base = AVRational{1, static_cast<int>(sample_rate_)};

  // Open codec.
  int ret = avcodec_open2(codec_context_, codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    Napi::Error::New(env, std::string("Could not open codec: ") + errbuf)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Allocate frame and packet.
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();

  if (!frame_ || !packet_) {
    Cleanup();
    Napi::Error::New(env, "Could not allocate frame/packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Set up frame parameters.
  frame_->nb_samples = codec_context_->frame_size;
  frame_->format = codec_context_->sample_fmt;
  av_channel_layout_copy(&frame_->ch_layout, &codec_context_->ch_layout);

  ret = av_frame_get_buffer(frame_, 0);
  if (ret < 0) {
    Cleanup();
    Napi::Error::New(env, "Could not allocate frame buffer")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create resampler context for format conversion.
  swr_context_ = swr_alloc();
  if (!swr_context_) {
    Cleanup();
    Napi::Error::New(env, "Could not allocate resampler context")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Configure resampler: f32 interleaved -> encoder's format.
  AVChannelLayout in_layout;
  av_channel_layout_default(&in_layout, number_of_channels_);

  av_opt_set_chlayout(swr_context_, "in_chlayout", &in_layout, 0);
  av_opt_set_int(swr_context_, "in_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr_context_, "in_sample_fmt", AV_SAMPLE_FMT_FLT, 0);

  av_opt_set_chlayout(swr_context_, "out_chlayout",
                      &codec_context_->ch_layout, 0);
  av_opt_set_int(swr_context_, "out_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr_context_, "out_sample_fmt",
                        codec_context_->sample_fmt, 0);

  ret = swr_init(swr_context_);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    Napi::Error::New(env, std::string("Could not init resampler: ") + errbuf)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  state_ = "configured";
  frame_count_ = 0;

  return env.Undefined();
}

Napi::Value AudioEncoder::GetState(const Napi::CallbackInfo& info)
{
  return Napi::String::New(info.Env(), state_);
}

Napi::Value AudioEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), 0);
}

void AudioEncoder::Close(const Napi::CallbackInfo& info)
{
  Cleanup();
  state_ = "closed";
}

Napi::Value AudioEncoder::Reset(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "InvalidStateError: Cannot reset closed encoder")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Cleanup();
  state_ = "unconfigured";
  frame_count_ = 0;

  return env.Undefined();
}

Napi::Value AudioEncoder::Encode(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "InvalidStateError: Encoder not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Error::New(env, "encode requires AudioData")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get AudioData from wrapper or native object.
  Napi::Object audio_data_obj = info[0].As<Napi::Object>();

  // Get properties from AudioData.
  uint32_t number_of_frames = 0;
  if (audio_data_obj.Has("numberOfFrames") &&
      audio_data_obj.Get("numberOfFrames").IsNumber()) {
    number_of_frames =
        audio_data_obj.Get("numberOfFrames").As<Napi::Number>().Uint32Value();
  }

  int64_t timestamp = 0;
  if (audio_data_obj.Has("timestamp") &&
      audio_data_obj.Get("timestamp").IsNumber()) {
    timestamp = audio_data_obj.Get("timestamp").As<Napi::Number>().Int64Value();
  }

  // Get sample data - try to unwrap as native AudioData first.
  AudioData* native_audio_data = nullptr;
  try {
    native_audio_data = Napi::ObjectWrap<AudioData>::Unwrap(audio_data_obj);
  } catch (...) {
    // Not a native AudioData, might be wrapped.
  }

  const uint8_t* sample_data = nullptr;
  size_t sample_data_size = 0;

  if (native_audio_data && !native_audio_data->IsClosed()) {
    const std::vector<uint8_t>& data = native_audio_data->GetData();
    sample_data = data.data();
    sample_data_size = data.size();
  } else {
    // Try to get data from a _native property (wrapped object).
    if (audio_data_obj.Has("_native") &&
        audio_data_obj.Get("_native").IsObject()) {
      Napi::Object native_obj =
          audio_data_obj.Get("_native").As<Napi::Object>();
      try {
        native_audio_data = Napi::ObjectWrap<AudioData>::Unwrap(native_obj);
        if (native_audio_data && !native_audio_data->IsClosed()) {
          const std::vector<uint8_t>& data = native_audio_data->GetData();
          sample_data = data.data();
          sample_data_size = data.size();
        }
      } catch (...) {
      }
    }
  }

  if (!sample_data || sample_data_size == 0) {
    Napi::Error::New(env, "Could not get audio data")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Make frame writable.
  int ret = av_frame_make_writable(frame_);
  if (ret < 0) {
    Napi::Error::New(env, "Could not make frame writable")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert samples using resampler.
  const uint8_t* in_data[] = {sample_data};
  ret = swr_convert(swr_context_, frame_->data, frame_->nb_samples,
                    in_data, number_of_frames);

  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Napi::Error::New(env, std::string("Resample error: ") + errbuf)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  frame_->pts = timestamp;

  // Send frame to encoder.
  ret = avcodec_send_frame(codec_context_, frame_);
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    error_callback_.Call(
        {Napi::Error::New(env, std::string("Encode error: ") + errbuf).Value()});
    return env.Undefined();
  }

  // Emit any ready chunks.
  EmitChunks(env);

  frame_count_++;

  return env.Undefined();
}

Napi::Value AudioEncoder::Flush(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (state_ == "configured") {
    // Send NULL frame to flush encoder.
    avcodec_send_frame(codec_context_, nullptr);

    // Get remaining packets.
    EmitChunks(env);
  }

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

void AudioEncoder::EmitChunks(Napi::Env env)
{
  while (true) {
    int ret = avcodec_receive_packet(codec_context_, packet_);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      error_callback_.Call({Napi::Error::New(
          env, std::string("Receive packet error: ") + errbuf).Value()});
      break;
    }

    // Calculate duration in microseconds.
    int64_t duration = 0;
    if (codec_context_->frame_size > 0) {
      duration = static_cast<int64_t>(codec_context_->frame_size) * 1000000 /
                 sample_rate_;
    }

    // Create EncodedAudioChunk.
    Napi::Object chunk = EncodedAudioChunk::CreateInstance(
        env,
        "key",  // Audio chunks are typically all key frames.
        packet_->pts,
        duration,
        packet_->data,
        packet_->size);

    // Call output callback.
    output_callback_.Call({chunk});

    av_packet_unref(packet_);
  }
}

Napi::Value AudioEncoder::IsConfigSupported(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Reject(
        Napi::Error::New(env, "config must be an object").Value());
    return deferred.Promise();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  Napi::Object result = Napi::Object::New(env);
  bool supported = true;

  Napi::Object normalized_config = Napi::Object::New(env);

  // Check codec.
  if (!config.Has("codec") || !config.Get("codec").IsString()) {
    supported = false;
  } else {
    std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
    normalized_config.Set("codec", codec);

    if (codec == "opus") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_OPUS);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("mp4a.40") == 0) {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AAC);
      if (!c) {
        supported = false;
      }
    } else {
      supported = false;
    }
  }

  // Copy other recognized properties.
  if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
    normalized_config.Set("sampleRate", config.Get("sampleRate"));
  }
  if (config.Has("numberOfChannels") &&
      config.Get("numberOfChannels").IsNumber()) {
    normalized_config.Set("numberOfChannels", config.Get("numberOfChannels"));
  }
  if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
    normalized_config.Set("bitrate", config.Get("bitrate"));
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
