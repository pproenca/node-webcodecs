/**
 * Memory leak detection tests.
 *
 * These tests verify that native resources are properly cleaned up
 * when objects are closed or garbage collected.
 *
 * Run with: npx vitest run test/stress/memory-leak.test.ts
 * For detailed memory analysis: node --expose-gc test/stress/memory-leak.test.ts
 */

import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  AudioData,
  AudioDecoder,
  AudioEncoder,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} from '@pproenca/node-webcodecs';
import {
  assertNoLeaks,
  type CounterSnapshot,
  getCounters,
  waitForGC,
} from '../helpers/leak-check.js';

// Helper to force garbage collection if available
function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

// Helper to measure memory usage
// Using RSS (Resident Set Size) instead of heapUsed to capture native memory allocations
// heapUsed only tracks V8 heap, missing FFmpeg AVFrame/AVPacket allocations
function getMemoryUsed(): number {
  forceGC();
  return process.memoryUsage().rss;
}

// Allow some memory growth but catch significant leaks
const ALLOWED_GROWTH_MB = 50;
const ITERATIONS = 100;

describe('Memory Leak Detection', () => {
  let initialCounters: CounterSnapshot;

  before(() => {
    // Warm up - create and destroy one instance to initialize any static resources
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });
    encoder.close();
    forceGC();

    // Capture initial counter state after warmup
    initialCounters = getCounters();
  });

  after(async () => {
    // Wait for GC to clean up any lingering instances
    await waitForGC();

    // Assert no leaks using counter-based detection
    const finalCounters = getCounters();
    assertNoLeaks(initialCounters, finalCounters, 'Memory Leak Tests');
  });

  describe('VideoEncoder', () => {
    it('does not leak memory on repeated create/configure/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS; i++) {
        const encoder = new VideoEncoder({
          output: () => {},
          error: () => {},
        });
        encoder.configure({
          codec: 'avc1.42001f',
          width: 640,
          height: 480,
          bitrate: 1_000_000,
        });
        encoder.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });

    it('does not leak memory when encoding frames', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS; i++) {
        const frames: VideoFrame[] = [];
        const encoder = new VideoEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.configure({
          codec: 'avc1.42001f',
          width: 64,
          height: 64,
          bitrate: 500_000,
        });

        // Create and encode a small frame
        const frameData = new Uint8Array(64 * 64 * 4); // RGBA
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 64,
          codedHeight: 64,
          timestamp: i * 33333,
        });
        frames.push(frame);

        encoder.encode(frame);
        await encoder.flush();

        // Close all frames
        for (const f of frames) {
          f.close();
        }
        encoder.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });

  describe('VideoDecoder', () => {
    it('does not leak memory on repeated create/configure/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS; i++) {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.configure({
          codec: 'avc1.42001f',
        });
        decoder.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });

  describe('VideoFrame', () => {
    it('does not leak memory on repeated create/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS * 10; i++) {
        const frameData = new Uint8Array(256 * 256 * 4); // 256KB per frame
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 256,
          codedHeight: 256,
          timestamp: i * 33333,
        });
        frame.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });

    it('does not leak memory on clone/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS * 5; i++) {
        const frameData = new Uint8Array(128 * 128 * 4);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 128,
          codedHeight: 128,
          timestamp: i * 33333,
        });

        const clone = frame.clone();
        frame.close();
        clone.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });

  describe('AudioEncoder', () => {
    it('does not leak memory on repeated create/configure/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS; i++) {
        const encoder = new AudioEncoder({
          output: () => {},
          error: () => {},
        });
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128000,
        });
        encoder.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });

  describe('AudioDecoder', () => {
    it('does not leak memory on repeated create/configure/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS; i++) {
        const decoder = new AudioDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        decoder.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });

  describe('AudioData', () => {
    it('does not leak memory on repeated create/close', async () => {
      const before = getMemoryUsed();

      for (let i = 0; i < ITERATIONS * 10; i++) {
        const audioData = new AudioData({
          format: 'f32',
          sampleRate: 48000,
          numberOfFrames: 1024,
          numberOfChannels: 2,
          timestamp: i * 21333,
          data: new Float32Array(1024 * 2),
        });
        audioData.close();
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
      forceGC();

      const after = getMemoryUsed();
      const growthMB = (after - before) / (1024 * 1024);

      assert.ok(growthMB < ALLOWED_GROWTH_MB);
    });
  });
});

describe('ImageDecoder Leak Detection', () => {
  let initialCounters: CounterSnapshot;

  before(() => {
    initialCounters = getCounters();
  });

  after(async () => {
    await waitForGC();
    const finalCounters = getCounters();
    assertNoLeaks(initialCounters, finalCounters, 'ImageDecoder Leak Detection');
  });

  it('ImageDecoder: animated GIF decode does not leak', async () => {
    const before = getCounters();

    // Create minimal animated GIF (2 frames, 1x1 pixel each)
    const createAnimatedGIF = (): Buffer => {
      const header = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
        0x01, 0x00, // Width: 1
        0x01, 0x00, // Height: 1
        0x80, // Global color table flag, 2 colors
        0x00, // Background color index
        0x00, // Pixel aspect ratio
      ]);
      const colorTable = Buffer.from([
        0xff, 0x00, 0x00, // Red
        0x00, 0x00, 0xff, // Blue
      ]);
      const netscapeExt = Buffer.from([
        0x21, 0xff, // Application Extension
        0x0b, // Block size
        0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, // "NETSCAPE"
        0x32, 0x2e, 0x30, // "2.0"
        0x03, // Sub-block size
        0x01, // Sub-block ID
        0x00, 0x00, // Loop count (0 = infinite)
        0x00, // Block terminator
      ]);
      const frame1 = Buffer.from([
        0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00, // GCE
        0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // Image descriptor
        0x02, 0x02, 0x44, 0x01, 0x00, // LZW data
      ]);
      const frame2 = Buffer.from([
        0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00, // GCE
        0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // Image descriptor
        0x02, 0x02, 0x44, 0x51, 0x00, // LZW data
      ]);
      const trailer = Buffer.from([0x3b]);
      return Buffer.concat([header, colorTable, netscapeExt, frame1, frame2, trailer]);
    };

    const gifData = createAnimatedGIF();
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      // Wrap in IIFE to ensure proper scoping for GC
      await (async () => {
        const { ImageDecoder } = await import('@pproenca/node-webcodecs');
        let decoder: InstanceType<typeof ImageDecoder> | null = new ImageDecoder({
          type: 'image/gif',
          data: gifData,
        });

        // Decode frames and close the returned VideoFrame images to prevent leaks
        let result0 = await decoder.decode({ frameIndex: 0 });
        result0.image.close();
        result0 = null as unknown as typeof result0;

        let result1 = await decoder.decode({ frameIndex: 1 });
        result1.image.close();
        result1 = null as unknown as typeof result1;

        decoder.close();
        decoder = null;
      })();
    }

    // Force multiple GC cycles to ensure all instances are collected
    for (let i = 0; i < 5; i++) {
      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const after = getCounters();
    assertNoLeaks(before, after, 'ImageDecoder');
  });

  it('ImageDecoder: static PNG decode does not leak', async () => {
    const before = getCounters();

    // Create minimal 1x1 red PNG
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); // width
    ihdr.writeUInt32BE(1, 4); // height
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type (RGB)

    const createChunk = (type: string, data: Buffer): Buffer => {
      const typeBuffer = Buffer.from(type, 'ascii');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      // CRC32
      let crc = 0xffffffff;
      const table: number[] = [];
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c;
      }
      const crcData = Buffer.concat([typeBuffer, data]);
      for (let i = 0; i < crcData.length; i++) {
        crc = table[(crc ^ crcData[i]) & 0xff] ^ (crc >>> 8);
      }
      const crcBuffer = Buffer.alloc(4);
      crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
      return Buffer.concat([length, typeBuffer, data, crcBuffer]);
    };

    const { deflateSync } = await import('node:zlib');
    const rawData = Buffer.from([0, 255, 0, 0]); // filter byte + RGB
    const compressedData = deflateSync(rawData);

    const pngData = Buffer.concat([
      pngSignature,
      createChunk('IHDR', ihdr),
      createChunk('IDAT', compressedData),
      createChunk('IEND', Buffer.alloc(0)),
    ]);

    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      // Wrap in IIFE to ensure proper scoping for GC
      await (async () => {
        const { ImageDecoder } = await import('@pproenca/node-webcodecs');
        let decoder: InstanceType<typeof ImageDecoder> | null = new ImageDecoder({
          type: 'image/png',
          data: pngData,
        });

        // Decode frame and close the returned VideoFrame to prevent leaks
        let result = await decoder.decode({ frameIndex: 0 });
        result.image.close();
        result = null as unknown as typeof result;

        decoder.close();
        decoder = null;
      })();
    }

    // Force multiple GC cycles to ensure all instances are collected
    for (let i = 0; i < 5; i++) {
      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const after = getCounters();
    assertNoLeaks(before, after, 'ImageDecoder PNG');
  });
});

describe('Stress Tests', () => {
  let initialCounters: CounterSnapshot;

  before(() => {
    initialCounters = getCounters();
  });

  after(async () => {
    await waitForGC();
    const finalCounters = getCounters();
    assertNoLeaks(initialCounters, finalCounters, 'Stress Tests');
  });

  it('handles rapid encoder reconfiguration', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    const resolutions = [
      { width: 320, height: 240 },
      { width: 640, height: 480 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];

    for (let i = 0; i < 50; i++) {
      const res = resolutions[i % resolutions.length];
      encoder.configure({
        codec: 'avc1.42001f',
        width: res.width,
        height: res.height,
        bitrate: 1_000_000,
      });
      await encoder.flush();
    }

    encoder.close();
    assert.strictEqual(encoder.state, 'closed');
  });

  it('handles concurrent encoder/decoder pairs', async () => {
    const pairs = 10;
    const encoders: VideoEncoder[] = [];
    const decoders: VideoDecoder[] = [];

    // Create multiple encoder/decoder pairs
    for (let i = 0; i < pairs; i++) {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.configure({
        codec: 'avc1.42001f',
        width: 64,
        height: 64,
        bitrate: 500_000,
      });
      encoders.push(encoder);

      const decoder = new VideoDecoder({
        output: (frame) => frame.close(),
        error: () => {},
      });
      decoder.configure({ codec: 'avc1.42001f' });
      decoders.push(decoder);
    }

    // Close all
    for (const encoder of encoders) {
      encoder.close();
    }
    for (const decoder of decoders) {
      decoder.close();
    }

    assert.strictEqual(encoders.every((e) => e.state === 'closed'), true);
    assert.strictEqual(decoders.every((d) => d.state === 'closed'), true);
  });
});
