import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoFrameInit,
    CodecState,
    PlaneLayout,
    VideoFrameCopyToOptions
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

// Re-export types
export type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoFrameInit,
    CodecState,
    PlaneLayout,
    VideoFrameCopyToOptions
} from './types';
