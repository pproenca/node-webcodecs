// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef SRC_ENCODED_AUDIO_CHUNK_H_
#define SRC_ENCODED_AUDIO_CHUNK_H_

#include <napi.h>

#include <cstdint>
#include <string>
#include <vector>

class EncodedAudioChunk : public Napi::ObjectWrap<EncodedAudioChunk> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env, const std::string& type,
                                     int64_t timestamp, int64_t duration,
                                     const uint8_t* data, size_t size);
  explicit EncodedAudioChunk(const Napi::CallbackInfo& info);

  // Prevent copy and assignment.
  EncodedAudioChunk(const EncodedAudioChunk&) = delete;
  EncodedAudioChunk& operator=(const EncodedAudioChunk&) = delete;

  // Property getters.
  Napi::Value GetType(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
  Napi::Value GetDuration(const Napi::CallbackInfo& info);
  Napi::Value GetByteLength(const Napi::CallbackInfo& info);

  // Methods.
  void CopyTo(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);

  // Internal access.
  const std::vector<uint8_t>& GetData() const { return data_; }

 private:
  static Napi::FunctionReference constructor_;

  std::string type_;
  int64_t timestamp_;
  int64_t duration_;
  std::vector<uint8_t> data_;
  bool closed_ = false;
};

#endif  // SRC_ENCODED_AUDIO_CHUNK_H_
