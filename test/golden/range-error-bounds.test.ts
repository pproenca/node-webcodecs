/**
 * RangeError Bounds Tests per W3C WebCodecs spec
 *
 * RangeError is thrown when buffers are too small or indices are invalid.
 *
 * This mirrors the contract tests in test/contracts/error_handling/range_errors.js
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('RangeError bounds checking per W3C spec', () => {
  describe('VideoFrame', () => {
    describe('copyTo()', () => {
      it('should throw RangeError for undersized buffer', async () => {
        const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
          format: 'RGBA',
          codedWidth: 100,
          codedHeight: 100,
          timestamp: 0,
        });

        // Buffer too small (need 100*100*4 = 40000 bytes)
        const dest = new ArrayBuffer(100);

        await assert.rejects(frame.copyTo(dest), RangeError);

        frame.close();
      });

      it('should throw for rect out of bounds', async () => {
        const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
          format: 'RGBA',
          codedWidth: 100,
          codedHeight: 100,
          timestamp: 0,
        });

        const dest = new ArrayBuffer(100 * 100 * 4);

        // W3C spec allows either RangeError or TypeError for invalid rect
        await assert.rejects(
          frame.copyTo(dest, {
            rect: { x: 90, y: 90, width: 50, height: 50 }, // Extends beyond frame
          }),
          (err: Error) => {
            return err instanceof RangeError || err instanceof TypeError;
          },
        );

        frame.close();
      });
    });
  });

  describe('AudioData', () => {
    describe('allocationSize()', () => {
      it('should throw RangeError for invalid planeIndex', () => {
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: 48000,
          numberOfFrames: 1024,
          numberOfChannels: 2,
          timestamp: 0,
          data: new Float32Array(1024 * 2),
        });

        assert.throws(() => {
          audioData.allocationSize({ planeIndex: 10 }); // Only 2 channels
        }, RangeError);

        audioData.close();
      });
    });

    describe('copyTo()', () => {
      it('should throw RangeError for undersized buffer', () => {
        const audioData = new AudioData({
          format: 'f32',
          sampleRate: 48000,
          numberOfFrames: 1024,
          numberOfChannels: 2,
          timestamp: 0,
          data: new Float32Array(1024 * 2),
        });

        // Need 1024*2*4 = 8192 bytes, provide only 100
        const dest = new ArrayBuffer(100);

        assert.throws(() => {
          audioData.copyTo(dest, { planeIndex: 0 });
        }, RangeError);

        audioData.close();
      });
    });
  });

  describe('EncodedVideoChunk', () => {
    describe('copyTo()', () => {
      it('should throw for undersized destination', () => {
        const chunk = new EncodedVideoChunk({
          type: 'key',
          timestamp: 0,
          data: Buffer.alloc(1000),
        });

        // Provide buffer smaller than byteLength
        const dest = new ArrayBuffer(10);

        // W3C spec allows either RangeError or TypeError for undersized buffer
        assert.throws(
          () => {
            chunk.copyTo(dest);
          },
          (err: Error) => {
            return err instanceof RangeError || err instanceof TypeError;
          },
        );
      });
    });
  });

  describe('EncodedAudioChunk', () => {
    describe('copyTo()', () => {
      it('should throw for undersized destination', () => {
        const chunk = new EncodedAudioChunk({
          type: 'key',
          timestamp: 0,
          data: Buffer.alloc(1000),
        });

        // Provide buffer smaller than byteLength
        const dest = new ArrayBuffer(10);

        // W3C spec allows either RangeError or TypeError for undersized buffer
        assert.throws(
          () => {
            chunk.copyTo(dest);
          },
          (err: Error) => {
            return err instanceof RangeError || err instanceof TypeError;
          },
        );
      });
    });
  });
});
