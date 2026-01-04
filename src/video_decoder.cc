// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_decoder.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/common.h"
#include "src/encoded_video_chunk.h"
#include "src/video_frame.h"

namespace {

constexpr int kMaxDimension = 16384;

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
          InstanceAccessor("pendingFrames", &VideoDecoder::GetPendingFrames,
                           nullptr),
          StaticMethod("isConfigSupported", &VideoDecoder::IsConfigSupported),
      });

  exports.Set("VideoDecoder", func);
  return exports;
}

VideoDecoder::VideoDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoDecoder>(info),
      state_("unconfigured"),
      coded_width_(0),
      coded_height_(0) {
  // Track active decoder instance (following sharp pattern)
  webcodecs::counterProcess++;
  webcodecs::counterVideoDecoders++;
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

VideoDecoder::~VideoDecoder() {
  Cleanup();
  webcodecs::ShutdownFFmpegLogging();

  // Track active decoder instance (following sharp pattern)
  webcodecs::counterProcess--;
  webcodecs::counterVideoDecoders--;
}

void VideoDecoder::Cleanup() {
  // Stop worker first
  if (worker_) {
    worker_->Stop();
    worker_.reset();
  }

  // Shutdown control queue
  if (control_queue_) {
    control_queue_->Shutdown();
    control_queue_.reset();
  }

  // Release TSFNs
  frame_tsfn_.Release();
  flush_tsfn_.Release();
  error_tsfn_.Release();
  dequeue_tsfn_.Release();

  // Clear pending promises
  pending_flushes_.clear();
}

void VideoDecoder::SetupWorkerCallbacks(Napi::Env env) {
  // Capture 'this' pointer and metadata config for callbacks
  auto* self = this;

  // Set output frame callback
  worker_->SetOutputFrameCallback([self](ffmpeg::AVFramePtr frame) {
    // Create callback data with frame and metadata
    auto* data = new FrameCallbackData();
    data->frame = std::move(frame);
    data->metadata.rotation = self->rotation_;
    data->metadata.flip = self->flip_;
    data->metadata.display_width = self->display_aspect_width_;
    data->metadata.display_height = self->display_aspect_height_;
    data->metadata.color_primaries = self->color_primaries_;
    data->metadata.color_transfer = self->color_transfer_;
    data->metadata.color_matrix = self->color_matrix_;
    data->metadata.color_full_range = self->color_full_range_;
    data->metadata.has_color_space = self->has_color_space_;
    data->pending_frames_ptr = &self->pending_frames_;

    self->pending_frames_++;
    if (!self->frame_tsfn_.Call(data)) {
      self->pending_frames_--;
      delete data;
    }
  });

  // Set error callback
  worker_->SetOutputErrorCallback(
      [self](int error_code, const std::string& message) {
        auto* data = new ErrorCallbackData{error_code, message};
        if (!self->error_tsfn_.Call(data)) {
          delete data;
        }
      });

  // Set flush complete callback
  worker_->SetFlushCompleteCallback(
      [self](uint32_t promise_id, bool success, const std::string& error) {
        auto* data = new FlushCallbackData{promise_id, success, error, self};
        if (!self->flush_tsfn_.Call(data)) {
          delete data;
        }
      });

  // Set dequeue callback
  worker_->SetDequeueCallback([self](uint32_t new_queue_size) {
    auto* data = new uint32_t(new_queue_size);
    if (!self->dequeue_tsfn_.Call(data)) {
      delete data;
    }
  });
}

// TSFN callback: handle decoded frame on JS thread
void VideoDecoder::OnFrameCallback(Napi::Env env, Napi::Function fn,
                                   std::nullptr_t*, FrameCallbackData* data) {
  if (env == nullptr || data == nullptr) {
    // Still need to decrement if we have a valid pointer
    if (data && data->pending_frames_ptr) {
      (*data->pending_frames_ptr)--;
    }
    delete data;
    return;
  }

  try {
    AVFrame* frame = data->frame.get();
    if (!frame) {
      // Decrement pending frames even on early exit
      if (data->pending_frames_ptr) {
        (*data->pending_frames_ptr)--;
      }
      delete data;
      return;
    }

    // Extract dimensions and metadata
    int width = frame->width;
    int height = frame->height;
    int64_t timestamp = frame->pts;

    // Get display dimensions from sample_aspect_ratio (stored by worker)
    int display_width =
        frame->sample_aspect_ratio.num > 0 ? frame->sample_aspect_ratio.num : width;
    int display_height =
        frame->sample_aspect_ratio.den > 0 ? frame->sample_aspect_ratio.den : height;

    // Get rotation and flip from opaque (encoded by worker)
    intptr_t opaque_val = reinterpret_cast<intptr_t>(frame->opaque);
    int rotation = static_cast<int>((opaque_val >> 1) & 0x3) * 90;
    bool flip = (opaque_val & 1) != 0;

    // Frame data is already in RGBA format
    size_t data_size = width * height * 4;

    // Create VideoFrame
    Napi::Object video_frame;
    if (data->metadata.has_color_space) {
      video_frame = VideoFrame::CreateInstance(
          env, frame->data[0], data_size, width, height, timestamp, "RGBA",
          rotation, flip, display_width, display_height,
          data->metadata.color_primaries, data->metadata.color_transfer,
          data->metadata.color_matrix, data->metadata.color_full_range);
    } else {
      video_frame = VideoFrame::CreateInstance(
          env, frame->data[0], data_size, width, height, timestamp, "RGBA",
          rotation, flip, display_width, display_height);
    }

    fn.Call({video_frame});
  } catch (const std::exception& e) {
    fprintf(stderr, "VideoDecoder frame callback error: %s\n", e.what());
  }

  // Decrement pending frames counter after frame is delivered
  if (data->pending_frames_ptr) {
    (*data->pending_frames_ptr)--;
  }

  delete data;
  webcodecs::counterQueue--;
}

// TSFN callback: handle flush completion on JS thread
void VideoDecoder::OnFlushCallback(Napi::Env env, Napi::Function /* fn */,
                                   std::nullptr_t*, FlushCallbackData* data) {
  if (env == nullptr || data == nullptr) {
    delete data;
    return;
  }

  // Resolve or reject the stored promise
  if (data->decoder) {
    auto it = data->decoder->pending_flushes_.find(data->promise_id);
    if (it != data->decoder->pending_flushes_.end()) {
      if (data->success) {
        it->second.Resolve(env.Undefined());
      } else {
        it->second.Reject(
            Napi::Error::New(env, data->error_message).Value());
      }
      data->decoder->pending_flushes_.erase(it);
    }
  }

  delete data;
}

// TSFN callback: handle error on JS thread
void VideoDecoder::OnErrorCallback(Napi::Env env, Napi::Function fn,
                                   std::nullptr_t*, ErrorCallbackData* data) {
  if (env == nullptr || data == nullptr) {
    delete data;
    return;
  }

  try {
    Napi::Error error = Napi::Error::New(env, data->message);
    fn.Call({error.Value()});
  } catch (const std::exception& e) {
    fprintf(stderr, "VideoDecoder error callback error: %s\n", e.what());
  }

  delete data;
}

// TSFN callback: handle dequeue event on JS thread
void VideoDecoder::OnDequeueCallback(Napi::Env env, Napi::Function /* fn */,
                                     std::nullptr_t*, uint32_t* data) {
  if (env == nullptr || data == nullptr) {
    delete data;
    return;
  }

  // Note: Queue size update is handled internally
  // This callback allows future extensions (e.g., dequeue event emission)

  delete data;
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

  // Parse codec string (required).
  webcodecs::RequireAttr(env, config, "codec");
  std::string codec_str = webcodecs::AttrAsStr(config, "codec");

  // Parse dimensions (optional per W3C spec - decoder can infer from
  // bitstream).
  coded_width_ = webcodecs::AttrAsInt32(config, "codedWidth", 0);
  if (coded_width_ < 0 || coded_width_ > kMaxDimension) {
    throw Napi::Error::New(env, "codedWidth must be between 0 and 16384");
  }
  coded_height_ = webcodecs::AttrAsInt32(config, "codedHeight", 0);
  if (coded_height_ < 0 || coded_height_ > kMaxDimension) {
    throw Napi::Error::New(env, "codedHeight must be between 0 and 16384");
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

  // Parse optional rotation (must be 0, 90, 180, or 270).
  rotation_ = webcodecs::AttrAsInt32(config, "rotation", 0);
  if (rotation_ != 0 && rotation_ != 90 && rotation_ != 180 &&
      rotation_ != 270) {
    throw Napi::Error::New(env, "rotation must be 0, 90, 180, or 270");
  }

  // Parse optional flip (horizontal flip).
  flip_ = webcodecs::AttrAsBool(config, "flip", false);

  // Parse optional displayAspectWidth/displayAspectHeight (per W3C spec).
  display_aspect_width_ =
      webcodecs::AttrAsInt32(config, "displayAspectWidth", 0);
  display_aspect_height_ =
      webcodecs::AttrAsInt32(config, "displayAspectHeight", 0);

  // Parse optional colorSpace (per W3C spec).
  has_color_space_ = false;
  color_primaries_.clear();
  color_transfer_.clear();
  color_matrix_.clear();
  color_full_range_ = false;
  if (webcodecs::HasAttr(config, "colorSpace") &&
      config.Get("colorSpace").IsObject()) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    has_color_space_ = true;

    color_primaries_ = webcodecs::AttrAsStr(cs, "primaries");
    color_transfer_ = webcodecs::AttrAsStr(cs, "transfer");
    color_matrix_ = webcodecs::AttrAsStr(cs, "matrix");
    color_full_range_ = webcodecs::AttrAsBool(cs, "fullRange", false);
  }

  // Parse optional optimizeForLatency (per W3C spec).
  optimize_for_latency_ =
      webcodecs::AttrAsBool(config, "optimizeForLatency", false);

  // Parse optional hardwareAcceleration (per W3C spec).
  hardware_acceleration_ =
      webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");
  if (hardware_acceleration_ != "no-preference" &&
      hardware_acceleration_ != "prefer-hardware" &&
      hardware_acceleration_ != "prefer-software") {
    throw Napi::TypeError::New(
        env,
        "hardwareAcceleration must be 'no-preference', 'prefer-hardware', "
        "or 'prefer-software'");
  }

  // Handle optional description (extradata / SPS+PPS for H.264).
  auto [desc_data, desc_size] = webcodecs::AttrAsBuffer(config, "description");
  std::vector<uint8_t> extradata;
  if (desc_data != nullptr && desc_size > 0) {
    extradata.assign(desc_data, desc_data + desc_size);
  }

  // Create control queue and worker
  control_queue_ = std::make_unique<webcodecs::VideoControlQueue>();
  worker_ =
      std::make_unique<webcodecs::VideoDecoderWorker>(control_queue_.get());

  // Create TSFNs for callbacks
  auto frame_tsfn = FrameTSFN::TSFN::New(
      env, output_callback_.Value(), "VideoDecoderFrame", 0, 1);
  frame_tsfn_.Init(std::move(frame_tsfn));

  // Create a dummy function for flush TSFN since we use stored deferred
  // Note: We'll handle flush completion via a different mechanism
  auto flush_fn = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});
  auto flush_tsfn =
      FlushTSFN::TSFN::New(env, flush_fn, "VideoDecoderFlush", 0, 1);
  flush_tsfn_.Init(std::move(flush_tsfn));

  auto error_tsfn = ErrorTSFN::TSFN::New(env, error_callback_.Value(),
                                         "VideoDecoderError", 0, 1);
  error_tsfn_.Init(std::move(error_tsfn));

  auto dequeue_fn = Napi::Function::New(env, [](const Napi::CallbackInfo&) {});
  auto dequeue_tsfn =
      DequeueTSFN::TSFN::New(env, dequeue_fn, "VideoDecoderDequeue", 0, 1);
  dequeue_tsfn_.Init(std::move(dequeue_tsfn));

  // Setup worker callbacks
  SetupWorkerCallbacks(env);

  // Prepare decoder config
  webcodecs::VideoDecoderConfig decoder_config;
  decoder_config.codec_id = codec_id;
  decoder_config.coded_width = coded_width_;
  decoder_config.coded_height = coded_height_;
  decoder_config.extradata = std::move(extradata);
  decoder_config.optimize_for_latency = optimize_for_latency_;
  decoder_config.metadata.rotation = rotation_;
  decoder_config.metadata.flip = flip_;
  decoder_config.metadata.display_width = display_aspect_width_;
  decoder_config.metadata.display_height = display_aspect_height_;
  decoder_config.metadata.color_primaries = color_primaries_;
  decoder_config.metadata.color_transfer = color_transfer_;
  decoder_config.metadata.color_matrix = color_matrix_;
  decoder_config.metadata.color_full_range = color_full_range_;
  decoder_config.metadata.has_color_space = has_color_space_;

  worker_->SetConfig(decoder_config);

  // Start worker
  if (!worker_->Start()) {
    throw Napi::Error::New(env, "Failed to start decoder worker");
  }

  // Enqueue configure message
  webcodecs::VideoControlQueue::ConfigureMessage configure_msg;
  configure_msg.configure_fn = []() { return true; };

  if (!worker_->Enqueue(configure_msg)) {
    throw Napi::Error::New(env, "Failed to enqueue configure message");
  }

  state_ = "configured";
  key_chunk_required_ = true;

  return env.Undefined();
}

Napi::Value VideoDecoder::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
  if (control_queue_) {
    return Napi::Number::New(info.Env(), static_cast<int>(control_queue_->size()));
  }
  return Napi::Number::New(info.Env(), 0);
}

Napi::Value VideoDecoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
  if (control_queue_) {
    return Napi::Boolean::New(info.Env(),
                              control_queue_->size() >= kMaxQueueSize);
  }
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Value VideoDecoder::GetPendingFrames(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), pending_frames_.load());
}

Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
  }

  // Reject if queue is too large (prevents OOM).
  if (control_queue_ && control_queue_->size() >= kMaxHardQueueSize) {
    throw Napi::Error::New(
        env,
        "QuotaExceededError: Decode queue is full. You must handle "
        "backpressure by waiting for decodeQueueSize to decrease.");
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

  // Check key chunk requirement
  if (key_chunk_required_ && !is_key_frame) {
    // Per W3C spec, first chunk after configure/reset must be a key frame
    throw Napi::Error::New(
        env, "DataError: First chunk after configure/reset must be a key frame");
  }
  if (is_key_frame) {
    key_chunk_required_ = false;
  }

  // Create packet for decode message
  auto packet = ffmpeg::make_packet();
  if (!packet) {
    throw Napi::Error::New(env, "Failed to allocate packet");
  }

  // Allocate buffer and copy data
  int ret = av_new_packet(packet.get(), static_cast<int>(data_size));
  if (ret < 0) {
    throw Napi::Error::New(env, "Failed to allocate packet buffer");
  }
  memcpy(packet->data, data, data_size);
  packet->pts = timestamp;
  packet->dts = timestamp;
  if (is_key_frame) {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  // Enqueue decode message
  webcodecs::VideoControlQueue::DecodeMessage decode_msg;
  decode_msg.packet = std::move(packet);

  if (!control_queue_->Enqueue(std::move(decode_msg))) {
    throw Napi::Error::New(env, "Failed to enqueue decode message");
  }

  webcodecs::counterQueue++;

  return env.Undefined();
}

Napi::Value VideoDecoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Create promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

  if (state_ != "configured") {
    // Return resolved promise if not configured
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
  }

  // Generate promise ID and store deferred
  uint32_t promise_id = next_promise_id_++;

  // Enqueue flush message
  webcodecs::VideoControlQueue::FlushMessage flush_msg;
  flush_msg.promise_id = promise_id;

  // Store the deferred promise FIRST - before enqueue attempt
  pending_flushes_.emplace(promise_id, std::move(deferred));

  if (!control_queue_->Enqueue(std::move(flush_msg))) {
    // Reject immediately if we can't enqueue
    auto it = pending_flushes_.find(promise_id);
    if (it != pending_flushes_.end()) {
      napi_value promise = it->second.Promise();  // Get promise BEFORE erase
      it->second.Reject(
          Napi::Error::New(env, "Failed to enqueue flush message").Value());
      pending_flushes_.erase(it);
      return promise;  // Return the CORRECT promise
    }
    // Fallback (should never happen)
    Napi::Promise::Deferred fallback = Napi::Promise::Deferred::New(env);
    fallback.Reject(Napi::Error::New(env, "Internal error").Value());
    return fallback.Promise();
  }

  // Return the promise - it will be resolved/rejected by OnFlushCallback
  // when the worker signals flush completion via TSFN
  return pending_flushes_.at(promise_id).Promise();
}

Napi::Value VideoDecoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // W3C spec: reset() is a no-op when closed (don't throw)
  if (state_ == "closed") {
    return env.Undefined();
  }

  // Stop worker and clear queue
  if (worker_) {
    // Enqueue reset message to clear internal state (best-effort, ignore result)
    if (control_queue_) {
      webcodecs::VideoControlQueue::ResetMessage reset_msg;
      (void)control_queue_->Enqueue(std::move(reset_msg));
    }

    // Stop the worker
    worker_->Stop();
    worker_.reset();
  }

  // Shutdown and recreate control queue
  if (control_queue_) {
    control_queue_->Shutdown();
    control_queue_.reset();
  }

  // Release TSFNs
  frame_tsfn_.Release();
  flush_tsfn_.Release();
  error_tsfn_.Release();
  dequeue_tsfn_.Release();

  // Clear pending promises
  for (auto& [id, deferred] : pending_flushes_) {
    deferred.Reject(Napi::Error::New(env, "Decoder reset").Value());
  }
  pending_flushes_.clear();

  // Reset state
  state_ = "unconfigured";
  coded_width_ = 0;
  coded_height_ = 0;
  decode_queue_size_ = 0;
  pending_frames_.store(0);
  key_chunk_required_ = true;

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
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  if (codec.empty()) {
    supported = false;
  } else {
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
  if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
    int coded_width = config.Get("codedWidth").As<Napi::Number>().Int32Value();
    if (coded_width < 0 || coded_width > kMaxDimension) {
      supported = false;
    }
    normalized_config.Set("codedWidth", coded_width);
  }

  // Validate and copy codedHeight (optional per W3C spec).
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
  std::string hw =
      webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");
  if (hw != "no-preference" && hw != "prefer-hardware" &&
      hw != "prefer-software") {
    supported = false;
  }
  normalized_config.Set("hardwareAcceleration", hw);

  if (config.Has("optimizeForLatency") &&
      config.Get("optimizeForLatency").IsBoolean()) {
    normalized_config.Set("optimizeForLatency",
                          config.Get("optimizeForLatency"));
  }
  if (config.Has("rotation") && config.Get("rotation").IsNumber()) {
    int rotation = config.Get("rotation").As<Napi::Number>().Int32Value();
    if (rotation == 0 || rotation == 90 || rotation == 180 || rotation == 270) {
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
