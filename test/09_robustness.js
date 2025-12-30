const {VideoEncoder, VideoFrame} = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Robustness (Mismatch) Test...');

let errorCaught = false;

const encoder = new VideoEncoder({
  output: () => {},
  error: e => {
    console.log(`[PASS] Encoder correctly emitted error: ${e.message}`);
    errorCaught = true;
  },
});

encoder.configure({codec: 'avc1.42001E', width: 100, height: 100});

console.log('Testing Buffer Underrun (Buffer smaller than Config)...');

const smallBuf = Buffer.alloc(10 * 10 * 4);
const frame = new VideoFrame(smallBuf, {
  codedWidth: 100,
  codedHeight: 100,
  timestamp: 0,
});

try {
  encoder.encode(frame);
  if (!errorCaught) {
    console.log('[WARN] Encode accepted mismatched buffer (Check C++ logic!)');
  }
} catch (e) {
  console.log(`[PASS] Sync error caught: ${e.message}`);
}

try {
  frame.close();
} catch (e) {}
