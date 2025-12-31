/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  ALL_FORMATS,
  AudioSampleSink,
  BufferSource,
  BufferTarget,
  Conversion,
  FilePathSource,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';
import { expect, test } from 'vitest';

const filePath = './test/fixtures/small_buck_bunny.mp4';

// These conversion tests are powerful as they test large parts of the whole pipeline:
// EncodedAudioChunk -> AudioDecoder -> AudioData -> AudioEncoder -> EncodedAudioChunk -> AudioDecoder -> AudioData

async function runAudioConversionTest(codec: string) {
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
      discard: true,
    },
    audio: {
      forceTranscode: true,
      codec,
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

  const audioTrack = await newInput.getPrimaryAudioTrack();
  expect(audioTrack).toBeDefined();
  if (!audioTrack) {
    throw new Error('Audio track should be defined for valid audio input');
  }

  const sink = new AudioSampleSink(audioTrack);

  for await (using sample of sink.samples(0, 1)) {
    expect(sample.sampleRate).toBe(48000);
  }
}

test('Conversion: encode and decode AAC', { timeout: 10_000 }, async () => {
  await runAudioConversionTest('aac');
});

test('Conversion: encode and decode Opus', { timeout: 60_000 }, async () => {
  await runAudioConversionTest('opus');
});

test('Conversion: encode and decode Vorbis', { timeout: 60_000 }, async () => {
  await runAudioConversionTest('vorbis');
});

test('Conversion: encode and decode FLAC', { timeout: 60_000 }, async () => {
  await runAudioConversionTest('flac');
});

test('Conversion: encode and decode MP3', { timeout: 60_000 }, async () => {
  await runAudioConversionTest('mp3');
});
