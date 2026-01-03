// test/unit/video-encoder-slots.test.ts
// Tests for W3C WebCodecs spec section 6.1 - VideoEncoder Internal Slots

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type EncodedVideoChunk, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoEncoder internal slots per W3C WebCodecs spec section 6.1.
 * Verifies that all internal slots are correctly initialized per constructor steps (6.2).
 */

describe('VideoEncoder Internal Slots: 6.1', () => {
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

  describe('Constructor initialization (6.2)', () => {
    // Spec 6.2: Assign "unconfigured" to [[state]]
    it('should initialize state to "unconfigured"', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    // Spec 6.2: Assign 0 to [[encodeQueueSize]]
    it('should initialize encodeQueueSize to 0', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.encodeQueueSize, 0);
      encoder.close();
    });

    // Spec 6.2: Assign init.output to [[output callback]]
    it('should store output callback (verified via encoder creation)', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      // Verify encoder was created successfully with output callback
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    // Spec 6.2: Assign init.error to [[error callback]]
    it('should store error callback (verified via encoder creation)', () => {
      let errorCallbackCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {
          errorCallbackCalled = true;
        },
      });

      // Encoder created successfully with error callback
      assert.strictEqual(encoder.state, 'unconfigured');

      // Close the encoder
      encoder.close();

      // Note: We can't easily trigger an error to verify the callback
      // but the encoder was created successfully with it
      assert.strictEqual(errorCallbackCalled, false, 'Error callback not yet called');
    });

    // Spec 6.2: Assign new queue to [[control message queue]]
    it('should have control message queue (verified via reset behavior)', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // Reset clears the queue
      encoder.reset();

      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });
  });

  describe('Callback validation', () => {
    it('should throw TypeError when output callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ output: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when output is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ output: 'not a function', error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ output: () => {}, error: 'not a function' });
        },
        { name: 'TypeError' },
      );
    });
  });

  describe('Output callback receives EncodedVideoChunk', () => {
    it('should output EncodedVideoChunk objects', async () => {
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

      // Create video frame to encode
      const frame = createVideoFrame();
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      // Verify outputs are EncodedVideoChunk instances
      assert.ok(outputs.length > 0, 'Should have produced outputs');
      for (const output of outputs) {
        assert.ok(output.byteLength > 0, 'Chunk should have data');
        assert.ok(output.type === 'key' || output.type === 'delta', 'Chunk should have type');
      }

      encoder.close();
    });
  });

  describe('Independent instances', () => {
    it('should maintain independent state for multiple encoders', () => {
      const encoder1 = createEncoder();
      const encoder2 = createEncoder();

      // Configure only encoder1
      encoder1.configure(config);

      // encoder1 should be configured, encoder2 should still be unconfigured
      assert.strictEqual(encoder1.state, 'configured');
      assert.strictEqual(encoder2.state, 'unconfigured');

      // Close encoder1
      encoder1.close();

      // encoder1 should be closed, encoder2 should still be unconfigured
      assert.strictEqual(encoder1.state, 'closed');
      assert.strictEqual(encoder2.state, 'unconfigured');

      encoder2.close();
    });

    it('should maintain independent encodeQueueSize', () => {
      const encoder1 = createEncoder();
      const encoder2 = createEncoder();

      encoder1.configure(config);
      encoder2.configure(config);

      // Both should start at 0
      assert.strictEqual(encoder1.encodeQueueSize, 0);
      assert.strictEqual(encoder2.encodeQueueSize, 0);

      encoder1.close();
      encoder2.close();
    });
  });

  describe('[[active encoder config]] slot', () => {
    it('should be null before configure (inferred from state)', () => {
      const encoder = createEncoder();

      // State is unconfigured means no active config
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should be set after configure', () => {
      const encoder = createEncoder();

      encoder.configure(config);

      // State is configured means config is active
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });

    it('should update on reconfigure', () => {
      const encoder = createEncoder();

      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      // Reconfigure with different settings
      encoder.configure({
        codec: 'avc1.42001E',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 60,
      });

      // Should still be configured
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });
  });

  describe('[[codec saturated]] slot', () => {
    it('should be false initially', () => {
      const encoder = createEncoder();

      // codecSaturated should be false when no encoding is happening
      assert.strictEqual(encoder.codecSaturated, false);

      encoder.close();
    });

    it('should be accessible after configure', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // Should still be false with no pending work
      assert.strictEqual(encoder.codecSaturated, false);

      encoder.close();
    });
  });

  describe('maxQueueDepth (backpressure)', () => {
    it('should have default maxQueueDepth of 16', () => {
      const encoder = createEncoder();

      assert.strictEqual(encoder.maxQueueDepth, 16);

      encoder.close();
    });

    it('should allow setting maxQueueDepth', () => {
      const encoder = createEncoder();

      encoder.maxQueueDepth = 32;
      assert.strictEqual(encoder.maxQueueDepth, 32);

      encoder.close();
    });

    it('should throw RangeError for maxQueueDepth < 1', () => {
      const encoder = createEncoder();

      assert.throws(
        () => {
          encoder.maxQueueDepth = 0;
        },
        (e: Error) => e instanceof RangeError,
      );

      encoder.close();
    });
  });

  describe('ready Promise (backpressure)', () => {
    it('should resolve immediately when queue is empty', async () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const start = Date.now();
      await encoder.ready;
      const elapsed = Date.now() - start;

      // Should resolve very quickly when queue is empty
      assert.ok(elapsed < 100, 'ready should resolve immediately when queue empty');

      encoder.close();
    });
  });
});
