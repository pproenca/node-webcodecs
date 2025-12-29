// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "encoded_video_chunk.h"

#include <cstring>

Napi::FunctionReference EncodedVideoChunk::constructor;

Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports) {
  return EncodedVideoChunk::Init(env, exports);
}

Napi::Object EncodedVideoChunk::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "EncodedVideoChunk",
      {
          InstanceAccessor("type", &EncodedVideoChunk::GetType, nullptr),
          InstanceAccessor("timestamp", &EncodedVideoChunk::GetTimestamp,
                           nullptr),
          InstanceAccessor("duration", &EncodedVideoChunk::GetDuration,
                           nullptr),
          InstanceAccessor("byteLength", &EncodedVideoChunk::GetByteLength,
                           nullptr),
          InstanceMethod("copyTo", &EncodedVideoChunk::CopyTo),
          InstanceMethod("close", &EncodedVideoChunk::Close),
      });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("EncodedVideoChunk", func);
  return exports;
}

Napi::Object EncodedVideoChunk::CreateInstance(Napi::Env env,
                                               const std::string& type,
                                               int64_t timestamp,
                                               int64_t duration,
                                               const uint8_t* data,
                                               size_t size) {
  Napi::Object init = Napi::Object::New(env);
  init.Set("type", type);
  init.Set("timestamp", Napi::Number::New(env, timestamp));
  init.Set("duration", Napi::Number::New(env, duration));
  init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, size));
  return constructor.New({init});
}

EncodedVideoChunk::EncodedVideoChunk(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EncodedVideoChunk>(info),
      has_duration_(false),
      duration_(0),
      closed_(false) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::TypeError::New(env, "EncodedVideoChunk requires init object");
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Required: type.
  if (!init.Has("type") || !init.Get("type").IsString()) {
    throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
  }
  type_ = init.Get("type").As<Napi::String>().Utf8Value();
  if (type_ != "key" && type_ != "delta") {
    throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
  }

  // Required: timestamp.
  if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
    throw Napi::TypeError::New(env, "init.timestamp must be a number");
  }
  timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

  // Optional: duration.
  if (init.Has("duration") && init.Get("duration").IsNumber()) {
    duration_ = init.Get("duration").As<Napi::Number>().Int64Value();
    has_duration_ = true;
  }

  // Required: data.
  if (!init.Has("data")) {
    throw Napi::TypeError::New(env, "init.data is required");
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
    throw Napi::TypeError::New(env, "init.data must be BufferSource");
  }
}

Napi::Value EncodedVideoChunk::GetType(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), type_);
}

Napi::Value EncodedVideoChunk::GetTimestamp(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value EncodedVideoChunk::GetDuration(const Napi::CallbackInfo& info) {
  if (!has_duration_) {
    return info.Env().Null();
  }
  return Napi::Number::New(info.Env(), duration_);
}

Napi::Value EncodedVideoChunk::GetByteLength(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(data_.size()));
}

void EncodedVideoChunk::CopyTo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    throw Napi::TypeError::New(env, "copyTo requires destination buffer");
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
    throw Napi::TypeError::New(env, "destination must be BufferSource");
  }

  if (dest_size < data_.size()) {
    throw Napi::TypeError::New(env, "destination buffer too small");
  }

  std::memcpy(dest_data, data_.data(), data_.size());
}

void EncodedVideoChunk::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    // clear() + shrink_to_fit() actually releases memory.
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
