// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_decoder.h"

extern "C" {
#include <libavutil/opt.h>
}

#include <cstring>
#include <string>
#include <vector>

#include "src/audio_data.h"
#include "src/encoded_audio_chunk.h"

namespace {

constexpr int kBytesPerSampleF32 = 4;

}  // namespace

Napi::Object InitAudioDecoder(Napi::Env env, Napi::Object exports) {
  return AudioDecoder::Init(env, exports);
}

Napi::Object AudioDecoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "AudioDecoder",
      {
          InstanceMethod("configure", &AudioDecoder::Configure),
          InstanceMethod("decode", &AudioDecoder::Decode),
          InstanceMethod("flush", &AudioDecoder::Flush),
          InstanceMethod("reset", &AudioDecoder::Reset),
          InstanceMethod("close", &AudioDecoder::Close),
          InstanceAccessor("state", &AudioDecoder::GetState, nullptr),
          InstanceAccessor("decodeQueueSize", &AudioDecoder::GetDecodeQueueSize,
                           nullptr),
          StaticMethod("isConfigSupported", &AudioDecoder::IsConfigSupported),
      });

  exports.Set("AudioDecoder", func);
  return exports;
}

AudioDecoder::AudioDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioDecoder>(info),
      codec_(nullptr),
      codec_context_(nullptr),
      swr_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      sample_rate_(0),
      number_of_channels_(0) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Error::New(env, "AudioDecoder requires init object")
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

AudioDecoder::~AudioDecoder() { Cleanup(); }

void AudioDecoder::Cleanup() {
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

Napi::Value AudioDecoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "InvalidStateError: Decoder is closed")
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
  } else {
    Napi::Error::New(env, "NotSupportedError: Unknown codec: " + codec_str)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Find decoder.
  const AVCodec* decoder = avcodec_find_decoder(codec_id);
  if (!decoder) {
    Napi::Error::New(env, "NotSupportedError: Decoder not found for codec")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Clean up any previous context.
  Cleanup();

  // Store the found decoder.
  codec_ = decoder;
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
  av_channel_layout_default(&codec_context_->ch_layout, number_of_channels_);

  // Handle optional description (extradata / codec specific data).
  if (config.Has("description")) {
    Napi::Value desc_val = config.Get("description");
    if (desc_val.IsTypedArray()) {
      Napi::TypedArray ta = desc_val.As<Napi::TypedArray>();
      Napi::ArrayBuffer ab = ta.ArrayBuffer();
      size_t offset = ta.ByteOffset();
      size_t length = ta.ByteLength();

      codec_context_->extradata = static_cast<uint8_t*>(
          av_malloc(length + AV_INPUT_BUFFER_PADDING_SIZE));
      if (codec_context_->extradata) {
        std::memcpy(codec_context_->extradata,
                    static_cast<uint8_t*>(ab.Data()) + offset, length);
        std::memset(codec_context_->extradata + length, 0,
                    AV_INPUT_BUFFER_PADDING_SIZE);
        codec_context_->extradata_size = static_cast<int>(length);
      }
    } else if (desc_val.IsArrayBuffer()) {
      Napi::ArrayBuffer ab = desc_val.As<Napi::ArrayBuffer>();
      size_t length = ab.ByteLength();

      codec_context_->extradata = static_cast<uint8_t*>(
          av_malloc(length + AV_INPUT_BUFFER_PADDING_SIZE));
      if (codec_context_->extradata) {
        std::memcpy(codec_context_->extradata, ab.Data(), length);
        std::memset(codec_context_->extradata + length, 0,
                    AV_INPUT_BUFFER_PADDING_SIZE);
        codec_context_->extradata_size = static_cast<int>(length);
      }
    }
  }

  // Open codec.
  int ret = avcodec_open2(codec_context_, codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    Napi::Error::New(env, std::string("Could not open decoder: ") + errbuf)
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

  state_ = "configured";

  return env.Undefined();
}

Napi::Value AudioDecoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value AudioDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), 0);
}

void AudioDecoder::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

Napi::Value AudioDecoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "InvalidStateError: Cannot reset closed decoder")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Flush any pending frames (discard them).
  if (codec_context_) {
    avcodec_send_packet(codec_context_, nullptr);
    while (avcodec_receive_frame(codec_context_, frame_) == 0) {
      av_frame_unref(frame_);
    }
  }

  Cleanup();
  state_ = "unconfigured";
  sample_rate_ = 0;
  number_of_channels_ = 0;
  decode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

Napi::Value AudioDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "InvalidStateError: Decoder not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::Error::New(env, "decode requires EncodedAudioChunk")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Unwrap EncodedAudioChunk.
  EncodedAudioChunk* chunk =
      Napi::ObjectWrap<EncodedAudioChunk>::Unwrap(info[0].As<Napi::Object>());

  const std::vector<uint8_t>& data = chunk->GetData();

  // Setup packet.
  av_packet_unref(packet_);
  packet_->data = const_cast<uint8_t*>(data.data());
  packet_->size = static_cast<int>(data.size());

  // Send packet to decoder.
  int ret = avcodec_send_packet(codec_context_, packet_);
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    error_callback_.Call(
        {Napi::Error::New(env, std::string("Decode error: ") + errbuf)
             .Value()});
    return env.Undefined();
  }

  // Emit any available decoded audio data.
  EmitAudioData(env);

  return env.Undefined();
}

Napi::Value AudioDecoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    // Return resolved promise if not configured.
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  // Send NULL packet to flush decoder.
  int ret = avcodec_send_packet(codec_context_, nullptr);
  if (ret < 0 && ret != AVERROR_EOF) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    error_callback_.Call(
        {Napi::Error::New(env, std::string("Flush error: ") + errbuf).Value()});
  }

  // Emit remaining decoded audio data.
  EmitAudioData(env);

  // Reset queue after flush
  decode_queue_size_ = 0;
  codec_saturated_.store(false);

  // Return resolved promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

void AudioDecoder::EmitAudioData(Napi::Env env) {
  while (true) {
    int ret = avcodec_receive_frame(codec_context_, frame_);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env, std::string("Decode receive error: ") + errbuf)
               .Value()});
      break;
    }

    // Get frame parameters.
    int nb_samples = frame_->nb_samples;
    int nb_channels = frame_->ch_layout.nb_channels;

    // Initialize resampler if needed (convert to f32 interleaved).
    if (!swr_context_) {
      swr_context_ = swr_alloc();
      if (!swr_context_) {
        error_callback_.Call(
            {Napi::Error::New(env, "Could not allocate resampler").Value()});
        av_frame_unref(frame_);
        break;
      }

      // Configure resampler: decoder's format -> f32 interleaved.
      av_opt_set_chlayout(swr_context_, "in_chlayout", &frame_->ch_layout, 0);
      av_opt_set_int(swr_context_, "in_sample_rate", frame_->sample_rate, 0);
      av_opt_set_sample_fmt(swr_context_, "in_sample_fmt",
                            static_cast<AVSampleFormat>(frame_->format), 0);

      AVChannelLayout out_layout;
      av_channel_layout_default(&out_layout, nb_channels);
      av_opt_set_chlayout(swr_context_, "out_chlayout", &out_layout, 0);
      av_opt_set_int(swr_context_, "out_sample_rate", frame_->sample_rate, 0);
      av_opt_set_sample_fmt(swr_context_, "out_sample_fmt", AV_SAMPLE_FMT_FLT,
                            0);

      ret = swr_init(swr_context_);
      if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        error_callback_.Call(
            {Napi::Error::New(
                 env, std::string("Could not init resampler: ") + errbuf)
                 .Value()});
        swr_free(&swr_context_);
        swr_context_ = nullptr;
        av_frame_unref(frame_);
        break;
      }
    }

    // Allocate output buffer for f32 interleaved.
    size_t output_size = nb_samples * nb_channels * kBytesPerSampleF32;
    std::vector<uint8_t> output_data(output_size);

    uint8_t* output_ptr = output_data.data();

    // Convert audio.
    int converted =
        swr_convert(swr_context_, &output_ptr, nb_samples,
                    const_cast<const uint8_t**>(frame_->data), nb_samples);

    if (converted < 0) {
      char errbuf[256];
      av_strerror(converted, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env,
                            std::string("Audio conversion error: ") + errbuf)
               .Value()});
      av_frame_unref(frame_);
      continue;
    }

    // Calculate timestamp in microseconds.
    int64_t timestamp = 0;
    if (frame_->pts != AV_NOPTS_VALUE) {
      // Convert from time_base to microseconds.
      AVRational time_base = codec_context_->time_base;
      if (time_base.num == 0) {
        time_base = AVRational{1, frame_->sample_rate};
      }
      timestamp = av_rescale_q(frame_->pts, time_base, AVRational{1, 1000000});
    }

    // Create AudioData instance.
    Napi::Object audio_data = AudioData::CreateInstance(
        env, "f32", static_cast<uint32_t>(frame_->sample_rate),
        static_cast<uint32_t>(converted), static_cast<uint32_t>(nb_channels),
        timestamp, output_data.data(),
        converted * nb_channels * kBytesPerSampleF32);

    // Call output callback.
    output_callback_.Call({audio_data});

    av_frame_unref(frame_);
  }
}

Napi::Value AudioDecoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_OPUS);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("mp4a.40") == 0) {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AAC);
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
  if (config.Has("description")) {
    normalized_config.Set("description", config.Get("description"));
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
