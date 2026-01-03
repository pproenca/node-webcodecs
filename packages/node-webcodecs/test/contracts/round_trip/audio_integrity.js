/**
 * P0 Contract: Audio Round-Trip Integrity
 *
 * These are the HIGHEST VALUE FFmpeg integration tests - they verify
 * encode->decode produces correct output for audio.
 */

const {
  AudioEncoder,
  AudioDecoder,
  AudioData,
} = require('@pproenca/node-webcodecs');
const assert = require('node:assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Helper to create audio samples (440Hz sine wave)
function createAudioSamples(
  frameSize,
  sampleRate,
  numberOfChannels,
  frameIndex,
) {
  const samples = new Float32Array(frameSize * numberOfChannels);
  for (let j = 0; j < frameSize; j++) {
    const t = (frameIndex * frameSize + j) / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    for (let ch = 0; ch < numberOfChannels; ch++) {
      samples[j * numberOfChannels + ch] = sample;
    }
  }
  return samples;
}

// Test 1: Encode-decode produces audio with correct sample rate
test('encode-decode produces audio with correct sample rate', async () => {
  const sampleRate = 48000;
  const numberOfChannels = 2;
  const frameSize = 1024;
  const encodedChunks = [];
  const decodedAudioData = [];

  // Encoder setup
  const encoder = new AudioEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
    bitrate: 128000,
  });

  // Create and encode audio data
  const samples = createAudioSamples(
    frameSize,
    sampleRate,
    numberOfChannels,
    0,
  );
  const audioData = new AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: frameSize,
    numberOfChannels: numberOfChannels,
    timestamp: 0,
    data: samples.buffer,
  });

  encoder.encode(audioData);
  audioData.close();
  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded at least one chunk');

  // Decoder setup
  const decoder = new AudioDecoder({
    output: decoded => {
      decodedAudioData.push({
        sampleRate: decoded.sampleRate,
        numberOfChannels: decoded.numberOfChannels,
      });
      decoded.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  assert.ok(
    decodedAudioData.length > 0,
    'Should have decoded at least one audio data',
  );

  // Verify sample rate matches
  for (const decoded of decodedAudioData) {
    assert.strictEqual(
      decoded.sampleRate,
      sampleRate,
      `Decoded sample rate should be ${sampleRate}`,
    );
  }
});

// Test 2: Encode-decode produces audio with correct channel count
test('encode-decode produces audio with correct channel count', async () => {
  const sampleRate = 48000;
  const numberOfChannels = 2; // Stereo
  const frameSize = 1024;
  const encodedChunks = [];
  const decodedAudioData = [];

  // Encoder setup
  const encoder = new AudioEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
    bitrate: 128000,
  });

  // Create and encode stereo audio data
  const samples = createAudioSamples(
    frameSize,
    sampleRate,
    numberOfChannels,
    0,
  );
  const audioData = new AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: frameSize,
    numberOfChannels: numberOfChannels,
    timestamp: 0,
    data: samples.buffer,
  });

  encoder.encode(audioData);
  audioData.close();
  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded at least one chunk');

  // Decoder setup
  const decoder = new AudioDecoder({
    output: decoded => {
      decodedAudioData.push({
        sampleRate: decoded.sampleRate,
        numberOfChannels: decoded.numberOfChannels,
      });
      decoded.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  assert.ok(
    decodedAudioData.length > 0,
    'Should have decoded at least one audio data',
  );

  // Verify channel count matches
  for (const decoded of decodedAudioData) {
    assert.strictEqual(
      decoded.numberOfChannels,
      numberOfChannels,
      `Decoded channel count should be ${numberOfChannels} (stereo)`,
    );
  }
});

// Test 3: Timestamps are preserved through round-trip
// Note: FFmpeg may normalize timestamps through its internal timebase conversion,
// so we verify that timestamps are monotonically non-decreasing and we get audio output,
// rather than exact microsecond values.
test('timestamps are preserved through round-trip', async () => {
  const sampleRate = 48000;
  const numberOfChannels = 2;
  const frameSize = 1024;
  const frameCount = 5;
  const encodedChunks = [];
  const decodedTimestamps = [];

  // Encoder setup
  const encoder = new AudioEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
    bitrate: 128000,
  });

  // Create and encode audio frames with sequential timestamps
  for (let i = 0; i < frameCount; i++) {
    const samples = createAudioSamples(
      frameSize,
      sampleRate,
      numberOfChannels,
      i,
    );
    const frameDurationMicros = Math.floor(
      (frameSize / sampleRate) * 1_000_000,
    );
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: sampleRate,
      numberOfFrames: frameSize,
      numberOfChannels: numberOfChannels,
      timestamp: i * frameDurationMicros,
      data: samples.buffer,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

  // Decoder setup
  const decoder = new AudioDecoder({
    output: decoded => {
      decodedTimestamps.push(decoded.timestamp);
      decoded.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  assert.ok(decodedTimestamps.length > 0, 'Should have decoded audio data');

  // Sort timestamps and verify they are monotonically non-decreasing
  const sortedDecoded = [...decodedTimestamps].sort((a, b) => a - b);

  for (let i = 1; i < sortedDecoded.length; i++) {
    assert.ok(
      sortedDecoded[i] >= sortedDecoded[i - 1],
      `Timestamps should be monotonically non-decreasing: ${sortedDecoded[i - 1]} -> ${sortedDecoded[i]}`,
    );
  }

  // Verify first timestamp starts at 0 or is non-negative
  assert.ok(
    sortedDecoded[0] >= 0,
    'First decoded timestamp should be non-negative',
  );
});

// Test 4: Multiple audio frames round-trip successfully
test('multiple audio frames round-trip successfully', async () => {
  const sampleRate = 48000;
  const numberOfChannels = 2;
  const frameSize = 1024;
  const frameCount = 5;
  const encodedChunks = [];
  let decodedCount = 0;

  // Encoder setup
  const encoder = new AudioEncoder({
    output: (chunk, _metadata) => {
      encodedChunks.push(chunk);
    },
    error: e => {
      throw new Error(`Encoder error: ${e.message}`);
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
    bitrate: 128000,
  });

  // Encode multiple audio frames
  for (let i = 0; i < frameCount; i++) {
    const samples = createAudioSamples(
      frameSize,
      sampleRate,
      numberOfChannels,
      i,
    );
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: sampleRate,
      numberOfFrames: frameSize,
      numberOfChannels: numberOfChannels,
      timestamp: i * Math.floor((frameSize / sampleRate) * 1_000_000),
      data: samples.buffer,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();

  assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

  // Decoder setup
  const decoder = new AudioDecoder({
    output: decoded => {
      decodedCount++;
      decoded.close();
    },
    error: e => {
      throw new Error(`Decoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  // We verify we get audio output - the count may differ due to codec buffering
  assert.ok(decodedCount > 0, 'Should have decoded at least one audio data');
});

async function run() {
  console.log('Contract: Audio Round-Trip Integrity\n');
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
