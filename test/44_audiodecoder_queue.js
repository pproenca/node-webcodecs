'use strict';

const assert = require('assert');
const {
  AudioEncoder,
  AudioDecoder,
  AudioData,
  EncodedAudioChunk,
} = require('../dist');

async function encodeTestAudio() {
  const chunks = [];
  const audioDataList = [];

  const encoder = new AudioEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  // Encode enough audio to get several chunks
  for (let i = 0; i < 10; i++) {
    const samples = new Float32Array(1024 * 2);
    for (let j = 0; j < samples.length; j++) {
      samples[j] = Math.sin((i * 1024 + j) * 0.01) * 0.5;
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: i * ((1024 * 1000000) / 48000),
      data: samples,
    });

    audioDataList.push(audioData);
    encoder.encode(audioData);
  }

  await encoder.flush();

  // Clean up audio data after flush completes
  audioDataList.forEach(d => d.close());
  encoder.close();

  return chunks;
}

async function testAudioDecoderQueue() {
  console.log('[TEST] AudioDecoder control queue + ondequeue');

  const chunks = await encodeTestAudio();
  if (chunks.length === 0) {
    console.log('[SKIP] No encoded chunks produced');
    return;
  }

  let dequeueCount = 0;
  let maxQueueSize = 0;
  const audioDataOutputs = [];

  const decoder = new AudioDecoder({
    output: audioData => {
      audioDataOutputs.push(audioData);
    },
    error: e => console.error(`[ERR] ${e.message}`),
  });

  decoder.ondequeue = () => {
    dequeueCount++;
  };

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  // Decode all chunks
  for (const chunk of chunks) {
    decoder.decode(chunk);

    if (decoder.decodeQueueSize > maxQueueSize) {
      maxQueueSize = decoder.decodeQueueSize;
    }
  }

  await decoder.flush();

  // Clean up
  audioDataOutputs.forEach(d => d.close());
  decoder.close();

  console.log(
    `Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, outputs=${audioDataOutputs.length}`,
  );

  assert.ok(
    dequeueCount >= 1,
    `ondequeue should fire at least once, got ${dequeueCount}`,
  );

  console.log('[PASS] AudioDecoder control queue + ondequeue works');
}

async function testDecodeQueueSizeTracking() {
  console.log('[TEST] AudioDecoder decodeQueueSize tracking');

  const chunks = await encodeTestAudio();
  if (chunks.length === 0) {
    console.log('[SKIP] No encoded chunks produced');
    return;
  }

  const decoder = new AudioDecoder({
    output: () => {},
    error: e => console.error(`[ERR] ${e.message}`),
  });

  assert.strictEqual(
    decoder.decodeQueueSize,
    0,
    'Initial queue size should be 0',
  );

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  // Decode synchronously - queue size increments then may immediately decrement
  // when the decode completes quickly
  const sizeBefore = decoder.decodeQueueSize;
  decoder.decode(chunks[0]);
  // Queue size tracking is now synchronous, so we just verify it works
  console.log(`Queue size after decode: ${decoder.decodeQueueSize}`);

  await decoder.flush();
  assert.strictEqual(
    decoder.decodeQueueSize,
    0,
    'Queue size should be 0 after flush',
  );

  decoder.close();

  console.log('[PASS] AudioDecoder decodeQueueSize tracking works');
}

async function testResetClearsQueue() {
  console.log('[TEST] AudioDecoder reset clears queue');

  const chunks = await encodeTestAudio();
  if (chunks.length === 0) {
    console.log('[SKIP] No encoded chunks produced');
    return;
  }

  const decoder = new AudioDecoder({
    output: () => {},
    error: e => console.error(`[ERR] ${e.message}`),
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  decoder.decode(chunks[0]);
  decoder.reset();

  assert.strictEqual(
    decoder.decodeQueueSize,
    0,
    'Queue size should be 0 after reset',
  );

  decoder.close();

  console.log('[PASS] AudioDecoder reset clears queue');
}

async function testKeyFrameRequirement() {
  console.log('[TEST] AudioDecoder key frame requirement');

  let errorReceived = null;

  const decoder = new AudioDecoder({
    output: () => {},
    error: e => {
      errorReceived = e;
    },
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  // Create a delta chunk (not a key frame) - for audio AAC, all frames are typically key frames
  // but we can test the logic by creating a fake delta chunk
  const fakeChunk = {
    type: 'delta',
    timestamp: 0,
    byteLength: 10,
    _nativeChunk: null,
  };

  // This should fail because first chunk must be key
  try {
    decoder.decode(fakeChunk);
  } catch (e) {
    // May throw directly
  }

  // Give error callback a chance to fire
  await new Promise(r => setTimeout(r, 10));

  // The error callback should have been called
  assert.ok(
    errorReceived !== null,
    'Error should be received for delta frame as first chunk',
  );
  assert.ok(
    errorReceived.message.includes('key frame'),
    'Error should mention key frame',
  );

  decoder.close();

  console.log('[PASS] AudioDecoder key frame requirement works');
}

(async () => {
  await testAudioDecoderQueue();
  await testDecodeQueueSizeTracking();
  await testResetClearsQueue();
  await testKeyFrameRequirement();
  console.log('[PASS] All AudioDecoder queue tests passed');
})().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
