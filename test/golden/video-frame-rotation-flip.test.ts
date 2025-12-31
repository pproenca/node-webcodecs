import { describe, expect, it } from 'vitest';

describe('VideoFrame rotation and flip', () => {
  it('should store rotation value', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
      rotation: 90,
    });

    expect(frame.rotation).toBe(90);
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
    expect(frame.displayWidth).toBe(50);
    expect(frame.displayHeight).toBe(100);
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
    expect(frame.displayWidth).toBe(50);
    expect(frame.displayHeight).toBe(100);
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
    expect(frame.displayWidth).toBe(100);
    expect(frame.displayHeight).toBe(50);
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
    expect(frame.displayWidth).toBe(100);
    expect(frame.displayHeight).toBe(50);
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

    expect(frame.flip).toBe(true);
    frame.close();
  });

  it('should default flip to false when not specified', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
    });

    expect(frame.flip).toBe(false);
    frame.close();
  });

  it('should default rotation to 0 when not specified', () => {
    const frame = new VideoFrame(new Uint8Array(100 * 50 * 4), {
      codedWidth: 100,
      codedHeight: 50,
      timestamp: 0,
      format: 'RGBA',
    });

    expect(frame.rotation).toBe(0);
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
    expect(frame.displayWidth).toBe(100);
    expect(frame.displayHeight).toBe(200);
    frame.close();
  });
});
