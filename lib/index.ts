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

import type {
  VideoEncoderConfig,
  VideoEncoderInit,
  VideoDecoderConfig,
  VideoDecoderInit,
  VideoFrameBufferInit,
  VideoFrameInit,
  VideoFrameMetadata,
  VideoColorSpaceInit,
  VideoColorPrimaries,
  VideoTransferCharacteristics,
  VideoMatrixCoefficients,
  CodecState,
  PlaneLayout,
  VideoFrameCopyToOptions,
  VideoPixelFormat,
  AudioSampleFormat,
  AudioDataInit,
  AudioDataCopyToOptions,
  AudioEncoderConfig,
  AudioEncoderInit,
  AudioDecoderConfig,
  AudioDecoderInit,
  EncodedVideoChunkInit,
  EncodedAudioChunkInit,
  BlurRegion,
  VideoFilterConfig,
  DemuxerInit,
  TrackInfo,
  DOMRectReadOnly,
  ImageDecoderInit,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageTrackList,
} from './types';
import type {
  NativeModule,
  NativeVideoFrame,
  NativeVideoEncoder,
  NativeVideoDecoder,
  NativeAudioData,
  NativeEncodedVideoChunk,
  NativeEncodedAudioChunk,
  NativeAudioEncoder,
  NativeAudioDecoder,
  NativeVideoFilter,
  NativeDemuxer,
  NativeImageDecoder,
  VideoEncoderOutputCallback,
  VideoDecoderOutputCallback,
  AudioEncoderOutputCallback,
  AudioDecoderOutputCallback,
} from './native-types';
import {ControlMessageQueue} from './control-message-queue';
import {ResourceManager} from './resource-manager';
import {binding, platformInfo} from './binding';

// Load native addon with type assertion
const native = binding as NativeModule;

// Export platform info for debugging
export {platformInfo};

/**
 * Detach ArrayBuffers per W3C WebCodecs transfer semantics.
 * Uses structuredClone with transfer to detach, making the original buffer unusable.
 */
function detachArrayBuffers(buffers: ArrayBuffer[]): void {
  for (const buffer of buffers) {
    if (buffer.byteLength === 0) continue; // Already detached
    try {
      // Modern approach: use structuredClone with transfer to detach
      // This makes the original buffer unusable (byteLength becomes 0)
      structuredClone(buffer, {transfer: [buffer]});
    } catch {
      // Fallback for environments without transfer support
      // We can't truly detach, but the data has been copied to native
      console.warn('ArrayBuffer transfer not supported, data copied instead');
    }
  }
}

/**
 * Abstract base class for all WebCodecs codec classes.
 * Provides EventTarget inheritance and common dequeue event handling.
 * Per W3C WebCodecs spec, all codecs extend EventTarget.
 */
abstract class CodecBase extends EventTarget {
  protected _ondequeue: (() => void) | null = null;

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  /**
   * Triggers the 'dequeue' event per W3C spec.
   * Dispatches both the standard Event and calls the legacy callback.
   */
  protected _triggerDequeue(): void {
    // Dispatch standard EventTarget event
    this.dispatchEvent(new Event('dequeue'));

    // Also call legacy ondequeue callback for backwards compatibility
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }
}

export class VideoColorSpace {
  readonly primaries: VideoColorPrimaries | null;
  readonly transfer: VideoTransferCharacteristics | null;
  readonly matrix: VideoMatrixCoefficients | null;
  readonly fullRange: boolean | null;

  constructor(init?: VideoColorSpaceInit) {
    // Cast to enum types - values from native layer should match W3C enums
    this.primaries = (init?.primaries as VideoColorPrimaries) ?? null;
    this.transfer = (init?.transfer as VideoTransferCharacteristics) ?? null;
    this.matrix = (init?.matrix as VideoMatrixCoefficients) ?? null;
    this.fullRange = init?.fullRange ?? null;
  }

  toJSON(): VideoColorSpaceInit {
    return {
      primaries: this.primaries,
      transfer: this.transfer,
      matrix: this.matrix,
      fullRange: this.fullRange,
    };
  }
}

export class VideoFrame {
  private _native: NativeVideoFrame;
  private _closed: boolean = false;
  private _metadata: VideoFrameMetadata;
  private _timestampOverride?: number;
  private _durationOverride?: number;
  private _visibleRectOverride?: {x: number; y: number; width: number; height: number};

  /**
   * Constructs a VideoFrame from raw data or from an existing VideoFrame.
   *
   * Per W3C WebCodecs spec, VideoFrame can be constructed from:
   * 1. Raw buffer data with VideoFrameBufferInit
   * 2. An existing VideoFrame with optional VideoFrameInit overrides
   */
  constructor(data: Buffer | Uint8Array | ArrayBuffer, init: VideoFrameBufferInit);
  constructor(source: VideoFrame, init?: VideoFrameInit);
  constructor(
    dataOrSource: Buffer | Uint8Array | ArrayBuffer | VideoFrame,
    init?: VideoFrameBufferInit | VideoFrameInit,
  ) {
    // Check if constructing from existing VideoFrame
    if (dataOrSource instanceof VideoFrame) {
      const source = dataOrSource;
      const frameInit = init as VideoFrameInit | undefined;

      // W3C spec: throw InvalidStateError if source frame is closed (detached)
      if (source._closed) {
        throw new DOMException(
          'Cannot construct VideoFrame from closed VideoFrame',
          'InvalidStateError',
        );
      }

      // Clone the native frame
      this._native = source._native.clone();
      this._closed = false;

      // Copy metadata from source
      this._metadata = {...source._metadata};

      // Apply overrides from init if provided
      if (frameInit) {
        // Override timestamp if provided
        if (frameInit.timestamp !== undefined) {
          this._timestampOverride = frameInit.timestamp;
        }

        // Override duration if provided
        if (frameInit.duration !== undefined) {
          this._durationOverride = frameInit.duration;
        }

        // Override visibleRect if provided
        if (frameInit.visibleRect) {
          this._visibleRectOverride = {
            x: frameInit.visibleRect.x ?? 0,
            y: frameInit.visibleRect.y ?? 0,
            width: frameInit.visibleRect.width ?? this._native.visibleRect.width,
            height: frameInit.visibleRect.height ?? this._native.visibleRect.height,
          };
        }

        // Override metadata if provided
        if (frameInit.metadata) {
          this._metadata = {...this._metadata, ...frameInit.metadata};
        }
      }
      return;
    }

    // Original buffer-based construction
    const data = dataOrSource;
    const bufferInit = init as VideoFrameBufferInit;

    // Convert to Buffer if needed
    let dataBuffer: Buffer;
    if (data instanceof Buffer) {
      dataBuffer = data;
    } else if (data instanceof Uint8Array) {
      dataBuffer = Buffer.from(data);
    } else if (data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(data);
    } else {
      throw new TypeError('data must be Buffer, Uint8Array, or ArrayBuffer');
    }
    this._native = new native.VideoFrame(dataBuffer, bufferInit);

    // Store metadata per W3C VideoFrame Metadata Registry
    this._metadata = bufferInit.metadata ?? {};

    // Handle ArrayBuffer transfer semantics per W3C WebCodecs spec
    if (bufferInit.transfer && Array.isArray(bufferInit.transfer)) {
      detachArrayBuffers(bufferInit.transfer);
    }
  }

  get codedWidth(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.codedWidth;
  }

  get codedHeight(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.codedHeight;
  }

  get timestamp(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    if (this._timestampOverride !== undefined) {
      return this._timestampOverride;
    }
    return this._native.timestamp;
  }

  get format(): VideoPixelFormat | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Cast native format string to VideoPixelFormat enum
    return (this._native.format as VideoPixelFormat) ?? null;
  }

  get duration(): number | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    if (this._durationOverride !== undefined) {
      return this._durationOverride;
    }
    return this._native.duration ?? null;
  }

  get displayWidth(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.displayWidth;
  }

  get displayHeight(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.displayHeight;
  }

  get codedRect(): DOMRectReadOnly | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    const w = this.codedWidth;
    const h = this.codedHeight;
    return {
      x: 0,
      y: 0,
      width: w,
      height: h,
      top: 0,
      left: 0,
      right: w,
      bottom: h,
    };
  }

  get visibleRect(): DOMRectReadOnly | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    const rect = this._visibleRectOverride ?? this._native.visibleRect;
    // Return DOMRectReadOnly-compatible object with computed right/bottom/top/left
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };
  }

  private _throwIfClosed(): void {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
  }

  get colorSpace(): VideoColorSpace {
    // Return VideoColorSpace from native colorSpace data if available
    const nativeColorSpace = this._native.colorSpace;
    return new VideoColorSpace(nativeColorSpace);
  }

  get rotation(): number {
    return this._native.rotation ?? 0;
  }

  get flip(): boolean {
    return this._native.flip ?? false;
  }

  metadata(): VideoFrameMetadata {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    // Return a copy to prevent external mutation
    return {...this._metadata};
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  async copyTo(
    destination: ArrayBuffer | Uint8Array,
    options?: VideoFrameCopyToOptions,
  ): Promise<PlaneLayout[]> {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }

    // W3C spec: validate rect bounds before copying
    if (options?.rect) {
      const rect = options.rect;
      const rectX = rect.x ?? 0;
      const rectY = rect.y ?? 0;
      const rectWidth = rect.width ?? this._native.codedWidth;
      const rectHeight = rect.height ?? this._native.codedHeight;

      if (
        rectX < 0 ||
        rectY < 0 ||
        rectX + rectWidth > this._native.codedWidth ||
        rectY + rectHeight > this._native.codedHeight
      ) {
        throw new RangeError('rect exceeds coded frame dimensions');
      }
    }

    // Convert ArrayBuffer to Buffer for native layer
    let destBuffer: Buffer;
    let destLength: number;
    if (destination instanceof ArrayBuffer) {
      destBuffer = Buffer.from(destination);
      destLength = destination.byteLength;
    } else if (destination instanceof Uint8Array) {
      destBuffer = Buffer.from(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
      destLength = destination.byteLength;
    } else {
      throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
    }

    // W3C spec: validate buffer size before copying
    // When rect is specified, calculate size based on rect dimensions
    let requiredSize: number;
    if (options?.rect) {
      const rect = options.rect;
      const rectWidth = rect.width ?? this._native.codedWidth;
      const rectHeight = rect.height ?? this._native.codedHeight;
      // For buffer size validation with rect, calculate based on rect dimensions
      // The native allocationSize doesn't accept rect, so we calculate here
      const format = this._native.format;
      if (
        format === 'RGBA' ||
        format === 'RGBX' ||
        format === 'BGRA' ||
        format === 'BGRX'
      ) {
        // Packed RGB formats: 4 bytes per pixel
        requiredSize = rectWidth * rectHeight * 4;
      } else {
        // For planar formats, let native layer validate (it calculates correctly)
        requiredSize = 0;
      }
    } else {
      requiredSize = this._native.allocationSize(options || {});
    }
    if (requiredSize > 0 && destLength < requiredSize) {
      throw new RangeError(
        `Destination buffer too small: ${destLength} bytes provided, ${requiredSize} bytes required`,
      );
    }

    // Call native copyTo
    const layout = this._native.copyTo(destBuffer, options || {});

    // Copy back to original if it was an ArrayBuffer
    if (destination instanceof ArrayBuffer) {
      new Uint8Array(destination).set(destBuffer);
    } else if (destination instanceof Uint8Array) {
      destination.set(destBuffer);
    }

    return layout;
  }

  allocationSize(options?: {format?: VideoPixelFormat}): number {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    return this._native.allocationSize(options || {});
  }

  clone(): VideoFrame {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    const clonedNative = this._native.clone();
    // Wrap the cloned native frame
    const wrapper = Object.create(VideoFrame.prototype);
    wrapper._native = clonedNative;
    wrapper._closed = false;
    // Preserve metadata through clone
    wrapper._metadata = {...this._metadata};
    return wrapper;
  }

  // Internal access for native binding
  get _nativeFrame(): NativeVideoFrame {
    return this._native;
  }
}

export class VideoEncoder extends CodecBase {
  private _native: NativeVideoEncoder;
  private _state: CodecState = 'unconfigured';
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;
  private _resourceId: symbol;

  constructor(init: VideoEncoderInit) {
    super();
    // W3C spec: output and error callbacks are required
    if (!init || typeof init.output !== 'function') {
      throw new TypeError('output callback is required');
    }
    if (typeof init.error !== 'function') {
      throw new TypeError('error callback is required');
    }

    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);
    this._resourceId = ResourceManager.getInstance().register(this);

    const outputCallback: VideoEncoderOutputCallback = (chunk, metadata) => {
      // Decrement queue size when output received
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      const wrappedChunk = new EncodedVideoChunk({
        type: chunk.type as 'key' | 'delta',
        timestamp: chunk.timestamp,
        duration: chunk.duration ?? undefined,
        data: chunk.data,
      });
      init.output(wrappedChunk, metadata);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.VideoEncoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: VideoEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // Validate display dimensions pairing per W3C spec
    if (
      (config.displayWidth !== undefined) !==
      (config.displayHeight !== undefined)
    ) {
      throw new TypeError(
        'displayWidth and displayHeight must both be present or both absent',
      );
    }

    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  encode(frame: VideoFrame, options?: {keyFrame?: boolean}): void {
    ResourceManager.getInstance().recordActivity(this._resourceId);
    this._encodeQueueSize++;
    // Call native encode directly - frame must be valid at call time
    this._native.encode(frame._nativeFrame, options || {});
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(
        new DOMException('Encoder is not configured', 'InvalidStateError'),
      );
    }
    if (this.state === 'closed') {
      return Promise.reject(
        new DOMException('Encoder is closed', 'InvalidStateError'),
      );
    }
    await this._controlQueue.flush();
    return new Promise(resolve => {
      this._native.flush();
      resolve();
    });
  }

  reset(): void {
    this._controlQueue.clear();
    this._encodeQueueSize = 0;
    this._native.reset();
  }

  close(): void {
    ResourceManager.getInstance().unregister(this._resourceId);
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: VideoEncoderConfig): Promise<{
    supported: boolean;
    config: VideoEncoderConfig;
  }> {
    return native.VideoEncoder.isConfigSupported(config);
  }
}

export class EncodedVideoChunk {
  /** @internal */
  _native: NativeEncodedVideoChunk;

  constructor(init: EncodedVideoChunkInit) {
    // W3C spec: type must be 'key' or 'delta'
    if (init.type !== 'key' && init.type !== 'delta') {
      throw new TypeError(`Invalid type: ${init.type}`);
    }
    // Convert BufferSource to Buffer for native
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(
        init.data.buffer,
        init.data.byteOffset,
        init.data.byteLength,
      );
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.EncodedVideoChunk({
      type: init.type,
      timestamp: init.timestamp,
      duration: init.duration,
      data: dataBuffer,
    });
  }

  get type(): 'key' | 'delta' {
    return this._native.type as 'key' | 'delta';
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  get duration(): number | null {
    return this._native.duration;
  }

  get byteLength(): number {
    return this._native.byteLength;
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView): void {
    // Native layer accepts ArrayBuffer or Uint8Array
    if (destination instanceof ArrayBuffer) {
      this._native.copyTo(destination);
    } else if (destination instanceof Uint8Array) {
      this._native.copyTo(destination);
    } else if (ArrayBuffer.isView(destination)) {
      // Convert other ArrayBufferView types to Uint8Array
      const view = new Uint8Array(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
      this._native.copyTo(view);
    } else {
      throw new TypeError('Destination must be ArrayBuffer or ArrayBufferView');
    }
  }
}

export class VideoDecoder extends CodecBase {
  private _native: NativeVideoDecoder;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;
  private _resourceId: symbol;

  constructor(init: VideoDecoderInit) {
    super();
    // W3C spec: output and error callbacks are required
    if (!init || typeof init.output !== 'function') {
      throw new TypeError('output callback is required');
    }
    if (typeof init.error !== 'function') {
      throw new TypeError('error callback is required');
    }

    this._controlQueue = new ControlMessageQueue();
    this._errorCallback = init.error;
    this._controlQueue.setErrorHandler(init.error);
    this._resourceId = ResourceManager.getInstance().register(this);

    const outputCallback: VideoDecoderOutputCallback = nativeFrame => {
      // Decrement queue size when output received
      this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

      // Wrap the native frame as a VideoFrame
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(VideoFrame.prototype) as any;
      wrapper._native = nativeFrame;
      wrapper._closed = false;
      wrapper._metadata = {}; // Initialize empty metadata for decoded frames
      init.output(wrapper as VideoFrame);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.VideoDecoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: VideoDecoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }
    this._needsKeyFrame = true;
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  decode(chunk: EncodedVideoChunk): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state !== 'configured') {
      throw new DOMException(
        `Cannot decode in state "${this.state}"`,
        'InvalidStateError',
      );
    }

    // Check if first chunk must be a key frame per W3C spec
    if (this._needsKeyFrame && chunk.type !== 'key') {
      this._errorCallback(
        new DOMException(
          'First chunk after configure/reset must be a key frame',
          'DataError',
        ),
      );
      return;
    }
    this._needsKeyFrame = false;

    ResourceManager.getInstance().recordActivity(this._resourceId);
    this._decodeQueueSize++;
    // Pass the native chunk directly (no data copy needed)
    this._native.decode(chunk._native);
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(
        new DOMException('Decoder is not configured', 'InvalidStateError'),
      );
    }
    if (this.state === 'closed') {
      return Promise.reject(
        new DOMException('Decoder is closed', 'InvalidStateError'),
      );
    }
    await this._controlQueue.flush();
    return this._native.flush();
  }

  reset(): void {
    // W3C spec: throw InvalidStateError if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    this._controlQueue.clear();
    this._decodeQueueSize = 0;
    this._needsKeyFrame = true;
    this._native.reset();
  }

  close(): void {
    ResourceManager.getInstance().unregister(this._resourceId);
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: VideoDecoderConfig): Promise<{
    supported: boolean;
    config: VideoDecoderConfig;
  }> {
    return native.VideoDecoder.isConfigSupported(config);
  }
}

export class AudioData {
  private _native: NativeAudioData;
  private _closed: boolean = false;

  constructor(init: AudioDataInit) {
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(
        init.data.buffer,
        init.data.byteOffset,
        init.data.byteLength,
      );
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.AudioData({
      format: init.format,
      sampleRate: init.sampleRate,
      numberOfFrames: init.numberOfFrames,
      numberOfChannels: init.numberOfChannels,
      timestamp: init.timestamp,
      data: dataBuffer,
    });

    // Handle ArrayBuffer transfer semantics per W3C WebCodecs spec
    if (init.transfer && Array.isArray(init.transfer)) {
      detachArrayBuffers(init.transfer);
    }
  }

  get format(): AudioSampleFormat | null {
    return this._closed ? null : this._native.format;
  }

  get sampleRate(): number {
    return this._closed ? 0 : this._native.sampleRate;
  }

  get numberOfFrames(): number {
    return this._closed ? 0 : this._native.numberOfFrames;
  }

  get numberOfChannels(): number {
    return this._closed ? 0 : this._native.numberOfChannels;
  }

  get duration(): number {
    return this._closed ? 0 : this._native.duration;
  }

  get timestamp(): number {
    return this._closed ? 0 : this._native.timestamp;
  }

  allocationSize(options: AudioDataCopyToOptions): number {
    if (this._closed) {
      throw new DOMException(
        'InvalidStateError: AudioData is closed',
        'InvalidStateError',
      );
    }
    // W3C spec: planeIndex is required
    if (options.planeIndex === undefined || options.planeIndex === null) {
      throw new TypeError(
        "Failed to execute 'allocationSize' on 'AudioData': required member planeIndex is undefined.",
      );
    }
    return this._native.allocationSize(options);
  }

  copyTo(
    destination: ArrayBuffer | ArrayBufferView,
    options: AudioDataCopyToOptions,
  ): void {
    if (this._closed) {
      throw new DOMException(
        'InvalidStateError: AudioData is closed',
        'InvalidStateError',
      );
    }
    // W3C spec: planeIndex is required
    if (options.planeIndex === undefined || options.planeIndex === null) {
      throw new TypeError(
        "Failed to execute 'copyTo' on 'AudioData': required member planeIndex is undefined.",
      );
    }

    // W3C spec: check destination buffer size before copying
    // Must throw RangeError if buffer is too small
    const requiredSize = this._native.allocationSize(options);
    const destSize =
      destination instanceof ArrayBuffer
        ? destination.byteLength
        : destination.byteLength;
    if (destSize < requiredSize) {
      throw new RangeError(
        `destination buffer too small: requires ${requiredSize} bytes, got ${destSize}`,
      );
    }

    let destBuffer: Buffer;
    if (destination instanceof ArrayBuffer) {
      destBuffer = Buffer.from(destination);
    } else {
      destBuffer = Buffer.from(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
    }
    this._native.copyTo(destBuffer, options);
    // Copy back to original if it was an ArrayBuffer
    if (destination instanceof ArrayBuffer) {
      new Uint8Array(destination).set(destBuffer);
    }
  }

  clone(): AudioData {
    if (this._closed) {
      throw new DOMException(
        'InvalidStateError: AudioData is closed',
        'InvalidStateError',
      );
    }
    const clonedNative = this._native.clone();
    const wrapper = Object.create(AudioData.prototype);
    wrapper._native = clonedNative;
    wrapper._closed = false;
    return wrapper;
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  get _nativeAudioData(): NativeAudioData {
    return this._native;
  }
}

export class EncodedAudioChunk {
  private _native: NativeEncodedAudioChunk;

  constructor(init: EncodedAudioChunkInit) {
    // Convert BufferSource to Buffer for native
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(
        init.data.buffer,
        init.data.byteOffset,
        init.data.byteLength,
      );
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.EncodedAudioChunk({
      type: init.type,
      timestamp: init.timestamp,
      duration: init.duration,
      data: dataBuffer,
    });
  }

  get type(): 'key' | 'delta' {
    return this._native.type as 'key' | 'delta';
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  get duration(): number | null {
    return this._native.duration ?? null;
  }

  get byteLength(): number {
    return this._native.byteLength;
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView): void {
    // Convert ArrayBufferView to Uint8Array for native layer
    if (destination instanceof ArrayBuffer) {
      this._native.copyTo(destination);
    } else {
      const uint8 = new Uint8Array(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
      this._native.copyTo(uint8);
    }
  }

  get _nativeChunk(): NativeEncodedAudioChunk {
    return this._native;
  }
}

export class AudioEncoder extends CodecBase {
  private _native: NativeAudioEncoder;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;

  constructor(init: AudioEncoderInit) {
    super();

    // W3C spec: output and error callbacks are required
    if (!init || typeof init.output !== 'function') {
      throw new TypeError('output callback is required');
    }
    if (typeof init.error !== 'function') {
      throw new TypeError('error callback is required');
    }

    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioEncoderOutputCallback = (chunk, metadata) => {
      // Decrement queue size when output received
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(EncodedAudioChunk.prototype) as any;
      wrapper._native = chunk as unknown as NativeEncodedAudioChunk;
      init.output(wrapper as EncodedAudioChunk, metadata);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.AudioEncoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: AudioEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // W3C spec: validate required fields with TypeError
    if (config.codec === undefined || config.codec === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member codec is undefined.",
      );
    }
    if (config.sampleRate === undefined || config.sampleRate === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member sampleRate is undefined.",
      );
    }
    if (
      config.numberOfChannels === undefined ||
      config.numberOfChannels === null
    ) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member numberOfChannels is undefined.",
      );
    }

    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  encode(data: AudioData): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state === 'unconfigured') {
      throw new DOMException('Encoder is not configured', 'InvalidStateError');
    }
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    this._encodeQueueSize++;
    // Call native encode directly - data must be valid at call time
    this._native.encode(data._nativeAudioData);
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(
        new DOMException('Encoder is not configured', 'InvalidStateError'),
      );
    }
    if (this.state === 'closed') {
      return Promise.reject(
        new DOMException('Encoder is closed', 'InvalidStateError'),
      );
    }

    await this._controlQueue.flush();
    return this._native.flush();
  }

  reset(): void {
    // W3C spec: reset() is a no-op when closed (does NOT throw)
    if (this.state === 'closed') {
      return;
    }

    this._controlQueue.clear();
    this._encodeQueueSize = 0;
    this._native.reset();
  }

  close(): void {
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: AudioEncoderConfig): Promise<{
    supported: boolean;
    config: AudioEncoderConfig;
  }> {
    return native.AudioEncoder.isConfigSupported(config);
  }
}

export class AudioDecoder extends CodecBase {
  private _native: NativeAudioDecoder;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;

  constructor(init: AudioDecoderInit) {
    super();
    this._controlQueue = new ControlMessageQueue();
    this._errorCallback = init.error;
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioDecoderOutputCallback = nativeData => {
      // Decrement queue size when output received
      this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(AudioData.prototype) as any;
      wrapper._native = nativeData;
      wrapper._closed = false;
      init.output(wrapper as AudioData);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.AudioDecoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  configure(config: AudioDecoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // W3C spec: validate required fields with TypeError
    if (config.codec === undefined || config.codec === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioDecoder': required member codec is undefined.",
      );
    }
    if (config.sampleRate === undefined || config.sampleRate === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioDecoder': required member sampleRate is undefined.",
      );
    }
    if (
      config.numberOfChannels === undefined ||
      config.numberOfChannels === null
    ) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioDecoder': required member numberOfChannels is undefined.",
      );
    }

    this._needsKeyFrame = true;
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  decode(chunk: EncodedAudioChunk): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state === 'unconfigured') {
      throw new DOMException('Decoder is not configured', 'InvalidStateError');
    }
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // Check if first chunk must be a key frame per W3C spec
    if (this._needsKeyFrame && chunk.type !== 'key') {
      this._errorCallback(
        new DOMException(
          'First chunk after configure/reset must be a key frame',
          'DataError',
        ),
      );
      return;
    }
    this._needsKeyFrame = false;

    this._decodeQueueSize++;
    // Call native decode directly - chunk must be valid at call time
    this._native.decode(chunk._nativeChunk);
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(
        new DOMException('Decoder is not configured', 'InvalidStateError'),
      );
    }
    if (this.state === 'closed') {
      return Promise.reject(
        new DOMException('Decoder is closed', 'InvalidStateError'),
      );
    }
    await this._controlQueue.flush();
    return this._native.flush();
  }

  reset(): void {
    // W3C spec: reset() is a no-op when closed (does NOT throw)
    if (this.state === 'closed') {
      return;
    }
    this._controlQueue.clear();
    this._decodeQueueSize = 0;
    this._needsKeyFrame = true;
    this._native.reset();
  }

  close(): void {
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: AudioDecoderConfig): Promise<{
    supported: boolean;
    config: AudioDecoderConfig;
  }> {
    return native.AudioDecoder.isConfigSupported(config);
  }
}

export class VideoFilter {
  private _native: NativeVideoFilter;
  private _state: CodecState = 'unconfigured';

  constructor(config: VideoFilterConfig) {
    this._native = new native.VideoFilter(config);
  }

  get state(): CodecState {
    return this._state;
  }

  configure(_config: VideoFilterConfig): void {
    // VideoFilter is configured at construction time
    this._state = 'configured';
  }

  applyBlur(
    frame: VideoFrame,
    regions: BlurRegion[],
    strength: number = 20,
  ): VideoFrame {
    if (this._state === 'closed') {
      throw new DOMException('VideoFilter is closed', 'InvalidStateError');
    }
    // Pass the native VideoFrame data to applyBlur
    const frameData = frame._nativeFrame.getData();
    const resultData = this._native.applyBlur(frameData, regions, strength);
    // Create a new VideoFrame with the blurred data
    return new VideoFrame(resultData, {
      codedWidth: frame.codedWidth,
      codedHeight: frame.codedHeight,
      timestamp: frame.timestamp,
      format: frame.format as VideoPixelFormat,
    });
  }

  close(): void {
    this._native.close();
    this._state = 'closed';
  }
}

export class Demuxer {
  private _native: NativeDemuxer;

  constructor(init: DemuxerInit) {
    this._native = new native.Demuxer({
      onTrack: init.onTrack,
      onChunk: (
        chunk: {
          type: string;
          timestamp: number;
          duration?: number;
          data: Buffer;
        },
        trackIndex: number,
      ) => {
        if (init.onChunk) {
          // Wrap raw chunk in EncodedVideoChunk for consistency
          const wrappedChunk = new EncodedVideoChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data,
          });
          init.onChunk(wrappedChunk, trackIndex);
        }
      },
      onError: init.onError,
    });
  }

  async open(path: string): Promise<void> {
    return this._native.open(path);
  }

  async demux(): Promise<void> {
    return this._native.demux();
  }

  close(): void {
    this._native.close();
  }

  getVideoTrack(): TrackInfo | null {
    return this._native.getVideoTrack();
  }

  getAudioTrack(): TrackInfo | null {
    return this._native.getAudioTrack();
  }
}

export class ImageDecoder {
  private _native: NativeImageDecoder;
  private _closed: boolean = false;

  constructor(init: ImageDecoderInit) {
    // Convert data to Buffer if needed
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(
        init.data.buffer,
        init.data.byteOffset,
        init.data.byteLength,
      );
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }

    this._native = new native.ImageDecoder({
      type: init.type,
      data: dataBuffer,
    });
  }

  get type(): string {
    return this._native.type;
  }

  get complete(): boolean {
    return this._native.complete;
  }

  get tracks(): ImageTrackList {
    // Wrap native array as W3C-compliant ImageTrackList
    const nativeTracks = this._native.tracks;
    const trackList: ImageTrackList = {
      get length() {
        return nativeTracks.length;
      },
      get selectedIndex() {
        return 0;
      },
      get selectedTrack() {
        return nativeTracks.length > 0 ? nativeTracks[0] : null;
      },
      ready: Promise.resolve(),
      [Symbol.iterator]: function* () {
        for (let i = 0; i < nativeTracks.length; i++) {
          yield nativeTracks[i];
        }
      },
    } as ImageTrackList;

    // Add index accessor
    for (let i = 0; i < nativeTracks.length; i++) {
      Object.defineProperty(trackList, i, {
        get: () => nativeTracks[i],
        enumerable: true,
      });
    }

    return trackList;
  }

  get completed(): Promise<void> {
    // Resolve immediately since we decode synchronously
    return Promise.resolve();
  }

  async decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult> {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }

    const result = await this._native.decode(options || {});

    if (!result.image) {
      throw new DOMException('Failed to decode image', 'EncodingError');
    }

    // Wrap the native frame as a VideoFrame
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = Object.create(VideoFrame.prototype) as any;
    wrapper._native = result.image;
    wrapper._closed = false;
    wrapper._metadata = {}; // Initialize empty metadata for decoded images

    return {
      image: wrapper as VideoFrame,
      complete: result.complete,
    };
  }

  reset(): void {
    // No-op for static images
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  static async isTypeSupported(type: string): Promise<boolean> {
    return native.ImageDecoder.isTypeSupported(type);
  }
}

// Re-export all types from types.ts (W3C WebCodecs API types)
export type {
  // Fundamental types
  AllowSharedBufferSource,
  BufferSource,
  DOMHighResTimeStamp,
  // Codec state
  CodecState,
  // Hardware/quality hints
  HardwareAcceleration,
  AlphaOption,
  LatencyMode,
  // Bitrate modes
  VideoEncoderBitrateMode,
  BitrateMode,
  // Chunk types
  EncodedAudioChunkType,
  EncodedVideoChunkType,
  // Audio sample format
  AudioSampleFormat,
  // Video pixel format
  VideoPixelFormat,
  // Video color space
  VideoColorPrimaries,
  VideoTransferCharacteristics,
  VideoMatrixCoefficients,
  VideoColorSpaceInit,
  // DOM rect types
  DOMRectInit,
  DOMRectReadOnly,
  // Plane layout
  PlaneLayout,
  // Video frame metadata
  VideoFrameMetadata,
  // Video frame
  VideoFrameInit,
  VideoFrameBufferInit,
  VideoFrameCopyToOptions,
  ColorSpaceConversion,
  PredefinedColorSpace,
  // Encoded video chunk
  EncodedVideoChunkInit,
  EncodedVideoChunkMetadata,
  SvcOutputMetadata,
  // Encoded audio chunk
  EncodedAudioChunkInit,
  EncodedAudioChunkMetadata,
  // Audio data
  AudioDataInit,
  AudioDataCopyToOptions,
  // Video encoder
  VideoEncoderConfig,
  VideoEncoderEncodeOptions,
  VideoEncoderEncodeOptionsForVp9,
  VideoEncoderEncodeOptionsForAv1,
  VideoEncoderEncodeOptionsForAvc,
  VideoEncoderEncodeOptionsForHevc,
  VideoEncoderSupport,
  EncodedVideoChunkOutputCallback,
  VideoEncoderInit,
  // Video decoder
  VideoDecoderConfig,
  VideoDecoderSupport,
  VideoFrameOutputCallback,
  VideoDecoderInit,
  // Audio encoder
  AudioEncoderConfig,
  OpusEncoderConfig,
  AudioEncoderSupport,
  EncodedAudioChunkOutputCallback,
  AudioEncoderInit,
  // Audio decoder
  AudioDecoderConfig,
  AudioDecoderSupport,
  AudioDataOutputCallback,
  AudioDecoderInit,
  // Error callback
  WebCodecsErrorCallback,
  // Image decoder
  ImageBufferSource,
  ImageDecoderInit,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageTrack,
  ImageTrackList,
  // Constructor interfaces
  VideoEncoderConstructor,
  VideoDecoderConstructor,
  AudioEncoderConstructor,
  AudioDecoderConstructor,
  ImageDecoderConstructor,
  VideoFrameConstructor,
  VideoColorSpaceConstructor,
  EncodedVideoChunkConstructor,
  EncodedAudioChunkConstructor,
  AudioDataConstructor,
  // Additional types (not in W3C spec)
  BlurRegion,
  VideoFilterConfig,
  DemuxerChunk,
  TrackInfo,
  DemuxerInit,
} from './types';

// Re-export ResourceManager
export {ResourceManager} from './resource-manager';

// Re-export error classes and codes
export {
  ErrorCode,
  WebCodecsError,
  ConfigurationError,
  UnsupportedCodecError,
  InvalidStateError,
  EncodingError,
  DecodingError,
  InvalidDataError,
  AllocationError,
  ffmpegErrorMessage,
} from './errors';
export type {ErrorCodeType} from './errors';
