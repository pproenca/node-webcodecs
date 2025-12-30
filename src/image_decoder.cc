// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// ImageDecoder implementation wrapping FFmpeg image decoders.

#include "image_decoder.h"
#include "video_frame.h"

#include <algorithm>

Napi::Object ImageDecoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "ImageDecoder", {
    InstanceMethod("decode", &ImageDecoder::Decode),
    InstanceMethod("close", &ImageDecoder::Close),
    InstanceAccessor("type", &ImageDecoder::GetType, nullptr),
    InstanceAccessor("complete", &ImageDecoder::GetComplete, nullptr),
    InstanceAccessor("tracks", &ImageDecoder::GetTracks, nullptr),
    StaticMethod("isTypeSupported", &ImageDecoder::IsTypeSupported),
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("ImageDecoder", func);
  return exports;
}

ImageDecoder::ImageDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ImageDecoder>(info),
      codec_(nullptr),
      codec_context_(nullptr),
      sws_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      decoded_width_(0),
      decoded_height_(0),
      complete_(false),
      closed_(false) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "ImageDecoder init object is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Get type (MIME type)
  if (!init.Has("type") || !init.Get("type").IsString()) {
    Napi::TypeError::New(env, "type is required and must be a string")
        .ThrowAsJavaScriptException();
    return;
  }
  type_ = init.Get("type").As<Napi::String>().Utf8Value();

  // Get data
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "data is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_value = init.Get("data");
  if (data_value.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_value.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_value.IsTypedArray()) {
    Napi::TypedArray typed_array = data_value.As<Napi::TypedArray>();
    Napi::ArrayBuffer array_buffer = typed_array.ArrayBuffer();
    size_t offset = typed_array.ByteOffset();
    size_t length = typed_array.ByteLength();
    uint8_t* data_ptr = static_cast<uint8_t*>(array_buffer.Data()) + offset;
    data_.assign(data_ptr, data_ptr + length);
  } else {
    Napi::TypeError::New(env, "data must be Buffer or TypedArray")
        .ThrowAsJavaScriptException();
    return;
  }

  // Map MIME type to FFmpeg codec
  AVCodecID codec_id = MimeTypeToCodecId(type_);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::TypeError::New(env, "Unsupported image type: " + type_)
        .ThrowAsJavaScriptException();
    return;
  }

  // Find decoder
  codec_ = avcodec_find_decoder(codec_id);
  if (!codec_) {
    Napi::Error::New(env, "Decoder not found for: " + type_)
        .ThrowAsJavaScriptException();
    return;
  }

  // Create codec context
  codec_context_ = avcodec_alloc_context3(codec_);
  if (!codec_context_) {
    Napi::Error::New(env, "Failed to allocate codec context")
        .ThrowAsJavaScriptException();
    return;
  }

  // Open codec
  if (avcodec_open2(codec_context_, codec_, nullptr) < 0) {
    Cleanup();
    Napi::Error::New(env, "Failed to open codec")
        .ThrowAsJavaScriptException();
    return;
  }

  // Allocate frame and packet
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
  if (!frame_ || !packet_) {
    Cleanup();
    Napi::Error::New(env, "Failed to allocate frame/packet")
        .ThrowAsJavaScriptException();
    return;
  }

  // Pre-decode the image to get metadata
  if (DecodeImage()) {
    complete_ = true;
  }
}

ImageDecoder::~ImageDecoder() {
  Cleanup();
}

void ImageDecoder::Cleanup() {
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  if (frame_) {
    av_frame_free(&frame_);
    frame_ = nullptr;
  }
  if (packet_) {
    av_packet_free(&packet_);
    packet_ = nullptr;
  }
  if (codec_context_) {
    avcodec_free_context(&codec_context_);
    codec_context_ = nullptr;
  }
}

AVCodecID ImageDecoder::MimeTypeToCodecId(const std::string& mime_type) {
  if (mime_type == "image/png") {
    return AV_CODEC_ID_PNG;
  } else if (mime_type == "image/jpeg" || mime_type == "image/jpg") {
    return AV_CODEC_ID_MJPEG;
  } else if (mime_type == "image/gif") {
    return AV_CODEC_ID_GIF;
  } else if (mime_type == "image/webp") {
    return AV_CODEC_ID_WEBP;
  } else if (mime_type == "image/bmp") {
    return AV_CODEC_ID_BMP;
  } else if (mime_type == "image/tiff") {
    return AV_CODEC_ID_TIFF;
  }
  return AV_CODEC_ID_NONE;
}

bool ImageDecoder::DecodeImage() {
  if (!codec_context_ || !frame_ || !packet_ || data_.empty()) {
    return false;
  }

  // Set packet data
  packet_->data = data_.data();
  packet_->size = static_cast<int>(data_.size());

  // Send packet to decoder
  int ret = avcodec_send_packet(codec_context_, packet_);
  if (ret < 0) {
    return false;
  }

  // Receive decoded frame
  ret = avcodec_receive_frame(codec_context_, frame_);
  if (ret < 0) {
    return false;
  }

  decoded_width_ = frame_->width;
  decoded_height_ = frame_->height;

  // Convert to RGBA
  sws_context_ = sws_getContext(
      frame_->width, frame_->height, static_cast<AVPixelFormat>(frame_->format),
      frame_->width, frame_->height, AV_PIX_FMT_RGBA,
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  if (!sws_context_) {
    return false;
  }

  // Allocate output buffer
  int output_size = av_image_get_buffer_size(
      AV_PIX_FMT_RGBA, frame_->width, frame_->height, 1);
  decoded_data_.resize(output_size);

  // Set up output planes
  uint8_t* dest_data[4] = {decoded_data_.data(), nullptr, nullptr, nullptr};
  int dest_linesize[4] = {frame_->width * 4, 0, 0, 0};

  // Convert
  sws_scale(sws_context_,
            frame_->data, frame_->linesize,
            0, frame_->height,
            dest_data, dest_linesize);

  return true;
}

Napi::Value ImageDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "ImageDecoder is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (!complete_) {
    Napi::Error::New(env, "Image decoding failed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create a deferred promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

  // Create VideoFrame from decoded data
  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
      env, decoded_data_.data(), decoded_data_.size());

  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", Napi::Number::New(env, decoded_width_));
  init.Set("codedHeight", Napi::Number::New(env, decoded_height_));
  init.Set("timestamp", Napi::Number::New(env, 0));
  init.Set("format", Napi::String::New(env, "RGBA"));

  // Get VideoFrame constructor from global
  Napi::Function video_frame_ctor = env.Global()
      .Get("__nodeWebCodecsVideoFrame__")
      .As<Napi::Function>();

  if (video_frame_ctor.IsUndefined() || !video_frame_ctor.IsFunction()) {
    // Try to get from module exports directly
    // For now, create result without VideoFrame wrapper
    Napi::Object result = Napi::Object::New(env);
    Napi::Object image = Napi::Object::New(env);
    image.Set("codedWidth", Napi::Number::New(env, decoded_width_));
    image.Set("codedHeight", Napi::Number::New(env, decoded_height_));
    image.Set("timestamp", Napi::Number::New(env, 0));
    image.Set("format", Napi::String::New(env, "RGBA"));
    image.Set("data", buffer);
    image.Set("close", Napi::Function::New(env, [](const Napi::CallbackInfo&) {}));
    result.Set("image", image);
    result.Set("complete", Napi::Boolean::New(env, complete_));

    deferred.Resolve(result);
    return deferred.Promise();
  }

  // Create VideoFrame instance
  Napi::Object frame = video_frame_ctor.New({buffer, init}).As<Napi::Object>();

  // Create result object
  Napi::Object result = Napi::Object::New(env);
  result.Set("image", frame);
  result.Set("complete", Napi::Boolean::New(env, complete_));

  deferred.Resolve(result);
  return deferred.Promise();
}

void ImageDecoder::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    Cleanup();
    closed_ = true;
  }
}

Napi::Value ImageDecoder::GetType(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), type_);
}

Napi::Value ImageDecoder::GetComplete(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), complete_);
}

Napi::Value ImageDecoder::GetTracks(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Create tracks array with one track (images are single-track)
  Napi::Array tracks = Napi::Array::New(env, 1);

  Napi::Object track = Napi::Object::New(env);
  track.Set("selected", Napi::Boolean::New(env, true));
  track.Set("animated", Napi::Boolean::New(env, false));
  track.Set("frameCount", Napi::Number::New(env, 1));
  track.Set("repetitionCount", Napi::Number::New(env, 0));

  if (complete_) {
    Napi::Object selectedTrack = Napi::Object::New(env);
    selectedTrack.Set("width", Napi::Number::New(env, decoded_width_));
    selectedTrack.Set("height", Napi::Number::New(env, decoded_height_));
    track.Set("track", selectedTrack);
  }

  tracks.Set((uint32_t)0, track);

  return tracks;
}

Napi::Value ImageDecoder::IsTypeSupported(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    return Napi::Boolean::New(env, false);
  }

  std::string mime_type = info[0].As<Napi::String>().Utf8Value();
  AVCodecID codec_id = MimeTypeToCodecId(mime_type);

  if (codec_id == AV_CODEC_ID_NONE) {
    return Napi::Boolean::New(env, false);
  }

  // Check if codec is available
  const AVCodec* codec = avcodec_find_decoder(codec_id);
  return Napi::Boolean::New(env, codec != nullptr);
}

Napi::Object InitImageDecoder(Napi::Env env, Napi::Object exports) {
  return ImageDecoder::Init(env, exports);
}
