// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_encoder.h"

#include <chrono>
#include <memory>
#include <string>
#include <thread>
#include <utility>

#include "src/common.h"
#include "src/video_frame.h"

namespace {

// Encoder configuration constants.
constexpr int kDefaultBitrate = 1000000;  // 1 Mbps
constexpr int kDefaultTemporalLayers = 1;

// Compute temporal layer ID based on frame position and layer count.
// Uses standard WebRTC temporal layering pattern.
int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count) {
  if (temporal_layer_count <= 1) return 0;

  if (temporal_layer_count == 2) {
    // L1T2: alternating pattern [0, 1, 0, 1, ...]
    return (frame_index % 2 == 0) ? 0 : 1;
  }

  // L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
  int pos = frame_index % 4;
  if (pos == 0) return 0;  // Base layer
  if (pos == 2) return 1;  // Middle layer
  return 2;                // Enhancement layer (pos 1, 3)
}
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
          InstanceAccessor("pendingChunks", &VideoEncoder::GetPendingChunks,
                           nullptr),
          StaticMethod("isConfigSupported", &VideoEncoder::IsConfigSupported),
      });

  exports.Set("VideoEncoder", func);
  return exports;
}

VideoEncoder::VideoEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoEncoder>(info),
      codec_(nullptr),
      state_("unconfigured"),
      width_(0),
      height_(0),
      display_width_(0),
      display_height_(0),
      codec_string_(""),
      color_primaries_(""),
      color_transfer_(""),
      color_matrix_(""),
      color_full_range_(false),
      bitstream_format_("annexb"),
      frame_count_(0),
      encode_queue_size_(0) {
  // Track active encoder instance (following sharp pattern)
  webcodecs::counterProcess++;
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

VideoEncoder::~VideoEncoder() {
  Cleanup();
  // Track active encoder instance (following sharp pattern)
  webcodecs::counterProcess--;
}

void VideoEncoder::Cleanup() {
  if (async_worker_) {
    async_worker_->Stop();

    // Wait for all pending TSFN callbacks to complete before releasing
    // This prevents use-after-free when callbacks reference codec_context_
    auto start = std::chrono::steady_clock::now();
    constexpr auto kDrainTimeout = std::chrono::seconds(5);
    while (async_worker_->GetPendingChunks() > 0) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
      if (std::chrono::steady_clock::now() - start > kDrainTimeout) {
        break;  // Timeout to avoid infinite wait
      }
    }
  }

  // Release ThreadSafeFunctions BEFORE destroying async_worker_
  // Callbacks may still be pending and reference the worker
  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  // Now safe to destroy async_worker_ - all callbacks have completed
  if (async_worker_) {
    async_worker_.reset();
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

Napi::Value VideoEncoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "configure requires config object");
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Parse config using webcodecs:: helpers.
  width_ = webcodecs::AttrAsInt32(config, "width");
  height_ = webcodecs::AttrAsInt32(config, "height");

  // Parse display dimensions (default to coded dimensions)
  display_width_ = webcodecs::AttrAsInt32(config, "displayWidth", width_);
  display_height_ = webcodecs::AttrAsInt32(config, "displayHeight", height_);

  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", kDefaultBitrate);
  int framerate =
      webcodecs::AttrAsInt32(config, "framerate", kDefaultFramerate);

  // Parse bitrateMode per W3C WebCodecs spec.
  // "quantizer" = use CQP mode where frame->quality controls encoding quality.
  // "variable" or "constant" = use bitrate-based encoding (default).
  std::string bitrate_mode =
      webcodecs::AttrAsStr(config, "bitrateMode", "variable");

  // Parse codec string
  std::string codec_str = webcodecs::AttrAsStr(config, "codec", "h264");
  codec_string_ = codec_str;  // Store for metadata

  // Parse colorSpace config using webcodecs:: helpers.
  color_primaries_ = "";
  color_transfer_ = "";
  color_matrix_ = "";
  color_full_range_ = false;
  if (webcodecs::HasAttr(config, "colorSpace") &&
      config.Get("colorSpace").IsObject()) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    color_primaries_ = webcodecs::AttrAsStr(cs, "primaries", "");
    color_transfer_ = webcodecs::AttrAsStr(cs, "transfer", "");
    color_matrix_ = webcodecs::AttrAsStr(cs, "matrix", "");
    color_full_range_ = webcodecs::AttrAsBool(cs, "fullRange", false);
  }

  // Parse scalabilityMode to determine temporal layer count.
  // Format: L{spatial}T{temporal}, e.g., "L1T2", "L1T3", "L2T2"
  temporal_layer_count_ = kDefaultTemporalLayers;
  std::string scalability_mode =
      webcodecs::AttrAsStr(config, "scalabilityMode", "");
  if (!scalability_mode.empty()) {
    size_t t_pos = scalability_mode.find('T');
    if (t_pos != std::string::npos && t_pos + 1 < scalability_mode.size()) {
      int t_count = scalability_mode[t_pos + 1] - '0';
      if (t_count >= 1 && t_count <= 3) {
        temporal_layer_count_ = t_count;
      }
    }
  }

  // Parse latencyMode per W3C WebCodecs spec.
  // "realtime" = disable B-frames for low latency (no reordering)
  // "quality" = allow B-frames for better compression (default)
  std::string latency_mode =
      webcodecs::AttrAsStr(config, "latencyMode", "quality");

  // Parse codec-specific bitstream format per W3C codec registration.
  // Default to "annexb" for backwards compatibility (FFmpeg's native format).
  // Per W3C spec, the default should be "avc"/"hevc" when explicit config
  // provided, but for backwards compatibility when no config is provided, use
  // "annexb".
  bitstream_format_ = "annexb";
  if (webcodecs::HasAttr(config, "avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    // Per W3C spec, default is "avc" when avc config object is present
    bitstream_format_ = webcodecs::AttrAsStr(avc_config, "format", "avc");
  } else if (webcodecs::HasAttr(config, "hevc") &&
             config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    // Per W3C spec, default is "hevc" when hevc config object is present
    bitstream_format_ = webcodecs::AttrAsStr(hevc_config, "format", "hevc");
  }

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

  // Try hardware encoders first based on platform and hardwareAcceleration
  // setting
  codec_ = nullptr;
  std::string hw_accel =
      webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");

  if (hw_accel != "prefer-software") {
#ifdef __APPLE__
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_videotoolbox");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_videotoolbox");
    }
#endif
#ifdef _WIN32
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_nvenc");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_qsv");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_amf");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_qsv");
    }
#endif
#ifdef __linux__
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_vaapi");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_nvenc");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_vaapi");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
    }
#endif
  }

  // Fallback to software encoder
  if (!codec_) {
    codec_ = avcodec_find_encoder(codec_id);
  }

  if (!codec_) {
    throw Napi::Error::New(env, "Encoder not found for codec: " + codec_str);
  }

  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    throw Napi::Error::New(env, "Could not allocate codec context");
  }

  // Configure encoder.
  codec_context_->width = width_;
  codec_context_->height = height_;
  codec_context_->time_base = {1, framerate};
  codec_context_->framerate = {framerate, 1};
  codec_context_->pix_fmt = AV_PIX_FMT_YUV420P;
  // When bitrateMode = "quantizer", enable CQP mode so frame->quality is
  // respected. Don't set bit_rate - let quality control encoding.
  if (bitrate_mode == "quantizer") {
    codec_context_->flags |= AV_CODEC_FLAG_QSCALE;
    codec_context_->global_quality = FF_QP2LAMBDA * 23;  // Default QP if none specified
  } else {
    codec_context_->bit_rate = bitrate;
  }
  codec_context_->gop_size = kDefaultGopSize;
  // Per W3C WebCodecs spec: latencyMode "realtime" disables B-frames for low
  // latency encoding (no frame reordering). This is critical for correct MP4
  // muxing as B-frames require proper DTS calculation which isn't available
  // from WebCodecs chunk timestamps.
  if (latency_mode == "realtime") {
    codec_context_->max_b_frames = 0;
  } else {
    codec_context_->max_b_frames = kDefaultMaxBFrames;
  }

  // Set global header flag for non-annexb bitstream formats.
  // This puts SPS/PPS/VPS in codec_context_->extradata instead of in the
  // stream. Per W3C: "avc"/"hevc" formats provide description separately from
  // NAL units.
  if (bitstream_format_ != "annexb") {
    codec_context_->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
  }

  // Detect if this is a hardware encoder (for skipping software-specific
  // options)
  bool is_hw_encoder =
      codec_ && (strstr(codec_->name, "videotoolbox") != nullptr ||
                 strstr(codec_->name, "nvenc") != nullptr ||
                 strstr(codec_->name, "qsv") != nullptr ||
                 strstr(codec_->name, "vaapi") != nullptr ||
                 strstr(codec_->name, "amf") != nullptr);

  // Codec-specific options (only for software encoders).
  // Hardware encoders have their own internal quality/speed settings.
  if (!is_hw_encoder) {
    if (codec_id == AV_CODEC_ID_H264) {
      av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
      av_opt_set(codec_context_->priv_data, "tune", "zerolatency", 0);
      // For bitrateMode=quantizer, enable CQP mode in libx264.
      // libx264 ignores AV_CODEC_FLAG_QSCALE; it needs the "qp" option set.
      // We set a default QP here; per-frame quality will be applied via
      // frame->quality which libx264 reads when in CQP mode.
      if (bitrate_mode == "quantizer") {
        av_opt_set_int(codec_context_->priv_data, "qp", 23, 0);
      }
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
      // Note: libx265 tune options are different from libx264 (grain,
      // animation, psnr, ssim) "zerolatency" is not valid for x265, using
      // x265-params instead
      av_opt_set(codec_context_->priv_data, "x265-params", "bframes=0", 0);
    }
  }

  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
  if (ret < 0) {
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Cleanup();
    throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
  }

  // Allocate frame and packet.
  frame_ = ffmpeg::make_frame();
  frame_->format = codec_context_->pix_fmt;
  frame_->width = width_;
  frame_->height = height_;
  ret = av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);
  if (ret < 0) {
    Cleanup();
    throw Napi::Error::New(env, "Failed to allocate frame buffer");
  }

  packet_ = ffmpeg::make_packet();

  // Setup color converter (RGBA -> YUV420P).
  sws_context_.reset(sws_getContext(width_, height_, AV_PIX_FMT_RGBA, width_,
                                    height_, AV_PIX_FMT_YUV420P, SWS_BILINEAR,
                                    nullptr, nullptr, nullptr));

  state_ = "configured";
  frame_count_ = 0;

  // Enable async encoding via worker thread.
  // Flush semantics use pendingChunks counter - TypeScript polls with
  // setImmediate to wait for all TSFN callbacks to complete without blocking
  // the event loop.
  async_mode_ = true;

  // Create ThreadSafeFunctions for async callbacks
  output_tsfn_ = Napi::ThreadSafeFunction::New(env, output_callback_.Value(),
                                               "VideoEncoderOutput", 0, 1);
  error_tsfn_ = Napi::ThreadSafeFunction::New(env, error_callback_.Value(),
                                              "VideoEncoderError", 0, 1);

  // Create and start the async worker
  async_worker_ =
      std::make_unique<AsyncEncodeWorker>(this, output_tsfn_, error_tsfn_);
  async_worker_->SetCodecContext(codec_context_.get(), sws_context_.get(),
                                 width_, height_);

  // Set metadata config for async output chunks
  EncoderMetadataConfig metadata_config;
  metadata_config.codec_string = codec_string_;
  metadata_config.coded_width = width_;
  metadata_config.coded_height = height_;
  metadata_config.display_width = display_width_;
  metadata_config.display_height = display_height_;
  metadata_config.color_primaries = color_primaries_;
  metadata_config.color_transfer = color_transfer_;
  metadata_config.color_matrix = color_matrix_;
  metadata_config.color_full_range = color_full_range_;
  metadata_config.temporal_layer_count = temporal_layer_count_;
  async_worker_->SetMetadataConfig(metadata_config);

  async_worker_->Start();

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

Napi::Value VideoEncoder::GetPendingChunks(const Napi::CallbackInfo& info) {
  if (async_worker_) {
    return Napi::Number::New(info.Env(), async_worker_->GetPendingChunks());
  }
  return Napi::Number::New(info.Env(), 0);
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
    force_key_frame = webcodecs::AttrAsBool(options, "keyFrame", false);

    // Parse codec-specific quantizer options per W3C WebCodecs spec.
    // Check for avc (H.264) quantizer: 0-51
    if (webcodecs::HasAttr(options, "avc") && options.Get("avc").IsObject()) {
      Napi::Object avc_opts = options.Get("avc").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(avc_opts, "quantizer", -1);
      if (q >= 0 && q <= 51) {
        quantizer = q;
      }
    } else if (webcodecs::HasAttr(options, "hevc") &&
               options.Get("hevc").IsObject()) {
      // hevc (H.265) quantizer: 0-51
      Napi::Object hevc_opts = options.Get("hevc").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(hevc_opts, "quantizer", -1);
      if (q >= 0 && q <= 51) {
        quantizer = q;
      }
    } else if (webcodecs::HasAttr(options, "vp9") &&
               options.Get("vp9").IsObject()) {
      // vp9 quantizer: 0-63
      Napi::Object vp9_opts = options.Get("vp9").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(vp9_opts, "quantizer", -1);
      if (q >= 0 && q <= 63) {
        quantizer = q;
      }
    } else if (webcodecs::HasAttr(options, "av1") &&
               options.Get("av1").IsObject()) {
      // av1 quantizer: 0-63
      Napi::Object av1_opts = options.Get("av1").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(av1_opts, "quantizer", -1);
      if (q >= 0 && q <= 63) {
        quantizer = q;
      }
    }
  }

  if (async_mode_ && async_worker_) {
    // Copy frame data for async processing
    EncodeTask task;
    task.width = static_cast<uint32_t>(video_frame->GetWidth());
    task.height = static_cast<uint32_t>(video_frame->GetHeight());
    task.timestamp = video_frame->GetTimestampValue();
    task.duration = video_frame->GetDurationValue();
    task.key_frame = force_key_frame;
    task.quantizer = quantizer;
    task.frame_index = frame_count_++;

    // Get RGBA data from frame
    size_t data_size = task.width * task.height * 4;
    task.rgba_data.resize(data_size);
    std::memcpy(task.rgba_data.data(), video_frame->GetData(), data_size);

    encode_queue_size_++;
    webcodecs::counterQueue++;  // Global queue tracking
    async_worker_->Enqueue(std::move(task));

    return env.Undefined();
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
      memcpy(frame_->data[0] + y * frame_->linesize[0], src + y * width_,
             width_);
    }

    // Copy U plane.
    const uint8_t* u_src = src + y_size;
    for (int y = 0; y < height_ / 2; y++) {
      memcpy(frame_->data[1] + y * frame_->linesize[1], u_src + y * uv_stride,
             uv_stride);
    }

    // Copy V plane.
    const uint8_t* v_src = src + y_size + uv_size;
    for (int y = 0; y < height_ / 2; y++) {
      memcpy(frame_->data[2] + y * frame_->linesize[2], v_src + y * uv_stride,
             uv_stride);
    }
  } else {
    // Convert from RGBA (or other formats) to YUV420P using swscale.
    const uint8_t* src_data[] = {video_frame->GetData()};
    int src_linesize[] = {video_frame->GetWidth() * kBytesPerPixelRgba};

    sws_scale(sws_context_.get(), src_data, src_linesize, 0, height_,
              frame_->data, frame_->linesize);
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
  int ret = avcodec_send_frame(codec_context_.get(), frame_.get());
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

  if (async_mode_ && async_worker_) {
    // Wait for async worker to drain its queue
    async_worker_->Flush();
    // Reset queue after async flush completes
    encode_queue_size_ = 0;
    codec_saturated_.store(false);
    return env.Undefined();
  }

  // Send NULL frame to flush encoder.
  avcodec_send_frame(codec_context_.get(), nullptr);

  // Get remaining packets.
  EmitChunks(env);

  // Reset queue after flush
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  return env.Undefined();
}

Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // W3C spec: reset() is a no-op when closed (don't throw)
  if (state_ == "closed") {
    return env.Undefined();
  }

  // Flush any pending frames (don't emit - discard).
  if (codec_context_) {
    avcodec_send_frame(codec_context_.get(), nullptr);
    while (avcodec_receive_packet(codec_context_.get(), packet_.get()) == 0) {
      av_packet_unref(packet_.get());
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
    int ret = avcodec_receive_packet(codec_context_.get(), packet_.get());
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

    // Add SVC metadata per W3C spec.
    // Compute temporal layer ID based on frame position and scalabilityMode.
    Napi::Object svc = Napi::Object::New(env);
    int temporal_layer =
        ComputeTemporalLayerId(packet_->pts, temporal_layer_count_);
    svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
    metadata.Set("svc", svc);

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
        decoder_config.Set("description", Napi::Buffer<uint8_t>::Copy(
                                              env, codec_context_->extradata,
                                              codec_context_->extradata_size));
      }

      // Add colorSpace to decoderConfig if configured.
      if (!color_primaries_.empty() || !color_transfer_.empty() ||
          !color_matrix_.empty()) {
        Napi::Object color_space = Napi::Object::New(env);
        if (!color_primaries_.empty()) {
          color_space.Set("primaries", color_primaries_);
        }
        if (!color_transfer_.empty()) {
          color_space.Set("transfer", color_transfer_);
        }
        if (!color_matrix_.empty()) {
          color_space.Set("matrix", color_matrix_);
        }
        color_space.Set("fullRange", color_full_range_);
        decoder_config.Set("colorSpace", color_space);
      }

      metadata.Set("decoderConfig", decoder_config);
    }

    // Call output callback with metadata.
    output_callback_.Call({chunk, metadata});

    av_packet_unref(packet_.get());

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
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
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
  if (!webcodecs::HasAttr(config, "width") || !config.Get("width").IsNumber()) {
    supported = false;
  } else {
    int width = webcodecs::AttrAsInt32(config, "width");
    if (width <= 0 || width > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("width", width);
  }

  // Validate and copy height.
  if (!webcodecs::HasAttr(config, "height") ||
      !config.Get("height").IsNumber()) {
    supported = false;
  } else {
    int height = webcodecs::AttrAsInt32(config, "height");
    if (height <= 0 || height > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("height", height);
  }

  // Copy optional properties if present using webcodecs:: helpers.
  if (webcodecs::HasAttr(config, "bitrate") &&
      config.Get("bitrate").IsNumber()) {
    normalized_config.Set("bitrate", config.Get("bitrate"));
  }
  if (webcodecs::HasAttr(config, "framerate") &&
      config.Get("framerate").IsNumber()) {
    normalized_config.Set("framerate", config.Get("framerate"));
  }
  if (webcodecs::HasAttr(config, "hardwareAcceleration") &&
      config.Get("hardwareAcceleration").IsString()) {
    normalized_config.Set("hardwareAcceleration",
                          config.Get("hardwareAcceleration"));
  }
  if (webcodecs::HasAttr(config, "latencyMode") &&
      config.Get("latencyMode").IsString()) {
    normalized_config.Set("latencyMode", config.Get("latencyMode"));
  }
  if (webcodecs::HasAttr(config, "bitrateMode") &&
      config.Get("bitrateMode").IsString()) {
    normalized_config.Set("bitrateMode", config.Get("bitrateMode"));
  }
  // Copy displayWidth and displayHeight if present (per W3C spec echo
  // requirement)
  if (webcodecs::HasAttr(config, "displayWidth") &&
      config.Get("displayWidth").IsNumber()) {
    normalized_config.Set("displayWidth", config.Get("displayWidth"));
  }
  if (webcodecs::HasAttr(config, "displayHeight") &&
      config.Get("displayHeight").IsNumber()) {
    normalized_config.Set("displayHeight", config.Get("displayHeight"));
  }
  // Echo alpha option per W3C spec
  if (webcodecs::HasAttr(config, "alpha") && config.Get("alpha").IsString()) {
    normalized_config.Set("alpha", config.Get("alpha"));
  }
  // Echo scalabilityMode per W3C spec
  if (webcodecs::HasAttr(config, "scalabilityMode") &&
      config.Get("scalabilityMode").IsString()) {
    normalized_config.Set("scalabilityMode", config.Get("scalabilityMode"));
  }
  // Echo contentHint per W3C spec
  if (webcodecs::HasAttr(config, "contentHint") &&
      config.Get("contentHint").IsString()) {
    normalized_config.Set("contentHint", config.Get("contentHint"));
  }
  // Echo colorSpace per W3C spec
  if (webcodecs::HasAttr(config, "colorSpace") &&
      config.Get("colorSpace").IsObject()) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    Napi::Object cs_copy = Napi::Object::New(env);
    if (webcodecs::HasAttr(cs, "primaries"))
      cs_copy.Set("primaries", cs.Get("primaries"));
    if (webcodecs::HasAttr(cs, "transfer"))
      cs_copy.Set("transfer", cs.Get("transfer"));
    if (webcodecs::HasAttr(cs, "matrix"))
      cs_copy.Set("matrix", cs.Get("matrix"));
    if (webcodecs::HasAttr(cs, "fullRange"))
      cs_copy.Set("fullRange", cs.Get("fullRange"));
    normalized_config.Set("colorSpace", cs_copy);
  }

  // Copy avc-specific config if present (per W3C AVC codec registration).
  if (webcodecs::HasAttr(config, "avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    Napi::Object normalized_avc = Napi::Object::New(env);

    std::string format = webcodecs::AttrAsStr(avc_config, "format");
    // Validate per W3C spec: "annexb" or "avc"
    if (format == "annexb" || format == "avc") {
      normalized_avc.Set("format", format);
    }

    normalized_config.Set("avc", normalized_avc);
  }

  // Copy hevc-specific config if present (per W3C HEVC codec registration).
  if (webcodecs::HasAttr(config, "hevc") && config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    Napi::Object normalized_hevc = Napi::Object::New(env);

    std::string format = webcodecs::AttrAsStr(hevc_config, "format");
    // Validate per W3C spec: "annexb" or "hevc"
    if (format == "annexb" || format == "hevc") {
      normalized_hevc.Set("format", format);
    }

    normalized_config.Set("hevc", normalized_hevc);
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  // Return resolved Promise.
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
