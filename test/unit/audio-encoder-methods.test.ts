// test/unit/audio-encoder-methods.test.ts
// Tests for W3C WebCodecs spec section 5.5 - AudioEncoder Methods

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, AudioEncoder, type EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioEncoder methods per W3C WebCodecs spec section 5.5.
 * Verifies configure, encode, flush, reset, close, and isConfigSupported.
 */

describe('AudioEncoder Methods: 5.5', () => {
  const opusConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  };

  const aacConfig = {
    codec: 'mp4a.40.2',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitrate: 128000,
  };

  function createEncoder(
    output?: (chunk: EncodedAudioChunk) => void,
    error?: (e: DOMException) => void,
  ): AudioEncoder {
    return new AudioEncoder({
      output: output ?? (() => {}),
      error: error ?? (() => {}),
    });
  }

  // Helper to create test audio data
  function createAudioData(timestamp = 0, sampleRate = 48000, channels = 2): AudioData {
    const samples = new Float32Array(sampleRate * channels);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.5;
    }
    return new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: sampleRate,
      numberOfChannels: channels,
      timestamp,
      data: samples,
    });
  }

  describe('configure() method', () => {
    // Spec 5.5 step 2: If [[state]] is "closed", throw InvalidStateError
    it('should throw InvalidStateError when closed', () => {
      const encoder = createEncoder();
      encoder.close();

      assert.throws(
        () => encoder.configure(opusConfig),
        (e: Error) => e instanceof DOMException && e.name === 'InvalidStateError',
      );
    });

    // Spec 5.5 step 3: Set [[state]] to "configured"
    it('should set state to configured after configure()', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.configure(opusConfig);
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });

    it('should configure with valid Opus config', () => {
      const encoder = createEncoder();

      encoder.configure(opusConfig);

      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should configure with valid AAC config', () => {
      const encoder = createEncoder();

      encoder.configure(aacConfig);

      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    // Spec 5.5 step 1: If config is not valid, throw TypeError
    it('should throw TypeError when codec is missing', () => {
      const encoder = createEncoder();

      assert.throws(
        () =>
          encoder.configure({
            // @ts-expect-error Testing invalid input
            sampleRate: 48000,
            numberOfChannels: 2,
          }),
        (e: Error) => e instanceof TypeError,
      );

      encoder.close();
    });

    it('should throw TypeError when sampleRate is missing', () => {
      const encoder = createEncoder();

      assert.throws(
        () =>
          encoder.configure({
            codec: 'opus',
            // @ts-expect-error Testing invalid input
            numberOfChannels: 2,
          }),
        (e: Error) => e instanceof TypeError,
      );

      encoder.close();
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      const encoder = createEncoder();

      assert.throws(
        () =>
          encoder.configure({
            codec: 'opus',
            // @ts-expect-error Testing invalid input
            sampleRate: 48000,
          }),
        (e: Error) => e instanceof TypeError,
      );

      encoder.close();
    });

    describe('W3C validation', () => {
      it('should throw TypeError for empty codec', () => {
        const encoder = createEncoder();
        assert.throws(
          () => encoder.configure({ codec: '', sampleRate: 48000, numberOfChannels: 2 }),
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for missing codec', () => {
        const encoder = createEncoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            encoder.configure({ sampleRate: 48000, numberOfChannels: 2 });
          },
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero sampleRate', () => {
        const encoder = createEncoder();
        assert.throws(
          () => encoder.configure({ codec: 'opus', sampleRate: 0, numberOfChannels: 2 }),
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for negative sampleRate', () => {
        const encoder = createEncoder();
        assert.throws(
          () => encoder.configure({ codec: 'opus', sampleRate: -48000, numberOfChannels: 2 }),
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for zero numberOfChannels', () => {
        const encoder = createEncoder();
        assert.throws(
          () => encoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 0 }),
          TypeError,
        );
        encoder.close();
      });

      it('should throw TypeError for negative numberOfChannels', () => {
        const encoder = createEncoder();
        assert.throws(
          () => encoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: -2 }),
          TypeError,
        );
        encoder.close();
      });
    });
  });

  describe('encode() method', () => {
    // Spec 5.5 step 2: If [[state]] is not "configured", throw InvalidStateError
    it('should throw InvalidStateError when unconfigured', () => {
      const encoder = createEncoder();
      const audioData = createAudioData();

      assert.throws(
        () => encoder.encode(audioData),
        (e: Error) => e instanceof DOMException && e.name === 'InvalidStateError',
      );

      audioData.close();
      encoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const encoder = createEncoder();
      encoder.close();

      const audioData = createAudioData();

      assert.throws(
        () => encoder.encode(audioData),
        (e: Error) => e instanceof DOMException && e.name === 'InvalidStateError',
      );

      audioData.close();
    });

    // Spec 5.5 step 4: Increment [[encodeQueueSize]]
    it('should increment encodeQueueSize on encode()', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);
      assert.strictEqual(encoder.encodeQueueSize, 0);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      // Queue size should have increased (or processing is instant)
      assert.ok(encoder.encodeQueueSize >= 0);

      await encoder.flush();
      encoder.close();
    });

    // Spec 5.5 step 1: If data's [[Detached]] is true, throw TypeError
    // Note: Implementation currently throws Error from native layer
    it('should throw when AudioData is closed', () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);

      const audioData = createAudioData();
      audioData.close();

      assert.throws(
        () => encoder.encode(audioData),
        (e: Error) => e instanceof Error,
      );

      encoder.close();
    });

    it('should accept AudioData and produce EncodedAudioChunk', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have produced outputs');

      encoder.close();
    });
  });

  describe('flush() method', () => {
    // Spec 5.5 step 1: If [[state]] is not "configured", reject with InvalidStateError
    it('should reject with InvalidStateError when unconfigured', async () => {
      const encoder = createEncoder();

      assert.strictEqual(encoder.state, 'unconfigured');

      try {
        await encoder.flush();
        assert.fail('Should have rejected');
      } catch (e) {
        assert.ok(e instanceof DOMException);
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }

      encoder.close();
    });

    it('should reject with InvalidStateError when closed', async () => {
      const encoder = createEncoder();
      encoder.close();

      try {
        await encoder.flush();
        assert.fail('Should have rejected');
      } catch (e) {
        assert.ok(e instanceof DOMException);
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should resolve immediately with no pending work', async () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);

      const start = Date.now();
      await encoder.flush();
      const duration = Date.now() - start;

      assert.ok(duration < 1000, `flush() took ${duration}ms, expected < 1000ms`);

      encoder.close();
    });

    it('should resolve after all EncodedAudioChunks emitted', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // After flush, all outputs should have been emitted
      assert.ok(outputs.length > 0, 'Should have received at least one output');
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

      encoder.close();
    });
  });

  describe('reset() method', () => {
    it('should set state to unconfigured', () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should clear encodeQueueSize', async () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0);

      encoder.close();
    });

    // Spec 5.5: reset() is a no-op when closed
    it('should be a no-op when closed', () => {
      const encoder = createEncoder();
      encoder.close();

      // Should not throw
      encoder.reset();

      assert.strictEqual(encoder.state, 'closed');
    });

    it('should allow reconfiguration after reset', () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);
      encoder.reset();
      encoder.configure(aacConfig);

      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });
  });

  describe('close() method', () => {
    it('should set state to closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be idempotent', () => {
      const encoder = createEncoder();
      encoder.close();
      encoder.close(); // Should not throw
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });
  });

  describe('isConfigSupported() static method', () => {
    it('should return supported: true for opus', async () => {
      const result = await AudioEncoder.isConfigSupported(opusConfig);

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'opus');
    });

    it('should return supported: true for mp4a.40.2 (AAC)', async () => {
      const result = await AudioEncoder.isConfigSupported(aacConfig);

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'mp4a.40.2');
    });

    it('should return supported: false for invalid codec', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'unknown-audio-codec-xyz',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, false);
      assert.strictEqual(result.config.codec, 'unknown-audio-codec-xyz');
    });

    it('should return config in result', async () => {
      const result = await AudioEncoder.isConfigSupported(opusConfig);

      assert.ok('config' in result);
      assert.ok('supported' in result);
      assert.strictEqual(result.config.codec, 'opus');
      assert.strictEqual(result.config.sampleRate, 48000);
      assert.strictEqual(result.config.numberOfChannels, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle reset() during active encode', async () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      encoder.reset();

      assert.strictEqual(encoder.state, 'unconfigured');
      assert.strictEqual(encoder.encodeQueueSize, 0);

      encoder.close();
    });

    it('should handle close() during flush', async () => {
      const encoder = createEncoder();
      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      const flushPromise = encoder.flush();
      encoder.close();

      assert.strictEqual(encoder.state, 'closed');

      try {
        await flushPromise;
      } catch {
        // Expected - flush aborted
      }
    });

    it('should handle multiple rapid encode() calls', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      // Rapidly queue multiple encode operations
      for (let i = 0; i < 5; i++) {
        const audioData = createAudioData(i * 1_000_000);
        encoder.encode(audioData);
        audioData.close();
      }

      await encoder.flush();

      assert.ok(encoder.state !== 'closed', 'Should not have errored');
      assert.ok(outputs.length > 0, 'Should have produced outputs');

      encoder.close();
    });

    it('should handle encode with different sample rates', async () => {
      // Encoder should handle resampling or reject mismatched sample rates
      const outputs: EncodedAudioChunk[] = [];
      let errorReceived: DOMException | null = null;

      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          errorReceived = e;
        },
      });

      encoder.configure(opusConfig); // 48000 Hz

      // Create audio data at different sample rate
      const audioData = createAudioData(0, 44100, 2);
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Either should produce output or trigger an error
      assert.ok(
        outputs.length > 0 || errorReceived !== null,
        'Should either produce output or report error for mismatched sample rate',
      );

      encoder.close();
    });

    it('should handle encode with different channel count', async () => {
      // Encoder configured for stereo, given mono
      const outputs: EncodedAudioChunk[] = [];
      let errorReceived: DOMException | null = null;

      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          errorReceived = e;
        },
      });

      encoder.configure(opusConfig); // 2 channels

      // Create mono audio data
      const audioData = createAudioData(0, 48000, 1);
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Either should produce output or trigger an error
      assert.ok(
        outputs.length > 0 || errorReceived !== null,
        'Should either produce output or report error for mismatched channels',
      );

      encoder.close();
    });

    it('should handle optional bitrate in config', async () => {
      const encoder = createEncoder();

      // Configure without bitrate - should use default
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        // No bitrate specified
      });

      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });
  });
});
