// test/unit/counters.test.ts

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCounters, VideoEncoder, VideoFrame } from '@pproenca/node-webcodecs';

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
    assert.strictEqual(during.videoFrames, before.videoFrames + 1);

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
    assert.strictEqual(during.videoEncoders, before.videoEncoders + 1);

    encoder.close();
  });

  it('should return all counter types', () => {
    const counters = getCounters();

    assert.ok('videoFrames' in counters);
    assert.ok('audioData' in counters);
    assert.ok('videoEncoders' in counters);
    assert.ok('videoDecoders' in counters);
    assert.ok('audioEncoders' in counters);
    assert.ok('audioDecoders' in counters);
    // Legacy
    assert.ok('queue' in counters);
    assert.ok('process' in counters);
    assert.ok('frames' in counters);
  });
});
