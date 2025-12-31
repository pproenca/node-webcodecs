# Design: One-Click Sandbox & Demo Examples

## Goal

Make it trivially easy for competition judges and developers to test node-webcodecs. A judge should see working output within 60 seconds of `docker compose up`. Developers should be able to explore the full power of the WebCodecs API implementation.

## Target Audience

- **Competition judges**: Quick evaluation experience, must work immediately
- **Developers evaluating**: Exploring whether to adopt this library for their project

## Architecture

### Directory Structure

All demo infrastructure lives under `examples/` to keep the repository root clean:

```
node-webcodecs/
├── examples/
│   ├── docker/
│   │   ├── Dockerfile          # Ubuntu + FFmpeg + Node.js bundled
│   │   └── docker-compose.yml  # One-command start
│   ├── 01-encode-decode/
│   │   └── index.js            # Core roundtrip demo
│   ├── 02-video-pipeline/
│   │   └── index.js            # Demux→decode→transform→encode
│   ├── 03-content-moderation/
│   │   └── index.js            # Blur filter demo
│   ├── 04-codec-comparison/
│   │   └── index.js            # H.264/H.265/VP9/AV1 comparison
│   ├── web-ui/
│   │   ├── server.js           # Express server for results
│   │   └── public/
│   │       ├── index.html      # Dashboard with video playback
│   │       └── style.css
│   ├── assets/                 # Sample media files (auto-generated)
│   ├── output/                 # Demo outputs (gitignored)
│   ├── run-demo.sh             # Master demo runner script
│   └── README.md               # Examples documentation
```

### Docker Container

The Dockerfile bundles all prerequisites:
- Ubuntu 22.04 base
- FFmpeg libraries (libavcodec, libavutil, libswscale, libswresample, libavfilter)
- Node.js 20 LTS
- Pre-built native addon

**Zero prerequisites for users** - only Docker is required.

## Demo Examples

### 01-encode-decode (Core API Roundtrip)

**Purpose**: Demonstrate the fundamental WebCodecs encode/decode cycle.

**What it does**:
1. Creates test video frames programmatically (gradient animation)
2. Encodes frames to H.264 using `VideoEncoder`
3. Decodes the encoded chunks using `VideoDecoder`
4. Verifies decoded frames match originals (pixel comparison)

**Shows**: `VideoFrame`, `VideoEncoder`, `VideoDecoder`, `EncodedVideoChunk`

**Output**: Console stats showing frame count, encoding time, file size, verification status

### 02-video-pipeline (Full Processing Pipeline)

**Purpose**: Demonstrate real-world video processing matching browser WebCodecs patterns.

**What it does**:
1. Opens a sample MP4 file (auto-generated via FFmpeg if not present)
2. Demuxes video/audio tracks using `Demuxer`
3. Decodes video frames to RGBA
4. Applies visual transformation (bouncing watermark overlay)
5. Re-encodes processed frames to H.264
6. Outputs playable video file

**Shows**: `Demuxer`, `VideoDecoder`, `VideoFrame` manipulation, `VideoEncoder`

**Output**: Watermarked video file + console progress

### 03-content-moderation (Blur Filter)

**Purpose**: Demonstrate the VideoFilter capability for content moderation use cases.

**What it does**:
1. Generates test frames with "detected" regions
2. Runs mock detection (simulating AI inference)
3. Applies blur to detected regions using `VideoFilter.applyBlur()`
4. Re-encodes with blurred regions
5. Shows moderation log with timestamps

**Shows**: `VideoFilter`, real-world content moderation pipeline

**Output**: Moderation log + processed video with blurred regions

### 04-codec-comparison (Multi-Codec)

**Purpose**: Show the library's multi-codec support and compare performance.

**What it does**:
1. Uses same source video
2. Encodes to H.264, H.265 (HEVC), VP9, and AV1
3. Measures encoding time for each codec
4. Compares output file sizes
5. Displays comparison table

**Shows**: Codec flexibility, performance characteristics

**Output**: Comparison table (codec, time, size, efficiency)

## Web UI

Simple Express server providing:
- Dashboard listing all demos with status
- Video playback of demo outputs (HTML5 video)
- Console log output display
- Performance metrics visualization
- Codec comparison charts

**Access**: `http://localhost:3000` when running via Docker

The web UI is optional - console demos work standalone.

## User Experience

### Quick Start (Docker - Primary)

```bash
# Clone the repository
git clone https://github.com/user/node-webcodecs.git
cd node-webcodecs/examples

# Run all demos with web UI
docker compose up

# Open http://localhost:3000 to see results
```

### Alternative: Interactive Shell

```bash
# Start interactive container
docker compose run --rm shell

# Inside container:
npm run demo         # Interactive demo selector
npm run demo:all     # Run all demos
npm run demo:01      # Run specific demo
```

### Local Development (Advanced)

```bash
# Prerequisites: Node.js 18+, FFmpeg libraries
# macOS:
brew install ffmpeg pkg-config

# Ubuntu/Debian:
apt-get install libavcodec-dev libavutil-dev libswscale-dev \
                libswresample-dev libavfilter-dev pkg-config

# Install and build
npm install
npm run build

# Run demos
cd examples
./run-demo.sh
```

## UX Principles

1. **60-second time to first output**: From `docker compose up` to seeing working demo
2. **Clear progress messages**: "Running demo 1/4: Encode-Decode..."
3. **Obvious success/failure**: Green checkmarks for success, red X with error details
4. **Next steps guidance**: After each demo, show what to try next
5. **Graceful degradation**: If a codec isn't available, skip with warning instead of failing

## Alignment with W3C WebCodecs Samples

The demos are structured to mirror the official W3C WebCodecs samples:
- **01-encode-decode** ↔ W3C encode-decode-worker sample
- **02-video-pipeline** ↔ W3C video-decode-display + capture-to-file samples
- **03-content-moderation** ↔ Extends beyond W3C samples (unique capability)
- **04-codec-comparison** ↔ Extends beyond W3C samples (node-specific advantage)

This allows developers familiar with browser WebCodecs to immediately recognize the API patterns.

## Files to Create/Modify

### New Files
- `examples/docker/Dockerfile`
- `examples/docker/docker-compose.yml`
- `examples/01-encode-decode/index.js`
- `examples/02-video-pipeline/index.js`
- `examples/03-content-moderation/index.js` (update existing)
- `examples/04-codec-comparison/index.js`
- `examples/web-ui/server.js`
- `examples/web-ui/public/index.html`
- `examples/web-ui/public/style.css`
- `examples/run-demo.sh`
- `examples/README.md`

### Update Existing
- Root `README.md` - Add quick start section pointing to examples/

### Remove/Consolidate
- `examples/basic-encode.js` → Merge into 01-encode-decode
- `examples/run-demo.js` → Replace with new runner
- `examples/watermarker.js` → Merge into 02-video-pipeline

## Success Criteria

- [ ] `docker compose up` produces working output in under 60 seconds
- [ ] All four demos run successfully and produce visible output
- [ ] Web UI displays video playback of demo outputs
- [ ] Console output is clear and informative
- [ ] Works on macOS, Linux, and Windows (via Docker)
- [ ] README provides clear quick-start instructions
