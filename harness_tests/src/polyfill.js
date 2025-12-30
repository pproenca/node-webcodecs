// == node-webcodecs (local implementation)

const webcodecs = require('node-webcodecs');

module.exports.polyfillWebCodecsApi = async function () {
  globalThis.VideoDecoder = webcodecs.VideoDecoder;
  globalThis.AudioDecoder = webcodecs.AudioDecoder;
  globalThis.VideoEncoder = webcodecs.VideoEncoder;
  globalThis.AudioEncoder = webcodecs.AudioEncoder;
  globalThis.EncodedVideoChunk = webcodecs.EncodedVideoChunk;
  globalThis.EncodedAudioChunk = webcodecs.EncodedAudioChunk;
  globalThis.VideoFrame = webcodecs.VideoFrame;
  globalThis.VideoColorSpace = webcodecs.VideoColorSpace;
  globalThis.AudioData = webcodecs.AudioData;
  globalThis.ImageDecoder = webcodecs.ImageDecoder;
};
