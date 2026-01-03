/**
 * Tests for ImageDecoder ReadableStream support (W3C compliance)
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

// Helper to create minimal test PNG
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

function createPNGStream(): ReadableStream<Uint8Array> {
  const pngData = createMinimalPNG();
  return new ReadableStream({
    start(controller) {
      // Send in chunks to simulate streaming
      controller.enqueue(new Uint8Array(pngData.subarray(0, 20)));
      controller.enqueue(new Uint8Array(pngData.subarray(20, 40)));
      controller.enqueue(new Uint8Array(pngData.subarray(40)));
      controller.close();
    },
  });
}

describe('ImageDecoder ReadableStream Support', () => {
  it('accepts ReadableStream as data source', async () => {
    const stream = createPNGStream();
    const decoder = new ImageDecoder({
      type: 'image/png',
      data: stream,
    });

    // Wait for stream to be fully consumed
    await decoder.completed;
    assert.strictEqual(decoder.complete, true);

    const result = await decoder.decode();
    assert.strictEqual(result.image.codedWidth, 1);
    assert.strictEqual(result.image.codedHeight, 1);

    result.image.close();
    decoder.close();
  });

  it('tracks.ready resolves after stream consumed', async () => {
    const stream = createPNGStream();
    const decoder = new ImageDecoder({
      type: 'image/png',
      data: stream,
    });

    await decoder.tracks.ready;
    assert.strictEqual(decoder.tracks.length, 1);

    decoder.close();
  });

  it('completed promise rejects on invalid image data', async () => {
    // Create a stream that provides incomplete/invalid PNG data
    const invalidData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG signature only
    const invalidStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(invalidData);
        controller.close();
      },
    });

    const decoder = new ImageDecoder({
      type: 'image/png',
      data: invalidStream,
    });

    // Wait for stream completion, then decode should fail
    await decoder.completed;
    await assert.rejects(decoder.decode());
    decoder.close();
  });

  it('decode waits for stream to complete', async () => {
    // Create a delayed stream
    const pngData = createMinimalPNG();
    let enqueueRest: (() => void) | null = null;

    const delayedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Send first chunk immediately
        controller.enqueue(new Uint8Array(pngData.subarray(0, 8)));
        // Schedule rest for later
        enqueueRest = () => {
          controller.enqueue(new Uint8Array(pngData.subarray(8)));
          controller.close();
        };
      },
    });

    const decoder = new ImageDecoder({
      type: 'image/png',
      data: delayedStream,
    });

    // Stream is not complete yet
    assert.strictEqual(decoder.complete, false);

    // Complete the stream
    enqueueRest?.();

    // Now decode should work
    await decoder.completed;
    const result = await decoder.decode();
    assert.strictEqual(result.image.codedWidth, 1);

    result.image.close();
    decoder.close();
  });

  it('type property is available immediately', () => {
    const stream = createPNGStream();
    const decoder = new ImageDecoder({
      type: 'image/png',
      data: stream,
    });

    // Type should be available immediately, even before stream completes
    assert.strictEqual(decoder.type, 'image/png');

    decoder.close();
  });
});
