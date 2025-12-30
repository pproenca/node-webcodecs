'use strict';

const assert = require('assert');
const {VideoEncoder, VideoFrame} = require('../dist');

async function testVideoEncoderQueue() {
  console.log('[TEST] VideoEncoder control queue + ondequeue');

  let dequeueCount = 0;
  let maxQueueSize = 0;
  const chunks = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push(chunk);
    },
    error: e => console.error(`[ERR] ${e.message}`),
  });

  encoder.ondequeue = () => {
    dequeueCount++;
  };

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100000,
  });

  const frameData = Buffer.alloc(64 * 64 * 4);
  const frames = [];

  // Encode multiple frames
  for (let i = 0; i < 5; i++) {
    const frame = new VideoFrame(frameData, {
      codedWidth: 64,
      codedHeight: 64,
      timestamp: i * 33333,
    });
    frames.push(frame);
    encoder.encode(frame, {keyFrame: i === 0});

    if (encoder.encodeQueueSize > maxQueueSize) {
      maxQueueSize = encoder.encodeQueueSize;
    }
  }

  await encoder.flush();

  // Clean up frames after encoding is complete
  frames.forEach(f => f.close());
  encoder.close();

  console.log(
    `Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, chunks=${chunks.length}`,
  );

  assert.ok(
    dequeueCount >= 1,
    `ondequeue should fire at least once, got ${dequeueCount}`,
  );
  assert.ok(chunks.length >= 1, `Should produce chunks, got ${chunks.length}`);

  console.log('[PASS] VideoEncoder control queue + ondequeue works');
}

testVideoEncoderQueue().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
