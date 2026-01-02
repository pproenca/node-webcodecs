import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame.metadata()', () => {
  it('should return VideoFrameMetadata object', () => {
    const data = new Uint8Array(4 * 4 * 4); // 4x4 RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    const metadata = frame.metadata();

    assert.notStrictEqual(metadata, undefined);
    assert.strictEqual(typeof metadata, 'object');

    frame.close();
  });

  it('should include captureTime when provided in init', () => {
    const captureTime = 12345.67;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime,
      },
    });

    const metadata = frame.metadata();

    assert.strictEqual(metadata.captureTime, captureTime);

    frame.close();
  });

  it('should include receiveTime when provided in init', () => {
    const receiveTime = 98765.43;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        receiveTime,
      },
    });

    const metadata = frame.metadata();

    assert.strictEqual(metadata.receiveTime, receiveTime);

    frame.close();
  });

  it('should include rtpTimestamp when provided in init', () => {
    const rtpTimestamp = 3000000;
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        rtpTimestamp,
      },
    });

    const metadata = frame.metadata();

    assert.strictEqual(metadata.rtpTimestamp, rtpTimestamp);

    frame.close();
  });

  it('should preserve metadata through clone()', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime: 111.11,
        receiveTime: 222.22,
        rtpTimestamp: 333333,
      },
    });

    const cloned = frame.clone();
    const metadata = cloned.metadata();

    assert.strictEqual(metadata.captureTime, 111.11);
    assert.strictEqual(metadata.receiveTime, 222.22);
    assert.strictEqual(metadata.rtpTimestamp, 333333);

    frame.close();
    cloned.close();
  });

  it('should return empty object when no metadata provided', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    const metadata = frame.metadata();

    assert.strictEqual(Object.keys(metadata).length, 0);

    frame.close();
  });

  it('should return a copy preventing external mutation', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      metadata: {
        captureTime: 100,
      },
    });

    const metadata1 = frame.metadata();
    metadata1.captureTime = 999;

    const metadata2 = frame.metadata();
    assert.strictEqual(metadata2.captureTime, 100);

    frame.close();
  });
});
