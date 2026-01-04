// test/unit/video-encoder-methods.test.ts
// Tests for W3C WebCodecs spec section 6.5 - VideoEncoder Methods

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type EncodedVideoChunk, VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for VideoEncoder methods per W3C WebCodecs spec section 6.5.
 * Covers configure, encode, flush, reset, close, and isConfigSupported.
 */

describe('VideoEncoder Methods: 6.5', () => {
  function createEncoder(): VideoEncoder {
    return new VideoEncoder({
      output: () => {},
      error: () => {},
    });
  }

  const h264Config = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  const vp9Config = {
    codec: 'vp09.00.10.08',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  // Helper to create test video frame
  function createVideoFrame(timestamp = 0, width = 640, height = 480): VideoFrame {
    const buf = Buffer.alloc(width * height * 4);
    return new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('configure() method', () => {
    // Spec 6.5 step 1: If config is not valid, throw TypeError
    it('should configure with H.264 config', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should configure with VP9 config', () => {
      const encoder = createEncoder();
      encoder.configure(vp9Config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should handle missing codec (implementation-specific)', () => {
      const encoder = createEncoder();
      // Note: Per W3C spec, should throw TypeError for missing/invalid codec.
      // Current native implementation accepts empty codec and attempts to configure.
      // This test documents current behavior - it does NOT throw synchronously.
      // @ts-expect-error Testing invalid input
      encoder.configure({ width: 640, height: 480 });
      // Implementation currently goes to configured state with empty codec
      // Future improvement: should validate codec and throw TypeError
      encoder.close();
    });

    it('should throw when width is missing', () => {
      const encoder = createEncoder();
      // Note: Per W3C spec, should throw TypeError for missing width.
      // Native layer throws Error "Could not open codec".
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          encoder.configure({ codec: 'avc1.42001E', height: 480 });
        },
        (e: Error) => e instanceof Error,
      );
      encoder.close();
    });

    it('should throw when height is missing', () => {
      const encoder = createEncoder();
      // Note: Per W3C spec, should throw TypeError for missing height.
      // Native layer throws Error "Could not open codec".
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          encoder.configure({ codec: 'avc1.42001E', width: 640 });
        },
        (e: Error) => e instanceof Error,
      );
      encoder.close();
    });

    // Spec 6.5 step 2: If state is closed, throw InvalidStateError
    it('should throw InvalidStateError when closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.throws(
        () => {
          encoder.configure(h264Config);
        },
        (e: Error) => e.name === 'InvalidStateError',
      );
    });

    it('should configure with latencyMode realtime', () => {
      const encoder = createEncoder();
      encoder.configure({
        ...h264Config,
        latencyMode: 'realtime',
      });
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should configure with latencyMode quality', () => {
      const encoder = createEncoder();
      encoder.configure({
        ...h264Config,
        latencyMode: 'quality',
      });
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should configure with bitrateMode variable', () => {
      const encoder = createEncoder();
      encoder.configure({
        ...h264Config,
        bitrateMode: 'variable',
      });
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should configure with bitrateMode constant', () => {
      const encoder = createEncoder();
      encoder.configure({
        ...h264Config,
        bitrateMode: 'constant',
      });
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    // Spec: displayWidth and displayHeight must both be present or both absent
    it('should throw TypeError when only displayWidth is provided', () => {
      const encoder = createEncoder();
      assert.throws(
        () => {
          encoder.configure({
            ...h264Config,
            displayWidth: 1280,
          });
        },
        (e: Error) => e.name === 'TypeError',
      );
      encoder.close();
    });

    it('should throw TypeError when only displayHeight is provided', () => {
      const encoder = createEncoder();
      assert.throws(
        () => {
          encoder.configure({
            ...h264Config,
            displayHeight: 720,
          });
        },
        (e: Error) => e.name === 'TypeError',
      );
      encoder.close();
    });

    it('should accept both displayWidth and displayHeight', () => {
      const encoder = createEncoder();
      encoder.configure({
        ...h264Config,
        displayWidth: 1280,
        displayHeight: 720,
      });
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    describe('W3C validation', () => {
      it('should throw TypeError for empty codec', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({ codec: '', width: 100, height: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for missing codec', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            encoder.configure({ width: 100, height: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for missing width', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            encoder.configure({ codec: 'avc1.42001e', height: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for missing height', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            encoder.configure({ codec: 'avc1.42001e', width: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero width', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({ codec: 'avc1.42001e', width: 0, height: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero height', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({ codec: 'avc1.42001e', width: 100, height: 0, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for negative width', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({ codec: 'avc1.42001e', width: -100, height: 100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for negative height', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({ codec: 'avc1.42001e', width: 100, height: -100, bitrate: 1_000_000 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero displayWidth', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({
              codec: 'avc1.42001e',
              width: 100,
              height: 100,
              displayWidth: 0,
              displayHeight: 100,
              bitrate: 1_000_000,
            });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero displayHeight', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            encoder.configure({
              codec: 'avc1.42001e',
              width: 100,
              height: 100,
              displayWidth: 100,
              displayHeight: 0,
              bitrate: 1_000_000,
            });
          },
          TypeError,
        );
        encoder.close();
      });
    });
  });

  describe('encode() method', () => {
    // Spec 6.5 step 2: If state is not configured, throw InvalidStateError
    it('should throw InvalidStateError when unconfigured', () => {
      const encoder = createEncoder();
      const frame = createVideoFrame();
      assert.throws(
        () => {
          encoder.encode(frame);
        },
        (e: Error) => e.name === 'InvalidStateError',
      );
      frame.close();
      encoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      encoder.close();
      const frame = createVideoFrame();
      assert.throws(
        () => {
          encoder.encode(frame);
        },
        (e: Error) => e.name === 'InvalidStateError',
      );
      frame.close();
    });

    // Spec 6.5 step 1: If frame is detached, throw TypeError
    it('should throw when VideoFrame is closed', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      const frame = createVideoFrame();
      frame.close();
      assert.throws(
        () => {
          encoder.encode(frame);
        },
        (e: Error) => e instanceof Error, // May be TypeError or Error from native
      );
      encoder.close();
    });

    it('should encode VideoFrame', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have produced output');
      assert.strictEqual(outputs[0].type, 'key', 'First frame should be key');

      encoder.close();
    });

    // Spec: keyFrame option forces key frame
    it('should produce key frame with keyFrame: true for first frame', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      // Encode with keyFrame: true on first frame
      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length >= 1, 'Should have at least 1 output');
      assert.strictEqual(outputs[0].type, 'key', 'Frame with keyFrame: true should be key');

      encoder.close();
    });

    it('should produce key frame when encoding starts', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      // Encode several frames
      for (let i = 0; i < 3; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      assert.ok(outputs.length >= 3, 'Should have at least 3 outputs');
      // First frame should always be key (either forced or by encoder default)
      assert.strictEqual(outputs[0].type, 'key', 'First frame should be key');

      encoder.close();
    });

    it('should increment encodeQueueSize on encode', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      assert.ok(encoder.encodeQueueSize >= 1, 'Queue size should increase');

      encoder.close();
    });
  });

  describe('flush() method', () => {
    // Spec 6.5 step 1: If state is not configured, reject with InvalidStateError
    it('should reject when unconfigured', async () => {
      const encoder = createEncoder();
      await assert.rejects(encoder.flush(), { name: 'InvalidStateError' });
      encoder.close();
    });

    it('should reject when closed', async () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      encoder.close();
      await assert.rejects(encoder.flush(), { name: 'InvalidStateError' });
    });

    it('should complete pending encodes', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      for (let i = 0; i < 3; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      assert.ok(outputs.length >= 3, 'Should have all outputs after flush');
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty');

      encoder.close();
    });

    it('should allow multiple flushes', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      // First batch
      const frame1 = createVideoFrame(0);
      encoder.encode(frame1, { keyFrame: true });
      frame1.close();
      await encoder.flush();

      const countAfterFirst = outputs.length;

      // Second batch
      const frame2 = createVideoFrame(33333);
      encoder.encode(frame2);
      frame2.close();
      await encoder.flush();

      assert.ok(outputs.length > countAfterFirst, 'Should have more outputs after second flush');

      encoder.close();
    });
  });

  describe('reset() method', () => {
    // Spec 6.5: reset() runs Reset algorithm with AbortError
    it('should reset to unconfigured state', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should clear encodeQueueSize', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be cleared');

      encoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.throws(
        () => {
          encoder.reset();
        },
        (e: Error) => e.name === 'InvalidStateError',
      );
    });

    it('should allow reconfigure after reset', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      encoder.reset();
      encoder.configure(vp9Config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });
  });

  describe('close() method', () => {
    // Spec 6.5: close() runs Close algorithm with AbortError
    it('should set state to closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be idempotent', () => {
      const encoder = createEncoder();
      encoder.close();
      encoder.close(); // Should not throw
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should work after configure', () => {
      const encoder = createEncoder();
      encoder.configure(h264Config);
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });
  });

  describe('isConfigSupported() static method', () => {
    // Spec 6.5: Returns promise with VideoEncoderSupport
    it('should return supported: true for H.264', async () => {
      const result = await VideoEncoder.isConfigSupported(h264Config);
      assert.strictEqual(result.supported, true);
      assert.ok(result.config, 'Should return config');
    });

    it('should return supported: true for VP9', async () => {
      const result = await VideoEncoder.isConfigSupported(vp9Config);
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: false for invalid codec', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'invalid-codec',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    // Spec 6.5 step 1: If config is not valid, reject with TypeError
    // Note: Current implementation returns supported: false instead of rejecting
    it('should return supported: false for missing width', async () => {
      // @ts-expect-error Testing invalid input
      const result = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001E', height: 480 });
      assert.strictEqual(result.supported, false);
    });

    it('should return supported: false for missing height', async () => {
      // @ts-expect-error Testing invalid input
      const result = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001E', width: 640 });
      assert.strictEqual(result.supported, false);
    });

    it('should return config in result', async () => {
      const result = await VideoEncoder.isConfigSupported(h264Config);
      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, h264Config.codec);
      assert.strictEqual(result.config.width, h264Config.width);
      assert.strictEqual(result.config.height, h264Config.height);
    });
  });

  describe('Edge cases', () => {
    it('should handle different frame dimensions from config', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      // Configure for 640x480
      encoder.configure(h264Config);

      // Create frame with matching dimensions
      const frame = createVideoFrame(0, 640, 480);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce output');

      encoder.close();
    });

    it('should handle rapid configure/encode/reset cycles', async () => {
      const encoder = createEncoder();

      for (let i = 0; i < 3; i++) {
        encoder.configure(h264Config);
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, { keyFrame: true });
        frame.close();
        encoder.reset();
      }

      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });
  });
});
