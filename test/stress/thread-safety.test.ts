// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Thread safety tests validating C++ native addon behavior.
// TDD tests for issues identified in FFmpeg C++ sentinel analysis.

import {
  EncodedVideoChunk,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} from '@pproenca/node-webcodecs';
import { describe, expect, it } from 'vitest';

/**
 * Issue #8: Missing hard queue limit in decoder
 *
 * The encoder has kMaxHardQueueSize (64) as a circuit breaker.
 * The decoder should have the same protection.
 */
describe('Issue #8: Hard Queue Limit', () => {
  it('encoder throws QuotaExceededError when hard limit exceeded', async () => {
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

    // Try to exceed hard queue limit (kMaxHardQueueSize = 64)
    let quotaError: Error | null = null;
    for (let i = 0; i < 100; i++) {
      const frameData = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });

      try {
        encoder.encode(frame);
      } catch (e) {
        if (e instanceof Error && e.message.includes('QuotaExceededError')) {
          quotaError = e;
        }
      }
      frame.close();
    }

    encoder.close();

    // Encoder should throw QuotaExceededError
    expect(quotaError).not.toBeNull();
    expect(quotaError?.message).toContain('QuotaExceededError');
  });

  it('decoder throws QuotaExceededError when hard limit exceeded', async () => {
    // First: encode frames to get valid chunks
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

    // Create 100 frames
    for (let i = 0; i < 100; i++) {
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

    // Second: decode with slow consumer to hit hard limit
    const decodedFrames: VideoFrame[] = [];

    const decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: () => {},
    });

    decoder.configure({ codec: 'avc1.42001f' });

    // Submit all chunks rapidly without waiting - should hit hard limit
    let quotaError: Error | null = null;
    for (const chunk of chunks) {
      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            data: chunk.data,
          }),
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes('QuotaExceededError')) {
          quotaError = e;
          break;
        }
      }
    }

    decoder.close();
    for (const frame of decodedFrames) {
      frame.close();
    }

    // Decoder MUST throw QuotaExceededError like encoder
    expect(quotaError).not.toBeNull();
    expect(quotaError?.message).toContain('QuotaExceededError');
  });
});

/**
 * Issue #2: Race condition in task_queue_.empty() check outside lock
 *
 * The worker thread checks task_queue_.empty() outside queue_mutex_,
 * which violates C++ memory model (undefined behavior).
 *
 * This stress test exercises rapid flush/encode cycles to detect:
 * - Deadlocks (test times out)
 * - Lost frames (output count != input count)
 */
describe('Issue #2: Queue Race Condition', () => {
  it('single encoder flush/encode cycles work correctly', async () => {
    let outputCount = 0;
    const errors: Error[] = [];

    const encoder = new VideoEncoder({
      output: () => {
        outputCount++;
      },
      error: (e) => {
        errors.push(e);
      },
    });

    encoder.configure({
      codec: 'avc1.42001f',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Encode 10 frames with flush after every 5
    for (let i = 0; i < 10; i++) {
      await encoder.ready;
      const frameData = new Uint8Array(320 * 240 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();

      if (i % 5 === 4) {
        await encoder.flush();
      }
    }
    await encoder.flush();
    encoder.close();

    expect(errors).toHaveLength(0);
    expect(outputCount).toBe(10);
  });

  it('multiple sequential flushes work correctly', async () => {
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
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    // Multiple flush cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 5; i++) {
        await encoder.ready;
        const frameData = new Uint8Array(320 * 240 * 4);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: (cycle * 5 + i) * 33333,
        });
        encoder.encode(frame);
        frame.close();
      }
      await encoder.flush();
    }

    encoder.close();
    expect(outputCount).toBe(15);
  });
});

/**
 * Issue #6: counterQueue not decremented on TSFN abort
 *
 * When TSFN callbacks are cancelled during cleanup (env == nullptr),
 * the global counterQueue should still be decremented to avoid drift.
 *
 * This test exercises rapid create/close cycles that trigger TSFN abort.
 */
describe('Issue #6: Resource Cleanup on Abort', () => {
  it('rapid create/close cycles do not leak resources', async () => {
    const startRSS = process.memoryUsage().rss;

    // Create and destroy many encoders rapidly (triggers TSFN abort paths)
    for (let i = 0; i < 30; i++) {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 500_000,
      });

      // Encode one frame
      const frameData = new Uint8Array(320 * 240 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });
      encoder.encode(frame);
      frame.close();

      // Close immediately (without flush) - triggers TSFN abort
      encoder.close();
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
      global.gc();
    }

    const endRSS = process.memoryUsage().rss;
    const growthMB = (endRSS - startRSS) / (1024 * 1024);

    // Memory growth should be minimal (< 50MB) after cleanup
    expect(growthMB).toBeLessThan(50);
  });

  it('close without flush does not crash', async () => {
    // This test ensures TSFN abort path is safe
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

    // Encode several frames
    for (let i = 0; i < 10; i++) {
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
    }

    // Close immediately - pending callbacks will hit abort path
    encoder.close();

    // If we reach here without crash, abort path is safe
    expect(true).toBe(true);
  });
});
