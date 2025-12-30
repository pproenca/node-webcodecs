/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeAll, expect, test } from 'vitest';
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
import { polyfillWebCodecsApi } from '../../src/polyfill.js';

const filePath = './test/webcodecs-polyfill/small_buck_bunny.mp4';

beforeAll(async () => {
	await polyfillWebCodecsApi();
});

// These conversion tests are powerful as they test large parts of the whole pipeline:
// EncodedAudioChunk -> AudioDecoder -> AudioData -> AudioEncoder -> EncodedAudioChunk -> AudioDecoder -> AudioData

test('Conversion: encode and decode AAC', { timeout: 10_000 }, async () => {
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
			codec: 'aac',
		},
		trim: {
			start: 0,
			end: 5,
		},
	});
	await conversion.execute();

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await newInput.getPrimaryAudioTrack())!;
	const sink = new AudioSampleSink(audioTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.sampleRate).toBe(48000);
	}
});

test('Conversion: encode and decode Opus', { timeout: 60_000 }, async () => {
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
			codec: 'opus',
		},
		trim: {
			start: 0,
			end: 5,
		},
	});
	await conversion.execute();

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await newInput.getPrimaryAudioTrack())!;
	const sink = new AudioSampleSink(audioTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.sampleRate).toBe(48000);
	}
});

test('Conversion: encode and decode Vorbis', { timeout: 60_000 }, async () => {
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
			codec: 'vorbis',
		},
		trim: {
			start: 0,
			end: 5,
		},
	});
	await conversion.execute();

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await newInput.getPrimaryAudioTrack())!;
	const sink = new AudioSampleSink(audioTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.sampleRate).toBe(48000);
	}
});

test('Conversion: encode and decode FLAC', { timeout: 60_000 }, async () => {
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
			codec: 'flac',
		},
		trim: {
			start: 0,
			end: 5,
		},
	});
	await conversion.execute();

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await newInput.getPrimaryAudioTrack())!;
	const sink = new AudioSampleSink(audioTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.sampleRate).toBe(48000);
	}
});

test('Conversion: encode and decode MP3', { timeout: 60_000 }, async () => {
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
			codec: 'mp3',
		},
		trim: {
			start: 0,
			end: 5,
		},
	});
	await conversion.execute();

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const audioTrack = (await newInput.getPrimaryAudioTrack())!;
	const sink = new AudioSampleSink(audioTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.sampleRate).toBe(48000);
	}
});
