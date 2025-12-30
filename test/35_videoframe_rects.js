// Test for VideoFrame.codedRect and visibleRect properties (W3C WebCodecs spec)
const assert = require('assert');
const {VideoFrame} = require('../dist');

console.log('Testing VideoFrame codedRect/visibleRect properties...');

// Test 1: codedRect basic structure
{
  const buf = Buffer.alloc(640 * 480 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0,
  });

  const rect = frame.codedRect;

  // DOMRectReadOnly properties
  assert.strictEqual(rect.x, 0, 'codedRect.x should be 0');
  assert.strictEqual(rect.y, 0, 'codedRect.y should be 0');
  assert.strictEqual(rect.width, 640, 'codedRect.width should be 640');
  assert.strictEqual(rect.height, 480, 'codedRect.height should be 480');
  assert.strictEqual(rect.top, 0, 'codedRect.top should be 0');
  assert.strictEqual(rect.left, 0, 'codedRect.left should be 0');
  assert.strictEqual(rect.right, 640, 'codedRect.right should equal width');
  assert.strictEqual(rect.bottom, 480, 'codedRect.bottom should equal height');

  frame.close();
  console.log('  ✓ codedRect has correct structure');
}

// Test 2: visibleRect defaults to codedRect
{
  const buf = Buffer.alloc(1920 * 1080 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 1920,
    codedHeight: 1080,
    timestamp: 0,
  });

  const visibleRect = frame.visibleRect;

  // By default, visibleRect should equal codedRect (no cropping)
  assert.strictEqual(visibleRect.x, 0, 'visibleRect.x should be 0');
  assert.strictEqual(visibleRect.y, 0, 'visibleRect.y should be 0');
  assert.strictEqual(
    visibleRect.width,
    1920,
    'visibleRect.width should be 1920',
  );
  assert.strictEqual(
    visibleRect.height,
    1080,
    'visibleRect.height should be 1080',
  );
  assert.strictEqual(
    visibleRect.right,
    1920,
    'visibleRect.right should be 1920',
  );
  assert.strictEqual(
    visibleRect.bottom,
    1080,
    'visibleRect.bottom should be 1080',
  );

  frame.close();
  console.log('  ✓ visibleRect defaults to codedRect');
}

// Test 3: Different dimensions produce correct rects
{
  const buf = Buffer.alloc(100 * 200 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 100,
    codedHeight: 200,
    timestamp: 0,
  });

  const codedRect = frame.codedRect;
  assert.strictEqual(codedRect.width, 100);
  assert.strictEqual(codedRect.height, 200);
  assert.strictEqual(codedRect.right, 100);
  assert.strictEqual(codedRect.bottom, 200);

  frame.close();
  console.log('  ✓ Rects work with different dimensions');
}

// Test 4: Rects are readonly (new objects each time)
{
  const buf = Buffer.alloc(10 * 10 * 4);
  const frame = new VideoFrame(buf, {
    codedWidth: 10,
    codedHeight: 10,
    timestamp: 0,
  });

  const rect1 = frame.codedRect;
  const rect2 = frame.codedRect;

  // They should have the same values
  assert.strictEqual(rect1.width, rect2.width);
  assert.strictEqual(rect1.height, rect2.height);

  frame.close();
  console.log('  ✓ Rects have consistent values');
}

console.log('\n✓ All VideoFrame codedRect/visibleRect tests passed!\n');
