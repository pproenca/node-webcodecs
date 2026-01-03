/**
 * RAII-style test helpers for automatic resource cleanup.
 *
 * These helpers ensure that codecs and media data are properly closed
 * after tests complete, even when tests throw errors.
 */

import { createRGBABuffer, createEncoderCallbacks, createDecoderCallbacks } from './index';

/**
 * RAII-style wrapper for VideoEncoder.
 * Automatically closes the encoder after the callback completes (success or failure).
 */
export async function withVideoEncoder(
  fn: (encoder: VideoEncoder) => Promise<void>
): Promise<void> {
  const { output, error } = createEncoderCallbacks<EncodedVideoChunk>();
  const encoder = new VideoEncoder({ output, error });
  try {
    await fn(encoder);
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * RAII-style wrapper for VideoDecoder.
 * Automatically closes the decoder after the callback completes.
 */
export async function withVideoDecoder(
  fn: (decoder: VideoDecoder) => Promise<void>
): Promise<void> {
  const { output, error } = createDecoderCallbacks<VideoFrame>();
  const decoder = new VideoDecoder({ output, error });
  try {
    await fn(decoder);
  } finally {
    if (decoder.state !== 'closed') {
      decoder.close();
    }
  }
}

/**
 * RAII-style wrapper for AudioEncoder.
 * Automatically closes the encoder after the callback completes.
 */
export async function withAudioEncoder(
  fn: (encoder: AudioEncoder) => Promise<void>
): Promise<void> {
  const { output, error } = createEncoderCallbacks<EncodedAudioChunk>();
  const encoder = new AudioEncoder({ output, error });
  try {
    await fn(encoder);
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * RAII-style wrapper for AudioDecoder.
 * Automatically closes the decoder after the callback completes.
 */
export async function withAudioDecoder(
  fn: (decoder: AudioDecoder) => Promise<void>
): Promise<void> {
  const { output, error } = createDecoderCallbacks<AudioData>();
  const decoder = new AudioDecoder({ output, error });
  try {
    await fn(decoder);
  } finally {
    if (decoder.state !== 'closed') {
      decoder.close();
    }
  }
}

/**
 * Frame configuration for withVideoFrame helper.
 */
export interface FrameConfig {
  width: number;
  height: number;
  format: 'RGBA' | 'I420' | 'NV12';
  timestamp: number;
  color?: { r: number; g: number; b: number; a: number };
}

/**
 * RAII-style wrapper for VideoFrame.
 * Creates a frame with the specified config and closes it after the callback.
 */
export async function withVideoFrame(
  config: FrameConfig,
  fn: (frame: VideoFrame) => Promise<void>
): Promise<void> {
  const { width, height, format, timestamp, color } = config;
  const buffer = createRGBABuffer(width, height, color ?? { r: 128, g: 128, b: 128, a: 255 });
  const frame = new VideoFrame(buffer, {
    format,
    codedWidth: width,
    codedHeight: height,
    timestamp,
  });
  try {
    await fn(frame);
  } finally {
    frame.close();
  }
}

/**
 * Audio data configuration for withAudioData helper.
 */
export interface AudioConfig {
  sampleRate: number;
  numberOfChannels: number;
  numberOfFrames: number;
  timestamp: number;
}

/**
 * RAII-style wrapper for AudioData.
 * Creates audio data with the specified config and closes it after the callback.
 */
export async function withAudioData(
  config: AudioConfig,
  fn: (data: AudioData) => Promise<void>
): Promise<void> {
  const { sampleRate, numberOfChannels, numberOfFrames, timestamp } = config;
  const data = new AudioData({
    format: 'f32-planar',
    sampleRate,
    numberOfChannels,
    numberOfFrames,
    timestamp,
    data: new Float32Array(numberOfFrames * numberOfChannels),
  });
  try {
    await fn(data);
  } finally {
    data.close();
  }
}

/**
 * Standardized error assertion helper.
 * Ensures consistent error checking pattern across all tests.
 *
 * Usage:
 *   expectDOMException('InvalidStateError', () => decoder.decode(chunk));
 */
export function expectDOMException(
  expectedName: string,
  fn: () => void | Promise<void>
): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error('Use expectDOMExceptionAsync for async functions');
    }
    throw new Error(`Expected ${expectedName} but no error was thrown`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Expected')) {
      throw e; // Re-throw our own error
    }
    if (!(e instanceof DOMException)) {
      throw new Error(`Expected DOMException but got ${e}`);
    }
    if (e.name !== expectedName) {
      throw new Error(`Expected ${expectedName} but got ${e.name}`);
    }
  }
}

/**
 * Async version of expectDOMException.
 */
export async function expectDOMExceptionAsync(
  expectedName: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected ${expectedName} but no error was thrown`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Expected')) {
      throw e; // Re-throw our own error
    }
    if (!(e instanceof DOMException)) {
      throw new Error(`Expected DOMException but got ${e}`);
    }
    if (e.name !== expectedName) {
      throw new Error(`Expected ${expectedName} but got ${e.name}`);
    }
  }
}

/**
 * Well-documented test constants.
 * Use these instead of magic numbers.
 */
export const TEST_CONSTANTS = {
  /** Standard small frame dimensions for quick tests */
  SMALL_FRAME: { width: 64, height: 64 },
  /** Standard medium frame dimensions for codec tests */
  MEDIUM_FRAME: { width: 320, height: 240 },
  /** Bytes per pixel for RGBA format */
  RGBA_BPP: 4,
  /** Bytes per pixel for I420 format (1.5 due to chroma subsampling) */
  I420_BPP: 1.5,
  /** Default test timeout in ms */
  DEFAULT_TIMEOUT: 10000,
  /** Extended timeout for codec operations */
  CODEC_TIMEOUT: 30000,
  /** Frame timestamps at 30fps */
  FPS_30_TIMESTAMP_DELTA: 33333, // microseconds
  /** Memory growth limit for leak tests (MB) */
  MEMORY_LIMIT_MB: 50,
} as const;
