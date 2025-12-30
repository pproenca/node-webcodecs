# node-webcodecs Examples

Interactive demos showcasing the WebCodecs API implementation for Node.js.

## Quick Start (Docker)

The easiest way to run the demos - no prerequisites needed except Docker:

```bash
# Run all demos with web dashboard
cd examples
docker compose -f docker/docker-compose.yml up demo

# Open http://localhost:3000 to view results
```

### Docker Options

| Command | Description |
|---------|-------------|
| `docker compose up demo` | Run all demos + web UI |
| `docker compose up demo-console` | Run demos without web UI |
| `docker compose run --rm shell` | Interactive shell |
| `docker compose up web` | Web UI only (after demos ran) |

## Local Development

If you have FFmpeg installed locally:

```bash
# Prerequisites
# macOS: brew install ffmpeg pkg-config
# Ubuntu: apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev ffmpeg

# From repository root
npm install
npm run build

# Run demos
cd examples
node run-all.js

# With web UI
node run-all.js --with-server
```

## Demo Descriptions

### Demo 01: Encode-Decode Roundtrip

Demonstrates the fundamental WebCodecs cycle:
- Create VideoFrame from raw pixels
- Encode to H.264 with VideoEncoder
- Decode back with VideoDecoder
- Verify frame count matches

**APIs shown:** `VideoFrame`, `VideoEncoder`, `VideoDecoder`, `EncodedVideoChunk`

### Demo 02: Video Processing Pipeline

Real-world video processing workflow:
- Open MP4 with Demuxer
- Decode video track
- Apply bouncing watermark transformation
- Re-encode and output playable file

**APIs shown:** `Demuxer`, `VideoDecoder`, `VideoEncoder`, frame manipulation

### Demo 03: Content Moderation

Content moderation pipeline with blur filter:
- Generate test frames
- Run mock detection (simulating AI)
- Apply blur to detected regions with VideoFilter
- Output moderated video

**APIs shown:** `VideoFilter.applyBlur()`, moderation workflow

### Demo 04: Codec Comparison

Multi-codec performance comparison:
- Encode same source to H.264, H.265, VP9, AV1
- Measure encoding time and output size
- Display comparison table

**APIs shown:** Multiple codec support, performance characteristics

## Output Files

Demos write output to `examples/output/`:

| File | Demo | Description |
|------|------|-------------|
| `watermarked.mp4` | 02 | Video with bouncing watermark |
| `moderated.h264` | 03 | Video with blurred regions |

## Web UI

The web dashboard at `http://localhost:3000` provides:
- Demo status overview
- Video playback for outputs
- File download links

## API Reference

See the main [README](../README.md) for full API documentation.
