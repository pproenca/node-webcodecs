const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 10: VideoEncoder reset()');

let chunksReceived = 0;

const encoder = new native.VideoEncoder({
  output: chunk => {
    chunksReceived++;
  },
  error: e => console.error(e),
});

// Configure and encode one frame
encoder.configure({
  codec: 'avc1.42001E',
  width: 320,
  height: 240,
  bitrate: 500000,
  framerate: 30,
});

assert.strictEqual(encoder.state, 'configured', 'Should be configured');

const buf = Buffer.alloc(320 * 240 * 4);
const frame = new native.VideoFrame(buf, {
  codedWidth: 320,
  codedHeight: 240,
  timestamp: 0,
});
encoder.encode(frame);
frame.close();

// Reset should return to unconfigured
encoder.reset();
assert.strictEqual(
  encoder.state,
  'unconfigured',
  'Should be unconfigured after reset',
);

// Should be able to reconfigure
encoder.configure({
  codec: 'avc1.42001E',
  width: 640,
  height: 480,
  bitrate: 1000000,
  framerate: 30,
});
assert.strictEqual(encoder.state, 'configured', 'Should be reconfigured');

encoder.close();

// Test reset on closed encoder should throw
const closedEncoder = new native.VideoEncoder({
  output: () => {},
  error: () => {},
});
closedEncoder.configure({
  codec: 'avc1.42001E',
  width: 320,
  height: 240,
  bitrate: 500000,
  framerate: 30,
});
closedEncoder.close();

try {
  closedEncoder.reset();
  assert.fail('Should have thrown InvalidStateError');
} catch (e) {
  assert.ok(
    e.message.includes('InvalidStateError'),
    'Should throw InvalidStateError for closed encoder',
  );
}

console.log('PASS');
