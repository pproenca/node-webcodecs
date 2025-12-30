'use strict';

const assert = require('assert');
const {VideoFrame} = require('../dist');

async function testPixelFormats() {
  console.log('[TEST] Additional VideoPixelFormats');

  // Test I420A (I420 with alpha)
  {
    const width = 100;
    const height = 100;
    // I420A: Y + U + V + A planes
    // Y: width * height
    // U: (width/2) * (height/2)
    // V: (width/2) * (height/2)
    // A: width * height
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2);
    const totalSize = ySize + uvSize + uvSize + ySize;
    const data = Buffer.alloc(totalSize);

    const frame = new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      format: 'I420A',
    });

    assert.strictEqual(frame.format, 'I420A', 'Format should be I420A');
    assert.strictEqual(frame.codedWidth, 100);
    assert.strictEqual(frame.codedHeight, 100);

    const allocSize = frame.allocationSize();
    assert.strictEqual(
      allocSize,
      totalSize,
      `Allocation size should be ${totalSize}`,
    );

    console.log('[PASS] I420A pixel format');
    frame.close();
  }

  // Test I422 (Planar YUV 4:2:2)
  {
    const width = 100;
    const height = 100;
    // I422: Y + U + V planes
    // Y: width * height
    // U: (width/2) * height
    // V: (width/2) * height
    const ySize = width * height;
    const uvSize = (width / 2) * height;
    const totalSize = ySize + uvSize + uvSize;
    const data = Buffer.alloc(totalSize);

    const frame = new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp: 1000,
      format: 'I422',
    });

    assert.strictEqual(frame.format, 'I422', 'Format should be I422');

    const allocSize = frame.allocationSize();
    assert.strictEqual(
      allocSize,
      totalSize,
      `Allocation size should be ${totalSize}`,
    );

    console.log('[PASS] I422 pixel format');
    frame.close();
  }

  // Test I444 (Planar YUV 4:4:4)
  {
    const width = 100;
    const height = 100;
    // I444: Y + U + V planes (all full size)
    const planeSize = width * height;
    const totalSize = planeSize * 3;
    const data = Buffer.alloc(totalSize);

    const frame = new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp: 2000,
      format: 'I444',
    });

    assert.strictEqual(frame.format, 'I444', 'Format should be I444');

    const allocSize = frame.allocationSize();
    assert.strictEqual(
      allocSize,
      totalSize,
      `Allocation size should be ${totalSize}`,
    );

    console.log('[PASS] I444 pixel format');
    frame.close();
  }

  // Test RGBX (RGB with padding byte)
  {
    const width = 100;
    const height = 100;
    const totalSize = width * height * 4; // Same as RGBA
    const data = Buffer.alloc(totalSize);

    const frame = new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp: 3000,
      format: 'RGBX',
    });

    assert.strictEqual(frame.format, 'RGBX', 'Format should be RGBX');

    const allocSize = frame.allocationSize();
    assert.strictEqual(
      allocSize,
      totalSize,
      `Allocation size should be ${totalSize}`,
    );

    console.log('[PASS] RGBX pixel format');
    frame.close();
  }

  // Test BGRX (BGR with padding byte)
  {
    const width = 100;
    const height = 100;
    const totalSize = width * height * 4; // Same as BGRA
    const data = Buffer.alloc(totalSize);

    const frame = new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp: 4000,
      format: 'BGRX',
    });

    assert.strictEqual(frame.format, 'BGRX', 'Format should be BGRX');

    const allocSize = frame.allocationSize();
    assert.strictEqual(
      allocSize,
      totalSize,
      `Allocation size should be ${totalSize}`,
    );

    console.log('[PASS] BGRX pixel format');
    frame.close();
  }

  console.log('[PASS] All additional pixel formats tests passed');
}

testPixelFormats().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
