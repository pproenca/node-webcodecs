import { describe, expect, it } from 'vitest';

describe('VideoFrame High Bit-Depth Formats', () => {
  describe('format parsing', () => {
    it('should accept I420P10 format string', () => {
      const width = 64;
      const height = 64;
      // I420P10: Y (w*h*2) + U (w/2 * h/2 * 2) + V (w/2 * h/2 * 2)
      const totalSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;
      const buffer = new ArrayBuffer(totalSize);

      const frame = new VideoFrame(buffer, {
        format: 'I420P10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I420P10');
      frame.close();
    });

    it('should accept I420P12 format string', () => {
      const width = 64;
      const height = 64;
      const totalSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;
      const buffer = new ArrayBuffer(totalSize);

      const frame = new VideoFrame(buffer, {
        format: 'I420P12',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I420P12');
      frame.close();
    });
  });

  describe('allocation size', () => {
    it('should calculate correct size for I420P10 (2 bytes per sample)', () => {
      // I420P10: Y (w*h*2) + U (w/2 * h/2 * 2) + V (w/2 * h/2 * 2)
      const width = 1920;
      const height = 1080;
      const expectedSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;

      // Create frame with exact buffer size
      const buffer = new ArrayBuffer(expectedSize);
      const frame = new VideoFrame(buffer, {
        format: 'I420P10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I420P10');
      expect(frame.allocationSize()).toBe(expectedSize);
      frame.close();
    });

    it('should calculate correct size for I444P12 (no chroma subsampling)', () => {
      // I444P12: Y (w*h*2) + U (w*h*2) + V (w*h*2) = w*h*6
      const width = 1920;
      const height = 1080;
      const expectedSize = width * height * 2 * 3;

      const buffer = new ArrayBuffer(expectedSize);
      const frame = new VideoFrame(buffer, {
        format: 'I444P12',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('I444P12');
      expect(frame.allocationSize()).toBe(expectedSize);
      frame.close();
    });
  });

  describe('copyTo with high bit-depth', () => {
    it('should copy I420P10 frame data correctly', async () => {
      const width = 64;
      const height = 64;
      // I420P10: 2 bytes per sample
      const ySize = width * height * 2;
      const uvSize = (width / 2) * (height / 2) * 2;
      const totalSize = ySize + uvSize * 2;

      // Create source buffer with known pattern
      const sourceBuffer = new ArrayBuffer(totalSize);
      const sourceView = new Uint16Array(sourceBuffer);
      // Fill Y plane with 0x0100 (256 in 10-bit range)
      for (let i = 0; i < ySize / 2; i++) {
        sourceView[i] = 0x0100;
      }
      // Fill U plane with 0x0200
      for (let i = ySize / 2; i < (ySize + uvSize) / 2; i++) {
        sourceView[i] = 0x0200;
      }
      // Fill V plane with 0x0300
      for (let i = (ySize + uvSize) / 2; i < totalSize / 2; i++) {
        sourceView[i] = 0x0300;
      }

      const frame = new VideoFrame(sourceBuffer, {
        format: 'I420P10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      // Copy to destination
      const destBuffer = new ArrayBuffer(totalSize);
      await frame.copyTo(destBuffer);

      const destView = new Uint16Array(destBuffer);
      // Verify Y plane
      expect(destView[0]).toBe(0x0100);
      // Verify U plane
      expect(destView[ySize / 2]).toBe(0x0200);
      // Verify V plane
      expect(destView[(ySize + uvSize) / 2]).toBe(0x0300);

      frame.close();
    });
  });

  describe('PlaneLayout for high bit-depth', () => {
    it('should return correct plane layout for I420P10', async () => {
      const width = 64;
      const height = 64;
      const totalSize = width * height * 2 + (width / 2) * (height / 2) * 2 * 2;
      const buffer = new ArrayBuffer(totalSize);

      const frame = new VideoFrame(buffer, {
        format: 'I420P10',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      const destBuffer = new ArrayBuffer(totalSize);
      const layout = await frame.copyTo(destBuffer);

      expect(layout).toHaveLength(3); // Y, U, V planes

      // Y plane: offset 0, stride = width * 2 bytes
      expect(layout[0].offset).toBe(0);
      expect(layout[0].stride).toBe(width * 2);

      // U plane: offset after Y, stride = (width/2) * 2 bytes
      const ySize = width * height * 2;
      expect(layout[1].offset).toBe(ySize);
      expect(layout[1].stride).toBe((width / 2) * 2);

      // V plane: offset after Y+U
      const uvSize = (width / 2) * (height / 2) * 2;
      expect(layout[2].offset).toBe(ySize + uvSize);
      expect(layout[2].stride).toBe((width / 2) * 2);

      frame.close();
    });
  });

  describe('all high bit-depth formats', () => {
    const formats = [
      { name: 'I420P10', chromaH: 2, chromaV: 2, bitDepth: 10, planes: 3 },
      { name: 'I420P12', chromaH: 2, chromaV: 2, bitDepth: 12, planes: 3 },
      { name: 'I422P10', chromaH: 2, chromaV: 1, bitDepth: 10, planes: 3 },
      { name: 'I422P12', chromaH: 2, chromaV: 1, bitDepth: 12, planes: 3 },
      { name: 'I444P10', chromaH: 1, chromaV: 1, bitDepth: 10, planes: 3 },
      { name: 'I444P12', chromaH: 1, chromaV: 1, bitDepth: 12, planes: 3 },
      { name: 'NV12P10', chromaH: 2, chromaV: 2, bitDepth: 10, planes: 2 },
    ];

    formats.forEach(({ name, chromaH, chromaV, bitDepth, planes }) => {
      it(`should create and copy ${name} frame`, async () => {
        const width = 64;
        const height = 64;
        const bytesPerSample = Math.ceil(bitDepth / 8);

        // Calculate expected size
        const ySize = width * height * bytesPerSample;
        const chromaWidth = width / chromaH;
        const chromaHeight = height / chromaV;
        let totalSize: number;

        if (planes === 2) {
          // Semi-planar (NV12P10)
          totalSize = ySize + chromaWidth * 2 * chromaHeight * bytesPerSample;
        } else {
          totalSize = ySize + chromaWidth * chromaHeight * bytesPerSample * 2;
        }

        const buffer = new ArrayBuffer(totalSize);
        const frame = new VideoFrame(buffer, {
          format: name as VideoPixelFormat,
          codedWidth: width,
          codedHeight: height,
          timestamp: 0,
        });

        expect(frame.format).toBe(name);
        expect(frame.codedWidth).toBe(width);
        expect(frame.codedHeight).toBe(height);

        // Verify copyTo works
        const destBuffer = new ArrayBuffer(totalSize);
        const layout = await frame.copyTo(destBuffer);
        expect(layout).toHaveLength(planes);

        frame.close();
      });
    });
  });
});
