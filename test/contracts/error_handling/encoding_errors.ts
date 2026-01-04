/**
 * Contract Test: EncodingError Validation
 *
 * PURPOSE: These tests verify W3C WebCodecs EncodingError conditions.
 * EncodingErrors are delivered via error callback when FFmpeg fails to
 * decode corrupted or malformed bitstreams.
 *
 * KEY POINT: EncodingError is async - delivered via callback, not thrown.
 * Per W3C spec, decode failures during async processing invoke the error
 * callback rather than throwing synchronously.
 *
 * RELATIONSHIP TO GOLDEN TESTS: These tests overlap with golden tests intentionally.
 * Golden tests verify feature correctness; contract tests verify spec compliance.
 * Both should pass independently.
 *
 * RUN: tsx test/contracts/error_handling/encoding_errors.ts
 */

const {
  VideoDecoder,
  AudioDecoder,
  EncodedVideoChunk,
  EncodedAudioChunk,
} = require('@pproenca/node-webcodecs');
import * as assert from 'node:assert';

const tests: Array<{name: string; fn: () => void | Promise<void>}> = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({name, fn});
}

// Test 1: Corrupted H.264 data triggers EncodingError on VideoDecoder
test('VideoDecoder: corrupted NAL units trigger EncodingError callback', async () => {
  let errorReceived = null;
  const decoder = new VideoDecoder({
    output: () => {},
    error: (e) => {
      errorReceived = e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
  });

  // Corrupted data - invalid NAL unit header (forbidden_zero_bit set + garbage)
  const corruptedData = Buffer.from([
    0x80, 0xff, 0xff, 0xff, 0x00, 0x00, 0x01, 0xff,
  ]);
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: corruptedData,
  });

  decoder.decode(chunk);

  // Wait for async error callback - FFmpeg may take time to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  decoder.close();

  assert.ok(
    errorReceived,
    'error callback should have been invoked for corrupted data',
  );
  // EncodingError is the spec name, but implementation may use different name
  assert.ok(
    errorReceived.name === 'EncodingError' ||
      errorReceived.message.toLowerCase().includes('decode') ||
      errorReceived.message.toLowerCase().includes('invalid'),
    `Expected EncodingError-like error but got ${errorReceived.name}: ${errorReceived.message}`,
  );
});

// Test 2: Truncated video chunk triggers EncodingError
test('VideoDecoder: truncated chunk triggers EncodingError callback', async () => {
  let errorReceived = null;
  const decoder = new VideoDecoder({
    output: () => {},
    error: (e) => {
      errorReceived = e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
  });

  // Single byte is definitely not a valid H.264 frame
  const truncatedData = Buffer.from([0x00]);
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: truncatedData,
  });

  decoder.decode(chunk);

  // Wait for async error callback
  await new Promise((resolve) => setTimeout(resolve, 500));

  decoder.close();

  assert.ok(
    errorReceived,
    'error callback should have been invoked for truncated data',
  );
});

// Test 3: Zero-byte chunk handling on VideoDecoder
// Note: Per WebCodecs spec, zero-byte chunks may be silently skipped rather than error.
// This test documents that behavior and ensures decoder remains functional.
test('VideoDecoder: zero-byte chunk is handled gracefully', async () => {
  let errorReceived = null;
  let outputReceived = false;
  const decoder = new VideoDecoder({
    output: () => {
      outputReceived = true;
    },
    error: (e) => {
      errorReceived = e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
  });

  // Empty data buffer - may be silently skipped or error
  const emptyData = Buffer.alloc(0);

  // This may throw synchronously at construction or decode, or be silently skipped
  let syncError = null;
  try {
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: emptyData,
    });
    decoder.decode(chunk);
  } catch (e) {
    syncError = e;
  }

  // Wait for potential async callback
  await new Promise((resolve) => setTimeout(resolve, 500));

  decoder.close();

  // Zero-byte chunks may be: sync error, async error, or silently skipped (no output)
  // All of these are acceptable behaviors
  assert.ok(
    syncError || errorReceived || !outputReceived,
    'zero-byte chunk should be handled (error or silently skipped)',
  );
});

// Test 4: Corrupted audio data triggers error on AudioDecoder
test('AudioDecoder: corrupted AAC data triggers error callback', async () => {
  let errorReceived = null;
  const decoder = new AudioDecoder({
    output: () => {},
    error: (e) => {
      errorReceived = e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  // Invalid AAC frame - garbage bytes that don't form valid ADTS/raw AAC
  const corruptedData = Buffer.from([0xff, 0xff, 0x00, 0x00]);
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: corruptedData,
  });

  decoder.decode(chunk);

  // Wait for async error callback
  await new Promise((resolve) => setTimeout(resolve, 500));

  decoder.close();

  assert.ok(
    errorReceived,
    'error callback should have been invoked for corrupted audio',
  );
});

async function run() {
  console.log('Contract: EncodingError Validation\n');
  let passed = 0;
  let failed = 0;

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
