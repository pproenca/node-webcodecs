const { VideoEncoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log(`[TEST] Loading Modules...`);
console.log(`VideoEncoder: ${typeof VideoEncoder}`);
console.log(`VideoFrame: ${typeof VideoFrame}`);
console.log(`EncodedVideoChunk: ${typeof EncodedVideoChunk}`);

try {
  const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
  console.log(`[TEST] Encoder State: ${encoder.state}`);
  console.log(`[TEST] Encode Queue: ${encoder.encodeQueueSize}`);
} catch (e) {
  console.error(`[FAIL] Constructor crashed: ${e.message}`);
  process.exit(1);
}
