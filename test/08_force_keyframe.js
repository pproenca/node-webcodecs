const {VideoEncoder, VideoFrame} = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Dynamic Keyframe Test...');

const KEYFRAME_INTERVAL = 10;
let keyframeCount = 0;
let frameCount = 0;

const encoder = new VideoEncoder({
  output: (chunk, meta) => {
    const isKeyFrame = chunk.type === 'key';
    const expectedKeyFrame = frameCount % KEYFRAME_INTERVAL === 0;

    if (expectedKeyFrame && !isKeyFrame) {
      console.error(`[FAIL] Frame ${frameCount} expected KEY, got DELTA`);
      process.exit(1);
    }

    if (isKeyFrame) keyframeCount++;
    frameCount++;
  },
  error: e => console.error(e),
});

encoder.configure({codec: 'avc1.42001E', width: 100, height: 100});

const buf = Buffer.alloc(100 * 100 * 4);

for (let i = 0; i < 50; i++) {
  const forceKey = i % KEYFRAME_INTERVAL === 0;
  const frame = new VideoFrame(buf, {
    codedWidth: 100,
    codedHeight: 100,
    timestamp: i * 33000,
  });

  encoder.encode(frame, {keyFrame: forceKey});
  frame.close();
}

encoder.flush().then(() => {
  console.log(`[INFO] Processed ${frameCount} frames.`);
  console.log(`[INFO] Received ${keyframeCount} Keyframes.`);

  if (keyframeCount < 5) {
    console.error('[FAIL] Did not receive enough keyframes.');
    process.exit(1);
  }
  console.log('[PASS] Keyframe forcing works.');
});
