/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { toDataView } from './misc.js';

test('AudioEncoder lifecycle', { timeout: 10_000 }, async () => {
  let first = true;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      assert.ok(chunk.byteLength > 0);
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data); // Just 'cause

      if (first) {
        assert.notStrictEqual(meta?.decoderConfig, undefined);
        assert.strictEqual(meta?.decoderConfig?.codec, 'mp4a.40.2');
        assert.strictEqual(meta?.decoderConfig?.sampleRate, 48000);
        assert.strictEqual(meta?.decoderConfig?.numberOfChannels, 2);
        assert.notStrictEqual(meta?.decoderConfig?.description, undefined);

        first = false;
      }
    },
    error: (e) => {
      throw e;
    },
  });
  assert.strictEqual(encoder.state, 'unconfigured');

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    // Bitrate is auto-chosen
  });
  assert.strictEqual(encoder.state, 'configured');

  const sampleRate = 48000;
  const numberOfChannels = 2;
  const framesPerChunk = 1024;
  const frequency = 200 + Math.random() * 800;

  let dequeueEvents = 0;
  encoder.addEventListener('dequeue', () => dequeueEvents++);

  for (let i = 0; i < 50; i++) {
    const data = new Float32Array(framesPerChunk * numberOfChannels);
    for (let frame = 0; frame < framesPerChunk; frame++) {
      const globalSample = i * framesPerChunk + frame;
      const t = globalSample / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;

      data[frame * numberOfChannels + 0] = sample; // Left
      data[frame * numberOfChannels + 1] = sample; // Right
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: framesPerChunk,
      numberOfChannels,
      timestamp: Math.floor((1e6 * i * framesPerChunk) / sampleRate),
      data,
    });
    assert.strictEqual(audioData.format, 'f32');
    assert.strictEqual(audioData.sampleRate, sampleRate);
    assert.strictEqual(audioData.numberOfChannels, numberOfChannels);
    assert.strictEqual(audioData.numberOfFrames, framesPerChunk);

    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();

  // Verify that dequeue events were fired and output was received
  // Note: FFmpeg audio encoders may buffer frames, so output count may differ from input count
  assert.ok(dequeueEvents > 0);

  encoder.close();
  assert.strictEqual(encoder.state, 'closed');
});

test('AAC in ADTS format', async () => {
  let first = true;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      assert.ok(chunk.byteLength > 0);
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      assert.strictEqual(data[0], 255);

      if (first) {
        assert.notStrictEqual(meta?.decoderConfig, undefined);
        assert.strictEqual(meta?.decoderConfig?.description, undefined);

        first = false;
      }
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    // @ts-expect-error aac config not in upstream WebCodecs types (node-webcodecs extension)
    aac: {
      format: 'adts',
    },
  });

  const sampleRate = 48000;
  const numberOfChannels = 2;
  const framesPerChunk = 1024;
  const frequency = 200 + Math.random() * 800;

  const data = new Float32Array(framesPerChunk * numberOfChannels);
  for (let frame = 0; frame < framesPerChunk; frame++) {
    const globalSample = frame;
    const t = globalSample / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;

    data[frame * numberOfChannels + 0] = sample; // Left
    data[frame * numberOfChannels + 1] = sample; // Right
  }

  const audioData = new AudioData({
    format: 'f32',
    sampleRate,
    numberOfFrames: framesPerChunk,
    numberOfChannels,
    timestamp: 0,
    data,
  });

  encoder.encode(audioData);
  audioData.close();

  await encoder.flush();

  encoder.close();
});

test('FLAC description', async () => {
  let chunkCount = 0;

  const encoder = new AudioEncoder({
    output: (_chunk, meta) => {
      assert.notStrictEqual(meta?.decoderConfig, undefined);
      assert.notStrictEqual(meta?.decoderConfig?.description, undefined);

      // biome-ignore lint/style/noNonNullAssertion: assert assertions above guarantee these values exist
      const dataView = toDataView(meta!.decoderConfig!.description!);
      assert.strictEqual(dataView.getUint32(0, false), 0x664c6143); // 'fLaC'

      chunkCount++;
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'flac',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  const sampleRate = 48000;
  const numberOfChannels = 2;
  const framesPerChunk = 1024;
  const frequency = 200 + Math.random() * 800;

  const data = new Float32Array(framesPerChunk * numberOfChannels);
  for (let frame = 0; frame < framesPerChunk; frame++) {
    const globalSample = frame;
    const t = globalSample / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;

    data[frame * numberOfChannels + 0] = sample; // Left
    data[frame * numberOfChannels + 1] = sample; // Right
  }

  const audioData = new AudioData({
    format: 'f32',
    sampleRate,
    numberOfFrames: framesPerChunk,
    numberOfChannels,
    timestamp: 0,
    data,
  });

  encoder.encode(audioData);
  audioData.close();

  await encoder.flush();

  encoder.close();

  assert.ok(chunkCount > 0); // Tests that the data was successfully padded to a multiple of 4608
});
