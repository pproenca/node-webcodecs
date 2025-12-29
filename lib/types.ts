export interface VideoEncoderConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
    latencyMode?: 'quality' | 'realtime';
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

export type CodecState = 'unconfigured' | 'configured' | 'closed';
