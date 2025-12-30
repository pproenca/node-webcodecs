const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 19: AudioData basic structure');

// Create stereo audio data at 48kHz, 1024 frames
const sampleRate = 48000;
const numberOfChannels = 2;
const numberOfFrames = 1024;
const format = 'f32'; // 32-bit float interleaved

// Create interleaved float32 samples
const samples = new Float32Array(numberOfFrames * numberOfChannels);
for (let i = 0; i < numberOfFrames; i++) {
  // Left channel: 440Hz sine wave
  samples[i * 2] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  // Right channel: 880Hz sine wave
  samples[i * 2 + 1] = Math.sin((2 * Math.PI * 880 * i) / sampleRate);
}

const audioData = new native.AudioData({
  format: format,
  sampleRate: sampleRate,
  numberOfFrames: numberOfFrames,
  numberOfChannels: numberOfChannels,
  timestamp: 0,
  data: samples.buffer,
});

// Verify properties
assert.strictEqual(audioData.format, 'f32', 'format should be f32');
assert.strictEqual(audioData.sampleRate, 48000, 'sampleRate should be 48000');
assert.strictEqual(
  audioData.numberOfFrames,
  1024,
  'numberOfFrames should be 1024',
);
assert.strictEqual(
  audioData.numberOfChannels,
  2,
  'numberOfChannels should be 2',
);
assert.strictEqual(audioData.timestamp, 0, 'timestamp should be 0');

// Duration = numberOfFrames / sampleRate * 1_000_000 (microseconds)
const expectedDuration = Math.floor((numberOfFrames / sampleRate) * 1000000);
assert.strictEqual(
  audioData.duration,
  expectedDuration,
  `duration should be ${expectedDuration}`,
);

// Test close
audioData.close();

// Operations on closed AudioData should throw
try {
  audioData.clone();
  assert.fail('Should throw on closed AudioData');
} catch (e) {
  assert.ok(
    e.message.includes('closed') || e.message.includes('InvalidStateError'),
  );
}

console.log('PASS');
