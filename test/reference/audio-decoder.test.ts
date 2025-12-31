/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ALL_FORMATS, EncodedPacketSink, FilePathSource, Input } from 'mediabunny';
import { expect, test } from 'vitest';
import { AsyncMutex } from './misc.js';

const filePath = './test/fixtures/small_buck_bunny.mp4';

test('AudioDecoder lifecycle', { timeout: 10_000 }, async () => {
  using input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });

  const audioTrack = await input.getPrimaryAudioTrack();
  expect(audioTrack).toBeDefined();
  if (!audioTrack) {
    throw new Error('Audio track should be defined');
  }

  const decoderConfig = await audioTrack.getDecoderConfig();
  expect(decoderConfig).toBeDefined();
  if (!decoderConfig) {
    throw new Error('Decoder config should be defined');
  }

  // Collect results to verify after flush (avoids throwing from NAPI callbacks)
  const samples: Array<{
    format: string | null;
    sampleRate: number;
    numberOfChannels: number;
    timestamp: number;
    firstByte: number;
  }> = [];
  let error: Error | undefined;

  const decoder = new AudioDecoder({
    output: (audioData) => {
      try {
        const allocSize = audioData.allocationSize({ planeIndex: 0 });
        const buffer = new Uint8Array(allocSize);
        audioData.copyTo(buffer, { planeIndex: 0 });

        samples.push({
          format: audioData.format,
          sampleRate: audioData.sampleRate,
          numberOfChannels: audioData.numberOfChannels,
          timestamp: audioData.timestamp,
          firstByte: buffer[0],
        });

        audioData.close();
      } catch (e) {
        error = e as Error;
      }
    },
    error: (e) => {
      error = e;
    },
  });
  expect(decoder.state === 'unconfigured');

  decoder.configure(decoderConfig);
  expect(decoder.state === 'configured');

  let dequeueEvents = 0;
  decoder.addEventListener('dequeue', () => dequeueEvents++);

  const sink = new EncodedPacketSink(audioTrack);
  for await (const packet of sink.packets()) {
    const chunk = packet.toEncodedAudioChunk();
    decoder.decode(chunk);
  }

  await decoder.flush();

  // Now verify collected results
  if (error) throw error;

  // Verify that dequeue events were fired
  expect(dequeueEvents).toBeGreaterThan(0);

  // Verify samples were received with correct properties
  expect(samples.length).toBeGreaterThan(0);
  expect(samples[0].format).not.toBeNull();
  expect(samples[0].sampleRate).toBe(audioTrack.sampleRate);
  expect(samples[0].numberOfChannels).toBe(audioTrack.numberOfChannels);

  // Verify timestamps are monotonically increasing (allow equal for same-packet samples)
  let lastTimestamp = -Infinity;
  for (const sample of samples) {
    expect(sample.timestamp).toBeGreaterThanOrEqual(lastTimestamp);
    lastTimestamp = sample.timestamp;
  }

  // Verify we saw diverse sample values (actual audio content)
  const valuesSeen = new Set(samples.map((s) => s.firstByte));
  expect(valuesSeen.size).toBeGreaterThan(3);

  decoder.close();
  expect(decoder.state).toBe('closed');
});
