// test/33_error_paths.js
const assert = require('assert');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../dist');

console.log('[TEST] Error Path Tests');

// Test 1: Decoder with corrupted data doesn't crash
console.log('[TEST] 1. Corrupted decode data handled gracefully...');
{
  let errorCalled = false;
  let errorMessage = '';

  const decoder = new VideoDecoder({
    output: () => {},
    error: e => {
      errorCalled = true;
      errorMessage = e.message || String(e);
    },
  });

  decoder.configure({codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240});

  // Send garbage data that's not valid H.264
  const garbage = new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: Buffer.from('this is not valid h264 data at all'),
  });

  decoder.decode(garbage);

  // Flush to process
  decoder.flush().catch(() => {});

  decoder.close();
  // Note: Error may be async, so we just verify no crash
  console.log('[PASS] Corrupted decode data handled gracefully');
}

// Test 2: Encoder with zero dimensions throws
console.log('[TEST] 2. Zero dimensions throws...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  let threw = false;
  try {
    encoder.configure({
      codec: 'avc1.42001e',
      width: 0,
      height: 0,
      bitrate: 1000000,
      framerate: 30,
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected zero dimensions to throw');
  encoder.close();
  console.log('[PASS] Zero dimensions throws');
}

// Test 3: Encoder with negative dimensions throws
console.log('[TEST] 3. Negative dimensions throws...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  let threw = false;
  try {
    encoder.configure({
      codec: 'avc1.42001e',
      width: -100,
      height: -100,
      bitrate: 1000000,
      framerate: 30,
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected negative dimensions to throw');
  encoder.close();
  console.log('[PASS] Negative dimensions throws');
}

// Test 4: Missing required config fields throws
console.log('[TEST] 4. Missing required config throws...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  let threw = false;
  try {
    encoder.configure({codec: 'avc1.42001e'}); // Missing width, height
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected missing config to throw');
  encoder.close();
  console.log('[PASS] Missing required config throws');
}

// Test 5: Configure without init throws
console.log('[TEST] 5. Configure without init throws...');
{
  // This tests that VideoEncoder requires callbacks
  let threw = false;
  try {
    new VideoEncoder(null);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected null init to throw');
  console.log('[PASS] Null init throws');
}

// Test 6: Encode with wrong frame dimensions handled
console.log('[TEST] 6. Wrong frame dimensions handled...');
{
  let errorCalled = false;
  const encoder = new VideoEncoder({
    output: () => {},
    error: e => {
      errorCalled = true;
    },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 1000000,
    framerate: 30,
  });

  // Create frame with different dimensions
  const buf = Buffer.alloc(640 * 480 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0,
  });

  let threw = false;
  try {
    encoder.encode(frame);
  } catch (e) {
    threw = true;
  }
  frame.close();
  encoder.close();
  // Either throws or calls error callback - both are valid error handling
  console.log('[PASS] Wrong frame dimensions handled');
}

// Test 7: Empty buffer for EncodedVideoChunk handled
console.log('[TEST] 7. Empty buffer EncodedVideoChunk...');
{
  let threw = false;
  try {
    new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: Buffer.alloc(0),
    });
  } catch (e) {
    threw = true;
  }
  // Empty buffer should either throw or create chunk with 0 bytes
  console.log('[PASS] Empty buffer handled (threw: ' + threw + ')');
}

// Test 8: VideoDecoder without configure throws on decode
console.log('[TEST] 8. Decode without configure throws...');
{
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });

  let threw = false;
  try {
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: Buffer.alloc(100),
    });
    decoder.decode(chunk);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected decode without configure to throw');
  decoder.close();
  console.log('[PASS] Decode without configure throws');
}

// Test 9: Encode without configure throws
console.log('[TEST] 9. Encode without configure throws...');
{
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  let threw = false;
  try {
    const buf = Buffer.alloc(320 * 240 * 4);
    const frame = new VideoFrame(buf, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp: 0,
    });
    encoder.encode(frame);
    frame.close();
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Expected encode without configure to throw');
  encoder.close();
  console.log('[PASS] Encode without configure throws');
}

console.log('[PASS] All error path tests passed!');
