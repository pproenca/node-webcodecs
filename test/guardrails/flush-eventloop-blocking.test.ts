/**
 * Regression test: flush() must not block the Node.js event loop.
 *
 * This test measures heartbeat jitter during flush() operations. If flush()
 * blocks the JS thread, setInterval callbacks cannot fire and we'll see
 * large gaps between heartbeats.
 *
 * Acceptance criteria: max gap between heartbeats < 50ms during flush.
 *
 * This test will FAIL on the current blocking implementation and should
 * PASS after codec migrations to async workers.
 */

import * as assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { describe, it } from 'node:test';

const MAX_ALLOWED_GAP_MS = 50;
const HEARTBEAT_INTERVAL_MS = 5;

interface HeartbeatResult {
  maxGap: number;
  heartbeatCount: number;
}

/**
 * Measures event loop responsiveness during an async operation.
 * Returns the maximum gap between heartbeats.
 */
async function measureHeartbeatJitter(operation: () => Promise<void>): Promise<HeartbeatResult> {
  let lastHeartbeat = performance.now();
  let maxGap = 0;
  let heartbeatCount = 0;

  const interval = setInterval(() => {
    const now = performance.now();
    const gap = now - lastHeartbeat;
    if (gap > maxGap) {
      maxGap = gap;
    }
    lastHeartbeat = now;
    heartbeatCount++;
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await operation();
  } finally {
    clearInterval(interval);
  }

  return { maxGap, heartbeatCount };
}

describe('flush() event loop blocking regression', () => {
  it('VideoEncoder.flush() should not block the event loop', async () => {
    const { VideoEncoder, VideoFrame } = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
    });

    // Queue multiple frames to ensure flush has work to do
    const frameData = new Uint8Array(640 * 480 * 4);
    for (let i = 0; i < 10; i++) {
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    // Measure event loop responsiveness during flush
    const { maxGap, heartbeatCount } = await measureHeartbeatJitter(
      () => encoder.flush()
    );

    encoder.close();

    // Verify we got some heartbeats (sanity check)
    assert.ok(
      heartbeatCount >= 1,
      `Expected at least 1 heartbeat, got ${heartbeatCount}`
    );

    // Verify chunks were produced
    assert.ok(
      chunks.length > 0,
      `Expected encoded chunks, got ${chunks.length}`
    );

    // THE ACTUAL ASSERTION: flush() must not block the event loop
    assert.ok(
      maxGap < MAX_ALLOWED_GAP_MS,
      `VideoEncoder.flush() blocked event loop: max gap ${maxGap.toFixed(1)}ms > ${MAX_ALLOWED_GAP_MS}ms`
    );
  });

  it('VideoDecoder.flush() should not block the event loop', async () => {
    const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } =
      await import('../../lib/index');

    // First, encode some frames to get valid encoded data
    const encodedChunks: Array<{ type: 'key' | 'delta'; timestamp: number; data: Uint8Array }> = [];
    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        encodedChunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          data,
        });
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500_000,
    });

    const frameData = new Uint8Array(320 * 240 * 4);
    for (let i = 0; i < 10; i++) {
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    assert.ok(encodedChunks.length > 0, 'Need encoded chunks for decoder test');

    // Now decode with heartbeat monitoring
    const decodedFrames: VideoFrame[] = [];
    const decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({
      codec: 'avc1.42001e',
      codedWidth: 320,
      codedHeight: 240,
    });

    // Queue all encoded chunks
    for (const chunk of encodedChunks) {
      decoder.decode(
        new EncodedVideoChunk({
          type: chunk.type,
          timestamp: chunk.timestamp,
          data: chunk.data,
        })
      );
    }

    // Measure event loop responsiveness during flush
    const { maxGap, heartbeatCount } = await measureHeartbeatJitter(
      () => decoder.flush()
    );

    // Clean up
    for (const frame of decodedFrames) {
      frame.close();
    }
    decoder.close();

    // Verify we got some heartbeats (sanity check)
    assert.ok(
      heartbeatCount >= 1,
      `Expected at least 1 heartbeat, got ${heartbeatCount}`
    );

    // Verify frames were produced
    assert.ok(
      decodedFrames.length > 0,
      `Expected decoded frames, got ${decodedFrames.length}`
    );

    // THE ACTUAL ASSERTION: flush() must not block the event loop
    assert.ok(
      maxGap < MAX_ALLOWED_GAP_MS,
      `VideoDecoder.flush() blocked event loop: max gap ${maxGap.toFixed(1)}ms > ${MAX_ALLOWED_GAP_MS}ms`
    );
  });
});
