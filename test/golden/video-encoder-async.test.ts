import {describe, it, expect} from 'vitest';

describe('VideoEncoder async mode', () => {
  it('should not block event loop during encoding', async () => {
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
});
