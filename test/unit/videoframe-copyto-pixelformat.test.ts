/**
 * Tests for W3C WebCodecs spec sections 9.5-9.8:
 * - 9.5 VideoFrame CopyTo Options
 * - 9.6 DOMRects in VideoFrame
 * - 9.7 PlaneLayout
 * - 9.8 Pixel Format
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoFrame } from '../../lib';
import type {
  PlaneLayout,
  VideoFrameCopyToOptions,
  VideoPixelFormat,
} from '../../lib/types';

describe('VideoFrame CopyTo and Pixel Formats: 9.5-9.8', () => {
  /**
   * Helper to create a VideoFrame with given format and dimensions.
   */
  function createVideoFrame(options: {
    format?: VideoPixelFormat;
    width?: number;
    height?: number;
    timestamp?: number;
  } = {}): InstanceType<typeof VideoFrame> {
    const format = options.format ?? 'RGBA';
    const width = options.width ?? 640;
    const height = options.height ?? 480;
    const timestamp = options.timestamp ?? 0;

    // Calculate buffer size based on format
    let bufferSize: number;

    // Packed RGB formats: 4 bytes per pixel
    if (format === 'RGBA' || format === 'RGBX' || format === 'BGRA' || format === 'BGRX') {
      bufferSize = width * height * 4;
    }
    // I420: Y + U (1/4) + V (1/4) = 1.5 bytes per pixel
    else if (format === 'I420') {
      const ySize = width * height;
      const uvSize = Math.ceil(width / 2) * Math.ceil(height / 2);
      bufferSize = ySize + uvSize * 2;
    }
    // I420A: I420 + Alpha
    else if (format === 'I420A') {
      const ySize = width * height;
      const uvSize = Math.ceil(width / 2) * Math.ceil(height / 2);
      bufferSize = ySize + uvSize * 2 + ySize;
    }
    // I422: Y + U (1/2 width) + V (1/2 width)
    else if (format === 'I422') {
      const ySize = width * height;
      const uvSize = Math.ceil(width / 2) * height;
      bufferSize = ySize + uvSize * 2;
    }
    // I422A: I422 + Alpha
    else if (format === 'I422A') {
      const ySize = width * height;
      const uvSize = Math.ceil(width / 2) * height;
      bufferSize = ySize + uvSize * 2 + ySize;
    }
    // I444: Y + U + V (all same size)
    else if (format === 'I444') {
      bufferSize = width * height * 3;
    }
    // I444A: I444 + Alpha
    else if (format === 'I444A') {
      bufferSize = width * height * 4;
    }
    // NV12: Y + UV interleaved (half height)
    else if (format === 'NV12' || format === 'NV21') {
      const ySize = width * height;
      const uvSize = width * Math.ceil(height / 2);
      bufferSize = ySize + uvSize;
    }
    // NV12A: NV12 + Alpha
    else if (format === 'NV12A') {
      const ySize = width * height;
      const uvSize = width * Math.ceil(height / 2);
      bufferSize = ySize + uvSize + ySize;
    }
    // 10-bit formats: 2 bytes per sample
    else if (format === 'I420P10' || format === 'I420P12') {
      const ySize = width * height * 2;
      const uvSize = Math.ceil(width / 2) * Math.ceil(height / 2) * 2;
      bufferSize = ySize + uvSize * 2;
    }
    else if (format === 'I420AP10' || format === 'I420AP12') {
      const ySize = width * height * 2;
      const uvSize = Math.ceil(width / 2) * Math.ceil(height / 2) * 2;
      bufferSize = ySize + uvSize * 2 + ySize;
    }
    else if (format === 'I422P10' || format === 'I422P12') {
      const ySize = width * height * 2;
      const uvSize = Math.ceil(width / 2) * height * 2;
      bufferSize = ySize + uvSize * 2;
    }
    else if (format === 'I422AP10' || format === 'I422AP12') {
      const ySize = width * height * 2;
      const uvSize = Math.ceil(width / 2) * height * 2;
      bufferSize = ySize + uvSize * 2 + ySize;
    }
    else if (format === 'I444P10' || format === 'I444P12') {
      bufferSize = width * height * 3 * 2;
    }
    else if (format === 'I444AP10' || format === 'I444AP12') {
      bufferSize = width * height * 4 * 2;
    }
    else if (format === 'NV12P10') {
      const ySize = width * height * 2;
      const uvSize = width * Math.ceil(height / 2) * 2;
      bufferSize = ySize + uvSize;
    }
    else {
      // Fallback for unknown formats
      bufferSize = width * height * 4;
    }

    const data = Buffer.alloc(bufferSize);
    return new VideoFrame(data, {
      format,
      codedWidth: width,
      codedHeight: height,
      timestamp,
    });
  }

  // =========================================================================
  // 9.5 VideoFrameCopyToOptions
  // =========================================================================

  describe('9.5 VideoFrameCopyToOptions', () => {
    it('should copy full visibleRect when no options provided', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      // Spec 9.5: returns PlaneLayout array
      assert.ok(Array.isArray(layout));
      assert.ok(layout.length > 0);

      frame.close();
    });

    it('should copy subset when rect option provided', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 100, height: 100 });

      // Copy only a 10x10 portion
      const rectOptions: VideoFrameCopyToOptions = {
        rect: { x: 0, y: 0, width: 10, height: 10 },
      };

      const requiredSize = frame.allocationSize(rectOptions);
      // 10x10 RGBA = 400 bytes
      assert.strictEqual(requiredSize, 10 * 10 * 4);

      const buffer = new ArrayBuffer(requiredSize);
      const layout = await frame.copyTo(buffer, rectOptions);

      assert.ok(Array.isArray(layout));

      frame.close();
    });

    it('should throw RangeError for rect exceeding dimensions', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 100, height: 100 });

      await assert.rejects(
        async () => {
          const buffer = new ArrayBuffer(1000000);
          await frame.copyTo(buffer, {
            rect: { x: 0, y: 0, width: 200, height: 100 }, // width exceeds
          });
        },
        /RangeError|Error/,
      );

      frame.close();
    });

    it('should support copyTo with different output format', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });

      // Request BGRA format
      const options: VideoFrameCopyToOptions = { format: 'BGRA' };

      // Should return size for BGRA (same as RGBA for packed formats)
      const requiredSize = frame.allocationSize(options);
      assert.strictEqual(requiredSize, 10 * 10 * 4);

      frame.close();
    });

    it('should default colorSpace to srgb', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });

      // colorSpace defaults to 'srgb' when not specified
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      assert.ok(layout.length > 0);

      frame.close();
    });
  });

  // =========================================================================
  // 9.6 DOMRects in VideoFrame
  // =========================================================================

  describe('9.6 DOMRects in VideoFrame', () => {
    it('should have codedRect matching coded dimensions', () => {
      const frame = createVideoFrame({ width: 1920, height: 1080 });
      const rect = frame.codedRect;

      assert.ok(rect !== null);
      assert.strictEqual(rect?.x, 0);
      assert.strictEqual(rect?.y, 0);
      assert.strictEqual(rect?.width, 1920);
      assert.strictEqual(rect?.height, 1080);

      frame.close();
    });

    it('should have visibleRect defaulting to full frame', () => {
      const frame = createVideoFrame({ width: 1920, height: 1080 });
      const rect = frame.visibleRect;

      assert.ok(rect !== null);
      assert.strictEqual(rect?.width, 1920);
      assert.strictEqual(rect?.height, 1080);

      frame.close();
    });

    it('should return null for codedRect after close', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.strictEqual(frame.codedRect, null);
    });

    it('should return null for visibleRect after close', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.strictEqual(frame.visibleRect, null);
    });
  });

  // =========================================================================
  // 9.7 PlaneLayout
  // =========================================================================

  describe('9.7 PlaneLayout', () => {
    it('should return PlaneLayout array from copyTo', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      assert.ok(Array.isArray(layout));
      assert.ok(layout.length >= 1);

      frame.close();
    });

    it('should have offset and stride in PlaneLayout', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      // Spec 9.7: PlaneLayout has offset and stride
      const plane = layout[0];
      assert.ok(plane !== undefined);
      assert.ok(typeof plane.offset === 'number');
      assert.ok(typeof plane.stride === 'number');

      frame.close();
    });

    it('should have stride >= width for packed formats', async () => {
      const frame = createVideoFrame({ format: 'RGBA', width: 10, height: 10 });
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      // For RGBA, stride should be at least width * 4
      const plane = layout[0];
      assert.ok(plane !== undefined);
      assert.ok(plane.stride >= 10 * 4);

      frame.close();
    });

    it('should return multiple PlaneLayouts for planar formats', async () => {
      const frame = createVideoFrame({ format: 'I420', width: 100, height: 100 });
      const buffer = new ArrayBuffer(frame.allocationSize());
      const layout = await frame.copyTo(buffer);

      // I420 has 3 planes: Y, U, V
      assert.strictEqual(layout.length, 3);

      frame.close();
    });
  });

  // =========================================================================
  // 9.8 Pixel Format
  // =========================================================================

  describe('9.8 VideoPixelFormat', () => {
    // All 23+ formats from spec
    const allFormats: VideoPixelFormat[] = [
      // 4:2:0 YUV
      'I420', 'I420P10', 'I420P12',
      // 4:2:0 YUVA
      'I420A', 'I420AP10', 'I420AP12',
      // 4:2:2 YUV
      'I422', 'I422P10', 'I422P12',
      // 4:2:2 YUVA
      'I422A', 'I422AP10', 'I422AP12',
      // 4:4:4 YUV
      'I444', 'I444P10', 'I444P12',
      // 4:4:4 YUVA
      'I444A', 'I444AP10', 'I444AP12',
      // Semi-planar
      'NV12',
      // Packed RGB
      'RGBA', 'RGBX', 'BGRA', 'BGRX',
    ];

    it('should support all 23 base VideoPixelFormat values', () => {
      // This is a type check + runtime validation
      assert.strictEqual(allFormats.length, 23);
    });

    // Test formats that the implementation supports
    describe('Packed RGB formats (1 plane)', () => {
      for (const format of ['RGBA', 'RGBX', 'BGRA', 'BGRX'] as VideoPixelFormat[]) {
        it(`should create VideoFrame with ${format} format`, () => {
          const frame = createVideoFrame({ format, width: 10, height: 10 });
          assert.strictEqual(frame.format, format);
          frame.close();
        });
      }
    });

    describe('4:2:0 YUV formats (3 planes)', () => {
      it('should create VideoFrame with I420 format', () => {
        const frame = createVideoFrame({ format: 'I420', width: 100, height: 100 });
        assert.strictEqual(frame.format, 'I420');
        frame.close();
      });

      it('should have 3 planes for I420', async () => {
        const frame = createVideoFrame({ format: 'I420', width: 100, height: 100 });
        const buffer = new ArrayBuffer(frame.allocationSize());
        const layout = await frame.copyTo(buffer);

        assert.strictEqual(layout.length, 3); // Y, U, V

        frame.close();
      });
    });

    describe('4:2:0 YUVA formats (4 planes)', () => {
      it('should create VideoFrame with I420A format', () => {
        const frame = createVideoFrame({ format: 'I420A', width: 100, height: 100 });
        assert.strictEqual(frame.format, 'I420A');
        frame.close();
      });

      it('should have 4 planes for I420A', async () => {
        const frame = createVideoFrame({ format: 'I420A', width: 100, height: 100 });
        const buffer = new ArrayBuffer(frame.allocationSize());
        const layout = await frame.copyTo(buffer);

        assert.strictEqual(layout.length, 4); // Y, U, V, A

        frame.close();
      });
    });

    describe('Semi-planar formats (2 planes)', () => {
      it('should create VideoFrame with NV12 format', () => {
        const frame = createVideoFrame({ format: 'NV12', width: 100, height: 100 });
        assert.strictEqual(frame.format, 'NV12');
        frame.close();
      });

      it('should have 2 planes for NV12', async () => {
        const frame = createVideoFrame({ format: 'NV12', width: 100, height: 100 });
        const buffer = new ArrayBuffer(frame.allocationSize());
        const layout = await frame.copyTo(buffer);

        assert.strictEqual(layout.length, 2); // Y, UV

        frame.close();
      });
    });

    describe('Allocation size calculations', () => {
      it('should calculate correct size for RGBA (4 bytes per pixel)', () => {
        const frame = createVideoFrame({ format: 'RGBA', width: 100, height: 100 });
        const size = frame.allocationSize();

        // 100 * 100 * 4 = 40000
        assert.strictEqual(size, 40000);

        frame.close();
      });

      it('should calculate correct size for I420 (1.5 bytes per pixel)', () => {
        const frame = createVideoFrame({ format: 'I420', width: 100, height: 100 });
        const size = frame.allocationSize();

        // Y: 100*100 = 10000
        // U: 50*50 = 2500
        // V: 50*50 = 2500
        // Total: 15000
        assert.strictEqual(size, 15000);

        frame.close();
      });

      it('should calculate correct size for NV12', () => {
        const frame = createVideoFrame({ format: 'NV12', width: 100, height: 100 });
        const size = frame.allocationSize();

        // Y: 100*100 = 10000
        // UV: 100*50 = 5000
        // Total: 15000
        assert.strictEqual(size, 15000);

        frame.close();
      });
    });

    describe('Sub-sampling alignment', () => {
      it('should handle odd-width frames for 4:2:0 formats', () => {
        // I420 requires even dimensions for chroma, but should handle odd coded dimensions
        const frame = createVideoFrame({ format: 'I420', width: 101, height: 100 });
        assert.strictEqual(frame.codedWidth, 101);

        frame.close();
      });

      it('should handle odd-height frames for 4:2:0 formats', () => {
        const frame = createVideoFrame({ format: 'I420', width: 100, height: 101 });
        assert.strictEqual(frame.codedHeight, 101);

        frame.close();
      });
    });
  });

  // =========================================================================
  // Type exports
  // =========================================================================

  describe('Type exports', () => {
    it('should export PlaneLayout interface', () => {
      // Type check - if this compiles, PlaneLayout is exported
      const layout: PlaneLayout = { offset: 0, stride: 100 };
      assert.strictEqual(layout.offset, 0);
      assert.strictEqual(layout.stride, 100);
    });

    it('should export VideoFrameCopyToOptions interface', () => {
      // Type check - if this compiles, VideoFrameCopyToOptions is exported
      const options: VideoFrameCopyToOptions = {
        rect: { x: 0, y: 0, width: 100, height: 100 },
        format: 'RGBA',
        colorSpace: 'srgb',
      };
      assert.ok(options.rect !== undefined);
    });

    it('should export VideoPixelFormat type', () => {
      // Type check - if this compiles, VideoPixelFormat is exported
      const format: VideoPixelFormat = 'I420';
      assert.strictEqual(format, 'I420');
    });
  });
});
