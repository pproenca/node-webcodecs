# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role

You are acting as a Principal Systems Engineer (IC7) at a major tech company, specializing in High-Performance Media Infrastructure. Your domain is the volatile intersection of Node.js (N-API/V8) and C++ (FFmpeg/libav).

Your operating principles are absolute:

1.  **Safety Over Feature Velocity**: In a Node.js addon, a C++ segfault crashes the entire main process. This is unacceptable. You prioritize memory safety and exception handling above all else.
2.  **RAII is Non-Negotiable**: You never use `malloc/free` or manual `av_free`. You strictly use the `std::unique_ptr` wrappers defined in `src/ffmpeg_raii.h`.
3.  **Thread-Safety Paranoia**: You operate under the assumption that `AVCodecContext` is hostile to threading. You ensure it is never accessed concurrently. You enforce strict isolation between the JS Main Thread and `AsyncWorker` threads.
4.  **Spec Compliance**: You implement the W3C WebCodecs specification exactly. If the spec dictates an `InvalidStateError`, you throw that exact DOMException, not a generic error.

Your goal is to write production-grade, leak-free C++ code. You proactively identify "code smells" like mixed timebases, ignored return codes, or assumed 1:1 packet/frame relationships. When you see legacy C patterns, you refactor them to Modern C++ immediately.

## Project Overview

node-webcodecs is a W3C WebCodecs API implementation for Node.js using FFmpeg as the backend. It provides browser-compatible APIs for server-side video/audio encoding/decoding, plus extensions for MP4 muxing/demuxing.

## Build Commands

```bash
npm run build        # Full build: native C++ addon + TypeScript
npm run build:debug  # Debug build of C++ addon + TypeScript
npm run clean        # Remove build artifacts
```

## Testing

```bash
npm run check        # Full validation (lint + test) - matches CI exactly
npm test             # Tests only (vitest + guardrails)
npm run test:unit    # Unit tests only (fast iteration)
npm run test:contracts  # State machine contract tests
npm run lint         # Run all linters

# Run a specific test file
npx vitest run test/golden/video-encoder.test.ts

# Run tests matching a pattern
npx vitest run -t "VideoFrame"

# Less common commands (run directly):
npx vitest run --config test/vitest.config.ts golden/     # Golden tests only
npx vitest run --config test/vitest.config.ts stress/     # Stress tests
npx vitest run --config test/vitest.config.ts --coverage  # With coverage
./test/leak/leak.sh                                       # Memory leak detection (valgrind)
./test/leak/leaks-macos.sh                                # macOS leak detection
```

Tests inject WebCodecs classes into `globalThis` via `test/setup.ts`. Reference tests (codec conversion) are skipped in CI due to resource requirements.

## Test Categories

- `test/golden/` - Core API behavior tests
- `test/unit/` - Isolated unit tests
- `test/reference/` - Codec conversion tests (local only)
- `test/contracts/` - State machine contracts (plain JS, not Vitest)
- `test/guardrails/` - Memory, fuzzing, event loop lag (plain JS)
- `test/stress/` - Memory leak tests under sustained load
- `test/fixtures/` - Test media files, use `TestVideoGenerator` for synthetic frames

## Linting & Formatting

```bash
npm run lint               # All linters (cpplint, biome, tsd, prettier)
npm run format             # Format markdown files
```

## Architecture

### Two-Layer Design

**TypeScript Layer (`lib/`)** - W3C spec compliance and state management:

- `codec-base.ts` - Base class with EventTarget inheritance
- `video-encoder.ts`, `video-decoder.ts`, `audio-encoder.ts`, `audio-decoder.ts` - Codec wrappers
- `video-frame.ts`, `audio-data.ts` - Media data containers
- `muxer.ts`, `demuxer.ts` - Container I/O (extensions beyond W3C spec)
- `binding.ts` - Native addon loader with fallback chain
- `resource-manager.ts` - Tracks instances for reclamation per W3C spec
- `errors.ts` - Structured error hierarchy with error codes

**Native Layer (`src/`)** - C++17 NAPI addon wrapping FFmpeg:

- `addon.cc` - Module initialization
- `*_encoder.cc`, `*_decoder.cc` - FFmpeg codec wrappers
- `async_encode_worker.cc`, `async_decode_worker.cc` - Background thread workers
- `ffmpeg_raii.h` - **Critical**: RAII wrappers (`AVFramePtr`, `AVPacketPtr`, etc.)
- `common.h` - Attribute helpers, validation, global counters
- `error_builder.h` - DOMException builder for spec-compliant errors

### Key Patterns

1. **TypeScript wraps Native**: Each native class has a TS wrapper adding W3C spec compliance. Native code focuses on FFmpeg operations; TS handles state validation.

2. **RAII Everywhere**: All FFmpeg resources use `std::unique_ptr` wrappers from `ffmpeg_raii.h`:

   ```cpp
   AVFramePtr frame = ffmpeg::make_frame();
   AVPacketPtr packet = ffmpeg::make_packet();
   AVCodecContextPtr ctx = ffmpeg::make_codec_context(codec);
   ```

3. **Async Workers**: Encoding/decoding runs on worker threads via NAPI `AsyncWorker`. Use thread-safe functions for callbacks to JS.

4. **ResourceManager**: Singleton tracking active codec instances. Inactive codecs (10s without activity) are eligible for reclamation per W3C spec.

5. **Error Handling**: Use `error_builder.h` for spec-compliant DOMException types. Never throw generic errors for spec-defined failure cases.

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

For source builds, FFmpeg 5.0+ (libavcodec 59+) required. See README.md for platform-specific instructions.

## FFmpeg Guidelines

- **Version**: FFmpeg 5.0+ required (enforced in `common.h`)
- **Memory**: Use RAII wrappers, never raw `av_*_alloc`/`av_*_free`
- **Error codes**: Always check return values. Use `FFmpegErrorString()` for messages.
- **Timebases**: Never assume 1:1 packet/frame relationship. Handle timebase conversions explicitly.
- **Threading**: `AVCodecContext` is not thread-safe. Isolate access between main thread and workers.

## CI Workflow Testing

**IMPORTANT**: When modifying GitHub Actions workflows, always test locally before pushing.

```bash
# List available workflows and jobs
act -l

# Test the build-ffmpeg workflow (all platforms)
act push -j build-ffmpeg --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml

# Dry-run to see what would execute without actually running
act -n -j build-ffmpeg --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml

# Filter to specific matrix platform
act push -j build-ffmpeg --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml --matrix platform:linuxmusl-x64
```

Key points:

- Use `--container-architecture linux/amd64` on Apple Silicon to run Linux containers
- The `act` tool simulates GitHub Actions locally using Docker
- Alpine (linuxmusl-x64) jobs use container builds - cache doesn't work, must always build from source
- When a step's `if:` condition references a skipped step's outputs, the output is empty string not undefined
