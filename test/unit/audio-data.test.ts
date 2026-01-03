// test/unit/audio-data.test.ts
// Tests for W3C WebCodecs spec section 9.2 - AudioData Interface

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, type AudioDataInit, type AudioSampleFormat } from '../../lib';

/**
 * Tests for AudioData per W3C WebCodecs spec section 9.2.
 * Covers constructor, attributes, methods, algorithms, and error handling.
 */

describe('AudioData: 9.2', () => {
  // Helper to create valid AudioData init
  function createAudioInit(overrides?: Partial<AudioDataInit>): AudioDataInit {
    // Default: 1024 frames, mono, f32 format
    const sampleRate = 48000;
    const numberOfFrames = 1024;
    const numberOfChannels = 1;
    const data = new Float32Array(numberOfFrames * numberOfChannels);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((i / data.length) * Math.PI * 2);
    }
    return {
      format: 'f32',
      sampleRate,
      numberOfFrames,
      numberOfChannels,
      timestamp: 0,
      data,
      ...overrides,
    };
  }

  describe('9.2.2 Constructor', () => {
    // Spec 9.2.2: Constructor with valid init
    it('should construct with valid init', () => {
      const init = createAudioInit();
      const audio = new AudioData(init);

      assert.ok(audio instanceof AudioData);
      assert.strictEqual(audio.format, 'f32');
      assert.strictEqual(audio.sampleRate, 48000);
      assert.strictEqual(audio.numberOfFrames, 1024);
      assert.strictEqual(audio.numberOfChannels, 1);

      audio.close();
    });

    // Spec 9.2.2: Accept all AudioSampleFormats
    it('should accept format: u8', () => {
      const init = createAudioInit({
        format: 'u8',
        data: new Uint8Array(1024), // 1 byte per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 'u8');
      audio.close();
    });

    it('should accept format: u8-planar', () => {
      const init = createAudioInit({
        format: 'u8-planar',
        data: new Uint8Array(1024), // 1 byte per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 'u8-planar');
      audio.close();
    });

    it('should accept format: s16', () => {
      const init = createAudioInit({
        format: 's16',
        data: new Int16Array(1024), // 2 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 's16');
      audio.close();
    });

    it('should accept format: s16-planar', () => {
      const init = createAudioInit({
        format: 's16-planar',
        data: new Int16Array(1024), // 2 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 's16-planar');
      audio.close();
    });

    it('should accept format: s32', () => {
      const init = createAudioInit({
        format: 's32',
        data: new Int32Array(1024), // 4 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 's32');
      audio.close();
    });

    it('should accept format: s32-planar', () => {
      const init = createAudioInit({
        format: 's32-planar',
        data: new Int32Array(1024), // 4 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 's32-planar');
      audio.close();
    });

    it('should accept format: f32', () => {
      const init = createAudioInit({
        format: 'f32',
        data: new Float32Array(1024), // 4 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 'f32');
      audio.close();
    });

    it('should accept format: f32-planar', () => {
      const init = createAudioInit({
        format: 'f32-planar',
        data: new Float32Array(1024), // 4 bytes per sample
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 'f32-planar');
      audio.close();
    });

    // Spec 9.2.2: Accept ArrayBuffer as data
    it('should accept ArrayBuffer as data', () => {
      const buffer = new ArrayBuffer(1024 * 4);
      const init = createAudioInit({
        format: 'f32',
        data: buffer,
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.format, 'f32');
      audio.close();
    });

    // Spec 9.2.2: Stereo audio
    it('should support stereo audio (2 channels)', () => {
      const init = createAudioInit({
        numberOfChannels: 2,
        data: new Float32Array(1024 * 2), // stereo
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.numberOfChannels, 2);
      audio.close();
    });

    // Spec 9.2.2: Multi-channel audio
    it('should support multi-channel audio (6 channels)', () => {
      const init = createAudioInit({
        numberOfChannels: 6,
        data: new Float32Array(1024 * 6), // 5.1 surround
      });
      const audio = new AudioData(init);
      assert.strictEqual(audio.numberOfChannels, 6);
      audio.close();
    });

    // Error cases per spec
    it('should throw TypeError for invalid format', () => {
      assert.throws(
        () =>
          new AudioData({
            format: 'invalid' as AudioSampleFormat,
            sampleRate: 48000,
            numberOfFrames: 1024,
            numberOfChannels: 1,
            timestamp: 0,
            data: new Float32Array(1024),
          }),
        /Error|TypeError/,
      );
    });

    it('should throw TypeError for missing data', () => {
      assert.throws(
        () =>
          new AudioData({
            format: 'f32',
            sampleRate: 48000,
            numberOfFrames: 1024,
            numberOfChannels: 1,
            timestamp: 0,
            data: undefined as unknown as ArrayBuffer,
          }),
        TypeError,
      );
    });
  });

  describe('9.2.3 Attributes', () => {
    // Spec 9.2.3: format attribute
    it('should have readonly format attribute', () => {
      const audio = new AudioData(createAudioInit({ format: 's16-planar' }));
      assert.strictEqual(audio.format, 's16-planar');
      audio.close();
    });

    // Spec 9.2.3: sampleRate attribute
    it('should have readonly sampleRate attribute', () => {
      const audio = new AudioData(createAudioInit({ sampleRate: 44100 }));
      assert.strictEqual(audio.sampleRate, 44100);
      audio.close();
    });

    it('should support various sample rates', () => {
      const rates = [8000, 16000, 22050, 44100, 48000, 96000];
      for (const rate of rates) {
        const audio = new AudioData(createAudioInit({ sampleRate: rate }));
        assert.strictEqual(audio.sampleRate, rate);
        audio.close();
      }
    });

    // Spec 9.2.3: numberOfFrames attribute
    it('should have readonly numberOfFrames attribute', () => {
      const audio = new AudioData(createAudioInit({ numberOfFrames: 512 }));
      assert.strictEqual(audio.numberOfFrames, 512);
      audio.close();
    });

    // Spec 9.2.3: numberOfChannels attribute
    it('should have readonly numberOfChannels attribute', () => {
      const audio = new AudioData(
        createAudioInit({
          numberOfChannels: 8,
          data: new Float32Array(1024 * 8),
        }),
      );
      assert.strictEqual(audio.numberOfChannels, 8);
      audio.close();
    });

    // Spec 9.2.3: timestamp attribute
    it('should have readonly timestamp attribute in microseconds', () => {
      const audio = new AudioData(createAudioInit({ timestamp: 1000000 }));
      assert.strictEqual(audio.timestamp, 1000000); // 1 second
      audio.close();
    });

    it('should support negative timestamp', () => {
      const audio = new AudioData(createAudioInit({ timestamp: -5000 }));
      assert.strictEqual(audio.timestamp, -5000);
      audio.close();
    });

    // Spec 9.2.3: duration attribute (computed)
    it('should compute duration correctly', () => {
      // duration = (numberOfFrames / sampleRate) * 1000000 microseconds
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 48000, // 1 second of audio
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(48000), // Correct size for 48000 frames
      });
      // Expected: 1000000 microseconds (1 second)
      assert.strictEqual(audio.duration, 1000000);
      audio.close();
    });

    it('should compute duration for partial second', () => {
      // 1024 frames at 48000 Hz = 1024/48000 seconds = ~21333 microseconds
      const audio = new AudioData(
        createAudioInit({
          sampleRate: 48000,
          numberOfFrames: 1024,
        }),
      );
      const expectedDuration = Math.floor((1024 / 48000) * 1000000);
      // Allow small rounding difference
      assert.ok(Math.abs(audio.duration - expectedDuration) <= 1);
      audio.close();
    });
  });

  describe('9.2.4 allocationSize Method', () => {
    // Spec 9.2.4: allocationSize returns bytes needed
    it('should return correct allocation size for f32 format', () => {
      const audio = new AudioData(
        createAudioInit({
          format: 'f32',
          numberOfFrames: 1024,
          numberOfChannels: 1,
        }),
      );
      // f32: 4 bytes per sample, 1024 frames, 1 channel, interleaved = 4096 bytes
      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 1024 * 4);
      audio.close();
    });

    it('should return correct allocation size for s16 format', () => {
      const audio = new AudioData(
        createAudioInit({
          format: 's16',
          numberOfFrames: 1024,
          numberOfChannels: 2,
          data: new Int16Array(1024 * 2),
        }),
      );
      // s16: 2 bytes per sample, 1024 frames, 2 channels, interleaved = 4096 bytes
      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 1024 * 2 * 2);
      audio.close();
    });

    it('should return correct allocation size for planar format', () => {
      const audio = new AudioData(
        createAudioInit({
          format: 'f32-planar',
          numberOfFrames: 1024,
          numberOfChannels: 2,
          data: new Float32Array(1024 * 2),
        }),
      );
      // f32-planar: 4 bytes per sample, 1024 frames, per plane = 4096 bytes
      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 1024 * 4);
      audio.close();
    });

    // Spec 9.2.4: planeIndex is required
    it('should throw TypeError if planeIndex is missing', () => {
      const audio = new AudioData(createAudioInit());

      assert.throws(
        () => audio.allocationSize({} as { planeIndex: number }),
        TypeError,
      );

      audio.close();
    });

    // Spec 9.2.5: planeIndex validation for interleaved
    it('should throw RangeError if planeIndex > 0 for interleaved format', () => {
      const audio = new AudioData(
        createAudioInit({
          format: 'f32', // interleaved
          numberOfChannels: 2,
          data: new Float32Array(1024 * 2),
        }),
      );

      assert.throws(() => audio.allocationSize({ planeIndex: 1 }), RangeError);

      audio.close();
    });

    // Spec 9.2.5: planeIndex validation for planar
    it('should throw RangeError if planeIndex >= numberOfChannels for planar format', () => {
      const audio = new AudioData(
        createAudioInit({
          format: 'f32-planar', // planar
          numberOfChannels: 2,
          data: new Float32Array(1024 * 2),
        }),
      );

      assert.throws(() => audio.allocationSize({ planeIndex: 2 }), RangeError);

      audio.close();
    });

    // Spec 9.2.4: InvalidStateError if closed
    it('should throw InvalidStateError if called after close', () => {
      const audio = new AudioData(createAudioInit());
      audio.close();

      assert.throws(
        () => audio.allocationSize({ planeIndex: 0 }),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('9.2.4 copyTo Method', () => {
    // Spec 9.2.4: copyTo copies audio data
    it('should copy audio data to destination buffer', () => {
      const sourceData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 4,
        numberOfChannels: 1,
        timestamp: 0,
        data: sourceData,
      });

      const dest = new Float32Array(4);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.ok(Math.abs(dest[0] - 0.1) < 0.0001);
      assert.ok(Math.abs(dest[1] - 0.2) < 0.0001);
      assert.ok(Math.abs(dest[2] - 0.3) < 0.0001);
      assert.ok(Math.abs(dest[3] - 0.4) < 0.0001);

      audio.close();
    });

    // Spec 9.2.4: copyTo to ArrayBuffer
    it('should copy audio data to ArrayBuffer', () => {
      const sourceData = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 4,
        numberOfChannels: 1,
        timestamp: 0,
        data: sourceData,
      });

      const dest = new ArrayBuffer(16);
      audio.copyTo(dest, { planeIndex: 0 });

      const result = new Float32Array(dest);
      assert.ok(Math.abs(result[0] - 1.0) < 0.0001);

      audio.close();
    });

    // Spec 9.2.4: copyTo with frameOffset
    it('should support frameOffset in copyTo', () => {
      const sourceData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 5,
        numberOfChannels: 1,
        timestamp: 0,
        data: sourceData,
      });

      const dest = new Float32Array(3);
      audio.copyTo(dest, { planeIndex: 0, frameOffset: 2 });

      // Should copy frames 2, 3, 4 (values 0.3, 0.4, 0.5)
      assert.ok(Math.abs(dest[0] - 0.3) < 0.0001);
      assert.ok(Math.abs(dest[1] - 0.4) < 0.0001);
      assert.ok(Math.abs(dest[2] - 0.5) < 0.0001);

      audio.close();
    });

    // Spec 9.2.4: copyTo with frameCount
    it('should support frameCount in copyTo', () => {
      const sourceData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 5,
        numberOfChannels: 1,
        timestamp: 0,
        data: sourceData,
      });

      const dest = new Float32Array(2);
      audio.copyTo(dest, { planeIndex: 0, frameCount: 2 });

      // Should copy only first 2 frames
      assert.ok(Math.abs(dest[0] - 0.1) < 0.0001);
      assert.ok(Math.abs(dest[1] - 0.2) < 0.0001);

      audio.close();
    });

    // Spec 9.2.4: RangeError if destination too small
    it('should throw RangeError if destination buffer too small', () => {
      const audio = new AudioData(createAudioInit());

      const dest = new Float32Array(10); // Too small for 1024 frames

      assert.throws(() => audio.copyTo(dest, { planeIndex: 0 }), RangeError);

      audio.close();
    });

    // Spec 9.2.4: InvalidStateError if closed
    it('should throw InvalidStateError if called after close', () => {
      const audio = new AudioData(createAudioInit());
      audio.close();

      const dest = new Float32Array(1024);

      assert.throws(
        () => audio.copyTo(dest, { planeIndex: 0 }),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    // Spec 9.2.4: planeIndex required
    it('should throw TypeError if planeIndex is missing', () => {
      const audio = new AudioData(createAudioInit());
      const dest = new Float32Array(1024);

      assert.throws(
        () => audio.copyTo(dest, {} as { planeIndex: number }),
        TypeError,
      );

      audio.close();
    });

    // Spec 9.2.5: frameOffset validation
    it('should throw RangeError if frameOffset >= numberOfFrames', () => {
      const audio = new AudioData(
        createAudioInit({
          numberOfFrames: 100,
        }),
      );

      const dest = new Float32Array(100);

      assert.throws(
        () => audio.copyTo(dest, { planeIndex: 0, frameOffset: 100 }),
        RangeError,
      );

      audio.close();
    });
  });

  describe('9.2.4 clone Method', () => {
    // Spec 9.2.4: clone creates new AudioData
    it('should create new AudioData via clone', () => {
      const original = new AudioData(createAudioInit());
      const cloned = original.clone();

      assert.ok(cloned instanceof AudioData);
      assert.notStrictEqual(original, cloned);

      original.close();
      cloned.close();
    });

    // Spec 9.2.4: clone shares resource (tested via data)
    it('should share audio data between original and clone', () => {
      const sourceData = new Float32Array([0.5, 0.6, 0.7, 0.8]);
      const original = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 4,
        numberOfChannels: 1,
        timestamp: 0,
        data: sourceData,
      });
      const cloned = original.clone();

      const origDest = new Float32Array(4);
      const cloneDest = new Float32Array(4);

      original.copyTo(origDest, { planeIndex: 0 });
      cloned.copyTo(cloneDest, { planeIndex: 0 });

      assert.deepStrictEqual([...origDest], [...cloneDest]);

      original.close();
      cloned.close();
    });

    // Spec 9.2.4: clone throws InvalidStateError if closed
    it('should throw InvalidStateError when cloning closed AudioData', () => {
      const audio = new AudioData(createAudioInit());
      audio.close();

      assert.throws(
        () => audio.clone(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('9.2.4 close Method', () => {
    // Spec 9.2.4/9.2.5: close marks as detached
    it('should mark AudioData as closed', () => {
      const audio = new AudioData(createAudioInit());
      audio.close();
      assert.strictEqual(audio.format, null);
    });

    // Spec 9.2.5: close is idempotent
    it('should allow double close without error', () => {
      const audio = new AudioData(createAudioInit());
      audio.close();
      assert.doesNotThrow(() => {
        audio.close();
      });
    });

    // Spec 9.2.5: attributes return defaults after close
    it('should return default values after close', () => {
      const audio = new AudioData(createAudioInit({ timestamp: 12345 }));
      audio.close();

      assert.strictEqual(audio.format, null);
      assert.strictEqual(audio.sampleRate, 0);
      assert.strictEqual(audio.numberOfFrames, 0);
      assert.strictEqual(audio.numberOfChannels, 0);
      assert.strictEqual(audio.timestamp, 0);
      assert.strictEqual(audio.duration, 0);
    });
  });

  describe('Planar vs Interleaved formats', () => {
    // Planar format: separate plane per channel
    it('should handle planar format with multiple channels', () => {
      // 2-channel planar: each plane has 4 frames
      const data = new Float32Array(8);
      // Channel 0: 0.1, 0.2, 0.3, 0.4
      data[0] = 0.1;
      data[1] = 0.2;
      data[2] = 0.3;
      data[3] = 0.4;
      // Channel 1: 0.5, 0.6, 0.7, 0.8
      data[4] = 0.5;
      data[5] = 0.6;
      data[6] = 0.7;
      data[7] = 0.8;

      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 4,
        numberOfChannels: 2,
        timestamp: 0,
        data,
      });

      // Copy plane 0
      const plane0 = new Float32Array(4);
      audio.copyTo(plane0, { planeIndex: 0 });
      assert.ok(Math.abs(plane0[0] - 0.1) < 0.0001);
      assert.ok(Math.abs(plane0[3] - 0.4) < 0.0001);

      // Copy plane 1
      const plane1 = new Float32Array(4);
      audio.copyTo(plane1, { planeIndex: 1 });
      assert.ok(Math.abs(plane1[0] - 0.5) < 0.0001);
      assert.ok(Math.abs(plane1[3] - 0.8) < 0.0001);

      audio.close();
    });

    // Interleaved format: all channels in one plane
    it('should handle interleaved format with multiple channels', () => {
      // 2-channel interleaved: L R L R L R L R
      const data = new Float32Array([0.1, 0.5, 0.2, 0.6, 0.3, 0.7, 0.4, 0.8]);

      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 4,
        numberOfChannels: 2,
        timestamp: 0,
        data,
      });

      // For interleaved, only planeIndex 0 is valid
      const dest = new Float32Array(8);
      audio.copyTo(dest, { planeIndex: 0 });

      // Interleaved data should be preserved
      assert.ok(Math.abs(dest[0] - 0.1) < 0.0001);
      assert.ok(Math.abs(dest[1] - 0.5) < 0.0001);

      audio.close();
    });
  });

  describe('Edge cases', () => {
    // Large audio data
    it('should handle large audio data (>1MB)', () => {
      // 1 second of stereo 48kHz f32 = 48000 * 2 * 4 = 384KB per second
      // ~3 seconds = >1MB
      const frames = 48000 * 3;
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(frames * 2),
      });

      assert.strictEqual(audio.numberOfFrames, frames);
      assert.strictEqual(audio.duration, 3000000); // 3 seconds

      audio.close();
    });

    // Single frame
    it('should handle single frame audio', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array([0.5]),
      });

      assert.strictEqual(audio.numberOfFrames, 1);

      const dest = new Float32Array(1);
      audio.copyTo(dest, { planeIndex: 0 });
      assert.ok(Math.abs(dest[0] - 0.5) < 0.0001);

      audio.close();
    });

    // High channel count (7.1 surround)
    it('should handle 8-channel audio (7.1 surround)', () => {
      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 8,
        timestamp: 0,
        data: new Float32Array(1024 * 8),
      });

      assert.strictEqual(audio.numberOfChannels, 8);

      // Verify all 8 planes are accessible
      for (let i = 0; i < 8; i++) {
        const size = audio.allocationSize({ planeIndex: i });
        assert.strictEqual(size, 1024 * 4);
      }

      audio.close();
    });
  });

  describe('Type exports', () => {
    it('should export AudioData class', () => {
      assert.strictEqual(typeof AudioData, 'function');
    });
  });
});
