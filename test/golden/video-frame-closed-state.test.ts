// test/golden/video-frame-closed-state.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONSTANTS } from '../fixtures/test-helpers';

describe('VideoFrame closed state per W3C spec', () => {
  let frame: VideoFrame;
  const { width, height } = TEST_CONSTANTS.SMALL_FRAME;

  beforeEach(() => {
    const data = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP);
    frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 1000,
      duration: 5000,
    });
    frame.close();
  });

  afterEach(() => {
    // Frame already closed in beforeEach, but guard against test modifications
    if (frame.format !== null) {
      frame.close();
    }
  });

  // W3C spec: format returns null when [[Detached]] is true
  it('should return null for format when closed', () => {
    expect(frame.format).toBeNull();
  });

  it('should return 0 for codedWidth when closed', () => {
    expect(frame.codedWidth).toBe(0);
  });

  it('should return 0 for codedHeight when closed', () => {
    expect(frame.codedHeight).toBe(0);
  });

  it('should return null for codedRect when closed', () => {
    expect(frame.codedRect).toBeNull();
  });

  it('should return null for visibleRect when closed', () => {
    expect(frame.visibleRect).toBeNull();
  });

  it('should return 0 for displayWidth when closed', () => {
    expect(frame.displayWidth).toBe(0);
  });

  it('should return 0 for displayHeight when closed', () => {
    expect(frame.displayHeight).toBe(0);
  });

  it('should return 0 for timestamp when closed', () => {
    expect(frame.timestamp).toBe(0);
  });

  it('should return null for duration when closed', () => {
    expect(frame.duration).toBeNull();
  });
});
