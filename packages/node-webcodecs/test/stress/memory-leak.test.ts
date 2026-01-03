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
