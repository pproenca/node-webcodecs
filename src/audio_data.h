// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef SRC_AUDIO_DATA_H_
#define SRC_AUDIO_DATA_H_

#include <napi.h>

#include <cstdint>
#include <string>
#include <vector>

class AudioData : public Napi::ObjectWrap<AudioData> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env, const std::string& format,
                                     uint32_t sample_rate,
                                     uint32_t number_of_frames,
                                     uint32_t number_of_channels,
                                     int64_t timestamp, const uint8_t* data,
                                     size_t data_size);
  explicit AudioData(const Napi::CallbackInfo& info);
  ~AudioData();

  // Prevent copy and assignment.
  AudioData(const AudioData&) = delete;
  AudioData& operator=(const AudioData&) = delete;

  // Property getters.
  Napi::Value GetFormat(const Napi::CallbackInfo& info);
  Napi::Value GetSampleRate(const Napi::CallbackInfo& info);
  Napi::Value GetNumberOfFrames(const Napi::CallbackInfo& info);
  Napi::Value GetNumberOfChannels(const Napi::CallbackInfo& info);
  Napi::Value GetDuration(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);

  // Methods.
  Napi::Value AllocationSize(const Napi::CallbackInfo& info);
  void CopyTo(const Napi::CallbackInfo& info);
  Napi::Value Clone(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);

  // Internal access for encoder.
  const std::vector<uint8_t>& GetData() const { return data_; }
  bool IsClosed() const { return closed_; }

 private:
  static Napi::FunctionReference constructor_;

  // Helper to get bytes per sample for format.
  size_t GetBytesPerSample() const;
  bool IsPlanar() const;

  std::string format_;
  uint32_t sample_rate_;
  uint32_t number_of_frames_;
  uint32_t number_of_channels_;
  int64_t timestamp_;
  std::vector<uint8_t> data_;
  bool closed_;
};

#endif  // SRC_AUDIO_DATA_H_
