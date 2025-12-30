'use strict';

const assert = require('assert');
const {
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../dist');

async function testVideoDecoderQueue() {
  console.log('[TEST] VideoDecoder control queue + ondequeue');

  // First encode to get chunks
  const chunks = [];
  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => console.error(`[ENCODER ERR] ${e.message}`),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100000,
  });

  const frameData = Buffer.alloc(64 * 64 * 4);
  const inputFrames = [];
  for (let i = 0; i < 3; i++) {
    const frame = new VideoFrame(frameData, {
      codedWidth: 64,
      codedHeight: 64,
      timestamp: i * 33333,
    });
    inputFrames.push(frame);
    encoder.encode(frame, {keyFrame: i === 0});
  }
  await encoder.flush();
  inputFrames.forEach(f => f.close());
  encoder.close();

  assert.ok(chunks.length > 0, 'Should have encoded chunks');

  // Now decode
  let dequeueCount = 0;
  let maxQueueSize = 0;
  const frames = [];

  const decoder = new VideoDecoder({
    output: frame => {
      frames.push(frame);
      frame.close();
    },
    error: e => console.error(`[DECODER ERR] ${e.message}`),
  });

  decoder.ondequeue = () => {
    dequeueCount++;
  };

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 64,
    codedHeight: 64,
  });

  for (const chunk of chunks) {
    decoder.decode(chunk);
    if (decoder.decodeQueueSize > maxQueueSize) {
      maxQueueSize = decoder.decodeQueueSize;
    }
  }

  await decoder.flush();
  decoder.close();

  console.log(
    `Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, frames=${frames.length}`,
  );

  assert.ok(dequeueCount >= 1, `ondequeue should fire, got ${dequeueCount}`);

  console.log('[PASS] VideoDecoder control queue + ondequeue works');
}

testVideoDecoderQueue().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
