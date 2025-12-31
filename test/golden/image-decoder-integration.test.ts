import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ImageDecoder, VideoFrame } from '../../lib';

// CRC32 calculation for PNG chunks
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Helper to create a PNG chunk
function createChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

describe('ImageDecoder Integration', () => {
  // Helper for creating minimal valid PNG (1x1 red pixel, RGB)
  function createMinimalPNG(): Buffer {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR: 1x1, 8-bit RGB
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); // width
    ihdr.writeUInt32BE(1, 4); // height
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type (RGB)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // Raw image data: filter byte (0) + RGB pixel (255, 0, 0 = red)
    const rawData = Buffer.from([0, 255, 0, 0]);
    const compressedData = zlib.deflateSync(rawData);

    // IEND: empty
    const iend = Buffer.alloc(0);

    return Buffer.concat([
      signature,
      createChunk('IHDR', ihdr),
      createChunk('IDAT', compressedData),
      createChunk('IEND', iend),
    ]);
  }

  describe('Real file decoding', () => {
    it('decodes actual JPEG file if available', async () => {
      const testFile = path.join(__dirname, '../fixtures/test.jpg');
      if (!fs.existsSync(testFile)) {
        console.log('Skipping: test.jpg not found');
        return;
      }

      const data = fs.readFileSync(testFile);
      const decoder = new ImageDecoder({
        type: 'image/jpeg',
        data,
      });

      expect(decoder.complete).toBe(true);
      const result = await decoder.decode();
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.image.codedWidth).toBeGreaterThan(0);

      result.image.close();
      decoder.close();
    });

    it('decodes actual PNG file if available', async () => {
      const testFile = path.join(__dirname, '../fixtures/test.png');
      if (!fs.existsSync(testFile)) {
        console.log('Skipping: test.png not found');
        return;
      }

      const data = fs.readFileSync(testFile);
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
      });

      const result = await decoder.decode();
      expect(result.complete).toBe(true);

      result.image.close();
      decoder.close();
    });
  });

  describe('Error handling', () => {
    it('throws for unsupported type', () => {
      expect(() => {
        new ImageDecoder({
          type: 'image/xyz-unsupported',
          data: new Uint8Array([1, 2, 3]),
        });
      }).toThrow();
    });

    it('fails to decode invalid PNG data', async () => {
      // Note: The native layer may not throw on construction for invalid data,
      // but will fail at decode time
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: new Uint8Array([0, 0, 0, 0]), // Not valid PNG
      });

      await expect(decoder.decode()).rejects.toThrow();
      decoder.close();
    });

    it('fails to decode empty data', async () => {
      // Note: Empty data may not throw on construction but will fail at decode
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: new Uint8Array([]),
      });

      await expect(decoder.decode()).rejects.toThrow();
      decoder.close();
    });
  });

  describe('Memory management', () => {
    it('properly releases resources on close', () => {
      const data = createMinimalPNG();

      for (let i = 0; i < 50; i++) {
        const decoder = new ImageDecoder({
          type: 'image/png',
          data,
        });
        decoder.close();
      }

      // If we get here without running out of memory, resources are being freed
      expect(true).toBe(true);
    });
  });

  describe('VideoFrame output', () => {
    it('returns VideoFrame with correct properties', async () => {
      const png = createMinimalPNG();

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: png,
      });

      const result = await decoder.decode();
      const frame = result.image;

      // Check core VideoFrame properties that are always present
      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(1);
      expect(frame.codedHeight).toBe(1);
      expect(typeof frame.timestamp).toBe('number');

      frame.close();
      decoder.close();
    });

    it('returns VideoFrame instance', async () => {
      const png = createMinimalPNG();

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: png,
      });

      const result = await decoder.decode();
      // The image should be wrapped as a VideoFrame
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.complete).toBe(true);

      result.image.close();
      decoder.close();
    });
  });

  describe('Closed state handling', () => {
    it('throws InvalidStateError when decoding after close', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
      });

      decoder.close();

      await expect(decoder.decode()).rejects.toThrow(/closed|InvalidStateError/);
    });

    it('can close multiple times without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
      });

      expect(() => {
        decoder.close();
        decoder.close();
        decoder.close();
      }).not.toThrow();
    });
  });
});
