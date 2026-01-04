# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **ALWAYS check `docs/specs/` before modifying C++ or codec behavior.** The W3C WebCodecs spec is the source of truth for API behavior, error handling, and state transitions.

## Project

W3C WebCodecs API implementation for Node.js using FFmpeg. Browser-compatible video/audio encoding/decoding plus MP4 muxing/demuxing extensions.

## Principles

- **Safety over velocity** — C++ segfault = entire Node process crash
- **RAII mandatory** — Use `src/ffmpeg_raii.h` wrappers, never raw `av_*_alloc/free`
- **Thread paranoia** — `AVCodecContext` is not thread-safe; isolate main thread from `AsyncWorker`
- **Spec compliance** — Throw exact DOMException types per W3C spec

## Required Skills

- **C++**: Use `/dev-cpp` for `src/*.cc`, `src/*.h` (Google C++ Style)
- **TypeScript**: Use `/dev-ts` for `lib/*.ts`, `test/*.ts` (Google TS Style)

## Commands

**Always use `npm run` scripts. Never bypass with `npx`, `tsx`, or direct tool invocations.**

```bash
# Build
npm run build          # Full (native + TS)
npm run build:native   # C++ addon only
npm run build:debug    # Debug build

# Test
npm run check          # Lint + test (matches CI)
npm test               # All tests
npm run test:unit      # Fast iteration

# Lint
npm run lint           # All linters
npm run lint:cpp       # cpplint
npm run lint:ts        # biome
```

## Architecture

**Two-layer design:**

- `lib/` — TypeScript: W3C spec compliance, state validation, EventTarget
- `src/` — C++17 N-API: FFmpeg operations, async workers

**Key files:**

- `src/ffmpeg_raii.h` — RAII wrappers: `AVFramePtr`, `AVPacketPtr`, `AVCodecContextPtr`
- `src/error_builder.h` — DOMException builder for spec errors
- `lib/resource-manager.ts` — Tracks instances for W3C reclamation (10s inactive)
- `lib/binding.ts` — Platform-specific addon loader

**Pattern:** TS wraps native classes, handles state; native focuses on FFmpeg ops.

## FFmpeg Rules

- Version 5.0+ required (enforced in `common.h`)
- Always check return values, use `FFmpegErrorString()` for messages
- Never assume 1:1 packet/frame relationship
- Handle timebase conversions explicitly

## Codec Strings

- H.264: `avc1.42001e` (Baseline), `avc1.4d001e` (Main), `avc1.64001e` (High)
- H.265: `hvc1.*`, `hev1.*`
- VP9: `vp09.00.10.08`, AV1: `av01.0.04M.08`
- Audio: `mp4a.40.2` (AAC), `opus`, `mp3`, `flac`

## C++ Debugging

**STOP before editing code. Triage first:**

1. Check linker warnings — "built for macOS-X but linking with Y" = ABI issue, not code
2. Crash in trivial code (constructor, allocation) = problem is NOT that code
3. Crash "moves around" = memory corruption elsewhere or ABI mismatch

```bash
# Check linked libraries
otool -L ./build/Release/*.node  # macOS
ldd ./build/Release/*.node       # Linux

# If linker mismatch: fix binding.gyp, rebuild deps. Do NOT touch source.
```

**Loop detection:** Edited same file 3+ times for same crash → STOP. Bug is elsewhere.

## CI Testing

Test GitHub Actions locally before pushing:

```bash
act -l                                                    # List jobs
act push -j build-linux-x64 --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml
```
