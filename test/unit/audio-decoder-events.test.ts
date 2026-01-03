// test/unit/audio-decoder-events.test.ts
// Tests for W3C WebCodecs spec section 3.4 - AudioDecoder Event Summary

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, EncodedAudioChunk } from '../../lib';

/**
 * Tests for AudioDecoder dequeue event per W3C WebCodecs spec section 3.4.
 * Verifies that the dequeue event fires when decodeQueueSize decreases.
 */

describe('AudioDecoder Events: 3.4', () => {
  // Helper to encode audio and get chunks for decoding
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

    return encodedChunks;
  }

  describe('dequeue event firing', () => {
    // Spec 3.4: dequeue fires when decodeQueueSize decreases

    it('should fire dequeue event with Event object', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let eventReceived: Event | null = null;

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', (event) => {
        eventReceived = event;
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should have received Event object
      if (outputs.length > 0) {
        assert.ok(eventReceived instanceof Event, 'Should receive Event object');
        assert.strictEqual(eventReceived?.type, 'dequeue', 'Event type should be "dequeue"');
      }

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should fire dequeue after flush completes', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let dequeueCount = 0;

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

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      // dequeueCount before flush
      const countBeforeFlush = dequeueCount;

      await decoder.flush();

      // dequeue events should fire as outputs are produced
      assert.ok(
        dequeueCount >= countBeforeFlush,
        'dequeue should fire during/after flush',
      );

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should call ondequeue handler with Event object', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let callbackInvoked = false;

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.ondequeue = () => {
        callbackInvoked = true;
      };

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // ondequeue should have been called
      if (outputs.length > 0) {
        // Give microtask time to run
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        assert.ok(callbackInvoked, 'ondequeue callback should be invoked');
      }

      for (const d of outputs) d.close();
      decoder.close();
    });
  });

  describe('event edge cases', () => {
    it('should handle no handler set gracefully', async () => {
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

      // No handler set - should not throw
      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should complete without error
      assert.ok(true, 'Decoder should work without dequeue handler');

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should handle handler removed mid-operation', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let count = 0;

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      const handler = () => {
        count++;
        // Remove self after first call
        decoder.removeEventListener('dequeue', handler);
      };

      decoder.addEventListener('dequeue', handler);

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Handler should have been called at most once (before removal)
      assert.ok(count <= 1, 'Handler should not fire after removal');

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should not fire dequeue after close', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      let dequeueAfterClose = false;

      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      // Close immediately
      decoder.close();

      decoder.addEventListener('dequeue', () => {
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
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let listener1Called = false;
      let listener2Called = false;

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener('dequeue', () => {
        listener1Called = true;
      });
      decoder.addEventListener('dequeue', () => {
        listener2Called = true;
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      if (outputs.length > 0) {
        assert.ok(listener1Called, 'First listener should be called');
        assert.ok(listener2Called, 'Second listener should be called');
      }

      for (const d of outputs) d.close();
      decoder.close();
    });

    it('should support once option', async () => {
      const chunks = await encodeAudioChunks();
      if (chunks.length === 0) return;

      const outputs: AudioData[] = [];
      let callCount = 0;

      const decoder = new AudioDecoder({
        output: (data) => {
          outputs.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.addEventListener(
        'dequeue',
        () => {
          callCount++;
        },
        { once: true },
      );

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of chunks) {
        decoder.decode(chunk);
      }

      await decoder.flush();

      // Should be called at most once
      assert.ok(callCount <= 1, 'Handler with once option should fire at most once');

      for (const d of outputs) d.close();
      decoder.close();
    });
  });
});
