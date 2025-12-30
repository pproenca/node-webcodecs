const assert = require('assert');
const { VideoFrame } = require('../dist/index.js');

console.log('Testing additional pixel formats...');

// Test I420A (YUV 4:2:0 with alpha)
const i420aSize = 640 * 480 * 1.5 + 640 * 480; // Y + U/4 + V/4 + A
const i420aData = Buffer.alloc(Math.ceil(i420aSize));
const frameI420A = new VideoFrame(i420aData, {
    format: 'I420A',
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});
assert.strictEqual(frameI420A.format, 'I420A');
frameI420A.close();

// Test I422 (YUV 4:2:2)
const i422Size = 640 * 480 * 2;
const i422Data = Buffer.alloc(i422Size);
const frameI422 = new VideoFrame(i422Data, {
    format: 'I422',
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});
assert.strictEqual(frameI422.format, 'I422');
frameI422.close();

// Test I444 (YUV 4:4:4)
const i444Size = 640 * 480 * 3;
const i444Data = Buffer.alloc(i444Size);
const frameI444 = new VideoFrame(i444Data, {
    format: 'I444',
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});
assert.strictEqual(frameI444.format, 'I444');
frameI444.close();

// Test RGBX (RGB with padding byte)
const rgbxSize = 640 * 480 * 4;
const rgbxData = Buffer.alloc(rgbxSize);
const frameRGBX = new VideoFrame(rgbxData, {
    format: 'RGBX',
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});
assert.strictEqual(frameRGBX.format, 'RGBX');
frameRGBX.close();

// Test BGRX (BGR with padding byte)
const bgrxSize = 640 * 480 * 4;
const bgrxData = Buffer.alloc(bgrxSize);
const frameBGRX = new VideoFrame(bgrxData, {
    format: 'BGRX',
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});
assert.strictEqual(frameBGRX.format, 'BGRX');
frameBGRX.close();

console.log('All pixel format tests passed!');
