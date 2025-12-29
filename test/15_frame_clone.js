const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 15: VideoFrame.clone()');

const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4);

// Fill with recognizable pattern
for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;     // R
    buffer[i + 1] = 128; // G
    buffer[i + 2] = 64;  // B
    buffer[i + 3] = 255; // A
}

const frame = new native.VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 12345,
    format: 'RGBA'
});

// Clone the frame
const cloned = frame.clone();

// Verify clone has same properties
assert.strictEqual(cloned.codedWidth, frame.codedWidth);
assert.strictEqual(cloned.codedHeight, frame.codedHeight);
assert.strictEqual(cloned.timestamp, frame.timestamp);
assert.strictEqual(cloned.format, frame.format);

// Close original - clone should still work
frame.close();

// Clone should still be accessible
assert.strictEqual(cloned.codedWidth, width);
assert.strictEqual(cloned.codedHeight, height);

// Clone should be independent
cloned.close();

console.log('PASS');
