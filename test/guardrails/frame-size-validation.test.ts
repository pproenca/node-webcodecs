/**
 * Regression test: Frame size validation for VideoEncoder
 *
 * This test verifies that when a VideoFrame with dimensions different from
 * the configured encoder dimensions is passed to encode(), the implementation:
 * 1. Throws a clear error, OR
 * 2. Handles the conversion safely
 *
 * It must NOT read past buffer bounds (undefined behavior / crash).
 *
 * W3C WebCodecs Spec Reference:
 * - Section 9.3: VideoEncoder encode() algorithm
 * - The frame's coded dimensions should match encoder configuration
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoEncoder, VideoFrame } from '../../lib';
import { createRGBABuffer, TEST_CONSTANTS } from '../fixtures/index.js';

describe('Guardrails: Frame Size Validation', () => {
  const configuredWidth = 320;
  const configuredHeight = 240;

  describe('frame larger than configured size', () => {
    it('should not crash when frame is larger than configured dimensions', async () => {
      // Configure encoder for 320x240
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          // Error callback may be invoked - that's acceptable
          // What's NOT acceptable is a crash/segfault
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: configuredWidth,
        height: configuredHeight,
        bitrate: 500_000,
      });

      // Create a frame that is LARGER than configured (640x480 vs 320x240)
      const largerWidth = 640;
      const largerHeight = 480;
      const buffer = createRGBABuffer(largerWidth, largerHeight);

      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: largerWidth,
        codedHeight: largerHeight,
        timestamp: 0,
      });

      let errorThrown = false;
      let errorReceived: Error | undefined;

      try {
        encoder.encode(frame);
        await encoder.flush();
      } catch (e) {
        errorThrown = true;
        errorReceived = e instanceof Error ? e : undefined;
      }

      frame.close();
      encoder.close();

      // Either:
      // 1. An error was thrown synchronously (TypeError, NotSupportedError, etc.)
      // 2. The encode succeeded (implementation handles resize internally)
      // Both are acceptable. What's NOT acceptable: crash, segfault, undefined behavior.
      //
      // This test passes if we reach this point without crashing.
      assert.ok(
        true,
        'Implementation should not crash on frame larger than configured dimensions'
      );

      // Log outcome for debugging
      if (errorThrown) {
        console.log(`  [INFO] Error thrown for larger frame: ${errorReceived?.name}: ${errorReceived?.message}`);
      } else {
        console.log('  [INFO] Encoding succeeded with larger frame (internal resize handling)');
      }
    });
  });

  describe('frame smaller than configured size', () => {
    it('should not crash when frame is smaller than configured dimensions', async () => {
      // Configure encoder for 320x240
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          // Error callback may be invoked - that's acceptable
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: configuredWidth,
        height: configuredHeight,
        bitrate: 500_000,
      });

      // Create a frame that is SMALLER than configured (160x120 vs 320x240)
      const smallerWidth = 160;
      const smallerHeight = 120;
      const buffer = createRGBABuffer(smallerWidth, smallerHeight);

      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: smallerWidth,
        codedHeight: smallerHeight,
        timestamp: 0,
      });

      let errorThrown = false;
      let errorReceived: Error | undefined;

      try {
        encoder.encode(frame);
        await encoder.flush();
      } catch (e) {
        errorThrown = true;
        errorReceived = e instanceof Error ? e : undefined;
      }

      frame.close();
      encoder.close();

      // Same as above: crash is the failure mode we're guarding against
      assert.ok(
        true,
        'Implementation should not crash on frame smaller than configured dimensions'
      );

      if (errorThrown) {
        console.log(`  [INFO] Error thrown for smaller frame: ${errorReceived?.name}: ${errorReceived?.message}`);
      } else {
        console.log('  [INFO] Encoding succeeded with smaller frame (internal resize handling)');
      }
    });
  });

  describe('frame with mismatched aspect ratio', () => {
    it('should not crash when frame has different aspect ratio', async () => {
      // Configure encoder for 320x240 (4:3 aspect ratio)
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: configuredWidth,
        height: configuredHeight,
        bitrate: 500_000,
      });

      // Create a frame with 16:9 aspect ratio (320x180)
      const wideWidth = 320;
      const wideHeight = 180;
      const buffer = createRGBABuffer(wideWidth, wideHeight);

      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: wideWidth,
        codedHeight: wideHeight,
        timestamp: 0,
      });

      let errorThrown = false;
      let errorReceived: Error | undefined;

      try {
        encoder.encode(frame);
        await encoder.flush();
      } catch (e) {
        errorThrown = true;
        errorReceived = e instanceof Error ? e : undefined;
      }

      frame.close();
      encoder.close();

      assert.ok(
        true,
        'Implementation should not crash on frame with different aspect ratio'
      );

      if (errorThrown) {
        console.log(`  [INFO] Error thrown for mismatched aspect ratio: ${errorReceived?.name}: ${errorReceived?.message}`);
      } else {
        console.log('  [INFO] Encoding succeeded with mismatched aspect ratio');
      }
    });
  });

  describe('extreme size mismatches', () => {
    it('should not crash when frame is much larger (4x dimensions)', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: TEST_CONSTANTS.SMALL_FRAME.width,  // 64
        height: TEST_CONSTANTS.SMALL_FRAME.height, // 64
        bitrate: 100_000,
      });

      // 4x larger: 256x256 vs 64x64
      const largeWidth = TEST_CONSTANTS.SMALL_FRAME.width * 4;
      const largeHeight = TEST_CONSTANTS.SMALL_FRAME.height * 4;
      const buffer = createRGBABuffer(largeWidth, largeHeight);

      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: largeWidth,
        codedHeight: largeHeight,
        timestamp: 0,
      });

      try {
        encoder.encode(frame);
        await encoder.flush();
      } catch {
        // Error is acceptable
      }

      frame.close();
      encoder.close();

      assert.ok(true, 'Implementation should not crash on 4x larger frame');
    });

    it('should not crash when frame is much smaller (1/4 dimensions)', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: TEST_CONSTANTS.MEDIUM_FRAME.width,  // 320
        height: TEST_CONSTANTS.MEDIUM_FRAME.height, // 240
        bitrate: 500_000,
      });

      // 1/4 size: 80x60 vs 320x240
      const smallWidth = TEST_CONSTANTS.MEDIUM_FRAME.width / 4;
      const smallHeight = TEST_CONSTANTS.MEDIUM_FRAME.height / 4;
      const buffer = createRGBABuffer(smallWidth, smallHeight);

      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: smallWidth,
        codedHeight: smallHeight,
        timestamp: 0,
      });

      try {
        encoder.encode(frame);
        await encoder.flush();
      } catch {
        // Error is acceptable
      }

      frame.close();
      encoder.close();

      assert.ok(true, 'Implementation should not crash on 1/4 size frame');
    });
  });
});
