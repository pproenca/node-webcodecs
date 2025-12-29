const { VideoFrame } = require('../dist');
const assert = require('assert');

const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4);
for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;
    buffer[i+1] = 0;
    buffer[i+2] = 0;
    buffer[i+3] = 255;
}

console.log(`[TEST] Creating VideoFrame (${width}x${height})...`);
const frame = new VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 123456,
    format: 'RGBA'
});

console.log(`[TEST] Verifying Properties...`);
assert.strictEqual(frame.codedWidth, 100, 'Width mismatch');
assert.strictEqual(frame.codedHeight, 100, 'Height mismatch');
assert.strictEqual(frame.timestamp, 123456, 'Timestamp mismatch');
assert.strictEqual(frame.format, 'RGBA', 'Format mismatch');

console.log(`[TEST] Closing Frame...`);
frame.close();

try {
    const w = frame.codedWidth;
    console.error(`[FAIL] Should have thrown on closed frame access`);
    process.exit(1);
} catch (e) {
    console.log(`[PASS] Accessing closed frame threw error: "${e.message}"`);
}
