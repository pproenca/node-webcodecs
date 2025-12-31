// test/golden/video-frame-visible-rect.test.ts
import { describe, expect, it } from 'vitest';

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

    expect(frame.visibleRect).toBeDefined();
    expect(frame.visibleRect.x).toBe(0);
    expect(frame.visibleRect.y).toBe(0);
    expect(frame.visibleRect.width).toBe(width);
    expect(frame.visibleRect.height).toBe(height);

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

    expect(frame.visibleRect.x).toBe(10);
    expect(frame.visibleRect.y).toBe(20);
    expect(frame.visibleRect.width).toBe(100);
    expect(frame.visibleRect.height).toBe(80);

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
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(80);
    // DOMRectReadOnly also has right and bottom
    expect(rect.right).toBe(110); // x + width
    expect(rect.bottom).toBe(100); // y + height
    expect(rect.top).toBe(20);
    expect(rect.left).toBe(10);

    frame.close();
  });

  it('should throw when visibleRect exceeds coded dimensions', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);

    expect(() => {
      new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
        visibleRect: { x: 50, y: 50, width: 100, height: 100 }, // Exceeds bounds
      });
    }).toThrow();
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

    expect(frame.visibleRect.width).toBe(100);
    expect(frame.visibleRect.height).toBe(100);
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
    expect(frame.allocationSize()).toBe(10000);

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

    expect(cloned.visibleRect.x).toBe(10);
    expect(cloned.visibleRect.y).toBe(20);
    expect(cloned.visibleRect.width).toBe(30);
    expect(cloned.visibleRect.height).toBe(40);

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
      expect(dest[i]).toBe(255); // R
      expect(dest[i + 1]).toBe(0); // G
      expect(dest[i + 2]).toBe(0); // B
      expect(dest[i + 3]).toBe(255); // A
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
    expect(arrayBuffer.byteLength).toBe(0);

    // Frame should still be usable
    expect(frame.codedWidth).toBe(width);
    expect(frame.codedHeight).toBe(height);

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
    expect(arrayBuffer.byteLength).toBe(width * height * 4);

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

    expect(frame.codedWidth).toBe(width);
    frame.close();
  });

  it('should handle already-detached ArrayBuffer in transfer', () => {
    const width = 4;
    const height = 4;
    const arrayBuffer = new ArrayBuffer(width * height * 4);

    // Pre-detach the buffer
    structuredClone(arrayBuffer, { transfer: [arrayBuffer] });
    expect(arrayBuffer.byteLength).toBe(0);

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

    expect(frame.codedWidth).toBe(width);
    frame.close();
  });
});
