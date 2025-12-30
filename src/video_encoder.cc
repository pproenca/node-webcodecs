// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_encoder.h"

#include <string>

#include "src/video_frame.h"

namespace {

// Encoder configuration constants.
constexpr int kDefaultBitrate = 1000000;  // 1 Mbps
constexpr int kDefaultFramerate = 30;     // 30 fps
constexpr int kDefaultGopSize = 30;       // Keyframe interval
constexpr int kDefaultMaxBFrames = 2;
constexpr int kFrameBufferAlignment = 32;
constexpr int kBytesPerPixelRgba = 4;
constexpr int kMaxDimension = 16384;

}  // namespace

Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports) {
  return VideoEncoder::Init(env, exports);
}

Napi::Object VideoEncoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "VideoEncoder",
      {
          InstanceMethod("configure", &VideoEncoder::Configure),
          InstanceMethod("encode", &VideoEncoder::Encode),
          InstanceMethod("flush", &VideoEncoder::Flush),
          InstanceMethod("reset", &VideoEncoder::Reset),
          InstanceMethod("close", &VideoEncoder::Close),
          InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
          InstanceAccessor("encodeQueueSize", &VideoEncoder::GetEncodeQueueSize,
                           nullptr),
          InstanceAccessor("codecSaturated", &VideoEncoder::GetCodecSaturated,
                           nullptr),
          StaticMethod("isConfigSupported", &VideoEncoder::IsConfigSupported),
      });

  exports.Set("VideoEncoder", func);
  return exports;
}

VideoEncoder::VideoEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoEncoder>(info),
      codec_(nullptr),
      codec_context_(nullptr),
      sws_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      width_(0),
      height_(0),
      display_width_(0),
      display_height_(0),
      codec_string_(""),
      frame_count_(0),
      encode_queue_size_(0) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(
        env,
        "VideoEncoder requires init object with output and error "
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

VideoEncoder::~VideoEncoder() { Cleanup(); }

void VideoEncoder::Cleanup() {
  if (frame_) {
    av_frame_free(&frame_);
    frame_ = nullptr;
  }
  if (packet_) {
    av_packet_free(&packet_);
    packet_ = nullptr;
  }
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  if (codec_context_) {
    avcodec_free_context(&codec_context_);
    codec_context_ = nullptr;
  }
  codec_ = nullptr;
}

Napi::Value VideoEncoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "configure requires config object");
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Parse config.
  width_ = config.Get("width").As<Napi::Number>().Int32Value();
  height_ = config.Get("height").As<Napi::Number>().Int32Value();

  // Parse display dimensions (default to coded dimensions)
  display_width_ = width_;
  display_height_ = height_;
  if (config.Has("displayWidth") && config.Get("displayWidth").IsNumber()) {
    display_width_ = config.Get("displayWidth").As<Napi::Number>().Int32Value();
  }
  if (config.Has("displayHeight") && config.Get("displayHeight").IsNumber()) {
    display_height_ =
        config.Get("displayHeight").As<Napi::Number>().Int32Value();
  }

  int bitrate = kDefaultBitrate;
  if (config.Has("bitrate")) {
    bitrate = config.Get("bitrate").As<Napi::Number>().Int32Value();
  }

  int framerate = kDefaultFramerate;
  if (config.Has("framerate")) {
    framerate = config.Get("framerate").As<Napi::Number>().Int32Value();
  }

  // Parse codec string
  std::string codec_str = "h264";  // Default
  if (config.Has("codec") && config.Get("codec").IsString()) {
    codec_str = config.Get("codec").As<Napi::String>().Utf8Value();
  }
  codec_string_ = codec_str;  // Store for metadata

  // Find encoder based on codec string
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

  codec_ = avcodec_find_encoder(codec_id);
  if (!codec_) {
    throw Napi::Error::New(env, "Encoder not found for codec: " + codec_str);
  }

  codec_context_ = avcodec_alloc_context3(codec_);
  if (!codec_context_) {
    throw Napi::Error::New(env, "Could not allocate codec context");
  }

  // Configure encoder.
  codec_context_->width = width_;
  codec_context_->height = height_;
  codec_context_->time_base = {1, framerate};
  codec_context_->framerate = {framerate, 1};
  codec_context_->pix_fmt = AV_PIX_FMT_YUV420P;
  codec_context_->bit_rate = bitrate;
  codec_context_->gop_size = kDefaultGopSize;
  codec_context_->max_b_frames = kDefaultMaxBFrames;

  // Codec-specific options.
  if (codec_id == AV_CODEC_ID_H264) {
    av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
    av_opt_set(codec_context_->priv_data, "tune", "zerolatency", 0);
  } else if (codec_id == AV_CODEC_ID_VP8 || codec_id == AV_CODEC_ID_VP9) {
    // VP8/VP9 specific: set quality (crf) and speed
    av_opt_set(codec_context_->priv_data, "quality", "realtime", 0);
    av_opt_set(codec_context_->priv_data, "speed", "6", 0);
    // VP8/VP9 don't support B-frames
    codec_context_->max_b_frames = 0;
  } else if (codec_id == AV_CODEC_ID_AV1) {
    // AV1 specific options
    av_opt_set(codec_context_->priv_data, "preset", "8", 0);
  } else if (codec_id == AV_CODEC_ID_HEVC) {
    // libx265 specific options
    av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
    // Note: libx265 tune options are different from libx264 (grain, animation, psnr, ssim)
    // "zerolatency" is not valid for x265, using x265-params instead
    av_opt_set(codec_context_->priv_data, "x265-params", "bframes=0", 0);
  }

  int ret = avcodec_open2(codec_context_, codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
  }

  // Allocate frame and packet.
  frame_ = av_frame_alloc();
  frame_->format = codec_context_->pix_fmt;
  frame_->width = width_;
  frame_->height = height_;
  av_frame_get_buffer(frame_, kFrameBufferAlignment);

  packet_ = av_packet_alloc();

  // Setup color converter (RGBA -> YUV420P).
  sws_context_ = sws_getContext(width_, height_, AV_PIX_FMT_RGBA, width_,
                                height_, AV_PIX_FMT_YUV420P, SWS_BILINEAR,
                                nullptr, nullptr, nullptr);

  state_ = "configured";
  frame_count_ = 0;

  return env.Undefined();
}

Napi::Value VideoEncoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), encode_queue_size_);
}

Napi::Value VideoEncoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), codec_saturated_.load());
}

Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "Encoder not configured");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "encode requires VideoFrame");
  }

  // Get VideoFrame.
  VideoFrame* video_frame =
      Napi::ObjectWrap<VideoFrame>::Unwrap(info[0].As<Napi::Object>());

  // Get frame format and calculate expected buffer size.
  PixelFormat frame_format = video_frame->GetFormat();
  size_t expected_size = CalculateAllocationSize(frame_format, width_, height_);
  size_t actual_size = video_frame->GetDataSize();
  if (actual_size < expected_size) {
    throw Napi::Error::New(env, "VideoFrame buffer too small: expected " +
                                    std::to_string(expected_size) +
                                    " bytes, got " +
                                    std::to_string(actual_size));
  }

  // Check for keyFrame and codec-specific quantizer options.
  bool force_key_frame = false;
  int quantizer = -1;  // -1 means not specified
  if (info.Length() >= 2 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    if (options.Has("keyFrame") && options.Get("keyFrame").IsBoolean()) {
      force_key_frame = options.Get("keyFrame").As<Napi::Boolean>().Value();
    }

    // Parse codec-specific quantizer options per W3C WebCodecs spec.
    // Check for avc (H.264) quantizer: 0-51
    if (options.Has("avc") && options.Get("avc").IsObject()) {
      Napi::Object avc_opts = options.Get("avc").As<Napi::Object>();
      if (avc_opts.Has("quantizer") && avc_opts.Get("quantizer").IsNumber()) {
        int q = avc_opts.Get("quantizer").As<Napi::Number>().Int32Value();
        if (q >= 0 && q <= 51) {
          quantizer = q;
        }
      }
    } else if (options.Has("hevc") && options.Get("hevc").IsObject()) {
      // hevc (H.265) quantizer: 0-51
      Napi::Object hevc_opts = options.Get("hevc").As<Napi::Object>();
      if (hevc_opts.Has("quantizer") && hevc_opts.Get("quantizer").IsNumber()) {
        int q = hevc_opts.Get("quantizer").As<Napi::Number>().Int32Value();
        if (q >= 0 && q <= 51) {
          quantizer = q;
        }
      }
    } else if (options.Has("vp9") && options.Get("vp9").IsObject()) {
      // vp9 quantizer: 0-63
      Napi::Object vp9_opts = options.Get("vp9").As<Napi::Object>();
      if (vp9_opts.Has("quantizer") && vp9_opts.Get("quantizer").IsNumber()) {
        int q = vp9_opts.Get("quantizer").As<Napi::Number>().Int32Value();
        if (q >= 0 && q <= 63) {
          quantizer = q;
        }
      }
    } else if (options.Has("av1") && options.Get("av1").IsObject()) {
      // av1 quantizer: 0-63
      Napi::Object av1_opts = options.Get("av1").As<Napi::Object>();
      if (av1_opts.Has("quantizer") && av1_opts.Get("quantizer").IsNumber()) {
        int q = av1_opts.Get("quantizer").As<Napi::Number>().Int32Value();
        if (q >= 0 && q <= 63) {
          quantizer = q;
        }
      }
    }
  }

  // Convert input frame to YUV420P based on input format.
  if (frame_format == PixelFormat::I420) {
    // I420 is already YUV420P - copy planes directly.
    const uint8_t* src = video_frame->GetData();
    int y_size = width_ * height_;
    int uv_stride = width_ / 2;
    int uv_size = uv_stride * (height_ / 2);

    // Copy Y plane.
    for (int y = 0; y < height_; y++) {
      memcpy(frame_->data[0] + y * frame_->linesize[0],
             src + y * width_, width_);
    }

    // Copy U plane.
    const uint8_t* u_src = src + y_size;
    for (int y = 0; y < height_ / 2; y++) {
      memcpy(frame_->data[1] + y * frame_->linesize[1],
             u_src + y * uv_stride, uv_stride);
    }

    // Copy V plane.
    const uint8_t* v_src = src + y_size + uv_size;
    for (int y = 0; y < height_ / 2; y++) {
      memcpy(frame_->data[2] + y * frame_->linesize[2],
             v_src + y * uv_stride, uv_stride);
    }
  } else {
    // Convert from RGBA (or other formats) to YUV420P using swscale.
    const uint8_t* src_data[] = {video_frame->GetData()};
    int src_linesize[] = {video_frame->GetWidth() * kBytesPerPixelRgba};

    sws_scale(sws_context_, src_data, src_linesize, 0, height_, frame_->data,
              frame_->linesize);
  }

  frame_->pts = frame_count_++;

  // Set picture type for keyframe forcing.
  if (force_key_frame) {
    frame_->pict_type = AV_PICTURE_TYPE_I;
  } else {
    frame_->pict_type = AV_PICTURE_TYPE_NONE;
  }

  // Apply codec-specific quantizer if specified.
  // In FFmpeg, quality is specified in a scale where lower is better.
  // For H.264/HEVC (0-51) and VP9/AV1 (0-63), we set the frame quality.
  if (quantizer >= 0) {
    // FF_QP2LAMBDA converts QP to the internal quality scale.
    frame_->quality = quantizer * FF_QP2LAMBDA;
  } else {
    frame_->quality = 0;  // Let encoder decide
  }

  // Track queue size and saturation
  encode_queue_size_++;
  bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);

  // Send frame to encoder.
  int ret = avcodec_send_frame(codec_context_, frame_);
  if (ret < 0) {
    encode_queue_size_--;
    bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
    codec_saturated_.store(saturated);
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    throw Napi::Error::New(env, std::string("Error sending frame: ") + errbuf);
  }

  // Receive encoded packets.
  EmitChunks(env);

  return env.Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    return env.Undefined();
  }

  // Send NULL frame to flush encoder.
  avcodec_send_frame(codec_context_, nullptr);

  // Get remaining packets.
  EmitChunks(env);

  // Reset queue after flush
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    throw Napi::Error::New(env,
                           "InvalidStateError: Cannot reset a closed encoder");
  }

  // Flush any pending frames (don't emit - discard).
  if (codec_context_) {
    avcodec_send_frame(codec_context_, nullptr);
    while (avcodec_receive_packet(codec_context_, packet_) == 0) {
      av_packet_unref(packet_);
    }
  }

  // Clean up FFmpeg resources.
  Cleanup();

  // Reset state.
  state_ = "unconfigured";
  frame_count_ = 0;
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

void VideoEncoder::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

void VideoEncoder::EmitChunks(Napi::Env env) {
  while (true) {
    int ret = avcodec_receive_packet(codec_context_, packet_);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      char errbuf[256];
      av_strerror(ret, errbuf, sizeof(errbuf));
      error_callback_.Call(
          {Napi::Error::New(env, std::string("Encoding error: ") + errbuf)
               .Value()});
      break;
    }

    // Create EncodedVideoChunk-like object.
    Napi::Object chunk = Napi::Object::New(env);
    bool is_keyframe = (packet_->flags & AV_PKT_FLAG_KEY) != 0;
    chunk.Set("type", is_keyframe ? "key" : "delta");
    chunk.Set("timestamp", Napi::Number::New(env, packet_->pts));
    chunk.Set("duration", Napi::Number::New(env, packet_->duration));
    chunk.Set("data",
              Napi::Buffer<uint8_t>::Copy(env, packet_->data, packet_->size));

    // Create metadata object.
    Napi::Object metadata = Napi::Object::New(env);

    // Add decoderConfig for keyframes per W3C spec.
    if (is_keyframe) {
      Napi::Object decoder_config = Napi::Object::New(env);
      decoder_config.Set("codec", codec_string_);
      decoder_config.Set("codedWidth", Napi::Number::New(env, width_));
      decoder_config.Set("codedHeight", Napi::Number::New(env, height_));
      decoder_config.Set("displayAspectWidth",
                         Napi::Number::New(env, display_width_));
      decoder_config.Set("displayAspectHeight",
                         Napi::Number::New(env, display_height_));

      // Add description (extradata) if available.
      if (codec_context_->extradata && codec_context_->extradata_size > 0) {
        decoder_config.Set(
            "description",
            Napi::Buffer<uint8_t>::Copy(env, codec_context_->extradata,
                                        codec_context_->extradata_size));
      }

      metadata.Set("decoderConfig", decoder_config);
    }

    // Call output callback with metadata.
    output_callback_.Call({chunk, metadata});

    av_packet_unref(packet_);

    // Decrement queue after emitting chunk
    if (encode_queue_size_ > 0) {
      encode_queue_size_--;
      bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
      codec_saturated_.store(saturated);
    }
  }
}

Napi::Value VideoEncoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_H264);
      if (!c) {
        supported = false;
      }
    } else if (codec == "vp8") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP8);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("vp09") == 0 || codec == "vp9") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP9);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("av01") == 0 || codec == "av1") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AV1);
      if (!c) {
        supported = false;
      }
    } else if (codec.find("hev1") == 0 || codec.find("hvc1") == 0 ||
               codec == "hevc") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_HEVC);
      if (!c) {
        supported = false;
      }
    } else {
      supported = false;
    }
  }

  // Validate and copy width.
  if (!config.Has("width") || !config.Get("width").IsNumber()) {
    supported = false;
  } else {
    int width = config.Get("width").As<Napi::Number>().Int32Value();
    if (width <= 0 || width > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("width", width);
  }

  // Validate and copy height.
  if (!config.Has("height") || !config.Get("height").IsNumber()) {
    supported = false;
  } else {
    int height = config.Get("height").As<Napi::Number>().Int32Value();
    if (height <= 0 || height > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("height", height);
  }

  // Copy optional properties if present.
  if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
    normalized_config.Set("bitrate", config.Get("bitrate"));
  }
  if (config.Has("framerate") && config.Get("framerate").IsNumber()) {
    normalized_config.Set("framerate", config.Get("framerate"));
  }
  if (config.Has("hardwareAcceleration") &&
      config.Get("hardwareAcceleration").IsString()) {
    normalized_config.Set("hardwareAcceleration",
                          config.Get("hardwareAcceleration"));
  }
  if (config.Has("latencyMode") && config.Get("latencyMode").IsString()) {
    normalized_config.Set("latencyMode", config.Get("latencyMode"));
  }
  if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
    normalized_config.Set("bitrateMode", config.Get("bitrateMode"));
  }
  // Copy displayWidth and displayHeight if present (per W3C spec echo requirement)
  if (config.Has("displayWidth") && config.Get("displayWidth").IsNumber()) {
    normalized_config.Set("displayWidth", config.Get("displayWidth"));
  }
  if (config.Has("displayHeight") && config.Get("displayHeight").IsNumber()) {
    normalized_config.Set("displayHeight", config.Get("displayHeight"));
  }
  // Echo alpha option per W3C spec
  if (config.Has("alpha") && config.Get("alpha").IsString()) {
    normalized_config.Set("alpha", config.Get("alpha"));
  }
  // Echo scalabilityMode per W3C spec
  if (config.Has("scalabilityMode") &&
      config.Get("scalabilityMode").IsString()) {
    normalized_config.Set("scalabilityMode", config.Get("scalabilityMode"));
  }
  // Echo contentHint per W3C spec
  if (config.Has("contentHint") && config.Get("contentHint").IsString()) {
    normalized_config.Set("contentHint", config.Get("contentHint"));
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  // Return resolved Promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
