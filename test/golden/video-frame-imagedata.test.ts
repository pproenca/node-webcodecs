// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoFrame } from '../..';
import * as is from '../../lib/is';

describe('VideoFrame constructor from ImageData', () => {
  describe('type guard', () => {
    it('should detect ImageData-like objects', () => {
      const imageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };
      assert.strictEqual(is.isImageData(imageData), true);
    });
  });

  describe('constructor', () => {
    it('should create VideoFrame from ImageData', () => {
      // Simulate canvas.getContext('2d').getImageData() result
      const imageData = {
        width: 4,
        height: 4,
        data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
      };

      const frame = new VideoFrame(imageData, { timestamp: 1000 });

      assert.strictEqual(frame.format, 'RGBA');
      assert.strictEqual(frame.codedWidth, 4);
      assert.strictEqual(frame.codedHeight, 4);
      assert.strictEqual(frame.timestamp, 1000);

      frame.close();
    });

    it('should apply VideoFrameInit overrides', () => {
      const imageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };

      const frame = new VideoFrame(imageData, {
        timestamp: 1000,
        duration: 5000,
      });

      assert.strictEqual(frame.timestamp, 1000);
      assert.strictEqual(frame.duration, 5000);

      frame.close();
    });

    it('should support visibleRect cropping', () => {
      const imageData = {
        width: 200,
        height: 200,
        data: new Uint8ClampedArray(200 * 200 * 4),
      };

      const frame = new VideoFrame(imageData, {
        timestamp: 0,
        visibleRect: { x: 50, y: 50, width: 100, height: 100 },
      });

      assert.strictEqual(frame.visibleRect?.x, 50);
      assert.strictEqual(frame.visibleRect?.width, 100);

      frame.close();
    });

    it('should validate ImageData has correct data size', () => {
      const badImageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(10), // Wrong size!
      };

      assert.throws(() => {
        new VideoFrame(badImageData, { timestamp: 0 });
      });
    });
  });
});
