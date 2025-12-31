/**
 * Contract Test Helpers
 *
 * Shared utilities for W3C WebCodecs contract tests. These helpers provide
 * consistent factory functions and test configurations across all contract
 * test suites.
 *
 * USAGE:
 *   const { TEST_CONFIG, createTestFrame, createEncoder, assert } = require('../helpers');
 */

const {
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
} = require('../../dist');
const assert = require('node:assert');

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
function createTestFrame(width = 320, height = 240, timestamp = 0) {
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
function createVideoEncoder(onOutput = () => {}, onError = () => {}) {
  return new VideoEncoder({output: onOutput, error: onError});
}

/**
 * Creates a VideoDecoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {VideoDecoder} A new VideoDecoder instance
 */
function createVideoDecoder(onOutput = () => {}, onError = () => {}) {
  return new VideoDecoder({output: onOutput, error: onError});
}

/**
 * Creates an AudioEncoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {AudioEncoder} A new AudioEncoder instance
 */
function createAudioEncoder(onOutput = () => {}, onError = () => {}) {
  return new AudioEncoder({output: onOutput, error: onError});
}

/**
 * Creates an AudioDecoder with default no-op callbacks.
 *
 * @param {Function} onOutput - Output callback (default: no-op)
 * @param {Function} onError - Error callback (default: no-op)
 * @returns {AudioDecoder} A new AudioDecoder instance
 */
function createAudioDecoder(onOutput = () => {}, onError = () => {}) {
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
) {
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
function createTestEncodedVideoChunk(type = 'key', timestamp = 0, dataSize = 64) {
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
function createTestEncodedAudioChunk(type = 'key', timestamp = 0, dataSize = 64) {
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
async function runTests(suiteName, tests) {
  console.log(`Contract: ${suiteName}\n`);
  let passed = 0;
  let failed = 0;

  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

module.exports = {
  // Configuration
  TEST_CONFIG,

  // Assertions
  assert,

  // VideoFrame/AudioData factories
  createTestFrame,
  createTestAudioData,

  // Encoder factories
  createVideoEncoder,
  createAudioEncoder,

  // Decoder factories
  createVideoDecoder,
  createAudioDecoder,

  // Encoded chunk factories
  createTestEncodedVideoChunk,
  createTestEncodedAudioChunk,

  // Test runner
  runTests,

  // Re-export WebCodecs classes for convenience
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
};
