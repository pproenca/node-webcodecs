// test/golden/video-encoder-event-loop.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Event loop blocking verification tests for VideoEncoder.
 *
 * These tests verify that encoding operations do not block the Node.js event loop,
 * which is a key requirement for production use. When async_mode_ is enabled in
 * the native layer, encoding runs on a worker thread via AsyncEncodeWorker.
 *
 * The test creates frames and verifies that setInterval callbacks can fire
 * during the flush() phase, proving the event loop is not blocked.
 */
describe('VideoEncoder event loop', () => {
  it('should not block event loop during heavy encoding', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1000000,
    });

    // Track if setInterval callbacks fire during encoding/flush
    let intervalCallbacksFired = 0;
    const intervalHandle = setInterval(() => {
      intervalCallbacksFired++;
    }, 1); // Use 1ms interval for more sensitive detection

    // Queue 20 frames
    for (let i = 0; i < 20; i++) {
      const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Wait for encoding to complete
    await encoder.flush();

    clearInterval(intervalHandle);

    // With async encoding, the event loop runs during flush() which polls
    // for pending chunks using setImmediate. This allows interval callbacks
    // to fire. With sync encoding, we would get 0 callbacks.
    // Expect at least 1 callback to prove the event loop was not blocked.
    assert.ok(intervalCallbacksFired >= 1);
    assert.ok(chunks.length > 0);

    encoder.close();
  });
});
