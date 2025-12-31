import { describe, expect, it } from 'vitest';

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
    expect(audioData.format).toBeNull();
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
    expect(audioData.sampleRate).toBe(0);
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
    expect(audioData.numberOfFrames).toBe(0);
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
    expect(audioData.numberOfChannels).toBe(0);
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
    expect(audioData.duration).toBe(0);
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
    expect(audioData.timestamp).toBe(0);
  });
});
