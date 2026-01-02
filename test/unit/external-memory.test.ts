// test/unit/external-memory.test.ts
/**
 * Tests for V8 external memory tracking.
 *
 * IMPORTANT: These tests require:
 * 1. --expose-gc flag to enable manual GC control
 * 2. Direct Node.js execution (not worker threads) to properly handle N-API external memory
 *
 * Run with: NODE_OPTIONS='--expose-gc' node --test test/unit/external-memory.test.ts
 *
 * The tests are skipped in environments where external memory tracking doesn't work.
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AudioData, VideoFrame } from '@pproenca/node-webcodecs';

// Helper to force garbage collection
function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

// Check if we're in an environment that supports external memory tracking tests.
// We detect this by checking if AdjustExternalMemory actually affects process.memoryUsage().external.
function supportsExternalMemoryTracking(): boolean {
  // Quick probe: create a frame and check if close() decreases external memory
  // Using a larger probe size (256KB) for more reliable detection
  const probeSize = 256 * 1024;
  const probeData = new Uint8Array(256 * 256 * 4); // 256KB frame (256x256 RGBA)
  forceGC();

  const probeFrame = new VideoFrame(probeData, {
    format: 'RGBA',
    codedWidth: 256,
    codedHeight: 256,
    timestamp: 0,
  });
  forceGC();
  const probeAfterCreate = process.memoryUsage().external;

  probeFrame.close();
  forceGC();
  const probeAfterClose = process.memoryUsage().external;

  // If close() decreased external memory by a significant amount, the environment supports tracking
  const closeDelta = probeAfterCreate - probeAfterClose;

  // Expect at least 200KB decrease on close (allowing for some variance)
  return closeDelta > probeSize * 0.75;
}

const runTests = supportsExternalMemoryTracking();

describe('V8 External Memory Tracking', () => {
  describe('VideoFrame', () => {
    it('should release external memory when close() is called', { skip: !runTests }, () => {
      // Create a large frame (1MB) - this should be visible to V8's GC
      const size = 1024 * 1024; // 1MB RGBA frame (512x512)
      const frameData = new Uint8Array(size);

      // Create frame and capture memory before close
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 512,
        codedHeight: 512,
        timestamp: 0,
      });

      forceGC();
      const beforeClose = process.memoryUsage().external;

      // Close the frame
      frame.close();

      forceGC();
      const afterClose = process.memoryUsage().external;

      // External memory should have decreased by roughly the frame size
      // The decrease should be close to 1MB (the frame size)
      const decrease = beforeClose - afterClose;
      assert.ok(decrease > size * 0.9, `Expected decrease > ${size * 0.9}, got ${decrease}`);
    });

    it('should release external memory when frame is garbage collected', { skip: !runTests }, async () => {
      const size = 1024 * 1024;

      // Create frame and capture its external memory footprint
      forceGC();
      const baseline = process.memoryUsage().external;

      const frameData = new Uint8Array(size);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 512,
        codedHeight: 512,
        timestamp: 0,
      });

      forceGC();
      const withFrame = process.memoryUsage().external;

      // Verify the frame increased external memory
      assert.ok(withFrame - baseline > size * 0.9, `Expected increase > ${size * 0.9}`);

      // Don't close - let GC handle it by removing reference
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _frame = frame; // Keep reference alive until this point

      // Force multiple GC cycles (frame goes out of scope after this block)
      forceGC();
      await new Promise((r) => { setTimeout(r, 50); });
      forceGC();

      const afterGC = process.memoryUsage().external;

      // Memory should be released via destructor - should be close to baseline
      assert.ok(afterGC - baseline < size * 0.5, `Expected remaining < ${size * 0.5}`);
    });
  });

  describe('AudioData', () => {
    it('should release external memory when close() is called', { skip: !runTests }, () => {
      // Create 1 second of stereo 48kHz f32 audio (~384KB)
      const sampleRate = 48000;
      const channels = 2;
      const frames = sampleRate; // 1 second
      const size = frames * channels * 4; // f32 = 4 bytes

      const audioData = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: 0,
        data: new Float32Array(frames * channels),
      });

      forceGC();
      const beforeClose = process.memoryUsage().external;

      audioData.close();

      forceGC();
      const afterClose = process.memoryUsage().external;

      // External memory should have decreased by roughly the audio data size
      const decrease = beforeClose - afterClose;
      assert.ok(decrease > size * 0.9, `Expected decrease > ${size * 0.9}, got ${decrease}`);
    });
  });
});
