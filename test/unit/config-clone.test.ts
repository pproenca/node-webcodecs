// test/unit/config-clone.test.ts
// Tests for W3C WebCodecs spec section 7.2 - Clone Configuration Algorithm

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, VideoDecoder, VideoEncoder } from '../../lib';

/**
 * Tests for Clone Configuration algorithm per W3C WebCodecs spec section 7.2.
 * Verifies that isConfigSupported returns properly cloned configs.
 */

describe('Clone Configuration: 7.2', () => {
  describe('VideoEncoder config cloning', () => {
    // Spec 7.2 step 3.3: Primitive fields copied
    it('should clone primitive fields correctly', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.width, config.width);
      assert.strictEqual(result.config.height, config.height);
      assert.strictEqual(result.config.bitrate, config.bitrate);
      assert.strictEqual(result.config.framerate, config.framerate);
    });

    // Spec 7.2: Clone is independent from original
    it('should return clone (not reference to original)', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.notStrictEqual(result.config, config, 'Clone should be different object');
    });

    // Modifying clone doesn't affect original
    it('should allow modifying clone without affecting original', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      };

      const originalCodec = config.codec;
      const result = await VideoEncoder.isConfigSupported(config);

      // Modify the returned config
      if (result.config) {
        result.config.codec = 'modified';
      }

      // Original should be unchanged
      assert.strictEqual(config.codec, originalCodec);
    });

    // Modifying original after call doesn't affect result
    it('should be isolated from original modifications', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      // Modify original after result
      config.codec = 'modified';

      // Result should have original value
      assert.strictEqual(result.config?.codec, 'avc1.42001E');
    });

    // Optional fields preserved if present
    it('should preserve optional fields if present', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
        latencyMode: 'realtime' as const,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.latencyMode, 'realtime');
    });
  });

  describe('VideoDecoder config cloning', () => {
    it('should clone primitive fields correctly', async () => {
      const config = {
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      };

      const result = await VideoDecoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.codedWidth, config.codedWidth);
      assert.strictEqual(result.config.codedHeight, config.codedHeight);
    });

    it('should return clone (not reference)', async () => {
      const config = {
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      };

      const result = await VideoDecoder.isConfigSupported(config);

      assert.notStrictEqual(result.config, config, 'Clone should be different object');
    });
  });

  describe('AudioEncoder config cloning', () => {
    it('should clone primitive fields correctly', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.sampleRate, config.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, config.numberOfChannels);
    });

    it('should return clone (not reference)', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioEncoder.isConfigSupported(config);

      assert.notStrictEqual(result.config, config, 'Clone should be different object');
    });
  });

  describe('AudioDecoder config cloning', () => {
    it('should clone primitive fields correctly', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioDecoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.sampleRate, config.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, config.numberOfChannels);
    });

    it('should return clone (not reference)', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };

      const result = await AudioDecoder.isConfigSupported(config);

      assert.notStrictEqual(result.config, config, 'Clone should be different object');
    });
  });

  describe('Edge cases', () => {
    // Config with no optional fields
    it('should clone config with only required fields', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.width, config.width);
      assert.strictEqual(result.config.height, config.height);
    });

    // Unrecognized fields not included
    it('should not include unrecognized fields in clone', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        // @ts-expect-error Testing unrecognized field
        unknownField: 'should not be cloned',
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      // Unknown field should not be in result
      assert.strictEqual((result.config as unknown as Record<string, unknown>).unknownField, undefined);
    });

    // Config with display dimensions
    it('should clone optional displayWidth and displayHeight', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        displayWidth: 1280,
        displayHeight: 720,
      };

      const result = await VideoEncoder.isConfigSupported(config);

      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.displayWidth, config.displayWidth);
      assert.strictEqual(result.config.displayHeight, config.displayHeight);
    });
  });

  describe('Deep copy verification', () => {
    // Note: Description field is ArrayBuffer which should be deep copied
    // Testing with isConfigSupported which uses the clone algorithm internally
    it('should independently copy all recognized fields', async () => {
      const config1 = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
      };

      const config2 = {
        codec: 'avc1.42001E',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
      };

      const [result1, result2] = await Promise.all([
        VideoEncoder.isConfigSupported(config1),
        VideoEncoder.isConfigSupported(config2),
      ]);

      assert.ok(result1.config, 'Should have config1 in result');
      assert.ok(result2.config, 'Should have config2 in result');
      assert.strictEqual(result1.config.width, 640);
      assert.strictEqual(result2.config.width, 1280);
      assert.strictEqual(result1.config.height, 480);
      assert.strictEqual(result2.config.height, 720);
    });
  });
});
