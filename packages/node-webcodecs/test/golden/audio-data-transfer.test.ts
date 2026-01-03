import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('AudioData ArrayBuffer transfer semantics', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const arrayBuffer = new ArrayBuffer(1024 * 2 * 4);
    const data = new Float32Array(arrayBuffer);
    data.fill(0.5);

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: data,
      transfer: [arrayBuffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    assert.strictEqual(arrayBuffer.byteLength, 0);

    // AudioData should still be usable
    assert.strictEqual(audioData.numberOfFrames, 1024);

    audioData.close();
  });

  it('should work normally when transfer is not specified', () => {
    const arrayBuffer = new ArrayBuffer(1024 * 2 * 4);
    const data = new Float32Array(arrayBuffer);
    data.fill(0.5);

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: data,
    });

    // ArrayBuffer should NOT be detached
    assert.strictEqual(arrayBuffer.byteLength, 1024 * 2 * 4);

    audioData.close();
  });
});
