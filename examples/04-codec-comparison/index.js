/**
 * Demo 04: Codec Comparison
 *
 * Compares encoding performance across multiple codecs:
 * - H.264 (AVC)
 * - H.265 (HEVC)
 * - VP9
 * - AV1
 */

const fs = require('node:fs');
const path = require('node:path');
const {VideoEncoder, VideoFrame} = require('@pproenca/node-webcodecs');

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
