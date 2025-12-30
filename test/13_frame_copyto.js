const {VideoFrame, EncodedVideoChunk} = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting copyTo Test...');

// Test 1: EncodedVideoChunk.copyTo
console.log('[TEST] Testing EncodedVideoChunk.copyTo...');
const chunkData = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
const chunk = new EncodedVideoChunk({
  type: 'key',
  timestamp: 0,
  data: chunkData,
});

// Test with Uint8Array
const dest1 = new Uint8Array(10);
chunk.copyTo(dest1);
assert.strictEqual(dest1[0], 1, 'First byte should be 1');
assert.strictEqual(dest1[7], 8, 'Eighth byte should be 8');
console.log('[PASS] EncodedVideoChunk.copyTo with Uint8Array');

// Test with ArrayBuffer
const dest2 = new ArrayBuffer(10);
chunk.copyTo(dest2);
const view2 = new Uint8Array(dest2);
assert.strictEqual(view2[0], 1, 'First byte should be 1');
console.log('[PASS] EncodedVideoChunk.copyTo with ArrayBuffer');

// Test buffer too small error
try {
  const smallDest = new Uint8Array(2);
  chunk.copyTo(smallDest);
  console.error('[FAIL] Should have thrown for small buffer');
  process.exit(1);
} catch (e) {
  assert(
    e.message.includes('too small'),
    'Should throw buffer too small error',
  );
  console.log('[PASS] EncodedVideoChunk.copyTo throws on small buffer');
}

// Test 2: VideoFrame.copyTo
console.log('[TEST] Testing VideoFrame.copyTo...');
const width = 10;
const height = 10;
const frameBuf = Buffer.alloc(width * height * 4, 0xab);
const frame = new VideoFrame(frameBuf, {
  codedWidth: width,
  codedHeight: height,
  timestamp: 0,
});

// Test allocationSize
const expectedSize = width * height * 4;
assert.strictEqual(
  frame.allocationSize(),
  expectedSize,
  'allocationSize should return correct size',
);
console.log('[PASS] VideoFrame.allocationSize()');

// Test async copyTo
frame.copyTo(new Uint8Array(expectedSize)).then(layout => {
  assert(layout[0].stride === width * 4, 'Stride should be width * 4');
  assert(layout[0].offset === 0, 'Offset should be 0');
  console.log('[PASS] VideoFrame.copyTo returns PlaneLayout');

  frame.close();

  // Test copyTo on closed frame throws
  frame.copyTo(new Uint8Array(expectedSize)).catch(e => {
    assert(e.message.includes('closed'), 'Should throw closed error');
    console.log('[PASS] VideoFrame.copyTo throws on closed frame');
    console.log('[PASS] All copyTo tests passed.');
  });
});
