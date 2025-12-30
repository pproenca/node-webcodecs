// Hardware acceleration hint
export type HardwareAcceleration =
  | 'no-preference'
  | 'prefer-hardware'
  | 'prefer-software';

// Alpha handling
export type AlphaOption = 'keep' | 'discard';

// Latency mode
export type LatencyMode = 'quality' | 'realtime';

// Bitrate mode
export type VideoEncoderBitrateMode = 'constant' | 'variable' | 'quantizer';

export interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  hardwareAcceleration?: HardwareAcceleration;
  latencyMode?: LatencyMode;
  bitrateMode?: VideoEncoderBitrateMode;
  alpha?: AlphaOption;
  scalabilityMode?: string;
  displayAspectWidth?: number;
  displayAspectHeight?: number;
  contentHint?: string;
}

export interface VideoEncoderInit {
  output: (
    chunk: EncodedVideoChunk,
    metadata?: EncodedVideoChunkMetadata,
  ) => void;
  error: (error: Error) => void;
}

export interface EncodedVideoChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration: number | null;
  data: Buffer;
  byteLength: number;
}

export interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig & {
    description?: ArrayBuffer;
  };
  svc?: {
    temporalLayerId: number;
  };
  alphaSideData?: BufferSource;
}

export interface DOMRectReadOnly {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

// W3C DOMRectInit - mutable version for input parameters
export interface DOMRectInit {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface VideoFrameInit {
  codedWidth: number;
  codedHeight: number;
  timestamp: number;
  duration?: number;
  displayWidth?: number;
  displayHeight?: number;
  format?: VideoPixelFormat;
  rotation?: number; // 0, 90, 180, or 270 degrees per W3C spec
  flip?: boolean;
  visibleRect?: DOMRectInit;
}

// W3C VideoFrameBufferInit - for constructing VideoFrame from BufferSource
export interface VideoFrameBufferInit {
  format: VideoPixelFormat;
  codedWidth: number;
  codedHeight: number;
  timestamp: number;
  duration?: number;
  layout?: PlaneLayout[];
  visibleRect?: DOMRectInit;
  displayWidth?: number;
  displayHeight?: number;
  colorSpace?: VideoColorSpaceInit;
  transfer?: ArrayBuffer[]; // TODO: ArrayBuffer transfer not implemented
  metadata?: VideoFrameMetadata;
  rotation?: number; // 0, 90, 180, or 270 degrees per W3C spec
  flip?: boolean;
}

// Codec-specific quantizer options per W3C WebCodecs spec
export interface VideoEncoderEncodeOptionsForVp9 {
  quantizer?: number; // 0-63
}

export interface VideoEncoderEncodeOptionsForAv1 {
  quantizer?: number; // 0-63
}

export interface VideoEncoderEncodeOptionsForAvc {
  quantizer?: number; // 0-51
}

export interface VideoEncoderEncodeOptionsForHevc {
  quantizer?: number; // 0-51
}

export interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
  vp9?: VideoEncoderEncodeOptionsForVp9;
  av1?: VideoEncoderEncodeOptionsForAv1;
  avc?: VideoEncoderEncodeOptionsForAvc;
  hevc?: VideoEncoderEncodeOptionsForHevc;
}

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export interface PlaneLayout {
  offset: number;
  stride: number;
}

// W3C VideoPixelFormat - all formats from the spec
// Note: High bit-depth formats (P10/P12) marked but may not be fully supported in native layer
export type VideoPixelFormat =
  // 4:2:0 Y, U, V
  | 'I420'
  | 'I420P10' // TODO: 10-bit not implemented in native
  | 'I420P12' // TODO: 12-bit not implemented in native
  // 4:2:0 Y, U, V, A
  | 'I420A'
  | 'I420AP10' // TODO: 10-bit not implemented in native
  | 'I420AP12' // TODO: 12-bit not implemented in native
  // 4:2:2 Y, U, V
  | 'I422'
  | 'I422P10' // TODO: 10-bit not implemented in native
  | 'I422P12' // TODO: 12-bit not implemented in native
  // 4:2:2 Y, U, V, A
  | 'I422A' // TODO: Not implemented in native
  | 'I422AP10' // TODO: Not implemented in native
  | 'I422AP12' // TODO: Not implemented in native
  // 4:4:4 Y, U, V
  | 'I444'
  | 'I444P10' // TODO: 10-bit not implemented in native
  | 'I444P12' // TODO: 12-bit not implemented in native
  // 4:4:4 Y, U, V, A
  | 'I444A' // TODO: Not implemented in native
  | 'I444AP10' // TODO: Not implemented in native
  | 'I444AP12' // TODO: Not implemented in native
  // 4:2:0 Y, UV (interleaved)
  | 'NV12'
  // 4:4:4 RGB variants
  | 'RGBA'
  | 'RGBX'
  | 'BGRA'
  | 'BGRX';

export interface VideoFrameCopyToOptions {
  rect?: {x: number; y: number; width: number; height: number};
  layout?: PlaneLayout[];
  format?: VideoPixelFormat;
}

// W3C VideoColorPrimaries enum values
export type VideoColorPrimaries =
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020'
  | 'smpte432';

// W3C VideoTransferCharacteristics enum values
export type VideoTransferCharacteristics =
  | 'bt709'
  | 'smpte170m'
  | 'iec61966-2-1'
  | 'linear'
  | 'pq'
  | 'hlg';

// W3C VideoMatrixCoefficients enum values
export type VideoMatrixCoefficients =
  | 'rgb'
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020-ncl';

export interface VideoColorSpaceInit {
  primaries?: VideoColorPrimaries | string;
  transfer?: VideoTransferCharacteristics | string;
  matrix?: VideoMatrixCoefficients | string;
  fullRange?: boolean;
}

export interface VideoDecoderConfig {
  codec: string;
  codedWidth?: number;
  codedHeight?: number;
  description?: ArrayBuffer | ArrayBufferView;
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
  displayAspectWidth?: number;
  displayAspectHeight?: number;
  rotation?: number; // 0, 90, 180, or 270 degrees per W3C spec
  flip?: boolean;
}

/**
 * Shape of VideoFrame objects passed to decoder output callbacks.
 */
export interface VideoFrameOutput {
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly format: string | null;
  readonly colorSpace: VideoColorSpaceInit;
  close(): void;
  clone(): VideoFrameOutput;
}

export interface VideoDecoderInit {
  output: (frame: VideoFrameOutput) => void;
  error: (error: Error) => void;
}

// Audio types
export type AudioSampleFormat =
  | 'u8'
  | 's16'
  | 's32'
  | 'f32'
  | 'u8-planar'
  | 's16-planar'
  | 's32-planar'
  | 'f32-planar';

export interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: ArrayBuffer | ArrayBufferView;
  transfer?: ArrayBuffer[];
}

// Opus-specific encoder configuration per W3C WebCodecs spec
export interface OpusEncoderConfig {
  application?: 'audio' | 'lowdelay' | 'voip';
  complexity?: number; // 0-10
  format?: 'opus' | 'ogg';
  frameDuration?: number; // microseconds
  packetlossperc?: number; // 0-100
  signal?: 'auto' | 'music' | 'voice';
  usedtx?: boolean;
  useinbandfec?: boolean;
}

export interface AudioEncoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
  bitrateMode?: 'constant' | 'variable';
  opus?: OpusEncoderConfig;
}

/**
 * Shape of EncodedAudioChunk objects passed to encoder output callbacks.
 */
export interface EncodedAudioChunkOutput {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(dest: BufferSource): void;
}

export interface AudioEncoderInit {
  output: (
    chunk: EncodedAudioChunkOutput,
    metadata?: EncodedAudioChunkMetadata,
  ) => void;
  error: (error: Error) => void;
}

export interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: ArrayBuffer | ArrayBufferView;
}

/**
 * Shape of AudioData objects passed to decoder output callbacks.
 */
export interface AudioDataOutput {
  readonly format: AudioSampleFormat | null;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly timestamp: number;
  readonly duration: number;
  close(): void;
  clone(): AudioDataOutput;
}

export interface AudioDecoderInit {
  output: (data: AudioDataOutput) => void;
  error: (error: Error) => void;
}

export interface AudioDataCopyToOptions {
  planeIndex?: number;
  frameOffset?: number;
  frameCount?: number;
  format?: AudioSampleFormat;
}

export interface EncodedAudioChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: BufferSource;
}

export type BufferSource = ArrayBuffer | ArrayBufferView;

// VideoFilter types
export interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoFilterConfig {
  width: number;
  height: number;
}

// Demuxer types
/**
 * Shape of chunk objects passed to demuxer onChunk callbacks.
 */
export interface DemuxerChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration?: number;
  readonly data: Buffer;
}

export interface DemuxerInit {
  onTrack?: (track: TrackInfo) => void;
  onChunk?: (chunk: DemuxerChunk, trackIndex: number) => void;
  onError?: (error: Error) => void;
}

export interface TrackInfo {
  index: number;
  type: 'video' | 'audio';
  codec: string;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
  extradata?: Uint8Array;
}

// High-resolution timestamp
export type DOMHighResTimeStamp = number;

// VideoFrameMetadata
export interface VideoFrameMetadata {
  captureTime?: DOMHighResTimeStamp;
  receiveTime?: DOMHighResTimeStamp;
  rtpTimestamp?: number;
}

// ImageDecoder types
export interface ImageDecodeOptions {
  frameIndex?: number;
  completeFramesOnly?: boolean;
}

export interface ImageDecodeResult {
  image: VideoFrameOutput;
  complete: boolean;
}

export interface ImageDecoderInit {
  type: string;
  data: ReadableStream<Uint8Array> | BufferSource;
  colorSpaceConversion?: 'default' | 'none';
  desiredWidth?: number;
  desiredHeight?: number;
  preferAnimation?: boolean;
}

export interface ImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number;
  selected: boolean;
}

export interface ImageTrackList {
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack: ImageTrack | null;
  readonly ready: Promise<void>;
  [index: number]: ImageTrack;
}

// Enhanced audio encoder metadata
export interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig & {
    description?: ArrayBuffer;
  };
}
