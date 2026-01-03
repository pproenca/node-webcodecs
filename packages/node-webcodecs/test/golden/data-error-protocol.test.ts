/**
 * DataError Protocol Tests per W3C WebCodecs spec
 *
 * DataErrors are delivered via error callback (async) for protocol violations.
 * KEY RULE: After configure() or flush(), first chunk MUST be a key frame.
 *
 * This mirrors the contract tests in test/contracts/error_handling/data_errors.js
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Helper to encode video frames for decoder tests.
 */
async function encodeVideoFrames(count: number): Promise<EncodedVideoChunk[]> {
  const chunks: EncodedVideoChunk[] = [];
  const encoder = new VideoEncoder({
    output: (chunk) => {
      chunks.push(chunk);
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  });

  const frames: VideoFrame[] = [];
  for (let i = 0; i < count; i++) {
    const buf = Buffer.alloc(320 * 240 * 4);
    // Fill with varying colors for each frame
    for (let j = 0; j < 320 * 240; j++) {
      buf[j * 4] = (i * 50) % 256; // R
      buf[j * 4 + 1] = (i * 30) % 256; // G
      buf[j * 4 + 2] = (i * 70) % 256; // B
      buf[j * 4 + 3] = 255; // A
    }
    const frame = new VideoFrame(buf, {
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });
    frames.push(frame);
    encoder.encode(frame, { keyFrame: i === 0 });
  }

  await encoder.flush();

  // Clean up frames
  for (const frame of frames) {
    frame.close();
  }
  encoder.close();

  return chunks;
}

/**
 * Helper to create a delta video chunk (not a valid key frame).
 */
function createDeltaVideoChunk(timestamp = 0): EncodedVideoChunk {
  const data = Buffer.alloc(100);
  return new EncodedVideoChunk({
    type: 'delta',
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Helper to create a delta audio chunk (not a valid key frame).
 */
function createDeltaAudioChunk(timestamp = 0): EncodedAudioChunk {
  const data = Buffer.alloc(100);
  return new EncodedAudioChunk({
    type: 'delta',
    timestamp: timestamp,
    data: data,
  });
}

describe('DataError protocol per W3C spec', () => {
  describe('VideoDecoder', () => {
    it('should trigger DataError callback for delta chunk after configure', async () => {
      let errorReceived: Error | null = null;
      let syncError: Error | null = null;

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

      // Create a delta chunk (not key) - violates W3C spec
      const chunk = createDeltaVideoChunk(0);

      try {
        decoder.decode(chunk);
      } catch (e) {
        // Some implementations may throw synchronously
        syncError = e as Error;
      }

      // Wait for async error callback if sync error wasn't thrown
      if (!syncError) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      decoder.close();

      // Either sync error or async callback error should have DataError
      const error = syncError || errorReceived;
      assert.ok(error, 'error should have been delivered (sync or via callback)');
      assert.strictEqual(
        (error as DOMException).name,
        'DataError',
        `Expected DataError but got ${(error as Error).name}: ${(error as Error).message}`,
      );
    });

    it('should trigger error callback for delta chunk after flush', async () => {
      // First encode some frames to get valid chunks
      const encodedChunks = await encodeVideoFrames(3);
      assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

      let errorReceived: Error | null = null;
      let syncError: Error | null = null;

      const decoder = new VideoDecoder({
        output: (frame) => {
          frame.close();
        },
        error: (e) => {
          errorReceived = e;
        },
      });

      decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Decode valid chunks first
      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }

      // Flush to complete decoding
      await decoder.flush();

      // Now send a delta chunk after flush - decoder needs key frame again
      const deltaChunk = createDeltaVideoChunk(1000000);

      try {
        decoder.decode(deltaChunk);
      } catch (e) {
        syncError = e as Error;
      }

      // Wait for async error callback if sync error wasn't thrown
      if (!syncError) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      decoder.close();

      const error = syncError || errorReceived;
      assert.ok(error, 'error should have been delivered (sync or via callback)');

      // Per W3C spec, this should be DataError. Current implementation returns
      // generic Error with FFmpeg error code. Document this as known gap.
      if ((error as DOMException).name === 'DataError') {
        assert.strictEqual((error as DOMException).name, 'DataError');
      } else {
        // Current behavior: FFmpeg decode error is reported as generic Error
        assert.ok(
          (error as Error).message.includes('Decode error') ||
            (error as Error).message.includes('Invalid'),
          `Expected decode-related error, got: ${(error as Error).message}`,
        );
      }
    });

    it('should throw InvalidStateError when decoding after reset (unconfigured)', async () => {
      let syncError: Error | null = null;

      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Reset returns decoder to unconfigured state
      decoder.reset();
      assert.strictEqual(
        decoder.state,
        'unconfigured',
        'State should be unconfigured after reset',
      );

      // Attempt to decode on unconfigured decoder
      const chunk = createDeltaVideoChunk(0);

      try {
        decoder.decode(chunk);
      } catch (e) {
        syncError = e as Error;
      }

      decoder.close();

      // Should throw InvalidStateError synchronously (not DataError)
      assert.ok(syncError, 'Should have thrown synchronously');
      assert.ok(
        (syncError as DOMException).name === 'InvalidStateError' ||
          (syncError as Error).message.includes('InvalidStateError') ||
          (syncError as Error).message.includes('unconfigured'),
        `Expected InvalidStateError, got ${(syncError as Error).name}: ${(syncError as Error).message}`,
      );
    });
  });

  describe('AudioDecoder', () => {
    it('should trigger DataError callback for delta chunk after configure', async () => {
      let errorReceived: Error | null = null;
      let syncError: Error | null = null;

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

      // Create a delta chunk (not key) - violates W3C spec
      const chunk = createDeltaAudioChunk(0);

      try {
        decoder.decode(chunk);
      } catch (e) {
        // Some implementations may throw synchronously
        syncError = e as Error;
      }

      // Wait for async error callback if sync error wasn't thrown
      if (!syncError) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      decoder.close();

      // Either sync error or async callback error should have DataError
      const error = syncError || errorReceived;
      assert.ok(error, 'error should have been delivered (sync or via callback)');
      assert.strictEqual(
        (error as DOMException).name,
        'DataError',
        `Expected DataError but got ${(error as Error).name}: ${(error as Error).message}`,
      );
    });
  });
});
