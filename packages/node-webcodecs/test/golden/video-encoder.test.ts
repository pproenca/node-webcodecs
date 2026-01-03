/**
 * Tests for VideoEncoder
 */

import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { TEST_CONSTANTS } from '../fixtures/test-helpers';

describe('VideoEncoder', () => {
  describe('isConfigSupported', () => {
    it('should support H.264 baseline profile', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should support H.264 with bitrate', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should reject invalid dimensions', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 0,
        height: 1080,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should reject unknown codecs', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'unknown',
        width: 1920,
        height: 1080,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should echo displayWidth and displayHeight in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.displayWidth, 1920);
      assert.strictEqual(result.config.displayHeight, 1080);
    });

    it('should echo displayWidth and displayHeight when different from coded dimensions', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 1920,
        height: 1080,
        displayWidth: 1280,
        displayHeight: 720,
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.displayWidth, 1280);
      assert.strictEqual(result.config.displayHeight, 720);
    });

    it('should echo alpha option in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        alpha: 'discard',
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.alpha, 'discard');
    });

    it('should echo scalabilityMode in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        scalabilityMode: 'L1T2',
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.scalabilityMode, 'L1T2');
    });

    it('should echo contentHint in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        contentHint: 'motion',
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.contentHint, 'motion');
    });

    it('should echo avc.format = annexb in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        avc: { format: 'annexb' },
      });
      assert.strictEqual(result.supported, true);
      assert.notStrictEqual(result.config.avc, undefined);
      assert.strictEqual(result.config.avc?.format, 'annexb');
    });

    it('should echo avc.format = avc in config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        avc: { format: 'avc' },
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.avc?.format, 'avc');
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
        assert.strictEqual(result.config.hevc?.format, 'annexb');
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

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, inputConfig.codec);
      assert.strictEqual(result.config.width, inputConfig.width);
      assert.strictEqual(result.config.height, inputConfig.height);
      assert.strictEqual(result.config.displayWidth, inputConfig.displayWidth);
      assert.strictEqual(result.config.displayHeight, inputConfig.displayHeight);
      assert.strictEqual(result.config.bitrate, inputConfig.bitrate);
      assert.strictEqual(result.config.framerate, inputConfig.framerate);
      assert.strictEqual(result.config.hardwareAcceleration, inputConfig.hardwareAcceleration);
      assert.strictEqual(result.config.alpha, inputConfig.alpha);
      assert.strictEqual(result.config.scalabilityMode, inputConfig.scalabilityMode);
      assert.strictEqual(result.config.bitrateMode, inputConfig.bitrateMode);
      assert.strictEqual(result.config.latencyMode, inputConfig.latencyMode);
      assert.strictEqual(result.config.contentHint, inputConfig.contentHint);
      assert.strictEqual(result.config.avc?.format, inputConfig.avc.format);
      assert.strictEqual(result.config.colorSpace?.primaries, inputConfig.colorSpace.primaries);
      assert.strictEqual(result.config.colorSpace?.transfer, inputConfig.colorSpace.transfer);
      assert.strictEqual(result.config.colorSpace?.matrix, inputConfig.colorSpace.matrix);
      assert.strictEqual(result.config.colorSpace?.fullRange, inputConfig.colorSpace.fullRange);
    });

    it('should not echo unrecognized properties', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        unknownProperty: 'should-not-appear',
      } as any);

      assert.strictEqual(result.supported, true);
      assert.strictEqual((result.config as any).unknownProperty, undefined);
    });
  });

  describe('constructor', () => {
    it('should require output callback', () => {
      assert.throws(() => {
        new VideoEncoder({} as any);
      }, TypeError);
    });

    it('should require error callback', () => {
      assert.throws(() => {
        new VideoEncoder({
          output: () => {},
        } as any);
      }, TypeError);
    });

    it('should create encoder with valid callbacks', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      assert.strictEqual(encoder.state, 'unconfigured');
      assert.strictEqual(encoder.encodeQueueSize, 0);
      encoder.close();
    });
  });

  describe('state management', () => {
    let encoder: VideoEncoder;

    before(() => {
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
    });

    after(() => {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    });

    it('should start in unconfigured state', () => {
      assert.strictEqual(encoder.state, 'unconfigured');
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

      assert.throws(() => encoder.encode(frame));
      frame.close();
    });

    it('should throw if flush called when unconfigured', async () => {
      await assert.rejects(encoder.flush());
    });

    it('should throw if configure called after close', () => {
      encoder.close();

      assert.throws(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
        });
      });
    });
  });

  describe('configure validation', () => {
    it('should throw TypeError if displayWidth provided without displayHeight', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
          // displayHeight intentionally omitted
        } as any);
      }, TypeError);

      encoder.close();
    });

    it('should throw TypeError if displayHeight provided without displayWidth', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          // displayWidth intentionally omitted
          displayHeight: 480,
        } as any);
      }, TypeError);

      encoder.close();
    });

    it('should accept config with both displayWidth and displayHeight', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.doesNotThrow(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
          displayHeight: 480,
        });
      });

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

      assert.ok(dequeueCount > 0);
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
      assert.notStrictEqual(encoder.removeEventListener, undefined);
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

      assert.strictEqual(callbackCalled, true);
      assert.strictEqual(eventCalled, true);
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

      assert.ok(chunks.length > 0);

      const keyframeChunk = chunks.find((c) => c.chunk.type === 'key');
      assert.notStrictEqual(keyframeChunk, undefined);
      assert.notStrictEqual(keyframeChunk?.metadata?.decoderConfig, undefined);
      assert.ok(keyframeChunk?.metadata?.decoderConfig?.codec?.includes('avc1'));
      assert.strictEqual(keyframeChunk?.metadata?.decoderConfig?.codedWidth, 640);
      assert.strictEqual(keyframeChunk?.metadata?.decoderConfig?.codedHeight, 480);
      // These are the new properties we're adding:
      assert.strictEqual(keyframeChunk?.metadata?.decoderConfig?.displayAspectWidth, 800);
      assert.strictEqual(keyframeChunk?.metadata?.decoderConfig?.displayAspectHeight, 600);
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

      assert.ok(chunks.length > 0);

      // Verify svc metadata is present on keyframe
      const keyframeChunk = chunks.find((c) => c.chunk.type === 'key');
      assert.notStrictEqual(keyframeChunk?.metadata?.svc, undefined);
      assert.strictEqual(keyframeChunk?.metadata?.svc?.temporalLayerId, 0);
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

      assert.ok(chunks.length > 0);
      // For annexb, keyframe should contain NAL units with start codes
      const keyChunk = chunks[0];
      const data = new Uint8Array(keyChunk.chunk.byteLength);
      keyChunk.chunk.copyTo(data);

      // Check for Annex B start code (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
      const hasStartCode =
        (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1) ||
        (data[0] === 0 && data[1] === 0 && data[2] === 1);
      assert.strictEqual(hasStartCode, true);
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

      assert.ok(chunks.length > 0);
      // decoderConfig should have description for avc format
      const keyframe = chunks.find((c) => c.chunk.type === 'key');
      assert.notStrictEqual(keyframe?.metadata?.decoderConfig, undefined);
      assert.notStrictEqual(keyframe?.metadata?.decoderConfig?.description, undefined);
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
      assert.strictEqual(result.supported, true);
      assert.notStrictEqual(result.config.colorSpace, undefined);
      assert.strictEqual(result.config.colorSpace?.primaries, 'bt709');
      assert.strictEqual(result.config.colorSpace?.transfer, 'bt709');
      assert.strictEqual(result.config.colorSpace?.matrix, 'bt709');
      assert.strictEqual(result.config.colorSpace?.fullRange, false);
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
      assert.notStrictEqual(keyframe?.metadata?.decoderConfig?.colorSpace, undefined);
      assert.strictEqual(keyframe?.metadata?.decoderConfig?.colorSpace?.primaries, 'bt709');
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

      // Encode frames (50 frames stays below the 64-frame hard limit)
      for (let i = 0; i < 50; i++) {
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
      assert.strictEqual(immediateRan, true);
      encoder.close();
    });
  });

  describe('reset() behavior', () => {
    it('reset() should throw InvalidStateError when closed (W3C spec)', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      // W3C spec: reset() throws InvalidStateError when closed
      assert.throws(() => encoder.reset(), /closed|InvalidStateError/i);
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
      assert.notStrictEqual(support.supported, undefined);
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
      assert.strictEqual(encoder.state, 'configured');
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
      assert.strictEqual(encoder.state, 'configured');
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
      assert.strictEqual(encoder.state, 'configured');
      encoder.close();
    });
  });

  describe('bitrateMode=quantizer', () => {
    it('should accept bitrateMode quantizer config and encode successfully', async () => {
      const chunks: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (c) => chunks.push(c),
        error: (e) => {
          throw e;
        },
      });

      // Configure with bitrateMode=quantizer (CQP mode)
      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrateMode: 'quantizer',
      });

      assert.strictEqual(encoder.state, 'configured');

      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });

      // Encode with per-frame quantizer option
      encoder.encode(frame, { keyFrame: true, avc: { quantizer: 30 } } as any);
      frame.close();

      await encoder.flush();
      encoder.close();

      // Should produce at least one chunk
      assert.ok(chunks.length > 0);
      assert.strictEqual(chunks[0].type, 'key');
    });

    it('should use quality-based encoding without bitrate target', async () => {
      // When bitrateMode=quantizer, the encoder should not use bitrate-based
      // rate control. We verify this by checking that encoding succeeds even
      // without specifying a bitrate.
      const chunks: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (c) => chunks.push(c),
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        codec: 'avc1.42001e',
        width: 320,
        height: 240,
        bitrateMode: 'quantizer',
        // Note: no bitrate specified - encoder uses QP-based control
      });

      // Encode multiple frames to verify consistent behavior
      for (let i = 0; i < 5; i++) {
        const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: i * 33333, // ~30fps
        });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
      }

      await encoder.flush();
      encoder.close();

      // Should produce chunks for all frames
      assert.strictEqual(chunks.length, 5);
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

      assert.strictEqual(chunks.length, 4);
      // Sort by timestamp to get presentation order (B-frames may cause decode order to differ)
      chunks.sort((a, b) => a.timestamp - b.timestamp);
      // L1T2 pattern: [0, 1, 0, 1]
      assert.strictEqual(chunks[0].layerId, 0);
      assert.strictEqual(chunks[1].layerId, 1);
      assert.strictEqual(chunks[2].layerId, 0);
      assert.strictEqual(chunks[3].layerId, 1);
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

      assert.strictEqual(chunks.length, 8);
      // Sort by timestamp (B-frames may cause decode order != presentation order)
      chunks.sort((a, b) => a.timestamp - b.timestamp);
      // L1T3 pattern: [0, 2, 1, 2, 0, 2, 1, 2]
      assert.deepStrictEqual(chunks.map((c) => c.layerId), [0, 2, 1, 2, 0, 2, 1, 2]);
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

      assert.strictEqual(chunks.length, 4);
      // All frames should be layer 0 when no scalabilityMode
      assert.strictEqual(chunks.every((c) => c.layerId === 0), true);
    });
  });
});
