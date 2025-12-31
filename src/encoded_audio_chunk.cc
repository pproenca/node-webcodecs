// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "src/encoded_audio_chunk.h"

#include <cstring>
#include <string>

#include "src/common.h"

Napi::FunctionReference EncodedAudioChunk::constructor_;

Napi::Object InitEncodedAudioChunk(Napi::Env env, Napi::Object exports) {
  return EncodedAudioChunk::Init(env, exports);
}

Napi::Object EncodedAudioChunk::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "EncodedAudioChunk",
      {
          InstanceAccessor("type", &EncodedAudioChunk::GetType, nullptr),
          InstanceAccessor("timestamp", &EncodedAudioChunk::GetTimestamp,
                           nullptr),
          InstanceAccessor("duration", &EncodedAudioChunk::GetDuration,
                           nullptr),
          InstanceAccessor("byteLength", &EncodedAudioChunk::GetByteLength,
                           nullptr),
          InstanceMethod("copyTo", &EncodedAudioChunk::CopyTo),
          InstanceMethod("close", &EncodedAudioChunk::Close),
      });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("EncodedAudioChunk", func);
  return exports;
}

Napi::Object EncodedAudioChunk::CreateInstance(
    Napi::Env env, const std::string& type, int64_t timestamp, int64_t duration,
    const uint8_t* data, size_t size) {
  Napi::Object init = Napi::Object::New(env);
  init.Set("type", type);
  init.Set("timestamp", Napi::Number::New(env, static_cast<double>(timestamp)));
  init.Set("duration", Napi::Number::New(env, static_cast<double>(duration)));
  init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, size));
  return constructor_.New({init});
}

EncodedAudioChunk::EncodedAudioChunk(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EncodedAudioChunk>(info), timestamp_(0), duration_(0) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "EncodedAudioChunk requires init object")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Required: type.
  if (!webcodecs::HasAttr(init, "type") || !init.Get("type").IsString()) {
    Napi::TypeError::New(env, "init.type must be 'key' or 'delta'")
        .ThrowAsJavaScriptException();
    return;
  }
  type_ = webcodecs::AttrAsStr(init, "type");
  if (type_ != "key" && type_ != "delta") {
    Napi::TypeError::New(env, "init.type must be 'key' or 'delta'")
        .ThrowAsJavaScriptException();
    return;
  }

  // Required: timestamp.
  if (!webcodecs::HasAttr(init, "timestamp") ||
      !init.Get("timestamp").IsNumber()) {
    Napi::TypeError::New(env, "init.timestamp must be a number")
        .ThrowAsJavaScriptException();
    return;
  }
  timestamp_ = webcodecs::AttrAsInt64(init, "timestamp");

  // Optional: duration.
  if (webcodecs::HasAttr(init, "duration") && init.Get("duration").IsNumber()) {
    duration_ = webcodecs::AttrAsInt64(init, "duration");
  }

  // Required: data.
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "init.data is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_val = init.Get("data");
  if (data_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_val.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = data_val.As<Napi::ArrayBuffer>();
    data_.assign(static_cast<uint8_t*>(ab.Data()),
                 static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
  } else if (data_val.IsTypedArray()) {
    Napi::TypedArray ta = data_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    size_t offset = ta.ByteOffset();
    size_t length = ta.ByteLength();
    data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                 static_cast<uint8_t*>(ab.Data()) + offset + length);
  } else {
    Napi::TypeError::New(env, "init.data must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
  }
}

Napi::Value EncodedAudioChunk::GetType(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), type_);
}

Napi::Value EncodedAudioChunk::GetTimestamp(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(timestamp_));
}

Napi::Value EncodedAudioChunk::GetDuration(const Napi::CallbackInfo& info) {
  if (duration_ == 0) {
    return info.Env().Null();
  }
  return Napi::Number::New(info.Env(), static_cast<double>(duration_));
}

Napi::Value EncodedAudioChunk::GetByteLength(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(data_.size()));
}

void EncodedAudioChunk::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "copyTo requires destination buffer")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value dest_val = info[0];
  uint8_t* dest_data = nullptr;
  size_t dest_size = 0;

  if (dest_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = dest_val.As<Napi::Buffer<uint8_t>>();
    dest_data = buf.Data();
    dest_size = buf.Length();
  } else if (dest_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = dest_val.As<Napi::ArrayBuffer>();
    dest_data = static_cast<uint8_t*>(ab.Data());
    dest_size = ab.ByteLength();
  } else if (dest_val.IsTypedArray()) {
    Napi::TypedArray ta = dest_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    dest_data = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
    dest_size = ta.ByteLength();
  } else {
    Napi::TypeError::New(env, "destination must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
  }

  if (dest_size < data_.size()) {
    Napi::TypeError::New(env, "destination buffer too small")
        .ThrowAsJavaScriptException();
    return;
  }

  std::memcpy(dest_data, data_.data(), data_.size());
}

void EncodedAudioChunk::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    // clear() + shrink_to_fit() actually releases memory.
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
