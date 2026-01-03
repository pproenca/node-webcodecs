// test/unit/audio-sample-format.test.ts
// Tests for W3C WebCodecs spec section 9.3 - Audio Sample Format

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, type AudioSampleFormat } from '../../lib';

/**
 * Tests for AudioSampleFormat per W3C WebCodecs spec section 9.3.
 * Covers format enumeration, buffer arrangement, sample magnitude, and channel ordering.
 */

describe('AudioSampleFormat: 9.3', () => {
  // Helper: bytes per sample for each format
  function bytesPerSample(format: AudioSampleFormat): number {
    switch (format) {
      case 'u8':
      case 'u8-planar':
        return 1;
      case 's16':
      case 's16-planar':
        return 2;
      case 's32':
      case 's32-planar':
      case 'f32':
      case 'f32-planar':
        return 4;
    }
  }

  // Helper: check if format is interleaved
  function isInterleaved(format: AudioSampleFormat): boolean {
    return !format.endsWith('-planar');
  }

  // Helper: check if format is planar
  function isPlanar(format: AudioSampleFormat): boolean {
    return format.endsWith('-planar');
  }

  describe('9.3 Format Enumeration', () => {
    // Spec 9.3: All 8 formats must be supported
    const allFormats: AudioSampleFormat[] = [
      'u8',
      's16',
      's32',
      'f32',
      'u8-planar',
      's16-planar',
      's32-planar',
      'f32-planar',
    ];

    it('should support all 8 AudioSampleFormat values', () => {
      for (const format of allFormats) {
        // Create AudioData with each format to verify it's accepted
        const bps = bytesPerSample(format);
        const data = new Uint8Array(100 * bps); // 100 frames

        const audio = new AudioData({
          format,
          sampleRate: 48000,
          numberOfFrames: 100,
          numberOfChannels: 1,
          timestamp: 0,
          data,
        });

        assert.strictEqual(audio.format, format);
        audio.close();
      }
    });

    // Test each format individually
    it('should accept u8 format (8-bit unsigned interleaved)', () => {
      const audio = new AudioData({
        format: 'u8',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Uint8Array(100),
      });
      assert.strictEqual(audio.format, 'u8');
      assert.ok(isInterleaved('u8'));
      assert.strictEqual(bytesPerSample('u8'), 1);
      audio.close();
    });

    it('should accept s16 format (16-bit signed interleaved)', () => {
      const audio = new AudioData({
        format: 's16',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int16Array(100),
      });
      assert.strictEqual(audio.format, 's16');
      assert.ok(isInterleaved('s16'));
      assert.strictEqual(bytesPerSample('s16'), 2);
      audio.close();
    });

    it('should accept s32 format (32-bit signed interleaved)', () => {
      const audio = new AudioData({
        format: 's32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int32Array(100),
      });
      assert.strictEqual(audio.format, 's32');
      assert.ok(isInterleaved('s32'));
      assert.strictEqual(bytesPerSample('s32'), 4);
      audio.close();
    });

    it('should accept f32 format (32-bit float interleaved)', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(100),
      });
      assert.strictEqual(audio.format, 'f32');
      assert.ok(isInterleaved('f32'));
      assert.strictEqual(bytesPerSample('f32'), 4);
      audio.close();
    });

    it('should accept u8-planar format (8-bit unsigned planar)', () => {
      const audio = new AudioData({
        format: 'u8-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Uint8Array(100),
      });
      assert.strictEqual(audio.format, 'u8-planar');
      assert.ok(isPlanar('u8-planar'));
      assert.strictEqual(bytesPerSample('u8-planar'), 1);
      audio.close();
    });

    it('should accept s16-planar format (16-bit signed planar)', () => {
      const audio = new AudioData({
        format: 's16-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int16Array(100),
      });
      assert.strictEqual(audio.format, 's16-planar');
      assert.ok(isPlanar('s16-planar'));
      assert.strictEqual(bytesPerSample('s16-planar'), 2);
      audio.close();
    });

    it('should accept s32-planar format (32-bit signed planar)', () => {
      const audio = new AudioData({
        format: 's32-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int32Array(100),
      });
      assert.strictEqual(audio.format, 's32-planar');
      assert.ok(isPlanar('s32-planar'));
      assert.strictEqual(bytesPerSample('s32-planar'), 4);
      audio.close();
    });

    it('should accept f32-planar format (32-bit float planar)', () => {
      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(100),
      });
      assert.strictEqual(audio.format, 'f32-planar');
      assert.ok(isPlanar('f32-planar'));
      assert.strictEqual(bytesPerSample('f32-planar'), 4);
      audio.close();
    });
  });

  describe('9.3.1 Arrangement of Audio Buffer', () => {
    // Spec 9.3.1: Interleaved has single plane with all channels
    it('should have single plane for interleaved format', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 2, // stereo
        timestamp: 0,
        data: new Float32Array(100 * 2), // interleaved: 200 samples total
      });

      // For interleaved, planeIndex must be 0
      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 100 * 2 * 4); // frames * channels * bytesPerSample

      // planeIndex 1 should throw for interleaved
      assert.throws(() => audio.allocationSize({ planeIndex: 1 }), RangeError);

      audio.close();
    });

    // Spec 9.3.1: Planar has separate plane per channel
    it('should have multiple planes for planar format', () => {
      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 2, // stereo
        timestamp: 0,
        data: new Float32Array(100 * 2), // planar: 100 per channel
      });

      // Each plane has frames * bytesPerSample
      const plane0Size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(plane0Size, 100 * 4); // frames * 4 bytes

      const plane1Size = audio.allocationSize({ planeIndex: 1 });
      assert.strictEqual(plane1Size, 100 * 4); // frames * 4 bytes

      // planeIndex 2 should throw (only 2 channels)
      assert.throws(() => audio.allocationSize({ planeIndex: 2 }), RangeError);

      audio.close();
    });

    // Spec 9.3.1: Interleaved layout [L0, R0, L1, R1, ...]
    it('should preserve interleaved sample order', () => {
      // Create stereo interleaved: [L0, R0, L1, R1]
      const data = new Float32Array([0.1, 0.5, 0.2, 0.6]);

      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 2,
        numberOfChannels: 2,
        timestamp: 0,
        data,
      });

      const dest = new Float32Array(4);
      audio.copyTo(dest, { planeIndex: 0 });

      // Order should be preserved
      assert.ok(Math.abs(dest[0] - 0.1) < 0.0001); // L0
      assert.ok(Math.abs(dest[1] - 0.5) < 0.0001); // R0
      assert.ok(Math.abs(dest[2] - 0.2) < 0.0001); // L1
      assert.ok(Math.abs(dest[3] - 0.6) < 0.0001); // R1

      audio.close();
    });

    // Spec 9.3.1: Planar layout [L0, L1, ...], [R0, R1, ...]
    it('should preserve planar sample order', () => {
      // Create stereo planar: [L0, L1] then [R0, R1]
      const data = new Float32Array([0.1, 0.2, 0.5, 0.6]);

      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 2,
        numberOfChannels: 2,
        timestamp: 0,
        data,
      });

      // Copy plane 0 (left channel)
      const left = new Float32Array(2);
      audio.copyTo(left, { planeIndex: 0 });
      assert.ok(Math.abs(left[0] - 0.1) < 0.0001); // L0
      assert.ok(Math.abs(left[1] - 0.2) < 0.0001); // L1

      // Copy plane 1 (right channel)
      const right = new Float32Array(2);
      audio.copyTo(right, { planeIndex: 1 });
      assert.ok(Math.abs(right[0] - 0.5) < 0.0001); // R0
      assert.ok(Math.abs(right[1] - 0.6) < 0.0001); // R1

      audio.close();
    });
  });

  describe('9.3.2 Magnitude of Audio Samples', () => {
    // Spec 9.3.2: u8 range 0-255, bias 128
    it('should handle u8 sample range (0-255, bias 128)', () => {
      // Create audio with silence (128) and extremes
      const data = new Uint8Array([0, 128, 255]);

      const audio = new AudioData({
        format: 'u8',
        sampleRate: 48000,
        numberOfFrames: 3,
        numberOfChannels: 1,
        timestamp: 0,
        data,
      });

      const dest = new Uint8Array(3);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.strictEqual(dest[0], 0); // min
      assert.strictEqual(dest[1], 128); // silence/bias
      assert.strictEqual(dest[2], 255); // max

      audio.close();
    });

    // Spec 9.3.2: s16 range -32768 to 32767, bias 0
    it('should handle s16 sample range (-32768 to 32767, bias 0)', () => {
      const data = new Int16Array([-32768, 0, 32767]);

      const audio = new AudioData({
        format: 's16',
        sampleRate: 48000,
        numberOfFrames: 3,
        numberOfChannels: 1,
        timestamp: 0,
        data,
      });

      const dest = new Int16Array(3);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.strictEqual(dest[0], -32768); // min
      assert.strictEqual(dest[1], 0); // silence/bias
      assert.strictEqual(dest[2], 32767); // max

      audio.close();
    });

    // Spec 9.3.2: s32 range -2147483648 to 2147483647, bias 0
    it('should handle s32 sample range (-2147483648 to 2147483647, bias 0)', () => {
      const data = new Int32Array([-2147483648, 0, 2147483647]);

      const audio = new AudioData({
        format: 's32',
        sampleRate: 48000,
        numberOfFrames: 3,
        numberOfChannels: 1,
        timestamp: 0,
        data,
      });

      const dest = new Int32Array(3);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.strictEqual(dest[0], -2147483648); // min
      assert.strictEqual(dest[1], 0); // silence/bias
      assert.strictEqual(dest[2], 2147483647); // max

      audio.close();
    });

    // Spec 9.3.2: f32 range -1.0 to 1.0, bias 0.0
    it('should handle f32 sample range (-1.0 to 1.0, bias 0.0)', () => {
      const data = new Float32Array([-1.0, 0.0, 1.0]);

      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 3,
        numberOfChannels: 1,
        timestamp: 0,
        data,
      });

      const dest = new Float32Array(3);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.ok(Math.abs(dest[0] - -1.0) < 0.0001); // min
      assert.ok(Math.abs(dest[1] - 0.0) < 0.0001); // silence/bias
      assert.ok(Math.abs(dest[2] - 1.0) < 0.0001); // max

      audio.close();
    });

    // Spec 9.3.2: f32 can hold values outside -1.0 to 1.0 during processing
    it('should allow f32 values outside nominal range', () => {
      // Values outside -1.0 to 1.0 are valid during processing
      const data = new Float32Array([-2.0, 0.0, 2.0]);

      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 3,
        numberOfChannels: 1,
        timestamp: 0,
        data,
      });

      const dest = new Float32Array(3);
      audio.copyTo(dest, { planeIndex: 0 });

      assert.ok(Math.abs(dest[0] - -2.0) < 0.0001);
      assert.ok(Math.abs(dest[2] - 2.0) < 0.0001);

      audio.close();
    });
  });

  describe('9.3.3 Audio Channel Ordering', () => {
    // Spec 9.3.3: Mono audio
    it('should support mono audio (1 channel)', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(100),
      });

      assert.strictEqual(audio.numberOfChannels, 1);
      audio.close();
    });

    // Spec 9.3.3: Stereo audio [L, R]
    it('should support stereo audio (2 channels)', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(100 * 2),
      });

      assert.strictEqual(audio.numberOfChannels, 2);
      audio.close();
    });

    // Spec 9.3.3: 5.1 surround [L, R, C, LFE, SL, SR]
    it('should support 5.1 surround audio (6 channels)', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 6,
        timestamp: 0,
        data: new Float32Array(100 * 6),
      });

      assert.strictEqual(audio.numberOfChannels, 6);
      audio.close();
    });

    // Spec 9.3.3: 7.1 surround [L, R, C, LFE, SL, SR, BL, BR]
    it('should support 7.1 surround audio (8 channels)', () => {
      const audio = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 8,
        timestamp: 0,
        data: new Float32Array(100 * 8),
      });

      assert.strictEqual(audio.numberOfChannels, 8);

      // Verify all 8 planes accessible
      for (let i = 0; i < 8; i++) {
        const size = audio.allocationSize({ planeIndex: i });
        assert.strictEqual(size, 100 * 4);
      }

      audio.close();
    });
  });

  describe('Bytes per sample', () => {
    it('should use 1 byte per sample for u8 formats', () => {
      const audio = new AudioData({
        format: 'u8',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Uint8Array(100),
      });

      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 100 * 1); // 100 frames * 1 byte

      audio.close();
    });

    it('should use 2 bytes per sample for s16 formats', () => {
      const audio = new AudioData({
        format: 's16',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int16Array(100),
      });

      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 100 * 2); // 100 frames * 2 bytes

      audio.close();
    });

    it('should use 4 bytes per sample for s32 formats', () => {
      const audio = new AudioData({
        format: 's32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Int32Array(100),
      });

      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 100 * 4); // 100 frames * 4 bytes

      audio.close();
    });

    it('should use 4 bytes per sample for f32 formats', () => {
      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 100,
        numberOfChannels: 1,
        timestamp: 0,
        data: new Float32Array(100),
      });

      const size = audio.allocationSize({ planeIndex: 0 });
      assert.strictEqual(size, 100 * 4); // 100 frames * 4 bytes

      audio.close();
    });
  });

  describe('Type exports', () => {
    it('should export AudioSampleFormat type', () => {
      const format: AudioSampleFormat = 'f32';
      assert.ok(format);
    });

    it('should accept all AudioSampleFormat values in type position', () => {
      const formats: AudioSampleFormat[] = [
        'u8',
        's16',
        's32',
        'f32',
        'u8-planar',
        's16-planar',
        's32-planar',
        'f32-planar',
      ];
      assert.strictEqual(formats.length, 8);
    });
  });
});
