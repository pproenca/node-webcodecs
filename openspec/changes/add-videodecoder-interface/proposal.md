# Change: Migrate W3C VideoDecoder Interface to OpenSpec

## Why

The VideoDecoder interface is a core W3C WebCodecs API for decoding compressed video data (H.264/AVC, H.265/HEVC, VP9, AV1, etc.) into raw VideoFrame objects. Converting this spec section to OpenSpec requirements enables:

1. Automated compliance verification against the implementation in `lib/video-decoder.ts` and `src/video_decoder.cc`
2. Clear traceability between spec requirements and test cases
3. Consistent spec-driven development aligned with existing `add-webcodecs-definitions`, `add-codec-processing-model`, and `add-audiodecoder-interface` changes

## What Changes

- **ADDED**: New `videodecoder-interface` capability under `openspec/specs/`
- Migrates W3C WebCodecs Section 4 from `docs/specs/4-videodecoder-interface/`:
  - Constructor initialization (internal slots, callbacks)
  - Attributes (state, decodeQueueSize, ondequeue)
  - Methods (configure, decode, flush, reset, close, isConfigSupported)
  - Algorithms (Schedule Dequeue Event, Output VideoFrames, Reset VideoDecoder, Close VideoDecoder)
  - State machine transitions (unconfigured -> configured -> closed)
  - Key chunk validation requirements
  - Display aspect ratio and color space handling in output frames

## Impact

- Affected specs: None (new capability)
- Affected code: `lib/video-decoder.ts`, `src/video_decoder.cc` (existing implementation to verify against)
- Depends on:
  - `add-webcodecs-definitions` (references Codec, Key Chunk, Internal Pending Output, System Resources)
  - `add-codec-processing-model` (references control message queue, codec work queue)
