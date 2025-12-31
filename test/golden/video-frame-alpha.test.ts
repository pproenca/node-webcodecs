import { describe, expect, it } from 'vitest';

describe('VideoFrame alpha option', () => {
  it('should keep alpha by default', () => {
    const rgba = new Uint8Array(64 * 64 * 4);
    const frame = new VideoFrame(rgba, {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
    });
    expect(frame.format).toBe('RGBA');
    frame.close();
  });

  it('should discard alpha when alpha="discard"', () => {
    const rgba = new Uint8Array(64 * 64 * 4);
    const frame = new VideoFrame(rgba, {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'discard',
    });
    // Format should be non-alpha
    expect(['RGBX', 'I420', 'RGB']).toContain(frame.format);
    frame.close();
  });

  it('should be no-op for formats without alpha', () => {
    const i420Size = Math.floor(64 * 64 * 1.5);
    const i420 = new Uint8Array(i420Size);
    const frame = new VideoFrame(i420, {
      format: 'I420',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'discard',
    });
    expect(frame.format).toBe('I420');
    frame.close();
  });

  it('should throw TypeError for invalid alpha value', () => {
    expect(() => new VideoFrame(new Uint8Array(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'invalid' as any,
    })).toThrow(TypeError);
  });
});
