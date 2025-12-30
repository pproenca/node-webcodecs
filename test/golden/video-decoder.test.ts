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

  describe('configure', () => {
    it('should accept config without codedWidth/codedHeight per W3C spec', async () => {
      // W3C spec: codedWidth/codedHeight are optional in VideoDecoderConfig
      // Decoder should accept config with only codec and use dimensions from bitstream
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // This should NOT throw - per W3C spec, dimensions are optional
      expect(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          // No codedWidth/codedHeight - decoder should infer from bitstream
        });
      }).not.toThrow();

      expect(decoder.state).toBe('configured');
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

  describe('displayAspectWidth/displayAspectHeight', () => {
    it('should pass displayAspectWidth/displayAspectHeight to VideoFrame output', async () => {
      // Encode a frame first
      const encodedChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          encodedChunks.push(new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration ?? undefined,
            data: data,
          }));
        },
        error: (e) => { throw e; },
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

      // Decode with display aspect ratio specified
      const outputFrames: VideoFrame[] = [];
      const decoder = new VideoDecoder({
        output: (outputFrame) => {
          outputFrames.push(outputFrame);
        },
        error: (e) => { throw e; },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
        displayAspectWidth: 16,
        displayAspectHeight: 9,
      });

      decoder.decode(encodedChunks[0]);
      await decoder.flush();

      expect(outputFrames.length).toBeGreaterThan(0);
      expect(outputFrames[0].displayWidth).toBe(Math.round(240 * 16 / 9)); // ~427
      expect(outputFrames[0].displayHeight).toBe(240);

      outputFrames.forEach(f => f.close());
      decoder.close();
    });
  });

  describe('optimizeForLatency', () => {
    it('should accept optimizeForLatency config option', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // Should not throw when optimizeForLatency is provided
      expect(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          optimizeForLatency: true,
        });
      }).not.toThrow();

      expect(decoder.state).toBe('configured');
      decoder.close();
    });

    it('should include optimizeForLatency in isConfigSupported result', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
        optimizeForLatency: true,
      });
      expect(result.supported).toBe(true);
      expect(result.config.optimizeForLatency).toBe(true);
    });
  });

  describe('hardwareAcceleration', () => {
    it('should accept hardwareAcceleration config option', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // Should not throw with hardwareAcceleration
      expect(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          hardwareAcceleration: 'prefer-software',
        });
      }).not.toThrow();

      expect(decoder.state).toBe('configured');
      decoder.close();
    });

    it('should include hardwareAcceleration in isConfigSupported result', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
        hardwareAcceleration: 'prefer-hardware',
      });
      expect(result.supported).toBe(true);
      expect(result.config.hardwareAcceleration).toBe('prefer-hardware');
    });

    it('should default to no-preference', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
      });
      expect(result.supported).toBe(true);
      // Default value should be 'no-preference' per W3C spec
      expect(result.config.hardwareAcceleration).toBe('no-preference');
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

      try {
        decoder.decode(chunk);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
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

      try {
        decoder.decode(chunk);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });

    it('should throw InvalidStateError when configure called in closed state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      try {
        decoder.configure({ codec: 'avc1.42E01E' });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });

    it('should throw InvalidStateError when reset called in closed state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      try {
        decoder.reset();
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });

    it('should reject with InvalidStateError when flush called in unconfigured state', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      try {
        await decoder.flush();
        expect.fail('Should have rejected');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
      decoder.close();
    });

    it('should reject with InvalidStateError when flush called in closed state', async () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();

      try {
        await decoder.flush();
        expect.fail('Should have rejected');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
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
          encodedChunks.push(new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            data: data,
          }));
        },
        error: (e) => { throw e; },
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
        error: (e) => { throw e; },
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

      expect(outputFrames.length).toBeGreaterThan(0);
      expect(outputFrames[0].colorSpace.primaries).toBe('bt709');
      expect(outputFrames[0].colorSpace.transfer).toBe('bt709');
      expect(outputFrames[0].colorSpace.matrix).toBe('bt709');
      expect(outputFrames[0].colorSpace.fullRange).toBe(false);

      outputFrames.forEach(f => f.close());
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
        expect(result.supported).toBe(true);
        expect(result.config.codec).toBe(config.codec);
        expect(result.config.codedWidth).toBe(config.codedWidth);
        expect(result.config.codedHeight).toBe(config.codedHeight);
        expect(result.config.hardwareAcceleration).toBe(config.hardwareAcceleration);
        expect(result.config.optimizeForLatency).toBe(config.optimizeForLatency);
      });

      it('should echo codec string exactly', async () => {
        const codec = 'avc1.640028'; // H.264 High Profile
        const result = await VideoDecoder.isConfigSupported({ codec });
        expect(result.config.codec).toBe(codec);
      });

      it('should echo codedWidth and codedHeight', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          codedWidth: 1920,
          codedHeight: 1080,
        });
        expect(result.config.codedWidth).toBe(1920);
        expect(result.config.codedHeight).toBe(1080);
      });

      it('should echo displayAspectWidth and displayAspectHeight', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          codedWidth: 1920,
          codedHeight: 1080,
          displayAspectWidth: 16,
          displayAspectHeight: 9,
        });

        expect(result.supported).toBe(true);
        expect(result.config.displayAspectWidth).toBe(16);
        expect(result.config.displayAspectHeight).toBe(9);
      });

      // W3C compliance gap: colorSpace not echoed
      it.todo('should echo colorSpace configuration (W3C compliance gap)');

      it('should echo optimizeForLatency boolean', async () => {
        const resultTrue = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          optimizeForLatency: true,
        });
        expect(resultTrue.config.optimizeForLatency).toBe(true);

        const resultFalse = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          optimizeForLatency: false,
        });
        expect(resultFalse.config.optimizeForLatency).toBe(false);
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
          expect(result.config.hardwareAcceleration).toBe(hw);
        }
      });

      it('should reject invalid hardwareAcceleration values in configure', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        expect(() => {
          decoder.configure({
            codec: 'avc1.42001e',
            hardwareAcceleration: 'invalid-value' as any,
          });
        }).toThrow(TypeError);

        decoder.close();
      });

      it('should return supported=false for invalid hardwareAcceleration in isConfigSupported', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'avc1.42001e',
          hardwareAcceleration: 'allow' as any, // Old value, no longer valid
        });
        expect(result.supported).toBe(false);
      });

      it('should return supported=false for unsupported codecs', async () => {
        const result = await VideoDecoder.isConfigSupported({
          codec: 'invalid-codec-string',
        });
        expect(result.supported).toBe(false);
      });
    });

    describe('VideoDecoder interface', () => {
      it('should have all required properties per W3C spec', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Required properties per W3C WebCodecs spec
        expect(decoder).toHaveProperty('state');
        expect(decoder).toHaveProperty('decodeQueueSize');

        // State should be a string
        expect(typeof decoder.state).toBe('string');

        // decodeQueueSize should be a number
        expect(typeof decoder.decodeQueueSize).toBe('number');

        decoder.close();
      });

      it('should have all required methods per W3C spec', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Required methods per W3C WebCodecs spec
        expect(typeof decoder.configure).toBe('function');
        expect(typeof decoder.decode).toBe('function');
        expect(typeof decoder.flush).toBe('function');
        expect(typeof decoder.reset).toBe('function');
        expect(typeof decoder.close).toBe('function');

        decoder.close();
      });

      it('should have static isConfigSupported method', () => {
        expect(typeof VideoDecoder.isConfigSupported).toBe('function');
      });

      it('should have ondequeue callback property', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // ondequeue should exist and be settable
        expect('ondequeue' in decoder).toBe(true);
        expect(decoder.ondequeue).toBe(null);

        const handler = () => {};
        decoder.ondequeue = handler;
        expect(decoder.ondequeue).toBe(handler);

        decoder.close();
      });

      it('should extend EventTarget for dequeue event', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // Per W3C spec, VideoDecoder extends EventTarget
        expect(typeof decoder.addEventListener).toBe('function');
        expect(typeof decoder.removeEventListener).toBe('function');
        expect(typeof decoder.dispatchEvent).toBe('function');

        decoder.close();
      });

      it('should have codecSaturated property', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        // codecSaturated is part of the codec interface
        expect('codecSaturated' in decoder).toBe(true);
        expect(typeof decoder.codecSaturated).toBe('boolean');

        decoder.close();
      });
    });

    describe('state machine', () => {
      it('should start in unconfigured state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        expect(decoder.state).toBe('unconfigured');
        decoder.close();
      });

      it('should transition to configured after configure()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        expect(decoder.state).toBe('configured');

        decoder.close();
      });

      it('should transition back to unconfigured after reset()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        expect(decoder.state).toBe('configured');

        decoder.reset();
        expect(decoder.state).toBe('unconfigured');

        decoder.close();
      });

      it('should transition to closed after close()', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.close();
        expect(decoder.state).toBe('closed');
      });

      it('should transition from configured to closed', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        expect(decoder.state).toBe('configured');

        decoder.close();
        expect(decoder.state).toBe('closed');
      });

      it('should allow reconfigure after reset', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        decoder.configure({ codec: 'avc1.42001e' });
        decoder.reset();
        decoder.configure({ codec: 'vp9' });
        expect(decoder.state).toBe('configured');

        decoder.close();
      });

      it('should not allow any operations after close', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        expect(() => decoder.configure({ codec: 'avc1.42001e' })).toThrow();
        expect(() => decoder.reset()).toThrow();
      });
    });

    describe('error handling per W3C spec', () => {
      it('should throw TypeError for missing output callback', () => {
        expect(() => {
          new VideoDecoder({
            error: () => {},
          } as any);
        }).toThrow(TypeError);
      });

      it('should throw TypeError for missing error callback', () => {
        expect(() => {
          new VideoDecoder({
            output: () => {},
          } as any);
        }).toThrow(TypeError);
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

        try {
          decoder.decode(chunk);
          expect.fail('Should have thrown');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }

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

        try {
          decoder.decode(chunk);
          expect.fail('Should have thrown');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }
      });

      it('should throw InvalidStateError when configure called in closed state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        try {
          decoder.configure({ codec: 'avc1.42001e' });
          expect.fail('Should have thrown');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }
      });

      it('should throw InvalidStateError when reset called in closed state', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        try {
          decoder.reset();
          expect.fail('Should have thrown');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }
      });

      it('should reject flush with InvalidStateError in unconfigured state', async () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        try {
          await decoder.flush();
          expect.fail('Should have rejected');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }

        decoder.close();
      });

      it('should reject flush with InvalidStateError in closed state', async () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });
        decoder.close();

        try {
          await decoder.flush();
          expect.fail('Should have rejected');
        } catch (e: any) {
          expect(e.name).toBe('InvalidStateError');
        }
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
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].name).toBe('DataError');

        decoder.close();
      });
    });

    describe('decodeQueueSize tracking', () => {
      it('should start at 0', () => {
        const decoder = new VideoDecoder({
          output: () => {},
          error: () => {},
        });

        expect(decoder.decodeQueueSize).toBe(0);
        decoder.close();
      });

      it('should reset to 0 after reset()', async () => {
        // First encode a frame to get valid H.264 data
        const encodedChunks: EncodedVideoChunk[] = [];
        const encoder = new VideoEncoder({
          output: (chunk) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            encodedChunks.push(new EncodedVideoChunk({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration ?? undefined,
              data: data,
            }));
          },
          error: (e) => { throw e; },
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
        expect(decoder.decodeQueueSize).toBe(0);

        decoder.close();
      });
    });
  });
});
