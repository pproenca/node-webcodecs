# Project Context

## Purpose

W3C WebCodecs API implementation for Node.js using FFmpeg as the underlying codec engine. Provides browser-compatible video/audio encoding/decoding with MP4 muxing/demuxing extensions.

Goals:
- Full W3C WebCodecs spec compliance (see `docs/specs/compliance-matrix.md`)
- Enable server-side video processing with the same API as browsers
- Leverage FFmpeg for codec support (H.264/AVC, H.265/HEVC, VP9, AV1, AAC, etc.)
- Provide Node.js-specific extensions (Muxer, Demuxer, ImageDecoder) where the W3C spec lacks server-side equivalents

## Tech Stack

- **TypeScript** (`lib/`): W3C spec compliance layer, state validation, EventTarget
- **C++17** (`src/`): FFmpeg operations via N-API native addon
- **FFmpeg 5.0+**: Codec engine (libavcodec, libavformat, libavutil, libswscale, libswresample, libavfilter)
- **node-gyp**: Native addon build system
- **Node.js**: ^20.17.0 || ^22.9.0 || >=24

Key dependencies:
- `node-addon-api`: N-API wrapper for C++ (NAPI_VERSION=8)
- `node-gyp-build`: Runtime native addon loader
- `detect-libc`: Platform detection for prebuilt binaries

## Project Conventions

### Code Style

**TypeScript** (`/dev-ts` skill - Google TypeScript Style Guide):
- Strict mode enabled (`strict: true` in tsconfig.json)
- Biome for linting (`npm run lint:ts`)
- JSDoc required for all public APIs with `@example` blocks
- Type tests in `test/types/*.test-d.ts` via `tsd`

**C++** (`/dev-cpp` skill - Google C++ Style Guide):
- C++20 standard
- cpplint for linting (`npm run lint:cpp`)
- RAII mandatory via `src/ffmpeg_raii.h` wrappers (`AVFramePtr`, `AVPacketPtr`)
- Raw `av_*_alloc/free` calls FORBIDDEN
- Exact DOMException types via `src/error_builder.h`

**Naming conventions**:
- Public APIs: Expanded names (`createConfiguration` not `createCfg`)
- Internal FFmpeg code: Mirror FFmpeg naming (`av_*`)
- TypeScript: camelCase for functions/variables, PascalCase for types/classes
- C++: snake_case for variables, PascalCase for classes

### Architecture Patterns

**Two-layer design with clean separation:**

```
lib/ (TypeScript)          src/ (C++ N-API)
├── State validation       ├── FFmpeg operations
├── EventTarget            ├── AsyncWorker threads
├── W3C spec compliance    ├── RAII memory management
└── Error handling         └── Platform codecs
```

Critical files:
- `src/ffmpeg_raii.h` — RAII wrappers (leak prevention)
- `src/error_builder.h` — DOMException builder
- `lib/resource-manager.ts` — W3C reclamation (10s inactive timeout)
- `lib/binding.ts` — Platform addon loader
- `lib/control-message-queue.ts` — W3C control message model

Thread safety:
- `AVCodecContext` is NOT thread-safe; isolated in `AsyncWorker`
- Main thread handles JS callbacks and state
- Work queue processes encode/decode operations off main thread

### Testing Strategy

**Test categories:**
- `test/golden/` — Integration tests, W3C behavior verification
- `test/unit/` — Isolated behavior tests
- `test/types/` — Type-level assertions via `tsd`
- `test/contracts/` — State machine contract tests
- `test/guardrails/` — Fuzzing and event loop lag detection
- `test/native/` — C++ unit tests with GoogleTest, sanitizers, coverage
- `test/stress/` — Performance benchmarks

**Commands:**
```bash
npm test              # All tests (unit + guardrails)
npm run test:unit     # Fast iteration
npm run test:golden   # Integration tests
npm run check         # Lint + test (CI equivalent)
npm run test:native   # C++ tests with GoogleTest
npm run test:native:sanitize  # ASan + UBSan
```

**Requirements:**
- Tests MANDATORY for all new features
- Error path tests required (invalid configs, closed states)
- W3C compliance tests use `test/golden/w3c-*.test.ts` pattern

### Git Workflow

- Main branch: `master`
- Feature branches: `feature/<name>` or descriptive names
- Commit messages: Conventional commits style (`feat:`, `fix:`, `docs:`, etc.)
- PRs require `npm run check` passing (lint + tests)
- No force-push to master

## Domain Context

**W3C WebCodecs Specification** (`docs/specs/`):
- Authoritative source for all codec behavior
- Compliance matrix tracks implementation status vs spec
- Check spec before modifying C++ or codec behavior

**Core interfaces:**
- `VideoEncoder`/`VideoDecoder` — Video codec operations
- `AudioEncoder`/`AudioDecoder` — Audio codec operations
- `VideoFrame`/`AudioData` — Raw media containers
- `EncodedVideoChunk`/`EncodedAudioChunk` — Compressed data
- `ImageDecoder` — Image format decoding (GIF, PNG, JPEG, WebP)
- `Muxer`/`Demuxer` — Node.js extensions for container formats

**Codec strings:**
```
H.264: avc1.42001e (Baseline), avc1.4d001e (Main), avc1.64001e (High)
H.265: hvc1.*, hev1.*
VP9:   vp09.00.10.08
AV1:   av01.0.04M.08
AAC:   mp4a.40.2
```

**FFmpeg rules:**
- Version 5.0+ required (`common.h` enforces)
- NEVER assume 1:1 packet/frame ratio
- Handle timebase conversions explicitly
- Always check return values, use `FFmpegErrorString()` for messages

## Important Constraints

**Safety:**
- C++ segfault crashes entire Node process — safety over velocity
- RAII wrappers mandatory to prevent memory leaks
- Input validation at TypeScript layer before passing to C++

**Platform support:**
- macOS (arm64, x64), Linux (glibc, musl)
- Prebuilt binaries via optional dependencies
- FFmpeg linked statically in prebuilds

**Spec compliance:**
- W3C WebCodecs spec is source of truth
- Throw exact DOMException types per spec
- Extensions (Muxer, Demuxer) clearly marked as Node.js-specific

## External Dependencies

**FFmpeg libraries:**
- libavcodec — Encoding/decoding
- libavformat — Container formats (MP4, WebM, etc.)
- libavutil — Utilities
- libswscale — Video scaling/conversion
- libswresample — Audio resampling
- libavfilter — Video/audio filters

**Platform frameworks (macOS):**
- VideoToolbox — Hardware acceleration
- AudioToolbox — Audio codec support
- CoreMedia, CoreVideo, CoreFoundation

**Build system:**
- node-gyp for native compilation
- prebuildify for prebuilt binaries
- Platform-specific packages: `@pproenca/node-webcodecs-<platform>`
