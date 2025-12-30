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

test('VideoDecoder lifecycle', { timeout: 10_000 }, async () => {
	using input = new Input({
		source: new FilePathSource(filePath),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await input.getPrimaryVideoTrack())!;
	const decoderConfig = (await videoTrack.getDecoderConfig())!;

	let lastTimestamp = -Infinity;

	const mutex = new AsyncMutex();
	const valuesSeen = new Set<number>();

	const decoder = new VideoDecoder({
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		output: async (frame) => {
			using lock = mutex.lock();
			if (lock.pending) await lock.ready;

			expect(frame.format).toBe('I420');
			expect(frame.displayWidth).toBe(videoTrack.displayWidth);
			expect(frame.displayHeight).toBe(videoTrack.displayHeight);
			expect(frame.timestamp).toBeGreaterThan(lastTimestamp);

			const allocSize = frame.allocationSize();
			const buffer = new Uint8Array(allocSize);
			await frame.copyTo(buffer);

			valuesSeen.add(buffer[0]);

			lastTimestamp = frame.timestamp;
			frame.close();

			expect(frame.format).toBeNull();
			expect(frame.displayWidth).toBe(0);
			expect(frame.displayHeight).toBe(0);
			expect(frame.timestamp).toBe(lastTimestamp);
		},
		error: (e) => { throw e; },
	});
	expect(decoder.state === 'unconfigured');

	decoder.configure(decoderConfig);
	expect(decoder.state === 'configured');

	const sink = new EncodedPacketSink(videoTrack);
	for await (const packet of sink.packets()) {
		const chunk = packet.toEncodedVideoChunk();
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
