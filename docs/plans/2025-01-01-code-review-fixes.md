# Code Review Fixes Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-code-review-fixes.md` to implement task-by-task.

**Goal:** Address 4 issues identified in code review: extradata padding, error checking, unused utilities, and code duplication.

**Architecture:** Minimal changes following existing codebase patterns. Each fix is isolated and can be verified independently.

**Tech Stack:** C++17, FFmpeg API, Node.js N-API

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Independent fixes in different files, no overlap |
| Group 2 | 4 | Code review (depends on all fixes) |

---

### Task 1: Fix muxer extradata padding

**Files:**
- Modify: `src/muxer.cc:160-168, 217-227`

**Step 1: Review correct pattern** (1 min)

The fix uses `av_mallocz()` instead of `av_malloc()` to zero-initialize padding bytes. This is the standard FFmpeg pattern for extradata allocation.

**Step 2: Fix AddVideoTrack extradata allocation** (2 min)

In `src/muxer.cc`, change line 160 from `av_malloc` to `av_mallocz`:

```cpp
// Before (line 160):
stream->codecpar->extradata =
    static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));

// After:
stream->codecpar->extradata =
    static_cast<uint8_t*>(av_mallocz(size + AV_INPUT_BUFFER_PADDING_SIZE));
```

**Step 3: Fix AddAudioTrack extradata allocation** (2 min)

In `src/muxer.cc`, change line 217 from `av_malloc` to `av_mallocz`:

```cpp
// Before (line 217):
stream->codecpar->extradata =
    static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));

// After:
stream->codecpar->extradata =
    static_cast<uint8_t*>(av_mallocz(size + AV_INPUT_BUFFER_PADDING_SIZE));
```

**Step 4: Build and verify** (1 min)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 5: Run muxer tests** (30 sec)

```bash
npx vitest run test/golden/muxer-integration.test.ts -v
```

Expected: All tests pass.

**Step 6: Commit** (30 sec)

```bash
git add src/muxer.cc && git commit -m "fix(muxer): zero-initialize extradata padding bytes

Use av_mallocz() instead of av_malloc() to ensure AV_INPUT_BUFFER_PADDING_SIZE
bytes are zeroed as required by FFmpeg API."
```

---

### Task 2: Add av_frame_get_buffer error check in video_encoder

**Files:**
- Modify: `src/video_encoder.cc:350-355`

**Step 1: Review correct pattern from audio_encoder** (1 min)

Reference implementation at `src/audio_encoder.cc:253-257`:
```cpp
ret = av_frame_get_buffer(frame_.get(), 0);
if (ret < 0) {
  Cleanup();
  throw Napi::Error::New(env, "Could not allocate frame buffer");
}
```

**Step 2: Add error check to video_encoder** (3 min)

In `src/video_encoder.cc`, locate the `Configure` method around line 350. Replace the unchecked call:

```cpp
// Before (line 352):
av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);

// After:
int frame_ret = av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);
if (frame_ret < 0) {
  Cleanup();
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(frame_ret, errbuf, sizeof(errbuf));
  throw Napi::Error::New(env, std::string("Could not allocate video frame buffer: ") + errbuf);
}
```

**Step 3: Build and verify** (1 min)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 4: Run encoder tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -v
```

Expected: All tests pass.

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc && git commit -m "fix(video-encoder): check av_frame_get_buffer return value

Add error handling for frame buffer allocation failure, matching the
pattern used in audio_encoder.cc."
```

---

### Task 3: Remove unused utilities from common.cc

**Files:**
- Modify: `src/common.cc:21-26, 347-350`
- Modify: `src/common.h` (remove declarations)

**Step 1: Remove FreeCallback from common.cc** (2 min)

In `src/common.cc`, delete lines 21-26:

```cpp
// DELETE these lines:
// FreeCallback for consistent buffer deallocation (following sharp pattern).
// Default implementation uses delete[]. Can be overridden for platform-specific
// memory management (e.g., Windows mixed runtime scenarios).
std::function<void(void*, uint8_t*)> FreeCallback = [](void*, uint8_t* data) {
  delete[] data;
};
```

**Step 2: Remove TrimEnd from common.cc** (2 min)

In `src/common.cc`, delete lines 347-350:

```cpp
// DELETE these lines:
std::string TrimEnd(const std::string& str) {
  size_t end = str.find_last_not_of(" \t\n\r\f\v");
  return (end == std::string::npos) ? "" : str.substr(0, end + 1);
}
```

**Step 3: Remove declarations from common.h** (2 min)

In `src/common.h`, find and delete the declarations for both utilities:

```cpp
// DELETE FreeCallback declaration (around line 121-127):
// FreeCallback for consistent buffer deallocation.
extern std::function<void(void*, uint8_t*)> FreeCallback;

// DELETE TrimEnd declaration (around line 133):
std::string TrimEnd(const std::string& str);
```

**Step 4: Verify no usages exist** (30 sec)

```bash
grep -r "FreeCallback\|TrimEnd" src/ --include="*.cc" --include="*.h" | grep -v "^Binary"
```

Expected: No matches (confirming these are unused).

**Step 5: Build and verify** (1 min)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 6: Run all tests** (1 min)

```bash
npm run test-fast
```

Expected: All tests pass.

**Step 7: Commit** (30 sec)

```bash
git add src/common.cc src/common.h && git commit -m "refactor(common): remove unused FreeCallback and TrimEnd utilities

These utilities were added following Sharp patterns but were never used.
Removing to follow YAGNI principle."
```

---

### Task 4: Extract ComputeTemporalLayerId to common.h

**Files:**
- Modify: `src/common.h` (add declaration)
- Modify: `src/common.cc` (add implementation)
- Modify: `src/video_encoder.cc:21-34` (remove duplicate, add include if needed)
- Modify: `src/async_encode_worker.cc:21-34` (remove duplicate, add include if needed)

**Step 1: Add declaration to common.h** (2 min)

In `src/common.h`, add near other utility function declarations:

```cpp
// Compute temporal layer ID for SVC encoding patterns.
// L1T2: alternating pattern [0, 1, 0, 1, ...]
// L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count);
```

**Step 2: Add implementation to common.cc** (3 min)

In `src/common.cc`, add at the end (before closing namespace if any):

```cpp
int ComputeTemporalLayerId(int64_t frame_index, int temporal_layer_count) {
  if (temporal_layer_count <= 1) return 0;

  if (temporal_layer_count == 2) {
    // L1T2: alternating pattern [0, 1, 0, 1, ...]
    return (frame_index % 2 == 0) ? 0 : 1;
  }

  // L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
  int pos = frame_index % 4;
  if (pos == 0) return 0;  // Base layer
  if (pos == 2) return 1;  // Middle layer
  return 2;                // Enhancement layer (pos 1, 3)
}
```

**Step 3: Remove duplicate from video_encoder.cc** (2 min)

In `src/video_encoder.cc`, delete lines 21-34 (the `ComputeTemporalLayerId` function). Verify `#include "common.h"` exists at the top of the file.

**Step 4: Remove duplicate from async_encode_worker.cc** (2 min)

In `src/async_encode_worker.cc`, delete lines 21-34 (the `ComputeTemporalLayerId` function and comment). Verify `#include "common.h"` exists at the top of the file.

**Step 5: Build and verify** (1 min)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 6: Run encoder tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts test/golden/video-encoder-async.test.ts -v
```

Expected: All tests pass.

**Step 7: Commit** (30 sec)

```bash
git add src/common.h src/common.cc src/video_encoder.cc src/async_encode_worker.cc && git commit -m "refactor(encoder): extract ComputeTemporalLayerId to common.h

Move duplicated function to shared utility header following DRY principle.
Function is used by both video_encoder.cc and async_encode_worker.cc for
SVC temporal layer calculations."
```

---

### Task 5: Code Review

**Step 1: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run linters** (1 min)

```bash
npm run lint
```

Expected: No lint errors.

**Step 3: Review changes** (2 min)

```bash
git log --oneline -4
git diff HEAD~4 --stat
```

Verify 4 commits were made with proper messages.

**Step 4: Mark complete** (30 sec)

All code review issues have been addressed:
1. Muxer extradata padding - Fixed with av_mallocz
2. av_frame_get_buffer error check - Added error handling
3. Unused utilities - Removed FreeCallback and TrimEnd
4. Code duplication - Extracted ComputeTemporalLayerId to common.h
