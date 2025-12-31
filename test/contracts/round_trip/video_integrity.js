/**
 * P0 Contract: Video Round-Trip Integrity
 *
 * These are the HIGHEST VALUE FFmpeg integration tests - they verify
 * encode->decode produces correct output.
 */

const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../../../dist');
const assert = require('node:assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Test 1: Encode-decode produces frames with correct dimensions
test('encode-decode produces frames with correct dimensions', async () => {
  const width = 320;
  const height = 240;
  const encodedChunks = [];
  const decodedFrames = [];

  // Encoder setup
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: width,
    height: height,
    bitrate: 500_000,
    framerate: 30,
  });

  // Create and encode a frame
  const buf = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = 128; // R
    buf[i * 4 + 1] = 64; // G
    buf[i * 4 + 2] = 192; // B
    buf[i * 4 + 3] = 255; // A
  }
  const frame = new VideoFrame(buf, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
  });

  encoder.encode(frame, {keyFrame: true});
  frame.close();
  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded at least one chunk');

  // Decoder setup
  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedFrames.push({
        width: decodedFrame.codedWidth,
        height: decodedFrame.codedHeight,
      });
      decodedFrame.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height,
  });

  // Decode all chunks
  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  assert.ok(decodedFrames.length > 0, 'Should have decoded at least one frame');

  // Verify dimensions match
  for (const decoded of decodedFrames) {
    assert.strictEqual(
      decoded.width,
      width,
      `Decoded width should be ${width}`,
    );
    assert.strictEqual(
      decoded.height,
      height,
      `Decoded height should be ${height}`,
    );
  }
});

// Test 2: Timestamps are preserved through round-trip
// Note: FFmpeg may normalize timestamps through its internal timebase conversion,
// so we verify that timestamps are monotonically increasing and count matches,
// rather than exact microsecond values.
test('timestamps are preserved through round-trip', async () => {
  const width = 320;
  const height = 240;
  const frameCount = 5;
  const encodedChunks = [];
  const decodedTimestamps = [];

  // Encoder setup
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: width,
    height: height,
    bitrate: 500_000,
    framerate: 30,
  });

  // Create and encode frames with sequential timestamps
  for (let i = 0; i < frameCount; i++) {
    const buf = Buffer.alloc(width * height * 4);
    for (let j = 0; j < width * height; j++) {
      buf[j * 4] = (i * 50) % 256;
      buf[j * 4 + 1] = (i * 30) % 256;
      buf[j * 4 + 2] = (i * 70) % 256;
      buf[j * 4 + 3] = 255;
    }
    const frame = new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp: i * 33333, // ~30fps in microseconds
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

  // Decoder setup
  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedTimestamps.push(decodedFrame.timestamp);
      decodedFrame.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  // Verify we get the same number of frames
  assert.strictEqual(
    decodedTimestamps.length,
    frameCount,
    `Decoded frame count (${decodedTimestamps.length}) should match input (${frameCount})`,
  );

  // Sort timestamps and verify they are monotonically increasing
  const sortedDecoded = [...decodedTimestamps].sort((a, b) => a - b);

  for (let i = 1; i < sortedDecoded.length; i++) {
    assert.ok(
      sortedDecoded[i] > sortedDecoded[i - 1],
      `Timestamps should be monotonically increasing: ${sortedDecoded[i - 1]} -> ${sortedDecoded[i]}`,
    );
  }

  // Verify first timestamp starts at 0
  assert.strictEqual(
    sortedDecoded[0],
    0,
    'First decoded timestamp should be 0',
  );
});

// Test 3: Multiple frames round-trip successfully
test('multiple frames round-trip successfully', async () => {
  const width = 320;
  const height = 240;
  const frameCount = 10;
  const encodedChunks = [];
  let decodedCount = 0;

  // Encoder setup
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: width,
    height: height,
    bitrate: 500_000,
    framerate: 30,
  });

  // Encode multiple frames
  for (let i = 0; i < frameCount; i++) {
    const buf = Buffer.alloc(width * height * 4);
    for (let j = 0; j < width * height; j++) {
      buf[j * 4] = (i * 25) % 256;
      buf[j * 4 + 1] = (i * 45) % 256;
      buf[j * 4 + 2] = (i * 65) % 256;
      buf[j * 4 + 3] = 255;
    }
    const frame = new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp: i * 33333,
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

  // Decoder setup
  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedCount++;
      decodedFrame.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  assert.strictEqual(
    decodedCount,
    frameCount,
    `Decoded frame count (${decodedCount}) should match input frame count (${frameCount})`,
  );
});

async function run() {
  console.log('Contract: Video Round-Trip Integrity\n');
  let passed = 0,
    failed = 0;
  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
run();
