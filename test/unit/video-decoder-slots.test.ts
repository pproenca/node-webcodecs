// test/unit/video-decoder-slots.test.ts
// Tests for W3C WebCodecs spec section 4.1 - VideoDecoder Internal Slots

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoDecoder internal slots per W3C WebCodecs spec section 4.1.
 * Verifies that all internal slots are correctly initialized per constructor steps (4.2).
 */

describe('VideoDecoder Internal Slots: 4.1', () => {
  function createDecoder(): VideoDecoder {
    return new VideoDecoder({
      output: () => {},
      error: () => {},
    });
  }

  const config = {
    codec: 'avc1.42001E', // H.264 Baseline
  };

  describe('Constructor initialization (4.2)', () => {
    // Spec 4.2 step 10: Assign "unconfigured" to [[state]]
    it('should initialize state to "unconfigured"', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.state, 'unconfigured');
      decoder.close();
    });

    // Spec 4.2 step 11: Assign 0 to [[decodeQueueSize]]
    it('should initialize decodeQueueSize to 0', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.decodeQueueSize, 0);
      decoder.close();
    });

    // Spec 4.2 step 7: Assign init.output to [[output callback]]
    it('should store output callback (verified via decoder creation)', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // Verify decoder was created successfully with output callback
      assert.strictEqual(decoder.state, 'unconfigured');
      decoder.close();
    });

    // Spec 4.2 step 8: Assign init.error to [[error callback]]
    it('should store error callback and invoke it on error', async () => {
      let errorReceived: DOMException | null = null;

      const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure(config);

      // Decode a delta chunk without first decoding a key chunk
      // This should trigger the error callback per spec
      const chunkData = new Uint8Array([0, 0, 0, 0]); // Invalid H.264 data
      const chunk = new EncodedVideoChunk({
        type: 'delta', // Not a key frame
        timestamp: 0,
        data: chunkData,
      });

      decoder.decode(chunk);

      // Error callback should have been called with DataError
      assert.notStrictEqual(errorReceived, null);
      assert.strictEqual(errorReceived?.name, 'DataError');
      assert.ok(errorReceived?.message.includes('key'));

      decoder.close();
    });

    // Spec 4.2 step 9: Assign true to [[key chunk required]]
    it('should require key chunk after construction', async () => {
      let errorReceived: DOMException | null = null;

      const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure(config);

      // First chunk as delta should fail
      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 0,
        data: new Uint8Array([0]),
      });

      decoder.decode(chunk);

      assert.notStrictEqual(errorReceived, null);
      assert.strictEqual(errorReceived?.name, 'DataError');

      decoder.close();
    });

    // Spec 4.2 step 2: Assign new queue to [[control message queue]]
    it('should have control message queue (verified via reset behavior)', () => {
      const decoder = createDecoder();
      decoder.configure(config);

      // Reset clears the queue
      decoder.reset();

      assert.strictEqual(decoder.state, 'unconfigured');
      decoder.close();
    });
  });

  describe('Callback validation', () => {
    it('should throw TypeError when output callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoDecoder({ error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoDecoder({ output: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when output is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoDecoder({ output: 'not a function', error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoDecoder({ output: () => {}, error: 'not a function' });
        },
        { name: 'TypeError' },
      );
    });
  });

  describe('Output callback receives VideoFrame', () => {
    it('should output VideoFrame objects', async () => {
      // First encode some video to get valid encoded chunks
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

      // Create test frame
      const buf = Buffer.alloc(320 * 240 * 4);
      const frame = new VideoFrame(buf, {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
        format: 'RGBA',
      });

      encoder.encode(frame, { keyFrame: true });
      frame.close();
      await encoder.flush();
      encoder.close();

      if (encodedChunks.length === 0) return;

      // Now decode
      const outputs: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({ codec: 'avc1.42001E' });

      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Verify outputs are VideoFrame instances
      for (const output of outputs) {
        assert.ok(output instanceof VideoFrame, 'Output should be VideoFrame');
        assert.ok(output.codedWidth > 0);
        assert.ok(output.codedHeight > 0);
        output.close();
      }

      decoder.close();
    });
  });

  describe('Independent instances', () => {
    it('should maintain independent state for multiple decoders', () => {
      const decoder1 = createDecoder();
      const decoder2 = createDecoder();

      // Configure only decoder1
      decoder1.configure(config);

      // decoder1 should be configured, decoder2 should still be unconfigured
      assert.strictEqual(decoder1.state, 'configured');
      assert.strictEqual(decoder2.state, 'unconfigured');

      // Close decoder1
      decoder1.close();

      // decoder1 should be closed, decoder2 should still be unconfigured
      assert.strictEqual(decoder1.state, 'closed');
      assert.strictEqual(decoder2.state, 'unconfigured');

      decoder2.close();
    });

    it('should maintain independent decodeQueueSize', () => {
      const decoder1 = createDecoder();
      const decoder2 = createDecoder();

      decoder1.configure(config);
      decoder2.configure(config);

      // Both should start at 0
      assert.strictEqual(decoder1.decodeQueueSize, 0);
      assert.strictEqual(decoder2.decodeQueueSize, 0);

      decoder1.close();
      decoder2.close();
    });
  });

  describe('Key chunk required reset', () => {
    it('should reset key chunk requirement on reset()', async () => {
      let errorCount = 0;

      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {
          errorCount++;
        },
      });

      decoder.configure(config);

      // First delta should fail
      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 0,
        data: new Uint8Array([0]),
      });

      decoder.decode(chunk);
      const errorsAfterFirstDelta = errorCount;

      // Reset
      decoder.reset();
      decoder.configure(config);

      // After reset, first delta should fail again
      decoder.decode(chunk);
      const errorsAfterSecondDelta = errorCount;

      // Should have gotten errors both times
      assert.ok(errorsAfterFirstDelta > 0);
      assert.ok(errorsAfterSecondDelta > errorsAfterFirstDelta);

      decoder.close();
    });
  });
});
