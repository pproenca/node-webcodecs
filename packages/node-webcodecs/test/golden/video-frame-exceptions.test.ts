import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame exception types per W3C spec', () => {
  describe('clone()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      assert.throws(() => frame.clone(), DOMException);
      try {
        frame.clone();
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });
  });

  describe('copyTo()', () => {
    it('should throw DOMException with InvalidStateError when closed', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      const dest = new Uint8Array(4 * 4 * 4);
      await assert.rejects(frame.copyTo(dest), DOMException);

      try {
        await frame.copyTo(dest);
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should throw RangeError when destination buffer too small', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      const dest = new Uint8Array(10); // Too small

      await assert.rejects(frame.copyTo(dest), RangeError);

      frame.close();
    });

    it('should throw RangeError when rect exceeds bounds', async () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      const dest = new Uint8Array(100);

      await assert.rejects(
        frame.copyTo(dest, { rect: { x: 10, y: 10, width: 2, height: 2 } }),
        RangeError,
      );

      frame.close();
    });
  });

  describe('allocationSize()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      assert.throws(() => frame.allocationSize(), DOMException);
      try {
        frame.allocationSize();
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });
  });

  describe('metadata()', () => {
    it('should throw DOMException with InvalidStateError when closed', () => {
      const data = new Uint8Array(4 * 4 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 4,
        codedHeight: 4,
        timestamp: 1000,
      });

      frame.close();

      assert.throws(() => frame.metadata(), DOMException);
      try {
        frame.metadata();
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });
  });
});
