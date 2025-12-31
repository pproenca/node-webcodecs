// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include <napi.h>

#include "src/common.h"
#include "src/descriptors.h"
#include "src/error_builder.h"
#include "src/warnings.h"

// Forward declarations.
Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoDecoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports);
Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports);
Napi::Object InitAudioData(Napi::Env env, Napi::Object exports);
Napi::Object InitEncodedAudioChunk(Napi::Env env, Napi::Object exports);
Napi::Object InitAudioEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitAudioDecoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFilter(Napi::Env env, Napi::Object exports);
Napi::Object InitDemuxer(Napi::Env env, Napi::Object exports);
Napi::Object InitImageDecoder(Napi::Env env, Napi::Object exports);

// FFmpeg logging helper functions
Napi::Value GetFFmpegWarningsJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto warnings = webcodecs::GetFFmpegWarnings();

  Napi::Array result = Napi::Array::New(env, warnings.size());
  for (size_t i = 0; i < warnings.size(); ++i) {
    result.Set(i, Napi::String::New(env, warnings[i]));
  }
  return result;
}

void ClearFFmpegWarningsJS(const Napi::CallbackInfo& info) {
  webcodecs::ClearFFmpegWarnings();
}

// Test helper for AttrAsEnum template
Napi::Value TestAttrAsEnum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) return env.Null();

  Napi::Object obj = info[0].As<Napi::Object>();
  std::string attr = info[1].As<Napi::String>().Utf8Value();

  auto primaries = webcodecs::AttrAsEnum(obj, attr, AVCOL_PRI_BT709,
                                         webcodecs::kColorPrimariesMap);
  return Napi::String::New(env, webcodecs::ColorPrimariesToString(primaries));
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Thread-safe FFmpeg initialization
  webcodecs::InitFFmpeg();
  webcodecs::InitFFmpegLogging();

  InitVideoEncoder(env, exports);
  InitVideoDecoder(env, exports);
  InitVideoFrame(env, exports);
  InitEncodedVideoChunk(env, exports);
  InitAudioData(env, exports);
  InitEncodedAudioChunk(env, exports);
  InitAudioEncoder(env, exports);
  InitAudioDecoder(env, exports);
  InitVideoFilter(env, exports);
  InitDemuxer(env, exports);
  InitImageDecoder(env, exports);
  webcodecs::ErrorBuilder::Init(env, exports);
  webcodecs::WarningAccumulator::Init(env, exports);
  webcodecs::InitDescriptors(env, exports);

  // Export FFmpeg logging functions
  exports.Set("getFFmpegWarnings", Napi::Function::New(env, GetFFmpegWarningsJS));
  exports.Set("clearFFmpegWarnings", Napi::Function::New(env, ClearFFmpegWarningsJS));

  // Export test helpers
  exports.Set("testAttrAsEnum", Napi::Function::New(env, TestAttrAsEnum));

  return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
