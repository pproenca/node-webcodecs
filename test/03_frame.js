const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 3: VideoFrame Allocation');

const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4); // RGBA

const frame = new native.VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    format: 'RGBA',
    timestamp: 0
});

assert.strictEqual(frame.codedWidth, 100);
assert.strictEqual(frame.codedHeight, 100);
assert.strictEqual(frame.timestamp, 0);

frame.close();
console.log('✅ PASS');
