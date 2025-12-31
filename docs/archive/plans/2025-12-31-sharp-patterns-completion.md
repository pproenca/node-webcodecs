# Sharp Patterns Completion - Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-sharp-patterns-completion.md` to implement task-by-task.

**Goal:** Address all remaining gaps from sharp patterns audit to achieve full compliance.

**Architecture:** Minimal changes approach - fix blocking issues first, then quality improvements, then nice-to-haves. Each task is independent with its own tests.

**Tech Stack:** TypeScript, C++17, node-addon-api, FFmpeg, Vitest, tsd, TypeDoc

---

## Parallel Groups

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1, 2, 3 | Independent files: platform.ts, is.ts, lib extraction |
| Group 2 | 4 | C++: demuxer.cc refactor (touches common.h) |
| Group 3 | 5 | C++: async VideoEncoder flush fix (complex) |
| Group 4 | 6, 7, 8, 9 | Tooling: tsd, TypeDoc, issue templates, package.json |
| Group 5 | 10 | File rename: mark DONE plan |

---

### Task 1: Add buildPlatformArch() to lib/platform.ts

**Files:**
- Modify: `lib/platform.ts:37`
- Test: `test/golden/platform.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/platform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runtimePlatformArch, buildPlatformArch, isPrebuiltAvailable, getPrebuiltPackageName } from '../lib/platform';

describe('platform', () => {
  // ... existing tests ...

  it('buildPlatformArch returns valid platform string', () => {
    const platform = buildPlatformArch();
    expect(platform).toMatch(/^(darwin|linux|linuxmusl|win32)-(x64|arm64)$/);
  });

  it('buildPlatformArch matches runtime by default', () => {
    // In non-cross-compile scenario, build platform equals runtime platform
    expect(buildPlatformArch()).toBe(runtimePlatformArch());
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/platform.test.ts -t "buildPlatformArch"
```

Expected: FAIL with `TypeError: buildPlatformArch is not a function`

**Step 3: Write minimal implementation** (2-5 min)

Add to `lib/platform.ts` after line 37:

```typescript
/**
 * Get the build-time platform-architecture string.
 * Used by npm/from-local-build.js for packaging.
 *
 * In cross-compilation scenarios, this could differ from runtimePlatformArch().
 * Currently returns the same value (no cross-compile support yet).
 */
export function buildPlatformArch(): string {
  // For now, build platform equals runtime platform
  // Cross-compilation would check environment variables like npm_config_arch
  return runtimePlatformArch();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/platform.test.ts -t "buildPlatformArch"
```

Expected: PASS (2 passed)

**Step 5: Verify npm/from-local-build.js works** (1 min)

```bash
npm run build:ts
node npm/from-local-build.js 2>&1 || true
```

Expected: Should now find buildPlatformArch (may fail for other reasons like missing build)

**Step 6: Commit** (30 sec)

```bash
git add lib/platform.ts test/golden/platform.test.ts
git commit -m "feat(platform): add buildPlatformArch() for npm packaging"
```

---

### Task 2: Add domain-specific guards to lib/is.ts

**Files:**
- Modify: `lib/is.ts`
- Test: `test/golden/is.test.ts`

**Step 1: Write the failing tests** (2-5 min)

Add to `test/golden/is.test.ts`:

```typescript
describe('domain guards', () => {
  describe('pixelFormat', () => {
    it('returns true for valid pixel formats', () => {
      expect(is.pixelFormat('I420')).toBe(true);
      expect(is.pixelFormat('NV12')).toBe(true);
      expect(is.pixelFormat('RGBA')).toBe(true);
      expect(is.pixelFormat('BGRA')).toBe(true);
    });

    it('returns false for invalid pixel formats', () => {
      expect(is.pixelFormat('INVALID')).toBe(false);
      expect(is.pixelFormat('')).toBe(false);
      expect(is.pixelFormat(123)).toBe(false);
    });
  });

  describe('sampleFormat', () => {
    it('returns true for valid sample formats', () => {
      expect(is.sampleFormat('u8')).toBe(true);
      expect(is.sampleFormat('s16')).toBe(true);
      expect(is.sampleFormat('f32-planar')).toBe(true);
    });

    it('returns false for invalid sample formats', () => {
      expect(is.sampleFormat('invalid')).toBe(false);
      expect(is.sampleFormat('')).toBe(false);
    });
  });

  describe('codecState', () => {
    it('returns true for valid codec states', () => {
      expect(is.codecState('unconfigured')).toBe(true);
      expect(is.codecState('configured')).toBe(true);
      expect(is.codecState('closed')).toBe(true);
    });

    it('returns false for invalid states', () => {
      expect(is.codecState('open')).toBe(false);
      expect(is.codecState('')).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/is.test.ts -t "domain guards"
```

Expected: FAIL with `TypeError: is.pixelFormat is not a function`

**Step 3: Write minimal implementation** (5 min)

Add to `lib/is.ts` before the error factories section:

```typescript
//==============================================================================
// Domain-Specific Guards
//==============================================================================

/** Valid W3C WebCodecs pixel formats */
const PIXEL_FORMATS = [
  'I420', 'I420P10', 'I420P12',
  'I420A', 'I420AP10',
  'I422', 'I422P10', 'I422P12',
  'I422A', 'I422AP10',
  'I444', 'I444P10', 'I444P12',
  'I444A', 'I444AP10',
  'NV12', 'NV12P10', 'NV21',
  'RGBA', 'RGBX', 'BGRA', 'BGRX',
] as const;

/** Valid W3C WebCodecs audio sample formats */
const SAMPLE_FORMATS = [
  'u8', 's16', 's32', 'f32',
  'u8-planar', 's16-planar', 's32-planar', 'f32-planar',
] as const;

/** Valid W3C WebCodecs codec states */
const CODEC_STATES = ['unconfigured', 'configured', 'closed'] as const;

/**
 * Is this a valid W3C VideoPixelFormat?
 */
export function pixelFormat(val: unknown): val is string {
  return string(val) && PIXEL_FORMATS.includes(val as typeof PIXEL_FORMATS[number]);
}

/**
 * Is this a valid W3C AudioSampleFormat?
 */
export function sampleFormat(val: unknown): val is string {
  return string(val) && SAMPLE_FORMATS.includes(val as typeof SAMPLE_FORMATS[number]);
}

/**
 * Is this a valid W3C CodecState?
 */
export function codecState(val: unknown): val is string {
  return string(val) && CODEC_STATES.includes(val as typeof CODEC_STATES[number]);
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/is.test.ts -t "domain guards"
```

Expected: PASS (8 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add domain-specific guards for pixelFormat, sampleFormat, codecState"
```

---

### Task 3: Extract VideoFilter, Demuxer, Muxer to separate files

**Files:**
- Create: `lib/video-filter.ts`
- Create: `lib/demuxer.ts`
- Create: `lib/muxer.ts`
- Modify: `lib/index.ts`

**Step 1: Create lib/video-filter.ts** (3 min)

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { NativeModule, NativeVideoFilter, NativeVideoFrame } from './native-types';
import type { BlurRegion, CodecState, VideoFilterConfig } from './types';
import { VideoFrame } from './video-frame';

const native = binding as NativeModule;

export class VideoFilter {
  private _native: NativeVideoFilter;
  private _state: CodecState = 'unconfigured';

  constructor(config: VideoFilterConfig) {
    this._native = new native.VideoFilter(config);
  }

  get state(): CodecState {
    return this._state;
  }

  configure(config: VideoFilterConfig): void {
    this._native.configure(config);
    this._state = 'configured';
  }

  applyBlur(frame: VideoFrame, regions: BlurRegion[], strength: number = 20): VideoFrame {
    if (this._state === 'closed') {
      throw new DOMException('VideoFilter is closed', 'InvalidStateError');
    }
    const resultNativeFrame = this._native.applyBlur(
      frame._nativeFrame as NativeVideoFrame,
      regions,
      strength
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = Object.create(VideoFrame.prototype) as any;
    wrapper._native = resultNativeFrame;
    wrapper._closed = false;
    wrapper._metadata = {};
    return wrapper as VideoFrame;
  }

  close(): void {
    this._native.close();
    this._state = 'closed';
  }
}
```

**Step 2: Create lib/demuxer.ts** (3 min)

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import { EncodedVideoChunk } from './encoded-chunks';
import type { NativeDemuxer, NativeModule } from './native-types';
import type { DemuxerInit, TrackInfo } from './types';

const native = binding as NativeModule;

export class Demuxer {
  private _native: NativeDemuxer;

  constructor(init: DemuxerInit) {
    this._native = new native.Demuxer({
      onTrack: init.onTrack,
      onChunk: (
        chunk: {
          type: string;
          timestamp: number;
          duration?: number;
          data: Buffer;
        },
        trackIndex: number
      ) => {
        if (init.onChunk) {
          const wrappedChunk = new EncodedVideoChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data,
          });
          init.onChunk(wrappedChunk, trackIndex);
        }
      },
      onError: init.onError,
    });
  }

  async open(path: string): Promise<void> {
    return this._native.open(path);
  }

  async demux(): Promise<void> {
    return this._native.demux();
  }

  close(): void {
    this._native.close();
  }

  getVideoTrack(): TrackInfo | null {
    return this._native.getVideoTrack();
  }

  getAudioTrack(): TrackInfo | null {
    return this._native.getAudioTrack();
  }
}
```

**Step 3: Create lib/muxer.ts** (3 min)

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { EncodedAudioChunk, EncodedVideoChunk } from './encoded-chunks';
import type { NativeModule, NativeMuxer } from './native-types';
import type { MuxerAudioTrackConfig, MuxerInit, MuxerVideoTrackConfig } from './types';

const native = binding as NativeModule;

export class Muxer {
  private _native: NativeMuxer;

  constructor(init: MuxerInit) {
    this._native = new native.Muxer({ filename: init.filename });
  }

  addVideoTrack(config: MuxerVideoTrackConfig): number {
    return this._native.addVideoTrack(config);
  }

  addAudioTrack(config: MuxerAudioTrackConfig): number {
    return this._native.addAudioTrack(config);
  }

  writeVideoChunk(chunk: EncodedVideoChunk): void {
    this._native.writeVideoChunk(chunk);
  }

  writeAudioChunk(chunk: EncodedAudioChunk): void {
    this._native.writeAudioChunk(chunk);
  }

  finalize(): void {
    this._native.finalize();
  }

  close(): void {
    this._native.close();
  }
}
```

**Step 4: Update lib/index.ts** (5 min)

Replace the inline class definitions (lines 62-185) with re-exports:

```typescript
// Re-export extracted utility classes
export { Demuxer } from './demuxer';
export { Muxer } from './muxer';
export { VideoFilter } from './video-filter';
```

Remove the `binding` and type imports that are no longer needed in index.ts.

**Step 5: Run tests to verify nothing broke** (1 min)

```bash
npm run build:ts && npx vitest run
```

Expected: All tests pass

**Step 6: Verify index.ts line count** (30 sec)

```bash
wc -l lib/index.ts
```

Expected: Should be ~100 lines or less (down from 312)

**Step 7: Commit** (30 sec)

```bash
git add lib/video-filter.ts lib/demuxer.ts lib/muxer.ts lib/index.ts
git commit -m "refactor(lib): extract VideoFilter, Demuxer, Muxer to separate files"
```

---

### Task 4: Refactor demuxer.cc to use webcodecs:: helpers

**Files:**
- Modify: `src/demuxer.cc`

**Step 1: Run existing demuxer tests to establish baseline** (30 sec)

```bash
npx vitest run test/golden/demuxer.test.ts
```

Expected: PASS (baseline)

**Step 2: Add #include "src/common.h"** (1 min)

Add at top of `src/demuxer.cc` after existing includes:

```cpp
#include "src/common.h"
```

**Step 3: Refactor constructor to use webcodecs:: helpers** (3 min)

Replace lines 33-59 in Demuxer constructor:

```cpp
Demuxer::Demuxer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<Demuxer>(info),
      video_stream_index_(-1),
      audio_stream_index_(-1) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw webcodecs::InvalidParameterError(env, "init", "object", info[0]);
  }

  Napi::Object options = info[0].As<Napi::Object>();

  if (webcodecs::HasAttr(options, "onTrack")) {
    on_track_callback_ =
        Napi::Persistent(options.Get("onTrack").As<Napi::Function>());
  }
  if (webcodecs::HasAttr(options, "onChunk")) {
    on_chunk_callback_ =
        Napi::Persistent(options.Get("onChunk").As<Napi::Function>());
  }
  if (webcodecs::HasAttr(options, "onError")) {
    on_error_callback_ =
        Napi::Persistent(options.Get("onError").As<Napi::Function>());
  }
}
```

**Step 4: Refactor Open method to use webcodecs:: error helpers** (3 min)

Replace error handling in Open method:

```cpp
Napi::Value Demuxer::Open(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    throw webcodecs::InvalidParameterError(env, "path", "string", info[0]);
  }

  std::string path = info[0].As<Napi::String>().Utf8Value();

  AVFormatContext* raw_ctx = nullptr;
  int ret = avformat_open_input(&raw_ctx, path.c_str(), nullptr, nullptr);
  if (ret < 0) {
    throw webcodecs::FFmpegError(env, "open file", ret);
  }
  format_context_.reset(raw_ctx);

  ret = avformat_find_stream_info(format_context_.get(), nullptr);
  if (ret < 0) {
    Cleanup();
    throw webcodecs::FFmpegError(env, "find stream info", ret);
  }
  // ... rest of method unchanged ...
```

**Step 5: Run tests to verify refactoring** (30 sec)

```bash
npm run build && npx vitest run test/golden/demuxer.test.ts
```

Expected: All tests pass (same behavior, cleaner code)

**Step 6: Commit** (30 sec)

```bash
git add src/demuxer.cc
git commit -m "refactor(demuxer): use webcodecs:: helpers from common.h"
```

---

### Task 5: Fix async VideoEncoder flush semantics and enable async_mode_

**Files:**
- Modify: `src/async_encode_worker.cc`
- Modify: `src/async_encode_worker.h`
- Modify: `src/video_encoder.cc`
- Test: `test/golden/video-encoder-event-loop.test.ts`

**Step 1: Unskip the event loop test** (1 min)

In `test/golden/video-encoder-event-loop.test.ts`, change:

```typescript
it.skip('encoding does not block event loop', async () => {
```

to:

```typescript
it('encoding does not block event loop', async () => {
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder-event-loop.test.ts
```

Expected: FAIL (event loop blocked because async_mode_ = false)

**Step 3: Add flush completion promise to AsyncEncodeWorker** (5 min)

In `src/async_encode_worker.h`, add member:

```cpp
private:
  // ... existing members ...
  std::promise<void> flush_promise_;
  std::future<void> flush_future_;
  bool flush_pending_ = false;
```

In `src/async_encode_worker.cc`, update Flush():

```cpp
void AsyncEncodeWorker::Flush() {
  // Set up promise for completion
  flush_promise_ = std::promise<void>();
  flush_future_ = flush_promise_.get_future();
  flush_pending_ = true;

  flushing_.store(true);
  queue_cv_.notify_one();

  // Wait for worker to process all frames AND emit all callbacks
  flush_future_.wait();

  flushing_.store(false);
  flush_pending_ = false;
}
```

Update WorkerThread() to signal completion:

```cpp
void AsyncEncodeWorker::WorkerThread() {
  while (running_.load()) {
    EncodeTask task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      queue_cv_.wait(lock, [this] {
        return !task_queue_.empty() || !running_.load() || flushing_.load();
      });

      if (!running_.load()) break;

      if (task_queue_.empty()) {
        if (flushing_.load() && flush_pending_) {
          // Signal flush completion
          flush_promise_.set_value();
          queue_cv_.notify_all();
        }
        continue;
      }

      task = std::move(task_queue_.front());
      task_queue_.pop();
    }

    ProcessFrame(task);

    if (task_queue_.empty()) {
      queue_cv_.notify_all();
    }
  }
}
```

**Step 4: Enable async_mode_ in VideoEncoder** (1 min)

In `src/video_encoder.cc` line 256, change:

```cpp
async_mode_ = false;
```

to:

```cpp
async_mode_ = true;
```

Remove the TODO comment above it.

**Step 5: Build and run tests** (2 min)

```bash
npm run build && npx vitest run test/golden/video-encoder-event-loop.test.ts
```

Expected: PASS (event loop no longer blocked)

**Step 6: Run all encoder tests** (1 min)

```bash
npx vitest run test/golden/video-encoder*.test.ts
```

Expected: All pass

**Step 7: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc src/async_encode_worker.h src/video_encoder.cc test/golden/video-encoder-event-loop.test.ts
git commit -m "feat(encoder): enable async encoding with proper flush synchronization"
```

---

### Task 6: Install tsd and add type definition tests

**Files:**
- Modify: `package.json`
- Create: `test/types/index.test-d.ts`

**Step 1: Install tsd** (1 min)

```bash
npm install --save-dev tsd
```

**Step 2: Add lint-types script to package.json** (1 min)

Add to scripts:

```json
"lint-types": "tsd"
```

**Step 3: Create test/types/index.test-d.ts** (3 min)

```typescript
import { expectType, expectError } from 'tsd';
import {
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
  ImageDecoder,
} from '../../dist';

// VideoEncoder
declare const encoder: VideoEncoder;
expectType<'unconfigured' | 'configured' | 'closed'>(encoder.state);
expectType<number>(encoder.encodeQueueSize);

// VideoFrame
declare const frame: VideoFrame;
expectType<string | null>(frame.format);
expectType<number>(frame.codedWidth);
expectType<number>(frame.codedHeight);
expectType<number>(frame.timestamp);

// EncodedVideoChunk
declare const chunk: EncodedVideoChunk;
expectType<'key' | 'delta'>(chunk.type);
expectType<number>(chunk.timestamp);
expectType<number>(chunk.byteLength);

// AudioData
declare const audio: AudioData;
expectType<string | null>(audio.format);
expectType<number>(audio.sampleRate);
expectType<number>(audio.numberOfFrames);
```

**Step 4: Run type tests** (30 sec)

```bash
npm run build:ts && npm run lint-types
```

Expected: PASS (no type errors)

**Step 5: Commit** (30 sec)

```bash
git add package.json package-lock.json test/types/
git commit -m "feat(types): add tsd type definition tests"
```

---

### Task 7: Install TypeDoc and add docs-build script

**Files:**
- Modify: `package.json`
- Create: `typedoc.json`

**Step 1: Install TypeDoc** (1 min)

```bash
npm install --save-dev typedoc
```

**Step 2: Create typedoc.json** (2 min)

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["lib/index.ts"],
  "out": "docs/api",
  "name": "node-webcodecs",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeInternal": true,
  "includeVersion": true
}
```

**Step 3: Add docs-build script to package.json** (1 min)

Add to scripts:

```json
"docs-build": "typedoc"
```

**Step 4: Generate docs** (1 min)

```bash
npm run docs-build
```

Expected: docs/api/ directory created with HTML documentation

**Step 5: Add docs/api to .gitignore** (30 sec)

```bash
echo "docs/api/" >> .gitignore
```

**Step 6: Commit** (30 sec)

```bash
git add package.json package-lock.json typedoc.json .gitignore
git commit -m "feat(docs): add TypeDoc configuration and docs-build script"
```

---

### Task 8: Add installation and question issue templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/installation.md`
- Create: `.github/ISSUE_TEMPLATE/question.md`

**Step 1: Create installation.md** (2 min)

```markdown
---
name: Installation Issue
about: Report problems installing node-webcodecs
title: '[Install] '
labels: installation
assignees: ''
---

## Environment

- **OS**: (e.g., macOS 14.0, Ubuntu 22.04, Windows 11)
- **Node.js version**: (output of `node --version`)
- **FFmpeg version**: (output of `ffmpeg -version | head -1`)
- **Package manager**: (npm / yarn / pnpm)

## Installation command

```bash
# The command you ran
```

## Error output

```
# Paste the full error output here
```

## FFmpeg libraries check

```bash
# Run: pkg-config --libs libavcodec libavutil libswscale libswresample
# Paste output here
```

## Additional context

Any other details about the installation environment.
```

**Step 2: Create question.md** (2 min)

```markdown
---
name: Question
about: Ask a question about using node-webcodecs
title: '[Question] '
labels: question
assignees: ''
---

## What are you trying to do?

Describe your goal or use case.

## What have you tried?

Code examples or approaches you've attempted.

## What's confusing or unclear?

Specific areas where you need help.

## Environment (if relevant)

- **OS**:
- **Node.js version**:
- **node-webcodecs version**:
```

**Step 3: Commit** (30 sec)

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "docs(issues): add installation and question issue templates"
```

---

### Task 9: Clean up package.json (remove redundant gts references)

**Files:**
- Modify: `package.json`

**Step 1: Verify gts is not in dependencies** (30 sec)

```bash
grep -i gts package.json
```

Expected: No output (gts already removed)

**Step 2: If gts is present, remove it** (1 min)

```bash
npm uninstall gts
```

**Step 3: Verify biome is the linter** (30 sec)

```bash
npm run lint-js -- --help | head -3
```

Expected: Shows biome help

**Step 4: Commit if changes made** (30 sec)

```bash
git add package.json package-lock.json
git commit -m "chore(deps): ensure gts removed, biome is the linter" || echo "No changes needed"
```

---

### Task 10: Rename completed plan file

**Files:**
- Rename: `docs/plans/2024-12-31-sharp-patterns-advanced-implementation.md`

**Step 1: Rename the fully implemented plan** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs/docs/plans/
mv 2024-12-31-sharp-patterns-advanced-implementation.md DONE--2024-12-31-sharp-patterns-advanced-implementation.md
```

**Step 2: Commit** (30 sec)

```bash
git add docs/plans/
git commit -m "chore(plans): mark sharp-patterns-advanced-implementation as DONE"
```

---

### Task 11: Code Review

**Files:**
- All files from Tasks 1-10

**Step 1: Run full test suite** (2 min)

```bash
npm run build && npm test
```

Expected: All tests pass

**Step 2: Run lint** (1 min)

```bash
npm run lint
```

Expected: No errors

**Step 3: Run type check** (30 sec)

```bash
npm run typecheck
```

Expected: No errors

**Step 4: Run type definition tests** (30 sec)

```bash
npm run lint-types
```

Expected: No errors

**Step 5: Verify index.ts is under 150 lines** (30 sec)

```bash
wc -l lib/index.ts
```

Expected: < 150 lines

**Step 6: Final commit with any fixes** (30 sec)

```bash
git status
# If any uncommitted changes, commit them
```

---

## Summary

| Task | Description | Priority | Files |
|------|-------------|----------|-------|
| 1 | Add buildPlatformArch() | High | lib/platform.ts |
| 2 | Add domain guards | Medium | lib/is.ts |
| 3 | Extract VideoFilter/Demuxer/Muxer | Medium | lib/*.ts |
| 4 | Refactor demuxer.cc | High | src/demuxer.cc |
| 5 | Fix async encoder flush | High | src/*.cc, src/*.h |
| 6 | Add tsd type tests | Low | package.json, test/types/ |
| 7 | Add TypeDoc | Low | package.json, typedoc.json |
| 8 | Add issue templates | Low | .github/ISSUE_TEMPLATE/ |
| 9 | Clean package.json | Low | package.json |
| 10 | Rename DONE plan | Low | docs/plans/ |
| 11 | Code review | - | All |
