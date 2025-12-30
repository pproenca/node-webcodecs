/**
 * Tests for VideoDecoder
 */

import {beforeEach, afterEach, expect, it, describe} from 'vitest';

describe('VideoDecoder', () => {
  describe('isConfigSupported', () => {
    it('should support H.264 baseline profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42E01E',
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('avc1.42E01E');
    });

    it('should support H.264 main profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.4D401F',
      });
      expect(result.supported).toBe(true);
    });

    it('should support H.264 high profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.640028',
      });
      expect(result.supported).toBe(true);
    });

    it('should support VP8', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp8',
      });
      expect(result.supported).toBe(true);
    });

    it('should support VP9', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp9',
      });
      expect(result.supported).toBe(true);
    });

    it('should not support unknown codecs', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'unknown-codec',
      });
      expect(result.supported).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should require output callback', () => {
      expect(() => {
        new VideoDecoder({} as any);
      }).toThrow(TypeError);
    });

    it('should require error callback', () => {
      expect(() => {
        new VideoDecoder({
          output: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should create decoder with valid callbacks', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder.state).toBe('unconfigured');
      expect(decoder.decodeQueueSize).toBe(0);
      decoder.close();
    });
  });

  describe('state management', () => {
    let decoder: VideoDecoder;

    beforeEach(() => {
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (decoder.state !== 'closed') {
        decoder.close();
      }
    });

    it('should start in unconfigured state', () => {
      expect(decoder.state).toBe('unconfigured');
    });

    it('should throw if decode called when unconfigured', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      expect(() => decoder.decode(chunk)).toThrow();
    });

    it('should throw if flush called when unconfigured', async () => {
      await expect(decoder.flush()).rejects.toThrow();
    });

    it('should throw if decode called after close', () => {
      decoder.close();

      expect(() => {
        decoder.configure({ codec: 'avc1.42E01E' });
      }).toThrow();
    });
  });

  describe('decodeQueueSize tracking', () => {
    it('should increment during decode and decrement after output', async () => {
      // First encode a frame to get valid H.264 data
      const encodedChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          // Copy the chunk data since we need to use it after encoder is closed
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push(new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration ?? undefined,
            data: data,
          }));
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30,
      });

      // Create and encode a test frame
      const frameData = new Uint8Array(320 * 240 * 4);
      for (let i = 0; i < frameData.length; i += 4) {
        frameData[i] = 128;     // R
        frameData[i + 1] = 128; // G
        frameData[i + 2] = 128; // B
        frameData[i + 3] = 255; // A
      }
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });

      encoder.encode(frame, {keyFrame: true});
      await encoder.flush();
      frame.close();
      encoder.close();

      expect(encodedChunks.length).toBeGreaterThan(0);

      // Now decode the encoded data
      const outputFrames: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (outputFrame) => {
          outputFrames.push(outputFrame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      expect(decoder.decodeQueueSize).toBe(0);

      // Decode the encoded chunk
      decoder.decode(encodedChunks[0]);
      await decoder.flush();

      // After flush, queue should be empty
      expect(decoder.decodeQueueSize).toBe(0);

      outputFrames.forEach(f => f.close());
      decoder.close();
    });
  });
});
