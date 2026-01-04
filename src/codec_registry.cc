// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/codec_registry.h"

#include <algorithm>
#include <mutex>
#include <vector>

namespace webcodecs {

// STATIC DESTRUCTION ORDER FIX: Use heap-allocated "immortal" registry objects.
// Following the same pattern as counterVideoFrames in common.cc (line 32-82).
// We trade a tiny memory leak at exit for crash-free shutdown.
//
// Rationale:
// During process exit, static destructors may run in unpredictable order.
// Codec destructors call Unregister(), which accesses these vectors/mutexes.
// If vectors are destroyed before codecs, we get use-after-free crashes.
// Solution: Never destroy the vectors (heap-allocated, never freed).
//
// Memory cost: ~200 bytes per process (4 vectors + 4 mutexes)
// Safety gain: Zero crashes during shutdown

namespace {

//==============================================================================
// VideoEncoder Registry
//==============================================================================

std::vector<VideoEncoder*>& GetActiveVideoEncoders() {
  static auto* vec = new std::vector<VideoEncoder*>();
  return *vec;
}

std::mutex& GetVideoEncodersMutex() {
  static auto* mtx = new std::mutex();
  return *mtx;
}

//==============================================================================
// VideoDecoder Registry
//==============================================================================

std::vector<VideoDecoder*>& GetActiveVideoDecoders() {
  static auto* vec = new std::vector<VideoDecoder*>();
  return *vec;
}

std::mutex& GetVideoDecodersMutex() {
  static auto* mtx = new std::mutex();
  return *mtx;
}

//==============================================================================
// AudioEncoder Registry
//==============================================================================

std::vector<AudioEncoder*>& GetActiveAudioEncoders() {
  static auto* vec = new std::vector<AudioEncoder*>();
  return *vec;
}

std::mutex& GetAudioEncodersMutex() {
  static auto* mtx = new std::mutex();
  return *mtx;
}

//==============================================================================
// AudioDecoder Registry
//==============================================================================

std::vector<AudioDecoder*>& GetActiveAudioDecoders() {
  static auto* vec = new std::vector<AudioDecoder*>();
  return *vec;
}

std::mutex& GetAudioDecodersMutex() {
  static auto* mtx = new std::mutex();
  return *mtx;
}

}  // namespace

//==============================================================================
// VideoEncoder Registration
//==============================================================================

void RegisterVideoEncoder(VideoEncoder* codec) {
  std::lock_guard<std::mutex> lock(GetVideoEncodersMutex());
  GetActiveVideoEncoders().push_back(codec);
}

void UnregisterVideoEncoder(VideoEncoder* codec) {
  std::lock_guard<std::mutex> lock(GetVideoEncodersMutex());
  auto& vec = GetActiveVideoEncoders();
  vec.erase(std::remove(vec.begin(), vec.end(), codec), vec.end());
}

//==============================================================================
// VideoDecoder Registration
//==============================================================================

void RegisterVideoDecoder(VideoDecoder* codec) {
  std::lock_guard<std::mutex> lock(GetVideoDecodersMutex());
  GetActiveVideoDecoders().push_back(codec);
}

void UnregisterVideoDecoder(VideoDecoder* codec) {
  std::lock_guard<std::mutex> lock(GetVideoDecodersMutex());
  auto& vec = GetActiveVideoDecoders();
  vec.erase(std::remove(vec.begin(), vec.end(), codec), vec.end());
}

//==============================================================================
// AudioEncoder Registration
//==============================================================================

void RegisterAudioEncoder(AudioEncoder* codec) {
  std::lock_guard<std::mutex> lock(GetAudioEncodersMutex());
  GetActiveAudioEncoders().push_back(codec);
}

void UnregisterAudioEncoder(AudioEncoder* codec) {
  std::lock_guard<std::mutex> lock(GetAudioEncodersMutex());
  auto& vec = GetActiveAudioEncoders();
  vec.erase(std::remove(vec.begin(), vec.end(), codec), vec.end());
}

//==============================================================================
// AudioDecoder Registration
//==============================================================================

void RegisterAudioDecoder(AudioDecoder* codec) {
  std::lock_guard<std::mutex> lock(GetAudioDecodersMutex());
  GetActiveAudioDecoders().push_back(codec);
}

void UnregisterAudioDecoder(AudioDecoder* codec) {
  std::lock_guard<std::mutex> lock(GetAudioDecodersMutex());
  auto& vec = GetActiveAudioDecoders();
  vec.erase(std::remove(vec.begin(), vec.end(), codec), vec.end());
}

//==============================================================================
// Cleanup Hook
//==============================================================================

void CleanupAllCodecs(void* arg) {
  // CRITICAL N-API LIMITATION:
  //
  // This function runs during N-API environment teardown, BEFORE static
  // destructors. However, per N-API specification, cleanup hooks do NOT
  // receive napi_env as a parameter (only opaque void* hint).
  //
  // This means we CANNOT reject pending promises here, as promise rejection
  // requires valid napi_env to create Error objects and call napi_reject_deferred().
  //
  // Alternatives explored and rejected:
  // 1. napi_set_instance_data + finalize callback
  //    - Finalizer also doesn't receive env (only node_api_basic_env)
  //    - Cannot execute JavaScript or manipulate promises
  //
  // 2. Store napi_env in global variable
  //    - Undefined behavior per N-API spec
  //    - Env becomes invalid when addon unloads
  //    - Passing env between workers is forbidden
  //
  // 3. Use TSFN (ThreadSafeFunction) for cleanup
  //    - Creating TSFN requires valid env
  //    - Cannot create TSFN during teardown (env already invalidating)
  //
  // 4. Use node_api_post_finalizer
  //    - Only available in basic finalizers, not cleanup hooks
  //    - Still doesn't provide full env access
  //
  // DECISION: Accept promise orphaning during ABNORMAL shutdown only.
  //
  // This is acceptable because:
  // - W3C WebCodecs spec does not define behavior for environment teardown
  // - Normal shutdown (await codec.close()) works correctly via TSFN callbacks
  // - Abnormal shutdown (process.exit, worker termination) is edge case
  // - Promises are garbage collected along with environment
  //
  // References:
  // - N-API lifecycle: https://nodejs.org/api/n-api.html#environment-life-cycle-apis
  // - Related issue: https://github.com/nodejs/node-addon-api/issues/914
  // - Audit doc: docs/plans/2025-01-04-node-api-audit.md (P0-2, P0-5)

  (void)arg;  // Unused parameter

  // Clear all registries to prevent use-after-free if cleanup runs late.
  // This ensures worker threads won't access destroyed codec objects.
  {
    std::lock_guard<std::mutex> lock(GetVideoEncodersMutex());
    GetActiveVideoEncoders().clear();
  }
  {
    std::lock_guard<std::mutex> lock(GetVideoDecodersMutex());
    GetActiveVideoDecoders().clear();
  }
  {
    std::lock_guard<std::mutex> lock(GetAudioEncodersMutex());
    GetActiveAudioEncoders().clear();
  }
  {
    std::lock_guard<std::mutex> lock(GetAudioDecodersMutex());
    GetActiveAudioDecoders().clear();
  }

  // NOTE: Pending flush() promises remain unresolved during abnormal shutdown.
  // This is the documented limitation of this implementation due to N-API
  // not providing napi_env in cleanup hooks.
}

}  // namespace webcodecs
