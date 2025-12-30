import {describe, it, expect} from 'vitest';

describe('VideoFrame.allocationSize() with rect option', () => {
  it('should calculate size for sub-region', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Full frame: 100 * 100 * 4 = 40000 bytes
    expect(frame.allocationSize()).toBe(40000);

    // Sub-region: 50 * 50 * 4 = 10000 bytes
    const rectSize = frame.allocationSize({rect: {x: 0, y: 0, width: 50, height: 50}});
    expect(rectSize).toBe(10000);

    frame.close();
  });

  it('should calculate size for non-zero origin rect', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Rect starting at (25, 25) with size 50x50
    const rectSize = frame.allocationSize({rect: {x: 25, y: 25, width: 50, height: 50}});
    expect(rectSize).toBe(10000); // 50 * 50 * 4

    frame.close();
  });

  it('should throw RangeError when rect exceeds bounds', () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    expect(() =>
      frame.allocationSize({rect: {x: 80, y: 80, width: 50, height: 50}})
    ).toThrow(RangeError);

    frame.close();
  });

  it('should work with I420 format and rect', () => {
    // I420: 100x100 = 15000 bytes (Y: 10000 + U: 2500 + V: 2500)
    const data = new Uint8Array(100 * 100 * 1.5);
    const frame = new VideoFrame(data, {
      format: 'I420',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    // Full frame
    expect(frame.allocationSize()).toBe(15000);

    // 50x50 sub-region: Y: 2500 + U: 625 + V: 625 = 3750 bytes
    const rectSize = frame.allocationSize({rect: {x: 0, y: 0, width: 50, height: 50}});
    expect(rectSize).toBe(3750);

    frame.close();
  });
});
