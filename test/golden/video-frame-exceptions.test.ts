import {describe, it, expect} from 'vitest';

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

      expect(() => frame.clone()).toThrow(DOMException);
      try {
        frame.clone();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
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
      await expect(frame.copyTo(dest)).rejects.toThrow(DOMException);

      try {
        await frame.copyTo(dest);
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
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

      await expect(frame.copyTo(dest)).rejects.toThrow(RangeError);

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

      await expect(
        frame.copyTo(dest, {rect: {x: 10, y: 10, width: 2, height: 2}})
      ).rejects.toThrow(RangeError);

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

      expect(() => frame.allocationSize()).toThrow(DOMException);
      try {
        frame.allocationSize();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
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

      expect(() => frame.metadata()).toThrow(DOMException);
      try {
        frame.metadata();
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
    });
  });
});
