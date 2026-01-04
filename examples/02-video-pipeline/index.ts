/**
 * Demo 02: Video Processing Pipeline
 *
 * Demonstrates real-world video processing:
 * 1. Open MP4 file OR generate test frames with TestVideoGenerator
 * 2. Demux video track (when using external file)
 * 3. Decode frames to RGBA
 * 4. Apply watermark transformation
 * 5. Re-encode to H.264
 * 6. Output playable MP4 file using native Muxer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  Demuxer,
  Muxer,
  TestVideoGenerator,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} from '@pproenca/node-webcodecs';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = path.join(CURRENT_DIR, '..', 'output');
const INPUT_VIDEO = path.join(OUTPUT_DIR, 'input.mp4');
const OUTPUT_MP4 = path.join(OUTPUT_DIR, 'watermarked.mp4');

// Watermark state
let boxX = 20;
let boxY = 20;
let boxDX = 2;
let boxDY = 1;
const BOX_SIZE = 40;

function drawWatermark(rgbaData: Uint8Array, width: number, height: number): void {
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
      rgbaData[idx] = 255; // R
      rgbaData[idx + 1] = 255; // G
      rgbaData[idx + 2] = 0; // B
    }
  }
}

/**
 * Process video from an external MP4 file using Demuxer + Decoder
 * Returns collected frames for processing with backpressure
 */
async function processFromFile(inputPath) {
  return new Promise((resolve, reject) => {
    let videoTrack = null;
    const frames = [];

    const decoder = new VideoDecoder({
      output: frame => {
        frames.push(frame);
        if (frames.length % 30 === 0) {
          process.stdout.write(`    Decoded ${frames.length} frames...\r`);
        }
      },
      error: e => reject(e),
    });

    const demuxer = new Demuxer({
      onTrack: track => {
        if (track.type === 'video') {
          videoTrack = track;
          console.log(
            `    Found video: ${track.width}x${track.height} (${track.codec})`
          );

          decoder.configure({
            codec: 'avc1.42001e',
            codedWidth: track.width,
            codedHeight: track.height,
            description: track.extradata,
          });
        }
      },
      onChunk: (chunk, trackIndex) => {
        if (videoTrack && trackIndex === videoTrack.index) {
          decoder.decode(chunk);
        }
      },
      onError: e => reject(e),
    });

    demuxer
      .open(inputPath)
      .then(() => demuxer.demux())
      .then(() => decoder.flush())
      .then(() => {
        demuxer.close();
        decoder.close();
        resolve({
          frames,
          width: videoTrack.width,
          height: videoTrack.height,
        });
      })
      .catch(reject);
  });
}

/**
 * Generate test frames using native TestVideoGenerator
 * This bypasses the need for Demuxer when no input file exists
 * Returns collected frames for processing with backpressure
 */
async function generateTestFrames() {
  const width = 320;
  const height = 240;
  const frameRate = 30;
  const duration = 3;

  console.log('    Generating test video with native TestVideoGenerator...');

  const generator = new TestVideoGenerator();
  generator.configure({width, height, frameRate, duration, pattern: 'testsrc'});

  // Collect frames (generator callback is sync, can't await inside)
  const frames = [];
  await generator.generate(frame => {
    frames.push(frame);
  });

  generator.close();
  console.log(`    Generated ${frames.length} test frames`);

  return {frames, width, height};
}

async function main() {
  console.log('=== Demo 02: Video Processing Pipeline ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  const encodedChunks = [];
  let codecDescription = null;

  // Check if we have an input file or need to generate test content
  const useExternalFile = fs.existsSync(INPUT_VIDEO);

  // Step 1: Prepare input source
  console.log('[1/6] Preparing input source...');
  if (useExternalFile) {
    console.log(`    Using existing file: ${INPUT_VIDEO}\n`);
  } else {
    console.log('    No input file found - will generate test frames directly\n');
  }

  // Step 2 & 3: Get frames (either from file or generator)
  if (useExternalFile) {
    console.log('[2/6] Opening video file with Demuxer...');
    console.log('[3/6] Creating VideoDecoder...');
  } else {
    console.log('[2/6] Setting up TestVideoGenerator...');
    console.log('[3/6] Skipping decoder (direct frame generation)...');
  }

  // Collect frames first
  let frames: VideoFrame[];
  let videoWidth: number;
  let videoHeight: number;
  if (useExternalFile) {
    const result = await processFromFile(INPUT_VIDEO);
    frames = result.frames;
    videoWidth = result.width;
    videoHeight = result.height;
  } else {
    const result = await generateTestFrames();
    frames = result.frames;
    videoWidth = result.width;
    videoHeight = result.height;
  }

  // Step 4: Process video with backpressure
  console.log('[4/6] Processing frames (watermark -> encode)...');
  const startTime = performance.now();

  // Create encoder
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
      if (metadata?.decoderConfig?.description) {
        codecDescription = metadata.decoderConfig.description;
      }
    },
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: videoWidth,
    height: videoHeight,
    bitrate: 1_000_000,
    framerate: 30,
    latencyMode: 'realtime',  // Disable B-frames for correct MP4 muxing
    avc: {format: 'avc'},
  });

  // Process frames with backpressure
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

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

    // Wait for encoder capacity before encoding
    await encoder.ready;
    encoder.encode(modifiedFrame, {keyFrame: i % 30 === 0});
    modifiedFrame.close();
    frame.close();

    if ((i + 1) % 30 === 0) {
      process.stdout.write(`    Processed ${i + 1} frames...\r`);
    }
  }

  await encoder.flush();
  encoder.close();
  const endTime = performance.now();
  const framesProcessed = frames.length;

  console.log(
    `\n    Processed ${framesProcessed} frames in ${(endTime - startTime).toFixed(1)}ms\n`
  );

  // Step 5: Mux directly to MP4 using native Muxer
  console.log('[5/6] Muxing to MP4 container with native Muxer...');
  const muxer = new Muxer({filename: OUTPUT_MP4});
  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width: videoWidth,
    height: videoHeight,
    description: codecDescription,
  });

  // Sort and write chunks
  const sortedChunks = [...encodedChunks].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  sortedChunks.forEach(chunk => { muxer.writeVideoChunk(chunk); });

  muxer.finalize();
  muxer.close();

  // Calculate output size
  const outputStats = fs.statSync(OUTPUT_MP4);
  const outputBytes = outputStats.size;

  console.log(`    MP4: ${OUTPUT_MP4} (${(outputBytes / 1024).toFixed(2)} KB)\n`);

  // Step 6: Done
  console.log('[6/6] Pipeline complete.\n');

  console.log('=== Demo 02 Complete ===\n');
  console.log('Output files:');
  console.log(`  ${OUTPUT_MP4}`);
  console.log(`\nPlay with: ffplay ${OUTPUT_MP4}`);

  return {
    framesProcessed,
    outputBytes,
    processingTimeMs: endTime - startTime,
    outputPath: OUTPUT_MP4,
  };
}

export {main};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  });
}
