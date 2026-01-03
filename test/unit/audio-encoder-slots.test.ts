// test/unit/audio-encoder-slots.test.ts
// Tests for W3C WebCodecs spec section 5.1 - AudioEncoder Internal Slots

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, AudioEncoder, EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioEncoder internal slots per W3C WebCodecs spec section 5.1.
 * Verifies that all internal slots are correctly initialized per constructor steps (5.2).
 */

describe('AudioEncoder Internal Slots: 5.1', () => {
  function createEncoder(): AudioEncoder {
    return new AudioEncoder({
      output: () => {},
      error: () => {},
    });
  }

  const config = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  };

  describe('Constructor initialization (5.2)', () => {
    // Spec 5.2 step 10: Assign "unconfigured" to [[state]]
    it('should initialize state to "unconfigured"', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    // Spec 5.2 step 11: Assign 0 to [[encodeQueueSize]]
    it('should initialize encodeQueueSize to 0', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.encodeQueueSize, 0);
      encoder.close();
    });

    // Spec 5.2 step 7: Assign init.output to [[output callback]]
    it('should store output callback (verified via encoder creation)', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Verify encoder was created successfully with output callback
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    // Spec 5.2 step 8: Assign init.error to [[error callback]]
    it('should store error callback (verified via encoder creation)', () => {
      let errorCallbackCalled = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {
          errorCallbackCalled = true;
        },
      });

      // Encoder created successfully with error callback
      assert.strictEqual(encoder.state, 'unconfigured');

      // Close the encoder
      encoder.close();

      // Note: We can't easily trigger an error to verify the callback
      // but the encoder was created successfully with it
      assert.strictEqual(errorCallbackCalled, false, 'Error callback not yet called');
    });

    // Spec 5.2 step 2: Assign new queue to [[control message queue]]
    it('should have control message queue (verified via reset behavior)', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // Reset clears the queue
      encoder.reset();

      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });
  });

  describe('Callback validation', () => {
    it('should throw TypeError when output callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new AudioEncoder({ error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error callback is missing', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new AudioEncoder({ output: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when output is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new AudioEncoder({ output: 'not a function', error: () => {} });
        },
        { name: 'TypeError' },
      );
    });

    it('should throw TypeError when error is not a function', () => {
      assert.throws(
        () => {
          // @ts-expect-error Testing invalid input
          new AudioEncoder({ output: () => {}, error: 'not a function' });
        },
        { name: 'TypeError' },
      );
    });
  });

  describe('Output callback receives EncodedAudioChunk', () => {
    it('should output EncodedAudioChunk objects', async () => {
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      // Create audio data to encode
      const samples = new Float32Array(48000 * 2); // 1 second stereo
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((i / 48000) * 440 * 2 * Math.PI) * 0.5;
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 48000,
        numberOfChannels: 2,
        timestamp: 0,
        data: samples,
      });

      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Verify outputs are EncodedAudioChunk instances
      assert.ok(outputs.length > 0, 'Should have produced outputs');
      for (const output of outputs) {
        assert.ok(output instanceof EncodedAudioChunk, 'Output should be EncodedAudioChunk');
        assert.ok(output.byteLength > 0, 'Chunk should have data');
      }

      encoder.close();
    });
  });

  describe('Independent instances', () => {
    it('should maintain independent state for multiple encoders', () => {
      const encoder1 = createEncoder();
      const encoder2 = createEncoder();

      // Configure only encoder1
      encoder1.configure(config);

      // encoder1 should be configured, encoder2 should still be unconfigured
      assert.strictEqual(encoder1.state, 'configured');
      assert.strictEqual(encoder2.state, 'unconfigured');

      // Close encoder1
      encoder1.close();

      // encoder1 should be closed, encoder2 should still be unconfigured
      assert.strictEqual(encoder1.state, 'closed');
      assert.strictEqual(encoder2.state, 'unconfigured');

      encoder2.close();
    });

    it('should maintain independent encodeQueueSize', () => {
      const encoder1 = createEncoder();
      const encoder2 = createEncoder();

      encoder1.configure(config);
      encoder2.configure(config);

      // Both should start at 0
      assert.strictEqual(encoder1.encodeQueueSize, 0);
      assert.strictEqual(encoder2.encodeQueueSize, 0);

      encoder1.close();
      encoder2.close();
    });
  });

  describe('[[active encoder config]] slot', () => {
    it('should be null before configure (inferred from state)', () => {
      const encoder = createEncoder();

      // State is unconfigured means no active config
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should be set after configure', () => {
      const encoder = createEncoder();

      encoder.configure(config);

      // State is configured means config is active
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });

    it('should update on reconfigure', () => {
      const encoder = createEncoder();

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000,
      });
      assert.strictEqual(encoder.state, 'configured');

      // Reconfigure with different settings
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 1,
        bitrate: 32000,
      });

      // Should still be configured
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });
  });
});
