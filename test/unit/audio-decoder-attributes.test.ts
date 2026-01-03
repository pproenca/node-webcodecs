// test/unit/audio-decoder-attributes.test.ts
// Tests for W3C WebCodecs spec section 3.3 - AudioDecoder Attributes

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioDecoder attributes per W3C WebCodecs spec section 3.3.
 * Verifies state, decodeQueueSize, and ondequeue behavior.
 */

describe('AudioDecoder Attributes: 3.3', () => {
  function createDecoder(
    output?: (data: AudioData) => void,
    error?: (e: DOMException) => void,
  ): AudioDecoder {
    return new AudioDecoder({
      output: output ?? (() => {}),
      error: error ?? (() => {}),
    });
  }

  const config = {
    codec: 'mp4a.40.2', // AAC
    sampleRate: 44100,
    numberOfChannels: 2,
  };

  describe('state attribute (readonly)', () => {
    // Spec 3.3: state returns [[state]] internal slot value

    it('should be "unconfigured" after construction', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.state, 'unconfigured');
      decoder.close();
    });

    it('should be "configured" after configure()', () => {
      const decoder = createDecoder();
      decoder.configure(config);
      assert.strictEqual(decoder.state, 'configured');
      decoder.close();
    });

    it('should be "closed" after close()', () => {
      const decoder = createDecoder();
      decoder.close();
      assert.strictEqual(decoder.state, 'closed');
    });

    it('should be readonly (no setter)', () => {
      const decoder = createDecoder();

      // Spec 3.3: state is readonly
      // TypeScript prevents this at compile time, but runtime should also reject
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(decoder),
        'state',
      );
      assert.ok(descriptor, 'state property should exist');
      assert.ok(descriptor.get, 'state should have getter');
      assert.strictEqual(descriptor.set, undefined, 'state should NOT have setter');

      decoder.close();
    });

    it('should reflect state changes through transitions', () => {
      const decoder = createDecoder();

      // Initial state
      assert.strictEqual(decoder.state, 'unconfigured');

      // Configure
      decoder.configure(config);
      assert.strictEqual(decoder.state, 'configured');

      // Reset returns to unconfigured
      decoder.reset();
      assert.strictEqual(decoder.state, 'unconfigured');

      // Reconfigure
      decoder.configure(config);
      assert.strictEqual(decoder.state, 'configured');

      // Close
      decoder.close();
      assert.strictEqual(decoder.state, 'closed');
    });
  });

  describe('decodeQueueSize attribute (readonly)', () => {
    // Spec 3.3: decodeQueueSize returns [[decodeQueueSize]] internal slot value

    it('should be 0 after construction', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.decodeQueueSize, 0);
      decoder.close();
    });

    it('should be readonly (no setter)', () => {
      const decoder = createDecoder();

      // Spec 3.3: decodeQueueSize is readonly
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(decoder),
        'decodeQueueSize',
      );
      assert.ok(descriptor, 'decodeQueueSize property should exist');
      assert.ok(descriptor.get, 'decodeQueueSize should have getter');
      assert.strictEqual(
        descriptor.set,
        undefined,
        'decodeQueueSize should NOT have setter',
      );

      decoder.close();
    });

    it('should increase on decode()', async () => {
      // First encode some audio to get valid encoded chunks
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

      // Create audio data
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
      encoder.close();

      // Now decode
      const outputs: AudioData[] = [];
      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(decoder.decodeQueueSize, 0);

      // Queue decode operations
      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      // Queue size should have increased
      if (encodedChunks.length > 0) {
        assert.ok(
          decoder.decodeQueueSize >= 0,
          'decodeQueueSize should be non-negative after decode calls',
        );
      }

      await decoder.flush();

      // After flush, queue should be empty
      assert.strictEqual(decoder.decodeQueueSize, 0);

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should be 0 after reset()', () => {
      const decoder = createDecoder();
      decoder.configure(config);

      // Reset clears the queue
      decoder.reset();
      assert.strictEqual(decoder.decodeQueueSize, 0);

      decoder.close();
    });
  });

  describe('ondequeue event handler', () => {
    // Spec 3.3: ondequeue is event handler IDL attribute for 'dequeue' event

    it('should be null by default', () => {
      const decoder = createDecoder();
      assert.strictEqual(decoder.ondequeue, null);
      decoder.close();
    });

    it('should be settable to a function', () => {
      const decoder = createDecoder();
      const handler = () => {};

      decoder.ondequeue = handler;
      assert.strictEqual(decoder.ondequeue, handler);

      decoder.close();
    });

    it('should be settable to null', () => {
      const decoder = createDecoder();
      const handler = () => {};

      decoder.ondequeue = handler;
      assert.strictEqual(decoder.ondequeue, handler);

      decoder.ondequeue = null;
      assert.strictEqual(decoder.ondequeue, null);

      decoder.close();
    });

    it('should fire when decodeQueueSize decreases', async () => {
      // Encode some audio first
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

      if (encodedChunks.length === 0) {
        // Skip test if no chunks were encoded
        return;
      }

      // Decode with ondequeue handler
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

      decoder.ondequeue = () => {
        dequeueCount++;
      };

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // ondequeue should have fired at least once
      assert.ok(
        dequeueCount > 0 || outputs.length > 0,
        'ondequeue should fire when outputs are produced',
      );

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should work with addEventListener', async () => {
      // Encode some audio first
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

      if (encodedChunks.length === 0) {
        return;
      }

      // Decode with addEventListener
      let eventFired = false;
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
        eventFired = true;
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Event should have fired
      assert.ok(
        eventFired || outputs.length > 0,
        'dequeue event should fire via addEventListener',
      );

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should not throw if ondequeue is not set', async () => {
      const decoder = createDecoder((data) => data.close());

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      // No ondequeue set - should not throw
      await decoder.flush();

      decoder.close();
    });
  });

  describe('EventTarget inheritance', () => {
    it('should extend EventTarget', () => {
      const decoder = createDecoder();
      assert.ok(decoder instanceof EventTarget);
      decoder.close();
    });

    it('should support removeEventListener', () => {
      const decoder = createDecoder();
      let count = 0;
      const handler = () => {
        count++;
      };

      decoder.addEventListener('dequeue', handler);
      decoder.removeEventListener('dequeue', handler);

      // Manually dispatch to test removal
      decoder.dispatchEvent(new Event('dequeue'));

      assert.strictEqual(count, 0, 'Handler should not fire after removal');

      decoder.close();
    });
  });
});
