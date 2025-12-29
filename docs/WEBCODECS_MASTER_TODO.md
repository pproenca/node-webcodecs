# WebCodecs Implementation Master TODO

> **Consolidated from**: WEBCODECS_IMPLEMENTATION_TODO.md, WEBCODECS_USER_STORIES.md, WEBCODECS_SPEC_DETAILS.md
>
> **Organization**: Capabilities → User Stories → Implementation Tasks

---

## Quick Links

- [Capability 1: Video Encoding](#capability-1-video-encoding)
- [Capability 2: Video Decoding](#capability-2-video-decoding)
- [Capability 3: Audio Encoding](#capability-3-audio-encoding)
- [Capability 4: Audio Decoding](#capability-4-audio-decoding)
- [Capability 5: Image Decoding](#capability-5-image-decoding)
- [Capability 6: Codec Support Detection](#capability-6-codec-support-detection)
- [Capability 7: Error Handling](#capability-7-error-handling)
- [Capability 8: Memory Management](#capability-8-memory-management)
- [Capability 9: Hardware Acceleration](#capability-9-hardware-acceleration)
- [Capability 10: TypeScript & Developer Experience](#capability-10-typescript--developer-experience)

---

# Capability 1: Video Encoding

## User Story A1: Encode Video Frames to H.264 File (P1)

> As a Node.js developer, I want to encode raw video frames into H.264 format so that I can create video files server-side.

### Acceptance Criteria

- [ ] **AC-1.1**: Configure VideoEncoder with H.264 codec and encoder state becomes "configured"
- [ ] **AC-1.2**: Encode RGBA VideoFrame and receive EncodedVideoChunk via output callback
- [ ] **AC-1.3**: Flush encoder and receive all pending chunks
- [ ] **AC-1.4**: Close encoder and state becomes "closed", resources freed
- [ ] **AC-1.5**: EncodedVideoChunk has correct type, timestamp, byteLength, data properties

### Implementation Tasks

#### VideoEncoder Class (Native C++)

- [x] Create VideoEncoder class inheriting from Napi::ObjectWrap
- [x] Implement constructor accepting VideoEncoderInit (output + error callbacks)
- [x] Implement `state` property getter (returns CodecState enum)
- [ ] Implement `encodeQueueSize` property getter
- [ ] Implement `ondequeue` event handler property

#### VideoEncoder.configure() Method

- [x] Parse VideoEncoderConfig dictionary
- [x] Extract codec string and map to FFmpeg AV_CODEC_ID
- [x] Parse H.264 codec string "avc1.PPCCLL" format
  - [ ] Extract profile (PP): 42=Baseline, 4D=Main, 64=High
  - [ ] Extract constraint set flags (CC)
  - [ ] Extract level (LL): divide by 10 for actual level
- [ ] Parse VP8 codec string "vp8"
- [ ] Parse VP9 codec string "vp09.PP.LL.DD"
- [ ] Parse AV1 codec string "av01.P.LLT.DD"
- [x] Create AVCodecContext with parsed parameters
- [x] Set width, height, bitrate, framerate
- [ ] Handle `hardwareAcceleration` option
- [ ] Handle `latencyMode` option ("quality" vs "realtime")
- [ ] Handle `bitrateMode` option ("constant", "variable", "quantizer")
- [ ] Handle `scalabilityMode` for SVC
- [x] Open codec with avcodec_open2()
- [x] Allocate AVFrame and AVPacket
- [x] Create SwsContext for pixel format conversion
- [x] Set state to "configured"

#### VideoEncoder.encode() Method

- [x] Validate state is "configured", throw InvalidStateError otherwise
- [x] Validate VideoFrame is not detached, throw TypeError otherwise
- [x] Get pixel data from VideoFrame
- [x] Convert RGBA → YUV420P using libswscale
- [x] Set frame PTS from VideoFrame.timestamp
- [ ] Handle VideoEncoderEncodeOptions.keyFrame flag
- [x] Send frame to encoder via avcodec_send_frame()
- [x] Receive packets via avcodec_receive_packet() loop
- [x] Create EncodedVideoChunk for each packet
- [x] Set chunk.type based on AV_PKT_FLAG_KEY
- [x] Call output callback with chunk and metadata
- [ ] Include decoderConfig in metadata for keyframes
- [ ] Update encodeQueueSize
- [ ] Fire 'dequeue' event when work completes

#### VideoEncoder.flush() Method

- [x] Validate state, handle gracefully if not configured
- [x] Send NULL frame to flush encoder
- [x] Receive all remaining packets
- [x] Return Promise that resolves when complete
- [ ] Ensure all outputs delivered before Promise resolves (spec requirement)

#### VideoEncoder.reset() Method

- [ ] Flush encoder
- [ ] Free FFmpeg resources
- [ ] Reset to "unconfigured" state
- [ ] Clear encodeQueueSize

#### VideoEncoder.close() Method

- [x] Free AVCodecContext
- [x] Free AVFrame
- [x] Free AVPacket
- [x] Free SwsContext
- [x] Set state to "closed"
- [x] Make close() idempotent (no error on repeated calls)

### Test Files

- [x] `test/stories/a1-encode-h264.js` - Basic encoding test scaffolding
- [ ] `test/02_config.js` - Configuration validation
- [ ] `test/04_encoding.js` - End-to-end encoding

---

## User Story A3: Transcode Between Formats (P3)

> As a Node.js developer building a transcoding service, I want to decode and re-encode video so that I can convert formats.

### Acceptance Criteria

- [ ] **AC-3.1**: Decode VP8 video to VideoFrames
- [ ] **AC-3.2**: Encode VideoFrames to H.264
- [ ] **AC-3.3**: Output duration matches input duration
- [ ] **AC-3.4**: No resource leaks after pipeline completes

### Implementation Tasks (VP8/VP9 Support)

- [ ] Add VP8 encoder support (avcodec_find_encoder(AV_CODEC_ID_VP8))
- [ ] Add VP9 encoder support (avcodec_find_encoder(AV_CODEC_ID_VP9))
- [ ] Configure VP8/VP9 specific options
- [ ] Handle WebM container format (if needed)

---

# Capability 2: Video Decoding

## User Story A2: Decode H.264 Video to Raw Frames (P2)

> As a Node.js developer, I want to decode H.264 video into raw frames so that I can process video for analysis or transcoding.

### Acceptance Criteria

- [ ] **AC-2.1**: Configure VideoDecoder with H.264 codec
- [ ] **AC-2.2**: Decode EncodedVideoChunk and receive VideoFrame via callback
- [ ] **AC-2.3**: VideoFrame has correct dimensions and format
- [ ] **AC-2.4**: copyTo() converts to RGBA buffer correctly
- [ ] **AC-2.5**: flush() delivers all buffered frames

### Implementation Tasks

#### VideoDecoder Class (Native C++)

- [ ] Create VideoDecoder class inheriting from Napi::ObjectWrap
- [ ] Implement constructor accepting VideoDecoderInit (output + error callbacks)
- [ ] Implement `state` property getter
- [ ] Implement `decodeQueueSize` property getter
- [ ] Implement `ondequeue` event handler property

#### VideoDecoder.configure() Method

- [ ] Parse VideoDecoderConfig dictionary
- [ ] Parse codec string (same as encoder)
- [ ] Find decoder via avcodec_find_decoder()
- [ ] Create AVCodecContext
- [ ] Handle `description` (extradata) - SPS/PPS for H.264
- [ ] Handle `colorSpace` option
- [ ] Handle `hardwareAcceleration` option
- [ ] Handle `optimizeForLatency` option
- [ ] Open codec

#### VideoDecoder.decode() Method

- [ ] Validate state is "configured"
- [ ] Create AVPacket from EncodedVideoChunk
- [ ] Set packet data from chunk.data
- [ ] Set PTS from chunk.timestamp
- [ ] Set key frame flag if chunk.type === "key"
- [ ] Send packet via avcodec_send_packet()
- [ ] Receive frames via avcodec_receive_frame() loop
- [ ] Create VideoFrame for each decoded frame
- [ ] Convert pixel format if needed (YUV → target format)
- [ ] Call output callback with frame

#### VideoDecoder.flush() Method

- [ ] Send NULL packet to flush decoder
- [ ] Receive all remaining frames
- [ ] Return Promise

#### VideoDecoder.reset() / close() Methods

- [ ] Implement reset() to return to unconfigured
- [ ] Implement close() to free resources

### Test Files

- [ ] `test/stories/a2-decode-h264.js`

---

# Capability 3: Audio Encoding

## User Story A4: Encode Audio to AAC (P4)

> As a Node.js developer, I want to encode raw audio to AAC so that I can create compressed audio files.

### Acceptance Criteria

- [ ] **AC-4.1**: Configure AudioEncoder with AAC codec (mp4a.40.2)
- [ ] **AC-4.2**: Encode AudioData and receive EncodedAudioChunk
- [ ] **AC-4.3**: Chunks contain valid AAC frames

### Implementation Tasks

#### AudioEncoder Class (Native C++)

- [ ] Create AudioEncoder class inheriting from Napi::ObjectWrap
- [ ] Implement constructor accepting AudioEncoderInit
- [ ] Implement state, encodeQueueSize properties

#### AudioEncoder.configure() Method

- [ ] Parse AudioEncoderConfig dictionary
- [ ] Parse codec string:
  - [ ] "opus" → AV_CODEC_ID_OPUS
  - [ ] "mp4a.40.2" (AAC-LC) → AV_CODEC_ID_AAC
  - [ ] "mp4a.40.5" (HE-AAC) → AV_CODEC_ID_AAC with SBR
- [ ] Set sample_rate, channels
- [ ] Set channel_layout based on numberOfChannels
- [ ] Configure bitrate and bitrateMode
- [ ] Open codec

#### AudioEncoder.encode() Method

- [ ] Convert AudioData to AVFrame
- [ ] Handle sample format conversion using libswresample
- [ ] Handle interleaved ↔ planar conversion
- [ ] Send frame to encoder
- [ ] Receive packets and create EncodedAudioChunk

#### AudioData Class (Native C++)

- [ ] Create AudioData class
- [ ] Implement constructor from AudioDataInit
- [ ] Properties: format, sampleRate, numberOfFrames, numberOfChannels, duration, timestamp
- [ ] Methods: allocationSize(), copyTo(), clone(), close()
- [ ] Handle sample formats: u8, s16, s32, f32 (interleaved and planar)

#### EncodedAudioChunk Class

- [ ] Create EncodedAudioChunk class (TypeScript)
- [ ] Properties: type, timestamp, duration, byteLength
- [ ] Methods: copyTo()

### Test Files

- [ ] `test/stories/a4-encode-aac.js`

---

# Capability 4: Audio Decoding

## User Story A5: Decode Audio (P5)

> As a Node.js developer, I want to decode compressed audio so that I can analyze or transcode audio.

### Acceptance Criteria

- [ ] **AC-5.1**: Configure AudioDecoder with AAC codec
- [ ] **AC-5.2**: Decode EncodedAudioChunk and receive AudioData
- [ ] **AC-5.3**: AudioData has correct sampleRate and numberOfChannels

### Implementation Tasks

#### AudioDecoder Class (Native C++)

- [ ] Create AudioDecoder class
- [ ] Implement configure() with codec parsing
- [ ] Implement decode() converting packets to AudioData
- [ ] Implement flush(), reset(), close()

### Test Files

- [ ] `test/stories/a5-decode-audio.js`

---

# Capability 5: Image Decoding

## User Story A7: Process Images with ImageDecoder (P7)

> As a Node.js developer, I want to decode images into VideoFrames so that I can manipulate images consistently.

### Acceptance Criteria

- [ ] **AC-7.1**: Decode JPEG image to VideoFrame
- [ ] **AC-7.2**: Access animated GIF frame count and decode individual frames
- [ ] **AC-7.3**: Support PNG, WebP, GIF formats

### Implementation Tasks

#### ImageDecoder Class

- [ ] Create ImageDecoder class
- [ ] Implement constructor from ImageDecoderInit (data + type)
- [ ] Detect image type from magic bytes if not specified
- [ ] Properties: type, complete, completed (Promise), tracks

#### ImageDecoder.decode() Method

- [ ] Decode image data using FFmpeg image codecs
- [ ] Create VideoFrame from decoded pixels
- [ ] Handle frameIndex option for animated images
- [ ] Return Promise<ImageDecodeResult>

#### ImageTrackList / ImageTrack Classes

- [ ] Implement ImageTrackList with length, selectedIndex
- [ ] Implement ImageTrack with animated, primary, frameCount, repetitionCount

### Test Files

- [ ] `test/stories/a7-image-decoder.js`

---

# Capability 6: Codec Support Detection

## User Story A6: Check Codec Support (P6)

> As a developer, I want to check if a codec is supported before using it so that I can provide fallbacks.

### Acceptance Criteria

- [ ] **AC-6.1**: isConfigSupported() returns {supported: true} for valid H.264 config
- [ ] **AC-6.2**: isConfigSupported() returns {supported: false} for unsupported codec
- [ ] **AC-6.3**: Returned config contains only recognized properties

### Implementation Tasks

#### VideoEncoder.isConfigSupported() Static Method

- [ ] Implement as async static method
- [ ] Clone and normalize config (remove unrecognized properties)
- [ ] Check if codec is available in FFmpeg
- [ ] Validate dimensions and parameters
- [ ] Return VideoEncoderSupport { supported, config }

#### VideoDecoder.isConfigSupported() Static Method

- [ ] Same pattern as encoder

#### AudioEncoder.isConfigSupported() Static Method

- [ ] Same pattern for audio

#### AudioDecoder.isConfigSupported() Static Method

- [ ] Same pattern for audio

### Test Files

- [ ] `test/stories/a6-codec-support.js`

---

# Capability 7: Error Handling

## User Story D2: Error Handling and Recovery (P2)

> As a developer, I want clear error messages and recovery options so that I can handle edge cases gracefully.

### Acceptance Criteria

- [x] **AC-D2.1**: InvalidStateError thrown when calling encode() on unconfigured encoder
- [ ] **AC-D2.2**: DataError thrown on corrupt encoded data, decoder recoverable via reset()
- [ ] **AC-D2.3**: reset() returns encoder to unconfigured state

### Implementation Tasks

#### Error Type Implementation

- [ ] Create DOMException-compatible error class
- [ ] Implement error types:
  - [ ] `TypeError` - Invalid config, detached data
  - [x] `InvalidStateError` - Wrong state operations
  - [ ] `DataError` - Malformed codec data
  - [ ] `NotSupportedError` - Unsupported config
  - [ ] `EncodingError` - Codec failures
  - [ ] `AbortError` - User-initiated interruption
  - [ ] `QuotaExceededError` - Resource limits

#### State Machine Validation

- [x] Validate state before configure() (not closed)
- [x] Validate state before encode/decode() (configured)
- [ ] Validate state before flush() (configured)
- [x] Validate state before reset() (not closed)
- [x] Make close() idempotent

#### Error Callback Integration

- [x] Store error callback reference in constructor
- [ ] Call error callback for async errors (not throw)
- [ ] Include error context in callback

### Test Files

- [x] `test/stories/d2-error-handling.js` - Scaffolding created

---

# Capability 8: Memory Management

## User Story D3: Memory Management (P3)

> As a developer running long-lived servers, I want proper resource cleanup so that I can avoid memory leaks.

### Acceptance Criteria

- [ ] **AC-D3.1**: VideoFrame.close() immediately frees memory
- [ ] **AC-D3.2**: Memory stable when processing 1000+ frames with proper close()
- [ ] **AC-D3.3**: GC eventually frees unclosed resources (with warning)

### Implementation Tasks

#### VideoFrame Resource Management

- [x] Store pixel data in internal buffer
- [x] Implement close() to free buffer immediately
- [x] Track closed/detached state
- [ ] Implement clone() to copy data
- [ ] Prevent operations on detached frames
- [ ] Warn in debug mode when GC collects unclosed frame

#### AudioData Resource Management

- [ ] Same pattern as VideoFrame

#### Transfer Semantics

- [ ] Support `transfer` option in VideoFrame constructor
- [ ] Support `transfer` option in AudioData constructor
- [ ] Detach source buffer when transferred

#### copyTo() Method

- [ ] Implement VideoFrame.copyTo(destination, options)
- [ ] Calculate allocation size with allocationSize()
- [ ] Support rect option for partial copy
- [ ] Support format option for conversion
- [ ] Support layout option for custom strides
- [ ] Return Promise<sequence<PlaneLayout>>

### Test Files

- [ ] `test/stories/d3-memory-management.js`

---

# Capability 9: Hardware Acceleration

## User Story A8: Hardware Acceleration (P8)

> As a developer with GPU encoding support, I want to use hardware acceleration so that I can encode faster with less CPU.

### Acceptance Criteria

- [ ] **AC-8.1**: Encoding uses GPU when hardwareAcceleration is "prefer-hardware"
- [ ] **AC-8.2**: Graceful fallback to software if hardware unavailable

### Implementation Tasks

#### Hardware Acceleration Detection

- [ ] Detect VAAPI (Linux)
- [ ] Detect VideoToolbox (macOS)
- [ ] Detect NVENC/NVDEC (NVIDIA)
- [ ] Detect QSV (Intel)

#### Hardware Encoder Selection

- [ ] Query available hardware encoders
- [ ] Map HardwareAcceleration enum to FFmpeg hw_accel
- [ ] Configure hardware encoder context
- [ ] Handle hardware frame allocation

#### Hardware Decoder Selection

- [ ] Same pattern for decoders

#### Hardware Frame Transfer

- [ ] Implement GPU ↔ CPU frame transfer
- [ ] Handle hardware surface formats

### Test Files

- [ ] `test/stories/a8-hardware-acceleration.js`

---

# Capability 10: TypeScript & Developer Experience

## User Story D4: TypeScript Type Definitions (P4)

> As a TypeScript developer, I want accurate type definitions so that I can use the API with type safety.

### Acceptance Criteria

- [x] **AC-D4.1**: All types importable in TypeScript
- [ ] **AC-D4.2**: Compile-time errors for incorrect usage
- [ ] **AC-D4.3**: Autocomplete shows all properties with correct types

### Implementation Tasks

#### Type Definitions

- [x] VideoEncoderConfig interface
- [x] VideoEncoderInit interface
- [x] VideoFrameInit interface
- [ ] VideoFrameBufferInit interface
- [ ] VideoDecoderConfig interface
- [ ] VideoDecoderInit interface
- [ ] AudioEncoderConfig interface
- [ ] AudioEncoderInit interface
- [ ] AudioDataInit interface
- [ ] AudioDecoderConfig interface
- [ ] AudioDecoderInit interface
- [ ] EncodedVideoChunkInit interface
- [ ] EncodedAudioChunkInit interface
- [ ] VideoColorSpaceInit interface
- [ ] ImageDecoderInit interface
- [ ] ImageDecodeOptions interface

#### Enum Types

- [x] CodecState type
- [x] EncodedVideoChunkType / EncodedAudioChunkType
- [ ] VideoPixelFormat enum
- [ ] AudioSampleFormat enum
- [ ] HardwareAcceleration enum
- [ ] AlphaOption enum
- [ ] LatencyMode enum
- [ ] BitrateMode enum
- [ ] VideoColorPrimaries enum
- [ ] VideoTransferCharacteristics enum
- [ ] VideoMatrixCoefficients enum

#### Class Definitions

- [x] VideoEncoder class
- [x] VideoFrame class
- [x] EncodedVideoChunk class
- [ ] VideoDecoder class
- [ ] AudioEncoder class
- [ ] AudioDecoder class
- [ ] AudioData class
- [ ] EncodedAudioChunk class
- [ ] VideoColorSpace class
- [ ] ImageDecoder class
- [ ] ImageTrackList class
- [ ] ImageTrack class

### Test Files

- [ ] `test/stories/d4-typescript-types.ts`

---

## User Story D5: Performance Benchmarking (P5)

> As a developer choosing an implementation, I want to benchmark performance so that I can make informed decisions.

### Acceptance Criteria

- [ ] **AC-D5.1**: Benchmark reports FPS, encoding time, memory usage
- [ ] **AC-D5.2**: FFmpeg native achieves 30+ fps for 1080p
- [ ] **AC-D5.3**: Pure JS performance documented vs native

### Implementation Tasks

- [ ] Create benchmark harness
- [ ] Benchmark VideoEncoder throughput
- [ ] Benchmark VideoDecoder throughput
- [ ] Benchmark memory usage over time
- [ ] Compare FFmpeg vs Pure JS implementations
- [ ] Generate performance report

### Test Files

- [ ] `test/stories/d5-benchmark.js`

---

# Cross-Cutting Implementation Tasks

## Pixel Format Conversion

- [x] RGBA → YUV420P (for encoding)
- [ ] YUV420P → RGBA (for decoding)
- [ ] NV12 ↔ YUV420P
- [ ] BGRA ↔ RGBA
- [ ] I422, I444 support
- [ ] Handle alpha channel (I420A)

## Audio Sample Format Conversion

- [ ] Interleaved ↔ planar conversion
- [ ] u8 ↔ s16 ↔ s32 ↔ f32 conversion
- [ ] Resampling support

## Codec String Parsing

- [x] H.264: "avc1.PPCCLL" (basic)
- [ ] H.264: Full profile/level mapping
- [ ] VP8: "vp8"
- [ ] VP9: "vp09.PP.LL.DD"
- [ ] AV1: "av01.P.LLT.DD"
- [ ] HEVC: "hev1.*", "hvc1.*"
- [ ] AAC: "mp4a.40.N"
- [ ] Opus: "opus"

## VideoColorSpace Class

- [ ] Constructor from VideoColorSpaceInit
- [ ] Properties: primaries, transfer, matrix, fullRange
- [ ] toJSON() method
- [ ] Color space conversion support

## Async/Threading

- [ ] Implement AsyncWorker for encode operations
- [ ] Implement AsyncWorker for decode operations
- [ ] Proper Promise handling for flush()
- [ ] Queue processing model
- [ ] Codec saturation handling

---

# Alternative Implementations

## Browser Extraction (B1, B2)

- [ ] Clone Chromium WebCodecs source
- [ ] Identify dependencies (Blink, media/)
- [ ] Create dependency stubs
- [ ] Create standalone CMake build
- [ ] Create Node.js native addon wrapper
- [ ] Cross-platform build (Windows, macOS, Linux)

## Pure JavaScript (C1, C2, C3)

- [ ] Integrate OpenH264 WASM for H.264
- [ ] Integrate libvpx WASM for VP8/VP9
- [ ] Integrate libaom/dav1d WASM for AV1
- [ ] Integrate opus.js for Opus
- [ ] Implement pure JS pixel format conversion
- [ ] Implement pure JS audio format conversion
- [ ] Ensure zero native dependencies
- [ ] Document performance characteristics

---

# Summary

## Implementation Progress

| Capability | Stories | Done | In Progress | Not Started |
|------------|---------|------|-------------|-------------|
| Video Encoding | A1, A3 | 0 | 1 | 1 |
| Video Decoding | A2 | 0 | 0 | 1 |
| Audio Encoding | A4 | 0 | 0 | 1 |
| Audio Decoding | A5 | 0 | 0 | 1 |
| Image Decoding | A7 | 0 | 0 | 1 |
| Codec Support | A6 | 0 | 0 | 1 |
| Error Handling | D2 | 0 | 1 | 0 |
| Memory Management | D3 | 0 | 0 | 1 |
| Hardware Accel | A8 | 0 | 0 | 1 |
| TypeScript/DX | D4, D5 | 0 | 1 | 1 |
| Browser Extract | B1, B2 | 0 | 0 | 2 |
| Pure JavaScript | C1-C3 | 0 | 0 | 3 |

## Priority Order

1. **P1**: A1 (Video Encode) - Core functionality
2. **P2**: A2 (Video Decode), D2 (Error Handling) - Complete video pipeline
3. **P3**: A3 (Transcode), D3 (Memory) - Production readiness
4. **P4**: A4 (Audio Encode), D4 (TypeScript) - Audio support
5. **P5**: A5 (Audio Decode), D5 (Benchmark) - Complete audio
6. **P6**: A6 (Codec Support) - Developer experience
7. **P7**: A7 (Image Decode) - Extended functionality
8. **P8**: A8 (Hardware Accel) - Performance optimization

---

*Generated from W3C WebCodecs specification: https://www.w3.org/TR/webcodecs/*
