/**
 * W3C WebCodecs VideoEncoder Interface Compliance Tests
 * Tests for full compliance with https://www.w3.org/TR/webcodecs/#videoencoder-interface
 */

import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

describe('W3C VideoEncoder Interface Compliance', () => {
  describe('VideoEncoderInit', () => {
    it('should require output callback per W3C spec', () => {
      assert.throws(() => { new VideoEncoder({} as any); }, TypeError);
    });

    it('should require error callback per W3C spec', () => {
      assert.throws(() => { new VideoEncoder({ output: () => {} } as any); }, TypeError);
    });
  });

  describe('VideoEncoder properties', () => {
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

    it('should have state property (CodecState)', () => {
      assert.ok(['unconfigured', 'configured', 'closed'].includes(encoder.state));
    });

    it('should have encodeQueueSize property (unsigned long)', () => {
      assert.strictEqual(typeof encoder.encodeQueueSize, 'number');
      assert.ok(encoder.encodeQueueSize >= 0);
    });

    it('should support ondequeue event handler', () => {
      assert.strictEqual(encoder.ondequeue, null);
      const handler = () => {};
      encoder.ondequeue = handler;
      assert.strictEqual(encoder.ondequeue, handler);
    });

    it('should extend EventTarget', () => {
      assert.ok(encoder instanceof EventTarget);
      assert.strictEqual(typeof encoder.addEventListener, 'function');
      assert.strictEqual(typeof encoder.removeEventListener, 'function');
      assert.strictEqual(typeof encoder.dispatchEvent, 'function');
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

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, fullConfig.codec);
      assert.strictEqual(result.config.width, fullConfig.width);
      assert.strictEqual(result.config.height, fullConfig.height);
      assert.strictEqual(result.config.displayWidth, fullConfig.displayWidth);
      assert.strictEqual(result.config.displayHeight, fullConfig.displayHeight);
      assert.strictEqual(result.config.bitrate, fullConfig.bitrate);
      assert.strictEqual(result.config.framerate, fullConfig.framerate);
      assert.strictEqual(result.config.hardwareAcceleration, fullConfig.hardwareAcceleration);
      assert.strictEqual(result.config.alpha, fullConfig.alpha);
      assert.strictEqual(result.config.scalabilityMode, fullConfig.scalabilityMode);
      assert.strictEqual(result.config.bitrateMode, fullConfig.bitrateMode);
      assert.strictEqual(result.config.latencyMode, fullConfig.latencyMode);
      assert.strictEqual(result.config.contentHint, fullConfig.contentHint);
      assert.strictEqual(result.config.colorSpace?.primaries, fullConfig.colorSpace?.primaries);
      assert.strictEqual(result.config.colorSpace?.transfer, fullConfig.colorSpace?.transfer);
      assert.strictEqual(result.config.colorSpace?.matrix, fullConfig.colorSpace?.matrix);
      assert.strictEqual(result.config.colorSpace?.fullRange, fullConfig.colorSpace?.fullRange);
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
      assert.notStrictEqual(keyframe, undefined);

      const dc = keyframe?.metadata?.decoderConfig;
      assert.notStrictEqual(dc, undefined);
      assert.ok(dc?.codec.includes('avc1'));
      assert.strictEqual(dc?.codedWidth, 640);
      assert.strictEqual(dc?.codedHeight, 480);
      assert.strictEqual(dc?.displayAspectWidth, 800);
      assert.strictEqual(dc?.displayAspectHeight, 600);
      assert.strictEqual(dc?.colorSpace?.primaries, 'bt709');
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
      assert.notStrictEqual(keyframe?.metadata?.svc, undefined);
      assert.strictEqual(keyframe?.metadata?.svc?.temporalLayerId, 0);
    });
  });

  describe('State machine compliance', () => {
    it('should transition: unconfigured -> configured -> closed', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
      });
      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
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
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should throw InvalidStateError when configure() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      assert.throws(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
        });
      }, /closed|InvalidStateError/i);
    });

    it('should throw InvalidStateError when flush() called on unconfigured encoder', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      await assert.rejects(encoder.flush(), /configured|InvalidStateError/i);
      encoder.close();
    });

    it('should throw InvalidStateError when reset() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();

      assert.throws(() => { encoder.reset(); }, /closed|InvalidStateError/i);
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
        assert.throws(() => { encoder.encode(frame); }, /unconfigured|InvalidStateError/i);
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
        assert.throws(() => { encoder.encode(frame); }, /closed|InvalidStateError/i);
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

      assert.throws(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
        } as any);
      }, TypeError);

      encoder.close();
    });
  });
});
