// test/32_edge_cases.js
const assert = require('assert');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  VideoFilter,
} = require('../dist');

console.log('[TEST] Edge Case Tests');

// Test 1: Double close should not crash
console.log('[TEST] 1. Double close encoder...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });
  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 1000000,
    framerate: 30,
  });
  encoder.close();
  encoder.close(); // Should not crash
  console.log('[PASS] Double close encoder');
}

// Test 2: Double close decoder should not crash
console.log('[TEST] 2. Double close decoder...');
{
  const decoder = new VideoDecoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });
  decoder.configure({codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240});
  decoder.close();
  decoder.close(); // Should not crash
  console.log('[PASS] Double close decoder');
}

// Test 3: Encode after close should throw
console.log('[TEST] 3. Encode after close throws...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });
  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 1000000,
    framerate: 30,
  });
  encoder.close();

  const buf = Buffer.alloc(320 * 240 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  let threw = false;
  try {
    encoder.encode(frame);
  } catch (e) {
    threw = true;
  }
  frame.close();
  assert(threw, 'Expected encode after close to throw');
  console.log('[PASS] Encode after close throws');
}

// Test 4: Decode after close should throw
console.log('[TEST] 4. Decode after close throws...');
{
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });
  decoder.configure({codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240});
  decoder.close();

  let threw = false;
  try {
    // Create minimal chunk
    const {EncodedVideoChunk} = require('../dist');
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: Buffer.alloc(100),
    });
    decoder.decode(chunk);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected decode after close to throw');
  console.log('[PASS] Decode after close throws');
}

// Test 5: Rapid encode-close sequence
console.log('[TEST] 5. Rapid encode-close sequence...');
{
  for (let i = 0; i < 5; i++) {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });
    encoder.configure({
      codec: 'avc1.42001e',
      width: 160,
      height: 120,
      bitrate: 500000,
      framerate: 30,
    });

    const buf = Buffer.alloc(160 * 120 * 4, i * 50);
    const frame = new VideoFrame(buf, {
      codedWidth: 160,
      codedHeight: 120,
      timestamp: i * 33333,
    });
    encoder.encode(frame);
    frame.close();
    encoder.close();
  }
  console.log('[PASS] Rapid encode-close sequence');
}

// Test 6: VideoFrame double close
console.log('[TEST] 6. VideoFrame double close...');
{
  const buf = Buffer.alloc(320 * 240 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });
  frame.close();
  frame.close(); // Should not crash
  console.log('[PASS] VideoFrame double close');
}

// Test 7: Operations on closed VideoFrame should throw
console.log('[TEST] 7. Operations on closed VideoFrame throw...');
{
  const buf = Buffer.alloc(320 * 240 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });
  frame.close();

  let threw = false;
  try {
    frame.clone();
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected clone on closed frame to throw');
  console.log('[PASS] Operations on closed VideoFrame throw');
}

// Test 8: VideoFilter configure after close
console.log('[TEST] 8. VideoFilter configure after close throws...');
{
  const filter = new VideoFilter();
  filter.close();

  let threw = false;
  try {
    filter.configure({width: 320, height: 240});
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected configure after close to throw');
  console.log('[PASS] VideoFilter configure after close throws');
}

console.log('[PASS] All edge case tests passed!');
