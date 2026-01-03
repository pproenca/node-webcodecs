import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('VideoEncoder Circuit Breaker', () => {
  let encoder: InstanceType<typeof VideoEncoder>;
  let chunks: unknown[] = [];

  beforeEach(() => {
    chunks = [];
    encoder = new VideoEncoder({
      output: (chunk: unknown) => { chunks.push(chunk); },
      error: (e: Error) => { throw e; },
    });
    encoder.configure({
      codec: 'avc1.42001E',
      width: 64,
      height: 64,
      bitrate: 100000,
    });
  });

  afterEach(() => {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  });

  it('should throw QuotaExceededError when queue exceeds hard limit', () => {
    // Hard limit is 64 frames. Flood the encoder without flushing.
    const buf = Buffer.alloc(64 * 64 * 4); // Small frame to avoid actual OOM

    let thrownError: Error | null = null;

    // Try to enqueue 100 frames (more than the 64 limit)
    for (let i = 0; i < 100; i++) {
      try {
        const frame = new VideoFrame(buf, {
          codedWidth: 64,
          codedHeight: 64,
          timestamp: i * 33000,
        });
        encoder.encode(frame);
        frame.close();
      } catch (e) {
        thrownError = e as Error;
        break;
      }
    }

    assert.notStrictEqual(thrownError, null);
    assert.ok(thrownError?.message.includes('QuotaExceededError'));
    assert.ok(thrownError?.message.includes('backpressure'));
  });

  it('should allow encoding after queue drains', async () => {
    const buf = Buffer.alloc(64 * 64 * 4);

    // Fill queue to near limit
    for (let i = 0; i < 60; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: 64,
        codedHeight: 64,
        timestamp: i * 33000,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Flush to drain queue
    await encoder.flush();

    // Should be able to encode again
    const frame = new VideoFrame(buf, {
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 60 * 33000,
    });

    assert.doesNotThrow(() => encoder.encode(frame));
    frame.close();

    await encoder.flush();
  });
});
