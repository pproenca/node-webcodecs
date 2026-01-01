import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('VideoEncoder Circuit Breaker', () => {
  let encoder: InstanceType<typeof VideoEncoder>;
  const chunks: unknown[] = [];

  beforeEach(() => {
    chunks.length = 0;
    encoder = new VideoEncoder({
      output: (chunk: unknown) => chunks.push(chunk),
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

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain('QuotaExceededError');
    expect(thrownError?.message).toContain('backpressure');
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

    expect(() => encoder.encode(frame)).not.toThrow();
    frame.close();

    await encoder.flush();
  });
});
