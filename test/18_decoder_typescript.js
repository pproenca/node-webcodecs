const {
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../dist');
const assert = require('assert');

console.log('Test 18: VideoDecoder TypeScript wrapper');

async function runTests() {
  // Test 1: Basic instantiation and state
  console.log('Test 1: Basic instantiation and initial state');
  const decodedFrames = [];

  const decoder = new VideoDecoder({
    output: frame => {
      console.log(
        `Decoded frame: ${frame.codedWidth}x${frame.codedHeight} @ ${frame.timestamp}`,
      );
      decodedFrames.push({
        width: frame.codedWidth,
        height: frame.codedHeight,
        timestamp: frame.timestamp,
        format: frame.format,
      });
      frame.close();
    },
    error: e => {
      console.error('Decoder error:', e);
    },
  });

  assert.strictEqual(
    decoder.state,
    'unconfigured',
    'Initial state should be unconfigured',
  );
  assert.strictEqual(
    decoder.decodeQueueSize,
    0,
    'Initial decodeQueueSize should be 0',
  );
  console.log('  PASS: Initial state is unconfigured');

  // Test 2: Configuration
  console.log('Test 2: Configuration');
  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  assert.strictEqual(
    decoder.state,
    'configured',
    'State should be configured after configure()',
  );
  console.log('  PASS: State changes to configured');

  // Test 3: isConfigSupported static method
  console.log('Test 3: isConfigSupported static method');
  const supportResult = await VideoDecoder.isConfigSupported({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240,
  });

  assert.ok(
    typeof supportResult === 'object',
    'isConfigSupported should return an object',
  );
  assert.ok(
    typeof supportResult.supported === 'boolean',
    'Result should have supported property',
  );
  assert.strictEqual(
    supportResult.supported,
    true,
    'H.264 should be supported',
  );
  console.log('  PASS: isConfigSupported returns correct result');

  // Test unsupported codec
  const unsupportedResult = await VideoDecoder.isConfigSupported({
    codec: 'invalid-codec-xyz',
    codedWidth: 320,
    codedHeight: 240,
  });
  assert.strictEqual(
    unsupportedResult.supported,
    false,
    'Invalid codec should not be supported',
  );
  console.log('  PASS: isConfigSupported returns false for invalid codec');

  // Test 4: Encode and decode workflow
  console.log('Test 4: Encode frames then decode them');

  // First, encode some frames
  const encodedChunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
      console.log(
        `  Encoded chunk: ${chunk.type} | TS: ${chunk.timestamp} | Size: ${chunk.byteLength} bytes`,
      );
    },
    error: e => {
      console.error('Encoder error:', e);
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  });

  const width = 320;
  const height = 240;

  // Create and encode 5 frames
  for (let i = 0; i < 5; i++) {
    const buf = Buffer.alloc(width * height * 4);
    for (let j = 0; j < width * height; j++) {
      buf[j * 4] = (i * 50) % 256; // R
      buf[j * 4 + 1] = (i * 30) % 256; // G
      buf[j * 4 + 2] = (i * 70) % 256; // B
      buf[j * 4 + 3] = 255; // A
    }
    const frame = new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp: i * 33333,
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();
  console.log(`  Encoded ${encodedChunks.length} chunks`);

  assert.ok(encodedChunks.length > 0, 'Should have encoded at least one chunk');

  // Now decode the chunks using our TypeScript wrapper decoder
  // Create a new decoder for decoding
  const decodeDecoder = new VideoDecoder({
    output: frame => {
      console.log(
        `  Decoded frame: ${frame.codedWidth}x${frame.codedHeight} @ ${frame.timestamp}`,
      );
      decodedFrames.push({
        width: frame.codedWidth,
        height: frame.codedHeight,
        timestamp: frame.timestamp,
        format: frame.format,
      });
      frame.close();
    },
    error: e => {
      console.error('Decoder error:', e);
    },
  });

  decodeDecoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height,
  });

  // Decode all chunks (chunks from TS wrapper are EncodedVideoChunk instances)
  for (const chunk of encodedChunks) {
    decodeDecoder.decode(chunk);
  }

  await decodeDecoder.flush();
  console.log(`  Decoded ${decodedFrames.length} frames`);

  assert.ok(decodedFrames.length > 0, 'Should have decoded at least one frame');

  // Verify decoded frame dimensions
  for (const frame of decodedFrames) {
    assert.strictEqual(frame.width, width, 'Decoded frame width should match');
    assert.strictEqual(
      frame.height,
      height,
      'Decoded frame height should match',
    );
    assert.strictEqual(
      frame.format,
      'RGBA',
      'Decoded frame format should be RGBA',
    );
  }
  console.log('  PASS: Decoded frames have correct dimensions');

  // Test 5: Reset
  console.log('Test 5: Reset');
  decodeDecoder.reset();
  assert.strictEqual(
    decodeDecoder.state,
    'unconfigured',
    'State should be unconfigured after reset',
  );
  console.log('  PASS: Reset works correctly');

  // Test 6: Close
  console.log('Test 6: Close');
  decoder.close();
  assert.strictEqual(
    decoder.state,
    'closed',
    'State should be closed after close()',
  );
  decodeDecoder.close();
  assert.strictEqual(
    decodeDecoder.state,
    'closed',
    'State should be closed after close()',
  );
  console.log('  PASS: Close works correctly');

  console.log('\nAll tests PASS');
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
