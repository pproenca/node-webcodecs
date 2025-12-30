'use strict';

const assert = require('assert');
const { VideoFrame } = require('../dist');

console.log('[TEST] VideoFrame rotation, flip, metadata');

// Test rotation and flip
const frameData = Buffer.alloc(640 * 480 * 4);
const frame = new VideoFrame(frameData, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 12345,
    rotation: 90,
    flip: true
});

assert.strictEqual(frame.rotation, 90, 'rotation should be 90');
assert.strictEqual(frame.flip, true, 'flip should be true');

// Test metadata
const metadata = frame.metadata();
assert.ok(typeof metadata === 'object', 'metadata() should return object');
assert.ok(metadata !== null, 'metadata should not be null');

frame.close();

// Test defaults
const frame2 = new VideoFrame(frameData, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});

assert.strictEqual(frame2.rotation, 0, 'default rotation should be 0');
assert.strictEqual(frame2.flip, false, 'default flip should be false');

frame2.close();

// Test closed frame throws on metadata()
let threw = false;
try {
    frame.metadata();
} catch (e) {
    threw = true;
}
assert.ok(threw, 'metadata() should throw on closed frame');

console.log('[PASS] VideoFrame rotation, flip, metadata works');
