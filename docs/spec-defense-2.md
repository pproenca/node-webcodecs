You are completely correct. In a production server-side environment (especially one processing high-value video workloads like Remotion), **unbounded queues are a denial-of-service vector**. Relying on user code to "play nice" is not engineering; it's wishful thinking.

The "Principal Engineer" approach is to enforce **Defensive Constraints** at the infrastructure level. If the consumer ignores backpressure signals (`codecSaturated`), the system must protect itself by rejecting work (Fast Failure) rather than crashing (Catastrophic Failure).

Here is the hardened, production-grade implementation that adheres to the "Sentinel" philosophy: **Trust no one, bound everything, and fail explicitly.**

### 1. The Safety Valve: Hard Limits in `VideoEncoder`

We introduce a `kMaxHardQueueSize`. If the internal queue hits this limit, `encode()` throws a `QuotaExceededError`. This forces the consumer to handle backpressure or fail, saving the Node.js process from an OOM crash.

**File:** `src/video_encoder.h`

```cpp
{
type: "file",
fileName: "src/video_encoder.h",
fullContent: `// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoder implementation wrapping FFmpeg libx264.

#ifndef SRC_VIDEO_ENCODER_H_
#define SRC_VIDEO_ENCODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>

#include "src/async_encode_worker.h"
#include "src/ffmpeg_raii.h"

class AsyncEncodeWorker;

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
  explicit VideoEncoder(const Napi::CallbackInfo& info);
  ~VideoEncoder();

  // Disallow copy and assign.
  VideoEncoder(const VideoEncoder&) = delete;
  VideoEncoder& operator=(const VideoEncoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Encode(const Napi::CallbackInfo& info);
  Napi::Value Flush(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);
  Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);
  Napi::Value GetCodecSaturated(const Napi::CallbackInfo& info);
  Napi::Value GetPendingChunks(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitChunks(Napi::Env env);

  // FFmpeg state.
  const AVCodec*
      codec_;  // Not owned - references FFmpeg's static codec descriptor
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  int width_;
  int height_;
  int display_width_;
  int display_height_;
  std::string codec_string_;
  std::string color_primaries_;
  std::string color_transfer_;
  std::string color_matrix_;
  bool color_full_range_;
  int temporal_layer_count_;
  // Bitstream format for AVC/HEVC (per W3C codec registration).
  // "avc"/"hevc": Description (SPS/PPS) provided separately
  // "annexb": Description embedded in bitstream (default for backwards compat)
  std::string bitstream_format_;
  int64_t frame_count_;
  int encode_queue_size_;
  std::atomic<bool> codec_saturated_{false};
  
  // W3C spec saturation threshold (soft limit for reporting codecSaturated).
  // Clients *should* respect this.
  static constexpr size_t kMaxQueueSize = 16;  
  
  // SAFETY VALVE: Hard limit to prevent OOM/crash. 
  // If the user ignores backpressure signals and keeps pushing frames,
  // we reject requests to prevent OOM.
  // 64 frames @ 4K RGBA (3840x2160x4) is ~2GB of RAM.
  // This is a reasonable "stop the bleeding" limit for a single encoder.
  static constexpr size_t kMaxHardQueueSize = 64;

  // Saturation status accessor
  bool IsCodecSaturated() const { return codec_saturated_.load(); }

  // Async encoding support
  std::unique_ptr<AsyncEncodeWorker> async_worker_;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;
  bool async_mode_ = false;
};

#endif  // SRC_VIDEO_ENCODER_H_
`
}

```

**File:** `src/video_encoder.cc`

```cpp
{
type: "file",
fileName: "src/video_encoder.cc",
fullContent: `// Copyright 2024 The node-webcodecs Authors
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
    // Stop() joins the worker thread - after this, no new TSFN calls will be made
    async_worker_->Stop();
  }

  // Abort ThreadSafeFunctions to cancel any pending callbacks.
  // This is non-blocking and prevents the main thread from stalling.
  // The shared_ptr<atomic<int>> pending_chunks_ captured by callbacks ensures
  // thread-safety even if callbacks are cancelled mid-flight.
  if (async_mode_) {
    output_tsfn_.Abort();
    error_tsfn_.Abort();
    async_mode_ = false;
  }

  // Safe to destroy async_worker_ - worker thread has exited and TSFN aborted
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

  // Detect specific software encoder libraries.
  // Different encoders support different options, so we must check the encoder
  // name before setting library-specific options.
  bool is_libx264 = codec_ && strcmp(codec_->name, "libx264") == 0;
  bool is_libx265 = codec_ && strcmp(codec_->name, "libx265") == 0;
  bool is_libvpx =
      codec_ && (strcmp(codec_->name, "libvpx") == 0 ||
                 strcmp(codec_->name, "libvpx-vp9") == 0);
  bool is_libaom = codec_ && strcmp(codec_->name, "libaom-av1") == 0;
  bool is_libsvtav1 = codec_ && strcmp(codec_->name, "libsvtav1") == 0;

  // Codec-specific options (only for software encoders).
  // Hardware encoders have their own internal quality/speed settings.
  // Only set options when the specific encoder library is detected.
  if (!is_hw_encoder) {
    if (codec_id == AV_CODEC_ID_H264 && is_libx264) {
      // libx264-specific options
      av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
      av_opt_set(codec_context_->priv_data, "tune", "zerolatency", 0);
      // For bitrateMode=quantizer, enable CQP mode in libx264.
      // libx264 ignores AV_CODEC_FLAG_QSCALE; it needs the "qp" option set.
      // We set a default QP here; per-frame quality will be applied via
      // frame->quality which libx264 reads when in CQP mode.
      if (bitrate_mode == "quantizer") {
        av_opt_set_int(codec_context_->priv_data, "qp", 23, 0);
      }
    } else if ((codec_id == AV_CODEC_ID_VP8 || codec_id == AV_CODEC_ID_VP9) &&
               is_libvpx) {
      // libvpx-specific options
      av_opt_set(codec_context_->priv_data, "quality", "realtime", 0);
      av_opt_set(codec_context_->priv_data, "speed", "6", 0);
      // VP8/VP9 don't support B-frames
      codec_context_->max_b_frames = 0;
    } else if (codec_id == AV_CODEC_ID_AV1 && is_libaom) {
      // libaom-av1 uses "cpu-used" for speed preset (0-8, higher = faster)
      av_opt_set(codec_context_->priv_data, "cpu-used", "8", 0);
    } else if (codec_id == AV_CODEC_ID_AV1 && is_libsvtav1) {
      // SVT-AV1 uses "preset" for speed (0-13, higher = faster)
      av_opt_set(codec_context_->priv_data, "preset", "8", 0);
    } else if (codec_id == AV_CODEC_ID_HEVC && is_libx265) {
      // libx265-specific options
      av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
      // Note: libx265 tune options are different from libx264 (grain,
      // animation, psnr, ssim) "zerolatency" is not valid for x265, using
      // x265-params instead
      av_opt_set(codec_context_->priv_data, "x265-params", "bframes=0", 0);
    }
    // For unrecognized encoders, skip library-specific options entirely.
    // The encoder will use its default settings.
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

  // SAFETY VALVE: Reject if queue is too large.
  // This prevents OOM if the consumer ignores backpressure.
  if (encode_queue_size_ >= static_cast<int>(kMaxHardQueueSize)) {
    throw Napi::Error::New(
        env,
        "QuotaExceededError: Encode queue is full. You must handle backpressure "
        "by waiting for encodeQueueSize to decrease.");
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
    bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
    codec_saturated_.store(saturated);
    
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

}
`
}

```

### 3. Stability Fix: Safety Checks in Worker Teardown

We add a null check for `env` in the ThreadSafeFunction callback. This prevents segfaults when the worker callback executes during Node.js shutdown or after the environment has been torn down.

**File:** `src/async_encode_worker.cc`

```cpp
{
type: "file",
fileName: "src/async_encode_worker.cc",
fullContent: `// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncEncodeWorker implementation for non-blocking video encoding.

#include "src/async_encode_worker.h"

#include <chrono>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/common.h"
#include "src/encoded_video_chunk.h"
#include "src/video_encoder.h"

namespace {

// Compute temporal layer ID based on frame position and layer count.
// Uses standard WebRTC temporal layering pattern.
// Note: Duplicated from video_encoder.cc to avoid exposing in header.
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

}  // namespace

AsyncEncodeWorker::AsyncEncodeWorker(VideoEncoder* /* encoder */,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr) {}

void AsyncEncodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  sws_context_ = sws;
  width_ = width;
  height_ = height;
  frame_ = ffmpeg::make_frame();
  if (frame_) {
    frame_->format = AV_PIX_FMT_YUV420P;
    frame_->width = width;
    frame_->height = height;
    int ret = av_frame_get_buffer(frame_.get(), 32);
    if (ret < 0) {
      frame_.reset();  // Clear on allocation failure
    }
  }
  packet_ = ffmpeg::make_packet();
}

void AsyncEncodeWorker::SetMetadataConfig(const EncoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}

AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  // frame_ and packet_ are RAII-managed, automatically cleaned up
}

void AsyncEncodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncEncodeWorker::WorkerThread, this);
}

void AsyncEncodeWorker::Stop() {
  if (!running_.load()) return;

  running_.store(false);
  queue_cv_.notify_all();

  if (worker_thread_.joinable()) {
    worker_thread_.join();
  }
}

void AsyncEncodeWorker::Enqueue(EncodeTask task) {
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}

void AsyncEncodeWorker::Flush() {
  // Enqueue a flush task to drain FFmpeg's internal buffers
  EncodeTask flush_task;
  flush_task.is_flush = true;
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(flush_task));
  }
  queue_cv_.notify_one();

  flushing_.store(true);

  // Wait for queue to drain AND all in-flight processing to complete
  {
    std::unique_lock<std::mutex> lock(queue_mutex_);
    queue_cv_.wait(lock, [this] {
      return (task_queue_.empty() && processing_.load() == 0) ||
             !running_.load();
    });
  }

  flushing_.store(false);
}

size_t AsyncEncodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return task_queue_.size();
}

void AsyncEncodeWorker::WorkerThread() {
  while (running_.load()) {
    EncodeTask task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      queue_cv_.wait(lock, [this] {
        return !task_queue_.empty() || !running_.load() || flushing_.load();
      });

      if (!running_.load()) break;

      if (task_queue_.empty()) {
        if (flushing_.load()) {
          queue_cv_.notify_all();
        }
        continue;
      }

      task = std::move(task_queue_.front());
      task_queue_.pop();
      processing_++;  // Track that we're processing this task
    }

    ProcessFrame(task);
    processing_--;  // Done processing

    // Notify when queue is empty AND no tasks are being processed
    if (task_queue_.empty() && processing_.load() == 0) {
      queue_cv_.notify_all();
    }
  }
}

void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }

  // Handle flush task - send NULL frame to drain encoder
  if (task.is_flush) {
    avcodec_send_frame(codec_context_, nullptr);
    // Drain all remaining packets
    while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
      EmitChunk(packet_.get());
      av_packet_unref(packet_.get());
    }
    // Clear frame info map after flush
    frame_info_.clear();
    return;
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_data[1] = {task.rgba_data.data()};
  int src_linesize[1] = {width_ * 4};

  sws_scale(sws_context_, src_data, src_linesize, 0, height_, frame_->data,
            frame_->linesize);

  // Use frame_index as pts for consistent SVC layer computation
  // Store original timestamp/duration for lookup when emitting packets
  frame_->pts = task.frame_index;
  frame_info_[task.frame_index] =
      std::make_pair(task.timestamp, task.duration);

  // Apply per-frame quantizer if specified (matches sync path)
  if (task.quantizer >= 0) {
    frame_->quality = task.quantizer * FF_QP2LAMBDA;
  } else {
    frame_->quality = 0;  // Let encoder decide
  }

  int ret = avcodec_send_frame(codec_context_, frame_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    std::string error_msg = "Encode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          if (env != nullptr) {
            fn.Call({Napi::Error::New(env, *msg).Value()});
          }
          delete msg;
        });
    return;
  }

  while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
    EmitChunk(packet_.get());
    av_packet_unref(packet_.get());
  }
}

// Structure to pass all chunk info through TSFN callback
struct ChunkCallbackData {
  std::vector<uint8_t> data;
  int64_t pts;
  int64_t duration;
  bool is_key;
  int64_t frame_index;  // For SVC layer computation
  EncoderMetadataConfig metadata;
  std::vector<uint8_t> extradata;  // Copy from codec_context at emit time
  // Use shared_ptr to pending counter so it remains valid even if worker is
  // destroyed before callback executes on main thread.
  std::shared_ptr<std::atomic<int>> pending;
};

void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Increment pending count before async operation
  pending_chunks_->fetch_add(1);

  // pkt->pts is the frame_index (set in ProcessFrame)
  int64_t frame_index = pkt->pts;

  // Look up original timestamp/duration from the map
  int64_t timestamp = 0;
  int64_t duration = 0;
  auto it = frame_info_.find(frame_index);
  if (it != frame_info_.end()) {
    timestamp = it->second.first;
    duration = it->second.second;
    frame_info_.erase(it);  // Clean up after use
  }

  // Create callback data with all info needed on main thread
  auto* cb_data = new ChunkCallbackData();
  cb_data->data.assign(pkt->data, pkt->data + pkt->size);
  cb_data->pts = timestamp;  // Use original timestamp, not frame_index
  cb_data->duration = duration;
  cb_data->is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;
  cb_data->frame_index = frame_index;  // For SVC layer computation
  cb_data->metadata = metadata_config_;
  // Copy extradata from codec_context at emit time (may be set after configure)
  if (codec_context_ && codec_context_->extradata &&
      codec_context_->extradata_size > 0) {
    cb_data->extradata.assign(
        codec_context_->extradata,
        codec_context_->extradata + codec_context_->extradata_size);
  }
  cb_data->pending = pending_chunks_;

  output_tsfn_.NonBlockingCall(cb_data, [](Napi::Env env, Napi::Function fn,
                                           ChunkCallbackData* info) {
    // If env is null, the TSFN is being destroyed (environment teardown).
    // Just clean up data and return to avoid crashing.
    if (env == nullptr) {
      info->pending->fetch_sub(1);
      delete info;
      return;
    }

    // Decrement pending count before any operations
    info->pending->fetch_sub(1);
    webcodecs::counterQueue--;  // Decrement global queue counter

    // Create native EncodedVideoChunk directly to avoid double-copy.
    // The data is copied once into the chunk's internal buffer.
    Napi::Object chunk = EncodedVideoChunk::CreateInstance(
        env, info->is_key ? "key" : "delta", info->pts, info->duration,
        info->data.data(), info->data.size());

    // Create metadata object matching sync path
    Napi::Object metadata = Napi::Object::New(env);

    // Add SVC metadata per W3C spec.
    // Compute temporal layer ID based on frame_index and scalabilityMode.
    Napi::Object svc = Napi::Object::New(env);
    int temporal_layer = ComputeTemporalLayerId(
        info->frame_index, info->metadata.temporal_layer_count);
    svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
    metadata.Set("svc", svc);

    // Add decoderConfig for keyframes per W3C spec
    if (info->is_key) {
      Napi::Object decoder_config = Napi::Object::New(env);
      decoder_config.Set("codec", info->metadata.codec_string);
      decoder_config.Set("codedWidth",
                         Napi::Number::New(env, info->metadata.coded_width));
      decoder_config.Set("codedHeight",
                         Napi::Number::New(env, info->metadata.coded_height));
      decoder_config.Set("displayAspectWidth",
                         Napi::Number::New(env, info->metadata.display_width));
      decoder_config.Set("displayAspectHeight",
                         Napi::Number::New(env, info->metadata.display_height));

      // Add description (extradata) if available
      if (!info->extradata.empty()) {
        decoder_config.Set("description", Napi::Buffer<uint8_t>::Copy(
                                              env, info->extradata.data(),
                                              info->extradata.size()));
      }

      // Add colorSpace to decoderConfig if configured
      if (!info->metadata.color_primaries.empty() ||
          !info->metadata.color_transfer.empty() ||
          !info->metadata.color_matrix.empty()) {
        Napi::Object color_space = Napi::Object::New(env);
        if (!info->metadata.color_primaries.empty()) {
          color_space.Set("primaries", info->metadata.color_primaries);
        }
        if (!info->metadata.color_transfer.empty()) {
          color_space.Set("transfer", info->metadata.color_transfer);
        }
        if (!info->metadata.color_matrix.empty()) {
          color_space.Set("matrix", info->metadata.color_matrix);
        }
        color_space.Set("fullRange", info->metadata.color_full_range);
        decoder_config.Set("colorSpace", color_space);
      }

      metadata.Set("decoderConfig", decoder_config);
    }

    fn.Call({chunk, metadata});

    // ChunkCallbackData is no longer tied to the buffer lifetime.
    // Delete it now that the data has been copied into the EncodedVideoChunk.
    delete info;
  });
}
`
}

```

### 4. Stability Fix: Decode Worker Safety

Similar safety checks for the decoding path.

**File:** `src/async_decode_worker.cc`

```cpp
{
type: "file",
fileName: "src/async_decode_worker.cc",
fullContent: `// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker implementation for non-blocking video decoding.

#include "src/async_decode_worker.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <string>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include "src/common.h"
#include "src/video_decoder.h"
#include "src/video_frame.h"

AsyncDecodeWorker::AsyncDecodeWorker(VideoDecoder* /* decoder */,
                                     Napi::ThreadSafeFunction output_tsfn,
                                     Napi::ThreadSafeFunction error_tsfn)
    : output_tsfn_(output_tsfn),
      error_tsfn_(error_tsfn),
      codec_context_(nullptr),
      sws_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      output_width_(0),
      output_height_(0) {}

AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  // frame_, packet_, and sws_context_ are RAII-managed, automatically cleaned up
  // Note: codec_context_ is owned by VideoDecoder

  // Clean up buffer pool
  for (auto* buffer : buffer_pool_) {
    delete buffer;
  }
  buffer_pool_.clear();
}

void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx,
                                        SwsContext* /* sws_unused */,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  // sws_context_ is created lazily in EmitFrame when we know the frame format
  sws_context_.reset();
  output_width_ = width;
  output_height_ = height;
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();
}

void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}

void AsyncDecodeWorker::Start() {
  if (running_.load()) return;

  running_.store(true);
  worker_thread_ = std::thread(&AsyncDecodeWorker::WorkerThread, this);
}

void AsyncDecodeWorker::Stop() {
  if (!running_.load()) return;

  running_.store(false);
  queue_cv_.notify_all();

  if (worker_thread_.joinable()) {
    worker_thread_.join();
  }
}

void AsyncDecodeWorker::Enqueue(DecodeTask task) {
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(task));
  }
  queue_cv_.notify_one();
}

void AsyncDecodeWorker::Flush() {
  // Enqueue a flush task to drain FFmpeg's internal frame buffers
  DecodeTask flush_task;
  flush_task.is_flush = true;
  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    task_queue_.push(std::move(flush_task));
  }
  queue_cv_.notify_one();

  flushing_.store(true);

  // Wait for queue to drain AND all in-flight processing to complete
  std::unique_lock<std::mutex> lock(queue_mutex_);
  queue_cv_.wait(lock, [this] {
    return (task_queue_.empty() && processing_.load() == 0) || !running_.load();
  });

  flushing_.store(false);
}

size_t AsyncDecodeWorker::QueueSize() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return task_queue_.size();
}

std::vector<uint8_t>* AsyncDecodeWorker::AcquireBuffer(size_t size) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  for (auto it = buffer_pool_.begin(); it != buffer_pool_.end(); ++it) {
    if ((*it)->capacity() >= size) {
      auto* buffer = *it;
      buffer_pool_.erase(it);
      buffer->resize(size);
      return buffer;
    }
  }
  return new std::vector<uint8_t>(size);
}

void AsyncDecodeWorker::ReleaseBuffer(std::vector<uint8_t>* buffer) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  if (buffer_pool_.size() < 4) {  // Keep up to 4 buffers
    buffer_pool_.push_back(buffer);
  } else {
    delete buffer;
  }
}

void AsyncDecodeWorker::WorkerThread() {
  while (running_.load()) {
    DecodeTask task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      queue_cv_.wait(lock, [this] {
        return !task_queue_.empty() || !running_.load() || flushing_.load();
      });

      if (!running_.load()) break;

      if (task_queue_.empty()) {
        if (flushing_.load()) {
          queue_cv_.notify_all();
        }
        continue;
      }

      task = std::move(task_queue_.front());
      task_queue_.pop();
      processing_++;  // Track that we're processing this task
    }

    ProcessPacket(task);
    processing_--;  // Done processing

    // Notify when queue is empty AND no tasks are being processed
    if (task_queue_.empty() && processing_.load() == 0) {
      queue_cv_.notify_all();
    }
  }
}

void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }

  // Handle flush task - send NULL packet to drain decoder
  if (task.is_flush) {
    avcodec_send_packet(codec_context_, nullptr);
    // Drain all remaining frames from the decoder
    while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
      EmitFrame(frame_.get());
      av_frame_unref(frame_.get());
    }
    return;
  }

  // Set up packet from task data
  av_packet_unref(packet_.get());
  packet_->data = const_cast<uint8_t*>(task.data.data());
  packet_->size = static_cast<int>(task.data.size());
  packet_->pts = task.timestamp;

  int ret = avcodec_send_packet(codec_context_, packet_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    // Post error to main thread
    std::string error_msg = "Decode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          if (env != nullptr) {
            fn.Call({Napi::Error::New(env, *msg).Value()});
          }
          delete msg;
        });
    return;
  }

  while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
    EmitFrame(frame_.get());
    av_frame_unref(frame_.get());
  }
}

void AsyncDecodeWorker::EmitFrame(AVFrame* frame) {
  // Initialize or recreate SwsContext if frame format/dimensions change
  // (convert from decoder's pixel format to RGBA). RAII managed.
  AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame->format);

  if (!sws_context_ || last_frame_format_ != frame_format ||
      last_frame_width_ != frame->width ||
      last_frame_height_ != frame->height) {
    // RAII handles cleanup of old context automatically via reset()
    sws_context_.reset(
        sws_getContext(frame->width, frame->height, frame_format, frame->width,
                       frame->height, AV_PIX_FMT_RGBA, SWS_BILINEAR, nullptr,
                       nullptr, nullptr));

    if (!sws_context_) {
      std::string error_msg = "Could not create sws context";
      error_tsfn_.NonBlockingCall(
          new std::string(error_msg),
          [](Napi::Env env, Napi::Function fn, std::string* msg) {
            if (env != nullptr) {
              fn.Call({Napi::Error::New(env, *msg).Value()});
            }
            delete msg;
          });
      return;
    }

    last_frame_format_ = frame_format;
    last_frame_width_ = frame->width;
    last_frame_height_ = frame->height;
    // Update output dimensions based on actual frame
    output_width_ = frame->width;
    output_height_ = frame->height;
  }

  // Copy metadata under lock to prevent torn reads
  // Note: codec_mutex_ is already held by ProcessPacket caller
  DecoderMetadataConfig metadata_copy = metadata_config_;

  // Convert YUV to RGBA
  size_t rgba_size = output_width_ * output_height_ * 4;
  auto* rgba_data = AcquireBuffer(rgba_size);

  uint8_t* dst_data[1] = {rgba_data->data()};
  int dst_linesize[1] = {output_width_ * 4};

  sws_scale(sws_context_.get(), frame->data, frame->linesize, 0, frame->height,
            dst_data, dst_linesize);

  int64_t timestamp = frame->pts;
  int width = output_width_;
  int height = output_height_;

  // Capture metadata for lambda
  int rotation = metadata_copy.rotation;
  bool flip = metadata_copy.flip;

  // Calculate display dimensions based on aspect ratio (per W3C spec).
  // If displayAspectWidth/displayAspectHeight are set, compute display
  // dimensions maintaining the height and adjusting width to match ratio.
  int disp_width = width;
  int disp_height = height;
  if (metadata_copy.display_width > 0 && metadata_copy.display_height > 0) {
    // Per W3C spec: displayWidth = codedHeight * aspectWidth / aspectHeight
    disp_width = static_cast<int>(
        std::round(static_cast<double>(height) *
                   static_cast<double>(metadata_copy.display_width) /
                   static_cast<double>(metadata_copy.display_height)));
    disp_height = height;
  }
  std::string color_primaries = metadata_copy.color_primaries;
  std::string color_transfer = metadata_copy.color_transfer;
  std::string color_matrix = metadata_copy.color_matrix;
  bool color_full_range = metadata_copy.color_full_range;
  bool has_color_space = metadata_copy.has_color_space;

  // Increment pending BEFORE queueing callback for accurate tracking
  (*pending_frames_)++;

  // Capture shared_ptr to pending counter, NOT raw worker pointer.
  // This ensures the counter remains valid even if the worker is destroyed
  // before the TSFN callback executes on the main thread.
  // Note: Buffer is managed via raw delete since buffer pool access is unsafe
  // after worker destruction.
  auto pending_counter = pending_frames_;
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [pending_counter, width, height, timestamp, rotation, flip, disp_width,
       disp_height, color_primaries, color_transfer, color_matrix,
       color_full_range,
       has_color_space](Napi::Env env, Napi::Function fn,
                        std::vector<uint8_t>* data) {
        // If env is null, TSFN is closing. Just cleanup.
        if (env == nullptr) {
          delete data;
          (*pending_counter)--;
          return;
        }

        // Always clean up, even if callback throws
        try {
          Napi::Object frame_obj;
          if (has_color_space) {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp,
                "RGBA", rotation, flip, disp_width, disp_height, color_primaries,
                color_transfer, color_matrix, color_full_range);
          } else {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp,
                "RGBA", rotation, flip, disp_width, disp_height);
          }
          fn.Call({frame_obj});
        } catch (const std::exception& e) {
          // Log but don't propagate - cleanup must happen
          fprintf(stderr, "AsyncDecodeWorker callback error: %s\n", e.what());
        } catch (...) {
          fprintf(stderr,
                  "AsyncDecodeWorker callback error: unknown exception\n");
        }
        // Delete buffer directly (can't use pool after worker destruction)
        delete data;
        // Decrement pending counter via shared_ptr (safe after worker destruction)
        (*pending_counter)--;
        webcodecs::counterQueue--;  // Decrement global queue counter
      });
}
`
}

```

### 5. Fixing the Test Environment

Finally, isolation for Vitest and correct backpressure handling in the memory test.

**File:** `test/vitest.config.ts`

```typescript
{
type: "file",
fileName: "test/vitest.config.ts",
fullContent: `import { defineConfig } from 'vitest/config';

// Reference tests are slow (codec conversion) and should only run on-demand.
// Use INCLUDE_REFERENCE=true to include them, or use npm run test-reference.
const includeReference = process.env.INCLUDE_REFERENCE === 'true';

export default defineConfig({
  test: {
    root: './test',
    include: includeReference
      ? ['golden/**/*.test.{ts,js,mjs}', 'reference/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}']
      : ['golden/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}'],
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    // Fix: Enable isolation to prevent tests from interfering with each other
    // caused by shared global state in test/setup.ts
    isolate: true, 
    fileParallelism: true,
    coverage: {
      enabled: process.env.CI === 'true',
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts', 'lib/types.ts'],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
`
}

```

**File:** `test/guardrails/memory_sentinel.js`

```javascript
{
type: "file",
fileName: "test/guardrails/memory_sentinel.js",
fullContent: `const {VideoEncoder, VideoFrame} = require('../../dist');

const LIMIT_MB = 50;
const FRAMES = 10000;
const FLUSH_INTERVAL = 100; // Flush every 100 frames to prevent unbounded queue growth

async function run() {
  console.log(\`Memory Leak Check (\${FRAMES} frames)\`);

  // Baseline
  if (global.gc) global.gc();
  const startRSS = process.memoryUsage().rss;

  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: e => {
      throw e;
    },
  });
  encoder.configure({codec: 'avc1.42001E', width: 640, height: 480});

  const buf = Buffer.alloc(640 * 480 * 4);

  for (let i = 0; i < FRAMES; i++) {
    const frame = new VideoFrame(buf, {
      codedWidth: 640,
      codedHeight: 480,
      timestamp: i * 33000,
    });

    encoder.encode(frame);
    frame.close();

    // Prevent unbounded queue growth by flushing periodically
    // Without this, the async worker queue grows to FRAMES size, causing huge memory usage
    // that looks like a leak but is just buffered data.
    if (i % FLUSH_INTERVAL === 0) {
      await encoder.flush();
    }

    // Periodic GC to isolate C++ leaks from JS wrappers
    if (i % 1000 === 0 && global.gc) {
      global.gc();
      const currentMB = (process.memoryUsage().rss - startRSS) / 1024 / 1024;
      console.log(\`  Frame \${i}: +\${currentMB.toFixed(2)} MB\`);
    }
  }

  await encoder.flush();
  encoder.close();
  
  if (global.gc) global.gc();

  const endRSS = process.memoryUsage().rss;
  const growthMB = (endRSS - startRSS) / 1024 / 1024;

  console.log(
    \`Total Growth: \${growthMB.toFixed(2)} MB (Limit: \${LIMIT_MB} MB)\`,
  );

  if (growthMB > LIMIT_MB) {
    console.error(
      \`FAILURE: Memory grew by \${growthMB.toFixed(2)}MB. Likely leaking AVFrames.\`,
    );
    process.exit(1);
  }
  console.log('SUCCESS: Memory stable.');
}

run().catch(e => {
  console.error('FAILURE:', e.message);
  process.exit(1);
});
`
}

```