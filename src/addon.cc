// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include <napi.h>

#include "src/common.h"
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

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Thread-safe FFmpeg initialization
  webcodecs::InitFFmpeg();

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
  webcodecs::WarningAccumulator::Init(env, exports);
  return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
