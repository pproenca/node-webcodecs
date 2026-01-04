// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_encoder.h"

#include <chrono>
#include <cstdio>
#include <memory>
#include <string>
#include <thread>
#include <utility>

#include "src/common.h"
#include "src/encoded_video_chunk.h"
#include "src/video_frame.h"

namespace {

// Encoder configuration constants.
constexpr int kDefaultBitrate = 1000000;  // 1 Mbps
constexpr int kDefaultTemporalLayers = 1;
constexpr int kDefaultFramerate = 30;
constexpr int kDefaultGopSize = 30;
constexpr int kDefaultMaxBFrames = 2;
constexpr int kBytesPerPixelRgba = 4;
constexpr int kMaxDimension = 16384;

// Compute temporal layer ID based on frame position and layer count.
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
    : Napi::ObjectWrap<VideoEncoder>(info), state_("unconfigured") {
  // Track active encoder instance (following sharp pattern)
  webcodecs::counterProcess++;
  webcodecs::counterVideoEncoders++;
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
  webcodecs::ShutdownFFmpegLogging();
  webcodecs::counterProcess--;
  webcodecs::counterVideoEncoders--;
}

void VideoEncoder::Cleanup() {
  // Mark as not alive immediately to prevent callbacks from accessing members
  // This provides defense-in-depth even though Stop() joins the worker thread
  alive_.store(false, std::memory_order_release);

  // Stop worker first
  if (worker_) {
    worker_->Stop();

    // Wait for pending chunks to be processed
    auto deadline =
        std::chrono::steady_clock::now() + std::chrono::milliseconds(100);
    while (worker_->GetPendingChunks() > 0 &&
           std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
  }

  // Release TSFNs
  output_tsfn_.Release();
  error_tsfn_.Release();
  flush_tsfn_.Release();

  // Clean up worker and queue
  worker_.reset();
  control_queue_.reset();

  // Reject any pending flush promises
  {
    std::lock_guard<std::mutex> lock(flush_promise_mutex_);
    for (auto& [id, deferred] : pending_flush_promises_) {
      // Note: Can't reject here as we may not have valid env
      // The promises will be orphaned, which is acceptable during cleanup
    }
    pending_flush_promises_.clear();
  }
}

// TSFN callback for output packets
void VideoEncoder::OnOutputTSFN(Napi::Env env, Napi::Function fn,
                                VideoEncoder* ctx,
                                webcodecs::EncodedPacketData* data) {
  if (env == nullptr) {
    data->pending->fetch_sub(1);
    delete data;
    return;
  }

  // Decrement pending count
  data->pending->fetch_sub(1);
  webcodecs::counterQueue--;

  // Create native EncodedVideoChunk
  Napi::Object chunk = EncodedVideoChunk::CreateInstance(
      env, data->is_key ? "key" : "delta", data->timestamp, data->duration,
      data->data.data(), data->data.size());

  // Create metadata object
  Napi::Object metadata = Napi::Object::New(env);

  // Add SVC metadata per W3C spec
  Napi::Object svc = Napi::Object::New(env);
  int temporal_layer =
      ComputeTemporalLayerId(data->frame_index, data->metadata.temporal_layer_count);
  svc.Set("temporalLayerId", Napi::Number::New(env, temporal_layer));
  metadata.Set("svc", svc);

  // Add decoderConfig for keyframes per W3C spec
  if (data->is_key) {
    Napi::Object decoder_config = Napi::Object::New(env);
    decoder_config.Set("codec", data->metadata.codec_string);
    decoder_config.Set("codedWidth",
                       Napi::Number::New(env, data->metadata.width));
    decoder_config.Set("codedHeight",
                       Napi::Number::New(env, data->metadata.height));
    decoder_config.Set("displayAspectWidth",
                       Napi::Number::New(env, data->metadata.display_width));
    decoder_config.Set("displayAspectHeight",
                       Napi::Number::New(env, data->metadata.display_height));

    // Add description (extradata) if available
    if (!data->extradata.empty()) {
      decoder_config.Set("description",
                         Napi::Buffer<uint8_t>::Copy(
                             env, data->extradata.data(), data->extradata.size()));
    }

    // Add colorSpace to decoderConfig if configured
    if (!data->metadata.color_primaries.empty() ||
        !data->metadata.color_transfer.empty() ||
        !data->metadata.color_matrix.empty()) {
      Napi::Object color_space = Napi::Object::New(env);
      if (!data->metadata.color_primaries.empty()) {
        color_space.Set("primaries", data->metadata.color_primaries);
      }
      if (!data->metadata.color_transfer.empty()) {
        color_space.Set("transfer", data->metadata.color_transfer);
      }
      if (!data->metadata.color_matrix.empty()) {
        color_space.Set("matrix", data->metadata.color_matrix);
      }
      color_space.Set("fullRange", data->metadata.color_full_range);
      decoder_config.Set("colorSpace", color_space);
    }

    metadata.Set("decoderConfig", decoder_config);
  }

  fn.Call({chunk, metadata});
  delete data;
}

// TSFN callback for errors
void VideoEncoder::OnErrorTSFN(Napi::Env env, Napi::Function fn,
                               VideoEncoder* /* ctx */,
                               webcodecs::ErrorOutputData* data) {
  if (env == nullptr) {
    delete data;
    return;
  }

  fn.Call({Napi::Error::New(env, data->message).Value()});
  delete data;
}

// TSFN callback for flush completion
void VideoEncoder::OnFlushTSFN(Napi::Env env, Napi::Function /* fn */,
                               VideoEncoder* ctx,
                               webcodecs::FlushCompleteData* data) {
  if (env == nullptr) {
    delete data;
    return;
  }

  // Resolve the promise
  {
    std::lock_guard<std::mutex> lock(ctx->flush_promise_mutex_);
    auto it = ctx->pending_flush_promises_.find(data->promise_id);
    if (it != ctx->pending_flush_promises_.end()) {
      if (data->success) {
        it->second.Resolve(env.Undefined());
      } else {
        it->second.Reject(Napi::Error::New(env, data->error_message).Value());
      }
      ctx->pending_flush_promises_.erase(it);
    }
  }

  delete data;
}

Napi::Value VideoEncoder::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "configure requires config object");
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Parse config
  width_ = webcodecs::AttrAsInt32(config, "width");
  height_ = webcodecs::AttrAsInt32(config, "height");
  display_width_ = webcodecs::AttrAsInt32(config, "displayWidth", width_);
  display_height_ = webcodecs::AttrAsInt32(config, "displayHeight", height_);
  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", kDefaultBitrate);
  int framerate =
      webcodecs::AttrAsInt32(config, "framerate", kDefaultFramerate);
  std::string bitrate_mode =
      webcodecs::AttrAsStr(config, "bitrateMode", "variable");
  std::string codec_str = webcodecs::AttrAsStr(config, "codec", "h264");
  codec_string_ = codec_str;
  std::string latency_mode =
      webcodecs::AttrAsStr(config, "latencyMode", "quality");
  std::string hw_accel =
      webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");

  // Parse colorSpace config
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

  // Parse scalabilityMode
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

  // Parse bitstream format
  bitstream_format_ = "annexb";
  if (webcodecs::HasAttr(config, "avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    bitstream_format_ = webcodecs::AttrAsStr(avc_config, "format", "avc");
  } else if (webcodecs::HasAttr(config, "hevc") &&
             config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    bitstream_format_ = webcodecs::AttrAsStr(hevc_config, "format", "hevc");
  }

  // Build encoder configuration
  encoder_config_.width = width_;
  encoder_config_.height = height_;
  encoder_config_.display_width = display_width_;
  encoder_config_.display_height = display_height_;
  encoder_config_.bitrate = bitrate;
  encoder_config_.framerate = framerate;
  encoder_config_.gop_size = kDefaultGopSize;
  encoder_config_.max_b_frames =
      (latency_mode == "realtime") ? 0 : kDefaultMaxBFrames;
  encoder_config_.use_qscale = (bitrate_mode == "quantizer");
  encoder_config_.codec_string = codec_string_;
  encoder_config_.bitstream_format = bitstream_format_;
  encoder_config_.color_primaries = color_primaries_;
  encoder_config_.color_transfer = color_transfer_;
  encoder_config_.color_matrix = color_matrix_;
  encoder_config_.color_full_range = color_full_range_;
  encoder_config_.temporal_layer_count = temporal_layer_count_;
  encoder_config_.hw_accel = hw_accel;

  // Create control queue and worker
  control_queue_ = std::make_unique<webcodecs::VideoControlQueue>();
  worker_ = std::make_unique<webcodecs::VideoEncoderWorker>(control_queue_.get());

  // Create ThreadSafeFunctions
  auto output_tsfn = Napi::TypedThreadSafeFunction<
      VideoEncoder, webcodecs::EncodedPacketData, OnOutputTSFN>::
      New(env, output_callback_.Value(), "VideoEncoderOutput", 0, 1, this);
  output_tsfn_.Init(output_tsfn);

  auto error_tsfn = Napi::TypedThreadSafeFunction<
      VideoEncoder, webcodecs::ErrorOutputData, OnErrorTSFN>::
      New(env, error_callback_.Value(), "VideoEncoderError", 0, 1, this);
  error_tsfn_.Init(error_tsfn);

  // Create a dummy function for flush TSFN (we don't call it directly)
  auto flush_fn = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});
  auto flush_tsfn = Napi::TypedThreadSafeFunction<
      VideoEncoder, webcodecs::FlushCompleteData, OnFlushTSFN>::
      New(env, flush_fn, "VideoEncoderFlush", 0, 1, this);
  flush_tsfn_.Init(flush_tsfn);

  // Allow Node.js to exit even if TSFNs have pending work.
  // Without Unref(), the TSFN references keep the event loop alive indefinitely.
  output_tsfn_.Unref(env);
  error_tsfn_.Unref(env);
  flush_tsfn_.Unref(env);

  // Set up worker callbacks
  // Note: These callbacks capture 'this' but are protected by:
  // 1. alive_ atomic flag checked before accessing members
  // 2. Stop() joining the worker thread before destruction
  // 3. SafeThreadSafeFunction::Call() failing if TSFN is released
  worker_->SetPacketOutputCallback(
      [this](std::unique_ptr<webcodecs::EncodedPacketData> data) {
        // Check alive flag before accessing members (defense-in-depth)
        if (!alive_.load(std::memory_order_acquire)) {
          data->pending->fetch_sub(1);
          return;  // unique_ptr will clean up data
        }
        // Transfer ownership to TSFN
        webcodecs::EncodedPacketData* raw_data = data.release();
        if (!output_tsfn_.Call(raw_data)) {
          // TSFN was released, clean up
          raw_data->pending->fetch_sub(1);
          delete raw_data;
        }
      });

  worker_->SetErrorOutputCallback([this](int error_code,
                                         const std::string& message) {
    // Check alive flag before accessing members (defense-in-depth)
    if (!alive_.load(std::memory_order_acquire)) {
      return;
    }
    auto* error_data = new webcodecs::ErrorOutputData{error_code, message};
    if (!error_tsfn_.Call(error_data)) {
      delete error_data;
    }
  });

  worker_->SetFlushCompleteCallback(
      [this](uint32_t promise_id, bool success, const std::string& error) {
        // Check alive flag before accessing members (defense-in-depth)
        if (!alive_.load(std::memory_order_acquire)) {
          return;
        }
        auto* flush_data =
            new webcodecs::FlushCompleteData{promise_id, success, error};
        if (!flush_tsfn_.Call(flush_data)) {
          delete flush_data;
        }
      });

  // Configure and start the worker
  if (!worker_->Configure(encoder_config_)) {
    throw Napi::Error::New(env, "Failed to queue encoder configuration");
  }

  if (!worker_->Start()) {
    throw Napi::Error::New(env, "Failed to start encoder worker");
  }

  state_ = "configured";
  frame_count_ = 0;

  return env.Undefined();
}

Napi::Value VideoEncoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
  if (control_queue_) {
    return Napi::Number::New(info.Env(), control_queue_->size());
  }
  return Napi::Number::New(info.Env(), 0);
}

Napi::Value VideoEncoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
  if (control_queue_) {
    return Napi::Boolean::New(info.Env(),
                              control_queue_->size() >= kMaxQueueSize);
  }
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Value VideoEncoder::GetPendingChunks(const Napi::CallbackInfo& info) {
  if (worker_) {
    return Napi::Number::New(info.Env(), worker_->GetPendingChunks());
  }
  return Napi::Number::New(info.Env(), 0);
}

Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "Encoder not configured");
  }

  // Safety valve: reject if queue is too large
  if (control_queue_) {
    size_t queue_size = control_queue_->size();
    if (worker_) {
      queue_size += worker_->GetPendingChunks();
    }
    if (queue_size >= kMaxHardQueueSize) {
      throw Napi::Error::New(
          env,
          "QuotaExceededError: Encode queue is full. You must handle "
          "backpressure by waiting for encodeQueueSize to decrease.");
    }
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "encode requires VideoFrame");
  }

  // Get VideoFrame
  VideoFrame* video_frame =
      Napi::ObjectWrap<VideoFrame>::Unwrap(info[0].As<Napi::Object>());

  // Validate frame size
  PixelFormat frame_format = video_frame->GetFormat();
  size_t expected_size = CalculateAllocationSize(frame_format, width_, height_);
  size_t actual_size = video_frame->GetDataSize();
  if (actual_size < expected_size) {
    throw Napi::Error::New(env, "VideoFrame buffer too small: expected " +
                                    std::to_string(expected_size) +
                                    " bytes, got " +
                                    std::to_string(actual_size));
  }

  // Parse encode options
  bool force_key_frame = false;
  int quantizer = -1;
  if (info.Length() >= 2 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    force_key_frame = webcodecs::AttrAsBool(options, "keyFrame", false);

    // Parse codec-specific quantizer options
    if (webcodecs::HasAttr(options, "avc") && options.Get("avc").IsObject()) {
      Napi::Object avc_opts = options.Get("avc").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(avc_opts, "quantizer", -1);
      if (q >= 0 && q <= 51) quantizer = q;
    } else if (webcodecs::HasAttr(options, "hevc") &&
               options.Get("hevc").IsObject()) {
      Napi::Object hevc_opts = options.Get("hevc").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(hevc_opts, "quantizer", -1);
      if (q >= 0 && q <= 51) quantizer = q;
    } else if (webcodecs::HasAttr(options, "vp9") &&
               options.Get("vp9").IsObject()) {
      Napi::Object vp9_opts = options.Get("vp9").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(vp9_opts, "quantizer", -1);
      if (q >= 0 && q <= 63) quantizer = q;
    } else if (webcodecs::HasAttr(options, "av1") &&
               options.Get("av1").IsObject()) {
      Napi::Object av1_opts = options.Get("av1").As<Napi::Object>();
      int q = webcodecs::AttrAsInt32(av1_opts, "quantizer", -1);
      if (q >= 0 && q <= 63) quantizer = q;
    }
  }

  // Create an AVFrame to pass to the worker
  // The worker expects RGBA data packed in data[0]
  ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
  frame->width = video_frame->GetWidth();
  frame->height = video_frame->GetHeight();
  frame->format = AV_PIX_FMT_RGBA;
  frame->pts = video_frame->GetTimestampValue();
  frame->duration = video_frame->GetDurationValue();

  // Copy RGBA data
  size_t data_size = frame->width * frame->height * kBytesPerPixelRgba;
  int ret = av_frame_get_buffer(frame.get(), 32);
  if (ret < 0) {
    throw Napi::Error::New(env, "Failed to allocate frame buffer");
  }

  std::memcpy(frame->data[0], video_frame->GetData(), data_size);

  // Store quantizer in quality field
  if (quantizer >= 0) {
    frame->quality = quantizer * FF_QP2LAMBDA;
  }

  // Create encode message
  webcodecs::VideoControlQueue::EncodeMessage msg;
  msg.frame = std::move(frame);
  msg.key_frame = force_key_frame;

  // Enqueue the message
  webcodecs::counterQueue++;
  if (!control_queue_->Enqueue(std::move(msg))) {
    webcodecs::counterQueue--;
    throw Napi::Error::New(env, "Failed to enqueue encode request");
  }

  frame_count_++;

  return env.Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    // Return resolved promise for non-configured state
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  if (!control_queue_ || !worker_) {
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  // Create promise for flush completion
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  uint32_t promise_id = next_promise_id_++;

  {
    std::lock_guard<std::mutex> lock(flush_promise_mutex_);
    pending_flush_promises_.emplace(promise_id, std::move(deferred));
  }

  // Enqueue flush message - this is non-blocking!
  webcodecs::VideoControlQueue::FlushMessage msg;
  msg.promise_id = promise_id;

  if (!control_queue_->Enqueue(std::move(msg))) {
    std::lock_guard<std::mutex> lock(flush_promise_mutex_);
    auto it = pending_flush_promises_.find(promise_id);
    if (it != pending_flush_promises_.end()) {
      it->second.Reject(Napi::Error::New(env, "Failed to enqueue flush").Value());
      pending_flush_promises_.erase(it);
    }
    return Napi::Promise::Deferred::New(env).Promise();
  }

  // Reset queue tracking after flush is queued
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  // Return the promise - it will be resolved when flush completes
  {
    std::lock_guard<std::mutex> lock(flush_promise_mutex_);
    auto it = pending_flush_promises_.find(promise_id);
    if (it != pending_flush_promises_.end()) {
      return it->second.Promise();
    }
  }
  // Should never reach here, but return a resolved promise as fallback
  return Napi::Promise::Deferred::New(env).Promise();
}

Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    return env.Undefined();
  }

  // Stop worker and clean up
  if (worker_) {
    worker_->Stop();
    worker_.reset();
  }

  // Release TSFNs
  output_tsfn_.Release();
  error_tsfn_.Release();
  flush_tsfn_.Release();

  // Clear control queue
  if (control_queue_) {
    control_queue_->ClearFrames();
    control_queue_.reset();
  }

  // Reject any pending flush promises
  {
    std::lock_guard<std::mutex> lock(flush_promise_mutex_);
    for (auto& [id, deferred] : pending_flush_promises_) {
      deferred.Reject(
          Napi::Error::New(env, "Encoder reset during flush").Value());
    }
    pending_flush_promises_.clear();
  }

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

  // Validate codec
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
    normalized_config.Set("codec", codec);

    // Check if codec is supported
    if (codec.find("avc1") == 0 || codec == "h264") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_H264);
      if (!c) supported = false;
    } else if (codec == "vp8") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP8);
      if (!c) supported = false;
    } else if (codec.find("vp09") == 0 || codec == "vp9") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP9);
      if (!c) supported = false;
    } else if (codec.find("av01") == 0 || codec == "av1") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AV1);
      if (!c) supported = false;
    } else if (codec.find("hev1") == 0 || codec.find("hvc1") == 0 ||
               codec == "hevc") {
      const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_HEVC);
      if (!c) supported = false;
    } else {
      supported = false;
    }
  }

  // Validate and copy width
  if (!webcodecs::HasAttr(config, "width") || !config.Get("width").IsNumber()) {
    supported = false;
  } else {
    int width = webcodecs::AttrAsInt32(config, "width");
    if (width <= 0 || width > kMaxDimension) supported = false;
    normalized_config.Set("width", width);
  }

  // Validate and copy height
  if (!webcodecs::HasAttr(config, "height") ||
      !config.Get("height").IsNumber()) {
    supported = false;
  } else {
    int height = webcodecs::AttrAsInt32(config, "height");
    if (height <= 0 || height > kMaxDimension) supported = false;
    normalized_config.Set("height", height);
  }

  // Copy optional properties
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
  if (webcodecs::HasAttr(config, "displayWidth") &&
      config.Get("displayWidth").IsNumber()) {
    normalized_config.Set("displayWidth", config.Get("displayWidth"));
  }
  if (webcodecs::HasAttr(config, "displayHeight") &&
      config.Get("displayHeight").IsNumber()) {
    normalized_config.Set("displayHeight", config.Get("displayHeight"));
  }
  if (webcodecs::HasAttr(config, "alpha") && config.Get("alpha").IsString()) {
    normalized_config.Set("alpha", config.Get("alpha"));
  }
  if (webcodecs::HasAttr(config, "scalabilityMode") &&
      config.Get("scalabilityMode").IsString()) {
    normalized_config.Set("scalabilityMode", config.Get("scalabilityMode"));
  }
  if (webcodecs::HasAttr(config, "contentHint") &&
      config.Get("contentHint").IsString()) {
    normalized_config.Set("contentHint", config.Get("contentHint"));
  }
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

  // Copy avc-specific config
  if (webcodecs::HasAttr(config, "avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    Napi::Object normalized_avc = Napi::Object::New(env);

    std::string format = webcodecs::AttrAsStr(avc_config, "format");
    if (format == "annexb" || format == "avc") {
      normalized_avc.Set("format", format);
    }

    normalized_config.Set("avc", normalized_avc);
  }

  // Copy hevc-specific config
  if (webcodecs::HasAttr(config, "hevc") && config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    Napi::Object normalized_hevc = Napi::Object::New(env);

    std::string format = webcodecs::AttrAsStr(hevc_config, "format");
    if (format == "annexb" || format == "hevc") {
      normalized_hevc.Set("format", format);
    }

    normalized_config.Set("hevc", normalized_hevc);
  }

  result.Set("supported", supported);
  result.Set("config", normalized_config);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(result);
  return deferred.Promise();
}
