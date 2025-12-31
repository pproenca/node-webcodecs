// test/unit/counters.test.ts

import { getCounters, VideoEncoder, VideoFrame } from '@pproenca/node-webcodecs';
import { describe, expect, it } from 'vitest';

describe('Instance Counters', () => {
  it('should track VideoFrame instances', () => {
    const before = getCounters();

    const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
    });

    const during = getCounters();
    expect(during.videoFrames).toBe(before.videoFrames + 1);

    frame.close();

    // Force GC to trigger destructor
    if (global.gc) global.gc();

    // Note: counter decrements in destructor, not close()
    // We need to wait for GC
  });

  it('should track encoder instances', () => {
    const before = getCounters();

    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    const during = getCounters();
    expect(during.videoEncoders).toBe(before.videoEncoders + 1);

    encoder.close();
  });

  it('should return all counter types', () => {
    const counters = getCounters();

    expect(counters).toHaveProperty('videoFrames');
    expect(counters).toHaveProperty('audioData');
    expect(counters).toHaveProperty('videoEncoders');
    expect(counters).toHaveProperty('videoDecoders');
    expect(counters).toHaveProperty('audioEncoders');
    expect(counters).toHaveProperty('audioDecoders');
    // Legacy
    expect(counters).toHaveProperty('queue');
    expect(counters).toHaveProperty('process');
    expect(counters).toHaveProperty('frames');
  });
});
