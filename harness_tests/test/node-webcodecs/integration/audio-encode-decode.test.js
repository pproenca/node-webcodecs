/**
 * Integration tests for AudioEncoder/AudioDecoder
 */

import {beforeAll, expect, it, describe} from 'vitest';
import {polyfillWebCodecsApi} from '../../../src/polyfill.js';

beforeAll(async () => {
  await polyfillWebCodecsApi();
});

it('AudioEncoderAAC', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'mp4a.40.2', // AAC-LC
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  // Create stereo audio data (1024 samples at 48kHz = ~21ms)
  const numSamples = 1024;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 440Hz sine wave
  const frequency = 440;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 48000;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;
    audioData[i * numChannels] = sample; // Left channel
    audioData[i * numChannels + 1] = sample; // Right channel
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('AudioEncoderOpus', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  });

  // Create stereo audio data (960 samples = 20ms at 48kHz, Opus frame size)
  const numSamples = 960;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 880Hz sine wave
  const frequency = 880;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 48000;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;
    audioData[i * numChannels] = sample;
    audioData[i * numChannels + 1] = sample;
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('AudioEncoderFLAC', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'flac',
    sampleRate: 44100,
    numberOfChannels: 2,
  });

  // Create audio data
  const numSamples = 4096;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 220Hz sine wave
  const frequency = 220;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 44100;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.4;
    audioData[i * numChannels] = sample;
    audioData[i * numChannels + 1] = sample;
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 44100,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();
  encoder.close();

  return chunks;
});

it('MultipleAudioFrames', {timeout: 10_000}, async () => {
  const chunks = [];
  const encoder = new AudioEncoder({
    output: chunk => chunks.push(chunk),
    error: err => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  const numSamples = 1024;
  const numChannels = 2;
  const frameDuration = Math.round((numSamples / 48000) * 1000000); // microseconds

  for (let frameIdx = 0; frameIdx < 10; frameIdx++) {
    const audioData = new Float32Array(numSamples * numChannels);

    // Generate varying frequency tone
    const frequency = 440 + frameIdx * 50;
    for (let i = 0; i < numSamples; i++) {
      const t = i / 48000;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;
      audioData[i * numChannels] = sample;
      audioData[i * numChannels + 1] = sample;
    }

    const frame = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numSamples,
      numberOfChannels: numChannels,
      timestamp: frameIdx * frameDuration,
      data: audioData,
    });

    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();
});
