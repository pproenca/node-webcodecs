# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

node-webcodecs is a W3C WebCodecs API implementation for Node.js using FFmpeg. It provides VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder, and related classes that closely match the browser WebCodecs specification.

## Build Commands

```bash
# Full build (native C++ addon + TypeScript)
npm run build

# Build only native addon
npm run build:native

# Build only TypeScript
npm run build:ts

# Clean build artifacts
make clean
```

## Testing

```bash
# Run test suite (Vitest)
npm test

# Run a single test file
npx vitest run test/golden/video-encoder.test.ts

# Run tests matching a pattern
npx vitest run -t "encode"
```

Tests are in `test/golden/` (main tests) and `test/reference/` (reference implementations). The test setup (`test/setup.ts`) injects WebCodecs classes into `globalThis`.

## Linting

```bash
npm run lint    # Check with GTS (Google TypeScript Style)
npm run fix     # Auto-fix lint issues
```

C++ linting: `cpplint --recursive src/`

## Architecture

```
┌─────────────────────────────────────────┐
│     TypeScript API Layer (lib/*.ts)     │
│  - WebCodecs-compatible interface       │
│  - State machine management             │
├─────────────────────────────────────────┤
│     Native Addon Layer (src/*.cc)       │
│  - NAPI bindings (node-addon-api)       │
│  - C++17 implementations                │
├─────────────────────────────────────────┤
│          FFmpeg Libraries               │
│  libavcodec, libavutil, libswscale,     │
│  libswresample, libavfilter             │
└─────────────────────────────────────────┘
```

### Key Source Files

- `lib/index.ts` - Main TypeScript API, exports all WebCodecs classes
- `lib/types.ts` - W3C WebCodecs type definitions (matches WebIDL spec)
- `lib/native-types.ts` - TypeScript interfaces for C++ native bindings
- `lib/control-message-queue.ts` - Async message queue per W3C spec
- `lib/resource-manager.ts` - Codec lifecycle tracking

### Native Layer (src/)

- `video_encoder.cc/h` - H.264/HEVC/VP8/VP9/AV1 encoding via FFmpeg
- `video_decoder.cc/h` - Video decoding with YUV→RGBA conversion
- `audio_encoder.cc/h` - AAC/Opus encoding
- `audio_decoder.cc/h` - Audio decoding
- `video_frame.cc/h` - Raw frame container
- `video_filter.cc/h` - Blur filter using libavfilter
- `demuxer.cc/h` - Container demuxing
- `image_decoder.cc/h` - JPEG/PNG/WebP decoding

### Data Flow

**Encoding:** `Buffer → VideoFrame(TS) → NativeVideoFrame(C++) → AVFrame → avcodec_encode → AVPacket → EncodedVideoChunk`

**Decoding:** `EncodedVideoChunk → AVPacket → avcodec_decode → AVFrame → swscale(YUV→RGBA) → VideoFrame`

### Codec State Machine

All encoders/decoders follow: `unconfigured → configured → closed`

State is managed in the TypeScript layer. The native layer exposes the current state but transitions are controlled by `lib/index.ts`.

## Prerequisites

- Node.js 18+
- FFmpeg libraries: `pkg-config --exists libavcodec libavutil libswscale libswresample libavfilter`
- cmake, pkg-config, C++17 compiler

## Code Style

- TypeScript follows GTS (extends tsconfig-google.json)
- Unused variables prefixed with `_` are allowed
- C++ uses clang-format with project `.clang-format`

## W3C Spec Compliance Notes

From `lib/index.ts` header:
- EventTarget inheritance not implemented (uses callback-based `ondequeue`)
- VideoFrame from CanvasImageSource not supported (Node.js limitation)
- ArrayBuffer transfer semantics not implemented
- High bit-depth pixel formats (P10/P12) not supported in native layer
