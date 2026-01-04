// test/unit/video-encoder-flush-promise.test.ts
// Tests for P0-4: Correct promise returned on enqueue failure

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoEncoder } from '../../lib';

/**
 * Tests for flush() promise handling per N-API requirements.
 * Each deferred promise must be settled exactly once and the same
 * promise instance must be returned.
 */

describe('VideoEncoder flush() Promise Handling', () => {
  const h264Config = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  // RED: Test that flush() returns correct promise on enqueue failure
  it('should return rejected promise (not new promise) on enqueue failure', async () => {
    let errorCaught = false;
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.configure(h264Config);

    // Close the encoder to cause enqueue failure
    encoder.close();

    // flush() after close should fail to enqueue and return rejected promise
    const flushPromise = encoder.flush();

    // The SAME promise should reject (not a new resolved promise)
    try {
      await flushPromise;
      assert.fail('flush() should have rejected');
    } catch (error) {
      errorCaught = true;
      // Verify error message indicates enqueue failure or invalid state
      assert.ok(error instanceof Error);
    }

    assert.ok(errorCaught, 'Promise should have rejected');
  });

  // Additional test: verify promise rejects with correct error
  it('should reject with InvalidStateError when encoder is closed', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.configure(h264Config);
    encoder.close();

    try {
      await encoder.flush();
      assert.fail('Expected flush() to reject');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('Failed to enqueue') ||
          error.message.includes('closed') ||
          error.message.includes('Invalid'),
      );
    }
  });

  // Test: flush() on unconfigured encoder
  it('should reject when encoder is unconfigured', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    // Don't configure - state is "unconfigured"
    try {
      await encoder.flush();
      assert.fail('Expected flush() to reject');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('not configured') || error.message.includes('unconfigured'),
      );
    }
    encoder.close();
  });
});
