const { VideoEncoder, VideoFrame } = require('../dist');
const assert = require('assert');

console.log('Test 1: Smoke Test - Loading Module');
assert.ok(VideoEncoder, 'VideoEncoder should be exported');
assert.ok(VideoFrame, 'VideoFrame should be exported');
console.log('PASS');
