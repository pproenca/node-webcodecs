import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
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

    // Internal access for native binding
    get _nativeFrame(): any {
        return this._native;
    }
}

export class VideoEncoder {
    private _native: any;
    private _state: CodecState = 'unconfigured';

    constructor(init: VideoEncoderInit) {
        this._native = new native.VideoEncoder({
            output: (chunk: any, metadata: any) => {
                // Wrap native chunk with byteLength getter
                const wrappedChunk: EncodedVideoChunk = {
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data,
                    get byteLength() { return this.data.length; }
                };
                init.output(wrappedChunk, metadata);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    configure(config: VideoEncoderConfig): void {
        this._native.configure(config);
    }

    encode(frame: VideoFrame): void {
        this._native.encode(frame._nativeFrame);
    }

    flush(): void {
        this._native.flush();
    }

    close(): void {
        this._native.close();
    }
}

// Re-export types
export type {
    VideoEncoderConfig,
    VideoEncoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
} from './types';
