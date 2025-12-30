const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 21: AudioEncoder basic structure');

let chunkReceived = false;
let errorReceived = false;

const encoder = new native.AudioEncoder({
  output: (chunk, metadata) => {
    chunkReceived = true;
    console.log(`Chunk: type=${chunk.type}, size=${chunk.byteLength}`);
  },
  error: e => {
    errorReceived = true;
    console.error('Error:', e);
  },
});

assert.strictEqual(
  encoder.state,
  'unconfigured',
  'Initial state should be unconfigured',
);

// Configure for AAC-LC
encoder.configure({
  codec: 'mp4a.40.2',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000,
});

assert.strictEqual(encoder.state, 'configured', 'State should be configured');

encoder.close();
assert.strictEqual(encoder.state, 'closed', 'State should be closed');

console.log('PASS');
