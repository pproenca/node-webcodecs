/**
 * Type definitions for the native C++ addon bindings.
 * These interfaces describe the shape of objects returned by the native module.
 */

import type {
  VideoColorSpaceInit,
  VideoEncoderConfig,
  VideoDecoderConfig,
  AudioEncoderConfig,
  AudioDecoderConfig,
  VideoFilterConfig,
  BlurRegion,
  TrackInfo,
  CodecState,
  AudioSampleFormat,
} from './types';

// Branded type for closed resources
declare const ClosedBrand: unique symbol;
export type Closed = {readonly [ClosedBrand]: true};

/**
 * Native VideoFrame object from C++ addon
 */
export interface NativeVideoFrame {
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly format: string;
  readonly rotation: number;
  readonly flip: boolean;
  readonly colorSpace: VideoColorSpaceInit;
  readonly data: Buffer;
  readonly visibleRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  close(): void;
  getData(): Buffer;
  clone(): NativeVideoFrame;
  allocationSize(options?: {format?: string}): number;
  copyTo(
    dest: Uint8Array | ArrayBuffer,
    options?: {format?: string},
  ): Promise<PlaneLayoutResult[]>;
}

export interface PlaneLayoutResult {
  offset: number;
  stride: number;
}

/**
 * Native VideoEncoder object from C++ addon
 */
export interface NativeVideoEncoder {
  readonly state: CodecState;
  readonly encodeQueueSize: number;
  readonly codecSaturated: boolean;

  configure(config: VideoEncoderConfig): void;
  encode(frame: NativeVideoFrame, options?: {keyFrame?: boolean}): void;
  flush(): void;
  reset(): void;
  close(): void;
}

/**
 * Native VideoDecoder object from C++ addon
 */
export interface NativeVideoDecoder {
  readonly state: CodecState;
  readonly decodeQueueSize: number;
  readonly codecSaturated: boolean;

  configure(config: VideoDecoderConfig): void;
  decode(chunk: NativeEncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Native EncodedVideoChunk object from C++ addon
 */
export interface NativeEncodedVideoChunk {
  readonly type: string;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;

  copyTo(dest: Uint8Array | ArrayBuffer): void;
}

/**
 * Native AudioData object from C++ addon
 */
export interface NativeAudioData {
  readonly format: AudioSampleFormat;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly timestamp: number;
  readonly duration: number;

  close(): void;
  clone(): NativeAudioData;
  allocationSize(options?: {planeIndex?: number; format?: string}): number;
  copyTo(
    dest: Uint8Array | ArrayBuffer,
    options?: {planeIndex?: number; format?: string},
  ): void;
}

/**
 * Native EncodedAudioChunk object from C++ addon
 */
export interface NativeEncodedAudioChunk {
  readonly type: string;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;

  copyTo(dest: Uint8Array | ArrayBuffer): void;
}

/**
 * Native AudioEncoder object from C++ addon
 */
export interface NativeAudioEncoder {
  readonly state: CodecState;
  readonly encodeQueueSize: number;
  readonly codecSaturated: boolean;

  configure(config: AudioEncoderConfig): void;
  encode(data: NativeAudioData): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Native AudioDecoder object from C++ addon
 */
export interface NativeAudioDecoder {
  readonly state: CodecState;
  readonly decodeQueueSize: number;

  configure(config: AudioDecoderConfig): void;
  decode(chunk: NativeEncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Native VideoFilter object from C++ addon
 */
export interface NativeVideoFilter {
  applyBlur(
    frameData: Buffer,
    regions: BlurRegion[],
    blurRadius: number,
  ): Buffer;
  close(): void;
}

/**
 * Native Demuxer object from C++ addon
 */
export interface NativeDemuxer {
  open(path: string): void;
  demux(): void;
  close(): void;
  getVideoTrack(): TrackInfo | null;
  getAudioTrack(): TrackInfo | null;
}

/**
 * Native ImageDecoder object from C++ addon
 */
export interface NativeImageDecoder {
  readonly type: string;
  readonly complete: boolean;
  readonly completed: Promise<void>;
  readonly tracks: NativeImageTrackList;

  decode(options?: {frameIndex?: number}): Promise<NativeImageDecodeResult>;
  reset(): void;
  close(): void;
}

export interface NativeImageTrackList {
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack: NativeImageTrack | null;
  readonly ready: Promise<void>;
  [index: number]: NativeImageTrack;
}

export interface NativeImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number;
  selected: boolean;
}

export interface NativeImageDecodeResult {
  image: NativeVideoFrame;
  complete: boolean;
}

/**
 * Callback types for encoder/decoder output
 */
export type VideoEncoderOutputCallback = (
  chunk: {
    type: string;
    timestamp: number;
    duration: number | null;
    data: Buffer;
    byteLength: number;
  },
  metadata?: {
    decoderConfig?: {
      codec: string;
      codedWidth?: number;
      codedHeight?: number;
      displayAspectWidth?: number;
      displayAspectHeight?: number;
      description?: ArrayBuffer;
      colorSpace?: VideoColorSpaceInit;
    };
    svc?: {temporalLayerId: number};
    alphaSideData?: ArrayBuffer;
  },
) => void;

export type VideoDecoderOutputCallback = (frame: NativeVideoFrame) => void;
export type AudioEncoderOutputCallback = (
  chunk: {
    type: string;
    timestamp: number;
    duration: number | null;
    data: Buffer;
    byteLength: number;
  },
  metadata?: {
    decoderConfig?: AudioDecoderConfig & {description?: ArrayBuffer};
  },
) => void;
export type AudioDecoderOutputCallback = (data: NativeAudioData) => void;
export type ErrorCallback = (error: Error | DOMException) => void;
export type DemuxerTrackCallback = (track: TrackInfo) => void;
export type DemuxerChunkCallback = (
  chunk: {
    type: string;
    timestamp: number;
    duration?: number;
    data: Buffer;
  },
  trackIndex: number,
) => void;

/**
 * Constructor types for native classes
 */
export interface NativeVideoFrameConstructor {
  new (
    data: Buffer,
    init: {
      format: string;
      codedWidth: number;
      codedHeight: number;
      timestamp: number;
      duration?: number;
      displayWidth?: number;
      displayHeight?: number;
      rotation?: number;
      flip?: boolean;
    },
  ): NativeVideoFrame;
}

export interface NativeVideoEncoderConstructor {
  new (callbacks: {
    output: VideoEncoderOutputCallback;
    error: ErrorCallback;
  }): NativeVideoEncoder;
  isConfigSupported(
    config: VideoEncoderConfig,
  ): Promise<{supported: boolean; config: VideoEncoderConfig}>;
}

export interface NativeVideoDecoderConstructor {
  new (callbacks: {
    output: VideoDecoderOutputCallback;
    error: ErrorCallback;
  }): NativeVideoDecoder;
  isConfigSupported(
    config: VideoDecoderConfig,
  ): Promise<{supported: boolean; config: VideoDecoderConfig}>;
}

export interface NativeAudioDataConstructor {
  new (init: {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: Buffer;
  }): NativeAudioData;
}

export interface NativeEncodedVideoChunkConstructor {
  new (init: {
    type: string;
    timestamp: number;
    duration?: number;
    data: Buffer;
  }): NativeEncodedVideoChunk;
}

export interface NativeEncodedAudioChunkConstructor {
  new (init: {
    type: string;
    timestamp: number;
    duration?: number;
    data: Buffer;
  }): NativeEncodedAudioChunk;
}

export interface NativeAudioEncoderConstructor {
  new (callbacks: {
    output: AudioEncoderOutputCallback;
    error: ErrorCallback;
  }): NativeAudioEncoder;
  isConfigSupported(
    config: AudioEncoderConfig,
  ): Promise<{supported: boolean; config: AudioEncoderConfig}>;
}

export interface NativeAudioDecoderConstructor {
  new (callbacks: {
    output: AudioDecoderOutputCallback;
    error: ErrorCallback;
  }): NativeAudioDecoder;
  isConfigSupported(
    config: AudioDecoderConfig,
  ): Promise<{supported: boolean; config: AudioDecoderConfig}>;
}

export interface NativeVideoFilterConstructor {
  new (config: VideoFilterConfig): NativeVideoFilter;
}

export interface NativeDemuxerConstructor {
  new (callbacks: {
    onTrack?: DemuxerTrackCallback;
    onChunk?: DemuxerChunkCallback;
    onError?: ErrorCallback;
  }): NativeDemuxer;
}

export interface NativeImageDecoderConstructor {
  new (init: {type: string; data: Buffer}): NativeImageDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

/**
 * The native module interface
 */
export interface NativeModule {
  VideoFrame: NativeVideoFrameConstructor;
  VideoEncoder: NativeVideoEncoderConstructor;
  VideoDecoder: NativeVideoDecoderConstructor;
  EncodedVideoChunk: NativeEncodedVideoChunkConstructor;
  AudioData: NativeAudioDataConstructor;
  EncodedAudioChunk: NativeEncodedAudioChunkConstructor;
  AudioEncoder: NativeAudioEncoderConstructor;
  AudioDecoder: NativeAudioDecoderConstructor;
  VideoFilter: NativeVideoFilterConstructor;
  Demuxer: NativeDemuxerConstructor;
  ImageDecoder: NativeImageDecoderConstructor;
}
