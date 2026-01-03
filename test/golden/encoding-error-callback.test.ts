/**
 * EncodingError Callback Tests per W3C WebCodecs spec
 *
 * EncodingErrors are delivered via error callback when FFmpeg fails to
 * decode corrupted or malformed bitstreams.
 *
 * KEY POINT: EncodingError is async - delivered via callback, not thrown.
 *
 * This mirrors the contract tests in test/contracts/error_handling/encoding_errors.js
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('EncodingError callback per W3C spec', () => {
  describe('VideoDecoder', () => {
    it('should trigger error callback for corrupted NAL units', async () => {
      let errorReceived: Error | null = null;
      const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Corrupted data - invalid NAL unit header (forbidden_zero_bit set + garbage)
      const corruptedData = Buffer.from([
        0x80, 0xff, 0xff, 0xff, 0x00, 0x00, 0x01, 0xff,
      ]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: corruptedData,
      });

      decoder.decode(chunk);

      // Wait for async error callback - FFmpeg may take time to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      decoder.close();

      assert.ok(
        errorReceived,
        'error callback should have been invoked for corrupted data',
      );
      // EncodingError is the spec name, but implementation may use different name
      assert.ok(
        (errorReceived as DOMException).name === 'EncodingError' ||
          (errorReceived as Error).message.toLowerCase().includes('decode') ||
          (errorReceived as Error).message.toLowerCase().includes('invalid'),
        `Expected EncodingError-like error but got ${(errorReceived as Error).name}: ${(errorReceived as Error).message}`,
      );
    });

    it('should trigger error callback for truncated chunk', async () => {
      let errorReceived: Error | null = null;
      const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Single byte is definitely not a valid H.264 frame
      const truncatedData = Buffer.from([0x00]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: truncatedData,
      });

      decoder.decode(chunk);

      // Wait for async error callback
      await new Promise((resolve) => setTimeout(resolve, 500));

      decoder.close();

      assert.ok(
        errorReceived,
        'error callback should have been invoked for truncated data',
      );
    });

    it('should handle zero-byte chunk gracefully', async () => {
      let errorReceived: Error | null = null;
      let outputReceived = false;
      const decoder = new VideoDecoder({
        output: () => {
          outputReceived = true;
        },
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Empty data buffer - may be silently skipped or error
      const emptyData = Buffer.alloc(0);

      // This may throw synchronously at construction or decode, or be silently skipped
      let syncError: Error | null = null;
      try {
        const chunk = new EncodedVideoChunk({
          type: 'key',
          timestamp: 0,
          data: emptyData,
        });
        decoder.decode(chunk);
      } catch (e) {
        syncError = e as Error;
      }

      // Wait for potential async callback
      await new Promise((resolve) => setTimeout(resolve, 500));

      decoder.close();

      // Zero-byte chunks may be: sync error, async error, or silently skipped (no output)
      // All of these are acceptable behaviors
      assert.ok(
        syncError || errorReceived || !outputReceived,
        'zero-byte chunk should be handled (error or silently skipped)',
      );
    });
  });

  describe('AudioDecoder', () => {
    it('should trigger error callback for corrupted AAC data', async () => {
      let errorReceived: Error | null = null;
      const decoder = new AudioDecoder({
        output: () => {},
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      // Invalid AAC frame - garbage bytes that don't form valid ADTS/raw AAC
      const corruptedData = Buffer.from([0xff, 0xff, 0x00, 0x00]);
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: corruptedData,
      });

      decoder.decode(chunk);

      // Wait for async error callback
      await new Promise((resolve) => setTimeout(resolve, 500));

      decoder.close();

      assert.ok(
        errorReceived,
        'error callback should have been invoked for corrupted audio',
      );
    });
  });
});
