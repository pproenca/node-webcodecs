import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame constructor from VideoFrame per W3C spec', () => {
  it('should create a clone with same properties when no init provided', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    const cloned = new VideoFrame(original);

    assert.strictEqual(cloned.format, 'RGBA');
    assert.strictEqual(cloned.codedWidth, 4);
    assert.strictEqual(cloned.codedHeight, 4);
    assert.strictEqual(cloned.timestamp, 1000);
    assert.strictEqual(cloned.duration, 5000);

    original.close();
    cloned.close();
  });

  it('should override timestamp when provided in init', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    const cloned = new VideoFrame(original, { timestamp: 2000 });

    assert.strictEqual(cloned.timestamp, 2000);
    assert.strictEqual(cloned.format, 'RGBA'); // Other properties preserved

    original.close();
    cloned.close();
  });

  it('should override duration when provided in init', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    const cloned = new VideoFrame(original, { duration: 10000 });

    assert.strictEqual(cloned.duration, 10000);
    assert.strictEqual(cloned.timestamp, 1000); // Preserved

    original.close();
    cloned.close();
  });

  it('should override visibleRect when provided in init', () => {
    const data = new Uint8Array(8 * 8 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 8,
      codedHeight: 8,
      timestamp: 1000,
    });

    const cloned = new VideoFrame(original, {
      visibleRect: { x: 2, y: 2, width: 4, height: 4 },
    });

    assert.strictEqual(cloned.visibleRect?.x, 2);
    assert.strictEqual(cloned.visibleRect?.y, 2);
    assert.strictEqual(cloned.visibleRect?.width, 4);
    assert.strictEqual(cloned.visibleRect?.height, 4);

    original.close();
    cloned.close();
  });

  it('should throw InvalidStateError when source frame is closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const original = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    original.close();

    assert.throws(() => {
      new VideoFrame(original);
    });
  });
});
