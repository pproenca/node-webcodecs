# Change: Migrate W3C VideoEncoder Interface to OpenSpec

## Why

The VideoEncoder interface is a core W3C WebCodecs API for encoding raw VideoFrame objects into compressed video data (H.264/AVC, H.265/HEVC, VP9, AV1, etc.). Converting this spec section to OpenSpec requirements enables:

1. Automated compliance verification against the implementation in `lib/video-encoder.ts` and `src/video_encoder.cc`
2. Clear traceability between spec requirements and test cases
3. Consistent spec-driven development aligned with existing `add-webcodecs-definitions`, `add-codec-processing-model`, `add-videodecoder-interface`, and `add-audioencoder-interface` changes

## What Changes

- **ADDED**: New `videoencoder-interface` capability under `openspec/specs/`
- Migrates W3C WebCodecs Section 6 from `docs/specs/6-videoencoder-interface/`:
  - Constructor initialization (internal slots, callbacks)
  - Attributes (state, encodeQueueSize, ondequeue)
  - Methods (configure, encode, flush, reset, close, isConfigSupported)
  - Algorithms (Schedule Dequeue Event, Output EncodedVideoChunks, Reset VideoEncoder, Close VideoEncoder)
  - State machine transitions (unconfigured -> configured -> closed)
  - Active orientation tracking for frame consistency
  - EncodedVideoChunkMetadata dictionary (decoderConfig, svc, alphaSideData)
  - Scalable Video Coding (SVC) metadata support
  - Alpha channel encoding support

## Impact

- Affected specs: None (new capability)
- Affected code: `lib/video-encoder.ts`, `src/video_encoder.cc` (existing implementation to verify against)
- Depends on:
  - `add-webcodecs-definitions` (references Codec, Internal Pending Output, System Resources)
  - `add-codec-processing-model` (references control message queue, codec work queue)
