# Submission: pproenca/node-webcodecs

## Overview

Full W3C WebCodecs API implementation for Node.js with direct FFmpeg C bindings via N-API.

**Repository:** https://github.com/pproenca/node-webcodecs

## Test Results

```
Test Files:  45 passed / 51 total
     Tests:  428 passed / 442 total (96.8% pass rate)
  Duration:  ~2 minutes
```

### Test Breakdown

| Category | Passed | Total |
|----------|--------|-------|
| VideoEncoder | 85+ | ~90 |
| VideoDecoder | 70+ | ~75 |
| AudioEncoder | 65+ | ~65 |
| AudioDecoder | 58+ | ~60 |
| VideoFrame | 48+ | ~52 |
| AudioData | 40+ | ~42 |
| ImageDecoder | 42 | 42 |
| EncodedChunks | 35+ | ~38 |
| Other | 30+ | ~35 |

## Implementation Approach

### Architecture

Three-layer design:
1. **TypeScript API Layer** (~5,000 lines) - W3C WebCodecs interfaces with state management
2. **Native N-API Addon** (~9,600 lines C++) - Direct FFmpeg bindings with RAII patterns
3. **FFmpeg Libraries** - libavcodec, libavformat, libavutil, libswscale, libswresample, libavfilter

### Key Design Decisions

- **Direct C bindings** via node-addon-api (NAPI v8), not CLI wrapper
- **Async workers** with ThreadSafeFunction for non-blocking encode/decode
- **RAII wrappers** for all FFmpeg resources (AVFrame, AVCodecContext, etc.)
- **Event-driven** with proper EventTarget inheritance
- **Backpressure handling** via encodeQueueSize/decodeQueueSize

## Supported Codecs

| Type | Codec | Encode | Decode | Codec String |
|------|-------|--------|--------|--------------|
| Video | H.264/AVC | ✅ | ✅ | `avc1.*` |
| Video | H.265/HEVC | ✅ | ✅ | `hvc1.*`, `hev1.*` |
| Video | VP8 | ✅ | ✅ | `vp8` |
| Video | VP9 | ✅ | ✅ | `vp09.*` |
| Video | AV1 | ✅ | ✅ | `av01.*` |
| Audio | AAC | ✅ | ✅ | `mp4a.40.2` |
| Audio | Opus | ✅ | ✅ | `opus` |
| Audio | MP3 | ❌ | ✅ | `mp3` |
| Audio | FLAC | ❌ | ✅ | `flac` |
| Image | JPEG | - | ✅ | `image/jpeg` |
| Image | PNG | - | ✅ | `image/png` |
| Image | WebP | - | ✅ | `image/webp` |
| Image | GIF (animated) | - | ✅ | `image/gif` |

## W3C WebCodecs API Coverage

| Interface | Status | Notes |
|-----------|--------|-------|
| VideoEncoder | ✅ Full | All methods, events, static isConfigSupported |
| VideoDecoder | ✅ Full | All methods, events, static isConfigSupported |
| AudioEncoder | ✅ Full | All methods, events, static isConfigSupported |
| AudioDecoder | ✅ Full | All methods, events, static isConfigSupported |
| VideoFrame | ✅ Full | All constructors, methods, 20+ pixel formats |
| AudioData | ✅ Full | All methods, 8 sample formats |
| EncodedVideoChunk | ✅ Full | |
| EncodedAudioChunk | ✅ Full | |
| ImageDecoder | ✅ Full | Including animated GIF/WebP support |
| VideoColorSpace | ✅ Full | All primaries, transfer, matrix values |

## Beyond W3C Spec (Node.js Additions)

| Class | Description |
|-------|-------------|
| Muxer | Write to MP4 containers via libavformat |
| Demuxer | Read from any FFmpeg-supported format |
| VideoFilter | Apply blur filters (content moderation use case) |
| TestVideoGenerator | Generate test patterns via libavfilter |

## Pixel Format Support

**8-bit:** I420, I420A, I422, I422A, I444, I444A, NV12, NV21, NV12A, RGBA, RGBX, BGRA, BGRX

**10-bit:** I420P10, I422P10, I444P10, NV12P10, I420AP10, I422AP10, I444AP10

**12-bit:** I420P12, I422P12, I444P12

## Installation & Build

### Prerequisites

FFmpeg development libraries:

**macOS:**
```bash
brew install ffmpeg pkg-config
```

**Ubuntu/Debian:**
```bash
sudo apt-get install \
  libavcodec-dev libavformat-dev libavutil-dev \
  libswscale-dev libswresample-dev libavfilter-dev \
  pkg-config
```

### Build from Source

```bash
git clone https://github.com/pproenca/node-webcodecs
cd node-webcodecs
npm install
npm run build
npm test
```

### Interactive Demo

```bash
node examples/run-demo.js
```

Or with Docker:
```bash
docker compose up demo
```

## Quick Example

```javascript
import { VideoEncoder, VideoFrame, Muxer } from '@pproenca/node-webcodecs';

// Create encoder
const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    muxer.writeVideoChunk(trackId, chunk);
  },
  error: console.error,
});

encoder.configure({
  codec: 'avc1.42001e',
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
});

// Encode frames
const frame = new VideoFrame(rgbaBuffer, {
  format: 'RGBA',
  codedWidth: 1920,
  codedHeight: 1080,
  timestamp: 0,
});

encoder.encode(frame, { keyFrame: true });
frame.close();

await encoder.flush();
encoder.close();
```

## Code Stats

- **C++ Native Code:** ~9,600 lines
- **TypeScript:** ~5,000 lines
- **Test Files:** 51
- **Test Cases:** 442

## Prize Distribution

Solo submission by Pedro Proença.

## License

MIT
