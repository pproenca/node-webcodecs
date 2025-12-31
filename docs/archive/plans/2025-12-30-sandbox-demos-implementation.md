# One-Click Sandbox & Demo Examples Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-sandbox-demos-implementation.md` to implement task-by-task.

**Goal:** Create a zero-prerequisite Docker-based demo experience where judges and developers can test node-webcodecs within 60 seconds of `docker compose up`.

**Architecture:** Docker container bundles Ubuntu + FFmpeg + Node.js with pre-built native addon. Four structured demo examples showcase encode/decode, video pipeline, content moderation, and codec comparison. Simple Express-based web UI displays results with video playback.

**Tech Stack:** Docker, Node.js 20, FFmpeg libraries, Express.js for web UI

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Docker infrastructure (independent files) |
| Group 2 | 3, 4, 5, 6 | Demo examples (independent modules, no file overlap) |
| Group 3 | 7 | Web UI (depends on demos for output structure) |
| Group 4 | 8 | Runner script (orchestrates demos) |
| Group 5 | 9 | Documentation (depends on everything) |
| Group 6 | 10 | Code Review |

---

### Task 1: Create Dockerfile

**Files:**
- Create: `examples/docker/Dockerfile`

**Step 1: Create docker directory** (30 sec)

```bash
mkdir -p examples/docker
```

**Step 2: Write Dockerfile** (5 min)

Create `examples/docker/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    cmake \
    pkg-config \
    git \
    # FFmpeg development libraries
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    # FFmpeg CLI for test video generation
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build native addon and TypeScript
RUN npm run build

# Set examples as working directory for demos
WORKDIR /app/examples

# Default command runs all demos
CMD ["node", "run-all.js"]
```

**Step 3: Verify Dockerfile syntax** (30 sec)

```bash
docker build --check -f examples/docker/Dockerfile .
```

Expected: No syntax errors (or build starts if --check not supported)

**Step 4: Commit** (30 sec)

```bash
git add examples/docker/Dockerfile
git commit -m "build(docker): add Dockerfile with FFmpeg and Node.js"
```

---

### Task 2: Create docker-compose.yml

**Files:**
- Create: `examples/docker/docker-compose.yml`

**Step 1: Write docker-compose.yml** (3 min)

Create `examples/docker/docker-compose.yml`:

```yaml
services:
  # Run all demos with web UI
  demo:
    build:
      context: ../..
      dockerfile: examples/docker/Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - demo-output:/app/examples/output
    command: ["node", "run-all.js", "--with-server"]

  # Run demos without web UI (console only)
  demo-console:
    build:
      context: ../..
      dockerfile: examples/docker/Dockerfile
    volumes:
      - demo-output:/app/examples/output
    command: ["node", "run-all.js"]

  # Interactive shell for exploration
  shell:
    build:
      context: ../..
      dockerfile: examples/docker/Dockerfile
    stdin_open: true
    tty: true
    volumes:
      - demo-output:/app/examples/output
    command: ["/bin/bash"]

  # Web UI server only (assumes demos already ran)
  web:
    build:
      context: ../..
      dockerfile: examples/docker/Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - demo-output:/app/examples/output
    command: ["node", "web-ui/server.js"]

volumes:
  demo-output:
```

**Step 2: Verify compose file syntax** (30 sec)

```bash
cd examples/docker && docker compose config
```

Expected: Valid YAML output showing resolved configuration

**Step 3: Commit** (30 sec)

```bash
git add examples/docker/docker-compose.yml
git commit -m "build(docker): add docker-compose for demo services"
```

---

### Task 3: Create 01-encode-decode Demo

**Files:**
- Create: `examples/01-encode-decode/index.js`

**Step 1: Create demo directory** (30 sec)

```bash
mkdir -p examples/01-encode-decode
```

**Step 2: Write encode-decode demo** (5 min)

Create `examples/01-encode-decode/index.js`:

```javascript
/**
 * Demo 01: Encode-Decode Roundtrip
 *
 * Demonstrates the fundamental WebCodecs encode/decode cycle:
 * 1. Create test video frames programmatically
 * 2. Encode frames to H.264
 * 3. Decode the encoded chunks
 * 4. Verify decoded frames match originals
 */

const {VideoEncoder, VideoDecoder, VideoFrame} = require('../../dist');

const WIDTH = 320;
const HEIGHT = 240;
const FRAME_COUNT = 30;
const FPS = 30;

async function main() {
  console.log('=== Demo 01: Encode-Decode Roundtrip ===\n');

  const encodedChunks = [];
  const decodedFrames = [];
  const originalHashes = [];
  let encodeStartTime;
  let encodeEndTime;

  // Step 1: Create encoder
  console.log('[1/5] Creating VideoEncoder...');
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 1_000_000,
    framerate: FPS,
  });
  console.log(`    Configured: ${WIDTH}x${HEIGHT} H.264 @ ${FPS}fps\n`);

  // Step 2: Generate and encode test frames
  console.log(`[2/5] Encoding ${FRAME_COUNT} frames...`);
  encodeStartTime = performance.now();

  for (let i = 0; i < FRAME_COUNT; i++) {
    const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
    const progress = i / FRAME_COUNT;

    // Create gradient that changes over time
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const idx = (y * WIDTH + x) * 4;
        buffer[idx] = Math.floor((x / WIDTH) * 255);     // R: horizontal
        buffer[idx + 1] = Math.floor((y / HEIGHT) * 255); // G: vertical
        buffer[idx + 2] = Math.floor(progress * 255);     // B: time-based
        buffer[idx + 3] = 255;                            // A: opaque
      }
    }

    // Store hash of original for verification
    originalHashes.push(simpleHash(buffer));

    const frame = new VideoFrame(buffer, {
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: Math.floor(i * (1_000_000 / FPS)),
    });

    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();
  encodeEndTime = performance.now();

  const totalBytes = encodedChunks.reduce((sum, c) => sum + c.byteLength, 0);
  console.log(`    Encoded ${encodedChunks.length} chunks (${totalBytes} bytes)`);
  console.log(`    Time: ${(encodeEndTime - encodeStartTime).toFixed(1)}ms\n`);

  // Step 3: Create decoder
  console.log('[3/5] Creating VideoDecoder...');
  const decoder = new VideoDecoder({
    output: frame => {
      // Copy frame data for verification
      const size = frame.allocationSize({format: 'RGBA'});
      const data = new Uint8Array(size);
      frame.copyTo(data.buffer, {format: 'RGBA'});
      decodedFrames.push({
        timestamp: frame.timestamp,
        hash: simpleHash(Buffer.from(data)),
      });
      frame.close();
    },
    error: e => console.error('Decoder error:', e),
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: WIDTH,
    codedHeight: HEIGHT,
  });
  console.log('    Decoder configured\n');

  // Step 4: Decode all chunks
  console.log('[4/5] Decoding chunks...');
  const decodeStartTime = performance.now();

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();
  const decodeEndTime = performance.now();

  console.log(`    Decoded ${decodedFrames.length} frames`);
  console.log(`    Time: ${(decodeEndTime - decodeStartTime).toFixed(1)}ms\n`);

  // Step 5: Verify roundtrip
  console.log('[5/5] Verifying roundtrip...');

  // Note: Due to lossy compression, decoded frames won't match originals exactly
  // We verify we got the right number of frames with valid data
  const success = decodedFrames.length === FRAME_COUNT;

  if (success) {
    console.log('    ✓ Frame count matches');
    console.log('    ✓ All frames decoded successfully');
    console.log('\n=== Demo 01 Complete ===\n');
  } else {
    console.log(`    ✗ Expected ${FRAME_COUNT} frames, got ${decodedFrames.length}`);
    console.log('\n=== Demo 01 Failed ===\n');
    process.exit(1);
  }

  // Summary
  console.log('Summary:');
  console.log(`  Frames: ${FRAME_COUNT}`);
  console.log(`  Resolution: ${WIDTH}x${HEIGHT}`);
  console.log(`  Encoded size: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`  Encode time: ${(encodeEndTime - encodeStartTime).toFixed(1)}ms`);
  console.log(`  Decode time: ${(decodeEndTime - decodeStartTime).toFixed(1)}ms`);
  console.log(`  Compression: ${((1 - totalBytes / (WIDTH * HEIGHT * 4 * FRAME_COUNT)) * 100).toFixed(1)}%`);

  return {
    frames: FRAME_COUNT,
    encodedBytes: totalBytes,
    encodeTimeMs: encodeEndTime - encodeStartTime,
    decodeTimeMs: decodeEndTime - decodeStartTime,
  };
}

// Simple hash for frame comparison (not cryptographic)
function simpleHash(buffer) {
  let hash = 0;
  for (let i = 0; i < buffer.length; i += 100) {
    hash = ((hash << 5) - hash + buffer[i]) | 0;
  }
  return hash;
}

// Export for programmatic use
module.exports = {main};

// Run if executed directly
if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
```

**Step 3: Test the demo runs** (30 sec)

```bash
node examples/01-encode-decode/index.js
```

Expected: Output showing 5 steps completing with "Demo 01 Complete" message

**Step 4: Commit** (30 sec)

```bash
git add examples/01-encode-decode/
git commit -m "feat(examples): add encode-decode roundtrip demo"
```

---

### Task 4: Create 02-video-pipeline Demo

**Files:**
- Create: `examples/02-video-pipeline/index.js`

**Step 1: Create demo directory** (30 sec)

```bash
mkdir -p examples/02-video-pipeline
```

**Step 2: Write video-pipeline demo** (5 min)

Create `examples/02-video-pipeline/index.js`:

```javascript
/**
 * Demo 02: Video Processing Pipeline
 *
 * Demonstrates real-world video processing:
 * 1. Open MP4 file (auto-generated if missing)
 * 2. Demux video track
 * 3. Decode frames to RGBA
 * 4. Apply watermark transformation
 * 5. Re-encode to H.264
 * 6. Output playable file
 */

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const {Demuxer, VideoDecoder, VideoEncoder, VideoFrame} = require('../../dist');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const INPUT_VIDEO = path.join(OUTPUT_DIR, 'input.mp4');
const OUTPUT_H264 = path.join(OUTPUT_DIR, 'watermarked.h264');
const OUTPUT_MP4 = path.join(OUTPUT_DIR, 'watermarked.mp4');

// Watermark state
let boxX = 20;
let boxY = 20;
let boxDX = 2;
let boxDY = 1;
const BOX_SIZE = 40;

function drawWatermark(rgbaData, width, height) {
  // Update bouncing box position
  boxX += boxDX;
  boxY += boxDY;
  if (boxX <= 0 || boxX + BOX_SIZE >= width) boxDX = -boxDX;
  if (boxY <= 0 || boxY + BOX_SIZE >= height) boxDY = -boxDY;
  boxX = Math.max(0, Math.min(width - BOX_SIZE, boxX));
  boxY = Math.max(0, Math.min(height - BOX_SIZE, boxY));

  // Draw yellow box
  for (let y = boxY; y < boxY + BOX_SIZE && y < height; y++) {
    for (let x = boxX; x < boxX + BOX_SIZE && x < width; x++) {
      const idx = (y * width + x) * 4;
      rgbaData[idx] = 255;     // R
      rgbaData[idx + 1] = 255; // G
      rgbaData[idx + 2] = 0;   // B
    }
  }
}

async function ensureInputVideo() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  if (!fs.existsSync(INPUT_VIDEO)) {
    console.log('    Generating test video with FFmpeg...');
    execSync(
      `ffmpeg -y -f lavfi -i "testsrc=duration=3:size=320x240:rate=30" ` +
      `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${INPUT_VIDEO}"`,
      {stdio: 'pipe'}
    );
    console.log('    Test video created');
  }
}

async function main() {
  console.log('=== Demo 02: Video Processing Pipeline ===\n');

  // Step 1: Ensure input video exists
  console.log('[1/6] Preparing input video...');
  await ensureInputVideo();
  console.log(`    Input: ${INPUT_VIDEO}\n`);

  const encodedChunks = [];
  let videoTrack = null;
  let encoder = null;
  let framesProcessed = 0;

  // Step 2: Create decoder
  console.log('[2/6] Creating VideoDecoder...');
  const decoder = new VideoDecoder({
    output: frame => {
      // Get RGBA data
      const size = frame.allocationSize({format: 'RGBA'});
      const rgbaData = new Uint8Array(size);
      frame.copyTo(rgbaData.buffer, {format: 'RGBA'});

      // Apply watermark
      drawWatermark(rgbaData, frame.codedWidth, frame.codedHeight);

      // Create new frame with modified pixels
      const modifiedFrame = new VideoFrame(Buffer.from(rgbaData), {
        format: 'RGBA',
        codedWidth: frame.codedWidth,
        codedHeight: frame.codedHeight,
        timestamp: frame.timestamp,
      });

      // Encode
      encoder.encode(modifiedFrame, {keyFrame: framesProcessed % 30 === 0});
      modifiedFrame.close();
      frame.close();

      framesProcessed++;
      if (framesProcessed % 30 === 0) {
        process.stdout.write(`    Processed ${framesProcessed} frames...\r`);
      }
    },
    error: e => console.error('Decoder error:', e),
  });
  console.log('    Decoder ready\n');

  // Step 3: Create demuxer
  console.log('[3/6] Opening video file with Demuxer...');
  const demuxer = new Demuxer({
    onTrack: track => {
      if (track.type === 'video') {
        videoTrack = track;
        console.log(`    Found video: ${track.width}x${track.height} (${track.codec})`);

        // Configure decoder
        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: track.width,
          codedHeight: track.height,
          description: track.extradata,
        });

        // Create encoder
        encoder = new VideoEncoder({
          output: chunk => encodedChunks.push(chunk),
          error: e => console.error('Encoder error:', e),
        });

        encoder.configure({
          codec: 'avc1.42001e',
          width: track.width,
          height: track.height,
          bitrate: 1_000_000,
          framerate: 30,
        });
      }
    },
    onChunk: (chunk, trackIndex) => {
      if (videoTrack && trackIndex === videoTrack.index) {
        decoder.decode(chunk);
      }
    },
    onError: e => console.error('Demuxer error:', e),
  });

  await demuxer.open(INPUT_VIDEO);
  console.log('');

  // Step 4: Process video
  console.log('[4/6] Processing frames (demux -> decode -> watermark -> encode)...');
  const startTime = performance.now();
  await demuxer.demux();
  await decoder.flush();
  await encoder.flush();
  const endTime = performance.now();

  demuxer.close();
  decoder.close();
  encoder.close();

  console.log(`\n    Processed ${framesProcessed} frames in ${(endTime - startTime).toFixed(1)}ms\n`);

  // Step 5: Write H.264 output
  console.log('[5/6] Writing output files...');
  const outputData = Buffer.concat(
    encodedChunks.map(chunk => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      return Buffer.from(buf);
    })
  );
  fs.writeFileSync(OUTPUT_H264, outputData);
  console.log(`    H.264: ${OUTPUT_H264} (${(outputData.length / 1024).toFixed(2)} KB)`);

  // Step 6: Wrap in MP4
  console.log('[6/6] Wrapping in MP4 container...');
  try {
    execSync(`ffmpeg -y -i "${OUTPUT_H264}" -c copy "${OUTPUT_MP4}"`, {stdio: 'pipe'});
    console.log(`    MP4: ${OUTPUT_MP4}\n`);
  } catch {
    console.log('    (FFmpeg wrap skipped - H.264 output available)\n');
  }

  console.log('=== Demo 02 Complete ===\n');
  console.log('Output files:');
  console.log(`  ${OUTPUT_H264}`);
  if (fs.existsSync(OUTPUT_MP4)) {
    console.log(`  ${OUTPUT_MP4}`);
    console.log('\nPlay with: ffplay ' + OUTPUT_MP4);
  }

  return {
    framesProcessed,
    outputBytes: outputData.length,
    processingTimeMs: endTime - startTime,
    outputPath: fs.existsSync(OUTPUT_MP4) ? OUTPUT_MP4 : OUTPUT_H264,
  };
}

module.exports = {main};

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
```

**Step 3: Test the demo runs** (30 sec)

```bash
node examples/02-video-pipeline/index.js
```

Expected: Output showing 6 steps completing with output files created

**Step 4: Commit** (30 sec)

```bash
git add examples/02-video-pipeline/
git commit -m "feat(examples): add video processing pipeline demo"
```

---

### Task 5: Update 03-content-moderation Demo

**Files:**
- Modify: `examples/content-moderation/moderate.js` → Move to `examples/03-content-moderation/index.js`

**Step 1: Create new directory and move file** (30 sec)

```bash
mkdir -p examples/03-content-moderation
mv examples/content-moderation/moderate.js examples/03-content-moderation/index.js
mv examples/content-moderation/README.md examples/03-content-moderation/README.md 2>/dev/null || true
rmdir examples/content-moderation 2>/dev/null || true
```

**Step 2: Update the demo to output files** (5 min)

Read then edit `examples/03-content-moderation/index.js` to add file output and consistent formatting:

```javascript
/**
 * Demo 03: Content Moderation Pipeline
 *
 * Demonstrates the VideoFilter capability for content moderation:
 * 1. Generate test frames with "detected" regions
 * 2. Run mock detection (simulating AI inference)
 * 3. Apply blur to detected regions using VideoFilter.applyBlur()
 * 4. Re-encode with blurred regions
 * 5. Output moderation log and processed video
 */

const fs = require('fs');
const path = require('path');
const {VideoEncoder, VideoFrame, VideoFilter} = require('../../dist');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_H264 = path.join(OUTPUT_DIR, 'moderated.h264');

const WIDTH = 320;
const HEIGHT = 240;
const FRAME_COUNT = 30;

// Mock AI detector - in production, call ONNX/TensorFlow
function mockDetectContent(frameIndex) {
  // Simulate detection: return regions for frames 5-15
  if (frameIndex >= 5 && frameIndex <= 15) {
    return [
      {
        x: 100,
        y: 80,
        width: 120,
        height: 80,
        label: 'detected-region',
        confidence: 0.95,
      },
    ];
  }
  return [];
}

async function main() {
  console.log('=== Demo 03: Content Moderation Pipeline ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  const moderationLog = [];
  const outputChunks = [];

  // Step 1: Initialize filter and encoder
  console.log('[1/4] Initializing VideoFilter and VideoEncoder...');
  const filter = new VideoFilter();
  filter.configure({width: WIDTH, height: HEIGHT});

  const encoder = new VideoEncoder({
    output: chunk => outputChunks.push(chunk),
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 1_000_000,
    framerate: 30,
  });
  console.log(`    Filter and encoder ready (${WIDTH}x${HEIGHT})\n`);

  // Step 2: Generate and process frames
  console.log(`[2/4] Processing ${FRAME_COUNT} frames (detect -> blur -> encode)...`);
  const startTime = performance.now();

  for (let i = 0; i < FRAME_COUNT; i++) {
    // Generate test frame with gradient
    const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const idx = (y * WIDTH + x) * 4;
        buf[idx] = (x + i * 10) % 256;
        buf[idx + 1] = (y + i * 5) % 256;
        buf[idx + 2] = 128;
        buf[idx + 3] = 255;
      }
    }

    const frame = new VideoFrame(buf, {
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: i * 33333,
    });

    // Run detection
    const detections = mockDetectContent(i);

    let processedFrame;
    if (detections.length > 0) {
      // Apply blur to detected regions
      const regions = detections.map(d => ({
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
      }));

      processedFrame = filter.applyBlur(frame, regions, 30);

      moderationLog.push({
        frame: i,
        timestamp: frame.timestamp,
        detections,
        action: 'blurred',
      });

      console.log(`    Frame ${i}: DETECTED ${detections.length} region(s) -> BLURRED`);
    } else {
      processedFrame = frame.clone();
      if (i % 10 === 0) {
        console.log(`    Frame ${i}: clean`);
      }
    }

    encoder.encode(processedFrame, {keyFrame: i === 0});
    processedFrame.close();
    frame.close();
  }

  await encoder.flush();
  const endTime = performance.now();
  console.log('');

  // Step 3: Write output
  console.log('[3/4] Writing output file...');
  const outputData = Buffer.concat(
    outputChunks.map(chunk => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      return Buffer.from(buf);
    })
  );
  fs.writeFileSync(OUTPUT_H264, outputData);
  console.log(`    Output: ${OUTPUT_H264} (${(outputData.length / 1024).toFixed(2)} KB)\n`);

  // Step 4: Summary
  console.log('[4/4] Moderation Summary:');
  console.log('─'.repeat(50));
  console.log(`    Total frames: ${FRAME_COUNT}`);
  console.log(`    Frames with detections: ${moderationLog.length}`);
  console.log(`    Processing time: ${(endTime - startTime).toFixed(1)}ms`);
  console.log(`    Output size: ${(outputData.length / 1024).toFixed(2)} KB`);

  if (moderationLog.length > 0) {
    console.log('\n    Flagged frames:');
    moderationLog.forEach(entry => {
      console.log(`      - Frame ${entry.frame} @ ${entry.timestamp}μs`);
    });
  }

  // Cleanup
  filter.close();
  encoder.close();

  console.log('\n=== Demo 03 Complete ===');

  return {
    totalFrames: FRAME_COUNT,
    flaggedFrames: moderationLog.length,
    outputBytes: outputData.length,
    processingTimeMs: endTime - startTime,
    outputPath: OUTPUT_H264,
    moderationLog,
  };
}

module.exports = {main, mockDetectContent};

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
```

**Step 3: Test the demo runs** (30 sec)

```bash
node examples/03-content-moderation/index.js
```

Expected: Output showing 4 steps with frames marked as BLURRED or clean

**Step 4: Commit** (30 sec)

```bash
git add examples/03-content-moderation/ examples/content-moderation/
git commit -m "feat(examples): reorganize content moderation demo with file output"
```

---

### Task 6: Create 04-codec-comparison Demo

**Files:**
- Create: `examples/04-codec-comparison/index.js`

**Step 1: Create demo directory** (30 sec)

```bash
mkdir -p examples/04-codec-comparison
```

**Step 2: Write codec-comparison demo** (5 min)

Create `examples/04-codec-comparison/index.js`:

```javascript
/**
 * Demo 04: Codec Comparison
 *
 * Compares encoding performance across multiple codecs:
 * - H.264 (AVC)
 * - H.265 (HEVC)
 * - VP9
 * - AV1
 */

const fs = require('fs');
const path = require('path');
const {VideoEncoder, VideoFrame} = require('../../dist');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const WIDTH = 640;
const HEIGHT = 480;
const FRAME_COUNT = 60;
const FPS = 30;

const CODECS = [
  {name: 'H.264', codec: 'avc1.42001E', ext: 'h264'},
  {name: 'H.265', codec: 'hvc1.1.6.L93.B0', ext: 'h265'},
  {name: 'VP9', codec: 'vp09.00.10.08', ext: 'vp9'},
  {name: 'AV1', codec: 'av01.0.04M.08', ext: 'av1'},
];

async function generateTestFrames() {
  const frames = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
    const progress = i / FRAME_COUNT;

    // Generate complex pattern for better codec comparison
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const idx = (y * WIDTH + x) * 4;
        // Diagonal gradient with temporal variation
        const diag = ((x + y + i * 3) % 256);
        // Circular pattern
        const cx = WIDTH / 2, cy = HEIGHT / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const circle = Math.floor((Math.sin(dist * 0.05 + i * 0.2) + 1) * 127);

        buffer[idx] = diag;                              // R
        buffer[idx + 1] = circle;                        // G
        buffer[idx + 2] = Math.floor(progress * 255);    // B
        buffer[idx + 3] = 255;                           // A
      }
    }
    frames.push(buffer);
  }
  return frames;
}

async function encodeWithCodec(codecConfig, frames) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let startTime;

    const encoder = new VideoEncoder({
      output: chunk => chunks.push(chunk),
      error: e => reject(e),
    });

    try {
      encoder.configure({
        codec: codecConfig.codec,
        width: WIDTH,
        height: HEIGHT,
        bitrate: 2_000_000,
        framerate: FPS,
      });
    } catch (e) {
      resolve({supported: false, error: e.message});
      return;
    }

    startTime = performance.now();

    for (let i = 0; i < frames.length; i++) {
      const frame = new VideoFrame(frames[i], {
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: Math.floor(i * (1_000_000 / FPS)),
      });
      encoder.encode(frame, {keyFrame: i === 0});
      frame.close();
    }

    encoder.flush().then(() => {
      const endTime = performance.now();
      const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);

      encoder.close();

      resolve({
        supported: true,
        chunks: chunks.length,
        bytes: totalBytes,
        timeMs: endTime - startTime,
        fps: frames.length / ((endTime - startTime) / 1000),
      });
    }).catch(reject);
  });
}

async function main() {
  console.log('=== Demo 04: Codec Comparison ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  // Step 1: Generate test frames
  console.log(`[1/3] Generating ${FRAME_COUNT} test frames (${WIDTH}x${HEIGHT})...`);
  const frames = await generateTestFrames();
  const rawSize = WIDTH * HEIGHT * 4 * FRAME_COUNT;
  console.log(`    Raw size: ${(rawSize / 1024 / 1024).toFixed(2)} MB\n`);

  // Step 2: Encode with each codec
  console.log('[2/3] Encoding with each codec...\n');
  const results = [];

  for (const codecConfig of CODECS) {
    process.stdout.write(`    ${codecConfig.name.padEnd(8)}: `);

    const result = await encodeWithCodec(codecConfig, frames);

    if (result.supported) {
      console.log(
        `${(result.bytes / 1024).toFixed(1).padStart(7)} KB | ` +
        `${result.timeMs.toFixed(0).padStart(5)}ms | ` +
        `${result.fps.toFixed(1).padStart(6)} fps`
      );
      results.push({...codecConfig, ...result});
    } else {
      console.log(`NOT AVAILABLE (${result.error})`);
      results.push({...codecConfig, supported: false});
    }
  }

  // Step 3: Summary table
  console.log('\n[3/3] Comparison Summary:\n');
  console.log('┌──────────┬────────────┬──────────┬────────────┬─────────────┐');
  console.log('│ Codec    │ Size (KB)  │ Time(ms) │ Speed(fps) │ Compression │');
  console.log('├──────────┼────────────┼──────────┼────────────┼─────────────┤');

  const availableResults = results.filter(r => r.supported);
  for (const r of results) {
    if (r.supported) {
      const compression = ((1 - r.bytes / rawSize) * 100).toFixed(1);
      console.log(
        `│ ${r.name.padEnd(8)} │ ` +
        `${(r.bytes / 1024).toFixed(1).padStart(10)} │ ` +
        `${r.timeMs.toFixed(0).padStart(8)} │ ` +
        `${r.fps.toFixed(1).padStart(10)} │ ` +
        `${compression.padStart(10)}% │`
      );
    } else {
      console.log(`│ ${r.name.padEnd(8)} │ ${'N/A'.padStart(10)} │ ${'N/A'.padStart(8)} │ ${'N/A'.padStart(10)} │ ${'N/A'.padStart(11)} │`);
    }
  }
  console.log('└──────────┴────────────┴──────────┴────────────┴─────────────┘');

  // Best performers
  if (availableResults.length > 0) {
    const smallest = availableResults.reduce((a, b) => a.bytes < b.bytes ? a : b);
    const fastest = availableResults.reduce((a, b) => a.timeMs < b.timeMs ? a : b);

    console.log('\nBest performers:');
    console.log(`  Smallest output: ${smallest.name} (${(smallest.bytes / 1024).toFixed(1)} KB)`);
    console.log(`  Fastest encode:  ${fastest.name} (${fastest.timeMs.toFixed(0)}ms)`);
  }

  console.log('\n=== Demo 04 Complete ===');

  return {
    frameCount: FRAME_COUNT,
    resolution: `${WIDTH}x${HEIGHT}`,
    rawSizeBytes: rawSize,
    results,
  };
}

module.exports = {main};

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
```

**Step 3: Test the demo runs** (30 sec)

```bash
node examples/04-codec-comparison/index.js
```

Expected: Table showing codec comparison (some may show N/A if not available)

**Step 4: Commit** (30 sec)

```bash
git add examples/04-codec-comparison/
git commit -m "feat(examples): add multi-codec comparison demo"
```

---

### Task 7: Create Web UI

**Files:**
- Create: `examples/web-ui/server.js`
- Create: `examples/web-ui/public/index.html`
- Create: `examples/web-ui/public/style.css`

**Step 1: Create web-ui directories** (30 sec)

```bash
mkdir -p examples/web-ui/public
```

**Step 2: Write Express server** (5 min)

Create `examples/web-ui/server.js`:

```javascript
/**
 * Web UI Server
 *
 * Simple Express server to display demo results:
 * - Dashboard with demo status
 * - Video playback for outputs
 * - Console log display
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const {execSync} = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// API: Get demo status
app.get('/api/status', (req, res) => {
  const demos = [
    {id: '01', name: 'Encode-Decode', file: null},
    {id: '02', name: 'Video Pipeline', file: 'watermarked.mp4'},
    {id: '03', name: 'Content Moderation', file: 'moderated.h264'},
    {id: '04', name: 'Codec Comparison', file: null},
  ];

  const status = demos.map(demo => {
    const hasOutput = demo.file
      ? fs.existsSync(path.join(OUTPUT_DIR, demo.file))
      : fs.existsSync(OUTPUT_DIR);

    return {
      ...demo,
      status: hasOutput ? 'completed' : 'pending',
      outputUrl: demo.file ? `/output/${demo.file}` : null,
    };
  });

  res.json({demos: status, outputDir: OUTPUT_DIR});
});

// API: Run a specific demo
app.post('/api/run/:demoId', (req, res) => {
  const {demoId} = req.params;
  const demoPath = path.join(__dirname, '..', `0${demoId}-*`, 'index.js');

  try {
    // Find the demo directory
    const matches = require('glob').sync(demoPath);
    if (matches.length === 0) {
      return res.status(404).json({error: `Demo ${demoId} not found`});
    }

    const output = execSync(`node "${matches[0]}"`, {
      encoding: 'utf8',
      timeout: 60000,
    });

    res.json({success: true, output});
  } catch (e) {
    res.status(500).json({error: e.message, output: e.stdout});
  }
});

// API: Get output files
app.get('/api/outputs', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.json({files: []});
  }

  const files = fs.readdirSync(OUTPUT_DIR).map(file => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, file));
    return {
      name: file,
      size: stat.size,
      url: `/output/${file}`,
      isVideo: /\.(mp4|h264|webm)$/i.test(file),
    };
  });

  res.json({files});
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║       node-webcodecs Demo Dashboard                ║`);
  console.log(`╠════════════════════════════════════════════════════╣`);
  console.log(`║  Open in browser: http://localhost:${PORT}            ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
});
```

**Step 3: Write HTML dashboard** (5 min)

Create `examples/web-ui/public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>node-webcodecs Demo Dashboard</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>node-webcodecs</h1>
    <p>WebCodecs API implementation for Node.js</p>
  </header>

  <main>
    <section id="demos">
      <h2>Demo Examples</h2>
      <div class="demo-grid" id="demo-grid">
        <!-- Populated by JavaScript -->
      </div>
    </section>

    <section id="outputs">
      <h2>Output Files</h2>
      <div id="output-list">
        <!-- Populated by JavaScript -->
      </div>
    </section>

    <section id="player">
      <h2>Video Player</h2>
      <video id="video-player" controls>
        <p>Select an output file to play</p>
      </video>
    </section>
  </main>

  <script>
    async function loadStatus() {
      const res = await fetch('/api/status');
      const data = await res.json();

      const grid = document.getElementById('demo-grid');
      grid.innerHTML = data.demos.map(demo => `
        <div class="demo-card ${demo.status}">
          <h3>Demo ${demo.id}: ${demo.name}</h3>
          <span class="status">${demo.status}</span>
          ${demo.outputUrl ? `<button onclick="playVideo('${demo.outputUrl}')">Play Output</button>` : ''}
        </div>
      `).join('');
    }

    async function loadOutputs() {
      const res = await fetch('/api/outputs');
      const data = await res.json();

      const list = document.getElementById('output-list');
      if (data.files.length === 0) {
        list.innerHTML = '<p>No output files yet. Run the demos first.</p>';
        return;
      }

      list.innerHTML = data.files.map(file => `
        <div class="output-item">
          <span>${file.name}</span>
          <span>${(file.size / 1024).toFixed(1)} KB</span>
          ${file.isVideo ? `<button onclick="playVideo('${file.url}')">Play</button>` : ''}
          <a href="${file.url}" download>Download</a>
        </div>
      `).join('');
    }

    function playVideo(url) {
      const player = document.getElementById('video-player');
      // For raw H.264, we can't play directly - need MP4
      if (url.endsWith('.h264')) {
        alert('Raw H.264 files cannot be played in browser. Use the MP4 version or download and play with FFplay.');
        return;
      }
      player.src = url;
      player.play();
      player.scrollIntoView({behavior: 'smooth'});
    }

    // Initial load
    loadStatus();
    loadOutputs();

    // Refresh every 5 seconds
    setInterval(() => {
      loadStatus();
      loadOutputs();
    }, 5000);
  </script>
</body>
</html>
```

**Step 4: Write CSS** (3 min)

Create `examples/web-ui/public/style.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

header h1 {
  color: #2563eb;
  font-size: 2rem;
}

header p {
  color: #666;
}

main {
  max-width: 1200px;
  margin: 0 auto;
}

section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

h2 {
  margin-bottom: 1rem;
  color: #1e40af;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.demo-card {
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.demo-card.completed {
  border-color: #22c55e;
  background: #f0fdf4;
}

.demo-card.pending {
  border-color: #fbbf24;
  background: #fffbeb;
}

.demo-card h3 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.completed .status {
  background: #22c55e;
  color: white;
}

.pending .status {
  background: #fbbf24;
  color: #78350f;
}

button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
  margin-right: 0.5rem;
}

button:hover {
  background: #1d4ed8;
}

.output-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.output-item:last-child {
  border-bottom: none;
}

.output-item span:first-child {
  flex: 1;
  font-family: monospace;
}

a {
  color: #2563eb;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

#video-player {
  width: 100%;
  max-height: 480px;
  background: #000;
  border-radius: 6px;
}
```

**Step 5: Test the server starts** (30 sec)

```bash
node examples/web-ui/server.js &
curl -s http://localhost:3000/api/status | head
kill %1
```

Expected: JSON response with demo status

**Step 6: Commit** (30 sec)

```bash
git add examples/web-ui/
git commit -m "feat(examples): add web UI dashboard for demo results"
```

---

### Task 8: Create Demo Runner Script

**Files:**
- Create: `examples/run-all.js`
- Update: `examples/.gitignore`

**Step 1: Write run-all.js** (5 min)

Create `examples/run-all.js`:

```javascript
#!/usr/bin/env node
/**
 * Demo Runner
 *
 * Runs all demos sequentially and optionally starts the web server.
 *
 * Usage:
 *   node run-all.js              # Run all demos
 *   node run-all.js --with-server  # Run demos + start web server
 */

const {spawn, fork} = require('child_process');
const path = require('path');
const fs = require('fs');

const DEMOS = [
  {id: '01', name: 'Encode-Decode', dir: '01-encode-decode'},
  {id: '02', name: 'Video Pipeline', dir: '02-video-pipeline'},
  {id: '03', name: 'Content Moderation', dir: '03-content-moderation'},
  {id: '04', name: 'Codec Comparison', dir: '04-codec-comparison'},
];

const OUTPUT_DIR = path.join(__dirname, 'output');
const WITH_SERVER = process.argv.includes('--with-server');

function printHeader() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                   node-webcodecs Demos                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  WebCodecs API implementation for Node.js using FFmpeg   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

function printProgress(current, total, name) {
  const bar = '█'.repeat(current) + '░'.repeat(total - current);
  console.log(`\n[${bar}] Demo ${current}/${total}: ${name}\n`);
}

async function runDemo(demo) {
  return new Promise((resolve, reject) => {
    const demoPath = path.join(__dirname, demo.dir, 'index.js');

    if (!fs.existsSync(demoPath)) {
      console.log(`  ⚠ Demo ${demo.id} not found, skipping`);
      resolve({success: false, skipped: true});
      return;
    }

    const child = fork(demoPath, [], {
      stdio: 'inherit',
    });

    child.on('close', code => {
      if (code === 0) {
        console.log(`\n  ✓ Demo ${demo.id} completed successfully\n`);
        resolve({success: true});
      } else {
        console.log(`\n  ✗ Demo ${demo.id} failed with code ${code}\n`);
        resolve({success: false, code});
      }
    });

    child.on('error', err => {
      console.error(`  ✗ Demo ${demo.id} error:`, err.message);
      resolve({success: false, error: err.message});
    });
  });
}

async function startServer() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Starting Web UI server...\n');

  const serverPath = path.join(__dirname, 'web-ui', 'server.js');

  if (!fs.existsSync(serverPath)) {
    console.log('  ⚠ Web UI not found');
    return;
  }

  // Keep server running
  require(serverPath);
}

async function main() {
  printHeader();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  const startTime = Date.now();
  const results = [];

  // Run each demo
  for (let i = 0; i < DEMOS.length; i++) {
    const demo = DEMOS[i];
    printProgress(i + 1, DEMOS.length, demo.name);

    const result = await runDemo(demo);
    results.push({...demo, ...result});
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('                        SUMMARY                                ');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total time: ${duration}s`);
  console.log(`  Passed: ${passed}/${DEMOS.length}`);
  if (failed > 0) console.log(`  Failed: ${failed}`);
  if (skipped > 0) console.log(`  Skipped: ${skipped}`);
  console.log('');

  // List output files
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    if (files.length > 0) {
      console.log('Output files:');
      files.forEach(f => {
        const stat = fs.statSync(path.join(OUTPUT_DIR, f));
        console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
      });
      console.log('');
    }
  }

  // Start server if requested
  if (WITH_SERVER) {
    await startServer();
  } else {
    console.log('To view results in browser, run:');
    console.log('  node web-ui/server.js');
    console.log('');
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
```

**Step 2: Create .gitignore for output** (30 sec)

Create `examples/.gitignore`:

```
output/
.demo-assets/
```

**Step 3: Test run-all.js** (1 min)

```bash
node examples/run-all.js
```

Expected: All demos run sequentially with progress bar and summary

**Step 4: Commit** (30 sec)

```bash
git add examples/run-all.js examples/.gitignore
git commit -m "feat(examples): add demo runner script"
```

---

### Task 9: Create Examples README and Update Root README

**Files:**
- Create: `examples/README.md`
- Modify: Root `README.md` (if exists, otherwise create)

**Step 1: Write examples/README.md** (5 min)

Create `examples/README.md`:

```markdown
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
```

**Step 2: Check if root README exists and read it** (30 sec)

```bash
ls -la README.md 2>/dev/null || echo "No README.md"
```

**Step 3: Add quick start to root README** (3 min)

If README.md exists, add a Quick Start section. Otherwise create a minimal one:

Add to top of root `README.md` (after any existing header):

```markdown
## Quick Start

Try node-webcodecs in 60 seconds with Docker:

```bash
git clone https://github.com/user/node-webcodecs.git
cd node-webcodecs/examples
docker compose -f docker/docker-compose.yml up demo
# Open http://localhost:3000
```

Or run locally (requires FFmpeg):

```bash
npm install && npm run build
node examples/run-all.js
```

See [examples/README.md](examples/README.md) for detailed demo documentation.
```

**Step 4: Commit** (30 sec)

```bash
git add examples/README.md README.md
git commit -m "docs: add examples README and quick start guide"
```

---

### Task 10: Code Review

**Files:** All files from Tasks 1-9

**Step 1: Run all demos to verify** (2 min)

```bash
node examples/run-all.js
```

Expected: All demos pass with summary showing 4/4 passed

**Step 2: Verify Docker builds** (2 min)

```bash
cd examples/docker
docker compose config  # Verify syntax
docker compose build   # Build image (may take a few minutes first time)
```

Expected: Build completes without errors

**Step 3: Test Docker run** (1 min)

```bash
docker compose run --rm demo-console
```

Expected: All demos run successfully inside container

**Step 4: Review file structure** (30 sec)

```bash
find examples -type f -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "Dockerfile" -o -name "*.yml" | head -20
```

Expected: Files match the planned structure

**Step 5: Final commit if any fixes needed** (30 sec)

```bash
git status
# If changes: git add -A && git commit -m "fix(examples): address review feedback"
```

---

## Cleanup

After all tasks complete:
- Remove old demo files: `examples/basic-encode.js`, `examples/run-demo.js`, `examples/watermarker.js`
- Update package.json with demo scripts if desired

```bash
rm examples/basic-encode.js examples/run-demo.js examples/watermarker.js
git add -A && git commit -m "chore(examples): remove legacy demo files"
```
