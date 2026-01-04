/**
 * Integration tests for VideoEncoder/VideoDecoder
 */

import {describe, expect, it} from 'vitest';
import {EncodedVideoChunk, VideoDecoder, VideoEncoder, VideoFrame} from '@pproenca/node-webcodecs';

/**
 * Extracts dominant color from VideoFrame by sampling center pixel
 * Returns {y, width, height} where y is luminance in 0-255 range
 * Handles both RGBA and YUV formats
 */
async function getDominantColor(frame) {
  // Copy frame data to buffer
  const size = frame.allocationSize();
  const buffer = new Uint8Array(size);
  await frame.copyTo(buffer);

  let y: number;
  const format = frame.format;

  if (format === 'RGBA' || format === 'RGBX' || format === 'BGRA' || format === 'BGRX') {
    // RGBA/BGRA format: 4 bytes per pixel
    const bytesPerPixel = 4;
    const centerX = Math.floor(frame.codedWidth / 2);
    const centerY = Math.floor(frame.codedHeight / 2);
    const centerOffset = (centerY * frame.codedWidth + centerX) * bytesPerPixel;

    // Extract RGB values based on format
    let r: number;
    let g: number;
    let b: number;
    if (format === 'RGBA' || format === 'RGBX') {
      r = buffer[centerOffset];
      g = buffer[centerOffset + 1];
      b = buffer[centerOffset + 2];
    } else {
      // BGRA/BGRX
      b = buffer[centerOffset];
      g = buffer[centerOffset + 1];
      r = buffer[centerOffset + 2];
    }

    // Convert RGB to Y (luminance) using standard BT.601 coefficients
    y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  } else {
    // Assume YUV planar format (I420, NV12, etc.)
    // Sample center pixel from Y plane
    const centerOffset = Math.floor(frame.codedWidth * frame.codedHeight / 2 + frame.codedWidth / 2);
    y = buffer[centerOffset];
  }

  return { y, width: frame.codedWidth, height: frame.codedHeight };
}

describe('VideoEncoder', () => {
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

    // Assertions
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunk).toBeInstanceOf(EncodedVideoChunk);
    expect(chunks[0].chunk.type).toBe('key'); // First frame should be keyframe
    expect(chunks[0].chunk.byteLength).toBeGreaterThan(0);
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

    // Assertions
    expect(chunks.length).toBe(5); // Should have 5 encoded chunks
    expect(chunks[0].chunk).toBeInstanceOf(EncodedVideoChunk);
    expect(chunks[0].chunk.type).toBe('key'); // First frame should be keyframe
    // Subsequent frames may be delta frames
    for (const {chunk} of chunks) {
      expect(chunk.byteLength).toBeGreaterThan(0);
    }
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

    // Assertions
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunk).toBeInstanceOf(EncodedVideoChunk);
    expect(chunks[0].chunk.type).toBe('key'); // First frame should be keyframe
    expect(chunks[0].chunk.byteLength).toBeGreaterThan(0);
  });
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

  // Verify we got decoded frames
  expect(decodedFrames.length).toBeGreaterThan(0);

  // Verify pixel data from the first decoded frame
  const decodedColor = await getDominantColor(decodedFrames[0]);

  // Verify: green frame should produce high Y value (bright)
  // Pure green (0, 255, 0) in YUV is approximately Y=150
  expect(decodedColor.y).toBeGreaterThan(100);
  expect(decodedColor.y).toBeLessThan(200);

  // Clean up
  decodedFrames.forEach(f => { f.close(); });
});
