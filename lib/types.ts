export interface VideoEncoderConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
    latencyMode?: 'quality' | 'realtime';
    bitrateMode?: 'constant' | 'variable' | 'quantizer';
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
    decoderConfig?: {
        codec: string;
        codedWidth: number;
        codedHeight: number;
        description?: ArrayBuffer;
    };
}

export interface VideoFrameInit {
    codedWidth: number;
    codedHeight: number;
    timestamp: number;
    duration?: number;
    format?: 'RGBA' | 'BGRA' | 'I420' | 'NV12';
}

export interface VideoEncoderEncodeOptions {
    keyFrame?: boolean;
}

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export interface PlaneLayout {
    offset: number;
    stride: number;
}

export interface VideoFrameCopyToOptions {
    rect?: { x: number; y: number; width: number; height: number };
    layout?: PlaneLayout[];
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
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
    optimizeForLatency?: boolean;
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
