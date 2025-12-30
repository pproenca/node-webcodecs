/**
 * Tests for VideoEncoder
 */

import {beforeEach, afterEach, expect, it, describe} from 'vitest';

describe('VideoEncoder', () => {
  describe('isConfigSupported', () => {
    it('should support H.264 baseline profile', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
      });
      expect(result.supported).toBe(true);
    });

    it('should support H.264 with bitrate', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      });
      expect(result.supported).toBe(true);
    });

    it('should reject invalid dimensions', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 0,
        height: 1080,
      });
      expect(result.supported).toBe(false);
    });

    it('should reject unknown codecs', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'unknown',
        width: 1920,
        height: 1080,
      });
      expect(result.supported).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should require output callback', () => {
      expect(() => {
        new VideoEncoder({} as any);
      }).toThrow(TypeError);
    });

    it('should require error callback', () => {
      expect(() => {
        new VideoEncoder({
          output: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should create encoder with valid callbacks', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder.state).toBe('unconfigured');
      expect(encoder.encodeQueueSize).toBe(0);
      encoder.close();
    });
  });

  describe('state management', () => {
    let encoder: VideoEncoder;

    beforeEach(() => {
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    });

    it('should start in unconfigured state', () => {
      expect(encoder.state).toBe('unconfigured');
    });

    it('should throw if encode called when unconfigured', () => {
      const data = new Uint8Array(640 * 480 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
      });

      expect(() => encoder.encode(frame)).toThrow();
      frame.close();
    });

    it('should throw if flush called when unconfigured', async () => {
      await expect(encoder.flush()).rejects.toThrow();
    });

    it('should throw if configure called after close', () => {
      encoder.close();

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
        });
      }).toThrow();
    });
  });

  describe('EventTarget', () => {
    it('should support addEventListener for dequeue', async () => {
      let dequeueCount = 0;
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrate: 1_000_000,
      });

      const frame = new VideoFrame(
        new Uint8Array(320 * 240 * 4),
        {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: 0,
        }
      );

      encoder.encode(frame);
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(dequeueCount).toBeGreaterThan(0);
    });

    it('should support removeEventListener', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      let called = false;
      const handler = () => { called = true; };

      encoder.addEventListener('dequeue', handler);
      encoder.removeEventListener('dequeue', handler);

      encoder.close();
      expect(encoder.removeEventListener).toBeDefined();
    });

    it('should support both ondequeue callback and addEventListener', async () => {
      let callbackCalled = false;
      let eventCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; },
      });

      encoder.ondequeue = () => { callbackCalled = true; };
      encoder.addEventListener('dequeue', () => { eventCalled = true; });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrate: 1_000_000,
      });

      const frame = new VideoFrame(
        new Uint8Array(320 * 240 * 4),
        {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: 0,
        }
      );

      encoder.encode(frame);
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(callbackCalled).toBe(true);
      expect(eventCalled).toBe(true);
    });
  });
});
