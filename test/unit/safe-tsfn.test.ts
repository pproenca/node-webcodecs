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

  describe('Worker thread lifecycle', () => {
    it('worker starts on first encode/decode operation', async () => {
      // The worker thread should be started when configure is called
      // and the codec begins processing operations.
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
      });

      // At this point the worker should be started internally
      // We verify by checking the state transitions work correctly
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    it('worker shuts down cleanly on close()', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
      });

      assert.strictEqual(decoder.state, 'configured');

      // Close should trigger worker shutdown
      decoder.close();
      assert.strictEqual(decoder.state, 'closed');

      // Attempting operations after close should fail gracefully
      assert.throws(() => {
        decoder.configure({codec: 'avc1.42001e'});
      }, /closed/i);
    });

    it('no crashes on rapid close() after operations', async () => {
      // Stress test: rapid configure and close cycles
      // This exercises the worker start/stop lifecycle
      for (let i = 0; i < 20; i++) {
        const encoder = new VideoEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.configure({
          codec: 'avc1.42001e',
          width: 320,
          height: 240,
        });

        // Immediately close after configure
        encoder.close();
      }

      // If we reach here without crashes, the test passes
      assert.ok(true, 'Rapid close after operations completed without crash');
    });

    it('handles close during pending flush', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
      });

      // Start a flush (returns promise)
      const flushPromise = encoder.flush();

      // Close before flush completes
      encoder.close();

      // The flush promise should reject or resolve
      try {
        await flushPromise;
      } catch {
        // Expected - flush was aborted by close
      }

      assert.strictEqual(encoder.state, 'closed');
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
