# WebCodecs Compliance Matrix (node-webcodecs)

Last updated: 2025-01-03

Status legend:
- Implemented: Spec requirement is present and mapped to code/tests.
- Partial: Some behavior present; missing or divergent details are listed.
- Missing: No known implementation; needs work.

This matrix maps the repository's spec sources in `docs/specs/` to the current
TypeScript and native implementations. Each entry calls out the relevant code
paths and any gaps to be addressed for 100% compliance.

## 1. Definitions

Source: `docs/specs/1-definitions.md`
- Status: Informational definitions only. No direct implementation mapping.

## 2. Codec Processing Model

Source: `docs/specs/2-codec-processing-model/2.2-control-messages.md`
- Status: Partial
- Implementation:
  - `lib/control-message-queue.ts`
  - `lib/codec-base.ts`
  - `lib/video-encoder.ts`, `lib/video-decoder.ts`, `lib/audio-encoder.ts`, `lib/audio-decoder.ts`
- Gaps:
  - No explicit [[message queue blocked]] semantics or "not processed" return.
  - Control messages are not used to gate all configure/encode/decode/flush paths;
    TS layer often calls native directly.
  - Backpressure/saturation handling does not block control queue processing.

Source: `docs/specs/2-codec-processing-model/2.3-codec-work-parallel-queue.md`
- Status: Partial
- Implementation:
  - Native workers: `src/async_encode_worker.*`, `src/async_decode_worker.*`
  - TS callbacks: `lib/*-encoder.ts`, `lib/*-decoder.ts`
- Gaps:
  - No explicit "codec task source" or task-queue separation in TS layer.
  - Work queue semantics are not modeled in TS control message queue.

## 3. AudioDecoder Interface

Source: `docs/specs/3-audiodecoder-interface/*`
- Status: Partial
- Implementation:
  - TS: `lib/audio-decoder.ts`
  - Native: `src/audio_decoder.cc`, `src/audio_decoder.h`
- Notes/Gaps:
  - Control message queue semantics not applied to configure/decode/flush.
  - decode queue size increments at submit but does not strictly follow spec
    decrement/schedule-dequeue algorithm.
  - Key-chunk required behavior is enforced in TS, but native does not verify
    bitstream keyness.
  - Error handling uses DOMException types in TS; native throws generic errors.

## 4. VideoDecoder Interface

Source: `docs/specs/4-videodecoder-interface/*`
- Status: Partial
- Implementation:
  - TS: `lib/video-decoder.ts`
  - Native: `src/video_decoder.cc`, `src/async_decode_worker.*`
- Notes/Gaps:
  - Control message queue semantics not applied to configure/decode/flush.
  - [[decodeQueueSize]] decrement timing does not match spec control message step.
  - decode() key-chunk required check is in TS; native does not verify bitstream keyness.
  - Output VideoFrames colorSpace detection is not derived from bitstream; only
    config override is applied.

## 5. AudioEncoder Interface

Source: `docs/specs/5-audioencoder-interface/*`
- Status: Partial
- Implementation:
  - TS: `lib/audio-encoder.ts`
  - Native: `src/audio_encoder.cc`, `src/audio_encoder.h`
- Notes/Gaps:
  - Control message queue semantics not applied to configure/encode/flush.
  - [[encodeQueueSize]] decrement/schedule-dequeue does not follow spec
    control message steps.
  - Error handling does not explicitly close encoder with EncodingError on failure.

## 6. VideoEncoder Interface

Source: `docs/specs/6-videoencoder-interface/*`
- Status: Partial
- Implementation:
  - TS: `lib/video-encoder.ts`
  - Native: `src/video_encoder.cc`, `src/async_encode_worker.*`
- Notes/Gaps:
  - Control message queue semantics not applied to configure/encode/flush.
  - [[encodeQueueSize]] decrement/schedule-dequeue does not follow spec
    control message steps.
  - Output EncodedVideoChunk metadata does not track "active output config"
    equivalence; `decoderConfig` is emitted on every keyframe.
  - Rotation/flip fields are not included in decoderConfig in native output.
  - Alpha side data is not emitted when `alpha="keep"`.

## 7. Configurations

Source: `docs/specs/7-configurations/*`
- Status: Partial
- Implementation:
  - TS validation: `lib/*-encoder.ts`, `lib/*-decoder.ts`, `lib/video-frame.ts`
  - Native checks: `src/video_encoder.cc`, `src/video_decoder.cc`,
    `src/audio_encoder.cc`, `src/audio_decoder.cc`
- Notes/Gaps:
  - Validity checks for required pairs (displayWidth/Height, codedWidth/Height)
    are partially implemented.
  - Configuration equivalence (7.12) is not tracked or enforced in output metadata.
  - Codec string parsing and codec registry rules are incomplete for some codecs.

## 8. Encoded Media Interfaces (Chunks)

Source: `docs/specs/8-encoded-media-interfaces-chunks/*`
- Status: Partial
- Implementation:
  - TS: `lib/encoded-chunks.ts`
  - Native: `src/encoded_audio_chunk.*`, `src/encoded_video_chunk.*`
- Notes/Gaps:
  - Serialization/transfer requirements need explicit verification vs spec.
  - `close()` behavior is implemented, but timing with GC and detachment needs
    cross-checking with spec serialization rules.

## 9. Raw Media Interfaces

Source: `docs/specs/9-raw-media-interfaces/*`
- Status: Partial
- Implementation:
  - TS: `lib/audio-data.ts`, `lib/video-frame.ts`, `lib/types.ts`
  - Native: `src/audio_data.*`, `src/video_frame.*`, `src/descriptors.*`
- Notes/Gaps:
  - Full memory model/transfer/serialization behavior needs verification.
  - VideoFrame visibleRect/codedRect/display sizing behavior needs
    per-algorithm cross-check with spec 9.4.6.
  - VideoColorSpace detection/override behavior is config-driven only.

## 10. Image Decoding

Source: `docs/specs/10-image-decoding/*`
- Status: Partial
- Implementation:
  - TS: `lib/image-decoder.ts`, `lib/image-track.ts`, `lib/image-track-list.ts`
  - Native: `src/image_decoder.*`
- Notes/Gaps:
  - Streaming decode uses buffering; needs compliance check for incremental
    decode semantics and track readiness algorithms.
  - ImageDecodeOptions defaults and color space conversion rules need
    algorithm-by-algorithm verification.

## 11. Resource Reclamation

Source: `docs/specs/11-resource-reclamation.md`
- Status: Partial
- Implementation:
  - TS: `lib/resource-manager.ts`
- Notes/Gaps:
  - Reclamation uses explicit `reclaimInactive()`; spec implies UA-driven behavior.
  - Background state is manual; no connection to actual Document.hidden.

## 12. Security Considerations

Source: `docs/specs/12-security-considerations.md`
- Status: Informational; no direct implementation mapping.

## 13. Privacy Considerations

Source: `docs/specs/13-privacy-considerations.md`
- Status: Informational; no direct implementation mapping.

## 14. Best Practices for Authors Using WebCodecs

Source: `docs/specs/14-best-practices-for-authors-using-webcodecs.md`
- Status: Informational; no direct implementation mapping.

## 15. Acknowledgements

Source: `docs/specs/15-acknowledgements.md`
- Status: Informational; no direct implementation mapping.
