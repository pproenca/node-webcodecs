// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Global Codec Registry for Environment Cleanup
//
// Maintains weak references to all active codec instances to enable graceful
// cleanup during N-API environment teardown. Prevents worker threads from
// accessing destroyed environments during abnormal shutdown (process.exit()).
//
// Thread Safety:
// - All operations are mutex-protected per codec type
// - No lock ordering issues (independent mutexes)
//
// CRITICAL LIMITATION:
// - Cannot reject pending promises in cleanup hook (N-API provides no env)
// - Promises orphaned during abnormal shutdown (acceptable per W3C spec)
// - Normal shutdown (close() + await flush()) works correctly
//
// Background:
// Per N-API specification, cleanup hooks receive void* hint but NOT napi_env.
// Without valid napi_env, we cannot call napi_reject_deferred() to reject
// promises. This is a fundamental N-API limitation, not a design flaw.
//
// See: https://nodejs.org/api/n-api.html#napi_add_env_cleanup_hook
// See: docs/plans/2025-01-04-node-api-audit.md (P0-2, P0-5)

#ifndef SRC_CODEC_REGISTRY_H_
#define SRC_CODEC_REGISTRY_H_

// Forward declarations (avoid circular includes)
// Note: Codec classes are in global namespace, not webcodecs::
class VideoEncoder;
class VideoDecoder;
class AudioEncoder;
class AudioDecoder;

namespace webcodecs {

//==============================================================================
// Registration API (called from codec constructors/destructors)
//==============================================================================

void RegisterVideoEncoder(VideoEncoder* codec);
void UnregisterVideoEncoder(VideoEncoder* codec);

void RegisterVideoDecoder(VideoDecoder* codec);
void UnregisterVideoDecoder(VideoDecoder* codec);

void RegisterAudioEncoder(AudioEncoder* codec);
void UnregisterAudioEncoder(AudioEncoder* codec);

void RegisterAudioDecoder(AudioDecoder* codec);
void UnregisterAudioDecoder(AudioDecoder* codec);

//==============================================================================
// Cleanup Hook (called from napi_add_env_cleanup_hook)
//==============================================================================

/**
 * Cleanup all codec registries during environment teardown.
 *
 * IMPORTANT: This function CANNOT reject pending promises because N-API
 * cleanup hooks do not provide napi_env as a parameter. This is a documented
 * N-API limitation, not a bug in our implementation.
 *
 * What this function does:
 * - Clears all codec registries to prevent use-after-free
 * - Ensures worker threads won't access destroyed codec objects
 *
 * What this function CANNOT do:
 * - Reject pending flush() promises (no napi_env available)
 * - Promises will be orphaned during abnormal shutdown (process.exit())
 *
 * This is acceptable per W3C WebCodecs specification, which does not define
 * behavior for environment teardown scenarios. Normal shutdown via close()
 * and await flush() works correctly through TSFN callbacks.
 *
 * @param arg User data (unused, pass nullptr)
 */
void CleanupAllCodecs(void* arg);

}  // namespace webcodecs

#endif  // SRC_CODEC_REGISTRY_H_
