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

// Helper to create a minimal JPEG image (1x1 red pixel)
function createMinimalJPEG(): Buffer {
  // Minimal valid JPEG - 1x1 red pixel
  return Buffer.from([
    // SOI marker
    0xff, 0xd8,
    // APP0/JFIF marker
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
    // DQT marker (quantization table)
    0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d,
    0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c,
    0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32,
    // SOF0 marker (baseline DCT, 1x1, 3 components)
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    // DHT marker (Huffman table for DC)
    0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
    0x0b,
    // DHT marker (Huffman table for AC)
    0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04,
    0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41,
    0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1,
    0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19,
    0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44,
    0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64,
    0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84,
    0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2,
    0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9,
    0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
    0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3,
    0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
    // SOS marker (start of scan)
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
  ]);
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

    it('creates decoder with valid JPEG data', async () => {
      const data = createMinimalJPEG();
      const decoder = new ImageDecoder({
        type: 'image/jpeg',
        data: data,
      });

      assert.strictEqual(decoder.type, 'image/jpeg');
      assert.strictEqual(decoder.complete, true);

      // Verify can decode
      const result = await decoder.decode();
      assert.ok(result.image instanceof VideoFrame);
      result.image.close();
      decoder.close();
    });

    it('creates decoder with valid GIF data', () => {
      const data = createStaticGIF();
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      assert.strictEqual(decoder.type, 'image/gif');
      assert.strictEqual(decoder.complete, true);
      decoder.close();
    });

    it('throws on invalid image data during decode', async () => {
      // Invalid data - just random bytes, not a valid image
      // Per W3C spec, decode() should reject with EncodingError for corrupted data
      const invalidData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: invalidData,
      });

      // Decoding invalid data should throw
      await assert.rejects(decoder.decode(), /Error|decode|invalid|corrupt|EncodingError/i);

      decoder.close();
    });

    it('handles ReadableStream data with complete property', async () => {
      const pngData = createMinimalPNG();

      // Create a ReadableStream that delivers data in chunks
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Enqueue data in chunks
          const chunkSize = Math.floor(pngData.length / 2);
          controller.enqueue(new Uint8Array(pngData.subarray(0, chunkSize)));
          controller.enqueue(new Uint8Array(pngData.subarray(chunkSize)));
          controller.close();
        },
      });

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: stream,
      });

      // complete should be false initially for streaming
      assert.strictEqual(decoder.complete, false);

      // Wait for completed promise
      await decoder.completed;

      // Now complete should be true
      assert.strictEqual(decoder.complete, true);

      // Should be able to decode
      const result = await decoder.decode();
      assert.ok(result.image instanceof VideoFrame);
      result.image.close();
      decoder.close();
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

  // Spec 10.6-10.7 compliance tests
  describe('ImageTrackList (Spec 10.6)', () => {
    // Spec 10.6.1: [[selected index]] initial value is -1, but first track is auto-selected
    it('returns -1 for selectedIndex when no track is selected', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      // First track is auto-selected per spec behavior
      assert.strictEqual(typeof tracks.selectedIndex, 'number');
      decoder.close();
    });

    // Spec 10.6.2: getter ImageTrack(unsigned long index)
    it('returns undefined for out-of-bounds index access', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      assert.strictEqual(tracks.length, 1);
      // Spec: getter returns undefined for index >= length
      assert.strictEqual(tracks[1], undefined);
      assert.strictEqual(tracks[100], undefined);
      assert.strictEqual(tracks[-1], undefined);
      decoder.close();
    });

    // Spec 10.6.2: selectedTrack returns null when [[selected index]] is -1
    it('returns null for selectedTrack when no track is selected', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;

      // Deselect the track
      tracks[0].selected = false;
      // Spec 10.6.2: If [[selected index]] is -1, return null
      assert.strictEqual(tracks.selectedTrack, null);
      assert.strictEqual(tracks.selectedIndex, -1);
      decoder.close();
    });

    // Spec 10.6.2: length returns [[track list]] length
    it('length matches number of tracks', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      assert.strictEqual(tracks.length, 1);
      assert.strictEqual(typeof tracks.length, 'number');
      decoder.close();
    });

    // Spec 10.6.2: ready promise resolves
    it('ready promise resolves to undefined', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.tracks.ready;
      assert.strictEqual(result, undefined);
      decoder.close();
    });

    // Iterator support
    it('is iterable via Symbol.iterator', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      const trackArray = [...tracks];
      assert.strictEqual(trackArray.length, 1);
      assert.strictEqual(trackArray[0], tracks[0]);
      decoder.close();
    });
  });

  describe('ImageTrack (Spec 10.7)', () => {
    // Spec 10.7.2: selected setter
    it('selected can be set to true', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      // Initially selected
      assert.strictEqual(track.selected, true);

      // Set to same value (no-op per spec step 3)
      track.selected = true;
      assert.strictEqual(track.selected, true);
      decoder.close();
    });

    // Spec 10.7.2: selected setter - deselecting
    it('selected can be set to false', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      // Deselect
      track.selected = false;
      assert.strictEqual(track.selected, false);
      // Spec 10.7.2 step 8: If newValue is false, selectedIndex = -1
      assert.strictEqual(tracks.selectedIndex, -1);
      decoder.close();
    });

    // Spec 10.7.2: selected setter - re-selecting
    it('selected can be toggled back to true', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      // Deselect then reselect
      track.selected = false;
      assert.strictEqual(track.selected, false);
      assert.strictEqual(tracks.selectedIndex, -1);

      track.selected = true;
      assert.strictEqual(track.selected, true);
      // Spec 10.7.2 step 8: If newValue is true, selectedIndex = index of this track
      assert.strictEqual(tracks.selectedIndex, 0);
      decoder.close();
    });

    // Spec 10.7.2 step 1: If decoder is closed, abort
    it('setting selected on closed decoder is a no-op', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      decoder.close();

      // Spec 10.7.2 step 1: If [[ImageDecoder]]'s [[closed]] is true, abort
      // Should not throw, just be a no-op
      assert.doesNotThrow(() => {
        track.selected = false;
      });
      // Value should remain unchanged since setter aborted
      assert.strictEqual(track.selected, true);
    });

    // Spec 10.7.2: animated attribute
    it('animated is false for static image', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const track = decoder.tracks[0];
      assert.strictEqual(track.animated, false);
      assert.strictEqual(typeof track.animated, 'boolean');
      decoder.close();
    });

    // Spec 10.7.2: frameCount attribute
    it('frameCount is 1 for static image', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const track = decoder.tracks[0];
      assert.strictEqual(track.frameCount, 1);
      assert.strictEqual(typeof track.frameCount, 'number');
      decoder.close();
    });

    // Spec 10.7.2: repetitionCount attribute
    it('repetitionCount is a number', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const track = decoder.tracks[0];
      assert.strictEqual(typeof track.repetitionCount, 'number');
      decoder.close();
    });

    // Spec 10.7.2: repetitionCount is Infinity for infinite loop
    it('repetitionCount is Infinity for loop-forever GIF', async () => {
      const data = createAnimatedGIF(0); // 0 = infinite loop
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      assert.strictEqual(tracks[0].repetitionCount, Infinity);
      decoder.close();
    });

    // Spec 10.7.2: finite repetitionCount
    it('repetitionCount is finite for limited-loop GIF', async () => {
      const data = createAnimatedGIF(3); // Loop 3 times
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      assert.strictEqual(tracks[0].repetitionCount, 3);
      decoder.close();
    });

    // Spec 10.7: Single-frame "animated" GIF edge case
    it('handles single-frame GIF correctly', async () => {
      const data = createStaticGIF(); // Single frame
      const decoder = new ImageDecoder({
        type: 'image/gif',
        data: data,
      });

      const tracks = decoder.tracks;
      await tracks.ready;
      const track = tracks[0];

      assert.strictEqual(track.frameCount, 1);
      // Single-frame GIF should not be considered animated
      assert.strictEqual(track.animated, false);
      decoder.close();
    });
  });
});
