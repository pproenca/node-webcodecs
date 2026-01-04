// Global setup - inject WebCodecs API into globalThis
import { after } from 'node:test';
import * as webcodecs from '@pproenca/node-webcodecs';

// Global teardown - reset ResourceManager singleton to prevent cross-test contamination.
// The ResourceManager accumulates codec references across test files, causing stale state.
after(() => {
  webcodecs.ResourceManager.getInstance()._resetForTesting();
});

declare global {
  var VideoDecoder: typeof webcodecs.VideoDecoder;
  var VideoEncoder: typeof webcodecs.VideoEncoder;
  var AudioDecoder: typeof webcodecs.AudioDecoder;
  var AudioEncoder: typeof webcodecs.AudioEncoder;
  var EncodedVideoChunk: typeof webcodecs.EncodedVideoChunk;
  var EncodedAudioChunk: typeof webcodecs.EncodedAudioChunk;
  var VideoFrame: typeof webcodecs.VideoFrame;
  var VideoColorSpace: typeof webcodecs.VideoColorSpace;
  var AudioData: typeof webcodecs.AudioData;
  var ImageDecoder: typeof webcodecs.ImageDecoder;
  var TestVideoGenerator: typeof webcodecs.TestVideoGenerator;
}

globalThis.VideoDecoder = webcodecs.VideoDecoder;
globalThis.VideoEncoder = webcodecs.VideoEncoder;
globalThis.AudioDecoder = webcodecs.AudioDecoder;
globalThis.AudioEncoder = webcodecs.AudioEncoder;
globalThis.EncodedVideoChunk = webcodecs.EncodedVideoChunk;
globalThis.EncodedAudioChunk = webcodecs.EncodedAudioChunk;
globalThis.VideoFrame = webcodecs.VideoFrame;
globalThis.VideoColorSpace = webcodecs.VideoColorSpace;
globalThis.AudioData = webcodecs.AudioData;
globalThis.ImageDecoder = webcodecs.ImageDecoder;
globalThis.TestVideoGenerator = webcodecs.TestVideoGenerator;
