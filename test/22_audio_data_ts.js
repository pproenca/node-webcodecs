const { AudioData } = require('../dist/index.js');
const assert = require('assert');

console.log('Test 22: AudioData TypeScript wrapper');

// Create stereo audio at 48kHz
const samples = new Float32Array(2048);
for (let i = 0; i < 1024; i++) {
    samples[i * 2] = Math.sin(2 * Math.PI * 440 * i / 48000);
    samples[i * 2 + 1] = Math.sin(2 * Math.PI * 880 * i / 48000);
}

const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: samples.buffer
});

assert.strictEqual(audioData.format, 'f32');
assert.strictEqual(audioData.sampleRate, 48000);
assert.strictEqual(audioData.numberOfFrames, 1024);
assert.strictEqual(audioData.numberOfChannels, 2);

// Test clone
const cloned = audioData.clone();
assert.strictEqual(cloned.format, 'f32');

// Test copyTo
const dest = new Float32Array(2048);
audioData.copyTo(dest.buffer);
assert.strictEqual(dest[0], samples[0]);

// Test close
audioData.close();
cloned.close();

console.log('PASS: AudioData TypeScript wrapper works');
