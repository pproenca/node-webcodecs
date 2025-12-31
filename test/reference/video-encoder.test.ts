/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from 'vitest';

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
  expect(encoder.state).toBe('unconfigured');

  encoder.configure({
    codec: 'avc1.42001f',
    width: 1280,
    height: 720,
    // Bitrate is auto-chosen
  });
  expect(encoder.state).toBe('configured');

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
    expect(frame.format).toBe('RGBA');
    expect(frame.displayWidth).toBe(1280);
    expect(frame.displayHeight).toBe(720);

    // sRGB
    expect(frame.colorSpace.primaries).toBe('bt709');
    expect(frame.colorSpace.transfer).toBe('iec61966-2-1');
    expect(frame.colorSpace.matrix).toBe('rgb');
    expect(frame.colorSpace.fullRange).toBe(true);

    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();

  // Now verify collected results
  if (error) throw error;

  expect(outputChunks.length).toBeGreaterThan(0);
  expect(dequeueEvents).toBeGreaterThan(0);

  // Verify first chunk has valid data
  expect(outputChunks[0].byteLength).toBeGreaterThan(0);
  // Note: Default format may be Annex B or AVCC depending on implementation

  // Verify first chunk metadata (decoderConfig on first keyframe)
  expect(firstMeta?.decoderConfig).not.toBeUndefined();
  expect(firstMeta?.decoderConfig?.codec?.startsWith('avc1.')).toBe(true);
  expect(firstMeta?.decoderConfig?.codedWidth).toBe(1280);
  expect(firstMeta?.decoderConfig?.codedHeight).toBe(720);
  expect(firstMeta?.decoderConfig?.description).not.toBeUndefined();

  encoder.close();
  expect(encoder.state).toBe('closed');
});

test('AVC & Annex B', async () => {
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new DataView(new ArrayBuffer(chunk.byteLength));
      chunk.copyTo(data);
      expect(data.getUint32(0, false)).toBe(1); // Ensure Annex B

      expect(meta?.decoderConfig).not.toBeUndefined();
      expect(meta?.decoderConfig?.description).toBeUndefined();
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
      expect(data.getUint32(0, false)).toBe(1); // Ensure Annex B

      expect(meta?.decoderConfig).not.toBeUndefined();
      expect(meta?.decoderConfig?.description).toBeUndefined();
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
