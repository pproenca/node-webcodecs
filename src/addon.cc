// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include <napi.h>

#include <string>

#include "src/codec_registry.h"
#include "src/common.h"
#include "src/descriptors.h"
#include "src/error_builder.h"
#include "src/test_video_generator.h"
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
Napi::Object InitMuxer(Napi::Env env, Napi::Object exports);
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

// Counter accessor functions (following sharp pattern for observability)
Napi::Value GetCounterQueueJS(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), webcodecs::counterQueue.load());
}

Napi::Value GetCounterProcessJS(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), webcodecs::counterProcess.load());
}

Napi::Value GetCounterFramesJS(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), webcodecs::counterFrames.load());
}

Napi::Value GetCountersJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object counters = Napi::Object::New(env);

  // New per-class counters
  counters.Set("videoFrames",
               static_cast<double>(webcodecs::counterVideoFrames.load()));
  counters.Set("audioData",
               static_cast<double>(webcodecs::counterAudioData.load()));
  counters.Set("videoEncoders",
               static_cast<double>(webcodecs::counterVideoEncoders.load()));
  counters.Set("videoDecoders",
               static_cast<double>(webcodecs::counterVideoDecoders.load()));
  counters.Set("audioEncoders",
               static_cast<double>(webcodecs::counterAudioEncoders.load()));
  counters.Set("audioDecoders",
               static_cast<double>(webcodecs::counterAudioDecoders.load()));

  // Legacy counters (for backwards compatibility)
  counters.Set("queue", webcodecs::counterQueue.load());
  counters.Set("process", webcodecs::counterProcess.load());
  counters.Set("frames", webcodecs::counterFrames.load());

  return counters;
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

// Cleanup hook for codec registry (called BEFORE FFmpeg logging cleanup).
// Clears codec registries to prevent use-after-free during environment teardown.
// Note: Cannot reject pending promises here - N-API limitation (no env provided).
static void CodecCleanupCallback(void* arg) {
  webcodecs::CleanupAllCodecs(arg);
}

// Cleanup hook called when the Node.js environment is being torn down.
// This prevents the static destruction order fiasco where FFmpeg's log
// callback might access destroyed static objects during process exit.
static void CleanupCallback(void* arg) {
  webcodecs::ShutdownFFmpegLogging();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Thread-safe FFmpeg initialization
  webcodecs::InitFFmpeg();
  webcodecs::InitFFmpegLogging();

  // Register cleanup hooks in reverse order of desired execution (LIFO):
  // 1. Register FFmpeg logging cleanup FIRST (executes LAST)
  napi_add_env_cleanup_hook(env, CleanupCallback, nullptr);

  // 2. Register codec cleanup SECOND (executes FIRST, before FFmpeg shutdown)
  //    This clears codec registries to prevent use-after-free during teardown.
  napi_add_env_cleanup_hook(env, CodecCleanupCallback, nullptr);

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
  InitMuxer(env, exports);
  InitImageDecoder(env, exports);
  InitTestVideoGenerator(env, exports);
  webcodecs::ErrorBuilder::Init(env, exports);
  webcodecs::WarningAccumulator::Init(env, exports);
  webcodecs::InitDescriptors(env, exports);

  // Export FFmpeg logging functions
  exports.Set("getFFmpegWarnings",
              Napi::Function::New(env, GetFFmpegWarningsJS));
  exports.Set("clearFFmpegWarnings",
              Napi::Function::New(env, ClearFFmpegWarningsJS));

  // Export global counter functions (following sharp pattern for observability)
  exports.Set("getCounterQueue", Napi::Function::New(env, GetCounterQueueJS));
  exports.Set("getCounterProcess",
              Napi::Function::New(env, GetCounterProcessJS));
  exports.Set("getCounterFrames", Napi::Function::New(env, GetCounterFramesJS));
  exports.Set("getCounters", Napi::Function::New(env, GetCountersJS));

  // Export test helpers
  exports.Set("testAttrAsEnum", Napi::Function::New(env, TestAttrAsEnum));

  return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
