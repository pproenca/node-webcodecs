// test/unit/video-frame.test.ts
// Tests for W3C WebCodecs spec section 9.4 - VideoFrame Interface

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoColorSpace, VideoFrame, type VideoPixelFormat } from '../../lib';

/**
 * Tests for VideoFrame per W3C WebCodecs spec section 9.4.
 * Covers constructor, attributes, methods, and error handling.
 */

describe('VideoFrame: 9.4', () => {
  // Helper to create valid VideoFrame
  function createVideoFrame(overrides?: {
    width?: number;
    height?: number;
    timestamp?: number;
    format?: VideoPixelFormat;
  }): VideoFrame {
    const width = overrides?.width ?? 640;
    const height = overrides?.height ?? 480;
    const format = overrides?.format ?? 'RGBA';
    const timestamp = overrides?.timestamp ?? 0;

    // Calculate buffer size based on format
    let bufferSize: number;
    if (format === 'RGBA' || format === 'RGBX' || format === 'BGRA' || format === 'BGRX') {
      bufferSize = width * height * 4;
    } else if (format === 'I420') {
      bufferSize = width * height + (width * height) / 2;
    } else if (format === 'NV12') {
      bufferSize = width * height + (width * height) / 2;
    } else {
      bufferSize = width * height * 4; // default
    }

    const data = Buffer.alloc(bufferSize);
    data.fill(0x42); // Recognizable pattern

    return new VideoFrame(data, {
      codedWidth: width,
      codedHeight: height,
      timestamp,
      format,
    });
  }

  describe('9.4.2 Constructor', () => {
    // Spec 9.4.2: Constructor with buffer and init
    it('should construct with valid buffer and init', () => {
      const data = Buffer.alloc(640 * 480 * 4);
      const frame = new VideoFrame(data, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.ok(frame instanceof VideoFrame);
      assert.strictEqual(frame.codedWidth, 640);
      assert.strictEqual(frame.codedHeight, 480);

      frame.close();
    });

    it('should accept ArrayBuffer as data', () => {
      const buffer = new ArrayBuffer(640 * 480 * 4);
      const frame = new VideoFrame(Buffer.from(buffer), {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.ok(frame instanceof VideoFrame);
      frame.close();
    });

    it('should accept Uint8Array as data', () => {
      const data = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(data, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.ok(frame instanceof VideoFrame);
      frame.close();
    });

    // Spec 9.4.2: timestamp is required
    it('should require timestamp', () => {
      const data = Buffer.alloc(640 * 480 * 4);

      assert.throws(
        () =>
          new VideoFrame(data, {
            codedWidth: 640,
            codedHeight: 480,
            format: 'RGBA',
            timestamp: undefined as unknown as number,
          }),
        /Error|TypeError/,
      );
    });

    // Spec 9.4.2: duration is optional
    it('should accept optional duration', () => {
      const frame = new VideoFrame(Buffer.alloc(640 * 480 * 4), {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        duration: 33333, // ~30fps
        format: 'RGBA',
      });

      assert.strictEqual(frame.duration, 33333);
      frame.close();
    });

    // Spec 9.4.2: format is required for buffer constructor
    it('should require format for buffer constructor', () => {
      const data = Buffer.alloc(640 * 480 * 4);

      assert.throws(
        () =>
          new VideoFrame(data, {
            codedWidth: 640,
            codedHeight: 480,
            timestamp: 0,
            format: undefined as unknown as VideoPixelFormat,
          }),
        /Error|TypeError/,
      );
    });

    // Construct from existing VideoFrame
    it('should construct from existing VideoFrame', async () => {
      const original = createVideoFrame({ timestamp: 12345 });
      const fromFrame = new VideoFrame(original);

      assert.ok(fromFrame instanceof VideoFrame);
      assert.strictEqual(fromFrame.codedWidth, original.codedWidth);
      assert.strictEqual(fromFrame.codedHeight, original.codedHeight);
      assert.strictEqual(fromFrame.timestamp, original.timestamp);

      original.close();
      fromFrame.close();
    });

    it('should allow timestamp override when constructing from VideoFrame', () => {
      const original = createVideoFrame({ timestamp: 0 });
      const withOverride = new VideoFrame(original, { timestamp: 99999 });

      assert.strictEqual(original.timestamp, 0);
      assert.strictEqual(withOverride.timestamp, 99999);

      original.close();
      withOverride.close();
    });
  });

  describe('9.4.3 Attributes', () => {
    // Spec 9.4.3: format attribute
    it('should have format attribute', () => {
      const frame = createVideoFrame({ format: 'RGBA' });
      assert.strictEqual(frame.format, 'RGBA');
      frame.close();
    });

    it('should support I420 format', () => {
      const width = 640;
      const height = 480;
      // I420: Y plane + U plane (1/4) + V plane (1/4)
      const bufferSize = width * height + (width * height) / 2;
      const frame = new VideoFrame(Buffer.alloc(bufferSize), {
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        format: 'I420',
      });
      assert.strictEqual(frame.format, 'I420');
      frame.close();
    });

    it('should support NV12 format', () => {
      const width = 640;
      const height = 480;
      // NV12: Y plane + interleaved UV plane
      const bufferSize = width * height + (width * height) / 2;
      const frame = new VideoFrame(Buffer.alloc(bufferSize), {
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        format: 'NV12',
      });
      assert.strictEqual(frame.format, 'NV12');
      frame.close();
    });

    // Spec 9.4.3: codedWidth/codedHeight attributes
    it('should have codedWidth and codedHeight', () => {
      const frame = createVideoFrame({ width: 1920, height: 1080 });
      assert.strictEqual(frame.codedWidth, 1920);
      assert.strictEqual(frame.codedHeight, 1080);
      frame.close();
    });

    // Spec 9.4.3: codedRect attribute
    it('should have codedRect matching dimensions', () => {
      const frame = createVideoFrame({ width: 640, height: 480 });
      const rect = frame.codedRect;

      assert.ok(rect !== null);
      assert.strictEqual(rect?.x, 0);
      assert.strictEqual(rect?.y, 0);
      assert.strictEqual(rect?.width, 640);
      assert.strictEqual(rect?.height, 480);

      frame.close();
    });

    // Spec 9.4.3: visibleRect defaults to full frame
    it('should have visibleRect defaulting to full frame', () => {
      const frame = createVideoFrame({ width: 640, height: 480 });
      const rect = frame.visibleRect;

      assert.ok(rect !== null);
      assert.strictEqual(rect?.width, 640);
      assert.strictEqual(rect?.height, 480);

      frame.close();
    });

    // Spec 9.4.3: displayWidth/displayHeight for aspect ratio
    it('should have displayWidth and displayHeight', () => {
      const frame = createVideoFrame({ width: 640, height: 480 });
      assert.strictEqual(frame.displayWidth, 640);
      assert.strictEqual(frame.displayHeight, 480);
      frame.close();
    });

    // Spec 9.4.3: timestamp in microseconds
    it('should have timestamp in microseconds', () => {
      const frame = createVideoFrame({ timestamp: 1000000 }); // 1 second
      assert.strictEqual(frame.timestamp, 1000000);
      frame.close();
    });

    it('should support negative timestamp', () => {
      const frame = createVideoFrame({ timestamp: -5000 });
      assert.strictEqual(frame.timestamp, -5000);
      frame.close();
    });

    // Spec 9.4.3: duration nullable
    it('should have null duration when not provided', () => {
      const frame = createVideoFrame();
      assert.strictEqual(frame.duration, null);
      frame.close();
    });

    // Spec 9.4.3: colorSpace attribute
    it('should have colorSpace attribute', () => {
      const frame = createVideoFrame();
      const colorSpace = frame.colorSpace;

      assert.ok(colorSpace instanceof VideoColorSpace);

      frame.close();
    });

    // Spec 9.4.3: rotation attribute
    it('should have rotation attribute defaulting to 0', () => {
      const frame = createVideoFrame();
      assert.strictEqual(frame.rotation, 0);
      frame.close();
    });

    // Spec 9.4.3: flip attribute
    it('should have flip attribute defaulting to false', () => {
      const frame = createVideoFrame();
      assert.strictEqual(frame.flip, false);
      frame.close();
    });
  });

  describe('9.4.5 allocationSize Method', () => {
    // Spec 9.4.5: allocationSize returns minimum bytes needed
    it('should return correct allocation size for RGBA format', () => {
      const frame = createVideoFrame({ width: 640, height: 480, format: 'RGBA' });
      const size = frame.allocationSize();

      // RGBA: 4 bytes per pixel
      assert.strictEqual(size, 640 * 480 * 4);

      frame.close();
    });

    it('should return correct allocation size for I420 format', () => {
      const width = 640;
      const height = 480;
      const bufferSize = width * height + (width * height) / 2;
      const frame = new VideoFrame(Buffer.alloc(bufferSize), {
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        format: 'I420',
      });

      const size = frame.allocationSize();
      // I420: Y (640*480) + U (320*240) + V (320*240) = 460800
      assert.strictEqual(size, width * height + (width * height) / 2);

      frame.close();
    });

    // Spec 9.4.5: InvalidStateError if closed
    it('should throw InvalidStateError if called after close', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.throws(
        () => frame.allocationSize(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('9.4.5 copyTo Method', () => {
    // Spec 9.4.5: copyTo copies pixel data
    it('should copy pixel data to destination', async () => {
      const sourceData = Buffer.alloc(4 * 4 * 4); // 4x4 RGBA
      sourceData.fill(0x42);

      const frame = new VideoFrame(sourceData, {
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 0,
        format: 'RGBA',
      });

      const dest = new Uint8Array(frame.allocationSize());
      await frame.copyTo(dest);

      // Verify data was copied
      assert.strictEqual(dest[0], 0x42);
      assert.strictEqual(dest[dest.length - 1], 0x42);

      frame.close();
    });

    // Spec 9.4.5: copyTo returns Promise with PlaneLayout[]
    it('should return PlaneLayout array from copyTo', async () => {
      const frame = createVideoFrame({ width: 64, height: 64 });
      const dest = new Uint8Array(frame.allocationSize());

      const layouts = await frame.copyTo(dest);

      assert.ok(Array.isArray(layouts));
      assert.ok(layouts.length > 0);

      // Each layout should have offset and stride
      for (const layout of layouts) {
        assert.strictEqual(typeof layout.offset, 'number');
        assert.strictEqual(typeof layout.stride, 'number');
      }

      frame.close();
    });

    // Spec 9.4.5: InvalidStateError if closed
    it('should reject if called after close', async () => {
      const frame = createVideoFrame();
      frame.close();

      const dest = new Uint8Array(640 * 480 * 4);

      await assert.rejects(
        async () => frame.copyTo(dest),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    // Spec 9.4.5: RangeError if destination too small
    it('should throw if destination buffer too small', async () => {
      const frame = createVideoFrame();
      const dest = new Uint8Array(10); // Way too small

      await assert.rejects(
        async () => frame.copyTo(dest),
        RangeError,
      );

      frame.close();
    });
  });

  describe('9.4.5 clone Method', () => {
    // Spec 9.4.5: clone creates new VideoFrame
    it('should create new VideoFrame via clone', () => {
      const original = createVideoFrame();
      const cloned = original.clone();

      assert.ok(cloned instanceof VideoFrame);
      assert.notStrictEqual(original, cloned);

      original.close();
      cloned.close();
    });

    // Spec 9.4.5: clone shares resource
    it('should share pixel data between original and clone', async () => {
      const original = createVideoFrame({ width: 64, height: 64 });
      const cloned = original.clone();

      const origDest = new Uint8Array(original.allocationSize());
      const cloneDest = new Uint8Array(cloned.allocationSize());

      await original.copyTo(origDest);
      await cloned.copyTo(cloneDest);

      assert.deepStrictEqual([...origDest], [...cloneDest]);

      original.close();
      cloned.close();
    });

    // Spec 9.4.5: clone throws InvalidStateError if closed
    it('should throw InvalidStateError when cloning closed VideoFrame', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.throws(
        () => frame.clone(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('9.4.5 close Method', () => {
    // Spec 9.4.5: close releases resources
    it('should mark VideoFrame as closed', () => {
      const frame = createVideoFrame();
      frame.close();
      assert.strictEqual(frame.format, null);
    });

    // Spec 9.4.5: close is idempotent
    it('should allow double close without error', () => {
      const frame = createVideoFrame();
      frame.close();
      assert.doesNotThrow(() => {
        frame.close();
      });
    });

    // Spec 9.4.5: attributes return defaults after close
    it('should return default values after close', () => {
      const frame = createVideoFrame({ timestamp: 12345 });
      frame.close();

      assert.strictEqual(frame.format, null);
      assert.strictEqual(frame.codedWidth, 0);
      assert.strictEqual(frame.codedHeight, 0);
      assert.strictEqual(frame.displayWidth, 0);
      assert.strictEqual(frame.displayHeight, 0);
      assert.strictEqual(frame.timestamp, 0);
      assert.strictEqual(frame.duration, null);
      assert.strictEqual(frame.codedRect, null);
      assert.strictEqual(frame.visibleRect, null);
    });
  });

  describe('9.4.5 metadata Method', () => {
    // Spec 9.4.5: metadata returns VideoFrameMetadata
    it('should return metadata object', () => {
      const frame = new VideoFrame(Buffer.alloc(640 * 480 * 4), {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
        metadata: { someKey: 'someValue' },
      });

      const metadata = frame.metadata();
      assert.ok(typeof metadata === 'object');

      frame.close();
    });

    // Spec 9.4.5: metadata throws InvalidStateError if closed
    it('should throw InvalidStateError if called after close', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.throws(
        () => frame.metadata(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('Edge cases', () => {
    // Large frame (4K)
    it('should handle 4K resolution frames', async () => {
      const width = 3840;
      const height = 2160;
      const frame = new VideoFrame(Buffer.alloc(width * height * 4), {
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.strictEqual(frame.codedWidth, 3840);
      assert.strictEqual(frame.codedHeight, 2160);

      const size = frame.allocationSize();
      assert.strictEqual(size, width * height * 4);

      frame.close();
    });

    // Small frame (1x1)
    it('should handle 1x1 pixel frame', async () => {
      const frame = new VideoFrame(Buffer.alloc(4), {
        codedWidth: 1,
        codedHeight: 1,
        timestamp: 0,
        format: 'RGBA',
      });

      assert.strictEqual(frame.codedWidth, 1);
      assert.strictEqual(frame.codedHeight, 1);

      const dest = new Uint8Array(4);
      await frame.copyTo(dest);

      frame.close();
    });

    // Timestamp precision
    it('should preserve microsecond timestamp precision', () => {
      const timestamp = 12345678901;
      const frame = createVideoFrame({ timestamp });
      assert.strictEqual(frame.timestamp, timestamp);
      frame.close();
    });
  });

  describe('Type exports', () => {
    it('should export VideoFrame class', () => {
      assert.strictEqual(typeof VideoFrame, 'function');
    });

    it('should export VideoColorSpace class', () => {
      assert.strictEqual(typeof VideoColorSpace, 'function');
    });
  });
});
