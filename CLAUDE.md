# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

node-webcodecs is a W3C WebCodecs API implementation for Node.js using FFmpeg as the backend. It provides browser-compatible APIs for server-side video/audio encoding/decoding, plus extensions for MP4 muxing/demuxing.

## Build Commands

```bash
npm run build              # Full build: native C++ addon + TypeScript
npm run build:ts           # TypeScript only
npm run build:native       # C++ addon only (node-gyp)
npm run build:native:debug # Debug build of C++ addon
npm run clean              # Remove build artifacts
```

## Testing

```bash
npm test                   # Run all tests (Vitest)
npm run test-fast          # Unit + golden tests (quicker)
npm run test-unit          # Unit tests only
npm run test-golden        # Golden/reference tests only

# Run a specific test file
npx vitest run test/golden/video-encoder.test.ts

# Run tests matching a pattern
npx vitest run -t "VideoFrame"
```

Tests inject WebCodecs classes into `globalThis` via `test/setup.ts`.

## Linting

```bash
npm run lint               # All linters
npm run lint-js            # Biome (TypeScript/JavaScript)
npm run lint-cpp           # cpplint (C++ - Google style)
npm run lint-types         # tsd (TypeScript type definitions)
```

## Architecture

### TypeScript Layer (`lib/`)
- `index.ts` - Main exports
- `types.ts` - W3C WebCodecs type definitions
- `video-encoder.ts`, `video-decoder.ts`, `audio-encoder.ts`, `audio-decoder.ts` - Codec wrappers
- `video-frame.ts`, `audio-data.ts` - Media data containers
- `muxer.ts`, `demuxer.ts` - Container I/O (beyond W3C spec)
- `binding.ts` - Native addon loader with fallback chain

### Native Layer (`src/`)
- C++17 NAPI addon wrapping FFmpeg
- `addon.cc` - Module initialization
- `*_encoder.cc`, `*_decoder.cc` - FFmpeg codec wrappers
- `async_encode_worker.cc`, `async_decode_worker.cc` - Background processing
- `ffmpeg_raii.h` - RAII wrappers for FFmpeg resources

### Key Patterns
- Each native class has a TypeScript wrapper adding W3C spec compliance and state management
- Codecs inherit from `CodecBase` for common state/queue handling
- Async encoding/decoding uses NAPI thread-safe functions for callbacks
- `ResourceManager` tracks active instances to prevent leaks

## Codec String Format

Video codecs use profile strings:
- H.264: `avc1.42001e` (Baseline), `avc1.4d001e` (Main), `avc1.64001e` (High)
- H.265: `hvc1.*`, `hev1.*`
- VP9: `vp09.00.10.08`
- AV1: `av01.0.04M.08`

Audio codecs: `mp4a.40.2` (AAC), `opus`, `mp3`, `flac`

## Platform Builds

Prebuilt binaries follow the "sharp pattern" with optional packages:
- `@pproenca/node-webcodecs-{darwin-arm64|darwin-x64|linux-x64|linuxmusl-x64|win32-x64}`

For source builds, FFmpeg dev libraries required. See README.md for platform-specific instructions.

## Test Fixtures

Test media files are in `test/fixtures/`. Tests use `TestVideoGenerator` for synthetic frames.
