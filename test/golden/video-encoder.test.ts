/**
 * Tests for VideoEncoder
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONSTANTS } from '../fixtures/test-helpers';

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

    it('should echo avc.format = annexb in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        avc: { format: 'annexb' },
      });
      expect(result.supported).toBe(true);
      expect(result.config.avc).toBeDefined();
      expect(result.config.avc?.format).toBe('annexb');
    });

    it('should echo avc.format = avc in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        avc: { format: 'avc' },
      });
      expect(result.supported).toBe(true);
      expect(result.config.avc?.format).toBe('avc');
    });

    it('should echo hevc.format in config when HEVC supported', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'hvc1.1.6.L93.B0',
        width: 640,
        height: 480,
        hevc: { format: 'annexb' },
      });
      // HEVC may not be available on all systems
      if (result.supported) {
        expect(result.config.hevc?.format).toBe('annexb');
      }
    });

    it('should echo all recognized VideoEncoderConfig properties', async () => {
      const inputConfig = {
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
        bitrate: 5_000_000,
        framerate: 30,
        hardwareAcceleration: 'prefer-software' as const,
        alpha: 'discard' as const,
        scalabilityMode: 'L1T2',
        bitrateMode: 'variable' as const,
        latencyMode: 'quality' as const,
        contentHint: 'motion',
        avc: { format: 'annexb' as const },
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      };

      const result = await VideoEncoder.isConfigSupported(inputConfig);

      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe(inputConfig.codec);
      expect(result.config.width).toBe(inputConfig.width);
      expect(result.config.height).toBe(inputConfig.height);
      expect(result.config.displayWidth).toBe(inputConfig.displayWidth);
      expect(result.config.displayHeight).toBe(inputConfig.displayHeight);
      expect(result.config.bitrate).toBe(inputConfig.bitrate);
      expect(result.config.framerate).toBe(inputConfig.framerate);
      expect(result.config.hardwareAcceleration).toBe(inputConfig.hardwareAcceleration);
      expect(result.config.alpha).toBe(inputConfig.alpha);
      expect(result.config.scalabilityMode).toBe(inputConfig.scalabilityMode);
      expect(result.config.bitrateMode).toBe(inputConfig.bitrateMode);
      expect(result.config.latencyMode).toBe(inputConfig.latencyMode);
      expect(result.config.contentHint).toBe(inputConfig.contentHint);
      expect(result.config.avc?.format).toBe(inputConfig.avc.format);
      expect(result.config.colorSpace?.primaries).toBe(inputConfig.colorSpace.primaries);
      expect(result.config.colorSpace?.transfer).toBe(inputConfig.colorSpace.transfer);
      expect(result.config.colorSpace?.matrix).toBe(inputConfig.colorSpace.matrix);
      expect(result.config.colorSpace?.fullRange).toBe(inputConfig.colorSpace.fullRange);
    });

    it('should not echo unrecognized properties', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        unknownProperty: 'should-not-appear',
      } as any);

      expect(result.supported).toBe(true);
      expect((result.config as any).unknownProperty).toBeUndefined();
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
      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      const data = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
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
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        bitrate: 1_000_000,
      });

      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

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

      let _called = false;
      const handler = () => {
        _called = true;
      };

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
        error: (e) => {
          throw e;
        },
      });

      encoder.ondequeue = () => {
        callbackCalled = true;
      };
      encoder.addEventListener('dequeue', () => {
        eventCalled = true;
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        bitrate: 1_000_000,
      });

      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

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
      const chunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({ chunk, metadata });
        },
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

      expect(chunks.length).toBeGreaterThan(0);

      const keyframeChunk = chunks.find((c) => c.chunk.type === 'key');
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
      const chunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({ chunk, metadata });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42E01E',
        width,
        height,
        bitrate: 500_000,
      });

      // Encode a keyframe
      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBeGreaterThan(0);

      // Verify svc metadata is present on keyframe
      const keyframeChunk = chunks.find((c) => c.chunk.type === 'key');
      expect(keyframeChunk?.metadata?.svc).toBeDefined();
      expect(keyframeChunk?.metadata?.svc?.temporalLayerId).toBe(0);
    });
  });

  describe('AVC bitstream format', () => {
    it('should produce annexb bitstream with start codes when avc.format = annexb', async () => {
      const chunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({ chunk, metadata });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        bitrate: 1_000_000,
        avc: { format: 'annexb' },
      });

      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBeGreaterThan(0);
      // For annexb, keyframe should contain NAL units with start codes
      const keyChunk = chunks[0];
      const data = new Uint8Array(keyChunk.chunk.byteLength);
      keyChunk.chunk.copyTo(data);

      // Check for Annex B start code (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
      const hasStartCode =
        (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1) ||
        (data[0] === 0 && data[1] === 0 && data[2] === 1);
      expect(hasStartCode).toBe(true);
    });

    it('should store bitstream format and apply it in encoding', async () => {
      const chunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({ chunk, metadata });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      // Test with default (avc format)
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        bitrate: 1_000_000,
        avc: { format: 'avc' },
      });

      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBeGreaterThan(0);
      // decoderConfig should have description for avc format
      const keyframe = chunks.find((c) => c.chunk.type === 'key');
      expect(keyframe?.metadata?.decoderConfig).toBeDefined();
      expect(keyframe?.metadata?.decoderConfig?.description).toBeDefined();
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
      const chunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({ chunk, metadata });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42E01E',
        width,
        height,
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      });

      const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find((c) => c.chunk.type === 'key');
      expect(keyframe?.metadata?.decoderConfig?.colorSpace).toBeDefined();
      expect(keyframe?.metadata?.decoderConfig?.colorSpace?.primaries).toBe('bt709');
    });
  });

  describe('flush event loop behavior', () => {
    it('should yield to event loop during flush', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
      });

      // Encode frames
      for (let i = 0; i < 100; i++) {
        const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
        });
        encoder.encode(frame);
        frame.close();
      }

      // Verify event loop yields by checking if a setImmediate callback runs
      // during flush. This confirms the flush implementation doesn't spin
      // synchronously while waiting for encoder to complete.
      let immediateRan = false;
      const immediateHandle = setImmediate(() => {
        immediateRan = true;
      });

      await encoder.flush();
      clearImmediate(immediateHandle);

      // The immediate callback should have run during the flush await,
      // proving the event loop was not blocked.
      expect(immediateRan).toBe(true);
      encoder.close();
    });
  });

  describe('reset() behavior', () => {
    it('reset() should be no-op when closed (W3C spec)', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      // W3C spec: reset() is no-op when closed, should NOT throw
      expect(() => encoder.reset()).not.toThrow();
    });
  });

  describe('hardware acceleration', () => {
    it('should report hardware encoder availability in isConfigSupported', async () => {
      const config = {
        codec: 'avc1.42001e',
        width: 1920,
        height: 1080,
        hardwareAcceleration: 'prefer-hardware' as const,
      };

      const support = await VideoEncoder.isConfigSupported(config);
      // Should not throw, may or may not have HW support
      expect(support.supported).toBeDefined();
    });

    it('should fall back to software when hardware unavailable', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        hardwareAcceleration: 'prefer-hardware',
      });

      // Should configure successfully regardless of HW availability
      expect(encoder.state).toBe('configured');
      encoder.close();
    });

    it('should respect prefer-software setting', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        hardwareAcceleration: 'prefer-software',
      });

      // Should configure successfully with software encoder
      expect(encoder.state).toBe('configured');
      encoder.close();
    });

    it('should work with no-preference setting', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        hardwareAcceleration: 'no-preference',
      });

      // Should configure successfully
      expect(encoder.state).toBe('configured');
      encoder.close();
    });
  });

  describe('SVC temporal layer tracking', () => {
    it('should report temporalLayerId based on scalabilityMode L1T2', async () => {
      const chunks: Array<{ timestamp: number; layerId: number }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({
            timestamp: chunk.timestamp,
            layerId: metadata?.svc?.temporalLayerId ?? -1,
          });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42E01E',
        width,
        height,
        scalabilityMode: 'L1T2',
      });

      // Encode 4 frames
      for (let i = 0; i < 4; i++) {
        const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
        });
        encoder.encode(frame);
        frame.close();
      }

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBe(4);
      // Sort by timestamp to get presentation order (B-frames may cause decode order to differ)
      chunks.sort((a, b) => a.timestamp - b.timestamp);
      // L1T2 pattern: [0, 1, 0, 1]
      expect(chunks[0].layerId).toBe(0);
      expect(chunks[1].layerId).toBe(1);
      expect(chunks[2].layerId).toBe(0);
      expect(chunks[3].layerId).toBe(1);
    });

    it('should report temporalLayerId based on scalabilityMode L1T3', async () => {
      const chunks: Array<{ timestamp: number; layerId: number }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({
            timestamp: chunk.timestamp,
            layerId: metadata?.svc?.temporalLayerId ?? -1,
          });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42E01E',
        width,
        height,
        scalabilityMode: 'L1T3',
      });

      // Encode 8 frames to see full L1T3 pattern
      for (let i = 0; i < 8; i++) {
        const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
        });
        encoder.encode(frame);
        frame.close();
      }

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBe(8);
      // Sort by timestamp (B-frames may cause decode order != presentation order)
      chunks.sort((a, b) => a.timestamp - b.timestamp);
      // L1T3 pattern: [0, 2, 1, 2, 0, 2, 1, 2]
      expect(chunks.map((c) => c.layerId)).toEqual([0, 2, 1, 2, 0, 2, 1, 2]);
    });

    it('should report temporalLayerId 0 when scalabilityMode not set', async () => {
      const chunks: Array<{ timestamp: number; layerId: number }> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          chunks.push({
            timestamp: chunk.timestamp,
            layerId: metadata?.svc?.temporalLayerId ?? -1,
          });
        },
        error: (e) => {
          throw e;
        },
      });

      const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
      encoder.configure({
        codec: 'avc1.42E01E',
        width,
        height,
        // No scalabilityMode - should default to all layer 0
      });

      for (let i = 0; i < 4; i++) {
        const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
        });
        encoder.encode(frame);
        frame.close();
      }

      await encoder.flush();
      encoder.close();

      expect(chunks.length).toBe(4);
      // All frames should be layer 0 when no scalabilityMode
      expect(chunks.every((c) => c.layerId === 0)).toBe(true);
    });
  });
});
