/**
 * Contract Tests: VideoFrame Data Lifecycle
 *
 * Verifies VideoFrame constructor, properties, close(), clone(),
 * allocationSize(), and copyTo() behaviors per W3C WebCodecs spec.
 */

const {VideoFrame} = require('../../../dist');
const assert = require('assert');

const tests = [];
function test(name, fn) {
  tests.push({name, fn});
}

// Test constants
const WIDTH = 320;
const HEIGHT = 240;
const BYTES_PER_PIXEL = 4; // RGBA
const FRAME_SIZE = WIDTH * HEIGHT * BYTES_PER_PIXEL;

// Helper to create a test frame with optional pattern
function createTestFrame(timestamp = 1000, fillValue = 128) {
  const buffer = Buffer.alloc(FRAME_SIZE, fillValue);
  return new VideoFrame(buffer, {
    codedWidth: WIDTH,
    codedHeight: HEIGHT,
    timestamp: timestamp,
  });
}

// Test 1: constructor creates frame with correct properties
test('constructor creates frame with correct properties', () => {
  const frame = createTestFrame(1000);

  assert.strictEqual(frame.codedWidth, WIDTH, 'codedWidth should match');
  assert.strictEqual(frame.codedHeight, HEIGHT, 'codedHeight should match');
  assert.strictEqual(frame.timestamp, 1000, 'timestamp should match');
  assert.strictEqual(frame.format, 'RGBA', 'format should be RGBA');

  frame.close();
});

// Test 2: close() marks frame as closed
test('close() marks frame as closed', () => {
  const frame = createTestFrame();
  frame.close();

  // Accessing methods on closed frame should throw
  let threwOnAllocationSize = false;
  try {
    frame.allocationSize();
  } catch (e) {
    threwOnAllocationSize = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(
    threwOnAllocationSize,
    'allocationSize() should throw on closed frame',
  );

  let threwOnClone = false;
  try {
    frame.clone();
  } catch (e) {
    threwOnClone = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(threwOnClone, 'clone() should throw on closed frame');
});

// Test 3: clone() creates independent copy
test('clone() creates independent copy', () => {
  const original = createTestFrame(5000);
  const cloned = original.clone();

  // Verify clone has same properties
  assert.strictEqual(
    cloned.codedWidth,
    original.codedWidth,
    'clone codedWidth should match',
  );
  assert.strictEqual(
    cloned.codedHeight,
    original.codedHeight,
    'clone codedHeight should match',
  );
  assert.strictEqual(
    cloned.timestamp,
    original.timestamp,
    'clone timestamp should match',
  );
  assert.strictEqual(
    cloned.format,
    original.format,
    'clone format should match',
  );

  // Close original
  original.close();

  // Clone should still be fully functional
  assert.strictEqual(
    cloned.codedWidth,
    WIDTH,
    'clone should still be accessible after original closed',
  );
  assert.strictEqual(
    cloned.timestamp,
    5000,
    'clone timestamp still accessible',
  );

  // Clone can still provide allocation size
  const size = cloned.allocationSize();
  assert.strictEqual(
    size,
    FRAME_SIZE,
    'clone allocationSize should still work',
  );

  cloned.close();
});

// Test 4: allocationSize() returns correct size
test('allocationSize() returns correct size', () => {
  const frame = createTestFrame();

  const expectedSize = WIDTH * HEIGHT * BYTES_PER_PIXEL; // 320 * 240 * 4 = 307200
  const actualSize = frame.allocationSize();

  assert.strictEqual(
    actualSize,
    expectedSize,
    `allocationSize should be ${expectedSize} for 320x240 RGBA`,
  );

  frame.close();
});

// Test 5: copyTo() copies data correctly
test('copyTo() copies data correctly', async () => {
  // Create frame with recognizable pattern
  const testValue = 0xab;
  const frame = createTestFrame(1000, testValue);

  // Copy to ArrayBuffer
  const destBuffer = new ArrayBuffer(FRAME_SIZE);
  await frame.copyTo(destBuffer);

  const view = new Uint8Array(destBuffer);
  // Verify data was copied correctly
  assert.strictEqual(view[0], testValue, 'First byte should match fill value');
  assert.strictEqual(
    view[100],
    testValue,
    'Middle byte should match fill value',
  );
  assert.strictEqual(
    view[FRAME_SIZE - 1],
    testValue,
    'Last byte should match fill value',
  );

  frame.close();
});

// Test 6: copyTo() with Uint8Array destination
test('copyTo() with Uint8Array destination', async () => {
  const testValue = 0x55;
  const frame = createTestFrame(2000, testValue);

  const dest = new Uint8Array(FRAME_SIZE);
  await frame.copyTo(dest);

  assert.strictEqual(dest[0], testValue, 'Data should be copied to Uint8Array');
  assert.strictEqual(
    dest[FRAME_SIZE / 2],
    testValue,
    'Middle data should match',
  );

  frame.close();
});

// Test 7: copyTo() throws on closed frame
test('copyTo() throws on closed frame', async () => {
  const frame = createTestFrame();
  frame.close();

  const dest = new ArrayBuffer(FRAME_SIZE);
  let threw = false;
  try {
    await frame.copyTo(dest);
  } catch (e) {
    threw = true;
    assert.ok(
      e.message.includes('closed') || e.message.includes('InvalidStateError'),
      `Expected closed/InvalidStateError, got: ${e.message}`,
    );
  }
  assert.ok(threw, 'copyTo() should throw on closed frame');
});

// Test 8: copyTo() throws on too small buffer
test('copyTo() throws on too small buffer', async () => {
  const frame = createTestFrame();

  const smallBuffer = new ArrayBuffer(100); // Too small
  let threw = false;
  try {
    await frame.copyTo(smallBuffer);
  } catch (e) {
    threw = true;
    assert.ok(
      e.message.includes('small') || e.message.includes('TypeError'),
      `Expected small buffer error, got: ${e.message}`,
    );
  }
  assert.ok(threw, 'copyTo() should throw on too small buffer');

  frame.close();
});

// Test 9: close() is idempotent
test('close() is idempotent', () => {
  const frame = createTestFrame();

  // Multiple close calls should not throw
  frame.close();
  frame.close();
  frame.close();

  // Frame should still be closed
  let threw = false;
  try {
    frame.allocationSize();
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'Frame should remain closed after multiple close() calls');
});

// Test runner
async function run() {
  console.log('Contract: VideoFrame Data Lifecycle\n');
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
