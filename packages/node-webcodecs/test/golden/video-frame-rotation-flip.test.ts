import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame rotation and flip', () => {
  it('should store rotation value', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 90,
    });

    assert.strictEqual(frame.rotation, 90);
    frame.close();
  });

  it('should affect displayWidth/Height with 90 degree rotation', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 90,
    });

    // After 90 degree rotation, dimensions are swapped for display
    assert.strictEqual(frame.displayWidth, 50);
    assert.strictEqual(frame.displayHeight, 100);
    frame.close();
  });

  it('should affect displayWidth/Height with 270 degree rotation', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 270,
    });

    // After 270 degree rotation, dimensions are swapped for display
    assert.strictEqual(frame.displayWidth, 50);
    assert.strictEqual(frame.displayHeight, 100);
    frame.close();
  });

  it('should not affect displayWidth/Height with 0 degree rotation', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 0,
    });

    // No rotation, dimensions unchanged
    assert.strictEqual(frame.displayWidth, 100);
    assert.strictEqual(frame.displayHeight, 50);
    frame.close();
  });

  it('should not affect displayWidth/Height with 180 degree rotation', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 180,
    });

    // 180 degree rotation doesn't swap dimensions
    assert.strictEqual(frame.displayWidth, 100);
    assert.strictEqual(frame.displayHeight, 50);
    frame.close();
  });

  it('should store flip value', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      flip: true,
    });

    assert.strictEqual(frame.flip, true);
    frame.close();
  });

  it('should default flip to false when not specified', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
    });

    assert.strictEqual(frame.flip, false);
    frame.close();
  });

  it('should default rotation to 0 when not specified', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
    });

    assert.strictEqual(frame.rotation, 0);
    frame.close();
  });

  it('should apply rotation to explicit displayWidth/Height', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      displayWidth: 200,
      displayHeight: 100,
      timestamp: 0,
      format: 'RGBA',
      rotation: 90,
    });

    // With 90 degree rotation, explicit display dimensions are swapped
    assert.strictEqual(frame.displayWidth, 100);
    assert.strictEqual(frame.displayHeight, 200);
    frame.close();
  });
});
