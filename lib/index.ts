/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * W3C WebCodecs Specification Compliance Notes:
 * - VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder extend EventTarget via CodecBase
 * - VideoFrame visibleRect cropping implemented in native layer
 * - ArrayBuffer transfer semantics implemented (uses structuredClone with transfer)
 * - High bit-depth pixel formats for VideoFrame (I420P10, I420P12, I422P10, I422P12, I444P10, I444P12, NV12P10)
 *   Note: VideoEncoder input format conversion does not yet support high bit-depth formats
 * - NV21 pixel format supported (8-bit YUV420 semi-planar with VU ordering)
 * - TODO: VideoFrame constructor from CanvasImageSource not supported (Node.js limitation)
 * - 10-bit alpha formats (I420AP10, I422AP10, I444AP10) supported; 12-bit alpha not supported by FFmpeg
 */

import { binding, platformInfo } from './binding';
import type { NativeModule } from './native-types';

// Load native addon with type assertion
const native = binding as NativeModule;

// Export platform info for debugging
export { platformInfo };

// Re-export extracted classes
export { AudioData } from './audio-data';
export { AudioDecoder } from './audio-decoder';
export { AudioEncoder } from './audio-encoder';
export { Demuxer } from './demuxer';
export { EncodedAudioChunk, EncodedVideoChunk } from './encoded-chunks';
export { ImageDecoder } from './image-decoder';
export { Muxer } from './muxer';
export { VideoDecoder } from './video-decoder';
export { VideoEncoder } from './video-encoder';
export { VideoFilter } from './video-filter';
export { VideoColorSpace, VideoFrame } from './video-frame';

// Export WarningAccumulator from native binding
export const WarningAccumulator = native.WarningAccumulator;
export const getFFmpegWarnings = native.getFFmpegWarnings;
export const clearFFmpegWarnings = native.clearFFmpegWarnings;

// Export ErrorBuilder from native binding
export const ErrorBuilder = native.ErrorBuilder;
export const testAttrAsEnum = native.testAttrAsEnum;
export const createEncoderConfigDescriptor = native.createEncoderConfigDescriptor;

// Export TestVideoGenerator (test helper for generating test video frames)
export { TestVideoGenerator } from './test-video-generator';

export type { ErrorCodeType } from './errors';
// Re-export error classes and codes
export {
  AllocationError,
  ConfigurationError,
  DecodingError,
  EncodingError,
  ErrorCode,
  ffmpegErrorMessage,
  InvalidDataError,
  InvalidStateError,
  UnsupportedCodecError,
  WebCodecsError,
} from './errors';

// Re-export ImageTrack and ImageTrackList classes
export { ImageTrack } from './image-track';
export { ImageTrackList } from './image-track-list';
// Re-export ResourceManager
export { ResourceManager } from './resource-manager';
// Re-export all types from types.ts (W3C WebCodecs API types)
export type {
  // Fundamental types
  AllowSharedBufferSource,
  AlphaOption,
  AudioDataConstructor,
  AudioDataCopyToOptions,
  // Audio data
  AudioDataInit,
  AudioDataOutputCallback,
  // Audio decoder
  AudioDecoderConfig,
  AudioDecoderConstructor,
  AudioDecoderInit,
  AudioDecoderSupport,
  // Audio encoder
  AudioEncoderConfig,
  AudioEncoderConstructor,
  AudioEncoderInit,
  AudioEncoderSupport,
  // Audio sample format
  AudioSampleFormat,
  BitrateMode,
  // Additional types (not in W3C spec)
  BlurRegion,
  BufferSource,
  // Codec state
  CodecState,
  ColorSpaceConversion,
  DemuxerChunk,
  DemuxerInit,
  DOMHighResTimeStamp,
  // DOM rect types
  DOMRectInit,
  DOMRectReadOnly,
  EncodedAudioChunkConstructor,
  // Encoded audio chunk
  EncodedAudioChunkInit,
  EncodedAudioChunkMetadata,
  EncodedAudioChunkOutputCallback,
  // Chunk types
  EncodedAudioChunkType,
  EncodedVideoChunkConstructor,
  // Encoded video chunk
  EncodedVideoChunkInit,
  EncodedVideoChunkMetadata,
  EncodedVideoChunkOutputCallback,
  EncodedVideoChunkType,
  // Hardware/quality hints
  HardwareAcceleration,
  // Image decoder
  ImageBufferSource,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageDecoderConstructor,
  ImageDecoderInit,
  LatencyMode,
  // Muxer types
  MuxerAudioTrackConfig,
  MuxerInit,
  MuxerVideoTrackConfig,
  OpusEncoderConfig,
  // Plane layout
  PlaneLayout,
  PredefinedColorSpace,
  SvcOutputMetadata,
  // Test video generator
  TestVideoGeneratorConfig,
  TrackInfo,
  // Video color space
  VideoColorPrimaries,
  VideoColorSpaceConstructor,
  VideoColorSpaceInit,
  // Video decoder
  VideoDecoderConfig,
  VideoDecoderConstructor,
  VideoDecoderInit,
  VideoDecoderSupport,
  // Bitrate modes
  VideoEncoderBitrateMode,
  // Video encoder
  VideoEncoderConfig,
  // Constructor interfaces
  VideoEncoderConstructor,
  VideoEncoderEncodeOptions,
  VideoEncoderEncodeOptionsForAv1,
  VideoEncoderEncodeOptionsForAvc,
  VideoEncoderEncodeOptionsForHevc,
  VideoEncoderEncodeOptionsForVp9,
  VideoEncoderInit,
  VideoEncoderSupport,
  VideoFilterConfig,
  VideoFrameBufferInit,
  VideoFrameConstructor,
  VideoFrameCopyToOptions,
  // Video frame
  VideoFrameInit,
  // Video frame metadata
  VideoFrameMetadata,
  VideoFrameOutputCallback,
  VideoMatrixCoefficients,
  // Video pixel format
  VideoPixelFormat,
  VideoTransferCharacteristics,
  // Error callback
  WebCodecsErrorCallback,
} from './types';
