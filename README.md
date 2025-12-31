# node-webcodecs

WebCodecs API for Node.js — encode and decode video/audio with browser-compatible APIs, powered by FFmpeg.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-blue)](package.json)

## Why node-webcodecs?

| Feature              | node-webcodecs              | Browser WebCodecs |
| -------------------- | --------------------------- | ----------------- |
| **Video Codecs**     | H.264, H.265, VP8, VP9, AV1 | Varies by browser |
| **Audio Codecs**     | AAC, Opus, MP3, FLAC        | Varies by browser |
| **Container Muxing** | MP4                         | Not in spec       |
| **Demuxing**         | Any FFmpeg format           | Not in spec       |
| **Server-side**      | Yes                         | Browser only      |

## Installation

```bash
npm install @pproenca/node-webcodecs
```

Prebuilt binaries with FFmpeg included are available for macOS (arm64, x64), Linux (glibc, musl), and Windows (x64).

<details>
<summary><strong>Building from Source</strong></summary>

For other platforms, install FFmpeg development libraries first:

**macOS:**

```bash
brew install ffmpeg pkg-config
```

**Ubuntu/Debian:**

```bash
sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev pkg-config
```

**Fedora/RHEL:**

```bash
sudo dnf install ffmpeg-devel pkg-config
```

**Windows:**

```bash
# Download FFmpeg from https://github.com/BtbN/FFmpeg-Builds/releases
set FFMPEG_PATH=C:\ffmpeg
```

Then install:

```bash
npm install @pproenca/node-webcodecs
npm run build:native
```

</details>

## Quick Start

### Encode

```javascript
import { VideoEncoder, VideoFrame } from "@pproenca/node-webcodecs";

const encoder = new VideoEncoder({
  output: (chunk) => chunks.push(chunk),
  error: console.error,
});

encoder.configure({
  codec: "avc1.42001e",
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
});

const frame = new VideoFrame(rgbaBuffer, {
  format: "RGBA",
  codedWidth: 1920,
  codedHeight: 1080,
  timestamp: 0,
});

encoder.encode(frame);
frame.close();
await encoder.flush();
```

### Decode

```javascript
import { VideoDecoder, EncodedVideoChunk } from "@pproenca/node-webcodecs";

const decoder = new VideoDecoder({
  output: (frame) => {
    // Process frame...
    frame.close();
  },
  error: console.error,
});

decoder.configure({
  codec: "avc1.42001e",
  codedWidth: 1920,
  codedHeight: 1080,
});

decoder.decode(new EncodedVideoChunk({ type: "key", timestamp: 0, data }));
await decoder.flush();
```

### Mux to MP4

```javascript
import { Muxer } from "@pproenca/node-webcodecs";

const muxer = new Muxer({ filename: "output.mp4" });

muxer.addVideoTrack({
  codec: "avc1.42001e",
  width: 1920,
  height: 1080,
  description: codecDescription,
});

muxer.writeVideoChunk(chunk);
muxer.finalize();
```

### Demux

```javascript
import { Demuxer } from "@pproenca/node-webcodecs";

const demuxer = new Demuxer({
  onTrack: (track) => console.log(track.codec),
  onChunk: (chunk, trackIndex) => decoder.decode(chunk),
  onError: console.error,
});

demuxer.open("input.mp4");
demuxer.demux();
demuxer.close();
```

See [examples/](examples/) for complete working code.

## API

This library implements the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/).

| Class                                     | Description                     |
| ----------------------------------------- | ------------------------------- |
| `VideoEncoder` / `VideoDecoder`           | Compress / decompress video     |
| `AudioEncoder` / `AudioDecoder`           | Compress / decompress audio     |
| `VideoFrame` / `AudioData`                | Raw media containers            |
| `EncodedVideoChunk` / `EncodedAudioChunk` | Compressed media packets        |
| `ImageDecoder`                            | Decode JPEG, PNG, WebP, GIF     |
|                                           |                                 |
| `Muxer` / `Demuxer`                       | Container I/O (beyond W3C spec) |

**Video codecs:** H.264, H.265, VP8, VP9, AV1
**Audio codecs:** AAC, Opus, MP3 (decode), FLAC (decode)

See [docs/codecs.md](docs/codecs.md) for codec strings and pixel formats.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## License

MIT
