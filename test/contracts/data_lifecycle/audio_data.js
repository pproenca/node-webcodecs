/**
 * Contract Tests: AudioData Data Lifecycle
 *
 * Verifies AudioData constructor, properties, close(), clone(),
 * allocationSize(), copyTo(), and duration behaviors per W3C WebCodecs spec.
 */

const {AudioData} = require('../../../dist');
const assert = require('assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Test constants
const SAMPLE_RATE = 48000;
const NUMBER_OF_CHANNELS = 2;
const NUMBER_OF_FRAMES = 1024;
const FORMAT = 'f32'; // 32-bit float
const BYTES_PER_SAMPLE = 4; // f32 = 4 bytes

// Helper to create test audio data
function createTestAudioData(timestamp = 0, fillValue = 0) {
  const samples = new Float32Array(NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS);
  if (fillValue !== 0) {
    samples.fill(fillValue);
  }
  return new AudioData({
    format: FORMAT,
    sampleRate: SAMPLE_RATE,
    numberOfFrames: NUMBER_OF_FRAMES,
    numberOfChannels: NUMBER_OF_CHANNELS,
    timestamp: timestamp,
    data: samples.buffer,
  });
}

// Test 1: constructor creates audio with correct properties
test('constructor creates audio with correct properties', () => {
  const audioData = createTestAudioData(5000);

  assert.strictEqual(audioData.format, FORMAT, 'format should be f32');
  assert.strictEqual(
    audioData.sampleRate,
    SAMPLE_RATE,
    'sampleRate should be 48000',
  );
  assert.strictEqual(
    audioData.numberOfFrames,
    NUMBER_OF_FRAMES,
    'numberOfFrames should be 1024',
  );
  assert.strictEqual(
    audioData.numberOfChannels,
    NUMBER_OF_CHANNELS,
    'numberOfChannels should be 2',
  );
  assert.strictEqual(audioData.timestamp, 5000, 'timestamp should match');

  audioData.close();
});

// Test 2: close() marks audio as closed
test('close() marks audio as closed', () => {
  const audioData = createTestAudioData();
  audioData.close();

  // After close, format should return null per WebCodecs spec
  assert.strictEqual(
    audioData.format,
    null,
    'format should be null after close',
  );

  // Operations on closed AudioData should throw
  let threwOnAllocationSize = false;
  try {
    audioData.allocationSize();
  } catch (e) {
    threwOnAllocationSize = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(
    threwOnAllocationSize,
    'allocationSize() should throw on closed audio',
  );

  let threwOnClone = false;
  try {
    audioData.clone();
  } catch (e) {
    threwOnClone = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(threwOnClone, 'clone() should throw on closed audio');
});

// Test 3: clone() creates independent copy
test('clone() creates independent copy', () => {
  const original = createTestAudioData(10000);
  const cloned = original.clone();

  // Verify clone has same properties
  assert.strictEqual(
    cloned.format,
    original.format,
    'clone format should match',
  );
  assert.strictEqual(
    cloned.sampleRate,
    original.sampleRate,
    'clone sampleRate should match',
  );
  assert.strictEqual(
    cloned.numberOfFrames,
    original.numberOfFrames,
    'clone numberOfFrames should match',
  );
  assert.strictEqual(
    cloned.numberOfChannels,
    original.numberOfChannels,
    'clone numberOfChannels should match',
  );
  assert.strictEqual(
    cloned.timestamp,
    original.timestamp,
    'clone timestamp should match',
  );

  // Close original
  original.close();

  // Clone should still be fully functional
  assert.strictEqual(
    cloned.format,
    FORMAT,
    'clone should still be accessible after original closed',
  );
  assert.strictEqual(
    cloned.sampleRate,
    SAMPLE_RATE,
    'clone sampleRate still accessible',
  );
  assert.strictEqual(
    cloned.timestamp,
    10000,
    'clone timestamp still accessible',
  );

  // Clone can still provide allocation size
  const size = cloned.allocationSize();
  assert.ok(size > 0, 'clone allocationSize should still work');

  cloned.close();
});

// Test 4: allocationSize() returns correct size
test('allocationSize() returns correct size', () => {
  const audioData = createTestAudioData();

  // For f32 stereo: 1024 frames * 2 channels * 4 bytes = 8192 bytes
  const expectedSize = NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE;
  const actualSize = audioData.allocationSize();

  assert.strictEqual(
    actualSize,
    expectedSize,
    `allocationSize should be ${expectedSize} for 1024-frame stereo f32`,
  );

  audioData.close();
});

// Test 5: duration is computed correctly
test('duration is computed correctly', () => {
  const audioData = createTestAudioData();

  // Duration = (numberOfFrames / sampleRate) * 1_000_000 microseconds
  // = (1024 / 48000) * 1_000_000 = 21333.33... microseconds
  const expectedDuration = Math.floor(
    (NUMBER_OF_FRAMES / SAMPLE_RATE) * 1000000,
  );
  const actualDuration = audioData.duration;

  assert.strictEqual(
    actualDuration,
    expectedDuration,
    `duration should be ${expectedDuration} microseconds`,
  );

  audioData.close();
});

// Test 6: copyTo() copies data correctly
test('copyTo() copies data correctly', () => {
  // Create audio data with a specific pattern
  const samples = new Float32Array(NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (i % 256) / 256; // Create recognizable pattern
  }

  const audioData = new AudioData({
    format: FORMAT,
    sampleRate: SAMPLE_RATE,
    numberOfFrames: NUMBER_OF_FRAMES,
    numberOfChannels: NUMBER_OF_CHANNELS,
    timestamp: 0,
    data: samples.buffer,
  });

  // Copy to destination buffer
  const destBuffer = new ArrayBuffer(
    NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE,
  );
  audioData.copyTo(destBuffer);

  const destView = new Float32Array(destBuffer);
  // Verify data was copied
  assert.strictEqual(destView[0], samples[0], 'First sample should match');
  assert.strictEqual(destView[100], samples[100], 'Middle sample should match');

  audioData.close();
});

// Test 7: copyTo() throws on closed audio
test('copyTo() throws on closed audio', () => {
  const audioData = createTestAudioData();
  audioData.close();

  const dest = new ArrayBuffer(
    NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE,
  );
  let threw = false;
  try {
    audioData.copyTo(dest);
  } catch (e) {
    threw = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(threw, 'copyTo() should throw on closed audio');
});

// Test 8: close() is idempotent
test('close() is idempotent', () => {
  const audioData = createTestAudioData();

  // Multiple close calls should not throw
  audioData.close();
  audioData.close();
  audioData.close();

  // Audio should still be closed
  assert.strictEqual(
    audioData.format,
    null,
    'Audio should remain closed after multiple close() calls',
  );
});

// Test 9: different sample rates produce correct duration
test('different sample rates produce correct duration', () => {
  const sampleRates = [44100, 48000, 96000];

  for (const rate of sampleRates) {
    const samples = new Float32Array(NUMBER_OF_FRAMES * NUMBER_OF_CHANNELS);
    const audioData = new AudioData({
      format: FORMAT,
      sampleRate: rate,
      numberOfFrames: NUMBER_OF_FRAMES,
      numberOfChannels: NUMBER_OF_CHANNELS,
      timestamp: 0,
      data: samples.buffer,
    });

    const expectedDuration = Math.floor((NUMBER_OF_FRAMES / rate) * 1000000);
    assert.strictEqual(
      audioData.duration,
      expectedDuration,
      `Duration at ${rate}Hz should be ${expectedDuration}`,
    );

    audioData.close();
  }
});

// Test runner
async function run() {
  console.log('Contract: AudioData Data Lifecycle\n');
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
