import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoDecoderConfig,
    VideoDecoderInit,
    VideoFrameInit,
    CodecState,
    PlaneLayout,
    VideoFrameCopyToOptions,
    AudioSampleFormat,
    AudioDataInit,
    AudioDataCopyToOptions,
    AudioEncoderConfig,
    AudioEncoderInit,
    AudioDecoderConfig,
    AudioDecoderInit,
    EncodedAudioChunkInit
} from './types';

// Load native addon
const native = require('../build/Release/node_webcodecs.node');

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

        // For RGBA format, single plane
        const bytesPerRow = this.codedWidth * 4;
        const totalBytes = bytesPerRow * this.codedHeight;

        const data = this._native.getData();

        if (destination instanceof ArrayBuffer) {
            if (destination.byteLength < totalBytes) {
                throw new TypeError('Destination buffer too small');
            }
            const view = new Uint8Array(destination);
            view.set(data);
        } else if (destination instanceof Uint8Array) {
            if (destination.byteLength < totalBytes) {
                throw new TypeError('Destination buffer too small');
            }
            destination.set(data);
        } else {
            throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
        }

        return [{ offset: 0, stride: bytesPerRow }];
    }

    allocationSize(options?: VideoFrameCopyToOptions): number {
        if (this._closed) {
            throw new DOMException('VideoFrame is closed', 'InvalidStateError');
        }
        return this.codedWidth * this.codedHeight * 4; // RGBA
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

    constructor(init: VideoEncoderInit) {
        this._native = new native.VideoEncoder({
            output: (chunk: any, metadata: any) => {
                const wrappedChunk = new EncodedVideoChunk({
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data
                });
                init.output(wrappedChunk, metadata);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get encodeQueueSize(): number {
        return this._native.encodeQueueSize;
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
        this._native.configure(config);
    }

    encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
        this._native.encode(frame._nativeFrame, options || {});
    }

    flush(): Promise<void> {
        return new Promise((resolve) => {
            this._native.flush();
            resolve();
        });
    }

    reset(): void {
        this._native.reset();
    }

    close(): void {
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

    constructor(init: VideoDecoderInit) {
        this._native = new native.VideoDecoder({
            output: (nativeFrame: any) => {
                // Wrap the native frame as a VideoFrame
                const wrapper = Object.create(VideoFrame.prototype);
                wrapper._native = nativeFrame;
                wrapper._closed = false;
                init.output(wrapper);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get decodeQueueSize(): number {
        return this._native.decodeQueueSize;
    }

    configure(config: VideoDecoderConfig): void {
        this._native.configure(config);
    }

    decode(chunk: EncodedVideoChunk | any): void {
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
    }

    async flush(): Promise<void> {
        return this._native.flush();
    }

    reset(): void {
        this._native.reset();
    }

    close(): void {
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
}

export class AudioEncoder {
    private _native: any;

    constructor(init: AudioEncoderInit) {
        this._native = new native.AudioEncoder({
            output: (chunk: any, metadata?: any) => {
                const wrapper = Object.create(EncodedAudioChunk.prototype);
                wrapper._native = chunk;
                init.output(wrapper, metadata);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get encodeQueueSize(): number {
        return this._native.encodeQueueSize;
    }

    configure(config: AudioEncoderConfig): void {
        this._native.configure(config);
    }

    encode(data: AudioData): void {
        this._native.encode(data._nativeAudioData);
    }

    async flush(): Promise<void> {
        return this._native.flush();
    }

    reset(): void {
        this._native.reset();
    }

    close(): void {
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

    constructor(init: AudioDecoderInit) {
        this._native = new native.AudioDecoder({
            output: (data: any) => {
                const wrapper = Object.create(AudioData.prototype);
                wrapper._native = data;
                wrapper._closed = false;
                init.output(wrapper);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get decodeQueueSize(): number {
        return this._native.decodeQueueSize;
    }

    configure(config: AudioDecoderConfig): void {
        this._native.configure(config);
    }

    decode(chunk: EncodedAudioChunk): void {
        if ((chunk as any)._native) {
            this._native.decode((chunk as any)._native);
        } else {
            this._native.decode(chunk);
        }
    }

    async flush(): Promise<void> {
        return this._native.flush();
    }

    reset(): void {
        this._native.reset();
    }

    close(): void {
        this._native.close();
    }

    static async isConfigSupported(config: AudioDecoderConfig): Promise<{
        supported: boolean;
        config: AudioDecoderConfig;
    }> {
        return native.AudioDecoder.isConfigSupported(config);
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
    AudioSampleFormat,
    AudioDataInit,
    AudioDataCopyToOptions,
    AudioEncoderConfig,
    AudioEncoderInit,
    AudioDecoderConfig,
    AudioDecoderInit,
    EncodedAudioChunkInit
} from './types';
