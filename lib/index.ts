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
    DOMRectReadOnly
} from './types';
import { ControlMessageQueue } from './control-message-queue';
import { ResourceManager } from './resource-manager';

// Load native addon
const native = require('../build/Release/node_webcodecs.node');

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
            fullRange: this.fullRange ?? undefined
        };
    }
}

export class VideoFrame {
    private _native: any;
    private _closed: boolean = false;

    constructor(data: Buffer, init: VideoFrameInit) {
        this._native = new native.VideoFrame(data, init);
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

    get duration(): number | undefined {
        return this._native.duration;
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
            bottom: h
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

    async copyTo(destination: ArrayBuffer | Uint8Array, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]> {
        if (this._closed) {
            throw new DOMException('VideoFrame is closed', 'InvalidStateError');
        }

        // Convert ArrayBuffer to Buffer for native layer
        let destBuffer: Buffer;
        if (destination instanceof ArrayBuffer) {
            destBuffer = Buffer.from(destination);
        } else if (destination instanceof Uint8Array) {
            destBuffer = Buffer.from(destination.buffer, destination.byteOffset, destination.byteLength);
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

    allocationSize(options?: { format?: VideoPixelFormat }): number {
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
    get _nativeFrame(): any {
        return this._native;
    }
}

export class VideoEncoder {
    private _native: any;
    private _state: CodecState = 'unconfigured';
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _encodeQueueSize: number = 0;
    private _resourceId: symbol;

    constructor(init: VideoEncoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._controlQueue.setErrorHandler(init.error);
        this._resourceId = ResourceManager.getInstance().register(this);

        this._native = new native.VideoEncoder({
            output: (chunk: any, metadata: any) => {
                // Decrement queue size when output received
                this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

                const wrappedChunk = new EncodedVideoChunk({
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data
                });
                init.output(wrappedChunk, metadata);

                // Fire ondequeue after output
                this._triggerDequeue();
            },
            error: init.error
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
        // Validate displayAspect pairing per W3C spec
        if ((config.displayAspectWidth !== undefined) !==
            (config.displayAspectHeight !== undefined)) {
            throw new TypeError(
                'displayAspectWidth and displayAspectHeight must both be present or both absent'
            );
        }

        this._controlQueue.enqueue(() => {
            this._native.configure(config);
        });
    }

    encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
        ResourceManager.getInstance().recordActivity(this._resourceId);
        this._encodeQueueSize++;
        this._controlQueue.enqueue(() => {
            this._native.encode(frame._nativeFrame, options || {});
        });
    }

    async flush(): Promise<void> {
        await this._controlQueue.flush();
        return new Promise((resolve) => {
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
    readonly duration?: number;
    readonly data: Buffer;

    constructor(init: { type: 'key' | 'delta'; timestamp: number; duration?: number; data: Buffer }) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.data = init.data;
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
    private _native: any;
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _decodeQueueSize: number = 0;
    private _needsKeyFrame: boolean = true;
    private _errorCallback: (error: DOMException) => void;
    private _resourceId: symbol;

    constructor(init: VideoDecoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._errorCallback = init.error;
        this._controlQueue.setErrorHandler(init.error);
        this._resourceId = ResourceManager.getInstance().register(this);

        this._native = new native.VideoDecoder({
            output: (nativeFrame: any) => {
                // Decrement queue size when output received
                this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

                // Wrap the native frame as a VideoFrame
                const wrapper = Object.create(VideoFrame.prototype);
                wrapper._native = nativeFrame;
                wrapper._closed = false;
                init.output(wrapper);

                // Fire ondequeue after output
                this._triggerDequeue();
            },
            error: init.error
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
        this._needsKeyFrame = true;
        // Configure synchronously to set state immediately per W3C spec
        this._native.configure(config);
    }

    decode(chunk: EncodedVideoChunk | any): void {
        // Check if first chunk must be a key frame per W3C spec
        const chunkType = chunk instanceof EncodedVideoChunk ? chunk.type : chunk.type;
        if (this._needsKeyFrame && chunkType !== 'key') {
            this._errorCallback(new DOMException('First chunk after configure/reset must be a key frame', 'DataError'));
            return;
        }
        this._needsKeyFrame = false;

        ResourceManager.getInstance().recordActivity(this._resourceId);
        this._decodeQueueSize++;
        this._controlQueue.enqueue(() => {
            // Handle both wrapped EncodedVideoChunk and raw native chunks
            if (chunk instanceof EncodedVideoChunk) {
                // Create a native EncodedVideoChunk from our TypeScript wrapper
                const nativeChunk = new native.EncodedVideoChunk({
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data
                });
                this._native.decode(nativeChunk);
            } else {
                // Assume it's already a native chunk
                this._native.decode(chunk);
            }
        });
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
    private _native: any;
    private _closed: boolean = false;

    constructor(init: AudioDataInit) {
        let dataBuffer: Buffer;
        if (init.data instanceof ArrayBuffer) {
            dataBuffer = Buffer.from(init.data);
        } else if (ArrayBuffer.isView(init.data)) {
            dataBuffer = Buffer.from(init.data.buffer, init.data.byteOffset, init.data.byteLength);
        } else {
            throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
        }
        this._native = new native.AudioData({
            format: init.format,
            sampleRate: init.sampleRate,
            numberOfFrames: init.numberOfFrames,
            numberOfChannels: init.numberOfChannels,
            timestamp: init.timestamp,
            data: dataBuffer
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

    copyTo(destination: ArrayBuffer | ArrayBufferView, options?: AudioDataCopyToOptions): void {
        if (this._closed) {
            throw new DOMException('AudioData is closed', 'InvalidStateError');
        }
        let destBuffer: Buffer;
        if (destination instanceof ArrayBuffer) {
            destBuffer = Buffer.from(destination);
        } else {
            destBuffer = Buffer.from(destination.buffer, destination.byteOffset, destination.byteLength);
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

    get _nativeAudioData(): any {
        return this._native;
    }
}

export class EncodedAudioChunk {
    private _native: any;

    constructor(init: EncodedAudioChunkInit) {
        this._native = new native.EncodedAudioChunk(init);
    }

    get type(): 'key' | 'delta' {
        return this._native.type;
    }

    get timestamp(): number {
        return this._native.timestamp;
    }

    get duration(): number | undefined {
        return this._native.duration;
    }

    get byteLength(): number {
        return this._native.byteLength;
    }

    copyTo(destination: ArrayBuffer | ArrayBufferView): void {
        this._native.copyTo(destination);
    }

    get _nativeChunk(): any {
        return this._native;
    }
}

export class AudioEncoder {
    private _native: any;
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _encodeQueueSize: number = 0;

    constructor(init: AudioEncoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._controlQueue.setErrorHandler(init.error);

        this._native = new native.AudioEncoder({
            output: (chunk: any, metadata?: any) => {
                // Decrement queue size when output received
                this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

                const wrapper = Object.create(EncodedAudioChunk.prototype);
                wrapper._native = chunk;
                init.output(wrapper, metadata);

                // Fire ondequeue after output
                this._triggerDequeue();
            },
            error: init.error
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
        this._controlQueue.enqueue(() => {
            this._native.configure(config);
        });
    }

    encode(data: AudioData): void {
        this._encodeQueueSize++;
        this._controlQueue.enqueue(() => {
            this._native.encode(data._nativeAudioData);
        });
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
    private _native: any;
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _decodeQueueSize: number = 0;
    private _needsKeyFrame: boolean = true;
    private _errorCallback: (error: DOMException) => void;

    constructor(init: AudioDecoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._errorCallback = init.error;
        this._controlQueue.setErrorHandler(init.error);

        this._native = new native.AudioDecoder({
            output: (data: any) => {
                // Decrement queue size when output received
                this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

                const wrapper = Object.create(AudioData.prototype);
                wrapper._native = data;
                wrapper._closed = false;
                init.output(wrapper);

                // Fire ondequeue after output
                this._triggerDequeue();
            },
            error: init.error
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
            this._errorCallback(new DOMException('First chunk after configure/reset must be a key frame', 'DataError'));
            return;
        }
        this._needsKeyFrame = false;

        this._decodeQueueSize++;
        this._controlQueue.enqueue(() => {
            this._native.decode(chunk._nativeChunk);
        });
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
    private _native: any;
    private _state: CodecState = 'unconfigured';

    constructor() {
        this._native = new native.VideoFilter();
    }

    get state(): CodecState {
        return this._native.state;
    }

    configure(config: VideoFilterConfig): void {
        this._native.configure(config);
    }

    applyBlur(frame: VideoFrame, regions: BlurRegion[], strength: number = 20): VideoFrame {
        if (this._native.state === 'closed') {
            throw new DOMException('VideoFilter is closed', 'InvalidStateError');
        }
        // Pass the native VideoFrame object to applyBlur
        const nativeResult = this._native.applyBlur((frame as any)._native, regions, strength);
        // Wrap the returned native frame as a VideoFrame
        const wrapper = Object.create(VideoFrame.prototype);
        wrapper._native = nativeResult;
        wrapper._closed = false;
        return wrapper;
    }

    close(): void {
        this._native.close();
    }
}

export class Demuxer {
    private _native: any;

    constructor(init: DemuxerInit) {
        this._native = new native.Demuxer({
            onTrack: init.onTrack,
            onChunk: (chunk: any, trackIndex: number) => {
                if (init.onChunk) {
                    // Wrap raw chunk in EncodedVideoChunk for consistency
                    const wrappedChunk = new EncodedVideoChunk({
                        type: chunk.type,
                        timestamp: chunk.timestamp,
                        duration: chunk.duration,
                        data: chunk.data
                    });
                    init.onChunk(wrappedChunk, trackIndex);
                }
            },
            onError: init.onError
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
    TrackInfo
} from './types';

// Re-export ResourceManager
export { ResourceManager } from './resource-manager';
