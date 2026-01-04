/**
 * Contract Tests: EncodedVideoChunk and EncodedAudioChunk Data Lifecycle
 *
 * Verifies constructor, properties, and copyTo() behaviors for both
 * EncodedVideoChunk and EncodedAudioChunk per W3C WebCodecs spec.
 */

import {EncodedVideoChunk, EncodedAudioChunk} from '@pproenca/node-webcodecs';
import * as assert from 'node:assert';

const tests: Array<{name: string; fn: () => void | Promise<void>}> = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({name, fn});
}

// Sample H.264 NAL unit header (SPS)
const VIDEO_DATA = Buffer.from([
  0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1e,
]);

// Sample AAC ADTS header
const AUDIO_DATA = Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x01, 0x1f, 0xfc]);

// ============================================
// EncodedVideoChunk Tests
// ============================================

// Test 1: EncodedVideoChunk has correct properties (key frame)
test('EncodedVideoChunk has correct properties (key frame)', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: VIDEO_DATA,
  });

  assert.strictEqual(chunk.type, 'key', 'type should be key');
  assert.strictEqual(chunk.timestamp, 0, 'timestamp should be 0');
  assert.strictEqual(
    chunk.byteLength,
    VIDEO_DATA.length,
    `byteLength should be ${VIDEO_DATA.length}`,
  );
});

// Test 2: EncodedVideoChunk has correct properties (delta frame)
test('EncodedVideoChunk has correct properties (delta frame)', () => {
  const chunk = new EncodedVideoChunk({
    type: 'delta',
    timestamp: 33333,
    data: VIDEO_DATA,
  });

  assert.strictEqual(chunk.type, 'delta', 'type should be delta');
  assert.strictEqual(chunk.timestamp, 33333, 'timestamp should be 33333');
  assert.strictEqual(
    chunk.byteLength,
    VIDEO_DATA.length,
    `byteLength should be ${VIDEO_DATA.length}`,
  );
});

// Test 3: EncodedVideoChunk with duration
test('EncodedVideoChunk with duration', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 1000,
    duration: 33333,
    data: VIDEO_DATA,
  });

  assert.strictEqual(chunk.type, 'key', 'type should be key');
  assert.strictEqual(chunk.timestamp, 1000, 'timestamp should be 1000');
  assert.strictEqual(chunk.duration, 33333, 'duration should be 33333');
  assert.strictEqual(
    chunk.byteLength,
    VIDEO_DATA.length,
    'byteLength should match',
  );
});

// Test 4: EncodedVideoChunk.copyTo() works with ArrayBuffer
test('EncodedVideoChunk.copyTo() works with ArrayBuffer', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: VIDEO_DATA,
  });

  const dest = new ArrayBuffer(VIDEO_DATA.length);
  chunk.copyTo(dest);

  const view = new Uint8Array(dest);
  assert.deepStrictEqual(
    Array.from(view),
    Array.from(VIDEO_DATA),
    'Copied data should match original',
  );
});

// Test 5: EncodedVideoChunk.copyTo() works with Uint8Array
test('EncodedVideoChunk.copyTo() works with Uint8Array', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: VIDEO_DATA,
  });

  const dest = new Uint8Array(VIDEO_DATA.length);
  chunk.copyTo(dest);

  assert.deepStrictEqual(
    Array.from(dest),
    Array.from(VIDEO_DATA),
    'Copied data should match original',
  );
});

// Test 6: EncodedVideoChunk.copyTo() throws on too small buffer
test('EncodedVideoChunk.copyTo() throws on too small buffer', () => {
  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: VIDEO_DATA,
  });

  const smallBuffer = new Uint8Array(2); // Too small
  let threw = false;
  try {
    chunk.copyTo(smallBuffer);
  } catch (e) {
    threw = true;
    assert.ok(
      e.message.includes('small') || e.message.includes('TypeError'),
      `Expected buffer too small error, got: ${e.message}`,
    );
  }
  assert.ok(threw, 'copyTo() should throw on too small buffer');
});

// ============================================
// EncodedAudioChunk Tests
// ============================================

// Test 7: EncodedAudioChunk has correct properties (key frame)
test('EncodedAudioChunk has correct properties (key frame)', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: AUDIO_DATA,
  });

  assert.strictEqual(chunk.type, 'key', 'type should be key');
  assert.strictEqual(chunk.timestamp, 0, 'timestamp should be 0');
  assert.strictEqual(
    chunk.byteLength,
    AUDIO_DATA.length,
    `byteLength should be ${AUDIO_DATA.length}`,
  );
});

// Test 8: EncodedAudioChunk has correct properties (delta frame)
test('EncodedAudioChunk has correct properties (delta frame)', () => {
  const chunk = new EncodedAudioChunk({
    type: 'delta',
    timestamp: 21333,
    data: AUDIO_DATA,
  });

  assert.strictEqual(chunk.type, 'delta', 'type should be delta');
  assert.strictEqual(chunk.timestamp, 21333, 'timestamp should be 21333');
  assert.strictEqual(
    chunk.byteLength,
    AUDIO_DATA.length,
    `byteLength should be ${AUDIO_DATA.length}`,
  );
});

// Test 9: EncodedAudioChunk with duration
test('EncodedAudioChunk with duration', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    duration: 21333,
    data: AUDIO_DATA,
  });

  assert.strictEqual(chunk.type, 'key', 'type should be key');
  assert.strictEqual(chunk.timestamp, 0, 'timestamp should be 0');
  assert.strictEqual(chunk.duration, 21333, 'duration should be 21333');
  assert.strictEqual(
    chunk.byteLength,
    AUDIO_DATA.length,
    'byteLength should match',
  );
});

// Test 10: EncodedAudioChunk.copyTo() works with ArrayBuffer
test('EncodedAudioChunk.copyTo() works with ArrayBuffer', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: AUDIO_DATA,
  });

  const dest = new ArrayBuffer(AUDIO_DATA.length);
  chunk.copyTo(dest);

  const view = new Uint8Array(dest);
  assert.deepStrictEqual(
    Array.from(view),
    Array.from(AUDIO_DATA),
    'Copied data should match original',
  );
});

// Test 11: EncodedAudioChunk.copyTo() works with Uint8Array
test('EncodedAudioChunk.copyTo() works with Uint8Array', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: AUDIO_DATA,
  });

  const dest = new Uint8Array(AUDIO_DATA.length);
  chunk.copyTo(dest);

  assert.deepStrictEqual(
    Array.from(dest),
    Array.from(AUDIO_DATA),
    'Copied data should match original',
  );
});

// Test 12: EncodedAudioChunk.copyTo() throws on too small buffer
test('EncodedAudioChunk.copyTo() throws on too small buffer', () => {
  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: AUDIO_DATA,
  });

  const smallBuffer = new Uint8Array(2); // Too small
  let threw = false;
  try {
    chunk.copyTo(smallBuffer);
  } catch (e) {
    threw = true;
    assert.ok(
      e.message.includes('small') || e.message.includes('TypeError'),
      `Expected buffer too small error, got: ${e.message}`,
    );
  }
  assert.ok(threw, 'copyTo() should throw on too small buffer');
});

// Test 13: EncodedVideoChunk byteLength matches data length
test('EncodedVideoChunk byteLength matches data length', () => {
  const data = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) {
    data[i] = i;
  }

  const chunk = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: data,
  });

  assert.strictEqual(chunk.byteLength, 256, 'byteLength should be 256');
});

// Test 14: EncodedAudioChunk byteLength matches data length
test('EncodedAudioChunk byteLength matches data length', () => {
  const data = Buffer.alloc(512);
  for (let i = 0; i < 512; i++) {
    data[i] = i % 256;
  }

  const chunk = new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: data,
  });

  assert.strictEqual(chunk.byteLength, 512, 'byteLength should be 512');
});

// Test runner
async function run() {
  console.log('Contract: EncodedVideoChunk and EncodedAudioChunk Lifecycle\n');
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
