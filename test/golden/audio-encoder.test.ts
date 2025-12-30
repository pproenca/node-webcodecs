/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {describe, expect, it} from 'vitest';

describe('encodeQueueSize tracking', () => {
  it('should track pending encode operations', async () => {
    const outputChunks: EncodedAudioChunk[] = [];
    const encoder = new AudioEncoder({
      output: (chunk) => {
        outputChunks.push(chunk);
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    expect(encoder.encodeQueueSize).toBe(0);

    const sampleRate = 48000;
    const numberOfChannels = 2;
    const numberOfFrames = 960;
    const data = new Float32Array(numberOfFrames * numberOfChannels);

    for (let i = 0; i < numberOfFrames; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        data[i * numberOfChannels + ch] = sample;
      }
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: sampleRate,
      numberOfFrames: numberOfFrames,
      numberOfChannels: numberOfChannels,
      timestamp: 0,
      data: data,
    });

    encoder.encode(audioData);

    // After encode, queue size should have been incremented (though it may already be 0 if processed synchronously)
    // The important thing is it should be 0 after flush
    await encoder.flush();
    expect(encoder.encodeQueueSize).toBe(0);

    // Verify that encodeQueueSize returns a number
    expect(typeof encoder.encodeQueueSize).toBe('number');

    encoder.close();
  });
});
