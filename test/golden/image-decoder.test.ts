/**
 * Tests for ImageDecoder W3C compliance
 */

import {describe, it, expect} from 'vitest';
import * as zlib from 'zlib';

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

// Helper to create minimal test images
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

describe('ImageDecoder', () => {
  describe('constructor', () => {
    it('creates decoder with valid PNG data', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(decoder.type).toBe('image/png');
      expect(decoder.complete).toBe(true);
      decoder.close();
    });

    it('throws TypeError for missing type', () => {
      expect(() => {
        new ImageDecoder({
          data: new Uint8Array([]),
        } as any);
      }).toThrow(TypeError);
    });

    it('throws TypeError for missing data', () => {
      expect(() => {
        new ImageDecoder({
          type: 'image/png',
        } as any);
      }).toThrow(TypeError);
    });
  });

  describe('static isTypeSupported', () => {
    it('returns true for supported types', async () => {
      expect(await ImageDecoder.isTypeSupported('image/png')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/jpeg')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/gif')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/webp')).toBe(true);
    });

    it('returns false for unsupported types', async () => {
      expect(await ImageDecoder.isTypeSupported('image/unknown')).toBe(false);
      expect(await ImageDecoder.isTypeSupported('video/mp4')).toBe(false);
    });
  });

  describe('tracks property', () => {
    it('returns ImageTrackList with correct structure', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      expect(tracks.length).toBe(1);
      expect(tracks.selectedIndex).toBe(0);
      expect(tracks.selectedTrack).not.toBeNull();
      expect(tracks[0]).toBeDefined();

      const track = tracks[0];
      expect(track.animated).toBe(false);
      expect(track.frameCount).toBe(1);
      expect(typeof track.repetitionCount).toBe('number');
      expect(track.selected).toBe(true);

      decoder.close();
    });

    it('tracks.ready resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      await expect(decoder.tracks.ready).resolves.toBeUndefined();
      decoder.close();
    });
  });

  describe('decode method', () => {
    it('decodes static image and returns VideoFrame', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.decode();
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.complete).toBe(true);
      expect(result.image.codedWidth).toBeGreaterThan(0);
      expect(result.image.codedHeight).toBeGreaterThan(0);

      result.image.close();
      decoder.close();
    });

    it('respects frameIndex option', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.decode({frameIndex: 0});
      expect(result.complete).toBe(true);

      result.image.close();
      decoder.close();
    });

    it('throws InvalidStateError when closed', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      decoder.close();

      await expect(decoder.decode()).rejects.toThrow(/closed|InvalidStateError/);
    });
  });

  describe('completed property', () => {
    it('resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      await expect(decoder.completed).resolves.toBeUndefined();
      decoder.close();
    });
  });

  describe('close method', () => {
    it('can be called multiple times without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(() => {
        decoder.close();
        decoder.close();
        decoder.close();
      }).not.toThrow();
    });
  });

  describe('reset method', () => {
    it('can be called without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(() => decoder.reset()).not.toThrow();
      decoder.close();
    });
  });
});
