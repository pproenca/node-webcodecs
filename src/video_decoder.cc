// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_decoder.h"

#include <cmath>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "src/async_decode_worker.h"
#include "src/encoded_video_chunk.h"
#include "src/video_frame.h"

namespace {

constexpr int kMaxDimension = 16384;
constexpr int kBytesPerPixelRgba = 4;

}  // namespace

Napi::Object InitVideoDecoder(Napi::Env env, Napi::Object exports) {
  return VideoDecoder::Init(env, exports);
}

Napi::Object VideoDecoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "VideoDecoder",
      {
          InstanceMethod("configure", &VideoDecoder::Configure),
          InstanceMethod("decode", &VideoDecoder::Decode),
          InstanceMethod("flush", &VideoDecoder::Flush),
          InstanceMethod("reset", &VideoDecoder::Reset),
          InstanceMethod("close", &VideoDecoder::Close),
          InstanceAccessor("state", &VideoDecoder::GetState, nullptr),
          InstanceAccessor("decodeQueueSize", &VideoDecoder::GetDecodeQueueSize,
                           nullptr),
          InstanceAccessor("codecSaturated", &VideoDecoder::GetCodecSaturated,
                           nullptr),
          StaticMethod("isConfigSupported", &VideoDecoder::IsConfigSupported),
      });

  exports.Set("VideoDecoder", func);
  return exports;
}

VideoDecoder::VideoDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoDecoder>(info),
      codec_(nullptr),
      state_("unconfigured"),
      coded_width_(0),
      coded_height_(0) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(
        env,
        "VideoDecoder requires init object with output and error "
        "callbacks");
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

VideoDecoder::~VideoDecoder() { Cleanup(); }

void VideoDecoder::Cleanup() {
  // Stop async worker first.
  if (async_worker_) {
    async_worker_->Stop();
    async_worker_.reset();
  }

  // Release ThreadSafeFunctions if they were created.
  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
  }

  async_mode_ = false;

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

Napi::Value VideoDecoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    throw Napi::Error::New(
        env, "InvalidStateError: Cannot configure a closed decoder");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "configure requires config object");
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Parse codec string.
  if (!config.Has("codec") || !config.Get("codec").IsString()) {
    throw Napi::Error::New(env, "config.codec is required");
  }
  std::string codec_str = config.Get("codec").As<Napi::String>().Utf8Value();

  // Parse dimensions (optional per W3C spec - decoder can infer from bitstream).
  coded_width_ = 0;
  coded_height_ = 0;
  if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
    coded_width_ = config.Get("codedWidth").As<Napi::Number>().Int32Value();
    if (coded_width_ < 0 || coded_width_ > kMaxDimension) {
      throw Napi::Error::New(env, "codedWidth must be between 0 and 16384");
    }
  }
  if (config.Has("codedHeight") && config.Get("codedHeight").IsNumber()) {
    coded_height_ = config.Get("codedHeight").As<Napi::Number>().Int32Value();
    if (coded_height_ < 0 || coded_height_ > kMaxDimension) {
      throw Napi::Error::New(env, "codedHeight must be between 0 and 16384");
    }
  }

  // Determine codec ID from codec string.
  AVCodecID codec_id = AV_CODEC_ID_NONE;
  if (codec_str.find("avc1") == 0 || codec_str == "h264") {
    codec_id = AV_CODEC_ID_H264;
  } else if (codec_str == "vp8") {
    codec_id = AV_CODEC_ID_VP8;
  } else if (codec_str.find("vp09") == 0 || codec_str == "vp9") {
    codec_id = AV_CODEC_ID_VP9;
  } else if (codec_str.find("av01") == 0 || codec_str == "av1") {
    codec_id = AV_CODEC_ID_AV1;
  } else if (codec_str.find("hev1") == 0 || codec_str.find("hvc1") == 0 ||
             codec_str == "hevc") {
    codec_id = AV_CODEC_ID_HEVC;
  } else {
    throw Napi::Error::New(env, "Unsupported codec: " + codec_str);
  }

  // Find decoder.
  codec_ = avcodec_find_decoder(codec_id);
  if (!codec_) {
    throw Napi::Error::New(env, "Decoder not found for codec: " + codec_str);
  }

  // Allocate codec context.
  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    throw Napi::Error::New(env, "Could not allocate codec context");
  }

  // Set dimensions only if provided (decoder will use bitstream dimensions otherwise).
  if (coded_width_ > 0) {
    codec_context_->width = coded_width_;
  }
  if (coded_height_ > 0) {
    codec_context_->height = coded_height_;
  }

  // Handle optional description (extradata / SPS+PPS for H.264).
  if (config.Has("description") && config.Get("description").IsTypedArray()) {
    Napi::TypedArray typed_array =
        config.Get("description").As<Napi::TypedArray>();
    Napi::ArrayBuffer array_buffer = typed_array.ArrayBuffer();
    size_t byte_offset = typed_array.ByteOffset();
    size_t byte_length = typed_array.ByteLength();

    uint8_t* data = static_cast<uint8_t*>(array_buffer.Data()) + byte_offset;

    codec_context_->extradata = static_cast<uint8_t*>(
        av_malloc(byte_length + AV_INPUT_BUFFER_PADDING_SIZE));
    if (codec_context_->extradata) {
      memcpy(codec_context_->extradata, data, byte_length);
      memset(codec_context_->extradata + byte_length, 0,
             AV_INPUT_BUFFER_PADDING_SIZE);
      codec_context_->extradata_size = static_cast<int>(byte_length);
    }
  }

  // Parse optional rotation (must be 0, 90, 180, or 270).
  rotation_ = 0;
  if (config.Has("rotation") && config.Get("rotation").IsNumber()) {
    int rotation = config.Get("rotation").As<Napi::Number>().Int32Value();
    if (rotation == 0 || rotation == 90 || rotation == 180 ||
        rotation == 270) {
      rotation_ = rotation;
    } else {
      throw Napi::Error::New(env, "rotation must be 0, 90, 180, or 270");
    }
  }

  // Parse optional flip (horizontal flip).
  flip_ = false;
  if (config.Has("flip") && config.Get("flip").IsBoolean()) {
    flip_ = config.Get("flip").As<Napi::Boolean>().Value();
  }

  // Parse optional displayAspectWidth/displayAspectHeight (per W3C spec).
  display_aspect_width_ = 0;
  display_aspect_height_ = 0;
  if (config.Has("displayAspectWidth") &&
      config.Get("displayAspectWidth").IsNumber()) {
    display_aspect_width_ =
        config.Get("displayAspectWidth").As<Napi::Number>().Int32Value();
  }
  if (config.Has("displayAspectHeight") &&
      config.Get("displayAspectHeight").IsNumber()) {
    display_aspect_height_ =
        config.Get("displayAspectHeight").As<Napi::Number>().Int32Value();
  }

  // Parse optional colorSpace (per W3C spec).
  has_color_space_ = false;
  color_primaries_.clear();
  color_transfer_.clear();
  color_matrix_.clear();
  color_full_range_ = false;
  if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    has_color_space_ = true;

    if (cs.Has("primaries") && cs.Get("primaries").IsString()) {
      color_primaries_ = cs.Get("primaries").As<Napi::String>().Utf8Value();
    }
    if (cs.Has("transfer") && cs.Get("transfer").IsString()) {
      color_transfer_ = cs.Get("transfer").As<Napi::String>().Utf8Value();
    }
    if (cs.Has("matrix") && cs.Get("matrix").IsString()) {
      color_matrix_ = cs.Get("matrix").As<Napi::String>().Utf8Value();
    }
    if (cs.Has("fullRange") && cs.Get("fullRange").IsBoolean()) {
      color_full_range_ = cs.Get("fullRange").As<Napi::Boolean>().Value();
    }
  }

  // Parse optional optimizeForLatency (per W3C spec).
  optimize_for_latency_ = false;
  if (config.Has("optimizeForLatency") &&
      config.Get("optimizeForLatency").IsBoolean()) {
    optimize_for_latency_ =
        config.Get("optimizeForLatency").As<Napi::Boolean>().Value();
  }

  // Parse optional hardwareAcceleration (per W3C spec).
  // Note: This is a stub - FFmpeg uses software decoding.
  hardware_acceleration_ = "no-preference";
  if (config.Has("hardwareAcceleration") &&
      config.Get("hardwareAcceleration").IsString()) {
    std::string hw =
        config.Get("hardwareAcceleration").As<Napi::String>().Utf8Value();
    // Validate W3C enum values per spec.
    if (hw != "no-preference" && hw != "prefer-hardware" &&
        hw != "prefer-software") {
      throw Napi::TypeError::New(
          env,
          "hardwareAcceleration must be 'no-preference', 'prefer-hardware', "
          "or 'prefer-software'");
    }
    hardware_acceleration_ = hw;
  }

  // Apply low-latency flags if requested (before opening codec).
  if (optimize_for_latency_) {
    codec_context_->flags |= AV_CODEC_FLAG_LOW_DELAY;
    codec_context_->flags2 |= AV_CODEC_FLAG2_FAST;
  }

  // Open codec.
  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    throw Napi::Error::New(env,
                           std::string("Could not open decoder: ") + errbuf);
  }

  // Allocate frame and packet.
  frame_ = ffmpeg::make_frame();
  if (!frame_) {
    Cleanup();
    throw Napi::Error::New(env, "Could not allocate frame");
  }

  packet_ = ffmpeg::make_packet();
  if (!packet_) {
    Cleanup();
    throw Napi::Error::New(env, "Could not allocate packet");
  }

  // Create ThreadSafeFunctions for async worker.
  output_tsfn_ = Napi::ThreadSafeFunction::New(
      env, output_callback_.Value(), "VideoDecoder::output", 0, 1,
      [](Napi::Env) {});

  error_tsfn_ = Napi::ThreadSafeFunction::New(
      env, error_callback_.Value(), "VideoDecoder::error", 0, 1,
      [](Napi::Env) {});

  // Initialize async worker.
  async_worker_ =
      std::make_unique<AsyncDecodeWorker>(this, output_tsfn_, error_tsfn_);
  async_mode_ = true;

  state_ = "configured";

  return env.Undefined();
}

Napi::Value VideoDecoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), decode_queue_size_);
}

Napi::Value VideoDecoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), codec_saturated_.load());
}

Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "decode requires EncodedVideoChunk");
  }

  // Get EncodedVideoChunk.
  EncodedVideoChunk* chunk =
      Napi::ObjectWrap<EncodedVideoChunk>::Unwrap(info[0].As<Napi::Object>());

  // Get data from chunk.
  const uint8_t* data = chunk->GetData();
  size_t data_size = chunk->GetDataSize();
  int64_t timestamp = chunk->GetTimestampValue();
  bool is_key_frame = (chunk->GetTypeValue() == "key");

  // Setup packet.
  av_packet_unref(packet_.get());
  packet_->data = const_cast<uint8_t*>(data);
  packet_->size = static_cast<int>(data_size);
  packet_->pts = timestamp;
  packet_->dts = timestamp;

  if (is_key_frame) {
    packet_->flags |= AV_PKT_FLAG_KEY;
  }

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
  bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);

  // Emit any available decoded frames.
  EmitFrames(env);

  return env.Undefined();
}

Napi::Value VideoDecoder::Flush(const Napi::CallbackInfo& info) {
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

  // Emit remaining decoded frames.
  EmitFrames(env);

  // Reset queue after flush
  decode_queue_size_ = 0;
  codec_saturated_.store(false);

  // Return resolved promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

Napi::Value VideoDecoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    throw Napi::Error::New(env,
                           "InvalidStateError: Cannot reset a closed decoder");
  }

  // Flush any pending frames (discard them).
  if (codec_context_) {
    avcodec_send_packet(codec_context_.get(), nullptr);
    while (avcodec_receive_frame(codec_context_.get(), frame_.get()) == 0) {
      av_frame_unref(frame_.get());
    }
  }

  // Clean up FFmpeg resources.
  Cleanup();

  // Reset state.
  state_ = "unconfigured";
  coded_width_ = 0;
  coded_height_ = 0;
  decode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

void VideoDecoder::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

Napi::Value VideoDecoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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

  // Validate codec.
  if (!config.Has("codec") || !config.Get("codec").IsString()) {
    supported = false;
  } else {
    std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
    normalized_config.Set("codec", codec);

    // Check if codec is supported.
    if (codec.find("avc1") == 0 || codec == "h264") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_H264);
      if (!c) {
        supported = false;
      }
    } else if (codec == "vp8") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP8);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("vp09") == 0 || codec == "vp9") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP9);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("av01") == 0 || codec == "av1") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AV1);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("hev1") == 0 || codec.find("hvc1") == 0 ||
               codec == "hevc") {
      const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_HEVC);
      if (!c) {
        supported = false;
      }
    } else {
      supported = false;
    }
  }

  // Validate and copy codedWidth (optional for isConfigSupported per W3C spec).
  // Note: 0 is valid (decoder infers from bitstream), consistent with configure().
  if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
    int coded_width = config.Get("codedWidth").As<Napi::Number>().Int32Value();
    if (coded_width < 0 || coded_width > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("codedWidth", coded_width);
  }

  // Validate and copy codedHeight (optional per W3C spec).
  // Note: 0 is valid (decoder infers from bitstream), consistent with configure().
  if (config.Has("codedHeight") && config.Get("codedHeight").IsNumber()) {
    int coded_height =
        config.Get("codedHeight").As<Napi::Number>().Int32Value();
    if (coded_height < 0 || coded_height > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("codedHeight", coded_height);
  }

  // Copy displayAspectWidth if present (per W3C spec).
  if (config.Has("displayAspectWidth") &&
      config.Get("displayAspectWidth").IsNumber()) {
    int display_aspect_width =
        config.Get("displayAspectWidth").As<Napi::Number>().Int32Value();
    if (display_aspect_width > 0) {
      normalized_config.Set("displayAspectWidth", display_aspect_width);
    }
  }

  // Copy displayAspectHeight if present (per W3C spec).
  if (config.Has("displayAspectHeight") &&
      config.Get("displayAspectHeight").IsNumber()) {
    int display_aspect_height =
        config.Get("displayAspectHeight").As<Napi::Number>().Int32Value();
    if (display_aspect_height > 0) {
      normalized_config.Set("displayAspectHeight", display_aspect_height);
    }
  }

  // Copy optional properties if present.
  if (config.Has("description") && config.Get("description").IsTypedArray()) {
    normalized_config.Set("description", config.Get("description"));
  }

  // Copy colorSpace if present (per W3C spec).
  if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    Napi::Object normalized_cs = Napi::Object::New(env);

    if (cs.Has("primaries") && !cs.Get("primaries").IsNull() &&
        !cs.Get("primaries").IsUndefined()) {
      normalized_cs.Set("primaries", cs.Get("primaries"));
    }
    if (cs.Has("transfer") && !cs.Get("transfer").IsNull() &&
        !cs.Get("transfer").IsUndefined()) {
      normalized_cs.Set("transfer", cs.Get("transfer"));
    }
    if (cs.Has("matrix") && !cs.Get("matrix").IsNull() &&
        !cs.Get("matrix").IsUndefined()) {
      normalized_cs.Set("matrix", cs.Get("matrix"));
    }
    if (cs.Has("fullRange") && !cs.Get("fullRange").IsNull() &&
        !cs.Get("fullRange").IsUndefined()) {
      normalized_cs.Set("fullRange", cs.Get("fullRange"));
    }

    normalized_config.Set("colorSpace", normalized_cs);
  }

  // Handle hardwareAcceleration with default value per W3C spec.
  if (config.Has("hardwareAcceleration") &&
      config.Get("hardwareAcceleration").IsString()) {
    std::string hw =
        config.Get("hardwareAcceleration").As<Napi::String>().Utf8Value();
    // Validate W3C enum values per spec.
    if (hw != "no-preference" && hw != "prefer-hardware" &&
        hw != "prefer-software") {
      supported = false;
    }
    normalized_config.Set("hardwareAcceleration", hw);
  } else {
    // Default to "no-preference" per W3C spec.
    normalized_config.Set("hardwareAcceleration", "no-preference");
  }

  if (config.Has("optimizeForLatency") &&
      config.Get("optimizeForLatency").IsBoolean()) {
    normalized_config.Set("optimizeForLatency",
                          config.Get("optimizeForLatency"));
  }
  if (config.Has("rotation") && config.Get("rotation").IsNumber()) {
    int rotation = config.Get("rotation").As<Napi::Number>().Int32Value();
    // Validate rotation value.
    if (rotation == 0 || rotation == 90 || rotation == 180 ||
        rotation == 270) {
      normalized_config.Set("rotation", rotation);
    } else {
      supported = false;
    }
  }
  if (config.Has("flip") && config.Get("flip").IsBoolean()) {
    normalized_config.Set("flip", config.Get("flip"));
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  // Return resolved Promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}

void VideoDecoder::EmitFrames(Napi::Env env) {
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

    // Initialize or recreate SwsContext if frame format/dimensions change
    // (convert from decoder's pixel format to RGBA).
    AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame_->format);

    if (!sws_context_ || last_frame_format_ != frame_format ||
        last_frame_width_ != frame_->width ||
        last_frame_height_ != frame_->height) {
      sws_context_.reset(
          sws_getContext(frame_->width, frame_->height, frame_format,
                         frame_->width, frame_->height, AV_PIX_FMT_RGBA,
                         SWS_BILINEAR, nullptr, nullptr, nullptr));

      if (!sws_context_) {
        error_callback_.Call(
            {Napi::Error::New(env, "Could not create sws context").Value()});
        av_frame_unref(frame_.get());
        break;
      }

      last_frame_format_ = frame_format;
      last_frame_width_ = frame_->width;
      last_frame_height_ = frame_->height;
    }

    // Allocate RGBA buffer.
    int rgba_size = frame_->width * frame_->height * kBytesPerPixelRgba;
    std::vector<uint8_t> rgba_data(rgba_size);

    // Setup output pointers.
    uint8_t* dst_data[1] = {rgba_data.data()};
    int dst_linesize[1] = {frame_->width * kBytesPerPixelRgba};

    // Convert to RGBA.
    sws_scale(sws_context_.get(), frame_->data, frame_->linesize, 0,
              frame_->height, dst_data, dst_linesize);

    // Calculate display dimensions based on aspect ratio (per W3C spec).
    // If displayAspectWidth/displayAspectHeight are set, compute display
    // dimensions maintaining the height and adjusting width to match ratio.
    int display_width = frame_->width;
    int display_height = frame_->height;
    if (display_aspect_width_ > 0 && display_aspect_height_ > 0) {
      // Per W3C spec: displayWidth = codedHeight * aspectWidth / aspectHeight
      display_width = static_cast<int>(
          std::round(static_cast<double>(frame_->height) *
                     static_cast<double>(display_aspect_width_) /
                     static_cast<double>(display_aspect_height_)));
      display_height = frame_->height;
    }

    // Create VideoFrame with rotation, flip, display dimensions, and colorSpace.
    Napi::Object video_frame;
    if (has_color_space_) {
      video_frame = VideoFrame::CreateInstance(
          env, rgba_data.data(), rgba_data.size(), frame_->width, frame_->height,
          frame_->pts, "RGBA", rotation_, flip_, display_width, display_height,
          color_primaries_, color_transfer_, color_matrix_, color_full_range_);
    } else {
      video_frame = VideoFrame::CreateInstance(
          env, rgba_data.data(), rgba_data.size(), frame_->width, frame_->height,
          frame_->pts, "RGBA", rotation_, flip_, display_width, display_height);
    }

    // Call output callback.
    output_callback_.Call({video_frame});

    // Decrement queue size after frame is emitted
    if (decode_queue_size_ > 0) {
      decode_queue_size_--;
      bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
      codec_saturated_.store(saturated);
    }

    av_frame_unref(frame_.get());
  }
}
