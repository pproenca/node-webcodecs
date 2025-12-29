// test/31_filter_null_checks.js
const { VideoFrame, VideoFilter } = require('../dist');

console.log('[TEST] VideoFilter Null Check Safety');

// Test 1: Calling applyBlur after close should throw, not crash
console.log('[TEST] 1. applyBlur after close throws error...');
const filter = new VideoFilter();
filter.configure({ width: 320, height: 240 });

const buf = Buffer.alloc(320 * 240 * 4, 128);
const frame = new VideoFrame(buf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });

filter.close();

let threw = false;
try {
    filter.applyBlur(frame, []);
} catch (e) {
    threw = true;
    console.log(`  Caught expected error: ${e.message}`);
}

if (!threw) {
    throw new Error('Expected applyBlur after close to throw');
}

frame.close();
console.log('[PASS] Null check prevents crash');
