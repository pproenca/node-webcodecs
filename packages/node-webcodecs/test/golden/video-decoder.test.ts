/**
 * Tests for VideoDecoder
 */

import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { expectDOMException, expectDOMExceptionAsync, TEST_CONSTANTS } from '../fixtures/test-helpers';

describe('VideoDecoder', () => {
  describe('VideoDecoderConfig validation', () => {
    it('should throw TypeError for invalid rotation value', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(
        () =>
          decoder.configure({
            codec: 'avc1.42E01E',
            rotation: 45 as any, // Invalid - must be 0, 90, 180, or 270
          }),
        TypeError,
      );

      decoder.close();
    });

    it('should throw TypeError for non-boolean flip value', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(
        () =>
          decoder.configure({
            codec: 'avc1.42E01E',
            flip: 'yes' as any, // Invalid - must be boolean
          }),
        TypeError,
      );

      decoder.close();
    });

    it('should accept valid rotation values', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      for (const rotation of [0, 90, 180, 270]) {
        decoder.configure({ codec: 'avc1.42E01E', rotation } as any);
        decoder.reset();
      }

      decoder.close();
    });
  });

  describe('isConfigSupported', () => {
    it('should support H.264 baseline profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42E01E',
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'avc1.42E01E');
    });

    it('should support H.264 main profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.4D401F',
      });
      assert.strictEqual(result.supported, true);
    });

    it('should support H.264 high profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.640028',
      });
      assert.strictEqual(result.supported, true);
    });

    it('should support VP8', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp8',
      });
      assert.strictEqual(result.supported, true);
    });

    it('should support VP9', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp9',
      });
      assert.strictEqual(result.supported, true);
    });

    it('should not support unknown codecs', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'unknown-codec',
      });
      assert.strictEqual(result.supported, false);
    });
  });

  describe('constructor', () => {
    it('should require output callback', () => {
      assert.throws(() => {
        new VideoDecoder({} as any);
      }, TypeError);
    });

    it('should require error callback', () => {
      assert.throws(() => {
        new VideoDecoder({
          output: () => {},
        } as any);
      }, TypeError);
    });

    it('should create decoder with valid callbacks', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      assert.strictEqual(decoder.state, 'unconfigured');
      assert.strictEqual(decoder.decodeQueueSize, 0);
      decoder.close();
    });
  });

  describe('configure', () => {
    it('should accept config without codedWidth/codedHeight per W3C spec', async () => {
      // W3C spec: codedWidth/codedHeight are optional in VideoDecoderConfig
      // Decoder should accept config with only codec and use dimensions from bitstream
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // This should NOT throw - per W3C spec, dimensions are optional
      assert.doesNotThrow(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          // No codedWidth/codedHeight - decoder should infer from bitstream
        });
      });

      assert.strictEqual(decoder.state, 'configured');
      decoder.close();
    });
  });

  describe('state management', () => {
    let decoder: VideoDecoder;

    before(() => {
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
    });

    after(() => {
      if (decoder.state !== 'closed') {
        decoder.close();
      }
    });

    it('should start in unconfigured state', () => {
      assert.strictEqual(decoder.state, 'unconfigured');
    });

    it('should throw if decode called when unconfigured', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      assert.throws(() => decoder.decode(chunk));
    });

    it('should throw if flush called when unconfigured', async () => {
      await assert.rejects(decoder.flush());
    });

    it('should throw if decode called after close', () => {
      decoder.close();

      assert.throws(() => {
        decoder.configure({ codec: 'avc1.42E01E' });
      });
    });
  });

  describe('decodeQueueSize tracking', () => {
    let decoder: VideoDecoder | null = null;
    const outputFrames: VideoFrame[] = [];

    after(() => {
      try {
        decoder?.close();
      } catch {
        // Already closed or never created
      }
      outputFrames.forEach((f) => {
        try {
          f.close();
        } catch {
          // Already closed
        }
      });
      outputFrames.length = 0;
      decoder = null;
    });

    it('should increment during decode and decrement after output', async () => {
      // First encode a frame to get valid H.264 data
      const encodedChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          // Copy the chunk data since we need to use it after encoder is closed
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push(
            new EncodedVideoChunk({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration ?? undefined,
              data: data,
            }),
          );
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
        bitrate: 500_000,
        framerate: 30,
      });

      // Create and encode a test frame
      const frameData = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP);
      for (let i = 0; i < frameData.length; i += 4) {
        frameData[i] = 128; // R
        frameData[i + 1] = 128; // G
        frameData[i + 2] = 128; // B
        frameData[i + 3] = 255; // A
      }
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      await encoder.flush();
      frame.close();
      encoder.close();

      assert.ok(encodedChunks.length > 0);

      // Now decode the encoded data
      decoder = new VideoDecoder({
        output: (outputFrame) => {
          outputFrames.push(outputFrame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: width,
        codedHeight: height,
      });

      assert.strictEqual(decoder.decodeQueueSize, 0);

      // Decode the encoded chunk
      decoder.decode(encodedChunks[0]);
      await decoder.flush();

      // After flush, queue should be empty
      assert.strictEqual(decoder.decodeQueueSize, 0);
    });
  });

  describe('displayAspectWidth/displayAspectHeight', () => {
    let decoder: VideoDecoder | null = null;
    const outputFrames: VideoFrame[] = [];

    after(() => {
      try {
        decoder?.close();
      } catch {
        // Already closed or never created
      }
      outputFrames.forEach((f) => {
        try {
          f.close();
        } catch {
          // Already closed
        }
      });
      outputFrames.length = 0;
      decoder = null;
    });

    it('should pass displayAspectWidth/displayAspectHeight to VideoFrame output', async () => {
      // Encode a frame first
      const encodedChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk, _metadata) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push(
            new EncodedVideoChunk({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration ?? undefined,
              data: data,
            }),
          );
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
        bitrate: 500_000,
        framerate: 30,
      });

      const frameData = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP).fill(128);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      await encoder.flush();
      frame.close();
      encoder.close();

      // Decode with display aspect ratio specified
      decoder = new VideoDecoder({
        output: (outputFrame) => {
          outputFrames.push(outputFrame);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: width,
        codedHeight: height,
        displayAspectWidth: 16,
        displayAspectHeight: 9,
      });

      decoder.decode(encodedChunks[0]);
      await decoder.flush();

      assert.ok(outputFrames.length > 0);
      assert.strictEqual(outputFrames[0].displayWidth, Math.round((height * 16) / 9)); // ~427
      assert.strictEqual(outputFrames[0].displayHeight, height);
    });
  });

  describe('optimizeForLatency', () => {
    it('should accept optimizeForLatency config option', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // Should not throw when optimizeForLatency is provided
      assert.doesNotThrow(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          optimizeForLatency: true,
        });
      });

      assert.strictEqual(decoder.state, 'configured');
      decoder.close();
    });

    it('should include optimizeForLatency in isConfigSupported result', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
        optimizeForLatency: true,
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.optimizeForLatency, true);
    });
  });

  describe('hardwareAcceleration', () => {
    it('should accept hardwareAcceleration config option', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // Should not throw with hardwareAcceleration
      assert.doesNotThrow(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          hardwareAcceleration: 'prefer-software',
        });
      });

      assert.strictEqual(decoder.state, 'configured');
      decoder.close();
    });

    it('should include hardwareAcceleration in isConfigSupported result', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
        hardwareAcceleration: 'prefer-hardware',
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.hardwareAcceleration, 'prefer-hardware');
    });

    it('should default to no-preference', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
      });
      assert.strictEqual(result.supported, true);
      // Default value should be 'no-preference' per W3C spec
      assert.strictEqual(result.config.hardwareAcceleration, 'no-preference');
    });
  });

  describe('error handling', () => {
    it('should throw InvalidStateError when decode called in unconfigured state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      expectDOMException('InvalidStateError', () => decoder.decode(chunk));
      decoder.close();
    });

    it('should throw InvalidStateError when decode called in closed state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      expectDOMException('InvalidStateError', () => decoder.decode(chunk));
    });

    it('should throw InvalidStateError when configure called in closed state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      expectDOMException('InvalidStateError', () => decoder.configure({ codec: 'avc1.42E01E' }));
    });

    it('should throw InvalidStateError when reset called in closed state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      expectDOMException('InvalidStateError', () => decoder.reset());
    });

    it('should reject with InvalidStateError when flush called in unconfigured state', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      await expectDOMExceptionAsync('InvalidStateError', () => decoder.flush());
      decoder.close();
    });

    it('should reject with InvalidStateError when flush called in closed state', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      await expectDOMExceptionAsync('InvalidStateError', () => decoder.flush());
    });
  });

  describe('colorSpace', () => {
    it('should pass colorSpace from config to output VideoFrame', async () => {
      // Encode frame first (same pattern as above)
      const encodedChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push(
            new EncodedVideoChunk({
              type: chunk.type,
              timestamp: chunk.timestamp,
              data: data,
            }),
          );
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

      const frameData = new Uint8Array(320 * 240 * 4).fill(128);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });

      encoder.encode(frame, { keyFrame: true });
      await encoder.flush();
      frame.close();
      encoder.close();

      // Decode with colorSpace specified
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
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      });

      decoder.decode(encodedChunks[0]);
      await decoder.flush();

      assert.ok(outputFrames.length > 0);
      assert.strictEqual(outputFrames[0].colorSpace.primaries, 'bt709');
      assert.strictEqual(outputFrames[0].colorSpace.transfer, 'bt709');
      assert.strictEqual(outputFrames[0].colorSpace.matrix, 'bt709');
      assert.strictEqual(outputFrames[0].colorSpace.fullRange, false);

      for (const f of outputFrames) {
        f.close();
      }
      decoder.close();
    });
  });

  describe('W3C Compliance', () => {
    describe('VideoDecoderConfig properties', () => {
      it('should echo core config properties in isConfigSupported result', async () => {
        // Tests the properties that are currently echoed by the native implementation
        const config = {
          codec: 'avc1.42001e',
          codedWidth: 320,
          codedHeight: 240,
          hardwareAcceleration: 'prefer-hardware' as const,
          optimizeForLatency: true,
        };

        const result = await VideoDecoder.isConfigSupported(config);
        assert.strictEqual(result.supported, true);
        assert.strictEqual(result.config.codec, config.codec);
        assert.strictEqual(result.config.codedWidth, config.codedWidth);
        assert.strictEqual(result.config.codedHeight, config.codedHeight);
        assert.strictEqual(result.config.hardwareAcceleration, config.hardwareAcceleration);
        assert.strictEqual(result.config.optimizeForLatency, config.optimizeForLatency);
      });

      it('should echo codec string exactly', async () => {
        const codec = 'avc1.640028'; // H.264 High Profile
        const result = await VideoDecoder.isConfigSupported({ codec });
        assert.strictEqual(result.config.codec, codec);
      });

      it('should echo codedWidth and codedHeight', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          codedWidth: 1920,
          codedHeight: 1080,
        });
        assert.strictEqual(result.config.codedWidth, 1920);
        assert.strictEqual(result.config.codedHeight, 1080);
      });

      it('should echo displayAspectWidth and displayAspectHeight', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          codedWidth: 1920,
          codedHeight: 1080,
          displayAspectWidth: 16,
          displayAspectHeight: 9,
        });

        assert.strictEqual(result.supported, true);
        assert.strictEqual(result.config.displayAspectWidth, 16);
        assert.strictEqual(result.config.displayAspectHeight, 9);
      });

      it('should echo colorSpace configuration', async () => {
        const colorSpace = {
          primaries: 'bt709' as const,
          transfer: 'bt709' as const,
          matrix: 'bt709' as const,
          fullRange: false,
        };

        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          colorSpace,
        });

        assert.strictEqual(result.supported, true);
        assert.notStrictEqual(result.config.colorSpace, undefined);
        assert.strictEqual(result.config.colorSpace?.primaries, 'bt709');
        assert.strictEqual(result.config.colorSpace?.transfer, 'bt709');
        assert.strictEqual(result.config.colorSpace?.matrix, 'bt709');
        assert.strictEqual(result.config.colorSpace?.fullRange, false);
      });

      it('should echo optimizeForLatency boolean', async () => {
        const resultTrue = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          optimizeForLatency: true,
        });
        assert.strictEqual(resultTrue.config.optimizeForLatency, true);

        const resultFalse = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          optimizeForLatency: false,
        });
        assert.strictEqual(resultFalse.config.optimizeForLatency, false);
      });

      it('should echo hardwareAcceleration W3C enum values', async () => {
        const values: Array<'no-preference' | 'prefer-hardware' | 'prefer-software'> = [
          'no-preference',
          'prefer-hardware',
          'prefer-software',
        ];
        for (const hw of values) {
          const result = await VideoDecoder.isConfigSupported({
            codec: 'avc1.42001e',
            hardwareAcceleration: hw,
          });
          assert.strictEqual(result.config.hardwareAcceleration, hw);
        }
      });

      it('should reject invalid hardwareAcceleration values in configure', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        assert.throws(() => {
          decoder.configure({
            codec: 'avc1.42001e',
            hardwareAcceleration: 'invalid-value' as any,
          });
        }, TypeError);

        decoder.close();
      });

      it('should return supported=false for invalid hardwareAcceleration in isConfigSupported', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          hardwareAcceleration: 'allow' as any, // Old value, no longer valid
        });
        assert.strictEqual(result.supported, false);
      });

      it('should return supported=false for unsupported codecs', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'invalid-codec-string',
        });
        assert.strictEqual(result.supported, false);
      });
    });

    describe('VideoDecoder interface', () => {
      it('should have all required properties per W3C spec', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Required properties per W3C WebCodecs spec
        assert.ok('state' in decoder);
        assert.ok('decodeQueueSize' in decoder);

        // State should be a string
        assert.strictEqual(typeof decoder.state, 'string');

        // decodeQueueSize should be a number
        assert.strictEqual(typeof decoder.decodeQueueSize, 'number');

        decoder.close();
      });

      it('should have all required methods per W3C spec', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Required methods per W3C WebCodecs spec
        assert.strictEqual(typeof decoder.configure, 'function');
        assert.strictEqual(typeof decoder.decode, 'function');
        assert.strictEqual(typeof decoder.flush, 'function');
        assert.strictEqual(typeof decoder.reset, 'function');
        assert.strictEqual(typeof decoder.close, 'function');

        decoder.close();
      });

      it('should have static isConfigSupported method', () => {
        assert.strictEqual(typeof VideoDecoder.isConfigSupported, 'function');
      });

      it('should have ondequeue callback property', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // ondequeue should exist and be settable
        assert.strictEqual('ondequeue' in decoder, true);
        assert.strictEqual(decoder.ondequeue, null);

        const handler = () => {};
        decoder.ondequeue = handler;
        assert.strictEqual(decoder.ondequeue, handler);

        decoder.close();
      });

      it('should extend EventTarget for dequeue event', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Per W3C spec, VideoDecoder extends EventTarget
        assert.strictEqual(typeof decoder.addEventListener, 'function');
        assert.strictEqual(typeof decoder.removeEventListener, 'function');
        assert.strictEqual(typeof decoder.dispatchEvent, 'function');

        decoder.close();
      });

      it('should have codecSaturated property', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // codecSaturated is part of the codec interface
        assert.strictEqual('codecSaturated' in decoder, true);
        assert.strictEqual(typeof decoder.codecSaturated, 'boolean');

        decoder.close();
      });
    });

    describe('state machine', () => {
      it('should start in unconfigured state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        assert.strictEqual(decoder.state, 'unconfigured');
        decoder.close();
      });

      it('should transition to configured after configure()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        assert.strictEqual(decoder.state, 'configured');

        decoder.close();
      });

      it('should transition back to unconfigured after reset()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        assert.strictEqual(decoder.state, 'configured');

        decoder.reset();
        assert.strictEqual(decoder.state, 'unconfigured');

        decoder.close();
      });

      it('should transition to closed after close()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.close();
        assert.strictEqual(decoder.state, 'closed');
      });

      it('should transition from configured to closed', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        assert.strictEqual(decoder.state, 'configured');

        decoder.close();
        assert.strictEqual(decoder.state, 'closed');
      });

      it('should allow reconfigure after reset', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        decoder.reset();
        decoder.configure({ codec: 'vp9' });
        assert.strictEqual(decoder.state, 'configured');

        decoder.close();
      });

      it('should not allow any operations after close', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        assert.throws(() => decoder.configure({ codec: 'avc1.42001e' }));
        assert.throws(() => decoder.reset());
      });
    });

    describe('error handling per W3C spec', () => {
      it('should throw TypeError for missing output callback', () => {
        assert.throws(() => {
          new VideoDecoder({
            error: () => {},
          } as any);
        }, TypeError);
      });

      it('should throw TypeError for missing error callback', () => {
        assert.throws(() => {
          new VideoDecoder({
            output: () => {},
          } as any);
        }, TypeError);
      });

      it('should throw InvalidStateError when decode called in unconfigured state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        const chunk = new EncodedVideoChunk({
          type: 'key',
          timestamp: 0,
          data: new Uint8Array([0, 0, 0, 1]),
        });

        expectDOMException('InvalidStateError', () => decoder.decode(chunk));

        decoder.close();
      });

      it('should throw InvalidStateError when decode called in closed state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        const chunk = new EncodedVideoChunk({
          type: 'key',
          timestamp: 0,
          data: new Uint8Array([0, 0, 0, 1]),
        });

        expectDOMException('InvalidStateError', () => decoder.decode(chunk));
      });

      it('should throw InvalidStateError when configure called in closed state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        expectDOMException('InvalidStateError', () => decoder.configure({ codec: 'avc1.42001e' }));
      });

      it('should throw InvalidStateError when reset called in closed state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        expectDOMException('InvalidStateError', () => decoder.reset());
      });

      it('should reject flush with InvalidStateError in unconfigured state', async () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        await expectDOMExceptionAsync('InvalidStateError', () => decoder.flush());

        decoder.close();
      });

      it('should reject flush with InvalidStateError in closed state', async () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        await expectDOMExceptionAsync('InvalidStateError', () => decoder.flush());
      });

      it('should call error callback with DataError for non-keyframe first chunk', async () => {
        const errors: DOMException[] = [];
        const decoder = new VideoDecoder({
          output: () => {},
          error: (e) => errors.push(e),
        });

        decoder.configure({ codec: 'avc1.42001e' });

        // First chunk after configure must be a key frame
        const deltaChunk = new EncodedVideoChunk({
          type: 'delta', // Not a key frame!
          timestamp: 0,
          data: new Uint8Array([0, 0, 0, 1]),
        });

        decoder.decode(deltaChunk);

        // Give time for async error callback
        await new Promise((resolve) => setTimeout(resolve, 10));

        assert.ok(errors.length > 0);
        assert.strictEqual(errors[0].name, 'DataError');

        decoder.close();
      });
    });

    describe('decodeQueueSize tracking', () => {
      it('should start at 0', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        assert.strictEqual(decoder.decodeQueueSize, 0);
        decoder.close();
      });

      it('should reset to 0 after reset()', async () => {
        // First encode a frame to get valid H.264 data
        const encodedChunks: EncodedVideoChunk[] = [];
        const encoder = new VideoEncoder({
          output: (chunk) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            encodedChunks.push(
              new EncodedVideoChunk({
                type: chunk.type,
                timestamp: chunk.timestamp,
                duration: chunk.duration ?? undefined,
                data: data,
              }),
            );
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

        const frameData = new Uint8Array(320 * 240 * 4).fill(128);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 320,
          codedHeight: 240,
          timestamp: 0,
        });

        encoder.encode(frame, { keyFrame: true });
        await encoder.flush();
        frame.close();
        encoder.close();

        // Now test decoder
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        decoder.decode(encodedChunks[0]);

        // Reset should clear the queue
        decoder.reset();
        assert.strictEqual(decoder.decodeQueueSize, 0);

        decoder.close();
      });
    });
  });
});
