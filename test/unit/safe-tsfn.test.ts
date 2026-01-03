/**
 * Tests for SafeThreadSafeFunction wrapper behavior.
 *
 * These tests verify TSFN lifecycle safety indirectly through codec behavior.
 * The SafeTSFN wrapper prevents crashes when rapidly creating/closing codecs.
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

// Import the native addon to test TSFN behavior through codec lifecycle
import {AudioDecoder, AudioEncoder, VideoDecoder, VideoEncoder } from '../../lib/index.js';

describe('SafeThreadSafeFunction lifecycle', () => {
  describe('VideoEncoder rapid lifecycle', () => {
    it('should not crash on rapid create/configure/close cycle', async () => {
      // Rapidly create, configure, and close encoders
      // This stresses the TSFN lifecycle
      for (let i = 0; i < 10; i++) {
        const encoder = new VideoEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.configure({
          codec: 'avc1.42001e',
          width: 640,
          height: 480,
        });

        encoder.close();
      }

      // If we get here without crashing, the test passes
      assert.ok(true, 'Rapid encoder lifecycle completed without crash');
    });

    it('should not crash when closing unconfigured encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      // Close immediately without configuring
      encoder.close();

      assert.ok(true, 'Unconfigured encoder close completed without crash');
    });

    it('should handle multiple close calls gracefully', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
      });

      // Multiple close calls should be idempotent
      encoder.close();
      encoder.close();
      encoder.close();

      assert.ok(true, 'Multiple close calls completed without crash');
    });
  });

  describe('VideoDecoder rapid lifecycle', () => {
    it('should not crash on rapid create/configure/close cycle', async () => {
      for (let i = 0; i < 10; i++) {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({
          codec: 'avc1.42001e',
        });

        decoder.close();
      }

      assert.ok(true, 'Rapid decoder lifecycle completed without crash');
    });

    it('should not crash when closing unconfigured decoder', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      assert.ok(true, 'Unconfigured decoder close completed without crash');
    });

    it('should handle multiple close calls gracefully', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
      });

      decoder.close();
      decoder.close();
      decoder.close();

      assert.ok(true, 'Multiple close calls completed without crash');
    });
  });

  describe('AudioEncoder rapid lifecycle', () => {
    it('should not crash on rapid create/configure/close cycle', async () => {
      for (let i = 0; i < 10; i++) {
        const encoder = new AudioEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate: 48000,
        });

        encoder.close();
      }

      assert.ok(true, 'Rapid audio encoder lifecycle completed without crash');
    });

    it('should not crash when closing unconfigured encoder', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      assert.ok(true, 'Unconfigured audio encoder close completed without crash');
    });
  });

  describe('AudioDecoder rapid lifecycle', () => {
    it('should not crash on rapid create/configure/close cycle', async () => {
      for (let i = 0; i < 10; i++) {
        const decoder = new AudioDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate: 48000,
        });

        decoder.close();
      }

      assert.ok(true, 'Rapid audio decoder lifecycle completed without crash');
    });

    it('should not crash when closing unconfigured decoder', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      assert.ok(true, 'Unconfigured audio decoder close completed without crash');
    });
  });

  describe('Concurrent codec operations', () => {
    it('should handle multiple encoders created and closed concurrently', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          (async () => {
            const encoder = new VideoEncoder({
              output: () => {},
              error: () => {},
            });

            encoder.configure({
              codec: 'avc1.42001e',
              width: 320,
              height: 240,
            });

            // Small delay to allow async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            encoder.close();
          })()
        );
      }

      await Promise.all(promises);

      assert.ok(true, 'Concurrent encoder operations completed without crash');
    });

    it('should handle mixed encoder/decoder lifecycle', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
      });

      decoder.configure({
        codec: 'avc1.42001e',
      });

      // Close in different order than creation
      decoder.close();
      encoder.close();

      assert.ok(true, 'Mixed encoder/decoder lifecycle completed without crash');
    });
  });
});
