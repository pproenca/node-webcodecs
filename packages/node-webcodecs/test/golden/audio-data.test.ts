/**
 * Tests for AudioData W3C compliance - specifically planeIndex validation
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AudioDataCopyToOptions } from '../../lib/types';

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
    assert.throws(() => {
      audioData.allocationSize({} as AudioDataCopyToOptions);
    }, TypeError);

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

    const size = audioData.allocationSize({ planeIndex: 0 });
    assert.ok(size > 0);

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
    // copyTo returns void per W3C spec
    assert.throws(() => audioData.copyTo(destination, {} as AudioDataCopyToOptions), TypeError);

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

    const destination = new ArrayBuffer(1024 * 2 * 4);
    // Should not throw with valid planeIndex
    // copyTo returns void per W3C spec
    const result = audioData.copyTo(destination, { planeIndex: 0 });
    assert.strictEqual(result, undefined);

    audioData.close();
  });
});
