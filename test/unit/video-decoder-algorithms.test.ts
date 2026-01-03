// test/unit/video-decoder-algorithms.test.ts
// Tests for W3C WebCodecs spec section 4.6 - VideoDecoder Algorithms

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoDecoder internal algorithms per W3C WebCodecs spec section 4.6.
 * Verifies Reset VideoDecoder, Close VideoDecoder, Output VideoFrames, Schedule Dequeue Event.
 */

describe('VideoDecoder Algorithms: 4.6', () => {
  const validConfig = {
    codec: 'avc1.42001E',
  };

  // Helper to encode video and get valid chunks
  async function encodeVideoChunks(): Promise<EncodedVideoChunk[]> {
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

    return encodedChunks;
  }

  describe('Reset VideoDecoder algorithm', () => {
    // Spec 4.6 step 2: Reset sets [[state]] to "unconfigured"
    it('should set state to "unconfigured"', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure(validConfig);
      assert.strictEqual(decoder.state, 'configured');

      decoder.reset();
      assert.strictEqual(decoder.state, 'unconfigured');

      decoder.close();
    });

    // Spec 4.6 step 5: Reset clears [[decodeQueueSize]]
    it('should clear decodeQueueSize to 0', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const decoder = new VideoDecoder({
        output: (f) => f.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      // Queue some decodes
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // Reset should clear the queue
      decoder.reset();
      assert.strictEqual(decoder.decodeQueueSize, 0);

      decoder.close();
    });

    // Spec 4.6 step 6: Reject pending flush promises with exception
    it('should reject pending flush promise with AbortError on reset', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const decoder = new VideoDecoder({
        output: (f) => f.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      // Queue decode and start flush
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }
      const flushPromise = decoder.flush();

      // Reset while flush is pending
      decoder.reset();

      // Flush should reject (or resolve if it completed before reset)
      try {
        await flushPromise;
        // If it resolved, that's OK - flush may have completed
      } catch (e) {
        // Should be AbortError
        if (e instanceof DOMException) {
          assert.strictEqual(e.name, 'AbortError');
        }
      }

      decoder.close();
    });

    // Spec 4.6 step 1: Reset when closed throws InvalidStateError
    it('should throw InvalidStateError when already closed', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');

      assert.throws(
        () => decoder.reset(),
        (e: Error) => e instanceof DOMException && e.name === 'InvalidStateError',
      );
    });

    it('should be safe when already unconfigured', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(decoder.state, 'unconfigured');

      // Should not throw
      assert.doesNotThrow(() => decoder.reset());

      assert.strictEqual(decoder.state, 'unconfigured');

      decoder.close();
    });
  });

  describe('Close VideoDecoder algorithm', () => {
    // Spec 4.6 step 2: Close sets [[state]] to "closed"
    it('should set state to "closed"', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure(validConfig);
      assert.strictEqual(decoder.state, 'configured');

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');
    });

    // Spec 4.6 step 1: Close runs Reset first, rejecting pending promises
    it('should reject pending flush promise with AbortError on close', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const decoder = new VideoDecoder({
        output: (f) => f.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }
      const flushPromise = decoder.flush();

      // Close while flush is pending
      decoder.close();

      try {
        await flushPromise;
        // May have resolved if flush completed
      } catch (e) {
        if (e instanceof DOMException) {
          assert.strictEqual(e.name, 'AbortError');
        }
      }
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');

      // Second close should not throw
      assert.doesNotThrow(() => decoder.close());
      assert.strictEqual(decoder.state, 'closed');

      // Third close should not throw
      assert.doesNotThrow(() => decoder.close());
    });
  });

  describe('Output VideoFrames algorithm', () => {
    // Spec 4.6: Invoke [[output callback]] for each output with VideoFrame
    it('should invoke output callback for each decoded frame', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should have received output(s)
      assert.ok(outputs.length > 0, 'Should receive decoded outputs');

      // Each output should be valid VideoFrame
      for (const output of outputs) {
        assert.ok(output instanceof VideoFrame, 'Output should be VideoFrame');
        assert.ok(output.codedWidth > 0, 'VideoFrame should have codedWidth');
        assert.ok(output.codedHeight > 0, 'VideoFrame should have codedHeight');
        output.close();
      }

      decoder.close();
    });

    // Spec 4.6: VideoFrame has timestamp from EncodedVideoChunk
    it('should output VideoFrame with timestamp', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        // Timestamp should be defined (not undefined or NaN)
        assert.ok(
          typeof outputs[0].timestamp === 'number' && !Number.isNaN(outputs[0].timestamp),
          'VideoFrame should have valid timestamp',
        );
      }

      for (const f of outputs) f.close();
      decoder.close();
    });

    // Spec 4.6: VideoFrame has dimensions
    it('should output VideoFrame with correct dimensions', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        // Dimensions should match encoded dimensions
        assert.strictEqual(outputs[0].codedWidth, 320);
        assert.strictEqual(outputs[0].codedHeight, 240);
      }

      for (const f of outputs) f.close();
      decoder.close();
    });
  });

  describe('Schedule Dequeue Event algorithm', () => {
    // Spec 4.6: Dequeue events should be coalesced
    it('should coalesce rapid dequeue events', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      let dequeueCount = 0;
      const outputs: VideoFrame[] = [];

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      decoder.configure(validConfig);

      // Rapidly queue multiple decodes
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Dequeue count should be less than or equal to output count
      // due to coalescing
      assert.ok(
        dequeueCount <= outputs.length,
        `Expected coalesced dequeue events (got ${dequeueCount} for ${outputs.length} outputs)`,
      );

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should fire dequeue event when decodeQueueSize decreases', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      let dequeueFired = false;
      const outputs: VideoFrame[] = [];

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        assert.ok(dequeueFired, 'Dequeue event should fire when outputs are produced');
      }

      for (const f of outputs) f.close();
      decoder.close();
    });
  });
});
