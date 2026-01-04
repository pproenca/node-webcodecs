/**
 * Contract Test Helpers
 *
 * Shared utilities for W3C WebCodecs contract tests. These helpers provide
 * consistent factory functions and test configurations across all contract
 * test suites.
 *
 * USAGE:
 *   import {TEST_CONFIG, createTestFrame, createVideoEncoder, assert} from '../helpers';
 */

import {
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
} from '@pproenca/node-webcodecs';
import * as assert from 'node:assert';

type VideoChunkOutputCallback = (chunk: EncodedVideoChunk) => void;
type VideoFrameOutputCallback = (frame: VideoFrame) => void;
type AudioChunkOutputCallback = (chunk: EncodedAudioChunk) => void;
type AudioDataOutputCallback = (data: AudioData) => void;
type ErrorCallback = (error: unknown) => void;

interface TestCase {
  readonly name: string;
  readonly fn: () => void | Promise<void>;
}

/**
 * Standard test configurations for consistent test data across suites.
 */
const TEST_CONFIG = {
  SMALL_FRAME: {width: 64, height: 64},
  MEDIUM_FRAME: {width: 320, height: 240},
  RGBA_BPP: 4, // Bytes per pixel for RGBA format
  VIDEO_CODEC: 'avc1.42001E',
  AUDIO_CODEC: 'mp4a.40.2',
  SAMPLE_RATE: 48000,
  CHANNELS: 2,
  AUDIO_BITRATE: 128000,
  VIDEO_BITRATE: 1000000,
};

/**
 * Creates a VideoFrame for testing with the specified dimensions.
 * Uses RGBA format for simplicity (4 bytes per pixel).
 *
 * @param {number} width - Frame width (default: 320)
 * @param {number} height - Frame height (default: 240)
 * @param {number} timestamp - Frame timestamp in microseconds (default: 0)
 * @returns {VideoFrame} A new VideoFrame instance
 */
function createTestFrame(width = 320, height = 240, timestamp = 0): VideoFrame {
  const data = new Uint8Array(width * height * TEST_CONFIG.RGBA_BPP);
  return new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp: timestamp,
  });
}

/**
 * Creates a VideoEncoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {VideoEncoder} A new VideoEncoder instance
 */
function createVideoEncoder(
  onOutput: VideoChunkOutputCallback = () => {},
  onError: ErrorCallback = () => {},
): VideoEncoder {
  return new VideoEncoder({output: onOutput, error: onError});
}

/**
 * Creates a VideoDecoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {VideoDecoder} A new VideoDecoder instance
 */
function createVideoDecoder(
  onOutput: VideoFrameOutputCallback = () => {},
  onError: ErrorCallback = () => {},
): VideoDecoder {
  return new VideoDecoder({output: onOutput, error: onError});
}

/**
 * Creates an AudioEncoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {AudioEncoder} A new AudioEncoder instance
 */
function createAudioEncoder(
  onOutput: AudioChunkOutputCallback = () => {},
  onError: ErrorCallback = () => {},
): AudioEncoder {
  return new AudioEncoder({output: onOutput, error: onError});
}

/**
 * Creates an AudioDecoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {AudioDecoder} A new AudioDecoder instance
 */
function createAudioDecoder(
  onOutput: AudioDataOutputCallback = () => {},
  onError: ErrorCallback = () => {},
): AudioDecoder {
  return new AudioDecoder({output: onOutput, error: onError});
}

/**
 * Creates AudioData for testing with the specified parameters.
 *
 * @param {number} numberOfFrames - Number of audio frames (default: 1024)
 * @param {number} numberOfChannels - Number of channels (default: 2)
 * @param {number} sampleRate - Sample rate in Hz (default: 48000)
 * @param {number} timestamp - Timestamp in microseconds (default: 0)
 * @returns {AudioData} A new AudioData instance
 */
function createTestAudioData(
  numberOfFrames = 1024,
  numberOfChannels = 2,
  sampleRate = 48000,
  timestamp = 0,
): AudioData {
  const data = new Float32Array(numberOfFrames * numberOfChannels);
  return new AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: numberOfFrames,
    numberOfChannels: numberOfChannels,
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Creates an EncodedVideoChunk for testing (minimal data, not valid H.264).
 *
 * @param {string} type - Chunk type: 'key' or 'delta' (default: 'key')
 * @param {number} timestamp - Timestamp in microseconds (default: 0)
 * @param {number} dataSize - Size of the data buffer (default: 64)
 * @returns {EncodedVideoChunk} A new EncodedVideoChunk instance
 */
function createTestEncodedVideoChunk(
  type = 'key',
  timestamp = 0,
  dataSize = 64,
): EncodedVideoChunk {
  const data = Buffer.alloc(dataSize);
  return new EncodedVideoChunk({
    type: type,
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Creates an EncodedAudioChunk for testing (minimal data, not valid AAC).
 *
 * @param {string} type - Chunk type: 'key' or 'delta' (default: 'key')
 * @param {number} timestamp - Timestamp in microseconds (default: 0)
 * @param {number} dataSize - Size of the data buffer (default: 64)
 * @returns {EncodedAudioChunk} A new EncodedAudioChunk instance
 */
function createTestEncodedAudioChunk(
  type = 'key',
  timestamp = 0,
  dataSize = 64,
): EncodedAudioChunk {
  const data = Buffer.alloc(dataSize);
  return new EncodedAudioChunk({
    type: type,
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Simple test runner for contract tests.
 * Runs all registered tests and reports results.
 *
 * @param {string} suiteName - Name of the test suite for display
 * @param {Array<{name: string, fn: Function}>} tests - Array of test objects
 * @returns {Promise<void>}
 */
async function runTests(suiteName: string, tests: TestCase[]): Promise<void> {
  console.log(`Contract: ${suiteName}\n`);
  let passed = 0;
  let failed = 0;

  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  [FAIL] ${name}: ${message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

/**
 * Captures errors delivered via the error callback for async error testing.
 * Used for testing NotSupportedError, EncodingError, DataError which are
 * delivered via callback per W3C spec.
 *
 * @param {Function} codecFactory - Factory function (e.g., createVideoEncoder)
 * @param {Function} operation - Operation to perform on the codec
 * @param {Object} config - Optional config to apply before operation
 * @param {number} timeout - Timeout in ms to wait for callback (default: 500)
 * @returns {Promise<Error|null>} Error from callback, or null if no error
 */
async function captureCallbackError(
  codecFactory: (output: () => void, error: ErrorCallback) => {
    configure: (config: unknown) => void;
    close: () => void;
  },
  operation: (codec: unknown) => void,
  config: unknown = null,
  timeout = 500,
): Promise<Error | null> {
  return new Promise(resolve => {
    let errorReceived: Error | null = null;
    const codec = codecFactory(
      () => {}, // output callback
      error => {
        if (error instanceof Error) {
          errorReceived = error;
        } else {
          errorReceived = new Error(String(error));
        }
      },
    );

    try {
      if (config) {\n        codec.configure(config);\n      }
      operation(codec);
    } catch {
      // Sync errors are NOT what we're testing - ignore
    }

    // Wait for async callback to fire
    setTimeout(() => {
      try {\n        codec.close();\n      } catch {\n        // Best-effort cleanup.\n      }
      resolve(errorReceived);
    }, timeout);
  });
}

/**
 * Creates an EncodedVideoChunk with corrupted H.264 data.
 * Used to trigger EncodingError via error callback.
 *
 * @param {string} type - Chunk type: 'key' or 'delta' (default: 'key')
 * @param {number} timestamp - Timestamp in microseconds (default: 0)
 * @returns {EncodedVideoChunk} Chunk with invalid NAL unit data
 */
function createCorruptedH264Chunk(type = 'key', timestamp = 0): EncodedVideoChunk {
  // Invalid NAL unit header (forbidden_zero_bit set + garbage)
  const data = Buffer.from([0x80, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x01, 0xFF]);
  return new EncodedVideoChunk({
    type: type,
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Creates an EncodedVideoChunk that's too small to be valid.
 * Used to trigger EncodingError via error callback.
 *
 * @param {string} type - Chunk type: 'key' or 'delta' (default: 'key')
 * @param {number} timestamp - Timestamp in microseconds (default: 0)
 * @returns {EncodedVideoChunk} Chunk with insufficient data
 */
function createTruncatedChunk(type = 'key', timestamp = 0): EncodedVideoChunk {
  // Single byte is definitely not a valid frame
  const data = Buffer.from([0x00]);
  return new EncodedVideoChunk({
    type: type,
    timestamp: timestamp,
    data: data,
  });
}

/**
 * Asserts that an error has the expected name.
 * Works for both DOMException and regular Error types.
 *
 * @param {Error} error - The error to check
 * @param {string} expectedName - Expected error name (e.g., 'InvalidStateError')
 */
function assertErrorName(error: Error, expectedName: string): void {
  assert.ok(error, `Expected error with name "${expectedName}" but got null`);
  assert.strictEqual(error.name, expectedName,
    `Expected error name "${expectedName}" but got "${error.name}"`);
}

export {
  AudioData,
  AudioDecoder,
  AudioEncoder,
  EncodedAudioChunk,
  EncodedVideoChunk,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
  assert,
  assertErrorName,
  captureCallbackError,
  createAudioDecoder,
  createAudioEncoder,
  createCorruptedH264Chunk,
  createTestAudioData,
  createTestEncodedAudioChunk,
  createTestEncodedVideoChunk,
  createTestFrame,
  createTruncatedChunk,
  createVideoDecoder,
  createVideoEncoder,
  runTests,
  TEST_CONFIG,
};
