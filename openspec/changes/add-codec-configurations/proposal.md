# Change: Migrate W3C WebCodecs Configurations to OpenSpec

## Why

The Configurations section (Section 7) of the W3C WebCodecs specification defines the core configuration dictionaries, enums, and validation algorithms used by all codec interfaces. Converting this section to OpenSpec requirements:

1. Establishes machine-readable requirements for configuration validation
2. Enables compliance verification for `VideoEncoderConfig`, `AudioEncoderConfig`, `VideoDecoderConfig`, and `AudioDecoderConfig`
3. Provides traceability between spec requirements and implementation in `lib/*.ts`
4. Complements existing changes: `add-videoencoder-interface`, `add-videodecoder-interface`, `add-audioencoder-interface`, `add-audiodecoder-interface`

## What Changes

- **ADDED**: New `codec-configurations` capability under `openspec/specs/`
- Migrates W3C WebCodecs Section 7 from `docs/specs/7-configurations/`:
  - Validation algorithms (Check Configuration Support, Clone Configuration, Configuration Equivalence)
  - Codec string format and requirements
  - Configuration dictionaries:
    - `AudioDecoderConfig` (codec, sampleRate, numberOfChannels, description)
    - `VideoDecoderConfig` (codec, description, dimensions, colorSpace, hardware, orientation)
    - `AudioEncoderConfig` (codec, sampleRate, numberOfChannels, bitrate, bitrateMode)
    - `VideoEncoderConfig` (codec, dimensions, bitrate, framerate, hardware, alpha, scalability, latency)
  - Signalling configuration support dictionaries (`AudioDecoderSupport`, `VideoDecoderSupport`, etc.)
  - Enums:
    - `HardwareAcceleration` (no-preference, prefer-hardware, prefer-software)
    - `AlphaOption` (keep, discard)
    - `LatencyMode` (quality, realtime)
    - `VideoEncoderBitrateMode` (constant, variable, quantizer)
    - `CodecState` (unconfigured, configured, closed)
  - `VideoEncoderEncodeOptions` dictionary
  - `WebCodecsErrorCallback` callback type

## Impact

- Affected specs: None (new capability)
- Affected code:
  - `lib/video-encoder.ts`, `lib/video-decoder.ts` (VideoEncoderConfig, VideoDecoderConfig validation)
  - `lib/audio-encoder.ts`, `lib/audio-decoder.ts` (AudioEncoderConfig, AudioDecoderConfig validation)
- Depends on:
  - `add-webcodecs-definitions` (references Codec, System Resources)
  - Related to codec interface changes for isConfigSupported() behavior
