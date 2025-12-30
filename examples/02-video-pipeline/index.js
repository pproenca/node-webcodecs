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
