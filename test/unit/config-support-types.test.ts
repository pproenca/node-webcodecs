// test/unit/config-support-types.test.ts
// Tests for W3C WebCodecs spec sections 7.3.1-7.3.4 - Configuration Support Types

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AudioDecoder,
  type AudioDecoderSupport,
  AudioEncoder,
  type AudioEncoderSupport,
  VideoDecoder,
  type VideoDecoderSupport,
  VideoEncoder,
  type VideoEncoderSupport,
} from '../../lib';

/**
 * Tests for Configuration Support types per W3C WebCodecs spec sections 7.3.1-7.3.4.
 * Verifies that all *Support types have correct structure.
 */

describe('Configuration Support Types: 7.3', () => {
  describe('AudioDecoderSupport: 7.3.1', () => {
    // Spec 7.3.1: AudioDecoderSupport has supported and config fields
    it('should have supported boolean field', async () => {
      const result: AudioDecoderSupport = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should have config field of type AudioDecoderConfig', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result: AudioDecoderSupport = await AudioDecoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config field');
      assert.strictEqual(typeof result.config.codec, 'string');
      assert.strictEqual(typeof result.config.sampleRate, 'number');
      assert.strictEqual(typeof result.config.numberOfChannels, 'number');
    });

    it('should have config present even when supported is false', async () => {
      const result: AudioDecoderSupport = await AudioDecoder.isConfigSupported({
        codec: 'invalid-codec',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, false);
      assert.ok(result.config, 'Config should be present even when unsupported');
    });
  });

  describe('VideoDecoderSupport: 7.3.2', () => {
    // Spec 7.3.2: VideoDecoderSupport has supported and config fields
    it('should have supported boolean field', async () => {
      const result: VideoDecoderSupport = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      });

      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should have config field of type VideoDecoderConfig', async () => {
      const config = {
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      };

      const result: VideoDecoderSupport = await VideoDecoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config field');
      assert.strictEqual(typeof result.config.codec, 'string');
    });

    it('should have config present even when supported is false', async () => {
      const result: VideoDecoderSupport = await VideoDecoder.isConfigSupported({
        codec: 'invalid-codec',
        codedWidth: 640,
        codedHeight: 480,
      });

      assert.strictEqual(result.supported, false);
      assert.ok(result.config, 'Config should be present even when unsupported');
    });
  });

  describe('AudioEncoderSupport: 7.3.3', () => {
    // Spec 7.3.3: AudioEncoderSupport has supported and config fields
    it('should have supported boolean field', async () => {
      const result: AudioEncoderSupport = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should have config field of type AudioEncoderConfig', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result: AudioEncoderSupport = await AudioEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config field');
      assert.strictEqual(typeof result.config.codec, 'string');
      assert.strictEqual(typeof result.config.sampleRate, 'number');
      assert.strictEqual(typeof result.config.numberOfChannels, 'number');
    });

    it('should have config present even when supported is false', async () => {
      const result: AudioEncoderSupport = await AudioEncoder.isConfigSupported({
        codec: 'invalid-codec',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, false);
      assert.ok(result.config, 'Config should be present even when unsupported');
    });
  });

  describe('VideoEncoderSupport: 7.3.4', () => {
    // Spec 7.3.4: VideoEncoderSupport has supported and config fields
    it('should have supported boolean field', async () => {
      const result: VideoEncoderSupport = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      });

      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should have config field of type VideoEncoderConfig', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };

      const result: VideoEncoderSupport = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config field');
      assert.strictEqual(typeof result.config.codec, 'string');
      assert.strictEqual(typeof result.config.width, 'number');
      assert.strictEqual(typeof result.config.height, 'number');
    });

    it('should have config present even when supported is false', async () => {
      const result: VideoEncoderSupport = await VideoEncoder.isConfigSupported({
        codec: 'invalid-codec',
        width: 640,
        height: 480,
      });

      assert.strictEqual(result.supported, false);
      assert.ok(result.config, 'Config should be present even when unsupported');
    });
  });

  describe('Type exports', () => {
    // Verify types are exported and can be used
    it('should export AudioDecoderSupport type', () => {
      // This compiles if type is exported correctly
      const support: AudioDecoderSupport = { supported: true, config: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 } };
      assert.ok(support);
    });

    it('should export VideoDecoderSupport type', () => {
      const support: VideoDecoderSupport = { supported: true, config: { codec: 'avc1.42001E' } };
      assert.ok(support);
    });

    it('should export AudioEncoderSupport type', () => {
      const support: AudioEncoderSupport = { supported: true, config: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 } };
      assert.ok(support);
    });

    it('should export VideoEncoderSupport type', () => {
      const support: VideoEncoderSupport = { supported: true, config: { codec: 'avc1.42001E', width: 640, height: 480 } };
      assert.ok(support);
    });
  });

  describe('Config field is cloned', () => {
    // Per spec 7.2: config in result should be cloned
    it('should have cloned config (AudioDecoder)', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioDecoder.isConfigSupported(config);
      assert.notStrictEqual(result.config, config, 'Config should be cloned');
    });

    it('should have cloned config (VideoDecoder)', async () => {
      const config = {
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      };

      const result = await VideoDecoder.isConfigSupported(config);
      assert.notStrictEqual(result.config, config, 'Config should be cloned');
    });

    it('should have cloned config (AudioEncoder)', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioEncoder.isConfigSupported(config);
      assert.notStrictEqual(result.config, config, 'Config should be cloned');
    });

    it('should have cloned config (VideoEncoder)', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      };

      const result = await VideoEncoder.isConfigSupported(config);
      assert.notStrictEqual(result.config, config, 'Config should be cloned');
    });
  });
});
