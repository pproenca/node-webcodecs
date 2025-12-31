// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Stress test for backpressure gate limiting in-flight frames.

import { describe, expect, it } from 'vitest';
import {
  EncodedVideoChunk,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} from '../../dist/index.js';

describe('Encoder Backpressure', () => {
  it('ready property resolves immediately when under capacity', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // ready should resolve immediately when queue is empty
    const start = Date.now();
    await encoder.ready;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10); // Should be near-instant

    // Clean up properly - flush before close ensures async worker is fully idle
    await encoder.flush();
    encoder.close();
  });

  it('limits in-flight frames using ready property', async () => {
    const chunks: ArrayBuffer[] = [];
    let maxQueueSize = 0;

    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push(data);
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Set a lower threshold for testing
    encoder.maxQueueDepth = 8;

    // Encode 50 frames using backpressure
    for (let i = 0; i < 50; i++) {
      // Wait for capacity before encoding
      await encoder.ready;

      const frameData = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });

      encoder.encode(frame);
      frame.close();

      // Track max queue size
      maxQueueSize = Math.max(maxQueueSize, encoder.encodeQueueSize);
    }

    await encoder.flush();
    encoder.close();

    // With backpressure, queue should never exceed maxQueueDepth
    expect(maxQueueSize).toBeLessThanOrEqual(8);
    expect(chunks.length).toBe(50);
  });

  it('maxQueueDepth can be adjusted', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Default is 16
    expect(encoder.maxQueueDepth).toBe(16);

    // Can be changed
    encoder.maxQueueDepth = 4;
    expect(encoder.maxQueueDepth).toBe(4);

    // Must be at least 1
    expect(() => {
      encoder.maxQueueDepth = 0;
    }).toThrow(RangeError);

    encoder.close();
  });
});

describe('Decoder Backpressure', () => {
  it('ready property resolves immediately when under capacity', async () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({ codec: 'avc1.42001f' });

    // ready should resolve immediately when queue is empty
    const start = Date.now();
    await decoder.ready;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10); // Should be near-instant

    decoder.close();
  });

  it('limits in-flight decoded frames using ready property', async () => {
    // First encode some frames to get valid chunks
    const chunks: { data: ArrayBuffer; timestamp: number; type: string }[] = [];

    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Create 30 frames
    for (let i = 0; i < 30; i++) {
      await encoder.ready;
      const frameData = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame, { keyFrame: i % 10 === 0 });
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    // Now decode with backpressure tracking
    let maxQueueSize = 0;
    const decodedFrames: VideoFrame[] = [];

    const decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({ codec: 'avc1.42001f' });
    decoder.maxQueueDepth = 8;

    // Decode using backpressure
    for (const chunk of chunks) {
      await decoder.ready;
      decoder.decode(
        new EncodedVideoChunk({
          type: chunk.type as 'key' | 'delta',
          timestamp: chunk.timestamp,
          data: chunk.data,
        }),
      );
      maxQueueSize = Math.max(maxQueueSize, decoder.decodeQueueSize);
    }

    await decoder.flush();
    decoder.close();

    // Clean up
    for (const frame of decodedFrames) {
      frame.close();
    }

    // With backpressure, queue should never exceed maxQueueDepth
    expect(maxQueueSize).toBeLessThanOrEqual(8);
    expect(decodedFrames.length).toBeGreaterThan(0);
  });

  it('maxQueueDepth can be adjusted', async () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({ codec: 'avc1.42001f' });

    // Default is 16
    expect(decoder.maxQueueDepth).toBe(16);

    // Can be changed
    decoder.maxQueueDepth = 4;
    expect(decoder.maxQueueDepth).toBe(4);

    // Must be at least 1
    expect(() => {
      decoder.maxQueueDepth = 0;
    }).toThrow(RangeError);

    decoder.close();
  });
});

describe('Memory Bounding', () => {
  it('RSS stays bounded during high-throughput encoding with backpressure', async () => {
    // Force GC to get baseline
    if (global.gc) global.gc();
    const baselineRSS = process.memoryUsage().rss;

    let outputCount = 0;
    const encoder = new VideoEncoder({
      output: () => {
        outputCount++;
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 1920,
      height: 1080,
      bitrate: 5_000_000,
    });

    // Set a strict limit for testing
    encoder.maxQueueDepth = 8;

    let maxRSS = baselineRSS;

    // Encode 100 1080p frames with backpressure
    for (let i = 0; i < 100; i++) {
      await encoder.ready; // Wait for capacity

      const frameData = new Uint8Array(1920 * 1080 * 4); // ~8MB per frame
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();

      // Sample RSS periodically
      if (i % 20 === 0) {
        const currentRSS = process.memoryUsage().rss;
        maxRSS = Math.max(maxRSS, currentRSS);
      }
    }

    await encoder.flush();
    encoder.close();

    const rssGrowthMB = (maxRSS - baselineRSS) / (1024 * 1024);

    // With 8-slot backpressure on 1080p frames (~8MB each):
    // Max in-flight = 8 * 8MB = ~64MB (plus overhead)
    // Without backpressure: could grow to 100 * 8MB = 800MB
    // Allow generous margin for codec buffers, but should be well under 300MB
    expect(rssGrowthMB).toBeLessThan(300);
    expect(outputCount).toBe(100);
  });
});
