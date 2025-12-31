// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
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
      expect(is.isImageData(imageData)).toBe(true);
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

      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(4);
      expect(frame.codedHeight).toBe(4);
      expect(frame.timestamp).toBe(1000);

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

      expect(frame.timestamp).toBe(1000);
      expect(frame.duration).toBe(5000);

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

      expect(frame.visibleRect?.x).toBe(50);
      expect(frame.visibleRect?.width).toBe(100);

      frame.close();
    });

    it('should validate ImageData has correct data size', () => {
      const badImageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(10), // Wrong size!
      };

      expect(() => new VideoFrame(badImageData, { timestamp: 0 })).toThrow();
    });
  });
});
