const {
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  AudioData,
} = require('../../../dist');
const assert = require('node:assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Video Encoder Tests
test('VideoEncoder.encode() on unconfigured throws', () => {
  const encoder = new VideoEncoder({output: () => {}, error: () => {}});
  const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
    codedWidth: 100,
    codedHeight: 100,
    timestamp: 0,
  });
  let threw = false;
  try {
    encoder.encode(frame);
  } catch (_e) {
    threw = true;
  }
  frame.close();
  encoder.close();
  assert.ok(threw, 'should throw on unconfigured encoder');
});

test('VideoEncoder.encode() on closed throws', () => {
  const encoder = new VideoEncoder({output: () => {}, error: () => {}});
  encoder.configure({
    codec: 'avc1.42001e',
    width: 100,
    height: 100,
    bitrate: 1_000_000,
  });
  encoder.close();

  const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
    codedWidth: 100,
    codedHeight: 100,
    timestamp: 0,
  });
  let threw = false;
  try {
    encoder.encode(frame);
  } catch (_e) {
    threw = true;
  }
  frame.close();
  assert.ok(threw, 'should throw on closed encoder');
});

// Video Decoder Tests
test('VideoDecoder.decode() on unconfigured throws', () => {
  const decoder = new VideoDecoder({output: () => {}, error: () => {}});
  const chunk = {
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(100),
  };
  let threw = false;
  try {
    decoder.decode(chunk);
  } catch (_e) {
    threw = true;
  }
  decoder.close();
  assert.ok(threw, 'should throw on unconfigured decoder');
});

test('VideoDecoder.decode() on closed throws', () => {
  const decoder = new VideoDecoder({output: () => {}, error: () => {}});
  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 100,
    codedHeight: 100,
  });
  decoder.close();

  const chunk = {
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(100),
  };
  let threw = false;
  try {
    decoder.decode(chunk);
  } catch (_e) {
    threw = true;
  }
  assert.ok(threw, 'should throw on closed decoder');
});

// Audio Encoder Tests
test('AudioEncoder.encode() on unconfigured throws', () => {
  const encoder = new AudioEncoder({output: () => {}, error: () => {}});
  const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: new Float32Array(1024 * 2),
  });
  let threw = false;
  try {
    encoder.encode(audioData);
  } catch (_e) {
    threw = true;
  }
  audioData.close();
  encoder.close();
  assert.ok(threw, 'should throw on unconfigured encoder');
});

test('AudioEncoder.encode() on closed throws', () => {
  const encoder = new AudioEncoder({output: () => {}, error: () => {}});
  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128_000,
  });
  encoder.close();

  const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: new Float32Array(1024 * 2),
  });
  let threw = false;
  try {
    encoder.encode(audioData);
  } catch (_e) {
    threw = true;
  }
  audioData.close();
  assert.ok(threw, 'should throw on closed encoder');
});

// Audio Decoder Tests
test('AudioDecoder.decode() on unconfigured throws', () => {
  const decoder = new AudioDecoder({output: () => {}, error: () => {}});
  const chunk = {
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(100),
  };
  let threw = false;
  try {
    decoder.decode(chunk);
  } catch (_e) {
    threw = true;
  }
  decoder.close();
  assert.ok(threw, 'should throw on unconfigured decoder');
});

test('AudioDecoder.decode() on closed throws', () => {
  const decoder = new AudioDecoder({output: () => {}, error: () => {}});
  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });
  decoder.close();

  const chunk = {
    type: 'key',
    timestamp: 0,
    data: Buffer.alloc(100),
  };
  let threw = false;
  try {
    decoder.decode(chunk);
  } catch (_e) {
    threw = true;
  }
  assert.ok(threw, 'should throw on closed decoder');
});

// VideoFrame closed state tests
test('accessing closed VideoFrame throws or returns null', async () => {
  const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
    codedWidth: 100,
    codedHeight: 100,
    timestamp: 0,
  });
  frame.close();

  let threwOrNull = false;
  try {
    // Try to clone a closed frame - should throw
    frame.clone();
  } catch (_e) {
    threwOrNull = true;
  }

  // Also test allocationSize on closed frame
  let threwAlloc = false;
  try {
    frame.allocationSize();
  } catch (_e) {
    threwAlloc = true;
  }

  // Also test copyTo on closed frame (async method)
  let threwCopyTo = false;
  try {
    await frame.copyTo(new ArrayBuffer(100 * 100 * 4));
  } catch (_e) {
    threwCopyTo = true;
  }

  assert.ok(
    threwOrNull || threwAlloc || threwCopyTo,
    'should throw or return null on closed frame',
  );
});

// AudioData closed state tests
test('accessing closed AudioData throws or returns null', () => {
  const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: new Float32Array(1024 * 2),
  });
  audioData.close();

  // format should return null on closed AudioData
  const formatIsNull = audioData.format === null;

  // clone should throw on closed AudioData
  let threwClone = false;
  try {
    audioData.clone();
  } catch (_e) {
    threwClone = true;
  }

  // allocationSize should throw on closed AudioData
  let threwAlloc = false;
  try {
    audioData.allocationSize();
  } catch (_e) {
    threwAlloc = true;
  }

  // copyTo should throw on closed AudioData
  let threwCopyTo = false;
  try {
    audioData.copyTo(new ArrayBuffer(1024 * 2 * 4));
  } catch (_e) {
    threwCopyTo = true;
  }

  assert.ok(
    formatIsNull || threwClone || threwAlloc || threwCopyTo,
    'should throw or return null on closed AudioData',
  );
});

async function run() {
  console.log('Contract: Invalid State Error Handling\n');
  let passed = 0,
    failed = 0;
  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
run();
