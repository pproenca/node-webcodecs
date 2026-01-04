// test/unit/video-decoder-pending-frames.test.ts
// TDD Test: Verify pendingFrames is properly decremented after frame output
// Issue: pending_frames_ is incremented when frame is queued but never decremented in OnFrameCallback

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame } from '../../lib';

describe('VideoDecoder pendingFrames tracking', () => {
  const config = {
    codec: 'avc1.42001E', // H.264 Baseline
  };

  /**
   * Helper to encode video frames and return chunks.
   */
  async function encodeTestFrames(count: number): Promise<EncodedVideoChunk[]> {
    const encodedChunks: EncodedVideoChunk[] = [];

    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        encodedChunks.push(
          new EncodedVideoChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            data,
          }),
        );
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001E',
      width: 320,
      height: 240,
      bitrate: 500_000,
      framerate: 30,
    });

    // Create and encode test frames
    for (let i = 0; i < count; i++) {
      const buf = Buffer.alloc(320 * 240 * 4);
      // Fill with different colors to ensure different frames
      buf.fill(i % 256);
      const frame = new VideoFrame(buf, {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333, // ~30fps
        format: 'RGBA',
      });

      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    return encodedChunks;
  }

  it('should decrement pendingFrames after frame output callback completes', async () => {
    // First encode some video to get valid encoded chunks
    const encodedChunks = await encodeTestFrames(3);
    assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

    // Track outputs
    const outputs: VideoFrame[] = [];
    let maxPendingFrames = 0;

    const decoder = new VideoDecoder({
      output: (f) => {
        outputs.push(f);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure(config);

    // Check initial pendingFrames
    assert.strictEqual(decoder.pendingFrames, 0, 'pendingFrames should be 0 initially');

    // Queue decode operations
    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    // Track max pending during decoding
    const checkPending = () => {
      maxPendingFrames = Math.max(maxPendingFrames, decoder.pendingFrames);
    };

    // Set up interval to track pending frames
    const intervalId = setInterval(checkPending, 1);

    await decoder.flush();
    clearInterval(intervalId);

    // After flush completes and all outputs received, pendingFrames MUST be 0
    // This is the critical assertion - if pending_frames_ is never decremented,
    // this will fail because pendingFrames will be > 0
    assert.strictEqual(
      decoder.pendingFrames,
      0,
      `pendingFrames should be 0 after flush, but was ${decoder.pendingFrames}. ` +
        `Received ${outputs.length} frames, max pending was ${maxPendingFrames}`,
    );

    // Cleanup
    for (const f of outputs) f.close();
    decoder.close();
  });

  it('should have pendingFrames match actual pending TSFN callbacks', async () => {
    const encodedChunks = await encodeTestFrames(5);
    assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

    let outputCount = 0;
    const pendingHistory: number[] = [];

    const decoder = new VideoDecoder({
      output: (f) => {
        outputCount++;
        // Record pendingFrames at each output callback
        pendingHistory.push(decoder.pendingFrames);
        f.close();
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure(config);

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    // After all frames output and flush complete, pendingFrames must be 0
    assert.strictEqual(
      decoder.pendingFrames,
      0,
      `pendingFrames should be 0 after all outputs, got ${decoder.pendingFrames}`,
    );

    // Verify we got some outputs
    assert.ok(outputCount > 0, `Should have received outputs, got ${outputCount}`);

    decoder.close();
  });

  it('should reset pendingFrames to 0 on reset()', async () => {
    const encodedChunks = await encodeTestFrames(2);

    const decoder = new VideoDecoder({
      output: (f) => f.close(),
      error: (e) => {
        throw e;
      },
    });

    decoder.configure(config);

    // Queue some decodes
    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    // Don't flush - just reset
    decoder.reset();

    // After reset, pendingFrames should be 0
    assert.strictEqual(
      decoder.pendingFrames,
      0,
      'pendingFrames should be 0 after reset()',
    );

    decoder.close();
  });
});
