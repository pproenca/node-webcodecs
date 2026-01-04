/**
 * Contract Test: RangeError Validation
 *
 * PURPOSE: These tests verify W3C WebCodecs bounds checking.
 * RangeError is thrown when buffers are too small or indices are invalid.
 *
 * RELATIONSHIP TO GOLDEN TESTS: These tests overlap with golden tests intentionally.
 * Golden tests verify feature correctness; contract tests verify spec compliance.
 * Both should pass independently.
 *
 * RUN: tsx test/contracts/error_handling/range_errors.ts
 */

const {
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
} = require('@pproenca/node-webcodecs');
import * as assert from 'node:assert';

const tests: Array<{name: string; fn: () => void | Promise<void>}> = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({name, fn});
}

// VideoFrame copyTo() bounds validation tests

test('VideoFrame.copyTo() with undersized buffer throws RangeError', async () => {
  const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
    format: 'RGBA',
    codedWidth: 100,
    codedHeight: 100,
    timestamp: 0,
  });

  // Buffer too small (need 100*100*4 = 40000 bytes)
  const dest = new ArrayBuffer(100);

  let threw = false;
  try {
    await frame.copyTo(dest);
  } catch (e) {
    threw = e instanceof RangeError;
  }

  frame.close();
  assert.ok(threw, 'should throw RangeError for undersized buffer');
});

test('VideoFrame.copyTo() with rect out of bounds throws RangeError', async () => {
  const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
    format: 'RGBA',
    codedWidth: 100,
    codedHeight: 100,
    timestamp: 0,
  });

  const dest = new ArrayBuffer(100 * 100 * 4);

  let threw = false;
  try {
    await frame.copyTo(dest, {
      rect: {x: 90, y: 90, width: 50, height: 50}, // Extends beyond frame
    });
  } catch (e) {
    // W3C spec allows either RangeError or TypeError for invalid rect
    threw = e instanceof RangeError || e instanceof TypeError;
  }

  frame.close();
  assert.ok(threw, 'should throw for rect extending beyond frame bounds');
});

// AudioData bounds validation tests

test('AudioData.allocationSize() with invalid planeIndex throws RangeError', () => {
  const audioData = new AudioData({
    format: 'f32-planar',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: new Float32Array(1024 * 2),
  });

  let threw = false;
  try {
    audioData.allocationSize({planeIndex: 10}); // Only 2 channels
  } catch (e) {
    threw = e instanceof RangeError;
  }

  audioData.close();
  assert.ok(threw, 'should throw RangeError for invalid planeIndex');
});

test('AudioData.copyTo() with undersized buffer throws RangeError', () => {
  const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: new Float32Array(1024 * 2),
  });

  // Need 1024*2*4 = 8192 bytes, provide only 100
  const dest = new ArrayBuffer(100);

  let threw = false;
  try {
    audioData.copyTo(dest, {planeIndex: 0});
  } catch (e) {
    threw = e instanceof RangeError;
  }

  audioData.close();
  assert.ok(threw, 'should throw RangeError for undersized buffer');
});

// EncodedVideoChunk bounds validation tests

test('EncodedVideoChunk.copyTo() with undersized destination throws RangeError', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(1000),
  });

  // Provide buffer smaller than byteLength
  const dest = new ArrayBuffer(10);

  let threw = false;
  try {
    chunk.copyTo(dest);
  } catch (e) {
    // W3C spec allows either RangeError or TypeError for undersized buffer
    threw = e instanceof RangeError || e instanceof TypeError;
  }

  assert.ok(threw, 'should throw for undersized destination');
});

// EncodedAudioChunk bounds validation tests

test('EncodedAudioChunk.copyTo() with undersized destination throws RangeError', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(1000),
  });

  // Provide buffer smaller than byteLength
  const dest = new ArrayBuffer(10);

  let threw = false;
  try {
    chunk.copyTo(dest);
  } catch (e) {
    // W3C spec allows either RangeError or TypeError for undersized buffer
    threw = e instanceof RangeError || e instanceof TypeError;
  }

  assert.ok(threw, 'should throw for undersized destination');
});

async function run() {
  console.log('Contract: RangeError Validation\n');
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
