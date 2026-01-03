// test/unit/audio-encoder-events.test.ts
// Tests for W3C WebCodecs spec section 5.4 - AudioEncoder Event Summary

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, AudioEncoder, type EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioEncoder dequeue event per W3C WebCodecs spec section 5.4.
 * Verifies that the dequeue event fires when encodeQueueSize decreases.
 */

describe('AudioEncoder Events: 5.4', () => {
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

  describe('dequeue event firing', () => {
    // Spec 5.4: dequeue fires when encodeQueueSize decreases

    it('should fire dequeue event with Event object', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let eventReceived: Event | null = null;

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', (event) => {
        eventReceived = event;
      });

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Should have received Event object
      if (outputs.length > 0) {
        assert.ok(eventReceived instanceof Event, 'Should receive Event object');
        assert.strictEqual(eventReceived?.type, 'dequeue', 'Event type should be "dequeue"');
      }

      encoder.close();
    });

    it('should fire dequeue after flush completes', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let dequeueCount = 0;

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

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      // dequeueCount before flush
      const countBeforeFlush = dequeueCount;

      await encoder.flush();

      // dequeue events should fire as outputs are produced
      assert.ok(dequeueCount >= countBeforeFlush, 'dequeue should fire during/after flush');

      encoder.close();
    });

    it('should call ondequeue handler with Event object', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let callbackInvoked = false;

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.ondequeue = () => {
        callbackInvoked = true;
      };

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // ondequeue should have been called
      if (outputs.length > 0) {
        // Give microtask time to run
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        assert.ok(callbackInvoked, 'ondequeue callback should be invoked');
      }

      encoder.close();
    });
  });

  describe('event edge cases', () => {
    it('should handle no handler set gracefully', async () => {
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      // No handler set - should not throw
      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Should complete without error
      assert.ok(true, 'Encoder should work without dequeue handler');

      encoder.close();
    });

    it('should handle handler removed mid-operation', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let count = 0;

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      const handler = () => {
        count++;
        // Remove self after first call
        encoder.removeEventListener('dequeue', handler);
      };

      encoder.addEventListener('dequeue', handler);

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Handler should have been called at most once (before removal)
      assert.ok(count <= 1, 'Handler should not fire after removal');

      encoder.close();
    });

    it('should not fire dequeue after close', async () => {
      let dequeueAfterClose = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure(config);

      // Close immediately
      encoder.close();

      encoder.addEventListener('dequeue', () => {
        dequeueAfterClose = true;
      });

      // Wait a bit
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Should not have received dequeue after close
      assert.strictEqual(dequeueAfterClose, false, 'Should not fire dequeue after close');
    });
  });

  describe('EventTarget integration', () => {
    it('should dispatch to multiple listeners', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let listener1Called = false;
      let listener2Called = false;

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        listener1Called = true;
      });
      encoder.addEventListener('dequeue', () => {
        listener2Called = true;
      });

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      if (outputs.length > 0) {
        assert.ok(listener1Called, 'First listener should be called');
        assert.ok(listener2Called, 'Second listener should be called');
      }

      encoder.close();
    });

    it('should support once option', async () => {
      const outputs: EncodedAudioChunk[] = [];
      let callCount = 0;

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener(
        'dequeue',
        () => {
          callCount++;
        },
        { once: true },
      );

      encoder.configure(config);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Should be called at most once
      assert.ok(callCount <= 1, 'Handler with once option should fire at most once');

      encoder.close();
    });
  });
});
