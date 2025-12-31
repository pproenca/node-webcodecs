# node-webcodecs

W3C WebCodecs API implementation for Node.js using FFmpeg.

Encode and decode video/audio with the same API used in browsers.

## Features

- **Video Codecs:** H.264, H.265/HEVC, VP8, VP9, AV1
- **Audio Codecs:** AAC, Opus, MP3, FLAC
- **Full W3C WebCodecs API compliance**
- **Async/await and callback patterns**
- **Cross-platform:** macOS, Linux, Windows

## Installation

```sh
npm install node-webcodecs
```

### Prerequisites

FFmpeg development libraries are required:

**macOS:**
```sh
brew install ffmpeg
```

**Ubuntu/Debian:**
```sh
sudo apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev
```

## Quick Start

### Encode Video Frames

```javascript
import { VideoEncoder, VideoFrame } from 'node-webcodecs';

const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    console.log('Encoded chunk:', chunk.byteLength, 'bytes');
  },
  error: (e) => console.error(e),
});

encoder.configure({
  codec: 'avc1.42001e',
  width: 640,
  height: 480,
  bitrate: 1_000_000,
});

// Create a frame from RGBA data
const frame = new VideoFrame(rgbaBuffer, {
  format: 'RGBA',
  codedWidth: 640,
  codedHeight: 480,
  timestamp: 0,
});

encoder.encode(frame);
frame.close();

await encoder.flush();
encoder.close();
```

### Decode Video Chunks

```javascript
import { VideoDecoder, EncodedVideoChunk } from 'node-webcodecs';

const decoder = new VideoDecoder({
  output: (frame) => {
    console.log('Decoded frame:', frame.codedWidth, 'x', frame.codedHeight);
    frame.close();
  },
  error: (e) => console.error(e),
});

decoder.configure({
  codec: 'avc1.42001e',
});

const chunk = new EncodedVideoChunk({
  type: 'key',
  timestamp: 0,
  data: h264Data,
});

decoder.decode(chunk);
await decoder.flush();
decoder.close();
```

## API Reference

This library implements the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/):

- `VideoEncoder` / `VideoDecoder`
- `AudioEncoder` / `AudioDecoder`
- `VideoFrame` / `AudioData`
- `EncodedVideoChunk` / `EncodedAudioChunk`
- `ImageDecoder`

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
