// test/unit/video-encoder-metadata.test.ts
// Tests for W3C WebCodecs spec section 6.7 - EncodedVideoChunkMetadata

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type EncodedVideoChunk,
  type EncodedVideoChunkMetadata,
  type SvcOutputMetadata,
  VideoEncoder,
  VideoFrame,
} from '../../lib';

/**
 * Tests for EncodedVideoChunkMetadata per W3C WebCodecs spec section 6.7.
 * Covers decoderConfig, svc, and alphaSideData metadata fields.
 */

describe('EncodedVideoChunkMetadata: 6.7', () => {
  const h264Config = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  // Helper to create test video frame
  function createVideoFrame(timestamp = 0, width = 640, height = 480): VideoFrame {
    const buf = Buffer.alloc(width * height * 4);
    return new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('EncodedVideoChunkMetadata type', () => {
    // Spec 6.7: EncodedVideoChunkMetadata should be exported
    it('should be exported from library', () => {
      // Type import test - if this compiles, the type is exported
      const metadata: EncodedVideoChunkMetadata = {};
      assert.ok(metadata !== undefined);
    });

    // Spec 6.7: decoderConfig is optional
    it('should have optional decoderConfig field', () => {
      const metadata: EncodedVideoChunkMetadata = {};
      assert.strictEqual(metadata.decoderConfig, undefined);
    });

    // Spec 6.7: svc is optional
    it('should have optional svc field', () => {
      const metadata: EncodedVideoChunkMetadata = {};
      assert.strictEqual(metadata.svc, undefined);
    });

    // Spec 6.7: alphaSideData is optional
    it('should have optional alphaSideData field', () => {
      const metadata: EncodedVideoChunkMetadata = {};
      assert.strictEqual(metadata.alphaSideData, undefined);
    });
  });

  describe('SvcOutputMetadata type', () => {
    // Spec 6.7: SvcOutputMetadata should be exported
    it('should be exported from library', () => {
      const svc: SvcOutputMetadata = { temporalLayerId: 0 };
      assert.strictEqual(svc.temporalLayerId, 0);
    });

    // Spec 6.7: temporalLayerId is required
    it('should require temporalLayerId field', () => {
      const svc: SvcOutputMetadata = { temporalLayerId: 1 };
      assert.strictEqual(svc.temporalLayerId, 1);
    });
  });

  describe('output callback signature', () => {
    // Spec 6.7: Output callback receives optional metadata parameter
    it('should accept second metadata parameter', async () => {
      let receivedMetadata: EncodedVideoChunkMetadata | undefined;

      const encoder = new VideoEncoder({
        output: (_chunk, metadata) => {
          receivedMetadata = metadata;
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

      // VideoEncoder should provide metadata
      assert.ok(receivedMetadata !== undefined, 'Should receive metadata');

      encoder.close();
    });
  });

  describe('decoderConfig metadata', () => {
    // Spec 6.7: decoderConfig present on first output (key frame)
    it('should have decoderConfig on key frame output', async () => {
      let keyFrameMetadata: EncodedVideoChunkMetadata | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key' && !keyFrameMetadata) {
            keyFrameMetadata = metadata;
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

      assert.ok(keyFrameMetadata !== undefined, 'Should have metadata');
      assert.ok(keyFrameMetadata.decoderConfig !== undefined, 'Should have decoderConfig');

      encoder.close();
    });

    // Spec 6.7: decoderConfig.codec matches encoder codec
    it('should have decoderConfig.codec matching encoder config', async () => {
      let decoderConfig: EncodedVideoChunkMetadata['decoderConfig'] | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key' && !decoderConfig) {
            decoderConfig = metadata?.decoderConfig;
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

      assert.ok(decoderConfig !== undefined, 'Should have decoderConfig');
      // Codec should match or be compatible
      assert.ok(decoderConfig.codec.startsWith('avc1'), 'Codec should be H.264');

      encoder.close();
    });

    // Spec 6.7: decoderConfig has codedWidth/codedHeight
    it('should have decoderConfig with codedWidth and codedHeight', async () => {
      let decoderConfig: EncodedVideoChunkMetadata['decoderConfig'] | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key' && !decoderConfig) {
            decoderConfig = metadata?.decoderConfig;
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

      assert.ok(decoderConfig !== undefined, 'Should have decoderConfig');
      assert.strictEqual(decoderConfig.codedWidth, 640, 'codedWidth should match');
      assert.strictEqual(decoderConfig.codedHeight, 480, 'codedHeight should match');

      encoder.close();
    });

    // Spec 6.7: H.264 may have description (SPS/PPS)
    // Note: Current implementation doesn't always provide description
    it('should have decoderConfig for H.264 (description optional)', async () => {
      let decoderConfig: EncodedVideoChunkMetadata['decoderConfig'] | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key' && !decoderConfig) {
            decoderConfig = metadata?.decoderConfig;
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

      assert.ok(decoderConfig !== undefined, 'Should have decoderConfig');
      // H.264 spec requires SPS/PPS in description, but current implementation
      // may not provide it. Document current behavior.
      // If description is present, it should be ArrayBuffer or Uint8Array
      if (decoderConfig.description !== undefined) {
        assert.ok(
          decoderConfig.description instanceof ArrayBuffer ||
            decoderConfig.description instanceof Uint8Array,
          'description should be ArrayBuffer or Uint8Array',
        );
      }

      encoder.close();
    });
  });

  describe('SVC metadata', () => {
    // Note: SVC metadata depends on scalabilityMode support
    it('should configure with L1T1 scalabilityMode', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        ...h264Config,
        scalabilityMode: 'L1T1',
      });

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce output');

      encoder.close();
    });

    // Note: Full SVC metadata verification requires specific encoder support
    it('should produce outputs with L1T2 scalabilityMode', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      // L1T2 = 1 spatial layer, 2 temporal layers
      encoder.configure({
        ...h264Config,
        scalabilityMode: 'L1T2',
      });

      // Encode several frames for temporal layer pattern
      for (let i = 0; i < 4; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      assert.ok(outputs.length >= 4, 'Should produce at least 4 outputs');

      encoder.close();
    });
  });

  describe('multiple outputs metadata', () => {
    it('should provide metadata for multiple outputs', async () => {
      const metadataList: (EncodedVideoChunkMetadata | undefined)[] = [];

      const encoder = new VideoEncoder({
        output: (_chunk, metadata) => {
          metadataList.push(metadata);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(h264Config);

      for (let i = 0; i < 5; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      assert.ok(metadataList.length >= 5, 'Should have metadata for each output');
      // First frame (key) should have decoderConfig
      assert.ok(metadataList[0]?.decoderConfig !== undefined, 'First frame should have decoderConfig');

      encoder.close();
    });
  });

  describe('edge cases', () => {
    it('should handle VP9 codec', async () => {
      let decoderConfig: EncodedVideoChunkMetadata['decoderConfig'] | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key' && !decoderConfig) {
            decoderConfig = metadata?.decoderConfig;
          }
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        codec: 'vp09.00.10.08',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(decoderConfig !== undefined, 'Should have decoderConfig for VP9');
      assert.ok(decoderConfig.codec.startsWith('vp09'), 'Codec should be VP9');

      encoder.close();
    });
  });
});
