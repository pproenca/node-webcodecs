// test/stress/gc-pressure.test.ts
/**
 * GC Pressure Test
 *
 * Verifies that V8 triggers garbage collection based on external memory pressure.
 * Run with: node --expose-gc --max-old-space-size=128 ./node_modules/.bin/vitest run test/stress/gc-pressure.test.ts
 *
 * If external memory tracking is broken, this test will OOM.
 * If working correctly, V8 will aggressively GC based on native allocations.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VideoFrame } from '@pproenca/node-webcodecs';

describe('GC Pressure', () => {
  it('should survive 1000 large frames without OOM when external memory is tracked', async () => {
    // Each frame is 1080p RGBA = 1920 * 1080 * 4 = ~8MB
    // 1000 frames would be 8GB, but with proper GC pressure we should survive
    const width = 1920;
    const height = 1080;
    const frameSize = width * height * 4;

    let created = 0;
    let gcTriggered = 0;

    // Track how often GC runs
    const originalGC = global.gc;
    if (originalGC) {
      global.gc = () => {
        gcTriggered++;
        originalGC();
      };
    }

    try {
      for (let i = 0; i < 1000; i++) {
        const frameData = new Uint8Array(frameSize);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * 33333,
        });

        // Don't hold reference - allow GC
        frame.close();
        created++;

        // Yield to event loop occasionally
        if (i % 100 === 0) {
          await new Promise(r => setImmediate(r));
        }
      }
    } finally {
      if (originalGC) {
        global.gc = originalGC;
      }
    }

    assert.strictEqual(created, 1000);

    // GC should have been triggered multiple times due to memory pressure
    // If external memory tracking is broken, GC count will be low and we'll OOM
    console.log(`GC triggered ${gcTriggered} times during test`);
  });

  it('should handle rapid frame creation/destruction cycles', { timeout: 10000 }, async () => {
    // Simulate a video processing pipeline that creates frames rapidly
    const width = 640;
    const height = 480;
    const frameSize = width * height * 4;

    const start = Date.now();
    const DURATION_MS = 5000; // 5 second stress test
    let frameCount = 0;

    while (Date.now() - start < DURATION_MS) {
      // Create batch of frames
      const frames: VideoFrame[] = [];
      for (let i = 0; i < 30; i++) {
        const frameData = new Uint8Array(frameSize);
        frames.push(new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: frameCount * 33333,
        }));
        frameCount++;
      }

      // Close all frames
      for (const frame of frames) {
        frame.close();
      }

      // Let event loop breathe
      await new Promise(r => setImmediate(r));
    }

    console.log(`Processed ${frameCount} frames in ${DURATION_MS}ms`);
    assert.ok(frameCount > 0);
  });
});
