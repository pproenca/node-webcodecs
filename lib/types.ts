// Hardware acceleration hint
export type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';

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
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
    error: (error: Error) => void;
}

export interface EncodedVideoChunk {
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
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

export interface VideoFrameInit {
    codedWidth: number;
    codedHeight: number;
    timestamp: number;
    duration?: number;
    displayWidth?: number;
    displayHeight?: number;
    format?: VideoPixelFormat;
    rotation?: 0 | 90 | 180 | 270;
    flip?: boolean;
    visibleRect?: { x: number; y: number; width: number; height: number };
}

export interface VideoEncoderEncodeOptions {
    keyFrame?: boolean;
}

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export interface PlaneLayout {
    offset: number;
    stride: number;
}

export type VideoPixelFormat = 'RGBA' | 'RGBX' | 'BGRA' | 'BGRX' | 'I420' | 'I420A' | 'I422' | 'I444' | 'NV12';

export interface VideoFrameCopyToOptions {
    rect?: { x: number; y: number; width: number; height: number };
    layout?: PlaneLayout[];
    format?: VideoPixelFormat;
}

export interface VideoColorSpaceInit {
    primaries?: string;
    transfer?: string;
    matrix?: string;
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
    rotation?: 0 | 90 | 180 | 270;
    flip?: boolean;
}

export interface VideoDecoderInit {
    output: (frame: any) => void;
    error: (error: Error) => void;
}

// Audio types
export type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';

export interface AudioDataInit {
    format: AudioSampleFormat;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: ArrayBuffer | ArrayBufferView;
    transfer?: ArrayBuffer[];
}

export interface AudioEncoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    bitrate?: number;
    bitrateMode?: 'constant' | 'variable';
}

export interface AudioEncoderInit {
    output: (chunk: any, metadata?: any) => void;
    error: (error: Error) => void;
}

export interface AudioDecoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    description?: ArrayBuffer | ArrayBufferView;
}

export interface AudioDecoderInit {
    output: (data: any) => void;
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
export interface DemuxerInit {
    onTrack?: (track: TrackInfo) => void;
    onChunk?: (chunk: any, trackIndex: number) => void;
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
    image: any; // VideoFrame
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
