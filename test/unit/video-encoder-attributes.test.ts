// test/unit/video-encoder-attributes.test.ts
// Tests for W3C WebCodecs spec section 6.3 - VideoEncoder Attributes

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type EncodedVideoChunk, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoEncoder attributes per W3C WebCodecs spec section 6.3.
 * Verifies state, encodeQueueSize, and ondequeue attributes.
 */

describe('VideoEncoder Attributes: 6.3', () => {
  function createEncoder(): VideoEncoder {
    return new VideoEncoder({
      output: () => {},
      error: () => {},
    });
  }

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

  describe('state attribute (readonly)', () => {
    // Spec 6.3: state returns [[state]] slot value
    it('should be "unconfigured" after construction', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    it('should be "configured" after configure()', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should be "closed" after close()', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be "unconfigured" after reset()', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });
  });

  describe('encodeQueueSize attribute (readonly)', () => {
    // Spec 6.3: encodeQueueSize returns [[encodeQueueSize]] slot value
    it('should be 0 after construction', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.encodeQueueSize, 0);
      encoder.close();
    });

    it('should increase on encode()', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame1 = createVideoFrame(0);
      encoder.encode(frame1, { keyFrame: true });
      frame1.close();

      // Queue size should have increased
      assert.ok(encoder.encodeQueueSize >= 1, 'encodeQueueSize should be >= 1 after encode');

      encoder.close();
    });

    it('should increase with multiple encodes', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame1 = createVideoFrame(0);
      const frame2 = createVideoFrame(33333);
      const frame3 = createVideoFrame(66667);

      encoder.encode(frame1, { keyFrame: true });
      frame1.close();
      const sizeAfterFirst = encoder.encodeQueueSize;

      encoder.encode(frame2);
      frame2.close();
      const sizeAfterSecond = encoder.encodeQueueSize;

      encoder.encode(frame3);
      frame3.close();
      const sizeAfterThird = encoder.encodeQueueSize;

      // Queue size should increase with each encode
      assert.ok(sizeAfterFirst >= 1, 'encodeQueueSize should be >= 1 after first encode');
      assert.ok(sizeAfterSecond >= sizeAfterFirst, 'encodeQueueSize should not decrease');
      assert.ok(sizeAfterThird >= sizeAfterSecond, 'encodeQueueSize should not decrease');

      encoder.close();
    });

    it('should decrease on output', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      const sizeBeforeFlush = encoder.encodeQueueSize;
      assert.ok(sizeBeforeFlush >= 1, 'encodeQueueSize should be >= 1 before flush');

      await encoder.flush();

      // After flush completes with outputs, queue size should be 0
      assert.strictEqual(encoder.encodeQueueSize, 0, 'encodeQueueSize should be 0 after flush');
      assert.ok(outputs.length > 0, 'Should have received outputs');

      encoder.close();
    });

    it('should be 0 after reset()', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      // Reset clears the queue
      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0, 'encodeQueueSize should be 0 after reset');

      encoder.close();
    });
  });

  describe('ondequeue attribute (EventHandler)', () => {
    // Spec 6.3: ondequeue is EventHandler for dequeue event
    it('should be null by default', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.ondequeue, null);
      encoder.close();
    });

    it('should be settable to a function', () => {
      const encoder = createEncoder();
      const handler = () => {};
      encoder.ondequeue = handler;
      assert.strictEqual(encoder.ondequeue, handler);
      encoder.close();
    });

    it('should be settable to null', () => {
      const encoder = createEncoder();
      encoder.ondequeue = () => {};
      encoder.ondequeue = null;
      assert.strictEqual(encoder.ondequeue, null);
      encoder.close();
    });

    it('should fire after output', async () => {
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

      encoder.ondequeue = () => {
        dequeueFired = true;
      };

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have received outputs');
      assert.ok(dequeueFired, 'ondequeue should have fired after output');

      encoder.close();
    });

    it('should invoke ondequeue handler', async () => {
      // Note: Per W3C spec, ondequeue is an EventHandler which should receive Event.
      // Current implementation calls callback without event parameter for backwards compatibility.
      // The dispatchEvent path (addEventListener) does receive Event objects properly.
      let handlerCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.ondequeue = () => {
        handlerCalled = true;
      };

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(handlerCalled, 'ondequeue handler should be called');

      encoder.close();
    });

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

      // No ondequeue handler set
      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      // Should complete successfully without handler
      assert.ok(outputs.length > 0, 'Should have received outputs');

      encoder.close();
    });
  });

  describe('EventTarget integration', () => {
    // Spec 6.3: VideoEncoder is EventTarget with dequeue event
    it('should dispatch to addEventListener', async () => {
      let listenerCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        listenerCalled = true;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(listenerCalled, 'addEventListener handler should be called');

      encoder.close();
    });

    it('should support multiple listeners', async () => {
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
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
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

      // Encode multiple frames to trigger multiple dequeue events
      const frame1 = createVideoFrame(0);
      const frame2 = createVideoFrame(33333);

      encoder.encode(frame1, { keyFrame: true });
      frame1.close();
      encoder.encode(frame2);
      frame2.close();

      await encoder.flush();

      // With once: true, should only be called once
      assert.strictEqual(callCount, 1, 'Listener with once should only be called once');

      encoder.close();
    });
  });

  describe('Rapid encodes edge case', () => {
    it('should handle rapid encodes without losing track', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frameCount = 10;
      for (let i = 0; i < frameCount; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      // Should have received outputs for all frames
      assert.ok(outputs.length >= frameCount, `Should have at least ${frameCount} outputs`);
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

      encoder.close();
    });
  });
});
