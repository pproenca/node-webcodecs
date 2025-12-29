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
- `encode(frame)` - Encode a VideoFrame
- `flush()` - Flush remaining frames
- `close()` - Close encoder and free resources

### VideoFrame

- `new VideoFrame(buffer, { codedWidth, codedHeight, timestamp })` - Create frame from RGBA buffer
- `codedWidth`, `codedHeight`, `timestamp`, `format` - Properties
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

- Currently only supports H.264 encoding
- Input format is RGBA only
- Synchronous encoding (no AsyncWorker yet)
- Audio not yet implemented

## License

MIT

## Submission

WebCodecs Node.js $10k Challenge entry.
