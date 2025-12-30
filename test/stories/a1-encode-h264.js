/**
 * User Story A1: Encode Video Frames to H.264 File
 *
 * As a Node.js developer building a video processing application,
 * I want to encode raw video frames into H.264 format
 * so that I can create video files server-side without browser dependencies.
 *
 * @see docs/WEBCODECS_USER_STORIES.md - Section A1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Try to load the module - may not exist yet
let VideoEncoder, VideoFrame;
try {
  const webcodecs = require('../../dist');
  VideoEncoder = webcodecs.VideoEncoder;
  VideoFrame = webcodecs.VideoFrame;
} catch (e) {
  console.log('⚠️  Module not built yet. Run `npm run build` first.');
  console.log('   Error:', e.message);
  process.exit(0);
}

const OUTPUT_FILE = path.join(__dirname, '../../test-output-a1.h264');

async function testScenario1_Configure() {
  console.log('\n📋 Scenario 1: Configure encoder');
  console.log('   Given a newly created VideoEncoder instance');
  console.log('   When I call configure() with H.264 config');
  console.log('   Then the encoder state changes to "configured"');

  const encoder = new VideoEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  assert.strictEqual(
    encoder.state,
    'unconfigured',
    'Initial state should be unconfigured',
  );

  encoder.configure({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30,
  });

  assert.strictEqual(
    encoder.state,
    'configured',
    'State should be configured after configure()',
  );

  encoder.close();
  console.log('   ✅ PASS');
}

async function testScenario2_EncodeFrame() {
  console.log('\n📋 Scenario 2: Encode single frame');
  console.log('   Given a configured VideoEncoder');
  console.log('   When I encode a VideoFrame');
  console.log('   Then the output callback receives an EncodedVideoChunk');

  let chunkReceived = false;
  let receivedChunk = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunkReceived = true;
      receivedChunk = chunk;
    },
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30,
  });

  // Create a test frame (solid red)
  const buffer = Buffer.alloc(640 * 480 * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255; // R
    buffer[i + 1] = 0; // G
    buffer[i + 2] = 0; // B
    buffer[i + 3] = 255; // A
  }

  const frame = new VideoFrame(buffer, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0,
    format: 'RGBA',
  });

  encoder.encode(frame);
  frame.close();

  // Flush to get output
  await encoder.flush();

  assert.ok(chunkReceived, 'Output callback should have been called');
  assert.ok(receivedChunk, 'Should have received a chunk');
  assert.strictEqual(
    receivedChunk.type,
    'key',
    'First chunk should be a keyframe',
  );
  assert.ok(receivedChunk.byteLength > 0, 'Chunk should have data');

  encoder.close();
  console.log('   ✅ PASS');
}

async function testScenario3_FlushEncoder() {
  console.log('\n📋 Scenario 3: Flush encoder');
  console.log('   Given a configured VideoEncoder that has encoded 30 frames');
  console.log('   When I call flush()');
  console.log('   Then all remaining encoded chunks are delivered');

  const chunks = [];

  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30,
  });

  // Encode 30 frames
  for (let i = 0; i < 30; i++) {
    const buffer = Buffer.alloc(320 * 240 * 4);
    // Create gradient pattern
    for (let p = 0; p < buffer.length; p += 4) {
      buffer[p] = (i * 8) % 256;
      buffer[p + 1] = 128;
      buffer[p + 2] = 255 - ((i * 8) % 256);
      buffer[p + 3] = 255;
    }

    const frame = new VideoFrame(buffer, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
      format: 'RGBA',
    });

    encoder.encode(frame);
    frame.close();
  }

  const chunksBeforeFlush = chunks.length;
  await encoder.flush();
  const chunksAfterFlush = chunks.length;

  assert.ok(chunksAfterFlush > 0, 'Should have received chunks');
  assert.ok(
    chunksAfterFlush >= chunksBeforeFlush,
    'Flush should deliver remaining chunks',
  );

  encoder.close();
  console.log(`   Received ${chunksAfterFlush} chunks total`);
  console.log('   ✅ PASS');
}

async function testScenario4_CloseEncoder() {
  console.log('\n📋 Scenario 4: Close encoder');
  console.log('   Given a configured VideoEncoder');
  console.log('   When I call close()');
  console.log('   Then the encoder state changes to "closed"');

  const encoder = new VideoEncoder({
    output: () => {},
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30,
  });

  assert.strictEqual(encoder.state, 'configured');

  encoder.close();

  assert.strictEqual(
    encoder.state,
    'closed',
    'State should be closed after close()',
  );
  console.log('   ✅ PASS');
}

async function testScenario5_ChunkProperties() {
  console.log('\n📋 Scenario 5: Verify chunk properties');
  console.log('   Given an EncodedVideoChunk from the output callback');
  console.log('   When I access its properties');
  console.log('   Then they have correct values');

  const chunks = [];

  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30,
  });

  const timestamp = 12345;
  const buffer = Buffer.alloc(320 * 240 * 4, 128);

  const frame = new VideoFrame(buffer, {
    codedWidth: 320,
    codedHeight: 240,
    timestamp: timestamp,
    format: 'RGBA',
  });

  encoder.encode(frame);
  frame.close();
  await encoder.flush();

  assert.ok(chunks.length > 0, 'Should have received chunks');

  const chunk = chunks[0];
  assert.ok(
    ['key', 'delta'].includes(chunk.type),
    `type should be 'key' or 'delta', got '${chunk.type}'`,
  );
  assert.strictEqual(
    typeof chunk.timestamp,
    'number',
    'timestamp should be a number',
  );
  assert.ok(chunk.byteLength > 0, 'byteLength should be > 0');
  // W3C spec: use copyTo() to access data, not .data property
  const dataBuffer = new Uint8Array(chunk.byteLength);
  chunk.copyTo(dataBuffer);
  assert.ok(dataBuffer.length > 0, 'copyTo should return data');

  encoder.close();
  console.log(
    `   Chunk: type=${chunk.type}, ts=${chunk.timestamp}, size=${chunk.byteLength}`,
  );
  console.log('   ✅ PASS');
}

async function testEndToEnd_WriteH264File() {
  console.log('\n📋 End-to-End: Write H.264 file');
  console.log('   Encoding 30 frames to H.264 file...');

  const chunks = [];

  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30,
  });

  // Encode 30 frames (1 second at 30fps)
  for (let i = 0; i < 30; i++) {
    const buffer = Buffer.alloc(640 * 480 * 4);

    // Create animated gradient
    for (let y = 0; y < 480; y++) {
      for (let x = 0; x < 640; x++) {
        const idx = (y * 640 + x) * 4;
        buffer[idx] = Math.floor((x / 640) * 255); // R: horizontal gradient
        buffer[idx + 1] = Math.floor((y / 480) * 255); // G: vertical gradient
        buffer[idx + 2] = Math.floor((i / 30) * 255); // B: time-based
        buffer[idx + 3] = 255; // A
      }
    }

    const frame = new VideoFrame(buffer, {
      codedWidth: 640,
      codedHeight: 480,
      timestamp: i * 33333,
      format: 'RGBA',
    });

    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  // Write to file
  const output = fs.createWriteStream(OUTPUT_FILE);
  let totalBytes = 0;
  for (const chunk of chunks) {
    // W3C spec: use copyTo() to access data
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    output.write(Buffer.from(data));
    totalBytes += chunk.byteLength;
  }
  output.end();

  console.log(
    `   ✅ Wrote ${chunks.length} chunks (${totalBytes} bytes) to ${OUTPUT_FILE}`,
  );
  console.log('   Play with: ffplay ' + OUTPUT_FILE);
}

// Main test runner
async function runAllTests() {
  console.log(
    '═══════════════════════════════════════════════════════════════',
  );
  console.log('User Story A1: Encode Video Frames to H.264 File');
  console.log(
    '═══════════════════════════════════════════════════════════════',
  );

  try {
    await testScenario1_Configure();
    await testScenario2_EncodeFrame();
    await testScenario3_FlushEncoder();
    await testScenario4_CloseEncoder();
    await testScenario5_ChunkProperties();
    await testEndToEnd_WriteH264File();

    console.log(
      '\n═══════════════════════════════════════════════════════════════',
    );
    console.log('✅ All scenarios PASSED');
    console.log(
      '═══════════════════════════════════════════════════════════════',
    );
  } catch (e) {
    console.error('\n❌ Test FAILED:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runAllTests();
