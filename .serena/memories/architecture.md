# Codebase Architecture

## Layer Stack
```
┌─────────────────────────────────────────┐
│     TypeScript API Layer (lib/*.ts)     │
│  - WebCodecs-compatible interface       │
│  - State machine management             │
│  - Type safety                          │
├─────────────────────────────────────────┤
│           _native property              │
│      (Bridge to native objects)         │
├─────────────────────────────────────────┤
│     Native Addon Layer (src/*.cc)       │
│  - NAPI bindings                        │
│  - C++ class implementations            │
├─────────────────────────────────────────┤
│          FFmpeg Libraries               │
│  - libavcodec (encoding/decoding)       │
│  - libavutil (utilities)                │
│  - libswscale (pixel format conversion) │
│  - libswresample (audio resampling)     │
└─────────────────────────────────────────┘
```

## Data Flow

### Video Encoding Flow
```
Buffer (JS)
    ↓
VideoFrame (TypeScript wrapper)
    ↓ _nativeFrame
Native VideoFrame (C++)
    ↓
AVFrame (FFmpeg)
    ↓ avcodec_send_frame
    ↓ avcodec_receive_packet
AVPacket (FFmpeg)
    ↓
EncodedVideoChunk (TypeScript)
    ↓ output callback
Application
```

### Video Decoding Flow
```
EncodedVideoChunk (TypeScript)
    ↓ _native
Native EncodedVideoChunk (C++)
    ↓
AVPacket (FFmpeg)
    ↓ avcodec_send_packet
    ↓ avcodec_receive_frame
AVFrame (FFmpeg)
    ↓ YUV420p→RGBA conversion (swscale)
Native VideoFrame (C++)
    ↓
VideoFrame (TypeScript)
    ↓ output callback
Application
```

## Key C++ Classes

### video_encoder.cc/h
- `VideoEncoder::Configure()` - Sets up H.264 encoder
- `VideoEncoder::Encode()` - Encodes a frame, triggers output callback
- Converts RGBA→YUV420p internally using libswscale

### video_decoder.cc/h
- `VideoDecoder::Configure()` - Sets up H.264 decoder
- `VideoDecoder::Decode()` - Decodes a chunk, triggers output callback
- Converts YUV420p→RGBA internally using libswscale

### video_frame.cc/h
- Container for raw RGBA pixel data
- Stores width, height, timestamp, buffer

### encoded_video_chunk.cc/h
- Container for encoded H.264 data
- Stores type (key/delta), timestamp, duration, data buffer

### Audio classes follow same pattern
- `audio_encoder.cc/h`, `audio_decoder.cc/h`
- `audio_data.cc/h`, `encoded_audio_chunk.cc/h`

## Callback Pattern
JavaScript callbacks stored as `Napi::FunctionReference` in C++:
```cpp
// C++ side stores callback
Napi::FunctionReference output_callback_;

// Later, when output ready:
output_callback_.Call({chunk});
```

```typescript
// TypeScript side provides callback
const encoder = new VideoEncoder({
  output: (chunk, metadata) => { /* handle chunk */ },
  error: (e) => { /* handle error */ }
});
```

## State Machine
All encoders/decoders follow the same state pattern:
- `unconfigured` → Initial state
- `configured` → After configure() called
- `closed` → After close() called (terminal)

State transitions are managed in TypeScript layer (`lib/index.ts`).
