import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('AudioData exception types per W3C spec', () => {
  describe('clone()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      assert.throws(() => {
        audioData.clone();
      }, DOMException);
      try {
        audioData.clone();
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });
  });

  describe('allocationSize()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      assert.throws(() => {
        audioData.allocationSize({ planeIndex: 0 });
      }, DOMException);
      try {
        audioData.allocationSize({ planeIndex: 0 });
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should throw RangeError when planeIndex out of range', () => {
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      // planeIndex 5 is out of range for 2-channel audio
      assert.throws(() => {
        audioData.allocationSize({ planeIndex: 5 });
      }, RangeError);

      audioData.close();
    });
  });

  describe('copyTo()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      audioData.close();

      const dest = new ArrayBuffer(1024 * 2 * 4);
      assert.throws(() => {
        audioData.copyTo(dest, { planeIndex: 0 });
      }, DOMException);
      try {
        audioData.copyTo(dest, { planeIndex: 0 });
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should throw RangeError when destination buffer too small', () => {
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      const dest = new ArrayBuffer(10); // Too small

      assert.throws(() => {
        audioData.copyTo(dest, { planeIndex: 0 });
      }, RangeError);

      audioData.close();
    });
  });
});
