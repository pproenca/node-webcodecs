// test/unit/check-config-support.test.ts
// Tests for W3C WebCodecs spec section 7.1 - Check Configuration Support

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, VideoDecoder, VideoEncoder } from '../../lib';

/**
 * Tests for Check Configuration Support algorithm per W3C WebCodecs spec section 7.1.
 * Verifies isConfigSupported() for all codec classes.
 */

describe('Check Configuration Support: 7.1', () => {
  describe('AudioDecoder.isConfigSupported()', () => {
    // Spec 7.1 step 4: Valid config returns supported: true
    it('should return supported: true for AAC (mp4a.40.2)', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: true for Opus', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: true for MP3', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp3',
        sampleRate: 44100,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    // Spec 7.1 step 1: Invalid codec returns supported: false
    it('should return supported: false for invalid codec', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'invalid-codec',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, false);
    });

    // Spec 7.1: Result includes cloned config
    it('should return config in result', async () => {
      const config = {
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      };
      const result = await AudioDecoder.isConfigSupported(config);
      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.sampleRate, config.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, config.numberOfChannels);
    });

    // Spec: Config is cloned, not reference
    it('should return cloned config (not reference)', async () => {
      const config = {
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      };
      const result = await AudioDecoder.isConfigSupported(config);
      // Result config should be a different object
      assert.notStrictEqual(result.config, config, 'Should be different object');
    });
  });

  describe('VideoDecoder.isConfigSupported()', () => {
    // Spec 7.1 step 4: Valid config returns supported: true
    it('should return supported: true for H.264', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: true for VP9', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        codedWidth: 640,
        codedHeight: 480,
      });
      assert.strictEqual(result.supported, true);
    });

    // Spec 7.1 step 1: Invalid codec returns supported: false
    it('should return supported: false for invalid codec', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'invalid-codec',
        codedWidth: 640,
        codedHeight: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    // Spec 7.1: Result includes cloned config
    it('should return config in result', async () => {
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
  });

  describe('AudioEncoder.isConfigSupported()', () => {
    // Spec 7.1 step 4: Valid config returns supported: true
    it('should return supported: true for Opus', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: true for AAC', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    // Spec 7.1 step 1: Invalid codec returns supported: false
    it('should return supported: false for invalid codec', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'invalid-codec',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, false);
    });

    // Spec 7.1: Result includes cloned config
    it('should return config in result', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };
      const result = await AudioEncoder.isConfigSupported(config);
      assert.ok(result.config, 'Should have config in result');
      assert.strictEqual(result.config.codec, config.codec);
    });
  });

  describe('VideoEncoder.isConfigSupported()', () => {
    // Spec 7.1 step 4: Valid config returns supported: true
    it('should return supported: true for H.264', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should return supported: true for VP9', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });
      assert.strictEqual(result.supported, true);
    });

    // Spec 7.1 step 1: Invalid codec returns supported: false
    it('should return supported: false for invalid codec', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'invalid-codec',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    // Spec 7.1: Result includes cloned config
    it('should return config in result', async () => {
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
    });

    it('should return cloned config (not reference)', async () => {
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };
      const result = await VideoEncoder.isConfigSupported(config);
      assert.notStrictEqual(result.config, config, 'Should be different object');
    });
  });

  describe('Edge cases', () => {
    // Config with unknown optional fields should be ignored
    it('should handle config with extra fields', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        // @ts-expect-error Testing unknown field
        unknownField: 'should be ignored',
      });
      // Should still work (extra field ignored)
      assert.ok(result.supported !== undefined, 'Should return result');
    });

    // Platform limits
    it('should handle high resolution config', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 3840,
        height: 2160,
        bitrate: 10_000_000,
        framerate: 30,
      });
      // 4K should be supported on most platforms
      assert.ok(result.supported !== undefined, 'Should return result');
    });
  });

  describe('Async behavior', () => {
    // Spec: Check runs on parallel queue
    it('should return Promise', async () => {
      const promise = VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
      });
      assert.ok(promise instanceof Promise, 'Should return Promise');
      await promise; // Wait for completion
    });

    // Multiple concurrent checks should work
    it('should handle multiple concurrent checks', async () => {
      const [result1, result2, result3] = await Promise.all([
        AudioDecoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: 48000,
          numberOfChannels: 2,
        }),
        VideoDecoder.isConfigSupported({
          codec: 'avc1.42001E',
          codedWidth: 640,
          codedHeight: 480,
        }),
        VideoEncoder.isConfigSupported({
          codec: 'avc1.42001E',
          width: 640,
          height: 480,
        }),
      ]);

      assert.ok(result1.supported !== undefined);
      assert.ok(result2.supported !== undefined);
      assert.ok(result3.supported !== undefined);
    });
  });
});
