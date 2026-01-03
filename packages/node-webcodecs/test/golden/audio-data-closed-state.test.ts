import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('AudioData closed state per W3C spec', () => {
  it('should return null for format when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();

    // W3C spec: format returns null when [[Detached]] is true
    assert.strictEqual(audioData.format, null);
  });

  it('should return 0 for sampleRate when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    assert.strictEqual(audioData.sampleRate, 0);
  });

  it('should return 0 for numberOfFrames when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    assert.strictEqual(audioData.numberOfFrames, 0);
  });

  it('should return 0 for numberOfChannels when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    assert.strictEqual(audioData.numberOfChannels, 0);
  });

  it('should return 0 for duration when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    assert.strictEqual(audioData.duration, 0);
  });

  it('should return 0 for timestamp when closed', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 5000,
      data: new Float32Array(1024 * 2),
    });

    audioData.close();
    assert.strictEqual(audioData.timestamp, 0);
  });
});
