// Test for ondequeue event handlers (W3C WebCodecs spec)
const assert = require('assert');
const {
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  EncodedVideoChunk,
  AudioData,
  EncodedAudioChunk,
} = require('../dist');

console.log('Testing ondequeue event handlers...');

// Test 1: VideoEncoder already has ondequeue
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  assert.strictEqual(encoder.ondequeue, null, 'ondequeue should start as null');

  let called = false;
  encoder.ondequeue = () => {
    called = true;
  };

  assert.strictEqual(
    typeof encoder.ondequeue,
    'function',
    'ondequeue should be settable',
  );

  encoder.ondequeue = null;
  assert.strictEqual(encoder.ondequeue, null, 'ondequeue should be clearable');

  console.log('  ✓ VideoEncoder.ondequeue works');
}

// Test 2: VideoDecoder ondequeue
{
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });

  assert.strictEqual(decoder.ondequeue, null, 'ondequeue should start as null');

  let called = false;
  decoder.ondequeue = () => {
    called = true;
  };

  assert.strictEqual(
    typeof decoder.ondequeue,
    'function',
    'ondequeue should be settable',
  );

  decoder.ondequeue = null;
  assert.strictEqual(decoder.ondequeue, null, 'ondequeue should be clearable');

  console.log('  ✓ VideoDecoder.ondequeue works');
}

// Test 3: AudioEncoder ondequeue
{
  const encoder = new AudioEncoder({
    output: () => {},
    error: () => {},
  });

  assert.strictEqual(encoder.ondequeue, null, 'ondequeue should start as null');

  let called = false;
  encoder.ondequeue = () => {
    called = true;
  };

  assert.strictEqual(
    typeof encoder.ondequeue,
    'function',
    'ondequeue should be settable',
  );

  encoder.ondequeue = null;
  assert.strictEqual(encoder.ondequeue, null, 'ondequeue should be clearable');

  console.log('  ✓ AudioEncoder.ondequeue works');
}

// Test 4: AudioDecoder ondequeue
{
  const decoder = new AudioDecoder({
    output: () => {},
    error: () => {},
  });

  assert.strictEqual(decoder.ondequeue, null, 'ondequeue should start as null');

  let called = false;
  decoder.ondequeue = () => {
    called = true;
  };

  assert.strictEqual(
    typeof decoder.ondequeue,
    'function',
    'ondequeue should be settable',
  );

  decoder.ondequeue = null;
  assert.strictEqual(decoder.ondequeue, null, 'ondequeue should be clearable');

  console.log('  ✓ AudioDecoder.ondequeue works');
}

console.log('\n✓ All ondequeue handler tests passed!\n');
