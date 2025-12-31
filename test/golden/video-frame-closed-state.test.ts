import { describe, expect, it } from 'vitest';

describe('VideoFrame closed state per W3C spec', () => {
  it('should return null for format when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();

    // W3C spec: format returns null when [[Detached]] is true
    expect(frame.format).toBeNull();
  });

  it('should return 0 for codedWidth when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.codedWidth).toBe(0);
  });

  it('should return 0 for codedHeight when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.codedHeight).toBe(0);
  });

  it('should return null for codedRect when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.codedRect).toBeNull();
  });

  it('should return null for visibleRect when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.visibleRect).toBeNull();
  });

  it('should return 0 for displayWidth when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.displayWidth).toBe(0);
  });

  it('should return 0 for displayHeight when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.displayHeight).toBe(0);
  });

  it('should return 0 for timestamp when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
    });

    frame.close();
    expect(frame.timestamp).toBe(0);
  });

  it('should return null for duration when closed', () => {
    const data = new Uint8Array(4 * 4 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 4,
      codedHeight: 4,
      timestamp: 1000,
      duration: 5000,
    });

    frame.close();
    expect(frame.duration).toBeNull();
  });
});
