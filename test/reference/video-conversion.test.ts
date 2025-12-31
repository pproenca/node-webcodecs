/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  ALL_FORMATS,
  BufferSource,
  BufferTarget,
  Conversion,
  FilePathSource,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
} from 'mediabunny';
import { expect, test } from 'vitest';

const filePath = './test/fixtures/small_buck_bunny.mp4';

// These conversion tests are powerful as they test large parts of the whole pipeline:
// EncodedVideoChunk -> VideoDecoder -> VideoFrame -> VideoEncoder -> EncodedVideoChunk -> VideoDecoder -> VideoFrame

async function runConversionTest(codec: string) {
  using input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      forceTranscode: true,
      codec,
    },
    audio: {
      discard: true,
    },
    trim: {
      start: 0,
      end: 5,
    },
  });
  await conversion.execute();

  const buffer = output.target.buffer;
  expect(buffer).toBeDefined();
  if (!buffer) {
    throw new Error('Buffer should be defined after conversion');
  }

  using newInput = new Input({
    source: new BufferSource(buffer),
    formats: ALL_FORMATS,
  });

  const videoTrack = await newInput.getPrimaryVideoTrack();
  expect(videoTrack).toBeDefined();
  if (!videoTrack) {
    throw new Error('Video track should be defined for valid video input');
  }

  const sink = new VideoSampleSink(videoTrack);

  for await (using sample of sink.samples(0, 1)) {
    expect(sample.displayWidth).toBe(1920);
    expect(sample.displayHeight).toBe(1080);
  }
}

test('Conversion: encode and decode AVC', { timeout: 10_000 }, async () => {
  await runConversionTest('avc');
});

test('Conversion: encode and decode HEVC', { timeout: 10_000 }, async () => {
  await runConversionTest('hevc');
});

test('Conversion: encode and decode VP8', { timeout: 10_000 }, async () => {
  await runConversionTest('vp8');
});

test('Conversion: encode and decode VP9', { timeout: 10_000 }, async () => {
  await runConversionTest('vp9');
});

test('Conversion: encode and decode AV1', { timeout: 10_000 }, async () => {
  await runConversionTest('av1');
});
