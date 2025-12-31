# node-webcodecs

W3C WebCodecs API implementation for Node.js - encode and decode video/audio with browser-compatible APIs.

[![Tests](https://img.shields.io/badge/tests-428%2F442%20passing-brightgreen)](test/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-blue)](package.json)

## Why node-webcodecs?

| Feature | node-webcodecs | Browser WebCodecs |
|---------|----------------|-------------------|
| **Video Codecs** | H.264, H.265, VP8, VP9, AV1 | Varies by browser |
| **Audio Codecs** | AAC, Opus, MP3*, FLAC* | Varies by browser |
| **Container Muxing** | MP4 | ❌ Not in spec |
| **Demuxing** | Any FFmpeg format | ❌ Not in spec |
| **Image Decoding** | JPEG, PNG, WebP, GIF (animated) | Same |
| **Pixel Formats** | 20+ formats (8/10/12-bit) | Limited |
| **Server-side** | ✅ | ❌ Browser only |

*\* Decode only*

## Installation

```bash
npm install @pproenca/node-webcodecs
```

**That's it!** Prebuilt binaries with FFmpeg included are available for:

| Platform | Architecture |
|----------|--------------|
| macOS | Apple Silicon (arm64), Intel (x64) |
| Linux | x64 (glibc), x64 (musl/Alpine) |
| Windows | x64 |

### Building from Source

For other platforms, or if you prefer to build from source, install FFmpeg development libraries:

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install ffmpeg pkg-config
npm install @pproenca/node-webcodecs
```
</details>

<details>
<summary><strong>Ubuntu/Debian</strong></summary>

```bash
sudo apt-get install \
  libavcodec-dev libavformat-dev libavutil-dev \
  libswscale-dev libswresample-dev libavfilter-dev \
  pkg-config
npm install @pproenca/node-webcodecs
```
</details>

<details>
<summary><strong>Fedora/RHEL</strong></summary>

```bash
sudo dnf install ffmpeg-devel pkg-config
npm install @pproenca/node-webcodecs
```
</details>

<details>
<summary><strong>Windows</strong></summary>

```bash
# Using vcpkg
vcpkg install ffmpeg
npm install @pproenca/node-webcodecs
```
</details>

To force building from source even when prebuilts are available:

```bash
npm install @pproenca/node-webcodecs --build-from-source
```

## Quick Start

### Encode Video Frames

```javascript
import { VideoEncoder, VideoFrame } from '@pproenca/node-webcodecs';

const chunks = [];

const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    chunks.push(chunk);
    if (metadata?.decoderConfig?.description) {
      // Save codec extradata for container
    }
  },
  error: (e) => console.error('Encode error:', e),
});

encoder.configure({
  codec: 'avc1.42001e',  // H.264 Baseline
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
  framerate: 30,
});

// Create frames from RGBA buffers
for (let i = 0; i < 60; i++) {
  const frame = new VideoFrame(rgbaBuffer, {
    format: 'RGBA',
    codedWidth: 1920,
    codedHeight: 1080,
    timestamp: i * (1_000_000 / 30),  // microseconds
  });

  encoder.encode(frame, { keyFrame: i === 0 });
  frame.close();
}

await encoder.flush();
encoder.close();
```

### Decode Video Chunks

```javascript
import { VideoDecoder, EncodedVideoChunk } from '@pproenca/node-webcodecs';

const decoder = new VideoDecoder({
  output: (frame) => {
    console.log(`Frame: ${frame.codedWidth}x${frame.codedHeight}`);
    // Process frame data...
    frame.close();
  },
  error: (e) => console.error('Decode error:', e),
});

decoder.configure({
  codec: 'avc1.42001e',
  codedWidth: 1920,
  codedHeight: 1080,
  description: codecExtradata,  // From container or encoder
});

for (const chunk of encodedChunks) {
  decoder.decode(new EncodedVideoChunk({
    type: chunk.isKeyframe ? 'key' : 'delta',
    timestamp: chunk.timestamp,
    data: chunk.data,
  }));
}

await decoder.flush();
decoder.close();
```

### Mux to MP4 Container

```javascript
import { Muxer, VideoEncoder, VideoFrame } from '@pproenca/node-webcodecs';

const muxer = new Muxer({ filename: 'output.mp4' });
let videoTrackId;

const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    if (metadata?.decoderConfig?.description) {
      // Add video track on first keyframe
      videoTrackId = muxer.addVideoTrack({
        codec: 'avc1.42001e',
        width: 1920,
        height: 1080,
        description: metadata.decoderConfig.description,
      });
    }
    muxer.writeVideoChunk(videoTrackId, chunk);
  },
  error: console.error,
});

encoder.configure({
  codec: 'avc1.42001e',
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
  avc: { format: 'avc' },  // Use AVCC format for MP4
});

// Encode frames...
await encoder.flush();
encoder.close();
muxer.finalize();
```

### Demux from Video File

```javascript
import { Demuxer } from '@pproenca/node-webcodecs';

const demuxer = new Demuxer({
  onTrack: (track) => {
    console.log(`Track ${track.index}: ${track.type} (${track.codec})`);
    if (track.type === 'video') {
      // Configure decoder with track.extradata
    }
  },
  onChunk: (chunk, trackIndex) => {
    // Feed chunk to decoder
  },
  onError: console.error,
});

demuxer.open('input.mp4');
demuxer.demux();  // Process all chunks
demuxer.close();
```

### Decode Images (including animated GIFs)

```javascript
import { ImageDecoder } from '@pproenca/node-webcodecs';
import { readFileSync } from 'fs';

const imageData = readFileSync('animation.gif');

const decoder = new ImageDecoder({
  type: 'image/gif',
  data: imageData,
});

await decoder.completed;

console.log(`${decoder.tracks.length} track(s)`);
console.log(`${decoder.tracks[0].frameCount} frames`);
console.log(`Animated: ${decoder.tracks[0].animated}`);

// Decode each frame
for (let i = 0; i < decoder.tracks[0].frameCount; i++) {
  const { image, complete } = await decoder.decode({ frameIndex: i });
  console.log(`Frame ${i}: ${image.codedWidth}x${image.codedHeight}`);
  image.close();
}

decoder.close();
```

## API Reference

This library implements the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/):

### Core Classes

| Class | Description |
|-------|-------------|
| `VideoEncoder` | Encode VideoFrame to EncodedVideoChunk |
| `VideoDecoder` | Decode EncodedVideoChunk to VideoFrame |
| `AudioEncoder` | Encode AudioData to EncodedAudioChunk |
| `AudioDecoder` | Decode EncodedAudioChunk to AudioData |
| `VideoFrame` | Raw video frame with pixel data |
| `AudioData` | Raw audio samples |
| `EncodedVideoChunk` | Compressed video data |
| `EncodedAudioChunk` | Compressed audio data |
| `ImageDecoder` | Decode images (JPEG, PNG, WebP, GIF) |
| `VideoColorSpace` | Color space metadata |

### Beyond W3C Spec

| Class | Description |
|-------|-------------|
| `Muxer` | Write to MP4 containers |
| `Demuxer` | Read from any FFmpeg-supported format |
| `VideoFilter` | Apply blur filters (content moderation) |
| `TestVideoGenerator` | Generate test patterns |

### Supported Codecs

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

### Pixel Formats

8-bit: `I420`, `I420A`, `I422`, `I422A`, `I444`, `I444A`, `NV12`, `NV21`, `NV12A`, `RGBA`, `RGBX`, `BGRA`, `BGRX`

10-bit: `I420P10`, `I422P10`, `I444P10`, `NV12P10`, `I420AP10`, `I422AP10`, `I444AP10`

12-bit: `I420P12`, `I422P12`, `I444P12`

## Interactive Demos

Run the interactive demo with web UI:

```bash
git clone https://github.com/pproenca/node-webcodecs
cd node-webcodecs
npm install && npm run build
node examples/run-demo.js
```

Or use Docker:

```bash
docker compose up demo
```

## Test Results

```
Test Files:  45 passed / 51 total
     Tests:  428 passed / 442 total
  Duration:  ~2 minutes
```

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
