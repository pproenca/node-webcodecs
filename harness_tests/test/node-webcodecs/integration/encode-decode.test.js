/**
 * Integration tests for VideoEncoder/VideoDecoder
 */

import {beforeAll, expect, it, describe} from 'vitest';
import {polyfillWebCodecsApi} from '../../../src/polyfill.js';

beforeAll(async () => {
  await polyfillWebCodecsApi();
});

it('EncodeSingleFrame', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  // Create red frame
  const data = new Uint8Array(320 * 240 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('EncodeMultipleFrames', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30,
  });

  const frameDuration = 33333; // ~30fps in microseconds

  for (let i = 0; i < 5; i++) {
    const data = new Uint8Array(320 * 240 * 4);
    const gray = 50 + i * 40;
    for (let j = 0; j < data.length; j += 4) {
      data[j] = gray;
      data[j + 1] = gray;
      data[j + 2] = gray;
      data[j + 3] = 255;
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * frameDuration,
    });

    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('EncodeI420Frame', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({chunk, metadata}),
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  // Create I420 frame (Y + U + V planes)
  const ySize = 320 * 240;
  const uvSize = 160 * 120; // width/2 * height/2
  const data = new Uint8Array(ySize + uvSize * 2);

  // Y plane - gray (luminance)
  data.fill(128, 0, ySize);
  // U plane - neutral (chrominance)
  data.fill(128, ySize, ySize + uvSize);
  // V plane - neutral (chrominance)
  data.fill(128, ySize + uvSize);

  const frame = new VideoFrame(data, {
    format: 'I420',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  encoder.encode(frame, {keyFrame: true});
  frame.close();

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('EncodeDecode', {timeout: 10_000}, async () => {
  // First, encode some frames
  const encodedChunks = [];
  let decoderConfig = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  // Create and encode a frame
  const data = new Uint8Array(320 * 240 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; // R
    data[i + 1] = 255; // G
    data[i + 2] = 0; // B
    data[i + 3] = 255; // A
  }

  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  encoder.encode(frame, {keyFrame: true});
  frame.close();
  await encoder.flush();
  encoder.close();

  // Now decode
  const decodedFrames = [];

  const decoder = new VideoDecoder({
    output: decodedFrame => {
      decodedFrames.push(decodedFrame);
    },
    error: err => console.error('  Decoder error:', err),
  });

  decoder.configure({
    codec: 'avc1.42E01E',
    codedWidth: 320,
    codedHeight: 240,
    description: decoderConfig?.description,
  });

  // Decode each chunk
  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  // Wait for decoding to complete
  await decoder.flush();
  decoder.close();

  // Clean up
  decodedFrames.forEach(f => f.close());
});
