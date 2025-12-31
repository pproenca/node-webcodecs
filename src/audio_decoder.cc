// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/audio_decoder.h"

#include <cstring>
#include <string>
#include <vector>

extern "C" {
#include <libavutil/opt.h>
}

#include "src/audio_data.h"
#include "src/common.h"
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
  frame_.reset();
  packet_.reset();
  swr_context_.reset();
  codec_context_.reset();
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
  std::string codec_str =
      webcodecs::AttrAsStr(config, "codec", "mp4a.40.2");  // Default to AAC-LC.

  // Determine codec ID.
  AVCodecID codec_id = AV_CODEC_ID_AAC;
  if (codec_str == "opus") {
    codec_id = AV_CODEC_ID_OPUS;
  } else if (codec_str.find("mp4a.40") == 0) {
    codec_id = AV_CODEC_ID_AAC;
  } else if (codec_str == "mp3") {
    codec_id = AV_CODEC_ID_MP3;
  } else if (codec_str == "flac") {
    codec_id = AV_CODEC_ID_FLAC;
  } else if (codec_str == "vorbis") {
    codec_id = AV_CODEC_ID_VORBIS;
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
  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    Napi::Error::New(env, "Could not allocate codec context")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse sample rate.
  sample_rate_ = webcodecs::AttrAsUint32(config, "sampleRate");
  if (sample_rate_ == 0) {
    sample_rate_ = 48000;
  }
  codec_context_->sample_rate = sample_rate_;

  // Parse number of channels.
  number_of_channels_ = webcodecs::AttrAsUint32(config, "numberOfChannels");
  if (number_of_channels_ == 0) {
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
  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    Napi::Error::New(env, std::string("Could not open decoder: ") + errbuf)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Allocate frame and packet.
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();

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
  return Napi::Number::New(info.Env(), decode_queue_size_);
}

void AudioDecoder::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

Napi::Value AudioDecoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // W3C spec: reset() is a no-op when closed (don't throw)
  if (state_ == "closed") {
    return env.Undefined();
  }

  // Flush any pending frames (discard them).
  if (codec_context_) {
    avcodec_send_packet(codec_context_.get(), nullptr);
    while (avcodec_receive_frame(codec_context_.get(), frame_.get()) == 0) {
      av_frame_unref(frame_.get());
    }
  }

  Cleanup();
  state_ = "unconfigured";
  sample_rate_ = 0;
  number_of_channels_ = 0;
  decode_queue_size_ = 0;

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
  av_packet_unref(packet_.get());
  packet_->data = const_cast<uint8_t*>(data.data());
  packet_->size = static_cast<int>(data.size());

  // Send packet to decoder.
  int ret = avcodec_send_packet(codec_context_.get(), packet_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    error_callback_.Call(
        {Napi::Error::New(env, std::string("Decode error: ") + errbuf)
             .Value()});
    return env.Undefined();
  }

  // Increment queue size after successful packet submission
  decode_queue_size_++;

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
  int ret = avcodec_send_packet(codec_context_.get(), nullptr);
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

  // Return resolved promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

void AudioDecoder::EmitAudioData(Napi::Env env) {
  while (true) {
    int ret = avcodec_receive_frame(codec_context_.get(), frame_.get());
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
      swr_context_.reset(swr_alloc());
      if (!swr_context_) {
        error_callback_.Call(
            {Napi::Error::New(env, "Could not allocate resampler").Value()});
        av_frame_unref(frame_.get());
        break;
      }

      // Configure resampler: decoder's format -> f32 interleaved.
      av_opt_set_chlayout(swr_context_.get(), "in_chlayout", &frame_->ch_layout,
                          0);
      av_opt_set_int(swr_context_.get(), "in_sample_rate", frame_->sample_rate,
                     0);
      av_opt_set_sample_fmt(swr_context_.get(), "in_sample_fmt",
                            static_cast<AVSampleFormat>(frame_->format), 0);

      AVChannelLayout out_layout;
      av_channel_layout_default(&out_layout, nb_channels);
      av_opt_set_chlayout(swr_context_.get(), "out_chlayout", &out_layout, 0);
      av_opt_set_int(swr_context_.get(), "out_sample_rate", frame_->sample_rate,
                     0);
      av_opt_set_sample_fmt(swr_context_.get(), "out_sample_fmt",
                            AV_SAMPLE_FMT_FLT, 0);

      ret = swr_init(swr_context_.get());
      if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        error_callback_.Call(
            {Napi::Error::New(
                 env, std::string("Could not init resampler: ") + errbuf)
                 .Value()});
        swr_context_.reset();
        av_frame_unref(frame_.get());
        break;
      }
    }

    // Allocate output buffer for f32 interleaved.
    size_t output_size = nb_samples * nb_channels * kBytesPerSampleF32;
    std::vector<uint8_t> output_data(output_size);

    uint8_t* output_ptr = output_data.data();

    // Convert audio.
    int converted =
        swr_convert(swr_context_.get(), &output_ptr, nb_samples,
                    const_cast<const uint8_t**>(frame_->data), nb_samples);

    if (converted < 0) {
      char errbuf[256];
      av_strerror(converted, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env,
                            std::string("Audio conversion error: ") + errbuf)
               .Value()});
      av_frame_unref(frame_.get());
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

    // Decrement queue size after audio data is emitted
    if (decode_queue_size_ > 0) {
      decode_queue_size_--;
    }

    av_frame_unref(frame_.get());
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
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
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
    } else if (codec == "mp3") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_MP3);
      if (!c) {
        supported = false;
      }
    } else if (codec == "flac") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_FLAC);
      if (!c) {
        supported = false;
      }
    } else if (codec == "vorbis") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VORBIS);
      if (!c) {
        supported = false;
      }
    } else {
      supported = false;
    }
  }

  // Copy other recognized properties.
  if (webcodecs::HasAttr(config, "sampleRate")) {
    normalized_config.Set("sampleRate", config.Get("sampleRate"));
  }
  if (webcodecs::HasAttr(config, "numberOfChannels")) {
    normalized_config.Set("numberOfChannels", config.Get("numberOfChannels"));
  }
  if (webcodecs::HasAttr(config, "description")) {
    normalized_config.Set("description", config.Get("description"));
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
