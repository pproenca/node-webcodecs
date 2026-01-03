import { expectType } from 'tsd';
import type {
  AudioEncoderConfig,
  CodecState,
  VideoEncoderConfig,
  VideoPixelFormat,
} from '../../dist/index';
import {
  type AudioEncoder,
  type EncodedAudioChunk,
  type EncodedVideoChunk,
  type VideoEncoder,
  VideoFrame,
} from '../../dist/index';

// VideoEncoder types
declare const videoEncoder: VideoEncoder;
expectType<CodecState>(videoEncoder.state);
expectType<number>(videoEncoder.encodeQueueSize);

// VideoEncoder.configure accepts valid config
const validVideoConfig: VideoEncoderConfig = {
  codec: 'avc1.42001e',
  width: 640,
  height: 480,
};
expectType<void>(videoEncoder.configure(validVideoConfig));

// VideoFrame accepts valid format
const frameInit = {
  format: 'RGBA' as VideoPixelFormat,
  codedWidth: 640,
  codedHeight: 480,
  timestamp: 0,
};
expectType<VideoFrame>(new VideoFrame(new Uint8Array(640 * 480 * 4), frameInit));

// AudioEncoder types
declare const audioEncoder: AudioEncoder;
expectType<CodecState>(audioEncoder.state);

const validAudioConfig: AudioEncoderConfig = {
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 2,
};
expectType<void>(audioEncoder.configure(validAudioConfig));

// EncodedVideoChunk types
declare const videoChunk: EncodedVideoChunk;
expectType<'key' | 'delta'>(videoChunk.type);
expectType<number>(videoChunk.timestamp);
expectType<number>(videoChunk.byteLength);

// EncodedAudioChunk types
declare const audioChunk: EncodedAudioChunk;
expectType<'key' | 'delta'>(audioChunk.type);
expectType<number>(audioChunk.timestamp);
