# Change: Add Raw Media Interfaces (VideoFrame, AudioData, VideoColorSpace)

## Why

The W3C WebCodecs specification defines VideoFrame and AudioData as the primary containers for raw (uncompressed) video and audio data. These interfaces serve as the output of decoders and input to encoders. VideoColorSpace provides metadata about color representation. Implementing these interfaces with full spec compliance enables the node-webcodecs library to function as a complete media processing pipeline with browser-compatible APIs.

## What Changes

- **Memory Model** (W3C spec section 9.1)
  - Reference counting via clone() and close() methods
  - Media resource lifetime management
  - Transfer and serialization semantics for cross-realm operations

- **AudioData Interface** (W3C spec section 9.2)
  - Constructor with format, sampleRate, numberOfFrames, numberOfChannels, timestamp, data, transfer
  - Internal slots: [[format]], [[sample rate]], [[number of frames]], [[number of channels]], [[timestamp]], [[duration]], [[resource reference]]
  - Readonly attributes: format, sampleRate, numberOfFrames, numberOfChannels, duration, timestamp
  - Methods: allocationSize(), copyTo(), clone(), close()
  - Transfer and serialization support
  - AudioDataCopyToOptions dictionary

- **Audio Sample Format** (W3C spec section 9.3)
  - AudioSampleFormat enum: u8, s16, s32, f32, u8-planar, s16-planar, s32-planar, f32-planar
  - Interleaved vs planar channel arrangements
  - Sample magnitude and channel ordering conventions

- **VideoFrame Interface** (W3C spec section 9.4)
  - Two constructors: from CanvasImageSource, from AllowSharedBufferSource with VideoFrameBufferInit
  - Internal slots: [[format]], [[coded width]], [[coded height]], [[visible rect]], [[rotation]], [[flip]], [[display width]], [[display height]], [[duration]], [[timestamp]], [[color space]], [[resource reference]]
  - Readonly attributes: format, codedWidth, codedHeight, codedRect, visibleRect, rotation, flip, displayWidth, displayHeight, duration, timestamp, colorSpace
  - Methods: metadata(), allocationSize(), copyTo() (returns Promise<PlaneLayout[]>), clone(), close()
  - VideoFrameInit and VideoFrameBufferInit dictionaries
  - VideoFrameMetadata dictionary
  - Transfer and serialization support

- **VideoFrameCopyToOptions** (W3C spec section 9.5)
  - Dictionary with rect, layout, format, colorSpace options
  - Sample-aligned rectangle validation

- **PlaneLayout** (W3C spec section 9.7)
  - Dictionary with offset and stride for memory layout specification

- **Pixel Format** (W3C spec section 9.8)
  - VideoPixelFormat enum: I420, I420P10, I420P12, I420A, I420AP10, I420AP12, I422, I422P10, I422P12, I422A, I422AP10, I422AP12, I444, I444P10, I444P12, I444A, I444AP10, I444AP12, NV12, RGBA, RGBX, BGRA, BGRX
  - Sub-sampling definitions and plane layouts
  - Equivalent opaque format mappings

- **VideoColorSpace Interface** (W3C spec section 9.9)
  - Constructor with optional VideoColorSpaceInit
  - Internal slots: [[primaries]], [[transfer]], [[matrix]], [[full range]]
  - Readonly attributes: primaries, transfer, matrix, fullRange
  - toJSON() method
  - VideoColorSpaceInit dictionary

- **VideoColorPrimaries** (W3C spec section 9.10)
  - Enum: bt709, bt470bg, smpte170m, bt2020, smpte432

- **VideoTransferCharacteristics** (W3C spec section 9.11)
  - Enum: bt709, smpte170m, iec61966-2-1, linear, pq, hlg

- **VideoMatrixCoefficients** (W3C spec section 9.12)
  - Enum: rgb, bt709, bt470bg, smpte170m, bt2020-ncl

## Impact

- **Affected specs**: video-frame-interface (new), audio-data-interface (new), video-color-space-interface (new), pixel-format (new), audio-sample-format (new), memory-model (new)
- **Affected code**:
  - `lib/video-frame.ts` — VideoFrame TypeScript implementation
  - `lib/audio-data.ts` — AudioData TypeScript implementation
  - `lib/video-color-space.ts` — VideoColorSpace TypeScript implementation (may need creation)
  - `lib/types.ts` — Type definitions (VideoPixelFormat, AudioSampleFormat, etc.)
  - `src/video_frame.cc`, `src/video_frame.h` — Native C++ VideoFrame implementation
  - `src/audio_data.cc`, `src/audio_data.h` — Native C++ AudioData implementation
  - `test/golden/video-frame.test.ts`, `test/golden/audio-data.test.ts` — Integration tests
  - `test/unit/video-frame.test.ts`, `test/unit/audio-data.test.ts` — Unit tests
- **Dependencies**: Used by VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder
- **Relates to**: add-encoded-media-interfaces (EncodedVideoChunk, EncodedAudioChunk are the compressed counterparts)
- **Breaking changes**: None (formalizing existing implementation with spec compliance)
