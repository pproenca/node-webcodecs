# Change: Add Encoded Media Interfaces (EncodedAudioChunk, EncodedVideoChunk)

## Why

The W3C WebCodecs specification defines EncodedAudioChunk and EncodedVideoChunk as the primary containers for compressed audio and video data. These interfaces serve as the output of encoders and input to decoders. Implementing these interfaces with full spec compliance enables seamless interoperability with browser-based WebCodecs code and ensures the node-webcodecs library functions correctly as a media processing pipeline.

## What Changes

- **EncodedAudioChunk Interface** (W3C spec section 8.1)
  - Constructor with type, timestamp, duration, data, and transfer semantics
  - Internal slots: [[internal data]], [[type]], [[timestamp]], [[duration]], [[byte length]]
  - Readonly attributes: type, timestamp, duration, byteLength
  - copyTo() method for extracting compressed data
  - Serialization support (no storage serialization per spec)

- **EncodedVideoChunk Interface** (W3C spec section 8.2)
  - Constructor with type, timestamp, duration, data, and transfer semantics
  - Internal slots: [[internal data]], [[type]], [[timestamp]], [[duration]], [[byte length]]
  - Readonly attributes: type, timestamp, duration, byteLength
  - copyTo() method for extracting compressed data
  - Serialization support (no storage serialization per spec)

- **Shared Types**
  - EncodedAudioChunkType enum: "key" | "delta"
  - EncodedVideoChunkType enum: "key" | "delta"
  - EncodedAudioChunkInit dictionary
  - EncodedVideoChunkInit dictionary

## Impact

- **Affected specs**: encoded-audio-chunk-interface (new), encoded-video-chunk-interface (new)
- **Affected code**:
  - `lib/encoded-chunks.ts` — TypeScript implementation
  - `lib/types.ts` — Type definitions
  - `src/encoded_audio_chunk.cc`, `src/encoded_audio_chunk.h` — Native C++ implementation
  - `src/encoded_video_chunk.cc`, `src/encoded_video_chunk.h` — Native C++ implementation
  - `test/unit/encoded-audio-chunk.test.ts`, `test/unit/encoded-video-chunk.test.ts` — Unit tests
- **Dependencies**: Used by VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder, Muxer, Demuxer
- **Breaking changes**: None (additive change formalizing existing implementation)
