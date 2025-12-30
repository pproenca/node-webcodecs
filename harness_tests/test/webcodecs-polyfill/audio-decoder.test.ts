/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeAll, expect, test } from 'vitest';
import { polyfillWebCodecsApi } from '../../src/polyfill.js';
import { ALL_FORMATS, EncodedPacketSink, FilePathSource, Input } from 'mediabunny';
import { AsyncMutex } from './misc.js';

const filePath = './test/webcodecs-polyfill/small_buck_bunny.mp4';

beforeAll(async () => {
	await polyfillWebCodecsApi();
});

test('AudioDecoder lifecycle', { timeout: 10_000 }, async () => {
	using input = new Input({
		source: new FilePathSource(filePath),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await input.getPrimaryAudioTrack())!;
	const decoderConfig = (await audioTrack.getDecoderConfig())!;

	let lastTimestamp = -Infinity;

	const mutex = new AsyncMutex();
	const valuesSeen = new Set<number>();

	const decoder = new AudioDecoder({
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		output: async (audioData) => {
			using lock = mutex.lock();
			if (lock.pending) await lock.ready;

			expect(audioData.format).not.toBeNull();
			expect(audioData.sampleRate).toBe(audioTrack.sampleRate);
			expect(audioData.numberOfChannels).toBe(audioTrack.numberOfChannels);
			expect(audioData.timestamp).toBeGreaterThan(lastTimestamp);

			const allocSize = audioData.allocationSize({ planeIndex: 0 });
			const buffer = new Uint8Array(allocSize);
			audioData.copyTo(buffer, { planeIndex: 0 });

			valuesSeen.add(buffer[0]);

			lastTimestamp = audioData.timestamp;
			audioData.close();

			expect(audioData.format).toBeNull();
			expect(audioData.sampleRate).toBe(0);
			expect(audioData.numberOfFrames).toBe(0);
			expect(audioData.numberOfChannels).toBe(0);
		},
		error: (e) => { throw e; },
	});
	expect(decoder.state === 'unconfigured');

	decoder.configure(decoderConfig);
	expect(decoder.state === 'configured');

	const sink = new EncodedPacketSink(audioTrack);
	for await (const packet of sink.packets()) {
		const chunk = packet.toEncodedAudioChunk();
		decoder.decode(chunk);

		expect(decoder.decodeQueueSize).not.toBe(0);
		await new Promise(resolve => decoder.addEventListener('dequeue', resolve, { once: true }));
	}

	expect(decoder.decodeQueueSize).toBe(0);

	await decoder.flush();

	await mutex.lock().ready;

	expect(valuesSeen.size).toBeGreaterThan(3);

	decoder.close();
	expect(decoder.state).toBe('closed');
});
