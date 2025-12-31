// Auto-generated from W3C WebCodecs WebIDL specification
// https://www.w3.org/TR/webcodecs/
// Generated: 2025-12-31T23:57:17.179Z
// DO NOT EDIT - regenerate with: npx tsx scripts/generate-types-from-idl.ts

// =============================================================================
// NODE.JS TYPE SUBSTITUTIONS
// =============================================================================

// These types replace browser-specific DOM types for Node.js compatibility
type CanvasImageSourceNode = BufferSource | ImageDataLike;
// biome-ignore lint/correctness/noUnusedVariables: placeholder for DOM compatibility
type ImageBitmapNode = never; // Not available in Node.js
// biome-ignore lint/correctness/noUnusedVariables: placeholder for DOM compatibility
type OffscreenCanvasNode = never; // Not available in Node.js

interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

type BufferSource = ArrayBuffer | ArrayBufferView;
type AllowSharedBufferSource = ArrayBuffer | SharedArrayBuffer | ArrayBufferView;

// =============================================================================
// WEBCODECS TYPES (from W3C WebIDL)
// =============================================================================

export interface AudioDecoder extends EventTarget {
  readonly state: CodecState;
  readonly decodeQueueSize: number;
  ondequeue: EventHandler;
  configure(config: AudioDecoderConfig): undefined;
  decode(chunk: EncodedAudioChunk): undefined;
  flush(): Promise<undefined>;
  reset(): undefined;
  close(): undefined;
}

export interface AudioDecoderConstructor {
  new(init: AudioDecoderInit): AudioDecoder;
  isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
}

export interface AudioDecoderInit {
  output: AudioDataOutputCallback;
  error: WebCodecsErrorCallback;
}

export type AudioDataOutputCallback = (output: AudioData) => undefined;

export interface VideoDecoder extends EventTarget {
  readonly state: CodecState;
  readonly decodeQueueSize: number;
  ondequeue: EventHandler;
  configure(config: VideoDecoderConfig): undefined;
  decode(chunk: EncodedVideoChunk): undefined;
  flush(): Promise<undefined>;
  reset(): undefined;
  close(): undefined;
}

export interface VideoDecoderConstructor {
  new(init: VideoDecoderInit): VideoDecoder;
  isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
}

export interface VideoDecoderInit {
  output: VideoFrameOutputCallback;
  error: WebCodecsErrorCallback;
}

export type VideoFrameOutputCallback = (output: VideoFrame) => undefined;

export interface AudioEncoder extends EventTarget {
  readonly state: CodecState;
  readonly encodeQueueSize: number;
  ondequeue: EventHandler;
  configure(config: AudioEncoderConfig): undefined;
  encode(data: AudioData): undefined;
  flush(): Promise<undefined>;
  reset(): undefined;
  close(): undefined;
}

export interface AudioEncoderConstructor {
  new(init: AudioEncoderInit): AudioEncoder;
  isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
}

export interface AudioEncoderInit {
  output: EncodedAudioChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

export type EncodedAudioChunkOutputCallback = (output: EncodedAudioChunk, metadata: EncodedAudioChunkMetadata) => undefined;

export interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig;
}

export interface VideoEncoder extends EventTarget {
  readonly state: CodecState;
  readonly encodeQueueSize: number;
  ondequeue: EventHandler;
  configure(config: VideoEncoderConfig): undefined;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): undefined;
  flush(): Promise<undefined>;
  reset(): undefined;
  close(): undefined;
}

export interface VideoEncoderConstructor {
  new(init: VideoEncoderInit): VideoEncoder;
  isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;
}

export interface VideoEncoderInit {
  output: EncodedVideoChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

export type EncodedVideoChunkOutputCallback = (chunk: EncodedVideoChunk, metadata: EncodedVideoChunkMetadata) => undefined;

export interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
  svc?: SvcOutputMetadata;
  alphaSideData?: BufferSource;
}

export interface SvcOutputMetadata {
  temporalLayerId?: number;
}

export interface AudioDecoderSupport {
  supported?: boolean;
  config?: AudioDecoderConfig;
}

export interface VideoDecoderSupport {
  supported?: boolean;
  config?: VideoDecoderConfig;
}

export interface AudioEncoderSupport {
  supported?: boolean;
  config?: AudioEncoderConfig;
}

export interface VideoEncoderSupport {
  supported?: boolean;
  config?: VideoEncoderConfig;
}

export interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: AllowSharedBufferSource;
}

export interface VideoDecoderConfig {
  codec: string;
  description?: AllowSharedBufferSource;
  codedWidth?: number;
  codedHeight?: number;
  displayAspectWidth?: number;
  displayAspectHeight?: number;
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
  rotation?: number;
  flip?: boolean;
}

export interface AudioEncoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
  bitrateMode?: BitrateMode;
}

export interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  displayWidth?: number;
  displayHeight?: number;
  bitrate?: number;
  framerate?: number;
  hardwareAcceleration?: HardwareAcceleration;
  alpha?: AlphaOption;
  scalabilityMode?: string;
  bitrateMode?: VideoEncoderBitrateMode;
  latencyMode?: LatencyMode;
  contentHint?: string;
}

export type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';

export type AlphaOption = 'keep' | 'discard';

export type LatencyMode = 'quality' | 'realtime';

export interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
}

export type VideoEncoderBitrateMode = 'constant' | 'variable' | 'quantizer';

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export type WebCodecsErrorCallback = (error: Error) => undefined;

export interface EncodedAudioChunk {
  readonly type: EncodedAudioChunkType;
  readonly timestamp: number;
  readonly duration?: number;
  readonly byteLength: number;
  copyTo(destination: AllowSharedBufferSource): undefined;
}

export interface EncodedAudioChunkConstructor {
  new(init: EncodedAudioChunkInit): EncodedAudioChunk;
}

export interface EncodedAudioChunkInit {
  type: EncodedAudioChunkType;
  timestamp: number;
  duration?: number;
  data: AllowSharedBufferSource;
  transfer?: ArrayBuffer[];
}

export type EncodedAudioChunkType = 'key' | 'delta';

export interface EncodedVideoChunk {
  readonly type: EncodedVideoChunkType;
  readonly timestamp: number;
  readonly duration?: number;
  readonly byteLength: number;
  copyTo(destination: AllowSharedBufferSource): undefined;
}

export interface EncodedVideoChunkConstructor {
  new(init: EncodedVideoChunkInit): EncodedVideoChunk;
}

export interface EncodedVideoChunkInit {
  type: EncodedVideoChunkType;
  timestamp: number;
  duration?: number;
  data: AllowSharedBufferSource;
  transfer?: ArrayBuffer[];
}

export type EncodedVideoChunkType = 'key' | 'delta';

export interface AudioData {
  readonly format?: AudioSampleFormat;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;
  allocationSize(options: AudioDataCopyToOptions): number;
  copyTo(destination: AllowSharedBufferSource, options: AudioDataCopyToOptions): undefined;
  clone(): AudioData;
  close(): undefined;
}

export interface AudioDataConstructor {
  new(init: AudioDataInit): AudioData;
}

export interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: BufferSource;
  transfer?: ArrayBuffer[];
}

export interface AudioDataCopyToOptions {
  planeIndex: number;
  frameOffset?: number;
  frameCount?: number;
  format?: AudioSampleFormat;
}

export type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';

export interface VideoFrame {
  readonly format?: VideoPixelFormat;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly codedRect?: DOMRectReadOnly;
  readonly visibleRect?: DOMRectReadOnly;
  readonly rotation: number;
  readonly flip: boolean;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly duration?: number;
  readonly timestamp: number;
  readonly colorSpace: VideoColorSpace;
  metadata(): VideoFrameMetadata;
  allocationSize(options?: VideoFrameCopyToOptions): number;
  copyTo(destination: AllowSharedBufferSource, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]>;
  clone(): VideoFrame;
  close(): undefined;
}

export interface VideoFrameConstructor {
  new(image: CanvasImageSourceNode, init?: VideoFrameInit): VideoFrame;
  new(data: AllowSharedBufferSource, init: VideoFrameBufferInit): VideoFrame;
}

export interface VideoFrameInit {
  duration?: number;
  timestamp?: number;
  alpha?: AlphaOption;
  visibleRect?: DOMRectInit;
  rotation?: number;
  flip?: boolean;
  displayWidth?: number;
  displayHeight?: number;
  metadata?: VideoFrameMetadata;
}

export interface VideoFrameBufferInit {
  format: VideoPixelFormat;
  codedWidth: number;
  codedHeight: number;
  timestamp: number;
  duration?: number;
  layout?: PlaneLayout[];
  visibleRect?: DOMRectInit;
  rotation?: number;
  flip?: boolean;
  displayWidth?: number;
  displayHeight?: number;
  colorSpace?: VideoColorSpaceInit;
  transfer?: ArrayBuffer[];
  metadata?: VideoFrameMetadata;
}

export type VideoFrameMetadata = Record<string, never>;

export interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
  format?: VideoPixelFormat;
  colorSpace?: PredefinedColorSpace;
}

export interface PlaneLayout {
  offset: number;
  stride: number;
}

export type VideoPixelFormat = 'I420' | 'I420P10' | 'I420P12' | 'I420A' | 'I420AP10' | 'I420AP12' | 'I422' | 'I422P10' | 'I422P12' | 'I422A' | 'I422AP10' | 'I422AP12' | 'I444' | 'I444P10' | 'I444P12' | 'I444A' | 'I444AP10' | 'I444AP12' | 'NV12' | 'RGBA' | 'RGBX' | 'BGRA' | 'BGRX';

export interface VideoColorSpace {
  readonly primaries?: VideoColorPrimaries;
  readonly transfer?: VideoTransferCharacteristics;
  readonly matrix?: VideoMatrixCoefficients;
  readonly fullRange?: boolean;
  toJSON(): VideoColorSpaceInit;
}

export interface VideoColorSpaceConstructor {
  new(init?: VideoColorSpaceInit): VideoColorSpace;
}

export interface VideoColorSpaceInit {
  primaries?: VideoColorPrimaries;
  transfer?: VideoTransferCharacteristics;
  matrix?: VideoMatrixCoefficients;
  fullRange?: boolean;
}

export type VideoColorPrimaries = 'bt709' | 'bt470bg' | 'smpte170m' | 'bt2020' | 'smpte432';

export type VideoTransferCharacteristics = 'bt709' | 'smpte170m' | 'iec61966-2-1' | 'linear' | 'pq' | 'hlg';

export type VideoMatrixCoefficients = 'rgb' | 'bt709' | 'bt470bg' | 'smpte170m' | 'bt2020-ncl';

export interface ImageDecoder {
  readonly type: string;
  readonly complete: boolean;
  readonly completed: Promise<undefined>;
  readonly tracks: ImageTrackList;
  decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult>;
  reset(): undefined;
  close(): undefined;
}

export interface ImageDecoderConstructor {
  new(init: ImageDecoderInit): ImageDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

export type ImageBufferSource = AllowSharedBufferSource | ReadableStream;

export interface ImageDecoderInit {
  type: string;
  data: ImageBufferSource;
  colorSpaceConversion?: ColorSpaceConversion;
  desiredWidth?: number;
  desiredHeight?: number;
  preferAnimation?: boolean;
  transfer?: ArrayBuffer[];
}

export interface ImageDecodeOptions {
  frameIndex?: number;
  completeFramesOnly?: boolean;
}

export interface ImageDecodeResult {
  image: VideoFrame;
  complete: boolean;
}

export interface ImageTrackList {
  readonly ready: Promise<undefined>;
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack?: ImageTrack;
}

export interface ImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number;
  selected: boolean;
}
