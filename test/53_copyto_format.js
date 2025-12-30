const assert = require('assert');
const {VideoFrame} = require('../dist/index.js');

console.log('Testing VideoFrame.copyTo format conversion...');

// Create RGBA frame
const width = 64;
const height = 64;
const rgbaData = Buffer.alloc(width * height * 4);
// Fill with red pixels (R=255, G=0, B=0, A=255)
for (let i = 0; i < width * height; i++) {
  rgbaData[i * 4] = 255; // R
  rgbaData[i * 4 + 1] = 0; // G
  rgbaData[i * 4 + 2] = 0; // B
  rgbaData[i * 4 + 3] = 255; // A
}

const frame = new VideoFrame(rgbaData, {
  format: 'RGBA',
  codedWidth: width,
  codedHeight: height,
  timestamp: 0,
});

// Test copyTo with format conversion to I420
const i420Size = frame.allocationSize({format: 'I420'});
assert.strictEqual(
  i420Size,
  (width * height * 3) / 2,
  'I420 allocation size should be w*h*1.5',
);

const i420Buffer = new Uint8Array(i420Size);
const layout = frame.copyTo(i420Buffer, {format: 'I420'});

// Handle both sync and async return values
Promise.resolve(layout)
  .then(layout => {
    assert.strictEqual(layout.length, 3, 'I420 should have 3 planes');
    assert.strictEqual(layout[0].offset, 0, 'Y plane starts at 0');
    assert.strictEqual(layout[0].stride, width, 'Y plane stride equals width');

    // Verify actual pixel conversion happened
    // Red in YUV (BT.601): Y ~= 82, U ~= 90, V ~= 240
    const yPlane = i420Buffer.subarray(0, width * height);
    const uPlane = i420Buffer.subarray(
      width * height,
      width * height + (width / 2) * (height / 2),
    );
    const vPlane = i420Buffer.subarray(
      width * height + (width / 2) * (height / 2),
    );

    // Check Y plane - red should give Y around 76-82
    const avgY = yPlane.reduce((a, b) => a + b, 0) / yPlane.length;
    console.log('Average Y value:', avgY);
    assert(
      avgY > 50 && avgY < 100,
      `Y plane should have values around 76-82 for red, got ${avgY}`,
    );

    // Check U plane - red should give U around 84-90
    const avgU = uPlane.reduce((a, b) => a + b, 0) / uPlane.length;
    console.log('Average U value:', avgU);
    assert(
      avgU > 70 && avgU < 110,
      `U plane should have values around 84-90 for red, got ${avgU}`,
    );

    // Check V plane - red should give V around 240-255
    const avgV = vPlane.reduce((a, b) => a + b, 0) / vPlane.length;
    console.log('Average V value:', avgV);
    assert(
      avgV > 200,
      `V plane should have values around 240 for red, got ${avgV}`,
    );

    console.log('I420 conversion test passed!');

    // Test RGBA to BGRA conversion
    testRgbaToBgra();
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });

function testRgbaToBgra() {
  const width = 4;
  const height = 4;
  const rgbaData = Buffer.alloc(width * height * 4);

  // Fill with specific color (R=100, G=150, B=200, A=255)
  for (let i = 0; i < width * height; i++) {
    rgbaData[i * 4] = 100; // R
    rgbaData[i * 4 + 1] = 150; // G
    rgbaData[i * 4 + 2] = 200; // B
    rgbaData[i * 4 + 3] = 255; // A
  }

  const frame = new VideoFrame(rgbaData, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
  });

  const bgraSize = frame.allocationSize({format: 'BGRA'});
  const bgraBuffer = new Uint8Array(bgraSize);
  const layout = frame.copyTo(bgraBuffer, {format: 'BGRA'});

  Promise.resolve(layout)
    .then(() => {
      // BGRA should have B, G, R, A order
      assert.strictEqual(bgraBuffer[0], 200, 'First byte should be B=200');
      assert.strictEqual(bgraBuffer[1], 150, 'Second byte should be G=150');
      assert.strictEqual(bgraBuffer[2], 100, 'Third byte should be R=100');
      assert.strictEqual(bgraBuffer[3], 255, 'Fourth byte should be A=255');

      console.log('BGRA conversion test passed!');
      frame.close();
      console.log('All copyTo format conversion tests passed!');
    })
    .catch(err => {
      console.error('BGRA test failed:', err);
      process.exit(1);
    });
}
