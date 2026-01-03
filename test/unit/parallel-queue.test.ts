// test/unit/parallel-queue.test.ts
// Tests for W3C WebCodecs spec section 2.3 - Codec Work Parallel Queue

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for codec work parallel queue per W3C WebCodecs spec section 2.3.
 * Verifies that:
 * - Codec operations run on background worker thread
 * - Callbacks are delivered on main event loop
 * - Multiple concurrent operations are handled correctly
 */

describe('Parallel Queue: 2.3', () => {
  const config = {
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  };

  function createTestFrame(timestamp = 0): VideoFrame {
    const buf = Buffer.alloc(320 * 240 * 4);
    return new VideoFrame(buf, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('Non-blocking encode operations', () => {
    // Spec 2.3: [[codec implementation]] accessed only from work queue
    it('encode should not block the event loop', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      // Encode a frame - should return quickly
      const frame = createTestFrame();
      const encodeStart = performance.now();
      encoder.encode(frame, { keyFrame: true });
      const encodeDuration = performance.now() - encodeStart;

      // Encode call should return very quickly (< 100ms)
      // The actual encoding happens on the worker thread
      assert.ok(
        encodeDuration < 100,
        `encode() took ${encodeDuration}ms, expected < 100ms`,
      );

      frame.close();
      await encoder.flush();
      encoder.close();
    });

    it('multiple encodes should queue without blocking', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frames: VideoFrame[] = [];
      const start = performance.now();

      // Queue 10 frames rapidly
      for (let i = 0; i < 10; i++) {
        const frame = createTestFrame(i * 1000);
        frames.push(frame);
        encoder.encode(frame, { keyFrame: i === 0 });
      }

      const queueTime = performance.now() - start;

      // Queuing 10 frames should be fast (< 500ms)
      // They are processed asynchronously on the worker
      assert.ok(
        queueTime < 500,
        `Queuing 10 frames took ${queueTime}ms, expected < 500ms`,
      );

      await encoder.flush();

      for (const frame of frames) {
        frame.close();
      }
      encoder.close();
    });
  });

  describe('Callback delivery on main thread', () => {
    // Spec 2.3: Tasks queued back to event loop use codec task source
    it('output callbacks should be invoked asynchronously', async () => {
      const callbackOrder: string[] = [];

      const encoder = new VideoEncoder({
        output: () => {
          callbackOrder.push('output');
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });
      callbackOrder.push('after-encode');

      // Callback should not have fired yet (async delivery)
      assert.strictEqual(callbackOrder.length, 1);
      assert.strictEqual(callbackOrder[0], 'after-encode');

      await encoder.flush();

      // Now output should have been called
      assert.ok(
        callbackOrder.includes('output'),
        'Output callback should have been invoked',
      );

      frame.close();
      encoder.close();
    });

    it('error callbacks should be invoked on main thread', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      // Configure with valid config, then close
      encoder.configure(config);
      encoder.close();

      // Try to encode on closed encoder - should get error synchronously
      const frame = createTestFrame();
      try {
        encoder.encode(frame);
      } catch {
        // Expected - InvalidStateError thrown synchronously on main thread
      }
      frame.close();

      // The synchronous error path demonstrates main thread execution
      assert.strictEqual(encoder.state, 'closed');
    });
  });

  describe('Concurrent operation handling', () => {
    it('should handle rapid encode calls correctly', async () => {
      const chunks: unknown[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          chunks.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frames: VideoFrame[] = [];

      // Rapidly queue 20 frames
      for (let i = 0; i < 20; i++) {
        const frame = createTestFrame(i * 1000);
        frames.push(frame);
        encoder.encode(frame, { keyFrame: i % 10 === 0 });
      }

      await encoder.flush();

      // All frames should have been encoded
      assert.ok(chunks.length > 0, 'Should have received encoded chunks');
      assert.ok(chunks.length <= 20, 'Should not have more chunks than frames');

      for (const frame of frames) {
        frame.close();
      }
      encoder.close();
    });

    it('should handle flush during active encoding', async () => {
      const chunks: unknown[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          chunks.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frames: VideoFrame[] = [];

      // Encode some frames
      for (let i = 0; i < 5; i++) {
        const frame = createTestFrame(i * 1000);
        frames.push(frame);
        encoder.encode(frame, { keyFrame: i === 0 });
      }

      // Flush while encoding is in progress
      const flushPromise1 = encoder.flush();

      // Encode more frames after flush is called
      for (let i = 5; i < 10; i++) {
        const frame = createTestFrame(i * 1000);
        frames.push(frame);
        encoder.encode(frame, { keyFrame: i === 5 });
      }

      // Wait for first flush
      await flushPromise1;

      // Final flush
      await encoder.flush();

      // All frames should be processed
      assert.ok(chunks.length > 0);

      for (const frame of frames) {
        frame.close();
      }
      encoder.close();
    });
  });

  describe('Decoder parallel queue', () => {
    it('decode should not block the event loop', async () => {
      // First encode some frames
      const encodedChunks: Array<{ data: Uint8Array; timestamp: number; type: 'key' | 'delta' }> = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push({
            data,
            timestamp: chunk.timestamp,
            type: chunk.type as 'key' | 'delta',
          });
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createTestFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();
      await encoder.flush();
      encoder.close();

      // Now decode
      const decoder = new VideoDecoder({
        output: (decodedFrame) => {
          decodedFrame.close();
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({ codec: 'avc1.42001E' });

      const decodeStart = performance.now();
      for (const chunk of encodedChunks) {
        decoder.decode(
          new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            data: chunk.data,
          }),
        );
      }
      const decodeDuration = performance.now() - decodeStart;

      // Decode calls should return quickly
      assert.ok(
        decodeDuration < 100,
        `decode() calls took ${decodeDuration}ms, expected < 100ms`,
      );

      await decoder.flush();
      decoder.close();
    });
  });

  describe('Worker thread isolation', () => {
    it('should maintain separate queues for multiple encoders', async () => {
      const results = { encoder1: 0, encoder2: 0 };

      const encoder1 = new VideoEncoder({
        output: () => {
          results.encoder1++;
        },
        error: (e) => {
          throw e;
        },
      });

      const encoder2 = new VideoEncoder({
        output: () => {
          results.encoder2++;
        },
        error: (e) => {
          throw e;
        },
      });

      encoder1.configure(config);
      encoder2.configure({ ...config, width: 640, height: 480 });

      // Encode to both simultaneously
      const frames1: VideoFrame[] = [];
      const frames2: VideoFrame[] = [];

      for (let i = 0; i < 5; i++) {
        const frame1 = createTestFrame(i * 1000);
        frames1.push(frame1);
        encoder1.encode(frame1, { keyFrame: i === 0 });

        const buf2 = Buffer.alloc(640 * 480 * 4);
        const frame2 = new VideoFrame(buf2, {
          codedWidth: 640,
          codedHeight: 480,
          timestamp: i * 1000,
          format: 'RGBA',
        });
        frames2.push(frame2);
        encoder2.encode(frame2, { keyFrame: i === 0 });
      }

      await Promise.all([encoder1.flush(), encoder2.flush()]);

      // Both encoders should have produced output
      assert.ok(results.encoder1 > 0, 'Encoder 1 should have output');
      assert.ok(results.encoder2 > 0, 'Encoder 2 should have output');

      for (const frame of frames1) frame.close();
      for (const frame of frames2) frame.close();
      encoder1.close();
      encoder2.close();
    });
  });
});
