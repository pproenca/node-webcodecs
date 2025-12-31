/**
 * W3C WebCodecs API Type Definitions
 * https://www.w3.org/TR/webcodecs/
 *
 * This file defines TypeScript types that match the W3C WebCodecs specification exactly.
 * Types are organized to mirror the WebIDL specification structure.
 */

// =============================================================================
// FUNDAMENTAL TYPES
// =============================================================================

/** WebIDL: typedef (ArrayBuffer or ArrayBufferView) AllowSharedBufferSource */
export type AllowSharedBufferSource = ArrayBuffer | ArrayBufferView;

/** WebIDL: typedef (ArrayBuffer or ArrayBufferView) BufferSource */
export type BufferSource = ArrayBuffer | ArrayBufferView;

/** WebIDL: typedef double DOMHighResTimeStamp */
export type DOMHighResTimeStamp = number;

// =============================================================================
// CODEC STATE
// =============================================================================

/**
 * WebIDL:
 * enum CodecState { "unconfigured", "configured", "closed" };
 */
export type CodecState = 'unconfigured' | 'configured' | 'closed';

// =============================================================================
// HARDWARE ACCELERATION
// =============================================================================

/**
 * WebIDL:
 * enum HardwareAcceleration { "no-preference", "prefer-hardware", "prefer-software" };
 *
 * Per W3C WebCodecs spec: https://www.w3.org/TR/webcodecs/#hardware-acceleration
 * - "no-preference": UA may use hardware acceleration if available
 * - "prefer-hardware": UA should prefer hardware acceleration
 * - "prefer-software": UA should prefer software implementation
 */
export type HardwareAcceleration =
  | 'no-preference'
  | 'prefer-hardware'
  | 'prefer-software';

// =============================================================================
// ALPHA OPTION
// =============================================================================

/**
 * WebIDL:
 * enum AlphaOption { "keep", "discard" };
 */
export type AlphaOption = 'keep' | 'discard';

// =============================================================================
// LATENCY MODE
// =============================================================================

/**
 * WebIDL:
 * enum LatencyMode { "quality", "realtime" };
 */
export type LatencyMode = 'quality' | 'realtime';

// =============================================================================
// BITRATE MODES
// =============================================================================

/**
 * WebIDL:
 * enum VideoEncoderBitrateMode { "constant", "variable", "quantizer" };
 */
export type VideoEncoderBitrateMode = 'constant' | 'variable' | 'quantizer';

/**
 * WebIDL:
 * enum BitrateMode { "constant", "variable" };
 */
export type BitrateMode = 'constant' | 'variable';

// =============================================================================
// ENCODED CHUNK TYPES
// =============================================================================

/**
 * WebIDL:
 * enum EncodedAudioChunkType { "key", "delta" };
 */
export type EncodedAudioChunkType = 'key' | 'delta';

/**
 * WebIDL:
 * enum EncodedVideoChunkType { "key", "delta" };
 */
export type EncodedVideoChunkType = 'key' | 'delta';

// =============================================================================
// AUDIO SAMPLE FORMAT
// =============================================================================

/**
 * WebIDL:
 * enum AudioSampleFormat {
 *   "u8", "s16", "s32", "f32",
 *   "u8-planar", "s16-planar", "s32-planar", "f32-planar"
 * };
 */
export type AudioSampleFormat =
  | 'u8'
  | 's16'
  | 's32'
  | 'f32'
  | 'u8-planar'
  | 's16-planar'
  | 's32-planar'
  | 'f32-planar';

// =============================================================================
// VIDEO PIXEL FORMAT
// =============================================================================

/**
 * WebIDL:
 * enum VideoPixelFormat { ... };
 */
export type VideoPixelFormat =
  // 4:2:0 Y, U, V
  | 'I420'
  | 'I420P10'
  | 'I420P12'
  // 4:2:0 Y, U, V, A
  | 'I420A'
  | 'I420AP10'
  | 'I420AP12'
  // 4:2:2 Y, U, V
  | 'I422'
  | 'I422P10'
  | 'I422P12'
  // 4:2:2 Y, U, V, A
  | 'I422A'
  | 'I422AP10'
  | 'I422AP12'
  // 4:4:4 Y, U, V
  | 'I444'
  | 'I444P10'
  | 'I444P12'
  // 4:4:4 Y, U, V, A
  | 'I444A'
  | 'I444AP10'
  | 'I444AP12'
  // 4:2:0 Y, UV (semi-planar)
  | 'NV12'
  | 'NV21'
  | 'NV12P10'
  // 4:2:0 Y, UV, A (semi-planar with alpha) - W3C WebCodecs spec
  | 'NV12A'
  // 4:4:4 RGB variants
  | 'RGBA'
  | 'RGBX'
  | 'BGRA'
  | 'BGRX';

// =============================================================================
// VIDEO COLOR SPACE
// =============================================================================

/**
 * WebIDL:
 * enum VideoColorPrimaries { "bt709", "bt470bg", "smpte170m", "bt2020", "smpte432",
 *   "srgb", "bt470m", "smpte240m", "film", "xyz", "smpte431" };
 */
export type VideoColorPrimaries =
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020'
  | 'smpte432'
  | 'srgb'
  | 'bt470m'
  | 'smpte240m'
  | 'film'
  | 'xyz'
  | 'smpte431';

/**
 * WebIDL:
 * enum VideoTransferCharacteristics { "bt709", "smpte170m", "iec61966-2-1", "linear", "pq", "hlg",
 *   "gamma22curve", "gamma28curve", "smpte240m", "log", "logrt", "iec61966-2-4", "bt1361",
 *   "bt2020-10bit", "bt2020-12bit", "smpte2084", "smpte428", "arib-std-b67" };
 */
export type VideoTransferCharacteristics =
  | 'bt709'
  | 'smpte170m'
  | 'iec61966-2-1'
  | 'linear'
  | 'pq'
  | 'hlg'
  | 'gamma22curve'
  | 'gamma28curve'
  | 'smpte240m'
  | 'log'
  | 'logrt'
  | 'iec61966-2-4'
  | 'bt1361'
  | 'bt2020-10bit'
  | 'bt2020-12bit'
  | 'smpte2084'
  | 'smpte428'
  | 'arib-std-b67';

/**
 * WebIDL:
 * enum VideoMatrixCoefficients { "rgb", "bt709", "bt470bg", "smpte170m", "bt2020-ncl",
 *   "smpte240m", "bt2020-cl", "smpte2085" };
 */
export type VideoMatrixCoefficients =
  | 'rgb'
  | 'bt709'
  | 'bt470bg'
  | 'smpte170m'
  | 'bt2020-ncl'
  | 'smpte240m'
  | 'bt2020-cl'
  | 'smpte2085';

/**
 * WebIDL:
 * dictionary VideoColorSpaceInit {
 *   VideoColorPrimaries? primaries = null;
 *   VideoTransferCharacteristics? transfer = null;
 *   VideoMatrixCoefficients? matrix = null;
 *   boolean? fullRange = null;
 * };
 */
export interface VideoColorSpaceInit {
  primaries?: VideoColorPrimaries | null;
  transfer?: VideoTransferCharacteristics | null;
  matrix?: VideoMatrixCoefficients | null;
  fullRange?: boolean | null;
}

// =============================================================================
// DOM RECT TYPES
// =============================================================================

/**
 * WebIDL: DOMRectInit dictionary
 */
export interface DOMRectInit {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * WebIDL: DOMRectReadOnly interface
 */
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

// =============================================================================
// PLANE LAYOUT
// =============================================================================

/**
 * WebIDL:
 * dictionary PlaneLayout {
 *   [EnforceRange] required unsigned long offset;
 *   [EnforceRange] required unsigned long stride;
 * };
 */
export interface PlaneLayout {
  offset: number;
  stride: number;
}

// =============================================================================
// VIDEO FRAME METADATA
// =============================================================================

/**
 * WebIDL:
 * dictionary VideoFrameMetadata {
 *   // Possible members are recorded in the VideoFrame Metadata Registry.
 * };
 */
export interface VideoFrameMetadata {
  captureTime?: DOMHighResTimeStamp;
  receiveTime?: DOMHighResTimeStamp;
  rtpTimestamp?: number;
}

// =============================================================================
// VIDEO FRAME
// =============================================================================

/**
 * WebIDL:
 * dictionary VideoFrameInit { ... };
 */
export interface VideoFrameInit {
  duration?: number; // unsigned long long, microseconds
  timestamp?: number; // long long, microseconds
  alpha?: AlphaOption;
  visibleRect?: DOMRectInit;
  rotation?: number; // double, default 0
  flip?: boolean; // default false
  displayWidth?: number; // unsigned long
  displayHeight?: number; // unsigned long
  metadata?: VideoFrameMetadata;
}

/**
 * WebIDL:
 * dictionary VideoFrameBufferInit { ... };
 */
export interface VideoFrameBufferInit {
  format: VideoPixelFormat;
  codedWidth: number; // unsigned long
  codedHeight: number; // unsigned long
  timestamp: number; // long long, microseconds
  duration?: number; // unsigned long long, microseconds
  layout?: PlaneLayout[];
  visibleRect?: DOMRectInit;
  rotation?: number; // double, default 0
  flip?: boolean; // default false
  displayWidth?: number; // unsigned long
  displayHeight?: number; // unsigned long
  colorSpace?: VideoColorSpaceInit;
  transfer?: ArrayBuffer[];
  metadata?: VideoFrameMetadata;
}

/**
 * WebIDL:
 * dictionary VideoFrameCopyToOptions { ... };
 */
export interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
  format?: VideoPixelFormat;
  colorSpace?: PredefinedColorSpace;
}

/**
 * WebIDL: enum ColorSpaceConversion { "default", "none" };
 */
export type ColorSpaceConversion = 'default' | 'none';

/**
 * WebIDL: enum PredefinedColorSpace { "srgb", "display-p3" };
 */
export type PredefinedColorSpace = 'srgb' | 'display-p3';

// =============================================================================
// ENCODED VIDEO CHUNK
// =============================================================================

/**
 * WebIDL:
 * dictionary EncodedVideoChunkInit { ... };
 */
export interface EncodedVideoChunkInit {
  type: EncodedVideoChunkType;
  timestamp: number; // long long, microseconds
  duration?: number; // unsigned long long, microseconds
  data: AllowSharedBufferSource;
  transfer?: ArrayBuffer[];
}

/**
 * WebIDL:
 * dictionary EncodedVideoChunkMetadata { ... };
 */
export interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
  svc?: SvcOutputMetadata;
  alphaSideData?: BufferSource;
}

/**
 * WebIDL:
 * dictionary SvcOutputMetadata { unsigned long temporalLayerId; };
 */
export interface SvcOutputMetadata {
  temporalLayerId: number;
}

// =============================================================================
// ENCODED AUDIO CHUNK
// =============================================================================

/**
 * WebIDL:
 * dictionary EncodedAudioChunkInit { ... };
 */
export interface EncodedAudioChunkInit {
  type: EncodedAudioChunkType;
  timestamp: number; // long long, microseconds
  duration?: number; // unsigned long long, microseconds
  data: AllowSharedBufferSource;
  transfer?: ArrayBuffer[];
}

/**
 * WebIDL:
 * dictionary EncodedAudioChunkMetadata { AudioDecoderConfig decoderConfig; };
 */
export interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig;
}

// =============================================================================
// AUDIO DATA
// =============================================================================

/**
 * WebIDL:
 * dictionary AudioDataInit { ... };
 */
export interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number; // float
  numberOfFrames: number; // unsigned long
  numberOfChannels: number; // unsigned long
  timestamp: number; // long long, microseconds
  data: BufferSource;
  transfer?: ArrayBuffer[];
}

/**
 * WebIDL:
 * dictionary AudioDataCopyToOptions { ... };
 */
export interface AudioDataCopyToOptions {
  planeIndex: number; // required unsigned long
  frameOffset?: number; // unsigned long, default 0
  frameCount?: number; // unsigned long
  format?: AudioSampleFormat;
}

// =============================================================================
// VIDEO ENCODER
// =============================================================================

/**
 * WebIDL:
 * dictionary VideoEncoderConfig { ... };
 */
export interface VideoEncoderConfig {
  codec: string;
  width: number; // unsigned long
  height: number; // unsigned long
  displayWidth?: number; // unsigned long
  displayHeight?: number; // unsigned long
  bitrate?: number; // unsigned long long
  framerate?: number; // double
  hardwareAcceleration?: HardwareAcceleration;
  alpha?: AlphaOption;
  scalabilityMode?: string;
  bitrateMode?: VideoEncoderBitrateMode;
  latencyMode?: LatencyMode;
  contentHint?: string;
  // Codec-specific configurations per W3C WebCodecs Codec Registry
  avc?: AvcEncoderConfig;
  hevc?: HevcEncoderConfig;
}

/**
 * WebIDL:
 * dictionary VideoEncoderEncodeOptions { boolean keyFrame = false; };
 */
export interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
}

/**
 * Codec-specific encode options per W3C WebCodecs Codec Registry
 */
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

// =============================================================================
// CODEC-SPECIFIC ENCODER CONFIGURATIONS (W3C WebCodecs Codec Registry)
// =============================================================================

/**
 * WebIDL:
 * enum AvcBitstreamFormat { "annexb", "avc" };
 */
export type AvcBitstreamFormat = 'annexb' | 'avc';

/**
 * WebIDL:
 * dictionary AvcEncoderConfig {
 *   AvcBitstreamFormat format = "avc";
 * };
 */
export interface AvcEncoderConfig {
  format?: AvcBitstreamFormat;
}

/**
 * WebIDL:
 * enum HevcBitstreamFormat { "annexb", "hevc" };
 */
export type HevcBitstreamFormat = 'annexb' | 'hevc';

/**
 * WebIDL:
 * dictionary HevcEncoderConfig {
 *   HevcBitstreamFormat format = "hevc";
 * };
 */
export interface HevcEncoderConfig {
  format?: HevcBitstreamFormat;
}

/**
 * WebIDL:
 * dictionary VideoEncoderSupport { boolean supported; VideoEncoderConfig config; };
 */
export interface VideoEncoderSupport {
  supported: boolean;
  config: VideoEncoderConfig;
}

/**
 * WebIDL:
 * callback EncodedVideoChunkOutputCallback = undefined (EncodedVideoChunk chunk, optional EncodedVideoChunkMetadata metadata = {});
 */
export type EncodedVideoChunkOutputCallback = (
  chunk: EncodedVideoChunk,
  metadata?: EncodedVideoChunkMetadata,
) => void;

/**
 * WebIDL:
 * dictionary VideoEncoderInit { required EncodedVideoChunkOutputCallback output; required WebCodecsErrorCallback error; };
 */
export interface VideoEncoderInit {
  output: EncodedVideoChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

// =============================================================================
// VIDEO DECODER
// =============================================================================

/**
 * VideoDecoder configuration options.
 *
 * @see https://www.w3.org/TR/webcodecs/#videodecoderconfig
 *
 * WebIDL:
 * dictionary VideoDecoderConfig {
 *   required DOMString codec;
 *   AllowSharedBufferSource description;
 *   [EnforceRange] unsigned long codedWidth;
 *   [EnforceRange] unsigned long codedHeight;
 *   [EnforceRange] unsigned long displayAspectWidth;
 *   [EnforceRange] unsigned long displayAspectHeight;
 *   VideoColorSpaceInit colorSpace;
 *   HardwareAcceleration hardwareAcceleration = "no-preference";
 *   boolean optimizeForLatency;
 * };
 */
export interface VideoDecoderConfig {
  codec: string;
  description?: AllowSharedBufferSource;
  codedWidth?: number; // unsigned long
  codedHeight?: number; // unsigned long
  displayAspectWidth?: number; // unsigned long
  displayAspectHeight?: number; // unsigned long
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;

  /**
   * Rotation to apply to decoded frames.
   *
   * @nonstandard - node-webcodecs extension, not part of W3C WebCodecs spec.
   * Valid values: 0, 90, 180, or 270 (degrees clockwise).
   * Default: 0
   */
  rotation?: 0 | 90 | 180 | 270;

  /**
   * Whether to horizontally flip decoded frames.
   *
   * @nonstandard - node-webcodecs extension, not part of W3C WebCodecs spec.
   * Default: false
   */
  flip?: boolean;
}

/**
 * WebIDL:
 * dictionary VideoDecoderSupport { boolean supported; VideoDecoderConfig config; };
 */
export interface VideoDecoderSupport {
  supported: boolean;
  config: VideoDecoderConfig;
}

/**
 * WebIDL:
 * callback VideoFrameOutputCallback = undefined(VideoFrame output);
 */
export type VideoFrameOutputCallback = (frame: VideoFrame) => void;

/**
 * WebIDL:
 * dictionary VideoDecoderInit { required VideoFrameOutputCallback output; required WebCodecsErrorCallback error; };
 */
export interface VideoDecoderInit {
  output: VideoFrameOutputCallback;
  error: WebCodecsErrorCallback;
}

// =============================================================================
// AUDIO ENCODER
// =============================================================================

/**
 * WebIDL:
 * dictionary AudioEncoderConfig { ... };
 */
export interface AudioEncoderConfig {
  codec: string;
  sampleRate: number; // unsigned long
  numberOfChannels: number; // unsigned long
  bitrate?: number; // unsigned long long
  bitrateMode?: BitrateMode;
  // Codec-specific configurations per W3C WebCodecs Codec Registry
  opus?: OpusEncoderConfig;
  aac?: AacEncoderConfig;
}

/**
 * Opus-specific encoder configuration per W3C WebCodecs Codec Registry
 */
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

/**
 * WebIDL:
 * enum AacBitstreamFormat { "aac", "adts" };
 *
 * Per W3C AAC Codec Registration:
 * - "aac": Raw AAC, metadata via description (MP4 container)
 * - "adts": ADTS framing with inline metadata (streaming)
 */
export type AacBitstreamFormat = 'aac' | 'adts';

/**
 * WebIDL:
 * dictionary AacEncoderConfig {
 *   AacBitstreamFormat format = "aac";
 * };
 */
export interface AacEncoderConfig {
  format?: AacBitstreamFormat;
}

/**
 * WebIDL:
 * dictionary AudioEncoderSupport { boolean supported; AudioEncoderConfig config; };
 */
export interface AudioEncoderSupport {
  supported: boolean;
  config: AudioEncoderConfig;
}

/**
 * WebIDL:
 * callback EncodedAudioChunkOutputCallback = undefined (EncodedAudioChunk output, optional EncodedAudioChunkMetadata metadata = {});
 */
export type EncodedAudioChunkOutputCallback = (
  chunk: EncodedAudioChunk,
  metadata?: EncodedAudioChunkMetadata,
) => void;

/**
 * WebIDL:
 * dictionary AudioEncoderInit { required EncodedAudioChunkOutputCallback output; required WebCodecsErrorCallback error; };
 */
export interface AudioEncoderInit {
  output: EncodedAudioChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

// =============================================================================
// AUDIO DECODER
// =============================================================================

/**
 * WebIDL:
 * dictionary AudioDecoderConfig { ... };
 */
export interface AudioDecoderConfig {
  codec: string;
  sampleRate: number; // unsigned long
  numberOfChannels: number; // unsigned long
  description?: AllowSharedBufferSource;
}

/**
 * WebIDL:
 * dictionary AudioDecoderSupport { boolean supported; AudioDecoderConfig config; };
 */
export interface AudioDecoderSupport {
  supported: boolean;
  config: AudioDecoderConfig;
}

/**
 * WebIDL:
 * callback AudioDataOutputCallback = undefined(AudioData output);
 */
export type AudioDataOutputCallback = (data: AudioData) => void;

/**
 * WebIDL:
 * dictionary AudioDecoderInit { required AudioDataOutputCallback output; required WebCodecsErrorCallback error; };
 */
export interface AudioDecoderInit {
  output: AudioDataOutputCallback;
  error: WebCodecsErrorCallback;
}

// =============================================================================
// ERROR CALLBACK
// =============================================================================

/**
 * WebIDL:
 * callback WebCodecsErrorCallback = undefined(DOMException error);
 * NOTE: We accept Error | DOMException for Node.js compatibility
 */
export type WebCodecsErrorCallback = (error: Error | DOMException) => void;

// =============================================================================
// IMAGE DECODER
// =============================================================================

/**
 * WebIDL:
 * typedef (AllowSharedBufferSource or ReadableStream) ImageBufferSource;
 */
export type ImageBufferSource =
  | AllowSharedBufferSource
  | ReadableStream<Uint8Array>;

/**
 * WebIDL:
 * dictionary ImageDecoderInit {
 *   required DOMString type;
 *   required ImageBufferSource data;
 *   ColorSpaceConversion colorSpaceConversion = "default";
 *   [EnforceRange] unsigned long desiredWidth;
 *   [EnforceRange] unsigned long desiredHeight;
 *   boolean preferAnimation;
 *   sequence<ArrayBuffer> transfer = [];
 * };
 */
export interface ImageDecoderInit {
  type: string;
  data: ImageBufferSource;
  colorSpaceConversion?: ColorSpaceConversion;
  desiredWidth?: number;
  desiredHeight?: number;
  preferAnimation?: boolean;
  transfer?: ArrayBuffer[];
}

/**
 * WebIDL:
 * dictionary ImageDecodeOptions {
 *   [EnforceRange] unsigned long frameIndex = 0;
 *   boolean completeFramesOnly = true;
 * };
 */
export interface ImageDecodeOptions {
  frameIndex?: number;
  completeFramesOnly?: boolean;
}

/**
 * WebIDL:
 * dictionary ImageDecodeResult {
 *   required VideoFrame image;
 *   required boolean complete;
 * };
 */
export interface ImageDecodeResult {
  image: VideoFrame;
  complete: boolean;
}

/**
 * WebIDL:
 * interface ImageTrack {
 *   readonly attribute boolean animated;
 *   readonly attribute unsigned long frameCount;
 *   readonly attribute unrestricted float repetitionCount;
 *   attribute boolean selected;
 * };
 */
export interface ImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number; // unrestricted float, Infinity for infinite loop
  selected: boolean;
}

/**
 * WebIDL:
 * interface ImageTrackList {
 *   getter ImageTrack (unsigned long index);
 *   readonly attribute Promise<undefined> ready;
 *   readonly attribute unsigned long length;
 *   readonly attribute long selectedIndex;
 *   readonly attribute ImageTrack? selectedTrack;
 * };
 */
export interface ImageTrackList {
  readonly ready: Promise<void>;
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack: ImageTrack | null;
  [index: number]: ImageTrack;
}

// =============================================================================
// FORWARD DECLARATIONS FOR CIRCULAR REFERENCES
// These are the actual class interfaces that will be implemented in index.ts
// =============================================================================

/**
 * WebIDL: interface VideoFrame
 */
export interface VideoFrame {
  readonly format: VideoPixelFormat | null;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly codedRect: DOMRectReadOnly | null;
  readonly visibleRect: DOMRectReadOnly | null;
  readonly rotation: number;
  readonly flip: boolean;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly duration: number | null; // unsigned long long?, microseconds
  readonly timestamp: number; // long long, microseconds
  readonly colorSpace: VideoColorSpace;

  metadata(): VideoFrameMetadata;
  allocationSize(options?: VideoFrameCopyToOptions): number;
  copyTo(
    destination: AllowSharedBufferSource,
    options?: VideoFrameCopyToOptions,
  ): Promise<PlaneLayout[]>;
  clone(): VideoFrame;
  close(): void;
}

/**
 * WebIDL: interface VideoColorSpace
 */
export interface VideoColorSpace {
  readonly primaries: VideoColorPrimaries | null;
  readonly transfer: VideoTransferCharacteristics | null;
  readonly matrix: VideoMatrixCoefficients | null;
  readonly fullRange: boolean | null;

  toJSON(): VideoColorSpaceInit;
}

/**
 * WebIDL: interface EncodedVideoChunk
 */
export interface EncodedVideoChunk {
  readonly type: EncodedVideoChunkType;
  readonly timestamp: number; // long long, microseconds
  readonly duration: number | null; // unsigned long long?, microseconds
  readonly byteLength: number; // unsigned long

  copyTo(destination: AllowSharedBufferSource): void;
}

/**
 * WebIDL: interface EncodedAudioChunk
 */
export interface EncodedAudioChunk {
  readonly type: EncodedAudioChunkType;
  readonly timestamp: number; // long long, microseconds
  readonly duration: number | null; // unsigned long long?, microseconds
  readonly byteLength: number; // unsigned long

  copyTo(destination: AllowSharedBufferSource): void;
}

/**
 * WebIDL: interface AudioData
 */
export interface AudioData {
  readonly format: AudioSampleFormat | null;
  readonly sampleRate: number; // float
  readonly numberOfFrames: number; // unsigned long
  readonly numberOfChannels: number; // unsigned long
  readonly duration: number; // unsigned long long, microseconds
  readonly timestamp: number; // long long, microseconds

  allocationSize(options: AudioDataCopyToOptions): number;
  copyTo(
    destination: AllowSharedBufferSource,
    options: AudioDataCopyToOptions,
  ): void;
  clone(): AudioData;
  close(): void;
}

/**
 * WebIDL: interface VideoEncoder : EventTarget
 * Implements EventTarget for 'dequeue' event support.
 */
export interface VideoEncoder extends EventTarget {
  readonly state: CodecState;
  readonly encodeQueueSize: number; // unsigned long
  ondequeue: (() => void) | null; // EventHandler

  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Static methods for VideoEncoder
 * WebIDL: static Promise<VideoEncoderSupport> isConfigSupported(VideoEncoderConfig config);
 */
export interface VideoEncoderConstructor {
  new (init: VideoEncoderInit): VideoEncoder;
  isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;
}

/**
 * WebIDL: interface VideoDecoder : EventTarget
 * Implements EventTarget for 'dequeue' event support.
 */
export interface VideoDecoder extends EventTarget {
  readonly state: CodecState;
  readonly decodeQueueSize: number; // unsigned long
  ondequeue: (() => void) | null; // EventHandler

  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Static methods for VideoDecoder
 * WebIDL: static Promise<VideoDecoderSupport> isConfigSupported(VideoDecoderConfig config);
 */
export interface VideoDecoderConstructor {
  new (init: VideoDecoderInit): VideoDecoder;
  isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
}

/**
 * WebIDL: interface AudioEncoder : EventTarget
 * Implements EventTarget for 'dequeue' event support.
 */
export interface AudioEncoder extends EventTarget {
  readonly state: CodecState;
  readonly encodeQueueSize: number; // unsigned long
  ondequeue: (() => void) | null; // EventHandler

  configure(config: AudioEncoderConfig): void;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Static methods for AudioEncoder
 * WebIDL: static Promise<AudioEncoderSupport> isConfigSupported(AudioEncoderConfig config);
 */
export interface AudioEncoderConstructor {
  new (init: AudioEncoderInit): AudioEncoder;
  isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
}

/**
 * WebIDL: interface AudioDecoder : EventTarget
 * Implements EventTarget for 'dequeue' event support.
 */
export interface AudioDecoder extends EventTarget {
  readonly state: CodecState;
  readonly decodeQueueSize: number; // unsigned long
  ondequeue: (() => void) | null; // EventHandler

  configure(config: AudioDecoderConfig): void;
  decode(chunk: EncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
}

/**
 * Static methods for AudioDecoder
 * WebIDL: static Promise<AudioDecoderSupport> isConfigSupported(AudioDecoderConfig config);
 */
export interface AudioDecoderConstructor {
  new (init: AudioDecoderInit): AudioDecoder;
  isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
}

/**
 * WebIDL: interface ImageDecoder
 */
export interface ImageDecoder {
  readonly type: string;
  readonly complete: boolean;
  readonly completed: Promise<void>;
  readonly tracks: ImageTrackList;

  decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult>;
  reset(): void;
  close(): void;
}

/**
 * Static methods for ImageDecoder
 * WebIDL: static Promise<boolean> isTypeSupported(DOMString type);
 */
export interface ImageDecoderConstructor {
  new (init: ImageDecoderInit): ImageDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

/**
 * Constructor for VideoFrame
 * WebIDL:
 *   constructor(CanvasImageSource image, optional VideoFrameInit init = {});
 *   constructor(AllowSharedBufferSource data, VideoFrameBufferInit init);
 */
export interface VideoFrameConstructor {
  // TODO: CanvasImageSource constructor not supported in Node.js
  new (data: AllowSharedBufferSource, init: VideoFrameBufferInit): VideoFrame;
}

/**
 * Constructor for VideoColorSpace
 * WebIDL: constructor(optional VideoColorSpaceInit init = {});
 */
export interface VideoColorSpaceConstructor {
  new (init?: VideoColorSpaceInit): VideoColorSpace;
}

/**
 * Constructor for EncodedVideoChunk
 * WebIDL: constructor(EncodedVideoChunkInit init);
 */
export interface EncodedVideoChunkConstructor {
  new (init: EncodedVideoChunkInit): EncodedVideoChunk;
}

/**
 * Constructor for EncodedAudioChunk
 * WebIDL: constructor(EncodedAudioChunkInit init);
 */
export interface EncodedAudioChunkConstructor {
  new (init: EncodedAudioChunkInit): EncodedAudioChunk;
}

/**
 * Constructor for AudioData
 * WebIDL: constructor(AudioDataInit init);
 */
export interface AudioDataConstructor {
  new (init: AudioDataInit): AudioData;
}

// =============================================================================
// ADDITIONAL TYPES (not in W3C spec but needed for our implementation)
// =============================================================================

/** Blur region for VideoFilter */
export interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** VideoFilter configuration */
export interface VideoFilterConfig {
  width: number;
  height: number;
}

/** Demuxer chunk */
export interface DemuxerChunk {
  readonly type: EncodedVideoChunkType;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: AllowSharedBufferSource): void;
}

/** Demuxer track info */
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

/** Demuxer initialization */
export interface DemuxerInit {
  onTrack?: (track: TrackInfo) => void;
  onChunk?: (chunk: DemuxerChunk, trackIndex: number) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// MUXER TYPES
// =============================================================================

/**
 * Configuration for Muxer initialization
 */
export interface MuxerInit {
  filename: string;
  format?: 'mp4';  // Currently only MP4 supported
}

/**
 * Configuration for adding a video track to the Muxer
 */
export interface MuxerVideoTrackConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  description?: ArrayBuffer | Uint8Array;
}

/**
 * Configuration for adding an audio track to the Muxer
 */
export interface MuxerAudioTrackConfig {
  codec: string;
  sampleRate?: number;
  numberOfChannels?: number;
  bitrate?: number;
  description?: ArrayBuffer | Uint8Array;
}
