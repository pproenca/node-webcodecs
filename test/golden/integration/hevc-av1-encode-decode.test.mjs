/**
 * Integration tests for H.265/HEVC and AV1 Video Encoding/Decoding
 * Phase 5: Extended Codec Support
 */

import {expect, it, } from 'vitest';

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

// ==================== H.265/HEVC Tests ====================

it('HEVCEncodeSingleFrame', {timeout: 10_000}, async () => {
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
    codec: 'hvc1',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 255, g: 128, b: 0});

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);
});

it('HEVCEncodeMultipleFrames', {timeout: 10_000}, async () => {
  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'hvc1',
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

  expect(chunks.length).toBeGreaterThan(0);
});

it('HEVCEncodeDecode', {timeout: 10_000}, async () => {
  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];
  let decoderConfig = null;

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'hvc1',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 0, g: 128, b: 255});
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
    codec: 'hvc1',
    codedWidth: 320,
    codedHeight: 240,
    description: decoderConfig?.description,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  decodedFrames.forEach(f => { f.close(); });

  expect(decodedFrames.length).toBeGreaterThan(0);
});

// ==================== AV1 Tests ====================

it('AV1EncodeSingleFrame', {timeout: 10_000}, async () => {
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
    codec: 'av01',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 128, g: 255, b: 128});

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);
});

it('AV1EncodeDecode', {timeout: 10_000}, async () => {
  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, _metadata) => encodedChunks.push(chunk),
    error: err => errors.push(err),
  });

  encoder.configure({
    codec: 'av01',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  const frame = createTestFrame(320, 240, 0, {r: 255, g: 0, b: 255});
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
    codec: 'av01',
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
