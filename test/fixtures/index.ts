/**
 * Shared test fixtures and utilities
 *
 * This module provides reusable test configurations, buffer generators,
 * and common utilities to reduce duplication across test files.
 */

import * as path from 'node:path';

export * from './test-helpers.js';
export * from './assertions.js';

//==============================================================================
// Video Encoder Configurations
//==============================================================================

export const videoConfigs = {
  h264_baseline: {
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
  },
  h264_main: {
    codec: 'avc1.4D001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
  },
  h264_high: {
    codec: 'avc1.64001E',
    width: 1920,
    height: 1080,
    bitrate: 5_000_000,
  },
  h264_small: {
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100_000,
  },
} as const;

//==============================================================================
// Audio Encoder Configurations
//==============================================================================

export const audioConfigs = {
  opus_stereo: {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  },
  opus_mono: {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 1,
    bitrate: 64000,
  },
  aac_stereo: {
    codec: 'mp4a.40.2',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitrate: 128000,
  },
  aac_mono: {
    codec: 'mp4a.40.2',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitrate: 64000,
  },
} as const;

//==============================================================================
// Color Definitions
//==============================================================================

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const colors: Record<string, RGBAColor> = {
  red: { r: 255, g: 0, b: 0, a: 255 },
  green: { r: 0, g: 255, b: 0, a: 255 },
  blue: { r: 0, g: 0, b: 255, a: 255 },
  white: { r: 255, g: 255, b: 255, a: 255 },
  black: { r: 0, g: 0, b: 0, a: 255 },
  gray: { r: 128, g: 128, b: 128, a: 255 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

//==============================================================================
// Buffer Generators
//==============================================================================

/**
 * Creates an RGBA buffer filled with a solid color
 */
export function createRGBABuffer(
  width: number,
  height: number,
  color: RGBAColor = colors.gray
): Uint8Array {
  const buffer = new Uint8Array(width * height * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = color.r;
    buffer[i + 1] = color.g;
    buffer[i + 2] = color.b;
    buffer[i + 3] = color.a;
  }
  return buffer;
}

/**
 * Creates an I420 (YUV 4:2:0) buffer with specified Y, U, V values
 */
export function createI420Buffer(
  width: number,
  height: number,
  y: number = 128,
  u: number = 128,
  v: number = 128
): Uint8Array {
  const ySize = width * height;
  const uvWidth = Math.floor(width / 2);
  const uvHeight = Math.floor(height / 2);
  const uvSize = uvWidth * uvHeight;
  const buffer = new Uint8Array(ySize + uvSize * 2);

  buffer.fill(y, 0, ySize);
  buffer.fill(u, ySize, ySize + uvSize);
  buffer.fill(v, ySize + uvSize);

  return buffer;
}

/**
 * Creates an NV12 buffer (Y plane followed by interleaved UV plane)
 */
export function createNV12Buffer(
  width: number,
  height: number,
  y: number = 128,
  u: number = 128,
  v: number = 128
): Uint8Array {
  const ySize = width * height;
  const uvWidth = Math.floor(width / 2);
  const uvHeight = Math.floor(height / 2);
  const uvSize = uvWidth * uvHeight * 2; // Interleaved UV
  const buffer = new Uint8Array(ySize + uvSize);

  // Y plane
  buffer.fill(y, 0, ySize);

  // Interleaved UV plane
  for (let i = ySize; i < buffer.length; i += 2) {
    buffer[i] = u;
    buffer[i + 1] = v;
  }

  return buffer;
}

/**
 * Creates a gradient RGBA buffer for visual verification
 */
export function createGradientBuffer(width: number, height: number): Uint8Array {
  const buffer = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buffer[i] = Math.floor((x / width) * 255); // R gradient left-to-right
      buffer[i + 1] = Math.floor((y / height) * 255); // G gradient top-to-bottom
      buffer[i + 2] = 128; // B constant
      buffer[i + 3] = 255; // A opaque
    }
  }
  return buffer;
}

//==============================================================================
// Audio Buffer Generators
//==============================================================================

/**
 * Creates a Float32Array with a sine wave
 */
export function createSineWaveF32(
  sampleRate: number,
  frequency: number,
  duration: number,
  channels: number = 1
): Float32Array {
  const numFrames = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numFrames * channels);

  for (let frame = 0; frame < numFrames; frame++) {
    const sample = Math.sin((2 * Math.PI * frequency * frame) / sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      buffer[frame * channels + ch] = sample;
    }
  }

  return buffer;
}

/**
 * Creates a silent audio buffer
 */
export function createSilenceF32(numFrames: number, channels: number = 1): Float32Array {
  return new Float32Array(numFrames * channels);
}

//==============================================================================
// Test File Paths
//==============================================================================

export const fixtures = {
  smallBuckBunny: path.join(__dirname, 'small_buck_bunny.mp4'),
};

//==============================================================================
// Encoder/Decoder Helpers
//==============================================================================

/**
 * Creates encoder callbacks that collect chunks and errors
 */
export function createEncoderCallbacks<T>() {
  const chunks: Array<{ chunk: T; metadata?: unknown }> = [];
  const errors: Error[] = [];

  return {
    chunks,
    errors,
    output: (chunk: T, metadata?: unknown) => {
      chunks.push({ chunk, metadata });
    },
    error: (err: Error) => {
      errors.push(err);
    },
  };
}

/**
 * Creates decoder callbacks that collect frames and errors
 */
export function createDecoderCallbacks<T>() {
  const frames: T[] = [];
  const errors: Error[] = [];

  return {
    frames,
    errors,
    output: (frame: T) => {
      frames.push(frame);
    },
    error: (err: Error) => {
      errors.push(err);
    },
  };
}

//==============================================================================
// Frame Timing Utilities
//==============================================================================

/**
 * Generates timestamps for a sequence of frames at a given framerate
 */
export function* frameTimestamps(
  framerate: number,
  count: number = Infinity
): Generator<number> {
  const frameDuration = Math.floor(1_000_000 / framerate); // microseconds
  for (let i = 0; i < count; i++) {
    yield i * frameDuration;
  }
}

/**
 * Common frame durations in microseconds
 */
export const frameDurations = {
  fps24: 41667, // 24fps
  fps25: 40000, // 25fps
  fps30: 33333, // 30fps (29.97 rounded)
  fps50: 20000, // 50fps
  fps60: 16667, // 60fps (59.94 rounded)
} as const;
