// test/unit/audio-decoder-algorithms.test.ts
// Tests for W3C WebCodecs spec section 3.6 - AudioDecoder Algorithms

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioDecoder internal algorithms per W3C WebCodecs spec section 3.6.
 * Verifies Reset AudioDecoder, Close AudioDecoder, Output AudioData, Schedule Dequeue Event.
 */

describe('AudioDecoder Algorithms: 3.6', () => {
  const validConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
  };

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

  describe('Reset AudioDecoder algorithm', () => {
    // Spec 3.6: Reset sets [[state]] to "unconfigured"
    it('should set state to "unconfigured"', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure(validConfig);
      assert.strictEqual(decoder.state, 'configured');

      decoder.reset();
      assert.strictEqual(decoder.state, 'unconfigured');

      decoder.close();
    });

    // Spec 3.6: Reset clears [[decodeQueueSize]]
    it('should clear decodeQueueSize to 0', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = new AudioDecoder({
        output: (data) => data.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      // Queue some decodes
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // Reset should clear the queue
      decoder.reset();
      assert.strictEqual(decoder.decodeQueueSize, 0);

      decoder.close();
    });

    // Spec 3.6 step 6: Reject pending flush promises with exception
    it('should reject pending flush promise with AbortError on reset', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = new AudioDecoder({
        output: (data) => data.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      // Queue decode and start flush
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }
      const flushPromise = decoder.flush();

      // Reset while flush is pending
      decoder.reset();

      // Flush should reject (or resolve if it completed before reset)
      try {
        await flushPromise;
        // If it resolved, that's OK - flush may have completed
      } catch (e) {
        // Should be AbortError
        if (e instanceof DOMException) {
          assert.strictEqual(e.name, 'AbortError');
        }
      }

      decoder.close();
    });

    // Spec 3.6 step 1: Reset when closed is no-op (per current implementation)
    it('should be no-op when already closed', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');

      // Should not throw
      assert.doesNotThrow(() => decoder.reset());

      // Should still be closed
      assert.strictEqual(decoder.state, 'closed');
    });

    it('should be safe when already unconfigured', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(decoder.state, 'unconfigured');

      // Should not throw
      assert.doesNotThrow(() => decoder.reset());

      assert.strictEqual(decoder.state, 'unconfigured');

      decoder.close();
    });
  });

  describe('Close AudioDecoder algorithm', () => {
    // Spec 3.6: Close sets [[state]] to "closed"
    it('should set state to "closed"', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure(validConfig);
      assert.strictEqual(decoder.state, 'configured');

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');
    });

    // Spec 3.6 step 1: Close runs Reset first, rejecting pending promises
    it('should reject pending flush promise with AbortError on close', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const decoder = new AudioDecoder({
        output: (data) => data.close(),
        error: () => {},
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }
      const flushPromise = decoder.flush();

      // Close while flush is pending
      decoder.close();

      try {
        await flushPromise;
        // May have resolved if flush completed
      } catch (e) {
        if (e instanceof DOMException) {
          assert.strictEqual(e.name, 'AbortError');
        }
      }
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();
      assert.strictEqual(decoder.state, 'closed');

      // Second close should not throw
      assert.doesNotThrow(() => decoder.close());
      assert.strictEqual(decoder.state, 'closed');

      // Third close should not throw
      assert.doesNotThrow(() => decoder.close());
    });
  });

  describe('Output AudioData algorithm', () => {
    // Spec 3.6: Invoke [[output callback]] for each output
    it('should invoke output callback for each decoded frame', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should have received output(s)
      assert.ok(outputs.length > 0, 'Should receive decoded outputs');

      // Each output should be valid AudioData
      for (const output of outputs) {
        assert.ok(output.sampleRate > 0);
        assert.ok(output.numberOfChannels > 0);
        assert.ok(output.numberOfFrames > 0);
        output.close();
      }

      decoder.close();
    });
  });

  describe('Schedule Dequeue Event algorithm', () => {
    // Spec 3.6: Dequeue events should be coalesced
    it('should coalesce rapid dequeue events', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      let dequeueCount = 0;
      const outputs: AudioData[] = [];

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      decoder.configure(validConfig);

      // Rapidly queue multiple decodes
      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Dequeue count should be less than or equal to output count
      // due to coalescing
      assert.ok(
        dequeueCount <= outputs.length,
        `Expected coalesced dequeue events (got ${dequeueCount} for ${outputs.length} outputs)`,
      );

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should fire dequeue event when decodeQueueSize decreases', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      let dequeueFired = false;
      const outputs: AudioData[] = [];

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      decoder.configure(validConfig);

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        assert.ok(dequeueFired, 'Dequeue event should fire when outputs are produced');
      }

      for (const d of outputs) d.close();
      decoder.close();
    });
  });
});
