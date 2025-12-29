# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

node-webcodecs is a WebCodecs API implementation for Node.js using FFmpeg. It provides VideoEncoder, VideoDecoder, VideoFrame, and EncodedVideoChunk classes that closely match the W3C WebCodecs specification.

## Build Commands

```bash
# Full build (native + TypeScript)
npm run build

# Build only native addon
npm run build:native

# Build only TypeScript
npm run build:ts

# Clean build artifacts
npm run clean
```

## Testing

```bash
# Run all tests (18 sequential test files)
npm test

# Run guardrail tests (memory, event loop, fuzzing, benchmark)
npm run test:guardrails

# Run a single test
node test/01_smoke.js
```

## Code Quality

```bash
# Lint C++ code
cpplint --recursive src/

# Auto-format C++ code
clang-format -i -style=file src/*.cc src/*.h
```

## Architecture

### Layer Stack
```
TypeScript Layer (lib/*.ts)
    ↓ _nativeFrame / _native properties
Native Addon (src/*.cc)
    ↓ FFmpeg bindings
FFmpeg Libraries (libavcodec, libavutil, libswscale)
```

### TypeScript Classes (lib/index.ts)
- **VideoEncoder**: Wraps native encoder, manages state machine (unconfigured→configured→closed)
- **VideoDecoder**: Wraps native decoder, same state pattern
- **VideoFrame**: Wrapper around RGBA buffer data with clone/copyTo
- **EncodedVideoChunk**: Immutable encoded data container (type: 'key'|'delta')

### Native C++ Classes (src/*.cc, src/*.h)
- **addon.cc**: Module entry point, initializes all NAPI classes
- **video_encoder.cc/h**: H.264 encoding via FFmpeg, RGBA→YUV420p conversion
- **video_decoder.cc/h**: H.264 decoding via FFmpeg, YUV420p→RGBA conversion
- **video_frame.cc/h**: Raw frame container
- **encoded_video_chunk.cc/h**: Encoded packet container

### Callback Pattern
JavaScript callbacks are stored as `Napi::FunctionReference` in C++ and invoked when encoding/decoding produces output:
```typescript
// TypeScript side
const encoder = new VideoEncoder({
  output: (chunk, metadata) => { /* EncodedVideoChunk ready */ },
  error: (e) => { /* error occurred */ }
});
```

### Data Flow
**Encoding**: Buffer (JS) → VideoFrame (TS) → native VideoFrame → AVFrame → avcodec_send_frame → avcodec_receive_packet → EncodedVideoChunk (TS) → output callback

**Decoding**: EncodedVideoChunk → AVPacket → avcodec_send_packet → avcodec_receive_frame → AVFrame → VideoFrame → output callback

## File Naming Conventions
- C++ source files use `.cc` extension (not `.cpp`)
- Header files use `.h` extension
- Test files are numbered: `01_smoke.js`, `02_frame_data.js`, etc.

## Current Limitations
- Only H.264 codec supported
- Input/output pixel format is RGBA only
- Synchronous encoding/decoding (no AsyncWorker)
- Audio not yet implemented

## Prerequisites
- Node.js 18+
- FFmpeg libraries (libavcodec, libavutil, libswscale)
- cmake and pkg-config
