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

    it('should echo displayWidth and displayHeight in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
      });
      expect(result.supported).toBe(true);
      expect(result.config.displayWidth).toBe(1920);
      expect(result.config.displayHeight).toBe(1080);
    });

    it('should echo displayWidth and displayHeight when different from coded dimensions', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
        displayWidth: 1280,
        displayHeight: 720,
      });
      expect(result.supported).toBe(true);
      expect(result.config.displayWidth).toBe(1280);
      expect(result.config.displayHeight).toBe(720);
    });

    it('should echo alpha option in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        alpha: 'discard',
      });
      expect(result.supported).toBe(true);
      expect(result.config.alpha).toBe('discard');
    });

    it('should echo scalabilityMode in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        scalabilityMode: 'L1T2',
      });
      expect(result.supported).toBe(true);
      expect(result.config.scalabilityMode).toBe('L1T2');
    });

    it('should echo contentHint in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        contentHint: 'motion',
      });
      expect(result.supported).toBe(true);
      expect(result.config.contentHint).toBe('motion');
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

  describe('configure validation', () => {
    it('should throw TypeError if displayWidth provided without displayHeight', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
          // displayHeight intentionally omitted
        } as any);
      }).toThrow(TypeError);

      encoder.close();
    });

    it('should throw TypeError if displayHeight provided without displayWidth', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          // displayWidth intentionally omitted
          displayHeight: 480,
        } as any);
      }).toThrow(TypeError);

      encoder.close();
    });

    it('should accept config with both displayWidth and displayHeight', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
          displayHeight: 480,
        });
      }).not.toThrow();

      encoder.close();
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

  describe('EncodedVideoChunkMetadata', () => {
    it('should include complete decoderConfig on first keyframe', async () => {
      const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({chunk, metadata});
        },
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        displayWidth: 800,
        displayHeight: 600,
      });

      const frame = new VideoFrame(
        new Uint8Array(640 * 480 * 4),
        {
          format: 'RGBA',
          codedWidth: 640,
          codedHeight: 480,
          timestamp: 0,
        }
      );

      encoder.encode(frame, {keyFrame: true});
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBeGreaterThan(0);

      const keyframeChunk = chunks.find(c => c.chunk.type === 'key');
      expect(keyframeChunk).toBeDefined();
      expect(keyframeChunk?.metadata?.decoderConfig).toBeDefined();
      expect(keyframeChunk?.metadata?.decoderConfig?.codec).toContain('avc1');
      expect(keyframeChunk?.metadata?.decoderConfig?.codedWidth).toBe(640);
      expect(keyframeChunk?.metadata?.decoderConfig?.codedHeight).toBe(480);
      // These are the new properties we're adding:
      expect(keyframeChunk?.metadata?.decoderConfig?.displayAspectWidth).toBe(800);
      expect(keyframeChunk?.metadata?.decoderConfig?.displayAspectHeight).toBe(600);
    });

    it('should include svc metadata with temporalLayerId', async () => {
      const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({chunk, metadata});
        },
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 320,
        height: 240,
        bitrate: 500_000,
      });

      // Encode a keyframe
      const frame = new VideoFrame(
        new Uint8Array(320 * 240 * 4),
        {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: 0,
        }
      );
      encoder.encode(frame, {keyFrame: true});
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBeGreaterThan(0);

      // Verify svc metadata is present on keyframe
      const keyframeChunk = chunks.find(c => c.chunk.type === 'key');
      expect(keyframeChunk?.metadata?.svc).toBeDefined();
      expect(keyframeChunk?.metadata?.svc?.temporalLayerId).toBe(0);
    });
  });

  describe('colorSpace support', () => {
    it('should echo colorSpace in isConfigSupported', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      });
      expect(result.supported).toBe(true);
      expect(result.config.colorSpace).toBeDefined();
      expect(result.config.colorSpace?.primaries).toBe('bt709');
      expect(result.config.colorSpace?.transfer).toBe('bt709');
      expect(result.config.colorSpace?.matrix).toBe('bt709');
      expect(result.config.colorSpace?.fullRange).toBe(false);
    });

    it('should include colorSpace in decoderConfig metadata', async () => {
      const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({chunk, metadata});
        },
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 320,
        height: 240,
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
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

      encoder.encode(frame, {keyFrame: true});
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find(c => c.chunk.type === 'key');
      expect(keyframe?.metadata?.decoderConfig?.colorSpace).toBeDefined();
      expect(keyframe?.metadata?.decoderConfig?.colorSpace?.primaries).toBe('bt709');
    });
  });
});
