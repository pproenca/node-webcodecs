// test/golden/video-encoder-event-loop.test.ts
import { describe, expect, it } from 'vitest';

/**
 * Event loop blocking verification tests for VideoEncoder.
 *
 * These tests verify that encoding operations do not block the Node.js event loop,
 * which is a key requirement for production use. When async_mode_ is enabled in
 * the native layer, encoding runs on the libuv thread pool via AsyncWorker.
 *
 * Note: Currently async_mode_ is disabled (see video_encoder.cc Configure()).
 * These tests will pass once async workers are fully enabled.
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

    // Track if setImmediate callbacks fire during encoding
    let immediateCallbacksFired = 0;
    const immediateInterval = setInterval(() => {
      immediateCallbacksFired++;
    }, 10);

    // Queue 20 frames (more work)
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

    clearInterval(immediateInterval);

    // If async works, interval callbacks should have fired
    // With sync encoding, they would be blocked
    expect(immediateCallbacksFired).toBeGreaterThan(5);
    expect(chunks.length).toBeGreaterThan(0);

    encoder.close();
  });
});
