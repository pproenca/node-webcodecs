/**
 * Contract Test: VideoDecoder Flush Behavior
 *
 * Validates the CRITICAL FFmpeg flush behavior contract:
 * - flush() returns a Promise
 * - flush() causes all buffered frames to be emitted via output callback
 * - flush() can be called multiple times (idempotent)
 * - After flush(), codec remains in configured state
 */

const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
} = require('@pproenca/node-webcodecs');
const assert = require('node:assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Helper to encode frames for decoder tests
async function encodeFrames(count) {
  const chunks = [];
  const encoder = new VideoEncoder({
    output: chunk => {
      chunks.push(chunk);
    },
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  });

  const frames = [];
  for (let i = 0; i < count; i++) {
    const buf = Buffer.alloc(320 * 240 * 4);
    // Fill with varying colors for each frame
    for (let j = 0; j < 320 * 240; j++) {
      buf[j * 4] = (i * 50) % 256; // R
      buf[j * 4 + 1] = (i * 30) % 256; // G
      buf[j * 4 + 2] = (i * 70) % 256; // B
      buf[j * 4 + 3] = 255; // A
    }
    const frame = new VideoFrame(buf, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });
    frames.push(frame);
    encoder.encode(frame, {keyFrame: i === 0});
  }

  await encoder.flush();

  // Clean up frames
  for (const frame of frames) {
    frame.close();
  }
  encoder.close();

  return chunks;
}

// Test 1: flush() returns a Promise
test('flush() returns a Promise', async () => {
  const decoder = new VideoDecoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  const result = decoder.flush();
  assert.ok(result instanceof Promise, 'flush() should return a Promise');
  await result;

  decoder.close();
});

// Test 2: flush() emits buffered frames
test('flush() emits buffered frames - encode frames first, then decode and flush', async () => {
  // First encode some frames
  const encodedChunks = await encodeFrames(5);
  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks to decode');

  const decodedFrames = [];
  const decoder = new VideoDecoder({
    output: frame => {
      decodedFrames.push({
        width: frame.codedWidth,
        height: frame.codedHeight,
        timestamp: frame.timestamp,
      });
      frame.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  // Decode all chunks
  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  const framesBeforeFlush = decodedFrames.length;

  // Flush to emit all buffered frames
  await decoder.flush();

  const framesAfterFlush = decodedFrames.length;

  // Should have emitted frames after flush
  assert.ok(
    framesAfterFlush > 0,
    'Should have emitted at least one frame after flush',
  );
  assert.ok(
    framesAfterFlush >= framesBeforeFlush,
    'Frame count should not decrease after flush',
  );

  decoder.close();
});

// Test 3: flush() is idempotent
test('flush() is idempotent - calling twice does not error', async () => {
  const encodedChunks = await encodeFrames(3);

  const decoder = new VideoDecoder({
    output: frame => {
      frame.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  // Call flush twice - should not throw
  await decoder.flush();
  await decoder.flush();

  decoder.close();
});

// Test 4: state remains configured after flush
test('state remains configured after flush', async () => {
  const encodedChunks = await encodeFrames(3);

  const decoder = new VideoDecoder({
    output: frame => {
      frame.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  assert.strictEqual(
    decoder.state,
    'configured',
    'State should be configured before flush',
  );

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();

  assert.strictEqual(
    decoder.state,
    'configured',
    'State should remain configured after flush',
  );

  decoder.close();
});

async function run() {
  console.log('Contract: VideoDecoder Flush Behavior\n');
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
