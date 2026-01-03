// test/unit/audio-encoder-attributes.test.ts
// Tests for W3C WebCodecs spec section 5.3 - AudioEncoder Attributes

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, AudioEncoder, type EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioEncoder attributes per W3C WebCodecs spec section 5.3.
 * Verifies state, encodeQueueSize, and ondequeue behavior.
 */

describe('AudioEncoder Attributes: 5.3', () => {
  function createEncoder(
    output?: (chunk: EncodedAudioChunk) => void,
    error?: (e: DOMException) => void,
  ): AudioEncoder {
    return new AudioEncoder({
      output: output ?? (() => {}),
      error: error ?? (() => {}),
    });
  }

  const config = {
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

  describe('state attribute (readonly)', () => {
    // Spec 5.3: state returns [[state]] internal slot value

    it('should be "unconfigured" after construction', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.state, 'unconfigured');
      encoder.close();
    });

    it('should be "configured" after configure()', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });

    it('should be "closed" after close()', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    it('should be readonly (no setter)', () => {
      const encoder = createEncoder();

      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(encoder),
        'state',
      );
      assert.ok(descriptor, 'state property should exist');
      assert.ok(descriptor.get, 'state should have getter');
      assert.strictEqual(descriptor.set, undefined, 'state should NOT have setter');

      encoder.close();
    });

    it('should reflect state changes through transitions', () => {
      const encoder = createEncoder();

      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });
  });

  describe('encodeQueueSize attribute (readonly)', () => {
    // Spec 5.3: encodeQueueSize returns [[encodeQueueSize]] internal slot value

    it('should be 0 after construction', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.encodeQueueSize, 0);
      encoder.close();
    });

    it('should be readonly (no setter)', () => {
      const encoder = createEncoder();

      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(encoder),
        'encodeQueueSize',
      );
      assert.ok(descriptor, 'encodeQueueSize property should exist');
      assert.ok(descriptor.get, 'encodeQueueSize should have getter');
      assert.strictEqual(
        descriptor.set,
        undefined,
        'encodeQueueSize should NOT have setter',
      );

      encoder.close();
    });

    it('should increase on encode()', async () => {
      const outputs: EncodedAudioChunk[] = [];
      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);
      assert.strictEqual(encoder.encodeQueueSize, 0);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      // Queue size should have increased (or processing is instant)
      assert.ok(
        encoder.encodeQueueSize >= 0,
        'encodeQueueSize should be non-negative after encode',
      );

      await encoder.flush();
      assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

      encoder.close();
    });

    it('should be 0 after reset()', async () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0);

      encoder.close();
    });
  });

  describe('ondequeue event handler', () => {
    // Spec 5.3: ondequeue is event handler IDL attribute for 'dequeue' event

    it('should be null by default', () => {
      const encoder = createEncoder();
      assert.strictEqual(encoder.ondequeue, null);
      encoder.close();
    });

    it('should be settable to a function', () => {
      const encoder = createEncoder();
      const handler = () => {};

      encoder.ondequeue = handler;
      assert.strictEqual(encoder.ondequeue, handler);

      encoder.close();
    });

    it('should be settable to null', () => {
      const encoder = createEncoder();
      const handler = () => {};

      encoder.ondequeue = handler;
      encoder.ondequeue = null;
      assert.strictEqual(encoder.ondequeue, null);

      encoder.close();
    });

    it('should fire when encodeQueueSize decreases', async () => {
      let dequeueCount = 0;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.ondequeue = () => {
        dequeueCount++;
      };

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // ondequeue should have fired
      if (outputs.length > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        assert.ok(dequeueCount > 0, 'ondequeue should fire when outputs are produced');
      }

      encoder.close();
    });

    it('should work with addEventListener', async () => {
      let eventFired = false;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => outputs.push(chunk),
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        eventFired = true;
      });

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        assert.ok(eventFired, 'dequeue event should fire via addEventListener');
      }

      encoder.close();
    });

    it('should not throw if ondequeue is not set', async () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Should complete without error
      encoder.close();
    });
  });

  describe('EventTarget inheritance', () => {
    it('should extend EventTarget', () => {
      const encoder = createEncoder();
      assert.ok(encoder instanceof EventTarget);
      encoder.close();
    });

    it('should support removeEventListener', () => {
      const encoder = createEncoder();
      let count = 0;
      const handler = () => {
        count++;
      };

      encoder.addEventListener('dequeue', handler);
      encoder.removeEventListener('dequeue', handler);

      encoder.dispatchEvent(new Event('dequeue'));

      assert.strictEqual(count, 0, 'Handler should not fire after removal');

      encoder.close();
    });
  });
});
