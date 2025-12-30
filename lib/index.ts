import type {
  VideoEncoderConfig,
  VideoEncoderInit,
  VideoDecoderConfig,
  VideoDecoderInit,
  VideoFrameInit,
  VideoColorSpaceInit,
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

// Load native addon with type assertion
const native: NativeModule = require('../build/Release/node_webcodecs.node');

export class VideoColorSpace {
  readonly primaries: string | null;
  readonly transfer: string | null;
  readonly matrix: string | null;
  readonly fullRange: boolean | null;

  constructor(init?: VideoColorSpaceInit) {
    this.primaries = init?.primaries ?? null;
    this.transfer = init?.transfer ?? null;
    this.matrix = init?.matrix ?? null;
    this.fullRange = init?.fullRange ?? null;
  }

  toJSON(): VideoColorSpaceInit {
    return {
      primaries: this.primaries ?? undefined,
      transfer: this.transfer ?? undefined,
      matrix: this.matrix ?? undefined,
      fullRange: this.fullRange ?? undefined,
    };
  }
}

export class VideoFrame {
  private _native: NativeVideoFrame;
  private _closed: boolean = false;

  constructor(data: Buffer | Uint8Array | ArrayBuffer, init: VideoFrameInit) {
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
    this._native = new native.VideoFrame(dataBuffer, init);
  }

  get codedWidth(): number {
    return this._native.codedWidth;
  }

  get codedHeight(): number {
    return this._native.codedHeight;
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  get format(): string {
    return this._native.format;
  }

  get duration(): number | null {
    return this._native.duration ?? null;
  }

  get displayWidth(): number {
    return this._native.displayWidth;
  }

  get displayHeight(): number {
    return this._native.displayHeight;
  }

  get codedRect(): DOMRectReadOnly {
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

  get visibleRect(): DOMRectReadOnly {
    // Default: no cropping, visibleRect equals codedRect
    return this.codedRect;
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

  metadata(): Record<string, unknown> {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    return {};
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

    // Convert ArrayBuffer to Buffer for native layer
    let destBuffer: Buffer;
    if (destination instanceof ArrayBuffer) {
      destBuffer = Buffer.from(destination);
    } else if (destination instanceof Uint8Array) {
      destBuffer = Buffer.from(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
    } else {
      throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
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
    return wrapper;
  }

  // Internal access for native binding
  get _nativeFrame(): NativeVideoFrame {
    return this._native;
  }
}

export class VideoEncoder {
  private _native: NativeVideoEncoder;
  private _state: CodecState = 'unconfigured';
  private _ondequeue: (() => void) | null = null;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;
  private _resourceId: symbol;

  constructor(init: VideoEncoderInit) {
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
        type: chunk.type,
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

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  // Internal: triggers dequeue event with proper microtask timing
  _triggerDequeue(): void {
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }

  configure(config: VideoEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // Validate displayAspect pairing per W3C spec
    if (
      (config.displayAspectWidth !== undefined) !==
      (config.displayAspectHeight !== undefined)
    ) {
      throw new TypeError(
        'displayAspectWidth and displayAspectHeight must both be present or both absent',
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
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly data: Buffer;

  constructor(init: {
    type: string;
    timestamp: number;
    duration?: number;
    data: Buffer | Uint8Array | ArrayBuffer;
  }) {
    // W3C spec: type must be 'key' or 'delta'
    if (init.type !== 'key' && init.type !== 'delta') {
      throw new TypeError(`Invalid type: ${init.type}`);
    }
    this.type = init.type as 'key' | 'delta';
    this.timestamp = init.timestamp;
    this.duration = init.duration ?? null;
    // Convert to Buffer if needed
    if (init.data instanceof Buffer) {
      this.data = init.data;
    } else if (init.data instanceof Uint8Array) {
      this.data = Buffer.from(init.data);
    } else if (init.data instanceof ArrayBuffer) {
      this.data = Buffer.from(init.data);
    } else {
      throw new TypeError('data must be Buffer, Uint8Array, or ArrayBuffer');
    }
  }

  get byteLength(): number {
    return this.data.length;
  }

  copyTo(destination: ArrayBuffer | Uint8Array): void {
    if (destination instanceof ArrayBuffer) {
      const view = new Uint8Array(destination);
      if (view.byteLength < this.data.length) {
        throw new TypeError('Destination buffer too small');
      }
      view.set(this.data);
    } else if (destination instanceof Uint8Array) {
      if (destination.byteLength < this.data.length) {
        throw new TypeError('Destination buffer too small');
      }
      destination.set(this.data);
    } else {
      throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
    }
  }
}

export class VideoDecoder {
  private _native: NativeVideoDecoder;
  private _ondequeue: (() => void) | null = null;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;
  private _resourceId: symbol;

  constructor(init: VideoDecoderInit) {
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
      const wrapper = Object.create(VideoFrame.prototype) as VideoFrame & {
        _native: NativeVideoFrame;
        _closed: boolean;
      };
      wrapper._native = nativeFrame;
      wrapper._closed = false;
      init.output(wrapper);

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

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  // Internal: triggers dequeue event with proper microtask timing
  _triggerDequeue(): void {
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
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
    // Create a native EncodedVideoChunk from our TypeScript wrapper
    const nativeChunk = new native.EncodedVideoChunk({
      type: chunk.type,
      timestamp: chunk.timestamp,
      duration: chunk.duration ?? undefined,
      data: chunk.data,
    });
    this._native.decode(nativeChunk);
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
  }

  get format(): AudioSampleFormat | null {
    return this._closed ? null : this._native.format;
  }

  get sampleRate(): number {
    return this._native.sampleRate;
  }

  get numberOfFrames(): number {
    return this._native.numberOfFrames;
  }

  get numberOfChannels(): number {
    return this._native.numberOfChannels;
  }

  get duration(): number {
    return this._native.duration;
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  allocationSize(options?: AudioDataCopyToOptions): number {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
    }
    return this._native.allocationSize(options || {});
  }

  copyTo(
    destination: ArrayBuffer | ArrayBufferView,
    options?: AudioDataCopyToOptions,
  ): void {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
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
    this._native.copyTo(destBuffer, options || {});
    // Copy back to original if it was an ArrayBuffer
    if (destination instanceof ArrayBuffer) {
      new Uint8Array(destination).set(destBuffer);
    }
  }

  clone(): AudioData {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
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

  get duration(): number | undefined {
    return this._native.duration ?? undefined;
  }

  get byteLength(): number {
    return this._native.byteLength;
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView): void {
    this._native.copyTo(destination);
  }

  get _nativeChunk(): NativeEncodedAudioChunk {
    return this._native;
  }
}

export class AudioEncoder {
  private _native: NativeAudioEncoder;
  private _ondequeue: (() => void) | null = null;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;

  constructor(init: AudioEncoderInit) {
    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioEncoderOutputCallback = (chunk, metadata) => {
      // Decrement queue size when output received
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      const wrapper = Object.create(
        EncodedAudioChunk.prototype,
      ) as EncodedAudioChunk & {
        _native: NativeEncodedAudioChunk;
      };
      wrapper._native = chunk as unknown as NativeEncodedAudioChunk;
      init.output(wrapper, metadata);

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

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  // Internal: triggers dequeue event with proper microtask timing
  _triggerDequeue(): void {
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }

  configure(config: AudioEncoderConfig): void {
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  encode(data: AudioData): void {
    this._encodeQueueSize++;
    // Call native encode directly - data must be valid at call time
    this._native.encode(data._nativeAudioData);
  }

  async flush(): Promise<void> {
    await this._controlQueue.flush();
    return this._native.flush();
  }

  reset(): void {
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

export class AudioDecoder {
  private _native: NativeAudioDecoder;
  private _ondequeue: (() => void) | null = null;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;

  constructor(init: AudioDecoderInit) {
    this._controlQueue = new ControlMessageQueue();
    this._errorCallback = init.error;
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioDecoderOutputCallback = nativeData => {
      // Decrement queue size when output received
      this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

      const wrapper = Object.create(AudioData.prototype) as AudioData & {
        _native: NativeAudioData;
        _closed: boolean;
      };
      wrapper._native = nativeData;
      wrapper._closed = false;
      init.output(wrapper);

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

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  // Internal: triggers dequeue event with proper microtask timing
  _triggerDequeue(): void {
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }

  configure(config: AudioDecoderConfig): void {
    this._needsKeyFrame = true;
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  decode(chunk: EncodedAudioChunk): void {
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
    await this._controlQueue.flush();
    return this._native.flush();
  }

  reset(): void {
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
            type: chunk.type,
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

    // Wrap the image as a VideoFrame
    if (result.image) {
      const wrapper = Object.create(VideoFrame.prototype);
      wrapper._native = {
        codedWidth: result.image.codedWidth,
        codedHeight: result.image.codedHeight,
        timestamp: result.image.timestamp || 0,
        format: result.image.format || 'RGBA',
        displayWidth: result.image.codedWidth,
        displayHeight: result.image.codedHeight,
        data: result.image.data,
        close: () => {},
      };
      wrapper._closed = false;
      return {
        image: wrapper,
        complete: result.complete,
      };
    }

    return result;
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

// Re-export types
export type {
  VideoEncoderConfig,
  VideoEncoderInit,
  VideoDecoderConfig,
  VideoDecoderInit,
  VideoColorSpaceInit,
  VideoFrameInit,
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
  EncodedAudioChunkInit,
  BlurRegion,
  VideoFilterConfig,
  DemuxerInit,
  TrackInfo,
  ImageDecoderInit,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageTrackList,
} from './types';

// Re-export ResourceManager
export {ResourceManager} from './resource-manager';
