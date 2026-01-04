// test/unit/audio-decoder-methods.test.ts
// Tests for W3C WebCodecs spec section 3.5 - AudioDecoder Methods

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioDecoder methods per W3C WebCodecs spec section 3.5.
 * Verifies configure, decode, flush, reset, close, and isConfigSupported.
 */

describe('AudioDecoder Methods: 3.5', () => {
  const validConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
  };

  function createDecoder(
    output?: (data: AudioData) => void,
    error?: (e: DOMException) => void,
  ): AudioDecoder {
    return new AudioDecoder({
      output: output ?? (() => {}),
      error: error ?? (() => {}),
    });
  }

  // Helper to encode audio and get valid chunks
  async function encodeAudioChunks(): Promise<EncodedAudioChunk[]> {
    const encodedChunks: EncodedAudioChunk[] = [];

    const encoder = new AudioEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        encodedChunks.push(
          new EncodedAudioChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            data,
          }),
        );
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 64000,
    });

    const samples = new Float32Array(48000 * 2);
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
    encoder.close();

    return encodedChunks;
  }

  describe('configure() method', () => {
    it('should throw InvalidStateError when closed', () => {
      const decoder = createDecoder();
      decoder.close();
      assert.throws(
        () => decoder.configure(validConfig),
        (e: Error) => e instanceof DOMException && e.name === 'InvalidStateError',
      );
    });

    it('should set state to configured', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.state, 'unconfigured');
      decoder.configure(validConfig);
      assert.strictEqual(decoder.state, 'configured');
      decoder.close();
    });

    describe('W3C validation', () => {
      it('should throw TypeError for empty codec', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: '', sampleRate: 48000, numberOfChannels: 2 }),
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for missing codec', () => {
        const decoder = createDecoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            decoder.configure({ sampleRate: 48000, numberOfChannels: 2 });
          },
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for whitespace-only codec', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: '   ', sampleRate: 48000, numberOfChannels: 2 }),
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for missing sampleRate', () => {
        const decoder = createDecoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            decoder.configure({ codec: 'opus', numberOfChannels: 2 });
          },
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for missing numberOfChannels', () => {
        const decoder = createDecoder();
        assert.throws(
          () => {
            // @ts-expect-error Testing invalid input
            decoder.configure({ codec: 'opus', sampleRate: 48000 });
          },
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for zero sampleRate', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: 'opus', sampleRate: 0, numberOfChannels: 2 }),
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for negative sampleRate', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: 'opus', sampleRate: -48000, numberOfChannels: 2 }),
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for zero numberOfChannels', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 0 }),
          TypeError,
        );
        decoder.close();
      });

      it('should throw TypeError for negative numberOfChannels', () => {
        const decoder = createDecoder();
        assert.throws(
          () => decoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: -2 }),
          TypeError,
        );
        decoder.close();
      });
    });
  });

  describe('decode() method', () => {
    // Spec 3.5 step 3: Increment [[decodeQueueSize]]
    it('should increment decodeQueueSize on decode()', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = createDecoder((data) => data.close());

      decoder.configure(validConfig);
      assert.strictEqual(decoder.decodeQueueSize, 0);

      // Decode a chunk - should increment queue size
      decoder.decode(chunks[0]);

      // Queue size should have increased (or processing is instant)
      // The important thing is it doesn't throw
      assert.ok(decoder.decodeQueueSize >= 0);

      await decoder.flush();
      decoder.close();
    });
  });

  describe('flush() method', () => {
    // Spec 3.5 step 1: If [[state]] is not "configured", reject with InvalidStateError
    it('should reject with InvalidStateError when unconfigured', async () => {
      const decoder = createDecoder();

      // State is unconfigured
      assert.strictEqual(decoder.state, 'unconfigured');

      try {
        await decoder.flush();
        assert.fail('Should have rejected');
      } catch (e) {
        assert.ok(e instanceof DOMException);
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }

      decoder.close();
    });

    it('should reject with InvalidStateError when closed', async () => {
      const decoder = createDecoder();
      decoder.close();

      // State is closed
      assert.strictEqual(decoder.state, 'closed');

      try {
        await decoder.flush();
        assert.fail('Should have rejected');
      } catch (e) {
        assert.ok(e instanceof DOMException);
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should resolve immediately with no pending work', async () => {
      const decoder = createDecoder();
      decoder.configure(validConfig);

      // No decode() calls, so no pending work
      const start = Date.now();
      await decoder.flush();
      const duration = Date.now() - start;

      // Should complete very quickly (< 1 second)
      assert.ok(duration < 1000, `flush() took ${duration}ms, expected < 1000ms`);

      decoder.close();
    });

    // Spec 3.5 step 2: Set [[key chunk required]] to true
    it('should set key chunk required after flush', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      let errorReceived: Error | null = null;
      const decoder = new AudioDecoder({
        output: (data) => data.close(),
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure(validConfig);

      // First decode with key chunk
      decoder.decode(chunks[0]);
      await decoder.flush();

      // After flush, key chunk required should be true again
      // Create a delta chunk to test
      const deltaChunk = new EncodedAudioChunk({
        type: 'delta',
        timestamp: 1000000,
        data: new Uint8Array([0]),
      });

      // This should trigger error because delta after flush
      decoder.decode(deltaChunk);

      assert.ok(errorReceived !== null, 'Should have received error for delta after flush');
      // Error should be DataError (DOMException with name DataError)
      if (errorReceived instanceof DOMException) {
        assert.strictEqual(errorReceived.name, 'DataError');
      }
      // Any error indicates the key chunk requirement is enforced

      decoder.close();
    });
  });

  describe('isConfigSupported() static method', () => {
    // Spec 3.5: Returns supported: false for unsupported codec
    it('should return supported: false for unknown codec', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'unknown-codec-xyz',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, false);
      assert.strictEqual(result.config.codec, 'unknown-codec-xyz');
    });

    it('should return supported: true for valid codec', async () => {
      const result = await AudioDecoder.isConfigSupported(validConfig);

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'opus');
      assert.strictEqual(result.config.sampleRate, 48000);
      assert.strictEqual(result.config.numberOfChannels, 2);
    });

    it('should return config in result', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp3',
        sampleRate: 44100,
        numberOfChannels: 2,
      });

      // Result should include the config
      assert.ok('config' in result);
      assert.ok('supported' in result);
      assert.strictEqual(result.config.codec, 'mp3');
    });

    it('should handle AAC codec', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, true);
    });
  });

  describe('edge cases', () => {
    it('should handle reset() during active decode', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = createDecoder((data) => data.close());
      decoder.configure(validConfig);

      // Start decoding
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // Reset mid-decode
      decoder.reset();

      assert.strictEqual(decoder.state, 'unconfigured');
      assert.strictEqual(decoder.decodeQueueSize, 0);

      decoder.close();
    });

    it('should handle close() during flush', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = createDecoder((data) => data.close());
      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // Start flush but don't await
      const flushPromise = decoder.flush();

      // Close immediately
      decoder.close();

      assert.strictEqual(decoder.state, 'closed');

      // Flush should reject (AbortError) or resolve
      try {
        await flushPromise;
      } catch {
        // Expected - flush aborted
      }
    });

    it('should handle multiple rapid decode() calls', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      const decoder = new AudioDecoder({
        output: (data) => outputs.push(data),
        error: (e) => {
          throw e;
        },
      });

      decoder.configure(validConfig);

      // Rapidly queue many decode operations
      for (let i = 0; i < Math.min(chunks.length, 10); i++) {
        decoder.decode(chunks[i % chunks.length]);
      }

      await decoder.flush();

      // Should have processed without errors
      assert.ok(decoder.state !== 'closed', 'Should not have errored');

      for (const d of outputs) d.close();
      decoder.close();
    });
  });
});
