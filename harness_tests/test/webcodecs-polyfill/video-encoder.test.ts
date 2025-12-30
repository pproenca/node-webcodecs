/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeAll, expect, test } from 'vitest';
import { polyfillWebCodecsApi } from '../../src/polyfill.js';

beforeAll(async () => {
	await polyfillWebCodecsApi();
});

test('VideoEncoder lifecycle', { timeout: 10_000 }, async () => {
	let first = true;

	const encoder = new VideoEncoder({
		output: (chunk, meta) => {
			expect(chunk.byteLength).toBeGreaterThan(0);
			const data = new DataView(new ArrayBuffer(chunk.byteLength));
			chunk.copyTo(data);
			expect(data.getUint32(0, false)).not.toBe(1); // Rule out Annex B

			if (first) {
				expect(meta?.decoderConfig).not.toBeUndefined();
				expect(meta!.decoderConfig!.codec.startsWith('avc1.'));
				expect(meta!.decoderConfig!.codedWidth).toBe(1280);
				expect(meta!.decoderConfig!.codedHeight).toBe(720);
				expect(meta!.decoderConfig!.description).not.toBeUndefined();
				expect(meta!.decoderConfig!.colorSpace!.primaries).toBe('bt709');
				expect(meta!.decoderConfig!.colorSpace!.transfer).toBe('iec61966-2-1');
				expect(meta!.decoderConfig!.colorSpace!.matrix).toBe('rgb');
				expect(meta!.decoderConfig!.colorSpace!.fullRange).toBe(true);

				first = false;
			}
		},
		error: (e) => { throw e; },
	});
	expect(encoder.state).toBe('unconfigured');

	encoder.configure({
		codec: 'avc1.42001f',
		width: 1280,
		height: 720,
		// Bitrate is auto-chosen
	});
	expect(encoder.state).toBe('configured');

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
			timestamp: Math.floor(1e6 * i / 25),
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

		expect(encoder.encodeQueueSize).not.toBe(0);
		await new Promise(resolve => encoder.addEventListener('dequeue', resolve, { once: true }));
	}

	expect(encoder.encodeQueueSize).toBe(0);

	await encoder.flush();

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
			expect(meta!.decoderConfig!.description).toBeUndefined();
		},
		error: (e) => { throw e; },
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
			expect(meta!.decoderConfig!.description).toBeUndefined();
		},
		error: (e) => { throw e; },
	});

	encoder.configure({
		codec: 'hev1.1.L0.0',
		width: 1280,
		height: 720,
		// @ts-expect-error Type are shitty
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
