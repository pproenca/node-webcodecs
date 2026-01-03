// test/unit/video-encoder-events.test.ts
// Tests for W3C WebCodecs spec section 6.4 - VideoEncoder Event Summary

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type EncodedVideoChunk, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoEncoder events per W3C WebCodecs spec section 6.4.
 * The dequeue event fires when encodeQueueSize decreases.
 */

describe('VideoEncoder Events: 6.4', () => {
  const config = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  // Helper to create test video frame
  function createVideoFrame(timestamp = 0): VideoFrame {
    const buf = Buffer.alloc(640 * 480 * 4);
    return new VideoFrame(buf, {
      codedWidth: 640,
      codedHeight: 480,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('dequeue event (spec 6.4)', () => {
    // Spec 6.4: dequeue fires when encodeQueueSize decreases
    it('should fire dequeue after encode output', async () => {
      let dequeueFired = false;
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have received outputs');
      assert.ok(dequeueFired, 'dequeue event should have fired');

      encoder.close();
    });

    it('should fire dequeue with Event object', async () => {
      let receivedEvent: Event | null = null;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', (event) => {
        receivedEvent = event;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(receivedEvent !== null, 'Should have received event');
      assert.ok(receivedEvent instanceof Event, 'Should be Event instance');
      assert.strictEqual(receivedEvent.type, 'dequeue', 'Event type should be dequeue');

      encoder.close();
    });

    it('should fire dequeue after flush completes', async () => {
      let dequeueCount = 0;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      // Dequeue should have fired at least once
      assert.ok(dequeueCount >= 1, 'dequeue should have fired at least once');

      encoder.close();
    });

    it('should fire dequeue for each output when multiple frames encoded', async () => {
      let dequeueCount = 0;
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      encoder.configure(config);

      // Encode multiple frames
      for (let i = 0; i < 5; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      // Should have outputs
      assert.ok(outputs.length >= 5, 'Should have at least 5 outputs');
      // Dequeue should have fired at least once (may be coalesced)
      assert.ok(dequeueCount >= 1, 'dequeue should have fired at least once');

      encoder.close();
    });
  });

  describe('Event handling edge cases', () => {
    it('should handle no handler set gracefully', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      // No event handler set
      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      // Should complete successfully
      assert.ok(outputs.length > 0, 'Should have received outputs');

      encoder.close();
    });

    it('should not fire dequeue after close', async () => {
      let dequeueAfterClose = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      // Close encoder immediately (before flush)
      encoder.close();

      // Add listener after close
      encoder.addEventListener('dequeue', () => {
        dequeueAfterClose = true;
      });

      // Give time for any async events
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have fired
      assert.strictEqual(dequeueAfterClose, false, 'dequeue should not fire after close');
    });
  });

  describe('EventTarget integration', () => {
    it('should dispatch to multiple listeners', async () => {
      let listener1Called = false;
      let listener2Called = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        listener1Called = true;
      });
      encoder.addEventListener('dequeue', () => {
        listener2Called = true;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(listener1Called, 'First listener should be called');
      assert.ok(listener2Called, 'Second listener should be called');

      encoder.close();
    });

    it('should support once option', async () => {
      let callCount = 0;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener(
        'dequeue',
        () => {
          callCount++;
        },
        { once: true },
      );

      encoder.configure(config);

      // Encode multiple frames to trigger multiple potential dequeue events
      for (let i = 0; i < 3; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      // With once: true, should only be called once
      assert.strictEqual(callCount, 1, 'Listener with once should only be called once');

      encoder.close();
    });

    it('should support removeEventListener', async () => {
      let callCount = 0;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      const handler = () => {
        callCount++;
      };

      encoder.addEventListener('dequeue', handler);

      encoder.configure(config);

      const frame1 = createVideoFrame(0);
      encoder.encode(frame1, { keyFrame: true });
      frame1.close();

      await encoder.flush();

      const countAfterFirst = callCount;

      // Remove listener
      encoder.removeEventListener('dequeue', handler);

      // Encode more
      const frame2 = createVideoFrame(33333);
      encoder.encode(frame2);
      frame2.close();

      await encoder.flush();

      // Count should not have increased after removing listener
      assert.strictEqual(callCount, countAfterFirst, 'Listener should not be called after removal');

      encoder.close();
    });
  });
});
