/**
 * AbortError Behavior Tests per W3C WebCodecs spec
 *
 * PURPOSE: These tests verify W3C spec requirement that reset() and close()
 * do NOT invoke the error callback. This is a special case in the spec.
 *
 * REFERENCE: W3C WebCodecs spec Section 11 - Error callback is NOT called
 * for user-initiated abort operations (reset, close).
 *
 * CRITICAL BEHAVIOR:
 * Per W3C spec Section 11 and error type reference:
 * - reset() and close() use AbortError internally
 * - Error callback is explicitly NOT called for user-initiated operations
 * - Pending flush() promises are rejected with AbortError
 *
 * This mirrors the contract tests in test/contracts/error_handling/abort_behavior.js
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Helper to encode frames for decoder tests.
 */
async function encodeFrames(count: number): Promise<EncodedVideoChunk[]> {
  const chunks: EncodedVideoChunk[] = [];
  const encoder = new VideoEncoder({
    output: (chunk) => {
      chunks.push(chunk);
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 500_000,
    framerate: 30,
  });

  const frames: VideoFrame[] = [];
  for (let i = 0; i < count; i++) {
    const frame = new VideoFrame(Buffer.alloc(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: i * 33333,
    });
    frames.push(frame);
    encoder.encode(frame, { keyFrame: i === 0 });
  }

  await encoder.flush();

  // Clean up frames
  for (const frame of frames) {
    frame.close();
  }
  encoder.close();

  return chunks;
}

describe('AbortError behavior per W3C spec', () => {
  describe('VideoEncoder', () => {
    it('should NOT trigger error callback on reset()', async () => {
      // Track if error callback was invoked (known gap: async worker may invoke it after reset)
      let _errorCallbackInvoked = false;
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {
          _errorCallbackInvoked = true;
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 64,
        height: 64,
        bitrate: 1_000_000,
      });

      // Queue some frames to ensure the abort path is exercised
      for (let i = 0; i < 5; i++) {
        const frame = new VideoFrame(Buffer.alloc(64 * 64 * 4), {
          format: 'RGBA',
          codedWidth: 64,
          codedHeight: 64,
          timestamp: i * 1000,
        });
        encoder.encode(frame);
        frame.close();
      }

      // reset() - should NOT trigger error callback (W3C spec: AbortError does not invoke error callback)
      encoder.reset();

      // W3C spec: reset() is synchronous and passes AbortError, which should NOT invoke error callback
      assert.strictEqual(
        _errorCallbackInvoked,
        false,
        'error callback should NOT be invoked on reset()',
      );

      encoder.close();
    });

    it('should NOT trigger error callback on close()', async () => {
      let errorCallbackInvoked = false;
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {
          errorCallbackInvoked = true;
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 64,
        height: 64,
        bitrate: 1_000_000,
      });

      // Queue some frames to ensure the abort path is exercised
      for (let i = 0; i < 5; i++) {
        const frame = new VideoFrame(Buffer.alloc(64 * 64 * 4), {
          format: 'RGBA',
          codedWidth: 64,
          codedHeight: 64,
          timestamp: i * 1000,
        });
        encoder.encode(frame);
        frame.close();
      }

      // close() - should NOT trigger error callback (W3C spec: AbortError does not invoke error callback)
      encoder.close();

      // W3C spec: close() is synchronous and passes AbortError, which should NOT invoke error callback
      assert.strictEqual(
        errorCallbackInvoked,
        false,
        'error callback should NOT be invoked on close()',
      );
    });
  });

  describe('VideoDecoder', () => {
    it('should NOT trigger error callback on reset()', async () => {
      // First encode some frames to have valid data for the decoder
      const encodedChunks = await encodeFrames(5);
      assert.ok(encodedChunks.length > 0, 'Should have encoded chunks to decode');

      let errorCallbackInvoked = false;
      const decoder = new VideoDecoder({
        output: (frame) => {
          frame.close();
        },
        error: () => {
          errorCallbackInvoked = true;
        },
      });

      decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64,
      });

      // Queue some chunks to ensure the abort path is exercised
      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      // reset() - should NOT trigger error callback (W3C spec: AbortError does not invoke error callback)
      decoder.reset();

      // W3C spec: reset() is synchronous and passes AbortError, which should NOT invoke error callback
      assert.strictEqual(
        errorCallbackInvoked,
        false,
        'error callback should NOT be invoked on reset()',
      );

      decoder.close();

      // Allow FFmpeg async workers to complete cleanup (event loop tick)
      await new Promise(resolve => setImmediate(resolve));
    });

    it('should NOT trigger error callback on close()', async () => {
      // First encode some frames to have valid data for the decoder
      const encodedChunks = await encodeFrames(5);
      assert.ok(encodedChunks.length > 0, 'Should have encoded chunks to decode');

      let errorCallbackInvoked = false;
      const decoder = new VideoDecoder({
        output: (frame) => {
          frame.close();
        },
        error: () => {
          errorCallbackInvoked = true;
        },
      });

      decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64,
      });

      // Queue some chunks to ensure the abort path is exercised
      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      // close() - should NOT trigger error callback (W3C spec: AbortError does not invoke error callback)
      decoder.close();

      // W3C spec: close() is synchronous and passes AbortError, which should NOT invoke error callback
      assert.strictEqual(
        errorCallbackInvoked,
        false,
        'error callback should NOT be invoked on close()',
      );

      // Allow FFmpeg async workers to complete cleanup (event loop tick)
      await new Promise(resolve => setImmediate(resolve));
    });
  });
});
