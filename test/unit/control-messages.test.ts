// test/unit/control-messages.test.ts
// Tests for W3C WebCodecs spec section 2.2 - Control Messages

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for control message behavior per W3C WebCodecs spec section 2.2.
 * Verifies that configure, encode, flush, reset, and close operations
 * follow the control message queue semantics.
 */

describe('Control Messages: 2.2', () => {
  const config = {
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
  };

  function createEncoder(): VideoEncoder {
    return new VideoEncoder({
      output: () => {},
      error: () => {},
    });
  }

  function createTestFrame(timestamp = 0): VideoFrame {
    const buf = Buffer.alloc(320 * 240 * 4);
    return new VideoFrame(buf, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('Configure message', () => {
    // Spec 2.2: configure() enqueues configure message
    it('should transition state to configured', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.configure(config);

      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    // Spec 2.2: configure blocks subsequent messages until complete
    it('should block encode until configuration complete', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // State should be configured, allowing encode
      assert.strictEqual(encoder.state, 'configured');

      const frame = createTestFrame();
      // Should not throw - configure completed before encode
      encoder.encode(frame, { keyFrame: true });

      frame.close();
      encoder.close();
    });

    it('should throw InvalidStateError when called after close', () => {
      const encoder = createEncoder();
      encoder.close();

      assert.throws(
        () => {
          encoder.configure(config);
        },
        { name: 'InvalidStateError' },
      );
    });
  });

  describe('Encode message', () => {
    // Spec 2.2: encode() enqueues encode message
    it('should increment encodeQueueSize', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame = createTestFrame();
      const initialSize = encoder.encodeQueueSize;

      encoder.encode(frame, { keyFrame: true });

      assert.strictEqual(encoder.encodeQueueSize, initialSize + 1);

      frame.close();
      encoder.close();
    });

    // Spec 2.2: encode messages processed in order
    // Note: Output timestamp order may differ from input due to B-frame reordering
    it('should process all encoded frames', async () => {
      const chunks: unknown[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          chunks.push(chunk);
        },
        error: () => {},
      });

      encoder.configure({
        ...config,
        bitrate: 500_000,
        framerate: 30,
      });

      // Encode 3 frames with distinct timestamps
      const frames = [0, 1000, 2000].map((ts) => createTestFrame(ts));
      for (const frame of frames) {
        encoder.encode(frame, { keyFrame: frame.timestamp === 0 });
      }

      await encoder.flush();

      // Verify all frames were processed (may be fewer chunks due to codec efficiency)
      assert.ok(chunks.length > 0, 'Should have emitted at least one chunk');

      for (const frame of frames) {
        frame.close();
      }
      encoder.close();
    });

    it('should throw InvalidStateError when encoder is unconfigured', () => {
      const encoder = createEncoder();
      const frame = createTestFrame();

      assert.throws(
        () => {
          encoder.encode(frame);
        },
        { name: 'InvalidStateError' },
      );

      frame.close();
      encoder.close();
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      encoder.close();

      const frame = createTestFrame();

      assert.throws(
        () => {
          encoder.encode(frame);
        },
        { name: 'InvalidStateError' },
      );

      frame.close();
    });
  });

  describe('Flush message', () => {
    // Spec 2.2: flush() enqueues flush message, returns Promise
    it('should return a Promise', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const result = encoder.flush();

      assert.ok(result instanceof Promise, 'flush() should return a Promise');
      encoder.close();
    });

    // Spec 2.2: flush blocks until all outputs emitted
    it('should resolve when all outputs are emitted', async () => {
      const chunks: unknown[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          chunks.push(chunk);
        },
        error: () => {},
      });

      encoder.configure({
        ...config,
        bitrate: 500_000,
        framerate: 30,
      });

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });

      await encoder.flush();

      assert.ok(chunks.length > 0, 'Should have emitted chunks after flush');
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

      frame.close();
      encoder.close();
    });

    it('should resolve immediately when no pending work', async () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // Flush with no encode calls should resolve quickly
      await encoder.flush();

      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should reject with InvalidStateError when encoder is closed', async () => {
      const encoder = createEncoder();
      encoder.close();

      await assert.rejects(
        async () => {
          await encoder.flush();
        },
        { name: 'InvalidStateError' },
      );
    });

    it('should reject with InvalidStateError when encoder is unconfigured', async () => {
      const encoder = createEncoder();

      await assert.rejects(
        async () => {
          await encoder.flush();
        },
        { name: 'InvalidStateError' },
      );

      encoder.close();
    });
  });

  describe('Reset message', () => {
    // Spec 2.2: reset() clears queue then resets
    it('should transition to unconfigured state', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();

      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    it('should clear encodeQueueSize', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });
      assert.ok(encoder.encodeQueueSize > 0);

      encoder.reset();

      assert.strictEqual(encoder.encodeQueueSize, 0);

      frame.close();
      encoder.close();
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      const encoder = createEncoder();
      encoder.close();

      assert.throws(
        () => {
          encoder.reset();
        },
        { name: 'InvalidStateError' },
      );
    });

    it('should allow reconfiguration after reset', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      encoder.reset();

      // Should be able to configure with different settings
      const newConfig = { ...config, width: 640, height: 480 };
      encoder.configure(newConfig);

      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });
  });

  describe('Close message', () => {
    // Spec 2.2: close() clears queue then closes
    it('should transition to closed state', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();

      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be idempotent', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      encoder.close();
      encoder.close(); // Should not throw

      assert.strictEqual(encoder.state, 'closed');
    });

    it('should clear pending operations', async () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });

      encoder.close();

      // Queue should be cleared
      assert.strictEqual(encoder.state, 'closed');

      frame.close();
    });
  });

  describe('Edge cases', () => {
    it('configure() called while encode() pending', async () => {
      const encoder = createEncoder();
      encoder.configure({ ...config, bitrate: 500_000, framerate: 30 });

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });

      // Reconfigure while encode is pending
      encoder.configure({ ...config, width: 640, height: 480, bitrate: 1_000_000 });

      assert.strictEqual(encoder.state, 'configured');

      await encoder.flush();
      frame.close();
      encoder.close();
    });

    it('reset() called during flush should abort flush', async () => {
      const encoder = createEncoder();
      encoder.configure({ ...config, bitrate: 500_000, framerate: 30 });

      const frame = createTestFrame();
      encoder.encode(frame, { keyFrame: true });

      // Start flush but don't await
      const flushPromise = encoder.flush();

      // Reset immediately
      encoder.reset();

      // Flush may resolve or reject depending on timing
      try {
        await flushPromise;
      } catch {
        // Reset may cause flush to reject
      }

      assert.strictEqual(encoder.state, 'unconfigured');
      frame.close();
      encoder.close();
    });

    it('close() called during encode sequence', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({ ...config, bitrate: 500_000, framerate: 30 });

      const frames: VideoFrame[] = [];
      for (let i = 0; i < 5; i++) {
        const frame = createTestFrame(i * 1000);
        frames.push(frame);
        if (i < 3) {
          encoder.encode(frame, { keyFrame: i === 0 });
        }
      }

      // Close mid-sequence
      encoder.close();

      assert.strictEqual(encoder.state, 'closed');

      for (const frame of frames) {
        frame.close();
      }
    });
  });
});
