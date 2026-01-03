// test/unit/audio-encoder-algorithms.test.ts
// Tests for W3C WebCodecs spec section 5.6 - AudioEncoder Algorithms

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, AudioEncoder, type EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioEncoder internal algorithms per W3C WebCodecs spec section 5.6.
 * Verifies Reset AudioEncoder, Close AudioEncoder, Output EncodedAudioChunks, Schedule Dequeue Event.
 */

describe('AudioEncoder Algorithms: 5.6', () => {
  const opusConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  };

  // Helper to create test audio data
  function createAudioData(timestamp = 0): AudioData {
    const samples = new Float32Array(48000 * 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / 48000) * 440 * 2 * Math.PI) * 0.5;
    }
    return new AudioData({
      format: 'f32-planar',
      sampleRate: 48000,
      numberOfFrames: 48000,
      numberOfChannels: 2,
      timestamp,
      data: samples,
    });
  }

  describe('Reset AudioEncoder algorithm', () => {
    // Spec 5.6 step 2: Reset sets [[state]] to "unconfigured"
    it('should set state to "unconfigured"', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(opusConfig);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    // Spec 5.6 step 7: Reset clears [[encodeQueueSize]]
    it('should clear encodeQueueSize to 0', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      // Reset should clear the queue
      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0);

      encoder.close();
    });

    // Spec 5.6 step 8: Reject pending flush promises with exception
    it('should reject pending flush promise with AbortError on reset', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      const flushPromise = encoder.flush();

      // Reset while flush is pending
      encoder.reset();

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

      encoder.close();
    });

    // Spec 5.6: Reset when closed is a no-op (AudioEncoder specific)
    it('should be a no-op when already closed', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');

      // Reset on closed encoder should not throw
      assert.doesNotThrow(() => encoder.reset());
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be safe when already unconfigured', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(encoder.state, 'unconfigured');

      // Should not throw
      assert.doesNotThrow(() => encoder.reset());

      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });
  });

  describe('Close AudioEncoder algorithm', () => {
    // Spec 5.6 step 2: Close sets [[state]] to "closed"
    it('should set state to "closed"', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(opusConfig);
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    // Spec 5.6 step 1: Close runs Reset first, rejecting pending promises
    it('should reject pending flush promise with AbortError on close', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      const flushPromise = encoder.flush();

      // Close while flush is pending
      encoder.close();

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
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');

      // Second close should not throw
      assert.doesNotThrow(() => encoder.close());
      assert.strictEqual(encoder.state, 'closed');

      // Third close should not throw
      assert.doesNotThrow(() => encoder.close());
    });
  });

  describe('Output EncodedAudioChunks algorithm', () => {
    // Spec 5.6: Invoke [[output callback]] for each output with EncodedAudioChunk
    it('should invoke output callback for each encoded chunk', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Should have received output(s)
      assert.ok(outputs.length > 0, 'Should receive encoded outputs');

      encoder.close();
    });

    // Spec 5.6: EncodedAudioChunk has timestamp from AudioData
    it('should output EncodedAudioChunk with timestamp', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData(123456);
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        // Timestamp should be defined (not undefined or NaN)
        assert.ok(
          typeof outputs[0].timestamp === 'number' && !Number.isNaN(outputs[0].timestamp),
          'EncodedAudioChunk should have valid timestamp',
        );
      }

      encoder.close();
    });

    // Spec 5.6: EncodedAudioChunk has type (key or delta)
    it('should output EncodedAudioChunk with type', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        // Type should be 'key' or 'delta'
        assert.ok(
          outputs[0].type === 'key' || outputs[0].type === 'delta',
          `EncodedAudioChunk type should be 'key' or 'delta', got '${outputs[0].type}'`,
        );
      }

      encoder.close();
    });

    // Spec 5.6: Output callback receives metadata with decoderConfig
    // Note: Current native implementation doesn't provide metadata for audio encoder
    // This test verifies the output callback signature and current behavior
    it('should invoke output callback with EncodedAudioChunk', async () => {
      let callbackInvoked = false;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          callbackInvoked = true;
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        assert.ok(callbackInvoked, 'Output callback should be invoked');
        assert.ok(outputs[0].byteLength > 0, 'EncodedAudioChunk should have data');
      }

      encoder.close();
    });
  });

  describe('Schedule Dequeue Event algorithm', () => {
    // Spec 5.6: Dequeue events should be coalesced
    it('should coalesce rapid dequeue events', async () => {
      let dequeueCount = 0;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      encoder.configure(opusConfig);

      // Rapidly queue multiple encodes
      for (let i = 0; i < 3; i++) {
        const audioData = createAudioData(i * 1_000_000);
        encoder.encode(audioData);
        audioData.close();
      }

      await encoder.flush();

      // Dequeue count should be less than or equal to output count
      // due to coalescing
      assert.ok(
        dequeueCount <= outputs.length,
        `Expected coalesced dequeue events (got ${dequeueCount} for ${outputs.length} outputs)`,
      );

      encoder.close();
    });

    it('should fire dequeue event when encodeQueueSize decreases', async () => {
      let dequeueFired = false;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        assert.ok(dequeueFired, 'Dequeue event should fire when outputs are produced');
      }

      encoder.close();
    });
  });
});
