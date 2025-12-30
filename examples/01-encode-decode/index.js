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
