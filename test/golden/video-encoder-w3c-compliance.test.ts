/**
 * W3C WebCodecs VideoEncoder Interface Compliance Tests
 * Tests for full compliance with https://www.w3.org/TR/webcodecs/#videoencoder-interface
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('W3C VideoEncoder Interface Compliance', () => {
  describe('VideoEncoderInit', () => {
    it('should require output callback per W3C spec', () => {
      expect(() => new VideoEncoder({} as any)).toThrow(TypeError);
    });

    it('should require error callback per W3C spec', () => {
      expect(() => new VideoEncoder({ output: () => {} } as any)).toThrow(TypeError);
    });
  });

  describe('VideoEncoder properties', () => {
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

    it('should have state property (CodecState)', () => {
      expect(['unconfigured', 'configured', 'closed']).toContain(encoder.state);
    });

    it('should have encodeQueueSize property (unsigned long)', () => {
      expect(typeof encoder.encodeQueueSize).toBe('number');
      expect(encoder.encodeQueueSize).toBeGreaterThanOrEqual(0);
    });

    it('should support ondequeue event handler', () => {
      expect(encoder.ondequeue).toBeNull();
      const handler = () => {};
      encoder.ondequeue = handler;
      expect(encoder.ondequeue).toBe(handler);
    });

    it('should extend EventTarget', () => {
      expect(encoder).toBeInstanceOf(EventTarget);
      expect(typeof encoder.addEventListener).toBe('function');
      expect(typeof encoder.removeEventListener).toBe('function');
      expect(typeof encoder.dispatchEvent).toBe('function');
    });
  });

  describe('VideoEncoderConfig complete echo', () => {
    const fullConfig: VideoEncoderConfig = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      bitrate: 5_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
      alpha: 'discard',
      scalabilityMode: 'L1T1',
      bitrateMode: 'variable',
      latencyMode: 'quality',
      contentHint: 'detail',
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      },
    };

    it('should echo all VideoEncoderConfig properties in isConfigSupported', async () => {
      const result = await VideoEncoder.isConfigSupported(fullConfig);

      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe(fullConfig.codec);
      expect(result.config.width).toBe(fullConfig.width);
      expect(result.config.height).toBe(fullConfig.height);
      expect(result.config.displayWidth).toBe(fullConfig.displayWidth);
      expect(result.config.displayHeight).toBe(fullConfig.displayHeight);
      expect(result.config.bitrate).toBe(fullConfig.bitrate);
      expect(result.config.framerate).toBe(fullConfig.framerate);
      expect(result.config.hardwareAcceleration).toBe(fullConfig.hardwareAcceleration);
      expect(result.config.alpha).toBe(fullConfig.alpha);
      expect(result.config.scalabilityMode).toBe(fullConfig.scalabilityMode);
      expect(result.config.bitrateMode).toBe(fullConfig.bitrateMode);
      expect(result.config.latencyMode).toBe(fullConfig.latencyMode);
      expect(result.config.contentHint).toBe(fullConfig.contentHint);
      expect(result.config.colorSpace?.primaries).toBe(fullConfig.colorSpace?.primaries);
      expect(result.config.colorSpace?.transfer).toBe(fullConfig.colorSpace?.transfer);
      expect(result.config.colorSpace?.matrix).toBe(fullConfig.colorSpace?.matrix);
      expect(result.config.colorSpace?.fullRange).toBe(fullConfig.colorSpace?.fullRange);
    });
  });

  describe('EncodedVideoChunkMetadata compliance', () => {
    it('should provide complete decoderConfig on keyframes', async () => {
      const chunks: Array<{
        chunk: EncodedVideoChunk;
        metadata?: EncodedVideoChunkMetadata;
      }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => chunks.push({ chunk, metadata }),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        displayWidth: 800,
        displayHeight: 600,
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      });

      const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
      });
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find((c) => c.chunk.type === 'key');
      expect(keyframe).toBeDefined();

      const dc = keyframe?.metadata?.decoderConfig;
      expect(dc).toBeDefined();
      expect(dc?.codec).toContain('avc1');
      expect(dc?.codedWidth).toBe(640);
      expect(dc?.codedHeight).toBe(480);
      expect(dc?.displayAspectWidth).toBe(800);
      expect(dc?.displayAspectHeight).toBe(600);
      expect(dc?.colorSpace?.primaries).toBe('bt709');
    });

    it('should include svc metadata with temporalLayerId', async () => {
      const chunks: Array<{
        chunk: EncodedVideoChunk;
        metadata?: EncodedVideoChunkMetadata;
      }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => chunks.push({ chunk, metadata }),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 320,
        height: 240,
      });

      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find((c) => c.chunk.type === 'key');
      expect(keyframe?.metadata?.svc).toBeDefined();
      expect(keyframe?.metadata?.svc?.temporalLayerId).toBe(0);
    });
  });

  describe('State machine compliance', () => {
    it('should transition: unconfigured -> configured -> closed', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(encoder.state).toBe('unconfigured');

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
      });
      expect(encoder.state).toBe('configured');

      encoder.close();
      expect(encoder.state).toBe('closed');
    });

    it('should transition: configured -> unconfigured via reset()', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
      });
      expect(encoder.state).toBe('configured');

      encoder.reset();
      expect(encoder.state).toBe('unconfigured');

      encoder.close();
    });

    it('should throw InvalidStateError when configure() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
        });
      }).toThrow(/closed|InvalidStateError/i);
    });

    it('should throw InvalidStateError when flush() called on unconfigured encoder', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      await expect(encoder.flush()).rejects.toThrow(/configured|InvalidStateError/i);
      encoder.close();
    });

    it('should throw InvalidStateError when reset() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();

      expect(() => encoder.reset()).toThrow(/closed|InvalidStateError/i);
    });

    it('should throw InvalidStateError when encode() called on unconfigured encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
        format: 'RGBA',
        codedWidth: 64,
        codedHeight: 64,
        timestamp: 0,
      });

      try {
        expect(() => encoder.encode(frame)).toThrow(/unconfigured|InvalidStateError/i);
      } finally {
        frame.close();
        encoder.close();
      }
    });

    it('should throw InvalidStateError when encode() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();

      const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
        format: 'RGBA',
        codedWidth: 64,
        codedHeight: 64,
        timestamp: 0,
      });

      try {
        expect(() => encoder.encode(frame)).toThrow(/closed|InvalidStateError/i);
      } finally {
        frame.close();
      }
    });
  });

  describe('TypeError validation', () => {
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
        } as any);
      }).toThrow(TypeError);

      encoder.close();
    });
  });
});
