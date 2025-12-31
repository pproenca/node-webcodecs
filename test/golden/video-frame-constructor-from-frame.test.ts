import { describe, expect, it } from 'vitest';

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

    expect(cloned.format).toBe('RGBA');
    expect(cloned.codedWidth).toBe(4);
    expect(cloned.codedHeight).toBe(4);
    expect(cloned.timestamp).toBe(1000);
    expect(cloned.duration).toBe(5000);

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

    expect(cloned.timestamp).toBe(2000);
    expect(cloned.format).toBe('RGBA'); // Other properties preserved

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

    expect(cloned.duration).toBe(10000);
    expect(cloned.timestamp).toBe(1000); // Preserved

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

    expect(cloned.visibleRect?.x).toBe(2);
    expect(cloned.visibleRect?.y).toBe(2);
    expect(cloned.visibleRect?.width).toBe(4);
    expect(cloned.visibleRect?.height).toBe(4);

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

    expect(() => new VideoFrame(original)).toThrow();
  });
});
