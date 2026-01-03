// test/golden/video-frame-visible-rect.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame visibleRect', () => {
  it('should return default visibleRect equal to codedRect when not specified', () => {
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 4); // RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    assert.notStrictEqual(frame.visibleRect, undefined);
    assert.strictEqual(frame.visibleRect.x, 0);
    assert.strictEqual(frame.visibleRect.y, 0);
    assert.strictEqual(frame.visibleRect.width, width);
    assert.strictEqual(frame.visibleRect.height, height);

    frame.close();
  });

  it('should store custom visibleRect from init options', () => {
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 4); // RGBA
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 10, y: 20, width: 100, height: 80 },
    });

    assert.strictEqual(frame.visibleRect.x, 10);
    assert.strictEqual(frame.visibleRect.y, 20);
    assert.strictEqual(frame.visibleRect.width, 100);
    assert.strictEqual(frame.visibleRect.height, 80);

    frame.close();
  });

  it('should return DOMRectReadOnly-like object from visibleRect getter', () => {
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 10, y: 20, width: 100, height: 80 },
    });

    const rect = frame.visibleRect;
    assert.strictEqual(rect.x, 10);
    assert.strictEqual(rect.y, 20);
    assert.strictEqual(rect.width, 100);
    assert.strictEqual(rect.height, 80);
    // DOMRectReadOnly also has right and bottom
    assert.strictEqual(rect.right, 110); // x + width
    assert.strictEqual(rect.bottom, 100); // y + height
    assert.strictEqual(rect.top, 20);
    assert.strictEqual(rect.left, 10);

    frame.close();
  });

  it('should throw when visibleRect exceeds coded dimensions', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    assert.throws(() => {
      new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        visibleRect: { x: 50, y: 50, width: 100, height: 100 }, // Exceeds bounds
      });
    });
  });

  it('should handle visibleRect at frame boundary', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 0, y: 0, width: 100, height: 100 }, // Exact match
    });

    assert.strictEqual(frame.visibleRect.width, 100);
    assert.strictEqual(frame.visibleRect.height, 100);
    frame.close();
  });

  it('should calculate allocationSize based on visible dimensions', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 0, y: 0, width: 50, height: 50 },
    });

    // RGBA: 50 * 50 * 4 = 10000 bytes
    assert.strictEqual(frame.allocationSize(), 10000);

    frame.close();
  });

  it('should preserve visibleRect through clone', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 10, y: 20, width: 30, height: 40 },
    });

    const cloned = frame.clone();

    assert.strictEqual(cloned.visibleRect.x, 10);
    assert.strictEqual(cloned.visibleRect.y, 20);
    assert.strictEqual(cloned.visibleRect.width, 30);
    assert.strictEqual(cloned.visibleRect.height, 40);

    frame.close();
    cloned.close();
  });
});

describe('VideoFrame copyTo with visibleRect', () => {
  it('should copy only the visible region when visibleRect is set', async () => {
    // Create a 4x4 RGBA frame with distinct colors in each quadrant
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    // Fill with pattern: top-left=red, top-right=green, bottom-left=blue, bottom-right=white
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x < 2 && y < 2) {
          data[idx] = 255;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255; // Red
        } else if (x >= 2 && y < 2) {
          data[idx] = 0;
          data[idx + 1] = 255;
          data[idx + 2] = 0;
          data[idx + 3] = 255; // Green
        } else if (x < 2 && y >= 2) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 255;
          data[idx + 3] = 255; // Blue
        } else {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255; // White
        }
      }
    }

    // Create frame with visibleRect = top-left quadrant only
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      visibleRect: { x: 0, y: 0, width: 2, height: 2 },
    });

    // Copy to buffer sized for visible region
    const destSize = 2 * 2 * 4; // 2x2 RGBA
    const dest = new Uint8Array(destSize);
    await frame.copyTo(dest);

    // All pixels should be red (the top-left quadrant)
    for (let i = 0; i < destSize; i += 4) {
      assert.strictEqual(dest[i], 255); // R
      assert.strictEqual(dest[i + 1], 0); // G
      assert.strictEqual(dest[i + 2], 0); // B
      assert.strictEqual(dest[i + 3], 255); // A
    }

    frame.close();
  });
});

describe('VideoFrame ArrayBuffer transfer', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);
    const data = new Uint8Array(arrayBuffer);
    data.fill(128); // Fill with gray

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [arrayBuffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    assert.strictEqual(arrayBuffer.byteLength, 0);

    // Frame should still be usable
    assert.strictEqual(frame.codedWidth, width);
    assert.strictEqual(frame.codedHeight, height);

    frame.close();
  });

  it('should work normally when transfer is not specified', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);
    const data = new Uint8Array(arrayBuffer);
    data.fill(128);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      // No transfer specified
    });

    // ArrayBuffer should NOT be detached
    assert.strictEqual(arrayBuffer.byteLength, width * height * 4);

    frame.close();
  });

  it('should handle empty transfer array', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [], // Empty array
    });

    assert.strictEqual(frame.codedWidth, width);
    frame.close();
  });

  it('should handle already-detached ArrayBuffer in transfer', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);

    // Pre-detach the buffer
    structuredClone(arrayBuffer, { transfer: [arrayBuffer] });
    assert.strictEqual(arrayBuffer.byteLength, 0);

    // Create new data for the frame
    const newBuffer = new ArrayBuffer(width * height * 4);
    const newData = new Uint8Array(newBuffer);

    // Should not throw when transfer includes already-detached buffer
    const frame = new VideoFrame(newData, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
      transfer: [arrayBuffer], // Already detached
    });

    assert.strictEqual(frame.codedWidth, width);
    frame.close();
  });
});
