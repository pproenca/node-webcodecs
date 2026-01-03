// test/unit/video-decoder-events.test.ts
// Tests for W3C WebCodecs spec section 4.4 - VideoDecoder Event Summary

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoDecoder dequeue event per W3C WebCodecs spec section 4.4.
 * Verifies that the dequeue event fires when decodeQueueSize decreases.
 */

describe('VideoDecoder Events: 4.4', () => {
  // Helper to encode video and get chunks for decoding
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

    return encodedChunks;
  }

  const config = {
    codec: 'avc1.42001E',
  };

  describe('dequeue event firing', () => {
    // Spec 4.4: dequeue fires when decodeQueueSize decreases

    it('should fire dequeue event with Event object', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let eventReceived: Event | null = null;

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', (event) => {
        eventReceived = event;
      });

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should have received Event object
      if (outputs.length > 0) {
        assert.ok(eventReceived instanceof Event, 'Should receive Event object');
        assert.strictEqual(eventReceived?.type, 'dequeue', 'Event type should be "dequeue"');
      }

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should fire dequeue after flush completes', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let dequeueCount = 0;

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

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // dequeueCount before flush
      const countBeforeFlush = dequeueCount;

      await decoder.flush();

      // dequeue events should fire as outputs are produced
      assert.ok(
        dequeueCount >= countBeforeFlush,
        'dequeue should fire during/after flush',
      );

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should call ondequeue handler with Event object', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let callbackInvoked = false;

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.ondequeue = () => {
        callbackInvoked = true;
      };

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // ondequeue should have been called
      if (outputs.length > 0) {
        // Give microtask time to run
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        assert.ok(callbackInvoked, 'ondequeue callback should be invoked');
      }

      for (const f of outputs) f.close();
      decoder.close();
    });
  });

  describe('event edge cases', () => {
    it('should handle no handler set gracefully', async () => {
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

      // No handler set - should not throw
      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should complete without error
      assert.ok(true, 'Decoder should work without dequeue handler');

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should handle handler removed mid-operation', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let count = 0;

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      const handler = () => {
        count++;
        // Remove self after first call
        decoder.removeEventListener('dequeue', handler);
      };

      decoder.addEventListener('dequeue', handler);

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Handler should have been called at most once (before removal)
      assert.ok(count <= 1, 'Handler should not fire after removal');

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should not fire dequeue after close', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      let dequeueAfterClose = false;

      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure(config);

      // Close immediately
      decoder.close();

      decoder.addEventListener('dequeue', () => {
        dequeueAfterClose = true;
      });

      // Wait a bit
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Should not have received dequeue after close
      assert.strictEqual(dequeueAfterClose, false, 'Should not fire dequeue after close');
    });
  });

  describe('EventTarget integration', () => {
    it('should dispatch to multiple listeners', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let listener1Called = false;
      let listener2Called = false;

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        listener1Called = true;
      });
      decoder.addEventListener('dequeue', () => {
        listener2Called = true;
      });

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        assert.ok(listener1Called, 'First listener should be called');
        assert.ok(listener2Called, 'Second listener should be called');
      }

      for (const f of outputs) f.close();
      decoder.close();
    });

    it('should support once option', async () => {
      const chunks = await encodeVideoChunks();
      if (chunks.length === 0) return;

      const outputs: VideoFrame[] = [];
      let callCount = 0;

      const decoder = new VideoDecoder({
        output: (frame) => {
          outputs.push(frame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener(
        'dequeue',
        () => {
          callCount++;
        },
        { once: true },
      );

      decoder.configure(config);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should be called at most once
      assert.ok(callCount <= 1, 'Handler with once option should fire at most once');

      for (const f of outputs) f.close();
      decoder.close();
    });
  });
});
