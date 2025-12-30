import {describe, it, expect} from 'vitest';

describe('AudioData.copyTo() returns Promise per W3C spec', () => {
  it('should return a Promise that resolves to undefined', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const destination = new ArrayBuffer(1024 * 2 * 4);
    const result = audioData.copyTo(destination, {planeIndex: 0});

    // W3C spec: copyTo returns Promise<undefined>
    expect(result).toBeInstanceOf(Promise);

    const resolved = await result;
    expect(resolved).toBeUndefined();

    audioData.close();
  });

  it('should reject with InvalidStateError when closed', async () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });
    audioData.close();

    const destination = new ArrayBuffer(1024 * 2 * 4);

    await expect(
      audioData.copyTo(destination, {planeIndex: 0})
    ).rejects.toThrow('InvalidStateError');
  });
});
