// test/unit/codec-string.test.ts
// Tests for W3C WebCodecs spec section 7.4 - Codec String validation

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioDecoder, AudioEncoder, VideoDecoder, VideoEncoder } from '../../lib';

/**
 * Tests for Codec String validation per W3C WebCodecs spec section 7.4.
 * Verifies that codec strings are correctly parsed and validated.
 */

describe('Codec String: 7.4', () => {
  describe('Video codec strings', () => {
    describe('H.264/AVC (avc1.*)', () => {
      // Spec 7.4: avc1.PPCCLL format
      it('should accept avc1.42001E (Baseline Level 3.0)', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'avc1.42001E',
          width: 640,
          height: 480,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept avc1.4D001E (Main Level 3.0)', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'avc1.4D001E',
          width: 640,
          height: 480,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept avc1.64001E (High Level 3.0)', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'avc1.64001E',
          width: 640,
          height: 480,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept avc1.42001F (Baseline Level 3.1)', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'avc1.42001F',
          width: 1280,
          height: 720,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept lowercase avc1.42001e', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'avc1.42001e',
          width: 640,
          height: 480,
        });
        assert.strictEqual(result.supported, true);
      });
    });

    describe('H.265/HEVC (hvc1.*, hev1.*)', () => {
      // Note: HEVC support may vary by platform
      it('should handle hvc1 codec string', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'hvc1.1.6.L93.B0',
          width: 640,
          height: 480,
        });
        // Result depends on platform HEVC support
        assert.strictEqual(typeof result.supported, 'boolean');
      });

      it('should handle hev1 codec string', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'hev1.1.6.L93.B0',
          width: 640,
          height: 480,
        });
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });

    describe('VP9 (vp09.*)', () => {
      // Spec 7.4: vp09.PP.LL.DD format
      it('should accept vp09.00.10.08', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'vp09.00.10.08',
          width: 640,
          height: 480,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept vp09.02.10.10', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'vp09.02.10.10',
          width: 640,
          height: 480,
        });
        // Profile 2 support may vary
        assert.strictEqual(typeof result.supported, 'boolean');
      });

      it('should accept simple vp9 string', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'vp9',
          width: 640,
          height: 480,
        });
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });

    describe('AV1 (av01.*)', () => {
      // Spec 7.4: av01.P.LLT.DD format
      it('should handle av01.0.04M.08', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'av01.0.04M.08',
          width: 640,
          height: 480,
        });
        // AV1 support may vary
        assert.strictEqual(typeof result.supported, 'boolean');
      });

      it('should handle simple av1 string', async () => {
        const result = await VideoEncoder.isConfigSupported({
          codec: 'av1',
          width: 640,
          height: 480,
        });
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });
  });

  describe('Audio codec strings', () => {
    describe('AAC (mp4a.*)', () => {
      // Spec 7.4: mp4a.40.XX format
      it('should accept mp4a.40.2 (AAC-LC)', async () => {
        const result = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        assert.strictEqual(result.supported, true);
      });

      it('should accept mp4a.40.5 (HE-AAC)', async () => {
        const result = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.5',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        // HE-AAC support may vary
        assert.strictEqual(typeof result.supported, 'boolean');
      });

      it('should accept simple aac string', async () => {
        const result = await AudioEncoder.isConfigSupported({
          codec: 'aac',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });

    describe('Opus', () => {
      it('should accept opus', async () => {
        const result = await AudioEncoder.isConfigSupported({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        assert.strictEqual(result.supported, true);
      });
    });

    describe('MP3', () => {
      it('should accept mp3', async () => {
        const result = await AudioDecoder.isConfigSupported({
          codec: 'mp3',
          sampleRate: 44100,
          numberOfChannels: 2,
        });
        assert.strictEqual(result.supported, true);
      });
    });

    describe('FLAC', () => {
      it('should handle flac', async () => {
        const result = await AudioDecoder.isConfigSupported({
          codec: 'flac',
          sampleRate: 44100,
          numberOfChannels: 2,
        });
        // FLAC support may vary
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });

    describe('Vorbis', () => {
      it('should handle vorbis', async () => {
        const result = await AudioDecoder.isConfigSupported({
          codec: 'vorbis',
          sampleRate: 44100,
          numberOfChannels: 2,
        });
        // Vorbis support may vary
        assert.strictEqual(typeof result.supported, 'boolean');
      });
    });
  });

  describe('Invalid codec strings', () => {
    // Spec 7.4: Invalid codec strings should return supported: false
    it('should reject empty string', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: '',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should reject "invalid" codec', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'invalid',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should reject numeric only codec', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: '12345',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should reject unknown-codec-name', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'unknown-codec-name',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });

    it('should reject completely random string', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'xyzabc123',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, false);
    });
  });

  describe('Decoder codec strings', () => {
    // Test that decoders also handle codec strings correctly
    it('should accept avc1.42001E for VideoDecoder', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should accept mp4a.40.2 for AudioDecoder', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });

    it('should accept opus for AudioDecoder', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
    });
  });

  describe('Edge cases', () => {
    // Spec 7.4: Edge cases in codec string handling
    it('should handle avc1 without full profile/level', async () => {
      // Some implementations may accept short form
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1',
        width: 640,
        height: 480,
      });
      // Behavior is implementation-specific
      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should handle h264 alias', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'h264',
        width: 640,
        height: 480,
      });
      // h264 is often accepted as alias for avc1
      assert.strictEqual(typeof result.supported, 'boolean');
    });

    it('should handle whitespace-only codec string', async () => {
      const result = await VideoEncoder.isConfigSupported({
        codec: '   ',
        width: 640,
        height: 480,
      });
      assert.strictEqual(result.supported, false);
    });
  });
});
