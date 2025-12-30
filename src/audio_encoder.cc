// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_encoder.h"

#include <string>
#include <vector>

#include "src/audio_data.h"
#include "src/encoded_audio_chunk.h"

Napi::Object InitAudioEncoder(Napi::Env env, Napi::Object exports) {
  return AudioEncoder::Init(env, exports);
}

Napi::Object AudioEncoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "AudioEncoder",
      {
          InstanceMethod("configure", &AudioEncoder::Configure),
          InstanceMethod("encode", &AudioEncoder::Encode),
          InstanceMethod("flush", &AudioEncoder::Flush),
          InstanceMethod("reset", &AudioEncoder::Reset),
          InstanceMethod("close", &AudioEncoder::Close),
          InstanceAccessor("state", &AudioEncoder::GetState, nullptr),
          InstanceAccessor("encodeQueueSize", &AudioEncoder::GetEncodeQueueSize,
                           nullptr),
          InstanceAccessor("codecSaturated", &AudioEncoder::GetCodecSaturated,
                           nullptr),
          StaticMethod("isConfigSupported", &AudioEncoder::IsConfigSupported),
      });

  exports.Set("AudioEncoder", func);
  return exports;
}

AudioEncoder::AudioEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioEncoder>(info),
      codec_(nullptr),
      state_("unconfigured"),
      sample_rate_(0),
      number_of_channels_(0),
      timestamp_(0),
      frame_count_(0) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "AudioEncoder requires init object");
  }

  Napi::Object init = info[0].As<Napi::Object>();

  if (!init.Has("output") || !init.Get("output").IsFunction()) {
    throw Napi::Error::New(env, "init.output must be a function");
  }
  if (!init.Has("error") || !init.Get("error").IsFunction()) {
    throw Napi::Error::New(env, "init.error must be a function");
  }

  output_callback_ = Napi::Persistent(init.Get("output").As<Napi::Function>());
  error_callback_ = Napi::Persistent(init.Get("error").As<Napi::Function>());
}

AudioEncoder::~AudioEncoder() { Cleanup(); }

void AudioEncoder::Cleanup() {
  frame_.reset();
  packet_.reset();
  swr_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

Napi::Value AudioEncoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    throw Napi::Error::New(env, "InvalidStateError: Encoder is closed");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "configure requires config object");
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
    throw Napi::Error::New(env, "NotSupportedError: Encoder not found for codec");
  }

  // Clean up any previous context.
  Cleanup();

  // Store the found encoder.
  codec_ = encoder;
  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    throw Napi::Error::New(env, "Could not allocate codec context");
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

  // Set sample format based on codec.
  // Opus uses non-planar float (flt), AAC uses planar float (fltp).
  if (codec_id == AV_CODEC_ID_OPUS) {
    codec_context_->sample_fmt = AV_SAMPLE_FMT_FLT;
  } else {
    codec_context_->sample_fmt = AV_SAMPLE_FMT_FLTP;
  }

  // Time base.
  codec_context_->time_base = AVRational{1, static_cast<int>(sample_rate_)};

  // Parse Opus-specific options per W3C WebCodecs spec.
  if (codec_id == AV_CODEC_ID_OPUS && config.Has("opus") &&
      config.Get("opus").IsObject()) {
    Napi::Object opus_config = config.Get("opus").As<Napi::Object>();

    // Parse 'application': 'audio' | 'lowdelay' | 'voip'
    // Maps to libopus "application" option.
    if (opus_config.Has("application") &&
        opus_config.Get("application").IsString()) {
      std::string app =
          opus_config.Get("application").As<Napi::String>().Utf8Value();
      if (app == "voip") {
        av_opt_set(codec_context_->priv_data, "application", "voip", 0);
      } else if (app == "lowdelay") {
        av_opt_set(codec_context_->priv_data, "application", "lowdelay", 0);
      } else {
        // Default to "audio" for music/general audio.
        av_opt_set(codec_context_->priv_data, "application", "audio", 0);
      }
    }

    // Parse 'complexity': 0-10.
    // Maps to libopus "compression_level" option.
    if (opus_config.Has("complexity") &&
        opus_config.Get("complexity").IsNumber()) {
      int complexity =
          opus_config.Get("complexity").As<Napi::Number>().Int32Value();
      // Clamp to valid range 0-10.
      if (complexity < 0) complexity = 0;
      if (complexity > 10) complexity = 10;
      av_opt_set_int(codec_context_->priv_data, "compression_level", complexity,
                     0);
    }

    // Parse 'frameDuration': microseconds.
    // Maps to libopus "frame_duration" option (in milliseconds).
    if (opus_config.Has("frameDuration") &&
        opus_config.Get("frameDuration").IsNumber()) {
      int64_t frame_duration_us =
          opus_config.Get("frameDuration").As<Napi::Number>().Int64Value();
      // Convert microseconds to milliseconds.
      double frame_duration_ms = frame_duration_us / 1000.0;
      av_opt_set_double(codec_context_->priv_data, "frame_duration",
                        frame_duration_ms, 0);
    }

    // Parse 'signal': 'auto' | 'music' | 'voice'.
    // Maps to libopus "mapping_family" indirectly; not directly supported
    // by FFmpeg's libopus wrapper. We skip this as it's not available.

    // Parse 'usedtx': boolean.
    // Maps to libopus "dtx" option (discontinuous transmission).
    if (opus_config.Has("usedtx") && opus_config.Get("usedtx").IsBoolean()) {
      bool use_dtx = opus_config.Get("usedtx").As<Napi::Boolean>().Value();
      av_opt_set_int(codec_context_->priv_data, "dtx", use_dtx ? 1 : 0, 0);
    }

    // Parse 'useinbandfec': boolean.
    // Maps to libopus "fec" option (forward error correction).
    if (opus_config.Has("useinbandfec") &&
        opus_config.Get("useinbandfec").IsBoolean()) {
      bool use_fec =
          opus_config.Get("useinbandfec").As<Napi::Boolean>().Value();
      av_opt_set_int(codec_context_->priv_data, "fec", use_fec ? 1 : 0, 0);
    }

    // Parse 'packetlossperc': 0-100.
    // Maps to libopus "packet_loss" option.
    if (opus_config.Has("packetlossperc") &&
        opus_config.Get("packetlossperc").IsNumber()) {
      int packet_loss =
          opus_config.Get("packetlossperc").As<Napi::Number>().Int32Value();
      // Clamp to valid range 0-100.
      if (packet_loss < 0) packet_loss = 0;
      if (packet_loss > 100) packet_loss = 100;
      av_opt_set_int(codec_context_->priv_data, "packet_loss", packet_loss, 0);
    }
  }

  // Open codec.
  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
  }

  // Allocate frame and packet.
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();

  if (!frame_ || !packet_) {
    Cleanup();
    throw Napi::Error::New(env, "Could not allocate frame/packet");
  }

  // Set up frame parameters.
  frame_->nb_samples = codec_context_->frame_size;
  frame_->format = codec_context_->sample_fmt;
  av_channel_layout_copy(&frame_->ch_layout, &codec_context_->ch_layout);

  ret = av_frame_get_buffer(frame_.get(), 0);
  if (ret < 0) {
    Cleanup();
    throw Napi::Error::New(env, "Could not allocate frame buffer");
  }

  // Create resampler context for format conversion.
  swr_context_.reset(swr_alloc());
  if (!swr_context_) {
    Cleanup();
    throw Napi::Error::New(env, "Could not allocate resampler context");
  }

  // Configure resampler: f32 interleaved -> encoder's format.
  AVChannelLayout in_layout;
  av_channel_layout_default(&in_layout, number_of_channels_);

  av_opt_set_chlayout(swr_context_.get(), "in_chlayout", &in_layout, 0);
  av_opt_set_int(swr_context_.get(), "in_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr_context_.get(), "in_sample_fmt", AV_SAMPLE_FMT_FLT,
                        0);

  av_opt_set_chlayout(swr_context_.get(), "out_chlayout",
                      &codec_context_->ch_layout, 0);
  av_opt_set_int(swr_context_.get(), "out_sample_rate", sample_rate_, 0);
  av_opt_set_sample_fmt(swr_context_.get(), "out_sample_fmt",
                        codec_context_->sample_fmt, 0);

  ret = swr_init(swr_context_.get());
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    throw Napi::Error::New(env, std::string("Could not init resampler: ") + errbuf);
  }

  state_ = "configured";
  frame_count_ = 0;

  return env.Undefined();
}

Napi::Value AudioEncoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value AudioEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), encode_queue_size_);
}

Napi::Value AudioEncoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), codec_saturated_.load());
}

void AudioEncoder::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

Napi::Value AudioEncoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    throw Napi::Error::New(env, "InvalidStateError: Cannot reset closed encoder");
  }

  Cleanup();
  state_ = "unconfigured";
  frame_count_ = 0;
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

Napi::Value AudioEncoder::Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "InvalidStateError: Encoder not configured");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "encode requires AudioData");
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
    throw Napi::Error::New(env, "Could not get audio data");
  }

  // Calculate bytes per sample for interleaved f32 input.
  size_t bytes_per_sample = sizeof(float) * number_of_channels_;
  int frame_size = codec_context_->frame_size;

  // Process input samples in frame-sized chunks.
  uint32_t samples_remaining = number_of_frames;
  const uint8_t* input_ptr = sample_data;
  int64_t current_pts = timestamp;

  while (samples_remaining > 0) {
    // Make frame writable.
    int ret = av_frame_make_writable(frame_.get());
    if (ret < 0) {
      throw Napi::Error::New(env, "Could not make frame writable");
    }

    // Determine how many samples to convert in this iteration.
    int samples_to_convert = samples_remaining;
    if (samples_to_convert > frame_size) {
      samples_to_convert = frame_size;
    }

    // Convert samples using resampler.
    const uint8_t* in_data[] = {input_ptr};
    ret = swr_convert(swr_context_.get(), frame_->data, frame_size, in_data,
                      samples_to_convert);

    if (ret < 0) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      throw Napi::Error::New(env, std::string("Resample error: ") + errbuf);
    }

    // Update frame pts based on samples processed.
    frame_->pts = current_pts;

    // Send frame to encoder.
    ret = avcodec_send_frame(codec_context_.get(), frame_.get());
    if (ret < 0 && ret != AVERROR(EAGAIN)) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env, std::string("Encode error: ") + errbuf)
               .Value()});
      return env.Undefined();
    }

    // Emit any ready chunks.
    EmitChunks(env);

    // Move to next chunk.
    input_ptr += samples_to_convert * bytes_per_sample;
    samples_remaining -= samples_to_convert;
    current_pts += static_cast<int64_t>(samples_to_convert) * 1000000 /
                   sample_rate_;  // pts in microseconds
  }

  // Increment queue size after successful frame submission
  encode_queue_size_++;
  bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);

  frame_count_++;

  return env.Undefined();
}

Napi::Value AudioEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "configured") {
    // First, flush the resampler to get any buffered samples
    if (swr_context_) {
      int frame_size = codec_context_->frame_size;

      // Get buffered samples from resampler
      int ret = av_frame_make_writable(frame_.get());
      if (ret >= 0) {
        // Flush resampler by passing NULL input
        int out_samples = swr_convert(swr_context_.get(), frame_->data,
                                      frame_size, nullptr, 0);

        // If we got samples, send them to encoder
        if (out_samples > 0) {
          frame_->nb_samples = out_samples;
          frame_->pts = timestamp_;

          ret = avcodec_send_frame(codec_context_.get(), frame_.get());
          if (ret >= 0 || ret == AVERROR(EAGAIN)) {
            EmitChunks(env);
          }
        }
      }
    }

    // Send NULL frame to flush encoder
    avcodec_send_frame(codec_context_.get(), nullptr);

    // Get remaining packets
    EmitChunks(env);
  }

  // Reset queue after flush
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

void AudioEncoder::EmitChunks(Napi::Env env) {
  while (true) {
    int ret = avcodec_receive_packet(codec_context_.get(), packet_.get());
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env, std::string("Receive packet error: ") + errbuf)
               .Value()});
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
        packet_->pts, duration, packet_->data, packet_->size);

    // Call output callback.
    output_callback_.Call({chunk});

    // Decrement queue size after chunk is emitted
    if (encode_queue_size_ > 0) {
      encode_queue_size_--;
      bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
      codec_saturated_.store(saturated);
    }

    av_packet_unref(packet_.get());
  }
}

Napi::Value AudioEncoder::IsConfigSupported(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Reject(Napi::Error::New(env, "config must be an object").Value());
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

  // Copy bitrateMode if present per W3C spec.
  if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
    std::string bitrateMode =
        config.Get("bitrateMode").As<Napi::String>().Utf8Value();
    // Validate bitrateMode per W3C spec: "constant" or "variable"
    if (bitrateMode == "constant" || bitrateMode == "variable") {
      normalized_config.Set("bitrateMode", bitrateMode);
    }
  }

  // Copy opus-specific config if present (for Opus codec).
  if (config.Has("opus") && config.Get("opus").IsObject()) {
    Napi::Object opus_config = config.Get("opus").As<Napi::Object>();
    Napi::Object normalized_opus = Napi::Object::New(env);

    if (opus_config.Has("application") &&
        opus_config.Get("application").IsString()) {
      normalized_opus.Set("application", opus_config.Get("application"));
    }
    if (opus_config.Has("complexity") &&
        opus_config.Get("complexity").IsNumber()) {
      normalized_opus.Set("complexity", opus_config.Get("complexity"));
    }
    if (opus_config.Has("format") && opus_config.Get("format").IsString()) {
      normalized_opus.Set("format", opus_config.Get("format"));
    }
    if (opus_config.Has("frameDuration") &&
        opus_config.Get("frameDuration").IsNumber()) {
      normalized_opus.Set("frameDuration", opus_config.Get("frameDuration"));
    }
    if (opus_config.Has("packetlossperc") &&
        opus_config.Get("packetlossperc").IsNumber()) {
      normalized_opus.Set("packetlossperc", opus_config.Get("packetlossperc"));
    }
    if (opus_config.Has("signal") && opus_config.Get("signal").IsString()) {
      normalized_opus.Set("signal", opus_config.Get("signal"));
    }
    if (opus_config.Has("usedtx") && opus_config.Get("usedtx").IsBoolean()) {
      normalized_opus.Set("usedtx", opus_config.Get("usedtx"));
    }
    if (opus_config.Has("useinbandfec") &&
        opus_config.Get("useinbandfec").IsBoolean()) {
      normalized_opus.Set("useinbandfec", opus_config.Get("useinbandfec"));
    }

    normalized_config.Set("opus", normalized_opus);
  }

  // Copy aac-specific config if present (per W3C AAC codec registration).
  if (config.Has("aac") && config.Get("aac").IsObject()) {
    Napi::Object aac_config = config.Get("aac").As<Napi::Object>();
    Napi::Object normalized_aac = Napi::Object::New(env);

    if (aac_config.Has("format") && aac_config.Get("format").IsString()) {
      std::string format =
          aac_config.Get("format").As<Napi::String>().Utf8Value();
      // Validate per W3C spec: "aac" or "adts"
      if (format == "aac" || format == "adts") {
        normalized_aac.Set("format", format);
      }
    }

    normalized_config.Set("aac", normalized_aac);
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
