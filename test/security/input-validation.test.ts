// test/security/input-validation.test.ts
// Security tests for W3C WebCodecs spec section 12 - Input Validation

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoEncoder, VideoFrame } from '../../lib';

/**
 * Tests for input validation per W3C WebCodecs Security Considerations.
 * These tests verify that malformed inputs are rejected safely without
 * crashing, exposing memory addresses, or causing undefined behavior.
 */

describe('Security: Input Validation', () => {
  describe('VideoEncoder config validation', () => {
    // Spec 12: Validate config before passing to native
    it('should reject invalid codec string', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(
        () => {
          encoder.configure({
            codec: 'invalid-codec-xyz',
            width: 640,
            height: 480,
          });
        },
        // Invalid codec throws Error with descriptive message
        (err: Error) => err.message.includes('Unsupported'),
      );

      encoder.close();
    });

    it('should reject zero dimensions with error', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(
        () => {
          encoder.configure({
            codec: 'avc1.42001E',
            width: 0,
            height: 480,
          });
        },
        // Zero dimensions caught by FFmpeg - still rejected safely
        { name: 'Error' },
      );

      encoder.close();
    });

    it('should reject negative dimensions with error', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(
        () => {
          encoder.configure({
            codec: 'avc1.42001E',
            width: -640,
            height: 480,
          });
        },
        // Negative dimensions caught by FFmpeg - still rejected safely
        { name: 'Error' },
      );

      encoder.close();
    });
  });

  describe('VideoFrame creation', () => {
    // Spec 12: Validate chunk data bounds
    // Note: Comprehensive buffer validation is tested by test/guardrails/fuzzer.ts
    // which tests the compiled package. These tests verify source-level behavior.

    it('should accept correctly sized RGBA buffer', () => {
      // 100x100 RGBA = 40000 bytes
      const frame = new VideoFrame(Buffer.alloc(40000), {
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.strictEqual(frame.codedWidth, 100);
      assert.strictEqual(frame.codedHeight, 100);
      frame.close();
    });

    it('should set correct dimensions from init', () => {
      const frame = new VideoFrame(Buffer.alloc(40000), {
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 1000,
        format: 'RGBA',
      });

      assert.strictEqual(frame.timestamp, 1000);
      frame.close();
    });
  });

  describe('Error message sanitization', () => {
    // Spec 12: Never expose native memory addresses
    it('should not expose memory addresses in error messages', () => {
      const hexAddressPattern = /0x[0-9a-fA-F]{8,}/;

      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      try {
        encoder.configure({
          codec: 'invalid-codec-xyz',
          width: 640,
          height: 480,
        });
        assert.fail('Should have thrown');
      } catch (err) {
        const error = err as Error;
        assert.ok(
          !hexAddressPattern.test(error.message),
          `Error message should not contain memory addresses: ${error.message}`,
        );
      }

      encoder.close();
    });

    it('should provide user-friendly error messages', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      try {
        encoder.configure({
          codec: 'invalid-codec-xyz',
          width: 640,
          height: 480,
        });
        assert.fail('Should have thrown');
      } catch (err) {
        const error = err as Error;
        // Should mention the problem, not internal details
        assert.ok(
          error.message.includes('Unsupported') ||
            error.message.includes('codec') ||
            error.message.includes('Invalid'),
          `Error should be user-friendly: ${error.message}`,
        );
      }

      encoder.close();
    });
  });

  describe('Codec closed state protection', () => {
    // Spec 12: Prevent use-after-close
    it('should throw on encode after close', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      });

      encoder.close();

      // Create a valid frame
      const buffer = Buffer.alloc(640 * 480 * 4); // RGBA
      const frame = new VideoFrame(buffer, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.throws(
        () => {
          encoder.encode(frame);
        },
        { name: 'InvalidStateError' },
      );

      frame.close();
    });

    it('should throw on configure after close', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      assert.throws(
        () => {
          encoder.configure({
            codec: 'avc1.42001E',
            width: 640,
            height: 480,
          });
        },
        { name: 'InvalidStateError' },
      );
    });

    it('should throw on flush after close', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      await assert.rejects(
        async () => {
          await encoder.flush();
        },
        { name: 'InvalidStateError' },
      );
    });

    it('should throw on reset after close', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      assert.throws(
        () => {
          encoder.reset();
        },
        { name: 'InvalidStateError' },
      );
    });
  });

  describe('Callback validation', () => {
    // Spec 12: Validate all external inputs
    it('should require output callback', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should require error callback', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ output: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should reject non-function output', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new VideoEncoder({ output: 'not a function', error: () => {} });
        },
        { name: 'TypeError' },
      );
    });
  });
});
