# WebCodecs Spec Status (Node.js 20.x, macOS/Linux)

This file tracks spec coverage for the sections listed in `docs/specs/TODO.md`.
Each entry is marked as implemented, partial, or not applicable. "Partial"
means the feature exists but is not fully aligned with spec details and/or
not proven by tests yet.

## 1. Definitions

- Status: partial.
  Notes: Core WebIDL types and enums exist in `lib/types.ts`; error taxonomy in
  `lib/errors.ts`. No tests proving definition-level requirements yet.

## 2. Codec Processing Model

- Status: partial.
  Notes: `lib/control-message-queue.ts` exists but codec operations do not
  enqueue messages. Async work happens in `src/async_encode_worker.cc` and
  `src/async_decode_worker.cc`, but does not yet follow the spec processing
  model precisely.

  - 2.1 Background
    - Status: not applicable.
      Notes: Informational text only.

  - 2.2 Control Messages
    - Status: partial.
      Notes: Queue exists but `configure`/`encode`/`decode` are not enqueued in
      `lib/audio-encoder.ts`, `lib/video-encoder.ts`, `lib/audio-decoder.ts`,
      `lib/video-decoder.ts`.

  - 2.3 Codec Work Parallel Queue
    - Status: partial.
      Notes: Async workers exist, but queue semantics and ordering are not
      proven to match spec.

## 3. AudioDecoder Interface

- Status: partial.
  Notes: Implemented in `lib/audio-decoder.ts` and `src/audio_decoder.cc`.
  Uses `DOMException` instead of `WebCodecsError` subclasses today. No tests
  yet.

  - 3.1 Internal Slots
    - Status: partial.
      Notes: State is tracked in native and JS layers but not aligned to spec
      text or tested.

  - 3.2 Constructors
    - Status: partial.
      Notes: Constructor exists with validation in `lib/audio-decoder.ts`.

  - 3.3 Attributes
    - Status: partial.
      Notes: `state`, `decodeQueueSize`, and `ondequeue` exist, but full
      attribute semantics are unverified.

  - 3.4 Event Summary
    - Status: partial.
      Notes: `dequeue` event via `lib/codec-base.ts`. Error events are routed
      via callbacks; no tests.

  - 3.5 Methods
    - Status: partial.
      Notes: `configure`, `decode`, `flush`, `reset`, `close`,
      `isConfigSupported` exist but error types do not match spec.

  - 3.6 Algorithms
    - Status: partial.
      Notes: Native behavior exists, but algorithmic requirements are not
      proven.

## 4. VideoDecoder Interface

- Status: partial.
  Notes: Implemented in `lib/video-decoder.ts` and `src/video_decoder.cc`.
  Uses `DOMException` today and includes non-spec extensions (rotation/flip).

  - 4.1 Internal Slots
    - Status: partial.
      Notes: State tracked in native and JS layers, unverified.

  - 4.2 Constructors
    - Status: partial.
      Notes: Constructor exists; error taxonomy not aligned.

  - 4.3 Attributes
    - Status: partial.
      Notes: `state`, `decodeQueueSize`, `ondequeue` exist. No tests.

  - 4.4 Event Summary
    - Status: partial.
      Notes: `dequeue` event exists via `lib/codec-base.ts`.

  - 4.5 Methods
    - Status: partial.
      Notes: `configure`, `decode`, `flush`, `reset`, `close`,
      `isConfigSupported` exist.

  - 4.6 Algorithms
    - Status: partial.
      Notes: Native decode path exists, not aligned or tested vs spec.

## 5. AudioEncoder Interface

- Status: partial.
  Notes: Implemented in `lib/audio-encoder.ts` and `src/audio_encoder.cc`.
  Uses `DOMException` today.

  - 5.1 Internal Slots
    - Status: partial.
      Notes: State tracked in native and JS layers.

  - 5.2 Constructors
    - Status: partial.
      Notes: Constructor exists with validation.

  - 5.3 Attributes
    - Status: partial.
      Notes: `state`, `encodeQueueSize`, `ondequeue` exist.

  - 5.4 Event Summary
    - Status: partial.
      Notes: `dequeue` event exists via `lib/codec-base.ts`.

  - 5.5 Methods
    - Status: partial.
      Notes: `configure`, `encode`, `flush`, `reset`, `close`,
      `isConfigSupported` exist.

  - 5.6 Algorithms
    - Status: partial.
      Notes: Native encode path exists; error semantics not aligned.

  - 5.7 EncodedAudioChunkMetadata
    - Status: partial.
      Notes: Metadata is passed from native, but spec fields are not verified.

## 6. VideoEncoder Interface

- Status: partial.
  Notes: Implemented in `lib/video-encoder.ts` and `src/video_encoder.cc`.
  Uses `DOMException` today; encode options are narrower than spec in TS.

  - 6.1 Internal Slots
    - Status: partial.
      Notes: State tracked in native and JS layers.

  - 6.2 Constructors
    - Status: partial.
      Notes: Constructor exists with validation.

  - 6.3 Attributes
    - Status: partial.
      Notes: `state`, `encodeQueueSize`, `ondequeue` exist. No tests.

  - 6.4 Event Summary
    - Status: partial.
      Notes: `dequeue` event exists via `lib/codec-base.ts`.

  - 6.5 Methods
    - Status: partial.
      Notes: `configure`, `encode`, `flush`, `reset`, `close`,
      `isConfigSupported` exist. `encode` options are not spec-complete in TS.

  - 6.6 Algorithms
    - Status: partial.
      Notes: Native encode path exists; not aligned or tested vs spec.

  - 6.7 EncodedVideoChunkMetadata
    - Status: partial.
      Notes: Native encoder emits metadata (color space, decoderConfig, SVC)
      but not verified by tests.

## 7. Configurations

- Status: partial.
  Notes: Config types are defined in `lib/types.ts` and native validation
  exists, but many fields are only partially enforced.

  - 7.1 Check Configuration Support (with config)
    - Status: partial.
      Notes: `isConfigSupported` exists on codecs, but coverage is incomplete.

  - 7.2 Clone Configuration (with config)
    - Status: partial.
      Notes: `createEncoderConfigDescriptor` exists for video encoder configs
      in `src/descriptors.cc`; not general or tested.

  - 7.3 Signalling Configuration Support
    - Status: partial.
      Notes: Support objects are returned by `isConfigSupported`; spec fields
      not fully validated.

    - 7.3.1 AudioDecoderSupport
      - Status: partial.
        Notes: `AudioDecoder.isConfigSupported` exists.

    - 7.3.2 VideoDecoderSupport
      - Status: partial.
        Notes: `VideoDecoder.isConfigSupported` exists.

    - 7.3.3 AudioEncoderSupport
      - Status: partial.
        Notes: `AudioEncoder.isConfigSupported` exists.

    - 7.3.4 VideoEncoderSupport
      - Status: partial.
        Notes: `VideoEncoder.isConfigSupported` exists.

  - 7.4 Codec String
    - Status: partial.
      Notes: Mapping implemented in `src/audio_decoder.cc`,
      `src/video_decoder.cc`, `src/audio_encoder.cc`, `src/video_encoder.cc`.

  - 7.5 AudioDecoderConfig
    - Status: partial.
      Notes: Fields handled in `src/audio_decoder.cc`; no full validation or
      tests.

  - 7.6 VideoDecoderConfig
    - Status: partial.
      Notes: Fields handled in `src/video_decoder.cc`; includes extensions
      (rotation/flip) and uses `DOMException` today.

  - 7.7 AudioEncoderConfig
    - Status: partial.
      Notes: Fields handled in `src/audio_encoder.cc`, with codec-specific
      options for Opus and AAC.

  - 7.8 VideoEncoderConfig
    - Status: partial.
      Notes: Fields handled in `src/video_encoder.cc` (bitrate, framerate,
      latencyMode, bitrateMode, colorSpace, avc/hevc options).

  - 7.9 Hardware Acceleration
    - Status: partial.
      Notes: Video encoder selects hardware paths; decoder validates and
      applies latency flags, but full spec handling is unverified.

  - 7.10 Alpha Option
    - Status: partial.
      Notes: `alpha` is accepted and echoed in config, but actual alpha encode
      handling is not validated.

  - 7.11 Latency Mode
    - Status: partial.
      Notes: Video encoder uses latencyMode for B-frame tuning.

  - 7.12 Configuration Equivalence
    - Status: partial.
      Notes: Descriptor helper exists for video encoder, not generalized.

  - 7.13 VideoEncoderEncodeOptions
    - Status: partial.
      Notes: Native encoder supports codec-specific quantizers but
      `lib/video-encoder.ts` exposes only `keyFrame` today.

  - 7.14 VideoEncoderBitrateMode
    - Status: partial.
      Notes: Accepted in `src/video_encoder.cc` but not validated by tests.

  - 7.15 CodecState
    - Status: partial.
      Notes: `CodecState` enum exists in `lib/types.ts`; behavior unverified.

  - 7.16 WebCodecsErrorCallback
    - Status: partial.
      Notes: Error callbacks exist but error types are DOMException today.

## 8. Encoded Media Interfaces (Chunks)

- Status: partial.
  Notes: Encoded chunks implemented in `lib/encoded-chunks.ts` and native
  code, but serialization and transfer semantics are not aligned with spec.

  - 8.1 EncodedAudioChunk Interface
    - Status: partial.
      Notes: Constructor, attributes, `copyTo`, `close` exist.

    - 8.1.1 Internal Slots
      - Status: partial.
        Notes: Native fields exist; unverified vs spec.

    - 8.1.2 Constructors
      - Status: partial.
        Notes: Implemented in `lib/encoded-chunks.ts`.

    - 8.1.3 Attributes
      - Status: partial.
        Notes: `type`, `timestamp`, `duration`, `byteLength` exist.

    - 8.1.4 Methods
      - Status: partial.
        Notes: `copyTo`, `close` exist; error semantics unverified.

    - 8.1.5 Serialization
      - Status: partial.
        Notes: No structured clone support; transfer behavior unverified.

  - 8.2 EncodedVideoChunk Interface
    - Status: partial.
      Notes: Same as EncodedAudioChunk, with metadata from encoder.

    - 8.2.1 Internal Slots
      - Status: partial.
        Notes: Native fields exist; unverified vs spec.

    - 8.2.2 Constructors
      - Status: partial.
        Notes: Implemented in `lib/encoded-chunks.ts`.

    - 8.2.3 Attributes
      - Status: partial.
        Notes: `type`, `timestamp`, `duration`, `byteLength` exist.

    - 8.2.4 Methods
      - Status: partial.
        Notes: `copyTo`, `close` exist.

    - 8.2.5 Serialization
      - Status: partial.
        Notes: No structured clone support; transfer behavior unverified.

## 9. Raw Media Interfaces

- Status: partial.
  Notes: VideoFrame and AudioData are implemented but serialization and memory
  model are not proven against spec.

  - 9.1 Memory Model
    - Status: partial.
      Notes: `close` and `clone` exist, but reference counting and structured
      clone semantics are unverified.

    - 9.1.1 Background
      - Status: not applicable.
        Notes: Informational text only.

    - 9.1.2 Reference Counting
      - Status: partial.
        Notes: FinalizationRegistry exists for encoded chunks but not for
        VideoFrame/AudioData.

    - 9.1.3 Transfer and Serialization
      - Status: partial.
        Notes: `detachArrayBuffers` exists in `lib/transfer.ts`, but no
        structured clone support for media objects.

  - 9.2 AudioData Interface
    - Status: partial.
      Notes: Implemented in `lib/audio-data.ts` and `src/audio_data.cc`.

    - 9.2.1 Internal Slots
      - Status: partial.
        Notes: Native fields exist; unverified vs spec.

    - 9.2.2 Constructors
      - Status: partial.
        Notes: Constructor exists with basic validation.

    - 9.2.3 Attributes
      - Status: partial.
        Notes: `format`, `sampleRate`, `numberOfFrames`,
        `numberOfChannels`, `timestamp`, `duration` exist.

    - 9.2.4 Methods
      - Status: partial.
        Notes: `allocationSize`, `copyTo`, `clone`, `close` exist.

    - 9.2.5 Algorithms
      - Status: partial.
        Notes: Conversion uses libswresample in `src/audio_data.cc`.

    - 9.2.6 Transfer and Serialization
      - Status: partial.
        Notes: Buffer transfer is supported, not object transfer.

    - 9.2.7 AudioDataCopyToOptions
      - Status: partial.
        Notes: Options are partially validated in `src/audio_data.cc`.

  - 9.3 Audio Sample Format
    - Status: partial.
      Notes: Format mapping exists in `lib/types.ts` and `src/audio_data.cc`.

    - 9.3.1 Arrangement of audio buffer
      - Status: partial.
        Notes: Planar vs interleaved is handled in `src/audio_data.cc`.

    - 9.3.2 Magnitude of the audio samples
      - Status: partial.
        Notes: Conversion uses FFmpeg; not validated.

    - 9.3.3 Audio channel ordering
      - Status: partial.
        Notes: FFmpeg default channel layout used.

  - 9.4 VideoFrame Interface
    - Status: partial.
      Notes: Implemented in `lib/video-frame.ts` and `src/video_frame.cc`.

    - 9.4.1 Internal Slots
      - Status: partial.
        Notes: Native fields exist; unverified vs spec.

    - 9.4.2 Constructors
      - Status: partial.
        Notes: Construct from ImageData, raw buffers, and VideoFrame.

    - 9.4.3 Attributes
      - Status: partial.
        Notes: `codedWidth`, `codedHeight`, `timestamp`, `format`,
        `duration`, `displayWidth`, `displayHeight`, `colorSpace`,
        `visibleRect` exist.

    - 9.4.4 Internal Structures
      - Status: partial.
        Notes: Internal layout handled in native layer.

    - 9.4.5 Methods
      - Status: partial.
        Notes: `allocationSize`, `copyTo`, `clone`, `close` exist.

    - 9.4.6 Algorithms
      - Status: partial.
        Notes: Copy and format conversion in `src/video_frame.cc`.

    - 9.4.7 Transfer and Serialization
      - Status: partial.
        Notes: Buffer transfer only; object transfer not supported.

    - 9.4.8 Rendering
      - Status: not applicable.
        Notes: Rendering is a browser concern; not available in Node.js.

  - 9.5 VideoFrame CopyTo() Options
    - Status: partial.
      Notes: Options partially validated in `lib/video-frame.ts`.

  - 9.6 DOMRects in VideoFrame
    - Status: partial.
      Notes: `visibleRect` is supported; DOMRect types are defined in
      `lib/types.ts`.

  - 9.7 Plane Layout
    - Status: partial.
      Notes: Native `copyTo` returns layout info.

  - 9.8 Pixel Format
    - Status: partial.
      Notes: Formats mapped in `src/video_frame.cc`.

  - 9.9 Video Color Space Interface
    - Status: partial.
      Notes: `VideoColorSpace` in `lib/video-frame.ts`, native colorSpace in
      `src/video_frame.cc`.

    - 9.9.1 Internal Slots
      - Status: partial.
        Notes: Internal fields exist; unverified.

    - 9.9.2 Constructors
      - Status: partial.
        Notes: `VideoColorSpace` constructor exists.

    - 9.9.3 Attributes
      - Status: partial.
        Notes: `primaries`, `transfer`, `matrix`, `fullRange` exist.

  - 9.10 Video Color Primaries
    - Status: partial.
      Notes: Enum defined in `lib/types.ts`.

  - 9.11 Video Transfer Characteristics
    - Status: partial.
      Notes: Enum defined in `lib/types.ts`.

  - 9.12 Video Matrix Coefficients
    - Status: partial.
      Notes: Enum defined in `lib/types.ts`.

## 10. Image Decoding

- Status: partial.
  Notes: Implemented in `lib/image-decoder.ts` and `src/image_decoder.cc`,
  but several options are parsed without full behavior.

  - 10.1 Background
    - Status: not applicable.
      Notes: Informational text only.

  - 10.2 ImageDecoder Interface
    - Status: partial.
      Notes: Interface exists; option behavior unverified.

    - 10.2.1 Internal Slots
      - Status: partial.
        Notes: Internal fields exist; unverified.

    - 10.2.2 Constructor
      - Status: partial.
        Notes: Constructor exists; streaming buffers entire input.

    - 10.2.3 Attributes
      - Status: partial.
        Notes: `type`, `complete`, `tracks`, `completed` exist.

    - 10.2.4 Methods
      - Status: partial.
        Notes: `decode`, `reset`, `close` exist; `completeFramesOnly`
        not implemented.

    - 10.2.5 Algorithms
      - Status: partial.
        Notes: Uses FFmpeg decode; not spec-aligned for animation options.

  - 10.3 ImageDecoderInit Interface
    - Status: partial.
      Notes: Parsed in `lib/image-decoder.ts` and `src/image_decoder.cc`.

  - 10.4 ImageDecodeOptions Interface
    - Status: partial.
      Notes: `frameIndex` is passed; `completeFramesOnly` ignored.

  - 10.5 ImageDecodeResult Interface
    - Status: partial.
      Notes: `image` and `complete` are returned.

  - 10.6 ImageTrackList Interface
    - Status: partial.
      Notes: Implemented in `lib/image-track-list.ts`.

    - 10.6.1 Internal Slots
      - Status: partial.
        Notes: Internal list exists; unverified.

    - 10.6.2 Attributes
      - Status: partial.
        Notes: `ready`, `length`, `selectedIndex`, `selectedTrack` exist.

  - 10.7 ImageTrack Interface
    - Status: partial.
      Notes: Implemented in `lib/image-track.ts`.

    - 10.7.1 Internal Slots
      - Status: partial.
        Notes: Internal fields exist; unverified.

    - 10.7.2 Attributes
      - Status: partial.
        Notes: `animated`, `frameCount`, `repetitionCount`, `selected` exist.

## 11. Resource Reclamation

- Status: partial.
  Notes: `lib/resource-manager.ts` exists, but no automatic monitoring. No
  FinalizationRegistry for VideoFrame/AudioData.

## 12. Security Considerations

- Status: partial.
  Notes: No explicit security mitigations beyond existing backpressure
  checks in native encode/decode.

## 13. Privacy Considerations

- Status: partial.
  Notes: No explicit privacy budget or capability probing limits.

## 14. Best Practices for Authors Using WebCodecs

- Status: not applicable.
  Notes: Informational guidance only; not enforced at runtime.

## 15. Acknowledgements

- Status: not applicable.
  Notes: Informational content only.
