/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_FORMATS, EncodedPacketSink, FilePathSource, Input } from 'mediabunny';

const filePath = './test/fixtures/small_buck_bunny.mp4';

test('VideoDecoder lifecycle', { timeout: 120_000 }, async () => {
  using input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error('No video track found');
  }
  const decoderConfig = await videoTrack.getDecoderConfig();
  if (!decoderConfig) {
    throw new Error('No decoder config found');
  }

  // Collect results to verify after flush (avoids throwing from NAPI callbacks)
  const frames: Array<{
    format: string | null;
    displayWidth: number;
    displayHeight: number;
    timestamp: number;
    firstByte: number;
  }> = [];
  let error: Error | undefined;

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        const allocSize = frame.allocationSize();
        const buffer = new Uint8Array(allocSize);
        frame.copyTo(buffer);

        frames.push({
          format: frame.format,
          displayWidth: frame.displayWidth,
          displayHeight: frame.displayHeight,
          timestamp: frame.timestamp,
          firstByte: buffer[0],
        });

        frame.close();
      } catch (e) {
        error = e as Error;
      }
    },
    error: (e) => {
      error = e;
    },
  });
  assert.strictEqual(decoder.state, 'unconfigured');

  decoder.configure(decoderConfig);
  assert.strictEqual(decoder.state, 'configured');

  let dequeueEvents = 0;
  decoder.addEventListener('dequeue', () => dequeueEvents++);

  const sink = new EncodedPacketSink(videoTrack);
  for await (const packet of sink.packets()) {
    const chunk = packet.toEncodedVideoChunk();
    decoder.decode(chunk);
  }

  await decoder.flush();

  // Now verify collected results
  if (error) throw error;

  // Verify that dequeue events were fired
  assert.ok(dequeueEvents > 0);

  // Verify frames were received with correct dimensions
  assert.ok(frames.length > 0);
  assert.strictEqual(frames[0].displayWidth, videoTrack.displayWidth);
  assert.strictEqual(frames[0].displayHeight, videoTrack.displayHeight);
  // Note: Output format may be I420 or RGBA depending on implementation
  assert.notStrictEqual(frames[0].format, null);

  // Verify timestamps are monotonically increasing
  let lastTimestamp = -Infinity;
  for (const frame of frames) {
    assert.ok(frame.timestamp >= lastTimestamp);
    lastTimestamp = frame.timestamp;
  }

  // Verify we saw diverse pixel values (actual video content)
  const valuesSeen = new Set(frames.map((f) => f.firstByte));
  assert.ok(valuesSeen.size > 3);

  decoder.close();
  assert.strictEqual(decoder.state, 'closed');
});
