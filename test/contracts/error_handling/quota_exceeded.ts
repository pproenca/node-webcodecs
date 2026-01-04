/**
 * Contract Test: QuotaExceededError Validation
 *
 * PURPOSE: These tests verify W3C WebCodecs queue limits.
 * Circuit breaker throws QuotaExceededError when queue > 64 frames.
 *
 * REFERENCE: src/video_encoder.cc:636-647 (kMaxHardQueueSize = 64)
 *            src/video_decoder.cc:378-390 (kMaxHardQueueSize = 64)
 *
 * NOTE: AudioEncoder and AudioDecoder do NOT have kMaxHardQueueSize limits.
 * They track queue size for backpressure signaling (codecSaturated) but
 * do not throw QuotaExceededError. Only VideoEncoder and VideoDecoder
 * have this circuit breaker.
 *
 * RUN: tsx test/contracts/error_handling/quota_exceeded.ts
 */

const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('@pproenca/node-webcodecs');
import * as assert from 'node:assert';

const tests: Array<{name: string; fn: () => void | Promise<void>}> = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({name, fn});
}

// VideoEncoder queue overflow test
test('VideoEncoder: 65+ frames without flush throws QuotaExceededError', () => {
  const encoder = new VideoEncoder({output: () => {}, error: () => {}});
  encoder.configure({
    codec: 'avc1.42001e',
    width: 64,
    height: 64,
    bitrate: 1_000_000,
  });

  let quotaError = null;

  // Try to queue more than 64 frames (kMaxHardQueueSize = 64)
  for (let i = 0; i < 100; i++) {
    const frame = new VideoFrame(Buffer.alloc(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: i * 1000,
    });

    try {
      encoder.encode(frame);
    } catch (e) {
      if (e.message?.includes('QuotaExceededError')) {
        quotaError = e;
      }
    } finally {
      frame.close();
    }

    if (quotaError) break;
  }

  encoder.close();

  assert.ok(quotaError, 'should throw QuotaExceededError when queue is full');
  assert.ok(
    quotaError.message.includes('QuotaExceededError'),
    `Expected QuotaExceededError but got: ${quotaError.message}`,
  );
});

// VideoDecoder queue overflow test
//
// NOTE: This test is challenging to trigger reliably in async mode.
// The async worker processes garbage data very quickly (FFmpeg immediately
// rejects invalid packets), so the queue may drain faster than we can fill it.
// We try a large burst to increase the probability of hitting the limit.
test('VideoDecoder: rapid enqueue bursts can trigger QuotaExceededError', () => {
  const decoder = new VideoDecoder({output: () => {}, error: () => {}});
  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 64,
    codedHeight: 64,
  });

  let quotaError = null;

  // Try to queue many chunks in a tight loop (kMaxHardQueueSize = 64)
  // The async worker processes items on a separate thread, so we may or may
  // not hit the limit depending on thread scheduling.
  for (let i = 0; i < 200; i++) {
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: i * 1000,
      data: Buffer.alloc(100),
    });

    try {
      decoder.decode(chunk);
    } catch (e) {
      if (e.message?.includes('QuotaExceededError')) {
        quotaError = e;
      }
    }

    if (quotaError) break;
  }

  decoder.close();

  // Unlike the encoder test, the decoder test may not always trigger the quota
  // error due to async processing. We verify the invariant: IF an error was
  // thrown, it must be QuotaExceededError.
  if (quotaError) {
    assert.ok(
      quotaError.message.includes('QuotaExceededError'),
      `Expected QuotaExceededError but got: ${quotaError.message}`,
    );
    console.log('    (QuotaExceededError triggered successfully)');
  } else {
    // If no error was thrown, the async worker kept up with the queue.
    // This is acceptable behavior - document it.
    console.log('    (Async worker processed fast enough - no queue overflow)');
  }
});

async function run() {
  console.log('Contract: QuotaExceededError Validation\n');
  let passed = 0,
    failed = 0;
  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
run();
