import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame.copyTo() with rect option', () => {
  it('should copy only the specified rect region', async () => {
    // Create a 4x4 RGBA frame with distinct colors
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    // Fill: top-left=red, top-right=green, bottom-left=blue, bottom-right=white
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

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Copy only the top-right quadrant (green)
    const destSize = 2 * 2 * 4;
    const dest = new Uint8Array(destSize);

    await frame.copyTo(dest, { rect: { x: 2, y: 0, width: 2, height: 2 } });

    // All pixels should be green
    for (let i = 0; i < destSize; i += 4) {
      assert.strictEqual(dest[i], 0); // R
      assert.strictEqual(dest[i + 1], 255); // G
      assert.strictEqual(dest[i + 2], 0); // B
      assert.strictEqual(dest[i + 3], 255); // A
    }

    frame.close();
  });

  it('should throw when rect exceeds frame bounds', async () => {
    const data = new Uint8Array(100 * 100 * 4);
    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 100,
      codedHeight: 100,
      timestamp: 0,
    });

    const dest = new Uint8Array(50 * 50 * 4);

    await assert.rejects(
      frame.copyTo(dest, { rect: { x: 80, y: 80, width: 50, height: 50 } }),
    );

    frame.close();
  });
});

describe('VideoFrame.copyTo() with layout option', () => {
  it('should use custom layout when provided', async () => {
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    data.fill(128);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Custom layout with stride = width * 4 + 16 (padding)
    const stride = width * 4 + 16;
    const destSize = stride * height;
    const dest = new Uint8Array(destSize);

    const layouts = await frame.copyTo(dest, {
      layout: [{ offset: 0, stride: stride }],
    });

    // Verify returned layout matches what we requested
    assert.strictEqual(layouts.length, 1);
    assert.strictEqual(layouts[0].stride, stride);

    frame.close();
  });
});
