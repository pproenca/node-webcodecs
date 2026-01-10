# Change: Migrate W3C AudioDecoder Interface to OpenSpec

## Why

The AudioDecoder interface is a core W3C WebCodecs API for decoding compressed audio data (AAC, Opus, MP3, etc.) into raw AudioData. Converting this spec section to OpenSpec requirements enables:

1. Automated compliance verification against the implementation in `lib/audio-decoder.ts` and `src/audio_decoder.cc`
2. Clear traceability between spec requirements and test cases
3. Consistent spec-driven development aligned with existing `add-webcodecs-definitions` and `add-codec-processing-model` changes

## What Changes

- **ADDED**: New `audiodecoder-interface` capability under `openspec/specs/`
- Migrates W3C WebCodecs Section 3 from `docs/specs/3-audiodecoder-interface/`:
  - Constructor initialization (internal slots, callbacks)
  - Attributes (state, decodeQueueSize, ondequeue)
  - Methods (configure, decode, flush, reset, close, isConfigSupported)
  - Algorithms (Schedule Dequeue Event, Output AudioData, Reset AudioDecoder, Close AudioDecoder)
  - State machine transitions (unconfigured -> configured -> closed)
  - Key chunk validation requirements

## Impact

- Affected specs: None (new capability)
- Affected code: `lib/audio-decoder.ts`, `src/audio_decoder.cc` (existing implementation to verify against)
- Depends on:
  - `add-webcodecs-definitions` (references Codec, Key Chunk, Internal Pending Output, System Resources)
  - `add-codec-processing-model` (references control message queue, codec work queue)
