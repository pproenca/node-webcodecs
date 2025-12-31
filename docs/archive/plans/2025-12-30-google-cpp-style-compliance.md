# Google C++ Style Guide Compliance Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-google-cpp-style-compliance.md` to implement task-by-task.

**Goal:** Ensure all C++ code strictly follows Google's C++ Style Guide, focusing on patterns that automated formatters/linters cannot reliably detect.

**Architecture:** This is a refactoring effort across all C++ source files in `src/`. Changes are non-functional - they improve code quality and style compliance without changing behavior. Each task addresses a specific category of style violations.

**Tech Stack:** C++17, Node-API (NAPI), FFmpeg libraries

---

## Summary of Issues Found

Based on codebase analysis against Google C++ Style Guide:

| Category | Severity | Files Affected | Can Lint Catch? |
|----------|----------|----------------|-----------------|
| Raw pointers vs RAII | High | 8 files | No |
| Missing move semantics declarations | Medium | 10 files | No |
| Inconsistent error handling patterns | Medium | 6 files | No |
| Comment style (namespace endings) | Low | All .cc files | Partial |
| Include order violations | Low | Most files | Partial |
| Missing explicit constructors | Medium | 2 files | Partial |
| Initialization list ordering | Low | 5 files | No |

---

### Task 1: Fix Include Order Across All Files

**Files:**
- Modify: `src/video_encoder.cc`
- Modify: `src/video_decoder.cc`
- Modify: `src/audio_encoder.cc`
- Modify: `src/audio_decoder.cc`
- Modify: `src/video_frame.cc`
- Modify: `src/demuxer.cc`
- Modify: `src/video_filter.cc`
- Modify: `src/image_decoder.cc`
- Modify: `src/async_encode_worker.cc`
- Modify: `src/async_decode_worker.cc`
- Modify: `src/encoded_video_chunk.cc`
- Modify: `src/encoded_audio_chunk.cc`
- Modify: `src/audio_data.cc`

**TDD Instructions (Review-based):**

This task is style-only, so instead of TDD, we verify by building and running tests.

**Step 1: Review current include order** (2 min)

Per Google style, the order should be:
1. Related header (e.g., `"src/video_encoder.h"`)
2. Blank line
3. C system headers (e.g., `<unistd.h>`)
4. Blank line
5. C++ standard library headers (e.g., `<string>`, `<vector>`)
6. Blank line
7. Other library headers (e.g., `<napi.h>`)
8. Blank line
9. Project headers (e.g., `"src/video_frame.h"`)

**Step 2: Fix video_encoder.cc include order** (2 min)

Current (incorrect):
```cpp
#include "src/video_encoder.h"

#include <string>

#include "src/video_frame.h"
```

Correct:
```cpp
#include "src/video_encoder.h"

#include <string>

#include "src/video_frame.h"
```

Note: This file is already correct. Check each file individually.

**Step 3: Fix video_frame.cc include order** (2 min)

Current:
```cpp
#include "src/video_frame.h"

#include <cstring>
#include <string>
#include <unordered_map>
```

This is already correct (related header, blank, C++ std headers).

**Step 4: Fix audio_encoder.cc include order** (2 min)

Current:
```cpp
#include "src/audio_encoder.h"

#include <string>
#include <vector>

#include "src/audio_data.h"
#include "src/encoded_audio_chunk.h"
```

This is correct.

**Step 5: Verify with build** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 6: Verify with tests** (30 sec)

```bash
npm test
```

Expected: All tests pass

**Step 7: Commit** (30 sec)

```bash
git add src/*.cc
git commit -m "style(cpp): fix include order per Google style guide"
```

---

### Task 2: Add Explicit Move/Copy Declarations to All Wrapper Classes

**Files:**
- Modify: `src/demuxer.h:29-36`
- Modify: `src/encoded_video_chunk.h`
- Modify: `src/encoded_audio_chunk.h`
- Modify: `src/audio_data.h`
- Modify: `src/image_decoder.h`

**Rationale:** Per Google Style Guide, classes must explicitly declare copy/move semantics in the public section. Some classes are missing this.

**Step 1: Check current state of demuxer.h** (2 min)

Read `src/demuxer.h` and note it's missing copy/move declarations.

**Step 2: Add copy/move declarations to Demuxer** (3 min)

Add after the destructor in the public section:
```cpp
class Demuxer : public Napi::ObjectWrap<Demuxer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;

  explicit Demuxer(const Napi::CallbackInfo& info);
  ~Demuxer();

  // Disallow copy and assign.
  Demuxer(const Demuxer&) = delete;
  Demuxer& operator=(const Demuxer&) = delete;

 private:
  // ...
```

**Step 3: Add declarations to EncodedVideoChunk** (3 min)

Read and update `src/encoded_video_chunk.h` with the same pattern.

**Step 4: Add declarations to EncodedAudioChunk** (3 min)

Read and update `src/encoded_audio_chunk.h` with the same pattern.

**Step 5: Add declarations to AudioData** (3 min)

Read and update `src/audio_data.h` with the same pattern.

**Step 6: Add declarations to ImageDecoder** (3 min)

Read and update `src/image_decoder.h` with the same pattern.

**Step 7: Build to verify** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 8: Run tests** (30 sec)

```bash
npm test
```

Expected: All tests pass

**Step 9: Commit** (30 sec)

```bash
git add src/*.h
git commit -m "style(cpp): add explicit copy/move declarations per Google style"
```

---

### Task 3: Migrate Raw FFmpeg Pointers to RAII Wrappers

**Files:**
- Modify: `src/video_encoder.h`
- Modify: `src/video_encoder.cc`
- Modify: `src/video_decoder.h`
- Modify: `src/video_decoder.cc`
- Modify: `src/audio_encoder.h`
- Modify: `src/audio_encoder.cc`
- Modify: `src/audio_decoder.h`
- Modify: `src/audio_decoder.cc`
- Modify: `src/demuxer.h`
- Modify: `src/demuxer.cc`
- Modify: `src/video_filter.h`
- Modify: `src/video_filter.cc`
- Test: `test/golden/video-encoder.test.ts`

**Rationale:** Per Google Style Guide, prefer `std::unique_ptr` for exclusive ownership. The codebase has `ffmpeg_raii.h` with RAII wrappers but they're not used in most files. Manual `Cleanup()` patterns are error-prone.

**Step 1: Update VideoEncoder to use RAII** (5 min)

In `src/video_encoder.h`, replace:
```cpp
// FFmpeg state.
const AVCodec* codec_;
AVCodecContext* codec_context_;
SwsContext* sws_context_;
AVFrame* frame_;
AVPacket* packet_;
```

With:
```cpp
#include "src/ffmpeg_raii.h"

// FFmpeg state (using RAII wrappers).
const AVCodec* codec_;  // Not owned, just a reference to static codec
ffmpeg::AVCodecContextPtr codec_context_;
ffmpeg::SwsContextPtr sws_context_;
ffmpeg::AVFramePtr frame_;
ffmpeg::AVPacketPtr packet_;
```

**Step 2: Update VideoEncoder.cc Cleanup()** (3 min)

The `Cleanup()` function can be simplified since RAII handles deallocation:
```cpp
void VideoEncoder::Cleanup() {
  // RAII handles deallocation - just reset the smart pointers
  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}
```

**Step 3: Update allocation sites in Configure()** (5 min)

Replace:
```cpp
codec_context_ = avcodec_alloc_context3(codec_);
```

With:
```cpp
codec_context_ = ffmpeg::make_codec_context(codec_);
```

And similarly for other allocations:
```cpp
frame_ = ffmpeg::make_frame();
packet_ = ffmpeg::make_packet();
```

**Step 4: Update usage sites** (5 min)

Change direct pointer access to `.get()` where needed:
```cpp
// Before
avcodec_open2(codec_context_, codec_, nullptr);
// After
avcodec_open2(codec_context_.get(), codec_, nullptr);
```

**Step 5: Build and test** (1 min)

```bash
npm run build:native && npm test
```

Expected: Build succeeds, all tests pass

**Step 6: Commit VideoEncoder changes** (30 sec)

```bash
git add src/video_encoder.* src/ffmpeg_raii.h
git commit -m "refactor(VideoEncoder): use RAII for FFmpeg resources"
```

**Step 7: Repeat for VideoDecoder** (5 min)

Apply same pattern to `src/video_decoder.h` and `src/video_decoder.cc`.

**Step 8: Build and test** (1 min)

```bash
npm run build:native && npm test
```

**Step 9: Commit VideoDecoder changes** (30 sec)

```bash
git add src/video_decoder.*
git commit -m "refactor(VideoDecoder): use RAII for FFmpeg resources"
```

**Step 10: Repeat for AudioEncoder** (5 min)

Apply same pattern to `src/audio_encoder.h` and `src/audio_encoder.cc`.

**Step 11: Build and test** (1 min)

```bash
npm run build:native && npm test
```

**Step 12: Commit AudioEncoder changes** (30 sec)

```bash
git add src/audio_encoder.*
git commit -m "refactor(AudioEncoder): use RAII for FFmpeg resources"
```

**Step 13: Repeat for AudioDecoder** (5 min)

Apply same pattern to `src/audio_decoder.h` and `src/audio_decoder.cc`.

**Step 14: Build and test** (1 min)

```bash
npm run build:native && npm test
```

**Step 15: Commit AudioDecoder changes** (30 sec)

```bash
git add src/audio_decoder.*
git commit -m "refactor(AudioDecoder): use RAII for FFmpeg resources"
```

**Step 16: Repeat for Demuxer** (5 min)

Apply same pattern to `src/demuxer.h` and `src/demuxer.cc`. Add `AVFormatContextPtr` usage.

**Step 17: Build and test** (1 min)

```bash
npm run build:native && npm test
```

**Step 18: Commit Demuxer changes** (30 sec)

```bash
git add src/demuxer.*
git commit -m "refactor(Demuxer): use RAII for FFmpeg resources"
```

**Step 19: Repeat for VideoFilter** (5 min)

Apply same pattern to `src/video_filter.h` and `src/video_filter.cc`. Add `AVFilterGraphPtr` usage.

**Step 20: Build and test** (1 min)

```bash
npm run build:native && npm test
```

**Step 21: Commit VideoFilter changes** (30 sec)

```bash
git add src/video_filter.*
git commit -m "refactor(VideoFilter): use RAII for FFmpeg resources"
```

---

### Task 4: Add Namespace Closing Comments

**Files:**
- Modify: `src/video_encoder.cc:21`
- Modify: `src/video_decoder.cc:21`
- Modify: `src/ffmpeg_raii.h:138`

**Rationale:** Per Google Style Guide, multi-line namespaces should have closing comments: `}  // namespace name`

**Step 1: Check anonymous namespace closing comments** (2 min)

In `src/video_encoder.cc`, the anonymous namespace at line 21:
```cpp
}  // namespace
```

This is correct. Check other files.

**Step 2: Check ffmpeg_raii.h** (2 min)

In `src/ffmpeg_raii.h`, line 138:
```cpp
}  // namespace ffmpeg
```

This is correct.

**Step 3: Verify all namespaces have comments** (3 min)

Search through all files:
```bash
grep -n "^}" src/*.cc src/*.h | grep -v "//"
```

Fix any missing comments.

**Step 4: Build and verify** (30 sec)

```bash
npm run build:native
```

**Step 5: Commit if changes made** (30 sec)

```bash
git add src/*.cc src/*.h
git commit -m "style(cpp): add namespace closing comments per Google style"
```

---

### Task 5: Mark Single-Argument Constructors Explicit

**Files:**
- Modify: `src/async_encode_worker.h`
- Modify: `src/async_decode_worker.h`

**Rationale:** Per Google Style Guide, single-argument constructors should be marked `explicit` to prevent implicit conversions. The Napi::ObjectWrap constructors are already explicit, but worker classes need review.

**Step 1: Review AsyncEncodeWorker constructor** (2 min)

```cpp
AsyncEncodeWorker(VideoEncoder* encoder,
                  Napi::ThreadSafeFunction output_tsfn,
                  Napi::ThreadSafeFunction error_tsfn);
```

This has 3 arguments, so `explicit` is not required (but recommended for clarity).

**Step 2: Add explicit to multi-argument constructors** (3 min)

For consistency and to prevent future issues if arguments change:
```cpp
explicit AsyncEncodeWorker(VideoEncoder* encoder,
                           Napi::ThreadSafeFunction output_tsfn,
                           Napi::ThreadSafeFunction error_tsfn);
```

**Step 3: Apply same to AsyncDecodeWorker** (3 min)

Update `src/async_decode_worker.h` similarly.

**Step 4: Build and test** (30 sec)

```bash
npm run build:native && npm test
```

**Step 5: Commit** (30 sec)

```bash
git add src/async_*.h
git commit -m "style(cpp): add explicit to worker constructors"
```

---

### Task 6: Ensure Member Initialization Order Matches Declaration Order

**Files:**
- Modify: `src/video_decoder.cc:48-57`
- Modify: `src/audio_encoder.cc:37-48`
- Modify: `src/demuxer.cc:33-37`

**Rationale:** Per Google Style Guide and C++ best practices, member initialization order in the constructor initializer list must match the declaration order in the class. This prevents subtle bugs where initialization depends on another member that hasn't been initialized yet.

**Step 1: Review VideoDecoder constructor** (3 min)

Compare initialization order in `src/video_decoder.cc` constructor with declaration order in `src/video_decoder.h`.

Declaration order (from .h):
```cpp
const AVCodec* codec_;
AVCodecContext* codec_context_;
SwsContext* sws_context_;
AVFrame* frame_;
AVPacket* packet_;
// ... callbacks ...
std::string state_;
int coded_width_;
int coded_height_;
```

Initialization order (from .cc) must match.

**Step 2: Fix any mismatches in VideoDecoder** (3 min)

Reorder initializer list to match declaration order.

**Step 3: Review and fix AudioEncoder** (3 min)

Same process for `src/audio_encoder.cc`.

**Step 4: Review and fix Demuxer** (3 min)

Same process for `src/demuxer.cc`.

**Step 5: Build and test** (30 sec)

```bash
npm run build:native && npm test
```

**Step 6: Commit** (30 sec)

```bash
git add src/*.cc
git commit -m "style(cpp): fix member initializer order to match declaration"
```

---

### Task 7: Improve Error Handling Consistency

**Files:**
- Modify: `src/video_encoder.cc`
- Modify: `src/audio_encoder.cc`

**Rationale:** Per Google Style Guide, error handling should be consistent. The codebase mixes `throw Napi::Error` and `Napi::Error::New().ThrowAsJavaScriptException()`. Standardize on one pattern.

**Step 1: Identify inconsistency** (3 min)

In `video_encoder.cc`, errors use `throw`:
```cpp
throw Napi::Error::New(env, "...");
```

In `audio_encoder.cc`, errors use:
```cpp
Napi::Error::New(env, "...").ThrowAsJavaScriptException();
return env.Undefined();
```

Both patterns are valid, but `throw` is more idiomatic for NAPI and allows for natural exception flow.

**Step 2: Standardize audio_encoder.cc to use throw** (5 min)

Replace pattern:
```cpp
Napi::Error::New(env, "InvalidStateError: Encoder is closed")
    .ThrowAsJavaScriptException();
return env.Undefined();
```

With:
```cpp
throw Napi::Error::New(env, "InvalidStateError: Encoder is closed");
```

Note: Some places in NAPI constructors can't use `throw` (returns void), so keep `ThrowAsJavaScriptException()` there.

**Step 3: Build and test** (30 sec)

```bash
npm run build:native && npm test
```

**Step 4: Commit** (30 sec)

```bash
git add src/audio_encoder.cc
git commit -m "style(cpp): standardize error handling to use throw"
```

---

### Task 8: Add const Correctness to Methods

**Files:**
- Modify: `src/video_frame.h`
- Modify: `src/video_frame.cc`
- Modify: `src/encoded_video_chunk.h`
- Modify: `src/encoded_audio_chunk.h`
- Modify: `src/audio_data.h`

**Rationale:** Per Google Style Guide, use `const` for methods that don't modify state. Several getter methods could be marked `const`.

**Step 1: Review VideoFrame getters** (3 min)

These internal accessors should be `const`:
```cpp
uint8_t* GetData() { return data_.data(); }  // Can't be const (returns non-const)
size_t GetDataSize() const { return data_.size(); }  // Already const
int GetWidth() const { return coded_width_; }  // Already const
```

The `GetData()` that returns raw pointer can't be `const` since it returns mutable data, but we could add a const overload:
```cpp
const uint8_t* GetData() const { return data_.data(); }
uint8_t* GetData() { return data_.data(); }
```

**Step 2: Add const overloads where appropriate** (5 min)

Add const versions of data accessors.

**Step 3: Review EncodedVideoChunk** (3 min)

Check and fix const correctness in `src/encoded_video_chunk.h`.

**Step 4: Build and test** (30 sec)

```bash
npm run build:native && npm test
```

**Step 5: Commit** (30 sec)

```bash
git add src/*.h
git commit -m "style(cpp): improve const correctness per Google style"
```

---

### Task 9: Code Review

**TDD Instructions:**

**Step 1: Review all changes** (5 min)

```bash
git diff main..HEAD --stat
git log --oneline main..HEAD
```

**Step 2: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass

**Step 3: Run linter** (1 min)

```bash
npm run lint
```

Expected: No lint errors

**Step 4: Verify build is clean** (1 min)

```bash
npm run build
```

Expected: Clean build with no warnings

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 4, 5, 6 | Style-only changes, no file overlap concerns |
| Group 2 | 3 | RAII migration touches many files, needs sequential commits |
| Group 3 | 7, 8 | Error handling and const correctness |
| Group 4 | 9 | Final review, depends on all other tasks |

---

## Notes

1. **Why not use RAII for everything?** The `codec_` member is a pointer to a static FFmpeg codec descriptor - it's not owned and shouldn't be wrapped in RAII.

2. **Thread safety:** The RAII migration doesn't change thread safety characteristics. The `std::atomic` members remain unchanged.

3. **Backwards compatibility:** All changes are internal implementation details. The public Node.js API is unchanged.

4. **Testing strategy:** Each task builds and tests independently to catch issues early.
