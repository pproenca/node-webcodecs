/**
 * Integration tests for pixel format support
 * Tests NV21 format and 10-bit alpha formats
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('NV21 pixel format', () => {
  it('should create VideoFrame with NV21 format', () => {
    const width = 320;
    const height = 240;
    // NV21 = Y plane + interleaved VU plane (same layout as NV12, different UV order)
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2) * 2; // Interleaved VU
    const data = new Uint8Array(ySize + uvSize);

    // Y plane - gray (luminance)
    data.fill(128, 0, ySize);
    // VU plane - neutral (chrominance, interleaved)
    data.fill(128, ySize);

    const frame = new VideoFrame(data, {
      format: 'NV21',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    assert.strictEqual(frame.format, 'NV21');
    assert.strictEqual(frame.codedWidth, width);
    assert.strictEqual(frame.codedHeight, height);

    frame.close();
  });

  it('should clone NV21 VideoFrame', () => {
    const width = 160;
    const height = 120;
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2) * 2;
    const data = new Uint8Array(ySize + uvSize);
    data.fill(100);

    const frame = new VideoFrame(data, {
      format: 'NV21',
      codedWidth: width,
      codedHeight: height,
      timestamp: 1000,
    });

    const cloned = frame.clone();

    assert.strictEqual(cloned.format, 'NV21');
    assert.strictEqual(cloned.codedWidth, width);
    assert.strictEqual(cloned.codedHeight, height);
    assert.strictEqual(cloned.timestamp, 1000);

    frame.close();
    cloned.close();
  });
});

describe('10-bit alpha formats', () => {
  it('should create VideoFrame with I420AP10 format', () => {
    const width = 320;
    const height = 240;
    // I420AP10 = Y10 + U10 + V10 + A10 (4 planes, 10-bit)
    // Each sample is 2 bytes (16-bit for 10-bit data)
    const ySize = width * height * 2;
    const uvSize = (width / 2) * (height / 2) * 2; // U and V each
    const aSize = width * height * 2; // Alpha plane
    const data = new Uint8Array(ySize + uvSize * 2 + aSize);

    // Fill with test data (10-bit range 0-1023 stored in 16-bit)
    const view = new Uint16Array(data.buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = 512; // Mid-gray, 10-bit value
    }

    const frame = new VideoFrame(data, {
      format: 'I420AP10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    assert.strictEqual(frame.format, 'I420AP10');
    assert.strictEqual(frame.codedWidth, width);
    assert.strictEqual(frame.codedHeight, height);

    frame.close();
  });

  it('should create VideoFrame with I422AP10 format', () => {
    const width = 320;
    const height = 240;
    // I422AP10 = Y10 + U10 + V10 + A10 (4:2:2 with alpha, 10-bit)
    const ySize = width * height * 2;
    const uvSize = (width / 2) * height * 2; // U and V (4:2:2 horizontal subsampling)
    const aSize = width * height * 2;
    const data = new Uint8Array(ySize + uvSize * 2 + aSize);

    const view = new Uint16Array(data.buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = 512;
    }

    const frame = new VideoFrame(data, {
      format: 'I422AP10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    assert.strictEqual(frame.format, 'I422AP10');
    assert.strictEqual(frame.codedWidth, width);
    assert.strictEqual(frame.codedHeight, height);

    frame.close();
  });

  it('should create VideoFrame with I444AP10 format', () => {
    const width = 320;
    const height = 240;
    // I444AP10 = Y10 + U10 + V10 + A10 (4:4:4 with alpha, 10-bit)
    const ySize = width * height * 2;
    const uvSize = width * height * 2; // U and V (no subsampling)
    const aSize = width * height * 2;
    const data = new Uint8Array(ySize + uvSize * 2 + aSize);

    const view = new Uint16Array(data.buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = 512;
    }

    const frame = new VideoFrame(data, {
      format: 'I444AP10',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    assert.strictEqual(frame.format, 'I444AP10');
    assert.strictEqual(frame.codedWidth, width);
    assert.strictEqual(frame.codedHeight, height);

    frame.close();
  });
});

describe('VideoFrame.metadata() integration', () => {
  it('should preserve metadata through clone', () => {
    const data = new Uint8Array(4 * 4 * 4); // 4x4 RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime: 123.456,
        receiveTime: 789.012,
        rtpTimestamp: 12345678,
      },
    });

    const cloned = frame.clone();
    const metadata = cloned.metadata();

    assert.strictEqual(metadata.captureTime, 123.456);
    assert.strictEqual(metadata.receiveTime, 789.012);
    assert.strictEqual(metadata.rtpTimestamp, 12345678);

    frame.close();
    cloned.close();
  });

  it('should handle VideoFrame with no metadata', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 0,
    });

    const metadata = frame.metadata();

    assert.notStrictEqual(metadata, undefined);
    assert.strictEqual(Object.keys(metadata).length, 0);

    frame.close();
  });
});
