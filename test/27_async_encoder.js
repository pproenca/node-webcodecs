const assert = require('assert');
const {VideoEncoder, VideoFrame} = require('../dist/index.js');

console.log('Test 27: Async VideoEncoder');

async function testAsyncEncode() {
  const chunks = [];

  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 1920,
    height: 1080,
    bitrate: 5_000_000,
    framerate: 30,
  });

  // Encode 30 1080p frames
  for (let i = 0; i < 30; i++) {
    const rgba = new Uint8Array(1920 * 1080 * 4);
    rgba.fill(i * 8); // Simple pattern
    const frame = new VideoFrame(Buffer.from(rgba.buffer), {
      format: 'RGBA',
      codedWidth: 1920,
      codedHeight: 1080,
      timestamp: i * 33333,
    });
    encoder.encode(frame, {keyFrame: i % 10 === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  console.log(`  Encoded ${chunks.length} chunks`);
  assert(chunks.length >= 30, 'Should have at least 30 chunks');

  console.log('PASS');
}

testAsyncEncode().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
