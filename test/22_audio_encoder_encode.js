const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 22: AudioEncoder encode()');

const chunks = [];

const encoder = new native.AudioEncoder({
  output: (chunk, metadata) => {
    chunks.push(chunk);
    console.log(
      `Chunk: type=${chunk.type}, size=${chunk.byteLength}, ts=${chunk.timestamp}`,
    );
  },
  error: e => {
    console.error('Encoder error:', e);
    process.exit(1);
  },
});

encoder.configure({
  codec: 'mp4a.40.2',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000,
});

// Create 10 audio frames (each with 1024 samples at 48kHz)
const sampleRate = 48000;
const numberOfChannels = 2;
const frameSize = 1024;

for (let i = 0; i < 10; i++) {
  const samples = new Float32Array(frameSize * numberOfChannels);

  // Generate 440Hz sine wave
  for (let j = 0; j < frameSize; j++) {
    const t = (i * frameSize + j) / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    samples[j * 2] = sample; // Left
    samples[j * 2 + 1] = sample; // Right
  }

  const audioData = new native.AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: frameSize,
    numberOfChannels: numberOfChannels,
    timestamp: i * Math.floor((frameSize / sampleRate) * 1000000),
    data: samples.buffer,
  });

  encoder.encode(audioData);
  audioData.close();
}

encoder.flush();
encoder.close();

console.log(`Encoded ${chunks.length} chunks`);
assert.ok(chunks.length > 0, 'Should have encoded chunks');

console.log('PASS');
