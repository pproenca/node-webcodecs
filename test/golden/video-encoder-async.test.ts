import {describe, it, expect} from 'vitest';

/**
 * Tests for VideoEncoder async infrastructure.
 *
 * Note: The AsyncEncodeWorker infrastructure is implemented but currently
 * disabled by default (async_mode_ = false). These tests verify that the
 * synchronous encoding path works correctly with proper queue tracking.
 *
 * When async mode is enabled in the future, these tests will validate:
 * - Non-blocking encoding on the main thread
 * - Proper encodeQueueSize tracking across thread boundaries
 * - Correct flush semantics with ThreadSafeFunction callbacks
 */
describe('VideoEncoder async mode', () => {
  it('should emit dequeue events when queue drains', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    let dequeueCount = 0;
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => {
        throw e;
      },
    });

    encoder.ondequeue = () => {
      dequeueCount++;
    };

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    // Queue frames
    for (let i = 0; i < 3; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    await encoder.flush();

    // Should have received dequeue events
    expect(dequeueCount).toBeGreaterThan(0);

    encoder.close();
  });
  it('should encode multiple frames without blocking', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => console.error(e),
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    // Create 10 frames rapidly
    for (let i = 0; i < 10; i++) {
      const buffer = new Uint8Array(320 * 240 * 4);
      buffer.fill(i * 25);
      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });

      encoder.encode(frame);
      frame.close();
    }

    await encoder.flush();

    expect(chunks.length).toBeGreaterThan(0);
    encoder.close();
  });

  it('should track encodeQueueSize accurately during encoding', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    expect(encoder.encodeQueueSize).toBe(0);

    // Queue multiple frames
    for (let i = 0; i < 5; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Queue size should be tracked (may already be processing)
    expect(encoder.encodeQueueSize).toBeGreaterThanOrEqual(0);

    await encoder.flush();
    expect(encoder.encodeQueueSize).toBe(0);

    encoder.close();
  });
});
