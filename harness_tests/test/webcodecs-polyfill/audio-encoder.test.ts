/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeAll, expect, test } from 'vitest';
import { polyfillWebCodecsApi } from '../../src/polyfill.js';
import { toDataView } from './misc.js';

beforeAll(async () => {
	await polyfillWebCodecsApi();
});

test('AudioEncoder lifecycle', { timeout: 10_000 }, async () => {
	let first = true;

	const encoder = new AudioEncoder({
		output: (chunk, meta) => {
			expect(chunk.byteLength).toBeGreaterThan(0);
			const data = new Uint8Array(chunk.byteLength);
			chunk.copyTo(data); // Just 'cause

			if (first) {
				expect(meta?.decoderConfig).not.toBeUndefined();
				expect(meta!.decoderConfig!.codec).toBe('mp4a.40.2');
				expect(meta!.decoderConfig!.sampleRate).toBe(48000);
				expect(meta!.decoderConfig!.numberOfChannels).toBe(2);
				expect(meta!.decoderConfig!.description).not.toBeUndefined();

				first = false;
			}
		},
		error: (e) => { throw e; },
	});
	expect(encoder.state).toBe('unconfigured');

	encoder.configure({
		codec: 'mp4a.40.2',
		sampleRate: 48000,
		numberOfChannels: 2,
		// Bitrate is auto-chosen
	});
	expect(encoder.state).toBe('configured');

	const sampleRate = 48000;
	const numberOfChannels = 2;
	const framesPerChunk = 1024;
	const frequency = 200 + Math.random() * 800;

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
			timestamp: Math.floor(1e6 * i * framesPerChunk / sampleRate),
			data,
		});
		expect(audioData.format).toBe('f32');
		expect(audioData.sampleRate).toBe(sampleRate);
		expect(audioData.numberOfChannels).toBe(numberOfChannels);
		expect(audioData.numberOfFrames).toBe(framesPerChunk);

		encoder.encode(audioData);
		audioData.close();

		expect(encoder.encodeQueueSize).not.toBe(0);
		await new Promise(resolve => encoder.addEventListener('dequeue', resolve, { once: true }));
	}

	expect(encoder.encodeQueueSize).toBe(0);

	await encoder.flush();

	encoder.close();
	expect(encoder.state).toBe('closed');
});

test('AAC in ADTS format', async () => {
	let first = true;

	const encoder = new AudioEncoder({
		output: (chunk, meta) => {
			expect(chunk.byteLength).toBeGreaterThan(0);
			const data = new Uint8Array(chunk.byteLength);
			chunk.copyTo(data);
			expect(data[0]).toBe(255);

			if (first) {
				expect(meta?.decoderConfig).not.toBeUndefined();
				expect(meta!.decoderConfig!.description).toBeUndefined();

				first = false;
			}
		},
		error: (e) => { throw e; },
	});

	encoder.configure({
		codec: 'mp4a.40.2',
		sampleRate: 48000,
		numberOfChannels: 2,
		// @ts-expect-error Shitty types
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
		output: (chunk, meta) => {
			expect(meta?.decoderConfig).not.toBeUndefined();
			expect(meta?.decoderConfig?.description).not.toBeUndefined();

			const dataView = toDataView(meta!.decoderConfig!.description!);
			expect(dataView.getUint32(0, false)).toBe(0x664C6143); // 'fLaC'

			chunkCount++;
		},
		error: (e) => { throw e; },
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

	expect(chunkCount).toBeGreaterThan(0); // Tests that the data was successfully padded to a multiple of 4608
});
