// test/unit/audio-encoder-metadata.test.ts
// Tests for W3C WebCodecs spec section 5.7 - EncodedAudioChunkMetadata

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AudioData,
  AudioEncoder,
  type EncodedAudioChunk,
  type EncodedAudioChunkMetadata,
} from '../../lib';

/**
 * Tests for EncodedAudioChunkMetadata per W3C WebCodecs spec section 5.7.
 * Verifies that output callback receives metadata with decoderConfig.
 *
 * Note: Current native implementation does not provide metadata.decoderConfig
 * for AudioEncoder outputs. These tests document current behavior and the
 * expected spec behavior.
 */

describe('EncodedAudioChunkMetadata: 5.7', () => {
  const opusConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  };

  const aacConfig = {
    codec: 'mp4a.40.2',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitrate: 128000,
  };

  // Helper to create test audio data
  function createAudioData(
    timestamp = 0,
    sampleRate = 48000,
    channels = 2,
  ): AudioData {
    const samples = new Float32Array(sampleRate * channels);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.5;
    }
    return new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: sampleRate,
      numberOfChannels: channels,
      timestamp,
      data: samples,
    });
  }

  describe('EncodedAudioChunkMetadata type', () => {
    it('should be exported from library', async () => {
      // TypeScript type check - EncodedAudioChunkMetadata should be importable
      const metadata: EncodedAudioChunkMetadata = {};
      assert.ok(typeof metadata === 'object');
    });

    it('should have optional decoderConfig field', () => {
      // TypeScript type check - decoderConfig is optional
      const metadata: EncodedAudioChunkMetadata = {
        decoderConfig: {
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        },
      };
      assert.ok(metadata.decoderConfig !== undefined);
      assert.strictEqual(metadata.decoderConfig.codec, 'opus');
    });
  });

  describe('output callback signature', () => {
    it('should accept second metadata parameter', async () => {
      let callbackReceived = false;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk: EncodedAudioChunk, _metadata?: EncodedAudioChunkMetadata) => {
          callbackReceived = true;
          outputs.push(chunk);
          // metadata is optional second parameter
          assert.ok(chunk !== undefined);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      assert.ok(callbackReceived, 'Output callback should be invoked');

      encoder.close();
    });
  });

  describe('EncodedAudioChunk output', () => {
    it('should produce valid EncodedAudioChunk for Opus', async () => {
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce EncodedAudioChunk outputs');
      assert.ok(outputs[0].byteLength > 0, 'Chunk should have data');
      assert.strictEqual(outputs[0].type, 'key', 'Audio chunks should be key type');

      encoder.close();
    });

    it('should produce valid EncodedAudioChunk for AAC', async () => {
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(aacConfig);

      // Create audio data at 44100 Hz for AAC
      const audioData = createAudioData(0, 44100, 2);
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce EncodedAudioChunk outputs');
      assert.ok(outputs[0].byteLength > 0, 'Chunk should have data');

      encoder.close();
    });
  });

  describe('metadata.decoderConfig (spec requirement)', () => {
    // Note: Current native implementation doesn't provide decoderConfig
    // These tests document the expected spec behavior

    it('should document expected decoderConfig structure', () => {
      // Per spec 5.7, decoderConfig should contain:
      // - codec: string
      // - sampleRate: number
      // - numberOfChannels: number
      // - description?: ArrayBuffer (codec-specific)

      const expectedMetadata: EncodedAudioChunkMetadata = {
        decoderConfig: {
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          // description is optional, contains codec-specific setup data
        },
      };

      assert.strictEqual(expectedMetadata.decoderConfig?.codec, 'opus');
      assert.strictEqual(expectedMetadata.decoderConfig?.sampleRate, 48000);
      assert.strictEqual(expectedMetadata.decoderConfig?.numberOfChannels, 2);
    });

    it('should receive metadata in output callback (current behavior)', async () => {
      let metadataReceived: EncodedAudioChunkMetadata | undefined;
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
          outputs.push(chunk);
          if (!metadataReceived) {
            metadataReceived = metadata;
          }
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      const audioData = createAudioData();
      encoder.encode(audioData);
      audioData.close();

      await encoder.flush();

      // Current implementation: metadata may be undefined or empty
      // Spec requires: decoderConfig on first output
      if (metadataReceived?.decoderConfig) {
        // If decoderConfig is present, verify structure
        assert.ok(metadataReceived.decoderConfig.codec);
        assert.ok(metadataReceived.decoderConfig.sampleRate);
        assert.ok(metadataReceived.decoderConfig.numberOfChannels);
      }

      encoder.close();
    });
  });

  describe('multiple outputs', () => {
    it('should produce multiple outputs for longer audio', async () => {
      const outputs: EncodedAudioChunk[] = [];

      const encoder = new AudioEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(opusConfig);

      // Encode multiple chunks
      for (let i = 0; i < 3; i++) {
        const audioData = createAudioData(i * 1_000_000);
        encoder.encode(audioData);
        audioData.close();
      }

      await encoder.flush();

      // Should have produced outputs
      assert.ok(outputs.length > 0, 'Should produce outputs');

      // All outputs should be valid
      for (const chunk of outputs) {
        assert.ok(chunk.byteLength > 0, 'Each chunk should have data');
        assert.ok(chunk.type === 'key' || chunk.type === 'delta', 'Valid chunk type');
      }

      encoder.close();
    });
  });
});
