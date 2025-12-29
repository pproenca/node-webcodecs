const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 12: EncodedVideoChunk.copyTo()');

// Create chunk directly
const data = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1e]);
const chunk = new native.EncodedVideoChunk({
    type: 'key',
    timestamp: 1000,
    duration: 33333,
    data: data
});

assert.strictEqual(chunk.type, 'key');
assert.strictEqual(chunk.timestamp, 1000);
assert.strictEqual(chunk.duration, 33333);
assert.strictEqual(chunk.byteLength, 8);

// Test copyTo
const dest = Buffer.alloc(8);
chunk.copyTo(dest);
assert.deepStrictEqual(dest, data, 'copyTo should copy data correctly');

// Test copyTo with smaller buffer throws
try {
    const smallBuf = Buffer.alloc(4);
    chunk.copyTo(smallBuf);
    assert.fail('Should have thrown');
} catch (e) {
    assert.ok(e.message.includes('too small'), 'Should throw on small buffer');
}

console.log('PASS');
