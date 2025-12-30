const {EncodedAudioChunk} = require('../dist/index.js');
const assert = require('assert');

console.log('Test 23: EncodedAudioChunk TypeScript wrapper');

// Simulated AAC frame data
const aacData = Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x1c, 0x3f, 0xfc]);

const chunk = new EncodedAudioChunk({
  type: 'key',
  timestamp: 0,
  duration: 21333, // ~1024 samples at 48kHz in microseconds
  data: aacData,
});

assert.strictEqual(chunk.type, 'key');
assert.strictEqual(chunk.timestamp, 0);
assert.strictEqual(chunk.duration, 21333);
assert.strictEqual(chunk.byteLength, 7);

// Test copyTo
const dest = new Uint8Array(7);
chunk.copyTo(dest);
assert.strictEqual(dest[0], 0xff);
assert.strictEqual(dest[1], 0xf1);

console.log('PASS: EncodedAudioChunk TypeScript wrapper works');
