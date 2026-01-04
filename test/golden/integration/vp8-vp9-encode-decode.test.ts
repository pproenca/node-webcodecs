/**
 * Integration tests for VP8/VP9 Video Encoding/Decoding
 * Phase 5: Extended Codec Support
 */

import {describe, expect, it} from 'vitest';
import {AudioData, AudioDecoder, AudioEncoder, EncodedAudioChunk, EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame} from '@pproenca/node-webcodecs';

// Helper to create a test frame
function createTestFrame(
  width,
  height,
  timestamp,
  color = {r: 128, g: 128, b: 128},
) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = 255;
  }

  return new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp,
  });
}

// ==================== VP8 Tests ====================

it('VP8EncodeSingleFrame', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => {
      console.error('  Encoder error:', err);
      errors.push(err);
    },
  });

  encoder.configure({
    codec: 'vp8',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 255, g: 0, b: 0});

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);
});

it('VP8EncodeMultipleFrames', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'vp8',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30,
  });

  const frameDuration = 33333; // ~30fps in microseconds

  for (let i = 0; i < 5; i++) {
    const gray = 50 + i * 40;
    const frame = createTestFrame(320, 240, i * frameDuration, {
      r: gray,
      g: gray,
      b: gray,
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBe(5);
});

it('VP8EncodeDecode', {timeout: 10_000}, async () => {
  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => encodedChunks.push(chunk),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'vp8',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 0, g: 255, b: 0});
  encoder.encode(frame, {keyFrame: true});
  frame.close();
  await encoder.flush();
  encoder.close();

  expect(encodedChunks.length).toBeGreaterThan(0);

  // Decode
  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedFrames.push(decodedFrame);
    },
    error: err => {
      console.error('  Decoder error:', err);
      errors.push(err);
    },
  });

  decoder.configure({
    codec: 'vp8',
    codedWidth: 320,
    codedHeight: 240,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  decodedFrames.forEach(f => { f.close(); });

  expect(decodedFrames.length).toBeGreaterThan(0);
});

// ==================== VP9 Tests ====================

it('VP9EncodeSingleFrame', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => {
      console.error('  Encoder error:', err);
      errors.push(err);
    },
  });

  encoder.configure({
    codec: 'vp9',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 0, g: 0, b: 255});

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);
});

it('VP9EncodeMultipleFrames', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'vp9',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30,
  });

  const frameDuration = 33333;

  for (let i = 0; i < 5; i++) {
    const gray = 50 + i * 40;
    const frame = createTestFrame(320, 240, i * frameDuration, {
      r: gray,
      g: gray,
      b: gray,
    });
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBe(5);
});

it('VP9EncodeDecode', {timeout: 10_000}, async () => {
  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => encodedChunks.push(chunk),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'vp9',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 255, g: 255, b: 0});
  encoder.encode(frame, {keyFrame: true});
  frame.close();
  await encoder.flush();
  encoder.close();

  expect(encodedChunks.length).toBeGreaterThan(0);

  // Decode
  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedFrames.push(decodedFrame);
    },
    error: err => {
      console.error('  Decoder error:', err);
      errors.push(err);
    },
  });

  decoder.configure({
    codec: 'vp9',
    codedWidth: 320,
    codedHeight: 240,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  decodedFrames.forEach(f => { f.close(); });

  expect(decodedFrames.length).toBeGreaterThan(0);
});

it('VP9FullCodecString', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => errors.push(err),
  });

  // Use full VP9 codec string: vp09.PP.LL.DD
  // PP=00 (profile 0), LL=10 (level 1.0), DD=08 (8-bit depth)
  encoder.configure({
    codec: 'vp09.00.10.08',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 128, g: 0, b: 128});
  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);
});
