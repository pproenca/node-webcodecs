# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

W3C WebCodecs API for Node.js using FFmpeg. Browser-compatible video/audio encoding/decoding with MP4 muxing/demuxing extensions.

**CRITICAL:** Check `docs/specs/` before modifying C++ or codec behavior. W3C WebCodecs spec is the source of truth.

## Core Principles

- **Safety over velocity** — C++ segfault crashes entire Node process
- **RAII mandatory** — Use `src/ffmpeg_raii.h` wrappers (`AVFramePtr`, `AVPacketPtr`), never raw `av_*_alloc/free`
- **Thread paranoia** — `AVCodecContext` is NOT thread-safe; isolate from main thread in `AsyncWorker`
- **Spec compliance** — Throw exact DOMException types per W3C spec (use `error_builder.h`)

## Required Skills

- **C++** (`src/*.cc`, `src/*.h`): `/dev-cpp` (Google C++ Style Guide)
- **TypeScript** (`lib/*.ts`, `test/*.ts`): `/dev-ts` (Google TypeScript Style Guide)
- **FFmpeg C++ review**: Custom `ffmpeg-cpp-sentinel` agent (automatically available)

## Commands

**ALWAYS use `npm run` scripts. Never use `npx`, `tsx`, or direct tool invocations.**

```bash
# Build
npm run build          # Full (native + TS), auto-runs after Write/Edit
npm run build:native   # C++ only
npm run build:debug    # Debug symbols

# Test
npm run check          # Lint + test (CI equivalent)
npm test               # All tests (unit + guardrails)
npm run test:unit      # Fast iteration

# Lint
npm run lint           # All (cpp + ts + types + md)
npm run lint:cpp       # cpplint only
npm run lint:ts        # biome only

# Output filters (spec reporter)
npm run test:failures  # ✖ only
npm run test:summary   # ℹ stats only
```

**PostToolUse hook:** `Write|Edit` → auto-format + build TypeScript (see output for errors)

## Architecture

**Two-layer design:**

- `lib/` (TypeScript) → W3C spec compliance, state validation, EventTarget
- `src/` (C++17 N-API) → FFmpeg operations, async workers

**Critical files:**

- `src/ffmpeg_raii.h` — RAII wrappers (prevents leaks)
- `src/error_builder.h` — DOMException builder
- `lib/resource-manager.ts` — W3C reclamation (10s inactive timeout)
- `lib/binding.ts` — Platform addon loader

**Pattern:** TS handles state/validation, C++ handles FFmpeg ops. Clean separation.

## FFmpeg Rules

- **Version:** 5.0+ required (`common.h` enforces)
- **Return values:** Always check, use `FFmpegErrorString()` for messages
- **Packet/frame ratio:** NEVER assume 1:1 relationship
- **Timebase:** Handle conversions explicitly (check W3C spec)

## Codec Strings Reference

```
H.264: avc1.42001e (Baseline), avc1.4d001e (Main), avc1.64001e (High)
H.265: hvc1.*, hev1.*
VP9:   vp09.00.10.08
AV1:   av01.0.04M.08
AAC:   mp4a.40.2
```

## C++ Debugging Protocol

**STOP before editing code. Triage FIRST:**

1. Linker warnings ("built for macOS-X but linking with Y") = ABI issue, NOT code bug
2. Crash in trivial code (constructor, allocation) = problem is ELSEWHERE
3. Crash "moves around" when you edit = memory corruption or ABI mismatch

```bash
# Diagnose linked libraries
otool -L ./build/Release/*.node  # macOS
ldd ./build/Release/*.node       # Linux
```

**Loop detection:** Edited same file 3+ times for same crash → STOP. Root cause is elsewhere.
**Fix:** Adjust `binding.gyp`, rebuild deps. Do NOT modify source as first response.

## CI Testing

Test GitHub Actions locally:

```bash
act -l  # List jobs
act push -j build-linux-x64 --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml
```
