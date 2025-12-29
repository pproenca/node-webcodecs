# node-webcodecs

WebCodecs API implementation for Node.js using FFmpeg.

## Installation

### Prerequisites

**macOS:**
```bash
brew install ffmpeg pkg-config cmake
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libavcodec-dev libavutil-dev libavformat-dev libswscale-dev pkg-config cmake
```

### Install

```bash
npm install
npm run build
```

## Quick Start

```javascript
const { VideoEncoder, VideoFrame } = require('node-webcodecs');

const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
        console.log(`Encoded: ${chunk.type} ${chunk.byteLength} bytes`);
    },
    error: (e) => console.error(e)
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30
});

// Create and encode frames
const buffer = Buffer.alloc(1280 * 720 * 4); // RGBA
const frame = new VideoFrame(buffer, {
    codedWidth: 1280,
    codedHeight: 720,
    timestamp: 0
});

encoder.encode(frame);
frame.close();

encoder.flush();
encoder.close();
```

## API

### VideoEncoder

- `new VideoEncoder({ output, error })` - Create encoder with callbacks
- `configure(config)` - Configure codec settings
- `encode(frame, options?)` - Encode a VideoFrame (options: `{ keyFrame: boolean }`)
- `flush()` - Flush remaining frames (returns Promise)
- `reset()` - Reset to unconfigured state
- `close()` - Close encoder and free resources
- `static isConfigSupported(config)` - Check if configuration is supported

### VideoDecoder

- `new VideoDecoder({ output, error })` - Create decoder with callbacks
- `configure(config)` - Configure codec settings (codec, codedWidth, codedHeight)
- `decode(chunk)` - Decode an EncodedVideoChunk
- `flush()` - Flush remaining frames (returns Promise)
- `reset()` - Reset to unconfigured state
- `close()` - Close decoder and free resources
- `static isConfigSupported(config)` - Check if configuration is supported

### EncodedVideoChunk

- `new EncodedVideoChunk({ type, timestamp, data })` - Create chunk from encoded data
- `type` - 'key' or 'delta'
- `timestamp` - Presentation timestamp in microseconds
- `byteLength` - Size of encoded data
- `copyTo(destination)` - Copy data to ArrayBuffer or TypedArray

### VideoFrame

- `new VideoFrame(buffer, { codedWidth, codedHeight, timestamp })` - Create frame from RGBA buffer
- `codedWidth`, `codedHeight`, `timestamp`, `format` - Properties
- `clone()` - Create a copy of the frame
- `allocationSize()` - Get size needed for copyTo buffer
- `copyTo(destination)` - Copy pixel data to ArrayBuffer or TypedArray
- `close()` - Free resources

## Examples

```bash
node examples/basic-encode.js
ffplay output.h264
```

## Development

```bash
npm run build:native  # Build C++ addon
npm run build:ts      # Build TypeScript
npm run build         # Build all
npm test              # Run tests
```

## Known Limitations

- Currently only supports H.264 encoding and decoding
- Input format is RGBA only (output from decoder is also RGBA)
- Synchronous encoding/decoding (no AsyncWorker yet)
- Audio not yet implemented

## License

MIT

## Submission

WebCodecs Node.js $10k Challenge entry.
