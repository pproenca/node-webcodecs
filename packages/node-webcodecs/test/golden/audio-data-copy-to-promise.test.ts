import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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
    const result = audioData.copyTo(destination, { planeIndex: 0 });

    // W3C spec: copyTo returns undefined (void)
    assert.strictEqual(result, undefined);

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

    assert.throws(() => {
      audioData.copyTo(destination, { planeIndex: 0 });
    }, DOMException);
    try {
      audioData.copyTo(destination, { planeIndex: 0 });
    } catch (e) {
      assert.strictEqual((e as DOMException).name, 'InvalidStateError');
    }
  });
});
