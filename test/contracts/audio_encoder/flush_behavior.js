/**
 * Contract Test: AudioEncoder Flush Behavior
 *
 * Validates the CRITICAL FFmpeg flush behavior contract:
 * - flush() returns a Promise
 * - flush() causes all buffered frames to be emitted via output callback
 * - flush() can be called multiple times (idempotent)
 * - After flush(), codec remains in configured state
 */

const {AudioEncoder, AudioData} = require('../../../dist');
const assert = require('node:assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Helper to create audio data
function createAudioData(frameIndex) {
  const sampleRate = 48000;
  const numberOfChannels = 2;
  const frameSize = 1024;

  const samples = new Float32Array(frameSize * numberOfChannels);
  // Generate 440Hz sine wave
  for (let j = 0; j < frameSize; j++) {
    const t = (frameIndex * frameSize + j) / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    samples[j * 2] = sample; // Left
    samples[j * 2 + 1] = sample; // Right
  }

  return new AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: frameSize,
    numberOfChannels: numberOfChannels,
    timestamp: frameIndex * 21333, // ~1024 samples at 48kHz in microseconds
    data: samples.buffer,
  });
}

// Test 1: flush() returns a Promise
test('flush() returns a Promise', async () => {
  const encoder = new AudioEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  const result = encoder.flush();
  assert.ok(result instanceof Promise, 'flush() should return a Promise');
  await result;

  encoder.close();
});

// Test 2: flush() emits buffered chunks
test('flush() emits buffered chunks - encode audio data, flush, verify chunks emitted', async () => {
  const chunks = [];
  const encoder = new AudioEncoder({
    output: chunk => {
      chunks.push(chunk);
    },
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  // Create and encode 5 audio frames
  const audioDataList = [];
  for (let i = 0; i < 5; i++) {
    const audioData = createAudioData(i);
    audioDataList.push(audioData);
    encoder.encode(audioData);
  }

  const chunksBeforeFlush = chunks.length;

  // Flush to emit all buffered frames
  await encoder.flush();

  const chunksAfterFlush = chunks.length;

  // Should have emitted chunks after flush
  assert.ok(
    chunksAfterFlush > 0,
    'Should have emitted at least one chunk after flush',
  );
  assert.ok(
    chunksAfterFlush >= chunksBeforeFlush,
    'Chunk count should not decrease after flush',
  );

  // Clean up
  for (const audioData of audioDataList) {
    audioData.close();
  }
  encoder.close();
});

// Test 3: flush() is idempotent
test('flush() is idempotent - calling twice does not error', async () => {
  const encoder = new AudioEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  const audioData = createAudioData(0);
  encoder.encode(audioData);

  // Call flush twice - should not throw
  await encoder.flush();
  await encoder.flush();

  audioData.close();
  encoder.close();
});

// Test 4: state remains configured after flush
test('state remains configured after flush', async () => {
  const encoder = new AudioEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  assert.strictEqual(
    encoder.state,
    'configured',
    'State should be configured before flush',
  );

  const audioData = createAudioData(0);
  encoder.encode(audioData);

  await encoder.flush();

  assert.strictEqual(
    encoder.state,
    'configured',
    'State should remain configured after flush',
  );

  audioData.close();
  encoder.close();
});

async function run() {
  console.log('Contract: AudioEncoder Flush Behavior\n');
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
