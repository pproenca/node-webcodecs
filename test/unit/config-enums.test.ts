// test/unit/config-enums.test.ts
// Tests for W3C WebCodecs spec sections 7.9-7.16 - Configuration Enums and Options

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type AlphaOption,
  type CodecState,
  type HardwareAcceleration,
  type LatencyMode,
  VideoEncoder,
  type VideoEncoderBitrateMode,
  type VideoEncoderEncodeOptions,
  VideoFrame,
  type WebCodecsErrorCallback,
} from '../../lib';

/**
 * Tests for Configuration Enums and Options per W3C WebCodecs spec sections 7.9-7.16.
 * Verifies that all enum types and options have correct values.
 */

describe('Configuration Enums and Options: 7.9-7.16', () => {
  describe('HardwareAcceleration: 7.9', () => {
    // Spec 7.9: Three values: no-preference, prefer-hardware, prefer-software
    it('should accept "no-preference" value', () => {
      const value: HardwareAcceleration = 'no-preference';
      assert.strictEqual(value, 'no-preference');
    });

    it('should accept "prefer-hardware" value', () => {
      const value: HardwareAcceleration = 'prefer-hardware';
      assert.strictEqual(value, 'prefer-hardware');
    });

    it('should accept "prefer-software" value', () => {
      const value: HardwareAcceleration = 'prefer-software';
      assert.strictEqual(value, 'prefer-software');
    });

    it('should work in VideoEncoder config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        hardwareAcceleration: 'prefer-software',
      });
      assert.strictEqual(typeof result.supported, 'boolean');
    });
  });

  describe('AlphaOption: 7.10', () => {
    // Spec 7.10: Two values: discard, keep
    it('should accept "discard" value', () => {
      const value: AlphaOption = 'discard';
      assert.strictEqual(value, 'discard');
    });

    it('should accept "keep" value', () => {
      const value: AlphaOption = 'keep';
      assert.strictEqual(value, 'keep');
    });

    it('should work in VideoEncoder config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        width: 640,
        height: 480,
        alpha: 'keep',
      });
      assert.strictEqual(typeof result.supported, 'boolean');
    });
  });

  describe('LatencyMode: 7.11', () => {
    // Spec 7.11: Two values: quality, realtime
    it('should accept "quality" value', () => {
      const value: LatencyMode = 'quality';
      assert.strictEqual(value, 'quality');
    });

    it('should accept "realtime" value', () => {
      const value: LatencyMode = 'realtime';
      assert.strictEqual(value, 'realtime');
    });

    it('should work in VideoEncoder config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        latencyMode: 'realtime',
      });
      assert.strictEqual(typeof result.supported, 'boolean');
    });
  });

  describe('VideoEncoderEncodeOptions: 7.13', () => {
    const h264Config = {
      codec: 'avc1.42001E',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
      framerate: 30,
    };

    function createVideoFrame(timestamp = 0): VideoFrame {
      const buf = Buffer.alloc(640 * 480 * 4);
      return new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp,
        format: 'RGBA',
      });
    }

    // Spec 7.13: keyFrame defaults to false
    it('should have optional keyFrame field', () => {
      const options: VideoEncoderEncodeOptions = {};
      assert.strictEqual(options.keyFrame, undefined);
    });

    it('should accept keyFrame: true', () => {
      const options: VideoEncoderEncodeOptions = { keyFrame: true };
      assert.strictEqual(options.keyFrame, true);
    });

    it('should accept keyFrame: false', () => {
      const options: VideoEncoderEncodeOptions = { keyFrame: false };
      assert.strictEqual(options.keyFrame, false);
    });

    it('should produce key frame when keyFrame: true', async () => {
      let keyFrameProduced = false;

      const encoder = new VideoEncoder({
        output: (chunk) => {
          if (chunk.type === 'key') {
            keyFrameProduced = true;
          }
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(keyFrameProduced, 'Should produce key frame');

      encoder.close();
    });

    it('should work with empty options object', async () => {
      let outputCount = 0;

      const encoder = new VideoEncoder({
        output: () => {
          outputCount++;
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, {}); // Empty options
      frame.close();

      await encoder.flush();

      assert.ok(outputCount > 0, 'Should produce output');

      encoder.close();
    });
  });

  describe('VideoEncoderBitrateMode: 7.14', () => {
    // Spec 7.14: Three values: constant, variable, quantizer
    it('should accept "constant" value', () => {
      const value: VideoEncoderBitrateMode = 'constant';
      assert.strictEqual(value, 'constant');
    });

    it('should accept "variable" value', () => {
      const value: VideoEncoderBitrateMode = 'variable';
      assert.strictEqual(value, 'variable');
    });

    it('should accept "quantizer" value', () => {
      const value: VideoEncoderBitrateMode = 'quantizer';
      assert.strictEqual(value, 'quantizer');
    });

    it('should work in VideoEncoder config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrateMode: 'constant',
      });
      assert.strictEqual(typeof result.supported, 'boolean');
    });
  });

  describe('CodecState: 7.15', () => {
    // Spec 7.15: Three values: unconfigured, configured, closed
    it('should accept "unconfigured" value', () => {
      const value: CodecState = 'unconfigured';
      assert.strictEqual(value, 'unconfigured');
    });

    it('should accept "configured" value', () => {
      const value: CodecState = 'configured';
      assert.strictEqual(value, 'configured');
    });

    it('should accept "closed" value', () => {
      const value: CodecState = 'closed';
      assert.strictEqual(value, 'closed');
    });

    it('should start in unconfigured state', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should transition to configured after configure()', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      });

      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });

    it('should transition to closed after close()', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      assert.strictEqual(encoder.state, 'closed');
    });
  });

  describe('WebCodecsErrorCallback: 7.16', () => {
    // Spec 7.16: callback receives DOMException
    it('should be a function type', () => {
      const callback: WebCodecsErrorCallback = (_error) => {};
      assert.strictEqual(typeof callback, 'function');
    });

    it('should accept Error parameter', () => {
      let receivedError: Error | DOMException | undefined;
      const callback: WebCodecsErrorCallback = (error) => {
        receivedError = error;
      };

      const testError = new Error('test');
      callback(testError);

      assert.strictEqual(receivedError, testError);
    });

    it('should work in VideoEncoder init', () => {
      let errorCallbackCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (_error) => {
          errorCallbackCalled = true;
        },
      });

      // Error callback is set up but not triggered in normal use
      assert.strictEqual(errorCallbackCalled, false);

      encoder.close();
    });
  });

  describe('Type exports', () => {
    it('should export HardwareAcceleration type', () => {
      const value: HardwareAcceleration = 'no-preference';
      assert.ok(value);
    });

    it('should export AlphaOption type', () => {
      const value: AlphaOption = 'discard';
      assert.ok(value);
    });

    it('should export LatencyMode type', () => {
      const value: LatencyMode = 'quality';
      assert.ok(value);
    });

    it('should export VideoEncoderEncodeOptions type', () => {
      const options: VideoEncoderEncodeOptions = { keyFrame: true };
      assert.ok(options);
    });

    it('should export VideoEncoderBitrateMode type', () => {
      const value: VideoEncoderBitrateMode = 'variable';
      assert.ok(value);
    });

    it('should export CodecState type', () => {
      const value: CodecState = 'unconfigured';
      assert.ok(value);
    });

    it('should export WebCodecsErrorCallback type', () => {
      const callback: WebCodecsErrorCallback = () => {};
      assert.ok(callback);
    });
  });
});
