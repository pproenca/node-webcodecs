/**
 * Contract Test: AudioDecoder Flush Behavior
 *
 * Validates the CRITICAL FFmpeg flush behavior contract:
 * - flush() returns a Promise
 * - flush() causes all buffered frames to be emitted via output callback
 * - flush() can be called multiple times (idempotent)
 * - After flush(), codec remains in configured state
 */

const {AudioEncoder, AudioDecoder, AudioData} = require('@pproenca/node-webcodecs');
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

// Helper to encode audio frames for decoder tests
async function encodeAudioFrames(count) {
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

  const audioDataList = [];
  for (let i = 0; i < count; i++) {
    const audioData = createAudioData(i);
    audioDataList.push(audioData);
    encoder.encode(audioData);
  }

  await encoder.flush();

  // Clean up audio data
  for (const audioData of audioDataList) {
    audioData.close();
  }
  encoder.close();

  return chunks;
}

// Test 1: flush() returns a Promise
test('flush() returns a Promise', async () => {
  const decoder = new AudioDecoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  const result = decoder.flush();
  assert.ok(result instanceof Promise, 'flush() should return a Promise');
  await result;

  decoder.close();
});

// Test 2: flush() emits buffered audio data
test('flush() emits buffered audio data - encode audio, decode, flush, verify output', async () => {
  // First encode some audio frames
  const encodedChunks = await encodeAudioFrames(5);
  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks to decode');

  const decodedAudio = [];
  const decoder = new AudioDecoder({
    output: audioData => {
      decodedAudio.push({
        sampleRate: audioData.sampleRate,
        numberOfChannels: audioData.numberOfChannels,
        numberOfFrames: audioData.numberOfFrames,
        timestamp: audioData.timestamp,
      });
      audioData.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  // Decode all chunks
  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  const audioBeforeFlush = decodedAudio.length;

  // Flush to emit all buffered audio
  await decoder.flush();

  const audioAfterFlush = decodedAudio.length;

  // Should have emitted audio data after flush
  assert.ok(
    audioAfterFlush > 0,
    'Should have emitted at least one audio data after flush',
  );
  assert.ok(
    audioAfterFlush >= audioBeforeFlush,
    'Audio data count should not decrease after flush',
  );

  decoder.close();
});

// Test 3: flush() is idempotent
test('flush() is idempotent - calling twice does not error', async () => {
  const encodedChunks = await encodeAudioFrames(3);

  const decoder = new AudioDecoder({
    output: audioData => {
      audioData.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
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
  const encodedChunks = await encodeAudioFrames(3);

  const decoder = new AudioDecoder({
    output: audioData => {
      audioData.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
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
  console.log('Contract: AudioDecoder Flush Behavior\n');
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
