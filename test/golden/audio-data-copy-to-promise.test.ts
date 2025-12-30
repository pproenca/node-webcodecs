import {describe, it, expect} from 'vitest';

describe('AudioData.copyTo() returns void per W3C spec', () => {
  it('should return undefined (void)', () => {
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

    // W3C spec: copyTo returns undefined (void)
    expect(result).toBeUndefined();

    audioData.close();
  });

  it('should throw DOMException with InvalidStateError when closed', () => {
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

    expect(() => audioData.copyTo(destination, {planeIndex: 0})).toThrow(
      DOMException,
    );
    try {
      audioData.copyTo(destination, {planeIndex: 0});
    } catch (e) {
      expect((e as DOMException).name).toBe('InvalidStateError');
    }
  });
});
