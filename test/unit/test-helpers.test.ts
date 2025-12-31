// test/unit/test-helpers.test.ts
import { describe, expect, it } from 'vitest';
import { withVideoEncoder, withVideoFrame } from '../fixtures/test-helpers';

describe('Test Helpers', () => {
  describe('withVideoEncoder', () => {
    it('should create encoder, run callback, and close automatically', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await withVideoEncoder(async (encoder) => {
        capturedEncoder = encoder;
        expect(encoder.state).toBe('unconfigured');
      });

      // After callback, encoder should be closed
      expect(capturedEncoder?.state).toBe('closed');
    });

    it('should close encoder even when callback throws', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await expect(withVideoEncoder(async (encoder) => {
        capturedEncoder = encoder;
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      expect(capturedEncoder?.state).toBe('closed');
    });
  });

  describe('withVideoFrame', () => {
    it('should create frame, run callback, and close automatically', async () => {
      let capturedFrame: VideoFrame | null = null;

      await withVideoFrame(
        { width: 64, height: 64, format: 'RGBA', timestamp: 0 },
        async (frame) => {
          capturedFrame = frame;
          expect(frame.codedWidth).toBe(64);
        }
      );

      // Frame should be closed after callback
      expect(capturedFrame?.format).toBeNull();
    });
  });
});
