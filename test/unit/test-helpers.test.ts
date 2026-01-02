// test/unit/test-helpers.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withVideoEncoder, withVideoFrame } from '../fixtures/test-helpers';

describe('Test Helpers', () => {
  describe('withVideoEncoder', () => {
    it('should create encoder, run callback, and close automatically', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await withVideoEncoder(async (encoder) => {
        capturedEncoder = encoder;
        assert.strictEqual(encoder.state, 'unconfigured');
      });

      // After callback, encoder should be closed
      assert.strictEqual(capturedEncoder?.state, 'closed');
    });

    it('should close encoder even when callback throws', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await assert.rejects(
        withVideoEncoder(async (encoder) => {
          capturedEncoder = encoder;
          throw new Error('Test error');
        }),
        { message: 'Test error' }
      );

      assert.strictEqual(capturedEncoder?.state, 'closed');
    });
  });

  describe('withVideoFrame', () => {
    it('should create frame, run callback, and close automatically', async () => {
      let capturedFrame: VideoFrame | null = null;

      await withVideoFrame(
        { width: 64, height: 64, format: 'RGBA', timestamp: 0 },
        async (frame) => {
          capturedFrame = frame;
          assert.strictEqual(frame.codedWidth, 64);
        }
      );

      // Frame should be closed after callback
      assert.strictEqual(capturedFrame?.format, null);
    });
  });
});
