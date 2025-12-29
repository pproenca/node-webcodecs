const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 20: EncodedAudioChunk');

// Create a mock encoded audio chunk
const data = Buffer.from([0xFF, 0xF1, 0x50, 0x80, 0x00, 0x1F, 0xFC]);

const chunk = new native.EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    duration: 21333,
    data: data
});

assert.strictEqual(chunk.type, 'key');
assert.strictEqual(chunk.timestamp, 0);
assert.strictEqual(chunk.duration, 21333);
assert.strictEqual(chunk.byteLength, 7);

// Test copyTo
const dest = Buffer.alloc(7);
chunk.copyTo(dest);
assert.deepStrictEqual(dest, data);

console.log('PASS');
