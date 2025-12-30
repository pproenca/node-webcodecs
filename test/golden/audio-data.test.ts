/**
 * Tests for AudioData W3C compliance - specifically planeIndex validation
 */

import {describe, it, expect} from 'vitest';
import {AudioDataCopyToOptions} from '../../lib/types';

describe('AudioData.allocationSize() W3C compliance', () => {
  it('should require planeIndex option per W3C spec', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    // W3C spec: planeIndex is required in AudioDataCopyToOptions
    expect(() => {
      audioData.allocationSize({} as AudioDataCopyToOptions);
    }).toThrow(TypeError);

    audioData.close();
  });

  it('should accept valid planeIndex', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const size = audioData.allocationSize({planeIndex: 0});
    expect(size).toBeGreaterThan(0);

    audioData.close();
  });
});

describe('AudioData.copyTo() W3C compliance', () => {
  it('should require planeIndex option per W3C spec', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const destination = new ArrayBuffer(1024 * 2 * 4);

    // W3C spec: planeIndex is required in AudioDataCopyToOptions
    // copyTo now returns a Promise per W3C spec
    await expect(
      audioData.copyTo(destination, {} as AudioDataCopyToOptions)
    ).rejects.toThrow(TypeError);

    audioData.close();
  });

  it('should accept valid planeIndex', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const destination = new ArrayBuffer(1024 * 2 * 4);
    // Should not throw with valid planeIndex
    // copyTo now returns a Promise per W3C spec
    await expect(
      audioData.copyTo(destination, {planeIndex: 0})
    ).resolves.toBeUndefined();

    audioData.close();
  });
});
