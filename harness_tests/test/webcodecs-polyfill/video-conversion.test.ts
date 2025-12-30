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
	BufferSource,
	BufferTarget,
	Conversion,
	FilePathSource,
	Input,
	Mp4OutputFormat,
	Output,
	VideoSampleSink,
} from 'mediabunny';
import { polyfillWebCodecsApi } from '../../src/polyfill.js';

const filePath = './test/webcodecs-polyfill/small_buck_bunny.mp4';

beforeAll(async () => {
	await polyfillWebCodecsApi();
});

// These conversion tests are powerful as they test large parts of the whole pipeline:
// EncodedVideoChunk -> VideoDecoder -> VideoFrame -> VideoEncoder -> EncodedVideoChunk -> VideoDecoder -> VideoFrame

test('Conversion: encode and decode AVC', { timeout: 10_000 }, async () => {
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
			codec: 'avc',
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

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await newInput.getPrimaryVideoTrack())!;
	const sink = new VideoSampleSink(videoTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.displayWidth).toBe(1920);
		expect(sample.displayHeight).toBe(1080);
	}
});

test('Conversion: encode and decode HEVC', { timeout: 10_000 }, async () => {
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
			codec: 'hevc',
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

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await newInput.getPrimaryVideoTrack())!;
	const sink = new VideoSampleSink(videoTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.displayWidth).toBe(1920);
		expect(sample.displayHeight).toBe(1080);
	}
});

test('Conversion: encode and decode VP8', { timeout: 10_000 }, async () => {
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
			codec: 'vp8',
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

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await newInput.getPrimaryVideoTrack())!;
	const sink = new VideoSampleSink(videoTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.displayWidth).toBe(1920);
		expect(sample.displayHeight).toBe(1080);
	}
});

test('Conversion: encode and decode VP9', { timeout: 10_000 }, async () => {
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
			codec: 'vp9',
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

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await newInput.getPrimaryVideoTrack())!;
	const sink = new VideoSampleSink(videoTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.displayWidth).toBe(1920);
		expect(sample.displayHeight).toBe(1080);
	}
});

test('Conversion: encode and decode AV1', { timeout: 10_000 }, async () => {
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
			codec: 'av1',
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

	using newInput = new Input({
		source: new BufferSource(output.target.buffer!),
		formats: ALL_FORMATS,
	});

	const videoTrack = (await newInput.getPrimaryVideoTrack())!;
	const sink = new VideoSampleSink(videoTrack);

	for await (using sample of sink.samples(0, 1)) {
		expect(sample.displayWidth).toBe(1920);
		expect(sample.displayHeight).toBe(1080);
	}
});
