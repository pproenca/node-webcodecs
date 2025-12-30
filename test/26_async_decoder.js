const assert = require('assert');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../dist/index.js');

console.log('Test 26: Async VideoDecoder');

async function testAsyncDecode() {
  const chunks = [];
  const frames = [];

  // First encode some frames
  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 1_000_000,
    framerate: 30,
  });

  for (let i = 0; i < 10; i++) {
    const rgba = new Uint8Array(320 * 240 * 4);
    rgba.fill(i * 25);
    const frame = new VideoFrame(Buffer.from(rgba.buffer), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  console.log(`  Encoded ${chunks.length} chunks`);
  assert(chunks.length >= 10, 'Should have at least 10 chunks');

  // Now decode
  const decoder = new VideoDecoder({
    output: frame => {
      frames.push({
        width: frame.codedWidth,
        height: frame.codedHeight,
        timestamp: frame.timestamp,
      });
      frame.close();
    },
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
  });

  for (const chunk of chunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  console.log(`  Decoded ${frames.length} frames`);
  assert(frames.length >= 10, 'Should have decoded at least 10 frames');

  console.log('PASS');
}

testAsyncDecode().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
