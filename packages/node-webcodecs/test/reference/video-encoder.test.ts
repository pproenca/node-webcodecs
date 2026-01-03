/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as assert from 'node:assert/strict';
import { test } from 'node:test';

test('VideoEncoder lifecycle', { timeout: 60_000 }, async () => {
  // Collect results to verify after flush (avoids throwing from NAPI callbacks)
  const outputChunks: Array<{ byteLength: number; firstBytes: number }> = [];
  let firstMeta: EncodedVideoChunkMetadata | undefined;
  let error: Error | undefined;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        const data = new DataView(new ArrayBuffer(chunk.byteLength));
        chunk.copyTo(data);
        outputChunks.push({
          byteLength: chunk.byteLength,
          firstBytes: data.getUint32(0, false),
        });
        if (outputChunks.length === 1) {
          firstMeta = meta;
        }
      } catch (e) {
        error = e as Error;
      }
    },
    error: (e) => {
      error = e;
    },
  });
  assert.strictEqual(encoder.state, 'unconfigured');

  encoder.configure({
    codec: 'avc1.42001f',
    width: 1280,
    height: 720,
    // Bitrate is auto-chosen
  });
  assert.strictEqual(encoder.state, 'configured');

  let dequeueEvents = 0;
  encoder.addEventListener('dequeue', () => dequeueEvents++);

  for (let i = 0; i < 50; i++) {
    const data = new Uint8Array(1280 * 720 * 4);
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 1280,
      codedHeight: 720,
      timestamp: Math.floor((1e6 * i) / 25),
      duration: Math.floor(1e6 / 25),
    });
    assert.strictEqual(frame.format, 'RGBA');
    assert.strictEqual(frame.displayWidth, 1280);
    assert.strictEqual(frame.displayHeight, 720);

    // sRGB
    assert.strictEqual(frame.colorSpace.primaries, 'bt709');
    assert.strictEqual(frame.colorSpace.transfer, 'iec61966-2-1');
    assert.strictEqual(frame.colorSpace.matrix, 'rgb');
    assert.strictEqual(frame.colorSpace.fullRange, true);

    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();

  // Now verify collected results
  if (error) throw error;

  assert.ok(outputChunks.length > 0);
  assert.ok(dequeueEvents > 0);

  // Verify first chunk has valid data
  assert.ok(outputChunks[0].byteLength > 0);
  // Note: Default format may be Annex B or AVCC depending on implementation

  // Verify first chunk metadata (decoderConfig on first keyframe)
  assert.notStrictEqual(firstMeta?.decoderConfig, undefined);
  assert.strictEqual(firstMeta?.decoderConfig?.codec?.startsWith('avc1.'), true);
  assert.strictEqual(firstMeta?.decoderConfig?.codedWidth, 1280);
  assert.strictEqual(firstMeta?.decoderConfig?.codedHeight, 720);
  assert.notStrictEqual(firstMeta?.decoderConfig?.description, undefined);

  encoder.close();
  assert.strictEqual(encoder.state, 'closed');
});

test('AVC & Annex B', async () => {
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new DataView(new ArrayBuffer(chunk.byteLength));
      chunk.copyTo(data);
      assert.strictEqual(data.getUint32(0, false), 1); // Ensure Annex B

      assert.notStrictEqual(meta?.decoderConfig, undefined);
      assert.strictEqual(meta?.decoderConfig?.description, undefined);
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001f',
    width: 1280,
    height: 720,
    avc: {
      format: 'annexb',
    },
  });

  const data = new Uint8Array(1280 * 720 * 4);
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: 1280,
    codedHeight: 720,
    timestamp: 0,
    duration: Math.floor(1e6 / 25),
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();

  encoder.close();
});

test('HEVC & Annex B', async () => {
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new DataView(new ArrayBuffer(chunk.byteLength));
      chunk.copyTo(data);
      assert.strictEqual(data.getUint32(0, false), 1); // Ensure Annex B

      assert.notStrictEqual(meta?.decoderConfig, undefined);
      assert.strictEqual(meta?.decoderConfig?.description, undefined);
    },
    error: (e) => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'hev1.1.L0.0',
    width: 1280,
    height: 720,
    // @ts-expect-error hevc config not in upstream WebCodecs types (node-webcodecs extension)
    hevc: {
      format: 'annexb',
    },
  });

  const data = new Uint8Array(1280 * 720 * 4);
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: 1280,
    codedHeight: 720,
    timestamp: 0,
    duration: Math.floor(1e6 / 25),
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();

  encoder.close();
});
