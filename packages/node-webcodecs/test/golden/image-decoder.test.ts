/**
 * Tests for ImageDecoder W3C compliance
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as zlib from 'node:zlib';

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

// Helper to create a minimal animated GIF (2 frames, 1x1 pixel each)
function createAnimatedGIF(loopCount = 0): Buffer {
  // GIF89a header
  const header = Buffer.from([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61, // "GIF89a"
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x80, // Global color table flag, 2 colors
    0x00, // Background color index
    0x00, // Pixel aspect ratio
  ]);

  // Global Color Table (2 colors: red and blue)
  const colorTable = Buffer.from([
    0xff,
    0x00,
    0x00, // Red
    0x00,
    0x00,
    0xff, // Blue
  ]);

  // NETSCAPE2.0 Application Extension for looping
  const netscapeExt = Buffer.from([
    0x21,
    0xff, // Application Extension
    0x0b, // Block size
    0x4e,
    0x45,
    0x54,
    0x53,
    0x43,
    0x41,
    0x50,
    0x45, // "NETSCAPE"
    0x32,
    0x2e,
    0x30, // "2.0"
    0x03, // Sub-block size
    0x01, // Sub-block ID
    loopCount & 0xff, // Loop count low byte
    (loopCount >> 8) & 0xff, // Loop count high byte
    0x00, // Block terminator
  ]);

  // Frame 1: Red pixel
  const frame1 = Buffer.from([
    0x21,
    0xf9, // Graphic Control Extension
    0x04, // Block size
    0x00, // Disposal method, no transparency
    0x0a,
    0x00, // Delay time: 10 (100ms)
    0x00, // Transparent color index
    0x00, // Block terminator
    0x2c, // Image Descriptor
    0x00,
    0x00, // Left position
    0x00,
    0x00, // Top position
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x00, // No local color table
    0x02, // LZW minimum code size
    0x02, // Block size
    0x44,
    0x01, // LZW data for color index 0
    0x00, // Block terminator
  ]);

  // Frame 2: Blue pixel
  const frame2 = Buffer.from([
    0x21,
    0xf9, // Graphic Control Extension
    0x04, // Block size
    0x00, // Disposal method, no transparency
    0x0a,
    0x00, // Delay time: 10 (100ms)
    0x00, // Transparent color index
    0x00, // Block terminator
    0x2c, // Image Descriptor
    0x00,
    0x00, // Left position
    0x00,
    0x00, // Top position
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x00, // No local color table
    0x02, // LZW minimum code size
    0x02, // Block size
    0x44,
    0x51, // LZW data for color index 1
    0x00, // Block terminator
  ]);

  // Trailer
  const trailer = Buffer.from([0x3b]);

  return Buffer.concat([header, colorTable, netscapeExt, frame1, frame2, trailer]);
}

// Helper to create a static GIF (single frame, 1x1 pixel)
function createStaticGIF(): Buffer {
  // GIF89a header
  const header = Buffer.from([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61, // "GIF89a"
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x80, // Global color table flag, 2 colors
    0x00, // Background color index
    0x00, // Pixel aspect ratio
  ]);

  // Global Color Table (2 colors)
  const colorTable = Buffer.from([
    0xff,
    0x00,
    0x00, // Red
    0x00,
    0x00,
    0x00, // Black
  ]);

  // Single frame: Red pixel
  const frame = Buffer.from([
    0x2c, // Image Descriptor
    0x00,
    0x00, // Left position
    0x00,
    0x00, // Top position
    0x01,
    0x00, // Width: 1
    0x01,
    0x00, // Height: 1
    0x00, // No local color table
    0x02, // LZW minimum code size
    0x02, // Block size
    0x44,
    0x01, // LZW data for color index 0
    0x00, // Block terminator
  ]);

  // Trailer
  const trailer = Buffer.from([0x3b]);

  return Buffer.concat([header, colorTable, frame, trailer]);
}

describe('ImageDecoder', () => {
  describe('constructor', () => {
    it('creates decoder with valid PNG data', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      assert.strictEqual(decoder.type, 'image/png');
      assert.strictEqual(decoder.complete, true);
      decoder.close();
    });

    it('throws TypeError for missing type', () => {
      assert.throws(() => {
        new ImageDecoder({
          data: new Uint8Array([]),
        } as any);
      }, TypeError);
    });

    it('throws TypeError for missing data', () => {
      assert.throws(() => {
        new ImageDecoder({
          type: 'image/png',
        } as any);
      }, TypeError);
    });
  });

  describe('static isTypeSupported', () => {
    it('returns true for supported types', async () => {
      assert.strictEqual(await ImageDecoder.isTypeSupported('image/png'), true);
      assert.strictEqual(await ImageDecoder.isTypeSupported('image/jpeg'), true);
      assert.strictEqual(await ImageDecoder.isTypeSupported('image/gif'), true);
      assert.strictEqual(await ImageDecoder.isTypeSupported('image/webp'), true);
    });

    it('returns false for unsupported types', async () => {
      assert.strictEqual(await ImageDecoder.isTypeSupported('image/unknown'), false);
      assert.strictEqual(await ImageDecoder.isTypeSupported('video/mp4'), false);
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
      assert.strictEqual(tracks.length, 1);
      assert.strictEqual(tracks.selectedIndex, 0);
      assert.notStrictEqual(tracks.selectedTrack, null);
      assert.notStrictEqual(tracks[0], undefined);

      const track = tracks[0];
      assert.strictEqual(track.animated, false);
      assert.strictEqual(track.frameCount, 1);
      assert.strictEqual(typeof track.repetitionCount, 'number');
      assert.strictEqual(track.selected, true);

      decoder.close();
    });

    it('tracks.ready resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.tracks.ready;
      assert.strictEqual(result, undefined);
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
      assert.ok(result.image instanceof VideoFrame);
      assert.strictEqual(result.complete, true);
      assert.ok(result.image.codedWidth > 0);
      assert.ok(result.image.codedHeight > 0);

      result.image.close();
      decoder.close();
    });

    it('respects frameIndex option', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.decode({ frameIndex: 0 });
      assert.strictEqual(result.complete, true);

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

      await assert.rejects(decoder.decode(), /closed|InvalidStateError/);
    });
  });

  describe('completed property', () => {
    it('resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.completed;
      assert.strictEqual(result, undefined);
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

      assert.doesNotThrow(() => {
        decoder.close();
        decoder.close();
        decoder.close();
      });
    });
  });

  describe('reset method', () => {
    it('can be called without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      assert.doesNotThrow(() => decoder.reset());
      decoder.close();
    });
  });

  describe('Animated Images', () => {
    it('detects animated GIF with multiple frames', async () => {
      const data = createAnimatedGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      assert.strictEqual(track.animated, true);
      assert.ok(track.frameCount > 1);

      decoder.close();
    });

    it('detects static GIF as not animated', async () => {
      const data = createStaticGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      assert.strictEqual(track.animated, false);
      assert.strictEqual(track.frameCount, 1);

      decoder.close();
    });

    it('decodes first frame by default', async () => {
      const data = createAnimatedGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const result = await decoder.decode();
      assert.ok(result.image instanceof VideoFrame);
      assert.strictEqual(result.complete, true);

      result.image.close();
      decoder.close();
    });

    it('decodes specific frame by index', async () => {
      const data = createAnimatedGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      // Decode frame 0
      const result0 = await decoder.decode({ frameIndex: 0 });
      assert.ok(result0.image instanceof VideoFrame);
      result0.image.close();

      // Decode frame 1
      const result1 = await decoder.decode({ frameIndex: 1 });
      assert.ok(result1.image instanceof VideoFrame);
      result1.image.close();

      decoder.close();
    });

    it('throws RangeError for invalid frame index', async () => {
      const data = createAnimatedGIF(); // 2 frames
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      await assert.rejects(decoder.decode({ frameIndex: 99 }), /RangeError|out of range|invalid/i);

      decoder.close();
    });

    it('reports repetitionCount for animated images', async () => {
      // Loop count 0 means infinite in GIF spec (reported as Infinity)
      const infiniteLoop = createAnimatedGIF(0);
      const decoder1 = new ImageDecoder({
        type: 'image/gif',
        data: infiniteLoop,
      });

      const tracks1 = decoder1.tracks;
      await tracks1.ready;
      assert.strictEqual(tracks1[0].repetitionCount, Infinity);
      decoder1.close();

      // Loop count 1 means play once
      const singleLoop = createAnimatedGIF(1);
      const decoder2 = new ImageDecoder({
        type: 'image/gif',
        data: singleLoop,
      });

      const tracks2 = decoder2.tracks;
      await tracks2.ready;
      assert.strictEqual(tracks2[0].repetitionCount, 1);
      decoder2.close();
    });

    it('reports frame count for animated images', async () => {
      const data = createAnimatedGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      assert.strictEqual(tracks[0].frameCount, 2); // Our test GIF has 2 frames

      decoder.close();
    });
  });
});
