# WebCodecs API Complete Implementation TODO

This document provides a comprehensive, spec-compliant TODO list for implementing the WebCodecs API via three different approaches:

1. **FFmpeg Native Bindings** - Forward WebCodecs calls to FFmpeg via C/C++ bindings
2. **Browser Extraction** - Extract WebCodecs implementation from Chromium/Firefox for standalone use
3. **Pure JavaScript** - Slow but functional pure JS implementation

---

## Table of Contents

- [Part 1: Specification Reference](#part-1-specification-reference)
- [Part 2: FFmpeg Native Bindings Implementation](#part-2-ffmpeg-native-bindings-implementation)
- [Part 3: Browser Extraction Implementation](#part-3-browser-extraction-implementation)
- [Part 4: Pure JavaScript Implementation](#part-4-pure-javascript-implementation)

---

# Part 1: Specification Reference

## 1.1 Core Interfaces

### 1.1.1 VideoEncoder
```
Interface: VideoEncoder
├── Constructor(VideoEncoderInit init)
├── Properties (readonly):
│   ├── state: CodecState
│   ├── encodeQueueSize: unsigned long
│   └── ondequeue: EventHandler
├── Methods:
│   ├── configure(VideoEncoderConfig config): undefined
│   ├── encode(VideoFrame frame, optional VideoEncoderEncodeOptions options): undefined
│   ├── flush(): Promise<undefined>
│   ├── reset(): undefined
│   └── close(): undefined
├── Static Methods:
│   └── isConfigSupported(VideoEncoderConfig config): Promise<VideoEncoderSupport>
└── Events:
    └── dequeue
```

### 1.1.2 VideoDecoder
```
Interface: VideoDecoder
├── Constructor(VideoDecoderInit init)
├── Properties (readonly):
│   ├── state: CodecState
│   ├── decodeQueueSize: unsigned long
│   └── ondequeue: EventHandler
├── Methods:
│   ├── configure(VideoDecoderConfig config): undefined
│   ├── decode(EncodedVideoChunk chunk): undefined
│   ├── flush(): Promise<undefined>
│   ├── reset(): undefined
│   └── close(): undefined
├── Static Methods:
│   └── isConfigSupported(VideoDecoderConfig config): Promise<VideoDecoderSupport>
└── Events:
    └── dequeue
```

### 1.1.3 AudioEncoder
```
Interface: AudioEncoder
├── Constructor(AudioEncoderInit init)
├── Properties (readonly):
│   ├── state: CodecState
│   ├── encodeQueueSize: unsigned long
│   └── ondequeue: EventHandler
├── Methods:
│   ├── configure(AudioEncoderConfig config): undefined
│   ├── encode(AudioData data): undefined
│   ├── flush(): Promise<undefined>
│   ├── reset(): undefined
│   └── close(): undefined
├── Static Methods:
│   └── isConfigSupported(AudioEncoderConfig config): Promise<AudioEncoderSupport>
└── Events:
    └── dequeue
```

### 1.1.4 AudioDecoder
```
Interface: AudioDecoder
├── Constructor(AudioDecoderInit init)
├── Properties (readonly):
│   ├── state: CodecState
│   ├── decodeQueueSize: unsigned long
│   └── ondequeue: EventHandler
├── Methods:
│   ├── configure(AudioDecoderConfig config): undefined
│   ├── decode(EncodedAudioChunk chunk): undefined
│   ├── flush(): Promise<undefined>
│   ├── reset(): undefined
│   └── close(): undefined
├── Static Methods:
│   └── isConfigSupported(AudioDecoderConfig config): Promise<AudioDecoderSupport>
└── Events:
    └── dequeue
```

### 1.1.5 VideoFrame
```
Interface: VideoFrame
├── Constructor(CanvasImageSource image, optional VideoFrameInit init)
├── Constructor(ArrayBuffer data, VideoFrameBufferInit init)
├── Properties (readonly):
│   ├── format: VideoPixelFormat | null
│   ├── codedWidth: unsigned long
│   ├── codedHeight: unsigned long
│   ├── codedRect: DOMRectReadOnly
│   ├── visibleRect: DOMRectReadOnly
│   ├── displayWidth: unsigned long
│   ├── displayHeight: unsigned long
│   ├── duration: long long | null
│   ├── timestamp: long long
│   └── colorSpace: VideoColorSpace
├── Methods:
│   ├── allocationSize(VideoFrameCopyToOptions options): unsigned long
│   ├── copyTo(BufferSource destination, VideoFrameCopyToOptions options): Promise<sequence<PlaneLayout>>
│   ├── clone(): VideoFrame
│   └── close(): undefined
```

### 1.1.6 AudioData
```
Interface: AudioData
├── Constructor(AudioDataInit init)
├── Properties (readonly):
│   ├── format: AudioSampleFormat | null
│   ├── sampleRate: unsigned long
│   ├── numberOfFrames: unsigned long
│   ├── numberOfChannels: unsigned long
│   ├── duration: long long
│   └── timestamp: long long
├── Methods:
│   ├── allocationSize(AudioDataCopyToOptions options): unsigned long
│   ├── copyTo(BufferSource destination, AudioDataCopyToOptions options): undefined
│   ├── clone(): AudioData
│   └── close(): undefined
```

### 1.1.7 EncodedVideoChunk
```
Interface: EncodedVideoChunk
├── Constructor(EncodedVideoChunkInit init)
├── Properties (readonly):
│   ├── type: EncodedVideoChunkType
│   ├── timestamp: long long
│   ├── duration: unsigned long long | null
│   └── byteLength: unsigned long
├── Methods:
│   └── copyTo(BufferSource destination): undefined
```

### 1.1.8 EncodedAudioChunk
```
Interface: EncodedAudioChunk
├── Constructor(EncodedAudioChunkInit init)
├── Properties (readonly):
│   ├── type: EncodedAudioChunkType
│   ├── timestamp: long long
│   ├── duration: unsigned long long | null
│   └── byteLength: unsigned long
├── Methods:
│   └── copyTo(BufferSource destination): undefined
```

### 1.1.9 VideoColorSpace
```
Interface: VideoColorSpace
├── Constructor(optional VideoColorSpaceInit init)
├── Properties (readonly):
│   ├── primaries: VideoColorPrimaries
│   ├── transfer: VideoTransferCharacteristics
│   ├── matrix: VideoMatrixCoefficients
│   └── fullRange: boolean
├── Methods:
│   └── toJSON(): VideoColorSpaceInit
```

### 1.1.10 ImageDecoder
```
Interface: ImageDecoder
├── Constructor(ImageDecoderInit init)
├── Properties (readonly):
│   ├── type: DOMString
│   ├── complete: boolean
│   ├── completed: Promise<undefined>
│   └── tracks: ImageTrackList
├── Methods:
│   ├── decode(optional ImageDecodeOptions options): Promise<ImageDecodeResult>
│   ├── reset(): undefined
│   └── close(): undefined
```

## 1.2 Dictionary Types

### VideoEncoderConfig
- `codec`: string (required) - Codec string like "avc1.42001E", "vp8", "vp09.00.10.08"
- `width`: unsigned long (required)
- `height`: unsigned long (required)
- `displayWidth`: unsigned long (optional)
- `displayHeight`: unsigned long (optional)
- `bitrate`: unsigned long long (optional)
- `framerate`: double (optional)
- `hardwareAcceleration`: HardwareAcceleration (optional)
- `alpha`: AlphaOption (optional)
- `scalabilityMode`: string (optional)
- `bitrateMode`: VideoEncoderBitrateMode (optional)
- `latencyMode`: LatencyMode (optional)
- `contentHint`: string (optional)

### VideoDecoderConfig
- `codec`: string (required)
- `codedWidth`: unsigned long (optional)
- `codedHeight`: unsigned long (optional)
- `displayAspectWidth`: unsigned long (optional)
- `displayAspectHeight`: unsigned long (optional)
- `colorSpace`: VideoColorSpaceInit (optional)
- `hardwareAcceleration`: HardwareAcceleration (optional)
- `optimizeForLatency`: boolean (optional)
- `description`: BufferSource (optional)
- `rotation`: unsigned short (optional) - 0, 90, 180, 270
- `flip`: boolean (optional)

### AudioEncoderConfig
- `codec`: string (required) - e.g., "opus", "aac", "mp3"
- `sampleRate`: unsigned long (required)
- `numberOfChannels`: unsigned long (required)
- `bitrate`: unsigned long long (optional)
- `bitrateMode`: BitrateMode (optional)

### AudioDecoderConfig
- `codec`: string (required)
- `sampleRate`: unsigned long (required)
- `numberOfChannels`: unsigned long (required)
- `description`: BufferSource (optional)

### VideoFrameInit
- `duration`: long long (optional)
- `timestamp`: long long (optional)
- `alpha`: AlphaOption (optional)
- `visibleRect`: DOMRectInit (optional)
- `displayWidth`: unsigned long (optional)
- `displayHeight`: unsigned long (optional)
- `colorSpace`: VideoColorSpaceInit (optional)
- `transfer`: sequence<ArrayBuffer> (optional)

### VideoFrameBufferInit
- `format`: VideoPixelFormat (required)
- `codedWidth`: unsigned long (required)
- `codedHeight`: unsigned long (required)
- `timestamp`: long long (required)
- `duration`: long long (optional)
- `layout`: sequence<PlaneLayout> (optional)
- `visibleRect`: DOMRectInit (optional)
- `displayWidth`: unsigned long (optional)
- `displayHeight`: unsigned long (optional)
- `colorSpace`: VideoColorSpaceInit (optional)
- `transfer`: sequence<ArrayBuffer> (optional)

### AudioDataInit
- `format`: AudioSampleFormat (required)
- `sampleRate`: unsigned long (required)
- `numberOfFrames`: unsigned long (required)
- `numberOfChannels`: unsigned long (required)
- `timestamp`: long long (required)
- `data`: BufferSource (required)
- `transfer`: sequence<ArrayBuffer> (optional)

### VideoColorSpaceInit
- `primaries`: VideoColorPrimaries (optional)
- `transfer`: VideoTransferCharacteristics (optional)
- `matrix`: VideoMatrixCoefficients (optional)
- `fullRange`: boolean (optional)

### PlaneLayout
- `offset`: unsigned long (required)
- `stride`: long (required)

### VideoFrameCopyToOptions
- `rect`: DOMRectInit (optional)
- `layout`: sequence<PlaneLayout> (optional)
- `format`: VideoPixelFormat (optional)

### AudioDataCopyToOptions
- `planeIndex`: unsigned long (required)
- `frameOffset`: unsigned long (optional)
- `frameCount`: unsigned long (optional)
- `format`: AudioSampleFormat (optional)

## 1.3 Enum Types

### CodecState
- `"unconfigured"`
- `"configured"`
- `"closed"`

### EncodedVideoChunkType / EncodedAudioChunkType
- `"key"`
- `"delta"`

### VideoPixelFormat
- `"I420"` - YUV 4:2:0 planar
- `"I420A"` - YUV 4:2:0 planar with alpha
- `"I422"` - YUV 4:2:2 planar
- `"I444"` - YUV 4:4:4 planar
- `"NV12"` - YUV 4:2:0 semi-planar
- `"RGBA"` - RGBA packed
- `"RGBX"` - RGB packed (alpha ignored)
- `"BGRA"` - BGRA packed
- `"BGRX"` - BGR packed (alpha ignored)

### AudioSampleFormat
- `"u8"` - Unsigned 8-bit integer (interleaved)
- `"s16"` - Signed 16-bit integer (interleaved)
- `"s32"` - Signed 32-bit integer (interleaved)
- `"f32"` - 32-bit float (interleaved)
- `"u8-planar"` - Unsigned 8-bit integer (planar)
- `"s16-planar"` - Signed 16-bit integer (planar)
- `"s32-planar"` - Signed 32-bit integer (planar)
- `"f32-planar"` - 32-bit float (planar)

### HardwareAcceleration
- `"no-preference"`
- `"prefer-hardware"`
- `"prefer-software"`

### AlphaOption
- `"discard"`
- `"keep"`

### LatencyMode
- `"quality"`
- `"realtime"`

### BitrateMode / VideoEncoderBitrateMode
- `"variable"`
- `"constant"`
- `"quantizer"` (VideoEncoderBitrateMode only)

### VideoColorPrimaries
- `"bt709"`, `"bt470bg"`, `"smpte170m"`, `"bt2020"`, `"smpte432"`, `"film"`, `"xyz"`, `"smpte431"`, `"smpte428"`, `"bt878"`

### VideoTransferCharacteristics
- `"bt709"`, `"smpte170m"`, `"smpte240m"`, `"linear"`, `"iec61966-2-1"` (sRGB), `"pq"`, `"hlg"`, `"bt2020-10"`, `"bt2020-12"`

### VideoMatrixCoefficients
- `"rgb"`, `"bt709"`, `"bt470bg"`, `"smpte170m"`, `"bt2020-ncl"`, `"bt2020-cl"`, `"ycgco"`

## 1.4 Callback Types

### VideoFrameOutputCallback
```typescript
(frame: VideoFrame) => void
```

### AudioDataOutputCallback
```typescript
(data: AudioData) => void
```

### EncodedVideoChunkOutputCallback
```typescript
(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void
```

### EncodedAudioChunkOutputCallback
```typescript
(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void
```

### WebCodecsErrorCallback
```typescript
(error: DOMException) => void
```

---

# Part 2: FFmpeg Native Bindings Implementation

## 2.1 Project Setup

- [ ] **2.1.1** Create project structure
  - `/src/` - C++ native addon source
  - `/lib/` - TypeScript wrapper layer
  - `/test/` - Test files
  - `/examples/` - Example usage

- [ ] **2.1.2** Configure build system (CMake)
  - Link FFmpeg libraries: libavcodec, libavutil, libswscale, libavformat, libswresample
  - Configure node-addon-api
  - Set C++17 standard

- [ ] **2.1.3** Create package.json with dependencies
  - node-addon-api
  - cmake-js
  - TypeScript

## 2.2 VideoEncoder (FFmpeg)

### 2.2.1 Native Layer (C++)

- [x] **2.2.1.1** Create VideoEncoder class inheriting from Napi::ObjectWrap
- [x] **2.2.1.2** Implement constructor accepting VideoEncoderInit
  - Store output callback reference
  - Store error callback reference
  - Initialize state to "unconfigured"
- [x] **2.2.1.3** Implement `state` property getter
- [ ] **2.2.1.4** Implement `encodeQueueSize` property getter
- [ ] **2.2.1.5** Implement `ondequeue` event handler property

- [x] **2.2.1.6** Implement `configure(VideoEncoderConfig)` method
  - [ ] Parse codec string (avc1.PPCCLL, vp8, vp9, av1, etc.)
  - [x] Map to FFmpeg codec (AV_CODEC_ID_H264, AV_CODEC_ID_VP8, etc.)
  - [x] Create AVCodecContext with parsed parameters
  - [x] Configure encoder options (bitrate, framerate, GOP size)
  - [ ] Handle hardwareAcceleration option
  - [ ] Handle latencyMode option
  - [ ] Handle bitrateMode option (CBR/VBR/quantizer)
  - [ ] Handle scalabilityMode for SVC
  - [x] Open codec with avcodec_open2()
  - [x] Set state to "configured"

- [x] **2.2.1.7** Implement `encode(VideoFrame, options)` method
  - [x] Validate state is "configured"
  - [x] Convert VideoFrame pixel format to AVFrame
  - [x] Use libswscale for format conversion (RGBA → YUV420P)
  - [x] Set PTS from frame timestamp
  - [x] Send frame via avcodec_send_frame()
  - [x] Receive packets via avcodec_receive_packet() in loop
  - [x] Create EncodedVideoChunk for each packet
  - [x] Call output callback with chunk and metadata
  - [ ] Handle keyFrame option in VideoEncoderEncodeOptions

- [x] **2.2.1.8** Implement `flush()` method
  - [x] Send NULL frame to flush encoder
  - [x] Receive remaining packets
  - [x] Return Promise that resolves when complete

- [ ] **2.2.1.9** Implement `reset()` method
  - Flush encoder
  - Reset to "unconfigured" state
  - Release FFmpeg resources

- [x] **2.2.1.10** Implement `close()` method
  - [x] Free AVCodecContext
  - [x] Free AVFrame
  - [x] Free AVPacket
  - [x] Free SwsContext
  - [x] Set state to "closed"

- [ ] **2.2.1.11** Implement static `isConfigSupported(config)` method
  - Check if codec is available in FFmpeg
  - Validate dimensions and parameters
  - Return VideoEncoderSupport with supported=true/false

### 2.2.2 TypeScript Wrapper

- [x] **2.2.2.1** Create VideoEncoder class wrapping native
- [x] **2.2.2.2** Implement type-safe configure() with VideoEncoderConfig
- [x] **2.2.2.3** Implement encode() accepting VideoFrame
- [x] **2.2.2.4** Implement flush() returning Promise
- [x] **2.2.2.5** Implement close()
- [ ] **2.2.2.6** Implement reset()
- [ ] **2.2.2.7** Implement static isConfigSupported()
- [ ] **2.2.2.8** Implement encodeQueueSize property
- [ ] **2.2.2.9** Implement ondequeue event handler

## 2.3 VideoDecoder (FFmpeg)

### 2.3.1 Native Layer (C++)

- [ ] **2.3.1.1** Create VideoDecoder class inheriting from Napi::ObjectWrap
- [ ] **2.3.1.2** Implement constructor accepting VideoDecoderInit
  - Store output callback reference
  - Store error callback reference
  - Initialize state to "unconfigured"

- [ ] **2.3.1.3** Implement `configure(VideoDecoderConfig)` method
  - Parse codec string
  - Find decoder via avcodec_find_decoder()
  - Create AVCodecContext
  - Handle description (extradata) if provided
  - Handle colorSpace, hardwareAcceleration options
  - Open codec

- [ ] **2.3.1.4** Implement `decode(EncodedVideoChunk)` method
  - Create AVPacket from chunk data
  - Set PTS from chunk timestamp
  - Set key frame flag if chunk.type === "key"
  - Send packet via avcodec_send_packet()
  - Receive frames via avcodec_receive_frame()
  - Create VideoFrame for each decoded frame
  - Call output callback

- [ ] **2.3.1.5** Implement `flush()` method
  - Send NULL packet to flush decoder
  - Receive remaining frames

- [ ] **2.3.1.6** Implement `reset()` method
- [ ] **2.3.1.7** Implement `close()` method
- [ ] **2.3.1.8** Implement static `isConfigSupported(config)` method

### 2.3.2 TypeScript Wrapper

- [ ] **2.3.2.1** Create VideoDecoder class wrapping native
- [ ] **2.3.2.2** Implement all methods with type safety

## 2.4 AudioEncoder (FFmpeg)

### 2.4.1 Native Layer (C++)

- [ ] **2.4.1.1** Create AudioEncoder class inheriting from Napi::ObjectWrap
- [ ] **2.4.1.2** Implement constructor accepting AudioEncoderInit

- [ ] **2.4.1.3** Implement `configure(AudioEncoderConfig)` method
  - Map codec string to FFmpeg (opus→AV_CODEC_ID_OPUS, aac→AV_CODEC_ID_AAC)
  - Set sample_rate, channels, channel_layout
  - Set sample_fmt based on encoder requirements
  - Handle bitrate and bitrateMode

- [ ] **2.4.1.4** Implement `encode(AudioData)` method
  - Convert AudioData to AVFrame
  - Handle sample format conversion with libswresample
  - Send frame to encoder
  - Receive encoded packets
  - Create EncodedAudioChunk for each packet

- [ ] **2.4.1.5** Implement `flush()` method
- [ ] **2.4.1.6** Implement `reset()` method
- [ ] **2.4.1.7** Implement `close()` method
- [ ] **2.4.1.8** Implement static `isConfigSupported(config)` method

### 2.4.2 TypeScript Wrapper

- [ ] **2.4.2.1** Create AudioEncoder class wrapping native
- [ ] **2.4.2.2** Implement all methods with type safety

## 2.5 AudioDecoder (FFmpeg)

### 2.5.1 Native Layer (C++)

- [ ] **2.5.1.1** Create AudioDecoder class inheriting from Napi::ObjectWrap
- [ ] **2.5.1.2** Implement constructor
- [ ] **2.5.1.3** Implement `configure(AudioDecoderConfig)` method
- [ ] **2.5.1.4** Implement `decode(EncodedAudioChunk)` method
- [ ] **2.5.1.5** Implement `flush()` method
- [ ] **2.5.1.6** Implement `reset()` method
- [ ] **2.5.1.7** Implement `close()` method
- [ ] **2.5.1.8** Implement static `isConfigSupported(config)` method

### 2.5.2 TypeScript Wrapper

- [ ] **2.5.2.1** Create AudioDecoder class wrapping native
- [ ] **2.5.2.2** Implement all methods with type safety

## 2.6 VideoFrame (FFmpeg)

### 2.6.1 Native Layer (C++)

- [x] **2.6.1.1** Create VideoFrame class inheriting from Napi::ObjectWrap
- [x] **2.6.1.2** Implement constructor from ArrayBuffer + VideoFrameBufferInit
  - [x] Parse format, codedWidth, codedHeight, timestamp
  - [x] Copy pixel data into internal buffer
  - [ ] Handle layout parameter for custom plane strides
  - [ ] Handle visibleRect
  - [ ] Handle displayWidth, displayHeight
  - [ ] Handle colorSpace

- [ ] **2.6.1.3** Implement constructor from CanvasImageSource (for browser compat)
  - Note: May not apply to Node.js, can skip or stub

- [x] **2.6.1.4** Implement property getters
  - [x] format
  - [x] codedWidth
  - [x] codedHeight
  - [ ] codedRect (DOMRectReadOnly)
  - [ ] visibleRect (DOMRectReadOnly)
  - [ ] displayWidth
  - [ ] displayHeight
  - [ ] duration
  - [x] timestamp
  - [ ] colorSpace (VideoColorSpace)

- [ ] **2.6.1.5** Implement `allocationSize(options)` method
  - Calculate bytes needed based on format and options

- [ ] **2.6.1.6** Implement `copyTo(destination, options)` method
  - Copy pixel data to provided buffer
  - Handle rect option for partial copy
  - Handle format conversion
  - Handle layout for custom strides
  - Return Promise<sequence<PlaneLayout>>

- [ ] **2.6.1.7** Implement `clone()` method
  - Create new VideoFrame with copied data

- [x] **2.6.1.8** Implement `close()` method
  - [x] Release pixel data

### 2.6.2 TypeScript Wrapper

- [x] **2.6.2.1** Create VideoFrame class wrapping native
- [x] **2.6.2.2** Implement all properties and methods

## 2.7 AudioData (FFmpeg)

### 2.7.1 Native Layer (C++)

- [ ] **2.7.1.1** Create AudioData class inheriting from Napi::ObjectWrap
- [ ] **2.7.1.2** Implement constructor from AudioDataInit
  - Parse format, sampleRate, numberOfFrames, numberOfChannels
  - Copy audio sample data

- [ ] **2.7.1.3** Implement property getters
  - format
  - sampleRate
  - numberOfFrames
  - numberOfChannels
  - duration
  - timestamp

- [ ] **2.7.1.4** Implement `allocationSize(options)` method
- [ ] **2.7.1.5** Implement `copyTo(destination, options)` method
  - Handle planeIndex for planar formats
  - Handle frameOffset and frameCount
  - Handle format conversion

- [ ] **2.7.1.6** Implement `clone()` method
- [ ] **2.7.1.7** Implement `close()` method

### 2.7.2 TypeScript Wrapper

- [ ] **2.7.2.1** Create AudioData class wrapping native
- [ ] **2.7.2.2** Implement all properties and methods

## 2.8 EncodedVideoChunk

- [x] **2.8.1** Implement EncodedVideoChunk class (TypeScript)
  - [x] Constructor accepting EncodedVideoChunkInit
  - [x] type property (readonly)
  - [x] timestamp property (readonly)
  - [x] duration property (readonly)
  - [x] byteLength property (readonly)
  - [ ] copyTo(destination) method

## 2.9 EncodedAudioChunk

- [ ] **2.9.1** Implement EncodedAudioChunk class (TypeScript)
  - Constructor accepting EncodedAudioChunkInit
  - type property (readonly)
  - timestamp property (readonly)
  - duration property (readonly)
  - byteLength property (readonly)
  - copyTo(destination) method

## 2.10 VideoColorSpace

- [ ] **2.10.1** Implement VideoColorSpace class (TypeScript/Native)
  - Constructor accepting optional VideoColorSpaceInit
  - primaries property (readonly)
  - transfer property (readonly)
  - matrix property (readonly)
  - fullRange property (readonly)
  - toJSON() method

## 2.11 ImageDecoder (FFmpeg)

### 2.11.1 Native Layer (C++)

- [ ] **2.11.1.1** Create ImageDecoder class
- [ ] **2.11.1.2** Implement constructor from ImageDecoderInit
  - Accept image data buffer
  - Detect image type from data/type parameter
  - Initialize decoder (use FFmpeg's image2 demuxer or dedicated image codecs)

- [ ] **2.11.1.3** Implement properties
  - type (detected MIME type)
  - complete
  - completed (Promise)
  - tracks (ImageTrackList)

- [ ] **2.11.1.4** Implement `decode(options)` method
  - Decode frame at specified frameIndex
  - Return Promise<ImageDecodeResult>

- [ ] **2.11.1.5** Implement `reset()` method
- [ ] **2.11.1.6** Implement `close()` method

### 2.11.2 ImageTrackList and ImageTrack

- [ ] **2.11.2.1** Implement ImageTrackList class
  - length property
  - selectedIndex property
  - getter(index) method

- [ ] **2.11.2.2** Implement ImageTrack class
  - animated property
  - primary property
  - frameCount property
  - repetitionCount property

## 2.12 Codec String Parsing

- [ ] **2.12.1** Implement H.264/AVC codec string parser
  - Parse "avc1.PPCCLL" format
  - Extract profile (PP), constraint set (CC), level (LL)
  - Map to FFmpeg AV_PROFILE_H264_* constants

- [ ] **2.12.2** Implement VP8 codec string parser
  - Handle "vp8" string

- [ ] **2.12.3** Implement VP9 codec string parser
  - Parse "vp09.PP.LL.DD" format
  - Extract profile, level, bit depth

- [ ] **2.12.4** Implement AV1 codec string parser
  - Parse "av01.P.LLM.DD" format

- [ ] **2.12.5** Implement HEVC/H.265 codec string parser
  - Parse "hev1." or "hvc1." formats

- [ ] **2.12.6** Implement audio codec string parsers
  - "opus" → AV_CODEC_ID_OPUS
  - "mp4a.40.2" (AAC-LC), "mp4a.40.5" (HE-AAC) → AV_CODEC_ID_AAC
  - "mp3" → AV_CODEC_ID_MP3
  - "flac" → AV_CODEC_ID_FLAC
  - "vorbis" → AV_CODEC_ID_VORBIS

## 2.13 Pixel Format Conversion

- [ ] **2.13.1** Implement pixel format conversion utilities using libswscale
  - I420 ↔ NV12 ↔ RGBA ↔ BGRA
  - Handle all VideoPixelFormat types

- [ ] **2.13.2** Implement plane layout calculation
  - Calculate strides and offsets for each format

## 2.14 Audio Format Conversion

- [ ] **2.14.1** Implement audio sample format conversion using libswresample
  - Convert between interleaved and planar formats
  - Convert between sample formats (u8, s16, s32, f32)

## 2.15 Async/Threading

- [ ] **2.15.1** Implement AsyncWorker for encode operations
  - Non-blocking encoding using Napi::AsyncWorker

- [ ] **2.15.2** Implement AsyncWorker for decode operations

- [ ] **2.15.3** Implement proper Promise handling for flush()

## 2.16 Error Handling

- [ ] **2.16.1** Implement proper DOMException creation
  - Map FFmpeg errors to appropriate DOMException types
  - NotSupportedError, InvalidStateError, DataError, etc.

- [ ] **2.16.2** Implement error callback invocation
  - Call error callback with DOMException when appropriate

## 2.17 Hardware Acceleration (Advanced)

- [ ] **2.17.1** Implement hardware acceleration detection
  - Check for VAAPI (Linux)
  - Check for VideoToolbox (macOS)
  - Check for NVENC/NVDEC (NVIDIA)
  - Check for QSV (Intel)

- [ ] **2.17.2** Implement hardware encoder selection
- [ ] **2.17.3** Implement hardware decoder selection
- [ ] **2.17.4** Implement hardware frame transfer (GPU ↔ CPU)

---

# Part 3: Browser Extraction Implementation

## 3.1 Chromium Extraction

### 3.1.1 Source Analysis

- [ ] **3.1.1.1** Clone Chromium source (or fetch relevant directories)
  - `third_party/blink/renderer/modules/webcodecs/`

- [ ] **3.1.1.2** Identify core WebCodecs implementation files
  - `video_encoder.cc/h`
  - `video_decoder.cc/h`
  - `audio_encoder.cc/h`
  - `audio_decoder.cc/h`
  - `video_frame.cc/h`
  - `audio_data.cc/h`
  - `encoded_video_chunk.cc/h`
  - `encoded_audio_chunk.cc/h`
  - `image_decoder_external.cc/h`

- [ ] **3.1.1.3** Identify media pipeline dependencies
  - `media/base/`
  - `media/video/`
  - `media/audio/`
  - `media/mojo/` (may need removal)

- [ ] **3.1.1.4** Identify codec implementations
  - `media/video/vpx_video_encoder.cc`
  - `media/video/av1_video_encoder.cc`
  - `media/video/h264_video_encoder.cc` (platform-specific)
  - OpenH264 integration
  - libaom integration
  - libvpx integration

### 3.1.2 Dependency Resolution

- [ ] **3.1.2.1** List all Chromium base dependencies
  - `base/` (task runners, threading, memory)
  - `mojo/` (IPC - may need stubbing)
  - `gpu/` (hardware acceleration)

- [ ] **3.1.2.2** Create dependency stubs/replacements
  - Replace Chromium base with standalone implementations
  - Stub mojo interfaces with direct calls
  - Abstract GPU dependencies

- [ ] **3.1.2.3** Identify platform-specific code
  - Windows: MediaFoundation
  - macOS: VideoToolbox
  - Linux: VAAPI
  - Android: MediaCodec

### 3.1.3 Build System

- [ ] **3.1.3.1** Create standalone CMake/GN build
  - Extract necessary build rules from Chromium
  - Create new CMakeLists.txt

- [ ] **3.1.3.2** Configure codec library dependencies
  - OpenH264 for H.264 software encoding
  - libaom for AV1
  - libvpx for VP8/VP9
  - libopus for Opus audio

- [ ] **3.1.3.3** Build as shared library
  - Create C API wrapper
  - Export WebCodecs functions

### 3.1.4 Node.js Integration

- [ ] **3.1.4.1** Create Node.js native addon wrapper
  - Wrap extracted C/C++ code with node-addon-api
  - Create JavaScript-friendly API

- [ ] **3.1.4.2** Implement memory management bridge
  - Handle reference counting between V8 and Chromium

- [ ] **3.1.4.3** Implement callback bridge
  - Convert Chromium callbacks to V8 callbacks

## 3.2 Firefox Extraction

### 3.2.1 Source Analysis

- [ ] **3.2.1.1** Clone Firefox source (or fetch relevant directories)
  - `dom/media/webcodecs/`

- [ ] **3.2.1.2** Identify core WebCodecs implementation files

- [ ] **3.2.1.3** Identify media dependencies
  - `media/` directory
  - `gfx/` for frame handling

### 3.2.2 Dependency Resolution

- [ ] **3.2.2.1** List Mozilla-specific dependencies
  - XPCOM
  - MFBT
  - nsIRunnable/nsIThread

- [ ] **3.2.2.2** Create replacement implementations
  - Replace XPCOM with standard C++
  - Replace Mozilla threading with std::thread

### 3.2.3 Build and Integration

- [ ] **3.2.3.1** Create standalone build
- [ ] **3.2.3.2** Create Node.js wrapper

## 3.3 Testing Extracted Implementation

- [ ] **3.3.1** Create conformance test suite
  - Compare behavior with browser WebCodecs
  - Test all codec combinations

- [ ] **3.3.2** Create performance benchmarks
  - Compare with native browser performance

---

# Part 4: Pure JavaScript Implementation

## 4.1 Project Setup

- [ ] **4.1.1** Create project structure
  - `/src/` - TypeScript source
  - `/lib/` - Compiled JavaScript
  - `/test/` - Test files

- [ ] **4.1.2** Configure TypeScript
- [ ] **4.1.3** Add WASM/JS codec dependencies

## 4.2 Codec Libraries (WASM/JS)

### 4.2.1 H.264 Codec

- [ ] **4.2.1.1** Integrate OpenH264 WASM build
  - Use existing openh264-js or similar
  - Or compile OpenH264 to WASM with Emscripten

- [ ] **4.2.1.2** Create H264Encoder wrapper
  - Initialize OpenH264 encoder
  - Implement encode() wrapping native encode
  - Handle parameter sets (SPS/PPS)

- [ ] **4.2.1.3** Create H264Decoder wrapper
  - Initialize OpenH264 decoder
  - Implement decode() wrapping native decode

### 4.2.2 VP8/VP9 Codec

- [ ] **4.2.2.1** Integrate libvpx WASM build
  - Use existing libvpx-js or similar
  - Or compile libvpx to WASM

- [ ] **4.2.2.2** Create VP8Encoder/VP9Encoder wrappers
- [ ] **4.2.2.3** Create VP8Decoder/VP9Decoder wrappers

### 4.2.3 AV1 Codec

- [ ] **4.2.3.1** Integrate libaom/dav1d WASM build
  - dav1d (decoder only) is fast
  - libaom for encoding

- [ ] **4.2.3.2** Create AV1Encoder wrapper
- [ ] **4.2.3.3** Create AV1Decoder wrapper (using dav1d)

### 4.2.4 Opus Audio Codec

- [ ] **4.2.4.1** Integrate opus.js or libopus WASM
- [ ] **4.2.4.2** Create OpusEncoder wrapper
- [ ] **4.2.4.3** Create OpusDecoder wrapper

### 4.2.5 AAC Audio Codec

- [ ] **4.2.5.1** Integrate fdk-aac WASM or aac.js
  - Note: Licensing considerations with FDK-AAC
- [ ] **4.2.5.2** Create AACEncoder wrapper
- [ ] **4.2.5.3** Create AACDecoder wrapper

### 4.2.6 MP3 Codec (Decode only)

- [ ] **4.2.6.1** Integrate mp3 decoder (mpg123-js or similar)
- [ ] **4.2.6.2** Create MP3Decoder wrapper

## 4.3 Pixel Format Conversion (JS)

- [ ] **4.3.1** Implement I420 ↔ RGBA conversion
  - Pure JavaScript YUV→RGB matrix multiplication
  - Optimize with typed arrays

- [ ] **4.3.2** Implement NV12 ↔ RGBA conversion
- [ ] **4.3.3** Implement I422/I444 conversions
- [ ] **4.3.4** Implement BGRA handling

- [ ] **4.3.5** Optional: Integrate SIMD.js or WASM SIMD for performance

## 4.4 Audio Sample Format Conversion (JS)

- [ ] **4.4.1** Implement interleaved ↔ planar conversion
- [ ] **4.4.2** Implement sample type conversion (u8/s16/s32/f32)
- [ ] **4.4.3** Implement channel mixing (mono ↔ stereo, etc.)

## 4.5 VideoEncoder (JS)

- [ ] **4.5.1** Create VideoEncoder class
- [ ] **4.5.2** Implement constructor with init callbacks
- [ ] **4.5.3** Implement state machine (unconfigured/configured/closed)

- [ ] **4.5.4** Implement `configure(config)` method
  - Parse codec string
  - Select appropriate WASM encoder
  - Initialize encoder with config

- [ ] **4.5.5** Implement `encode(frame, options)` method
  - Convert VideoFrame to encoder's expected format
  - Call WASM encoder
  - Wrap output in EncodedVideoChunk
  - Call output callback

- [ ] **4.5.6** Implement `flush()` method
  - Flush WASM encoder
  - Return Promise

- [ ] **4.5.7** Implement `reset()` method
- [ ] **4.5.8** Implement `close()` method
- [ ] **4.5.9** Implement static `isConfigSupported(config)` method

## 4.6 VideoDecoder (JS)

- [ ] **4.6.1** Create VideoDecoder class
- [ ] **4.6.2** Implement constructor with init callbacks

- [ ] **4.6.3** Implement `configure(config)` method
  - Parse codec string
  - Select appropriate WASM decoder
  - Initialize decoder

- [ ] **4.6.4** Implement `decode(chunk)` method
  - Pass encoded data to WASM decoder
  - Create VideoFrame from decoded output
  - Call output callback

- [ ] **4.6.5** Implement `flush()` method
- [ ] **4.6.6** Implement `reset()` method
- [ ] **4.6.7** Implement `close()` method
- [ ] **4.6.8** Implement static `isConfigSupported(config)` method

## 4.7 AudioEncoder (JS)

- [ ] **4.7.1** Create AudioEncoder class
- [ ] **4.7.2** Implement constructor
- [ ] **4.7.3** Implement `configure(config)` method
- [ ] **4.7.4** Implement `encode(audioData)` method
- [ ] **4.7.5** Implement `flush()` method
- [ ] **4.7.6** Implement `reset()` method
- [ ] **4.7.7** Implement `close()` method
- [ ] **4.7.8** Implement static `isConfigSupported(config)` method

## 4.8 AudioDecoder (JS)

- [ ] **4.8.1** Create AudioDecoder class
- [ ] **4.8.2** Implement constructor
- [ ] **4.8.3** Implement `configure(config)` method
- [ ] **4.8.4** Implement `decode(chunk)` method
- [ ] **4.8.5** Implement `flush()` method
- [ ] **4.8.6** Implement `reset()` method
- [ ] **4.8.7** Implement `close()` method
- [ ] **4.8.8** Implement static `isConfigSupported(config)` method

## 4.9 VideoFrame (JS)

- [ ] **4.9.1** Create VideoFrame class
- [ ] **4.9.2** Implement constructor from ArrayBuffer + VideoFrameBufferInit
  - Store raw pixel data
  - Parse and store all init properties

- [ ] **4.9.3** Implement all readonly properties
  - format, codedWidth, codedHeight, codedRect, visibleRect
  - displayWidth, displayHeight, duration, timestamp, colorSpace

- [ ] **4.9.4** Implement `allocationSize(options)` method
  - Calculate buffer size needed

- [ ] **4.9.5** Implement `copyTo(destination, options)` method
  - Copy pixels with format conversion if needed
  - Handle rect/layout options

- [ ] **4.9.6** Implement `clone()` method
- [ ] **4.9.7** Implement `close()` method

## 4.10 AudioData (JS)

- [ ] **4.10.1** Create AudioData class
- [ ] **4.10.2** Implement constructor from AudioDataInit
- [ ] **4.10.3** Implement all readonly properties
- [ ] **4.10.4** Implement `allocationSize(options)` method
- [ ] **4.10.5** Implement `copyTo(destination, options)` method
- [ ] **4.10.6** Implement `clone()` method
- [ ] **4.10.7** Implement `close()` method

## 4.11 EncodedVideoChunk (JS)

- [ ] **4.11.1** Create EncodedVideoChunk class
- [ ] **4.11.2** Implement constructor from EncodedVideoChunkInit
- [ ] **4.11.3** Implement readonly properties (type, timestamp, duration, byteLength)
- [ ] **4.11.4** Implement `copyTo(destination)` method

## 4.12 EncodedAudioChunk (JS)

- [ ] **4.12.1** Create EncodedAudioChunk class
- [ ] **4.12.2** Implement constructor from EncodedAudioChunkInit
- [ ] **4.12.3** Implement readonly properties
- [ ] **4.12.4** Implement `copyTo(destination)` method

## 4.13 VideoColorSpace (JS)

- [ ] **4.13.1** Create VideoColorSpace class
- [ ] **4.13.2** Implement constructor from VideoColorSpaceInit
- [ ] **4.13.3** Implement readonly properties (primaries, transfer, matrix, fullRange)
- [ ] **4.13.4** Implement `toJSON()` method

## 4.14 ImageDecoder (JS)

- [ ] **4.14.1** Create ImageDecoder class
- [ ] **4.14.2** Implement constructor from ImageDecoderInit
- [ ] **4.14.3** Integrate image decoding libraries
  - Use pngjs for PNG
  - Use jpeg-js for JPEG
  - Use gif.js for GIF
  - Use upng-js for animated PNG

- [ ] **4.14.4** Implement `decode(options)` method
- [ ] **4.14.5** Implement ImageTrackList and ImageTrack

## 4.15 Optimization

- [ ] **4.15.1** Use SharedArrayBuffer for zero-copy where possible
- [ ] **4.15.2** Implement Web Worker offloading for heavy operations
- [ ] **4.15.3** Use WASM SIMD for format conversions
- [ ] **4.15.4** Profile and optimize hot paths

---

# Summary Checklist

## FFmpeg Implementation Status

| Component | Native | TypeScript | Complete |
|-----------|--------|------------|----------|
| VideoEncoder | Partial | Partial | No |
| VideoDecoder | No | No | No |
| AudioEncoder | No | No | No |
| AudioDecoder | No | No | No |
| VideoFrame | Partial | Partial | No |
| AudioData | No | No | No |
| EncodedVideoChunk | N/A | Yes | Yes |
| EncodedAudioChunk | No | No | No |
| VideoColorSpace | No | No | No |
| ImageDecoder | No | No | No |

## Browser Extraction Status

| Task | Chromium | Firefox |
|------|----------|---------|
| Source Analysis | No | No |
| Dependency Resolution | No | No |
| Build System | No | No |
| Node.js Integration | No | No |

## Pure JavaScript Status

| Component | Status |
|-----------|--------|
| H.264 WASM | No |
| VP8/VP9 WASM | No |
| AV1 WASM | No |
| Opus WASM | No |
| AAC WASM | No |
| VideoEncoder | No |
| VideoDecoder | No |
| AudioEncoder | No |
| AudioDecoder | No |
| VideoFrame | No |
| AudioData | No |
| Format Conversions | No |

---

*This TODO list was generated based on the W3C WebCodecs specification at https://www.w3.org/TR/webcodecs/*
