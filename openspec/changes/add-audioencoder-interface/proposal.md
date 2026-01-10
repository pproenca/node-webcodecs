# Change: Migrate W3C AudioEncoder Interface to OpenSpec

## Why

The AudioEncoder interface is a core W3C WebCodecs API for encoding raw AudioData into compressed audio formats (AAC, Opus, etc.). Converting this spec section to OpenSpec requirements enables:

1. Automated compliance verification against the implementation in `lib/audio-encoder.ts` and `src/audio_encoder.cc`
2. Clear traceability between spec requirements and test cases
3. Consistent spec-driven development aligned with existing `add-webcodecs-definitions`, `add-codec-processing-model`, and `add-audiodecoder-interface` changes

## What Changes

- **ADDED**: New `audioencoder-interface` capability under `openspec/specs/`
- Migrates W3C WebCodecs Section 5 from `docs/specs/5-audioencoder-interface/`:
  - Constructor initialization (internal slots, callbacks)
  - Attributes (state, encodeQueueSize, ondequeue)
  - Methods (configure, encode, flush, reset, close, isConfigSupported)
  - Algorithms (Schedule Dequeue Event, Output EncodedAudioChunks, Reset AudioEncoder, Close AudioEncoder)
  - State machine transitions (unconfigured -> configured -> closed)
  - EncodedAudioChunkMetadata dictionary

## Impact

- Affected specs: None (new capability)
- Affected code: `lib/audio-encoder.ts`, `src/audio_encoder.cc` (existing implementation to verify against)
- Depends on:
  - `add-webcodecs-definitions` (references Codec, Internal Pending Output, System Resources)
  - `add-codec-processing-model` (references control message queue, codec work queue)
