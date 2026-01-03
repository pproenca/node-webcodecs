/**
 * Keyframe forcing regression test.
 *
 * Per WebCodecs spec, when encode() is called with { keyFrame: true },
 * the output chunk MUST be a key frame. This test verifies the encoder
 * correctly honors the keyFrame option.
 *
 * @see https://www.w3.org/TR/webcodecs/#dom-videoencoder-encode
 */

import '../setup.js';
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRGBABuffer, TEST_CONSTANTS } from '../fixtures';

describe('Keyframe Forcing', () => {
  it('should produce key chunks at requested positions', async () => {
    const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
    const totalFrames = 30;
    const keyframePositions = new Set([0, 10, 20, 29]);

    // Collect output chunks with their frame indices
    const chunks: Array<{ index: number; type: 'key' | 'delta' }> = [];
    let error: Error | undefined;

    const encoder = new VideoEncoder({
      output: (chunk) => {
        // Track chunk by timestamp to determine original frame index
        const frameIndex = Math.round(chunk.timestamp / TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA);
        chunks.push({ index: frameIndex, type: chunk.type });
      },
      error: (e) => {
        error = e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001e', // H.264 Baseline
      width,
      height,
      bitrate: 500_000,
    });

    // Encode frames, forcing keyframes at specific positions
    for (let i = 0; i < totalFrames; i++) {
      const buffer = createRGBABuffer(width, height, {
        r: i * 8,
        g: 128,
        b: 255 - i * 8,
        a: 255,
      });
      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
      });

      const forceKeyframe = keyframePositions.has(i);
      encoder.encode(frame, { keyFrame: forceKeyframe });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // Verify no encoding errors occurred
    if (error) {
      throw error;
    }

    // Verify we got all frames
    assert.strictEqual(chunks.length, totalFrames, `Expected ${totalFrames} chunks, got ${chunks.length}`);

    // Verify keyframes appear at requested positions
    for (const position of keyframePositions) {
      const chunk = chunks.find((c) => c.index === position);
      assert.notStrictEqual(chunk, undefined, `No chunk found for frame ${position}`);
      assert.strictEqual(
        chunk?.type,
        'key',
        `Frame ${position} should be a keyframe but was '${chunk?.type}'`
      );
    }
  });

  it('should produce keyframe when keyFrame=true even mid-GOP', async () => {
    // This tests that keyFrame=true overrides the encoder's natural GOP structure.
    // Even if the encoder would normally produce a delta frame, the keyFrame
    // option should force an IDR/keyframe.
    const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
    const chunks: Array<{ timestamp: number; type: 'key' | 'delta' }> = [];
    let error: Error | undefined;

    const encoder = new VideoEncoder({
      output: (chunk) => {
        chunks.push({ timestamp: chunk.timestamp, type: chunk.type });
      },
      error: (e) => {
        error = e;
      },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width,
      height,
      bitrate: 500_000,
    });

    // Encode 10 frames, all as delta except frame 5 which we force as keyframe
    for (let i = 0; i < 10; i++) {
      const buffer = createRGBABuffer(width, height);
      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: i * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA,
      });

      // First frame is always keyframe (encoder requirement)
      // Frame 5 should also be forced to keyframe
      const forceKeyframe = i === 0 || i === 5;
      encoder.encode(frame, { keyFrame: forceKeyframe });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    if (error) {
      throw error;
    }

    assert.strictEqual(chunks.length, 10);

    // Find chunk for frame 5 by timestamp
    const frame5Timestamp = 5 * TEST_CONSTANTS.FPS_30_TIMESTAMP_DELTA;
    const frame5Chunk = chunks.find((c) => c.timestamp === frame5Timestamp);
    assert.notStrictEqual(frame5Chunk, undefined, 'Frame 5 chunk not found');
    assert.strictEqual(
      frame5Chunk?.type,
      'key',
      `Mid-GOP keyframe forcing failed: frame 5 should be 'key' but was '${frame5Chunk?.type}'`
    );
  });
});
