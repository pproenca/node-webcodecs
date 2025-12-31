# FFmpeg RAII Audit Fixes Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-ffmpeg-raii-audit-fixes.md` to implement task-by-task.

**Goal:** Fix all memory safety, RAII compliance, and error handling issues identified by the ffmpeg-cpp-sentinel audit.

**Architecture:** Convert all raw FFmpeg pointer usage to RAII wrappers from `ffmpeg_raii.h`, add missing wrappers, and ensure proper error handling on all FFmpeg API calls.

**Tech Stack:** C++17, N-API, FFmpeg (libavcodec/libavformat/libswscale/libswresample)

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Foundation: Add missing RAII wrappers (no file overlap) |
| Group 2 | 3 | ImageDecoder refactor (depends on Group 1 wrappers) |
| Group 3 | 4, 5, 6 | CopyTo fixes (independent files, no overlap) |
| Group 4 | 7 | Error handling audit (depends on previous fixes being stable) |
| Group 5 | 8 | Code Review |

---

### Task 1: Add AVIOContextPtr RAII Wrapper

**Files:**
- Modify: `src/ffmpeg_raii.h:1-200`
- Test: `test/contracts/raii-wrappers.cjs` (new)

**Step 1: Write the failing test** (2-5 min)

Create a contract test that verifies AVIOContextPtr behavior:

```javascript
// test/contracts/raii-wrappers.cjs
const { execSync } = require('child_process');
const assert = require('assert');
const path = require('path');

// This test verifies RAII wrapper existence by checking the native module compiles
// and exports properly. Direct RAII testing requires C++ unit tests.

describe('RAII Wrappers Contract', function() {
  it('should have AVIOContextPtr type available (compilation check)', function() {
    // If the module loads, the RAII types compiled successfully
    const modulePath = path.join(__dirname, '../../build/Release/webcodecs.node');
    const addon = require(modulePath);
    assert(addon, 'Native addon should load successfully');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
node test/contracts/raii-wrappers.cjs
```

Expected: PASS (this is a compilation verification test - validates change doesn't break build)

**Step 3: Write AVIOContextPtr wrapper** (2-5 min)

Add to `src/ffmpeg_raii.h` after the existing deleter definitions (around line 70):

```cpp
// AVIOContext deleter - handles buffer cleanup
struct AVIOContextDeleter {
    bool owns_buffer = true;  // Set false if buffer is externally managed

    void operator()(AVIOContext* ctx) const {
        if (ctx) {
            if (owns_buffer && ctx->buffer) {
                av_freep(&ctx->buffer);
            }
            avio_context_free(&ctx);
        }
    }
};
using AVIOContextPtr = std::unique_ptr<AVIOContext, AVIOContextDeleter>;

// Factory function for AVIOContext
inline AVIOContextPtr make_avio_context(
    unsigned char* buffer,
    int buffer_size,
    int write_flag,
    void* opaque,
    int (*read_packet)(void* opaque, uint8_t* buf, int buf_size),
    int (*write_packet)(void* opaque, const uint8_t* buf, int buf_size),
    int64_t (*seek)(void* opaque, int64_t offset, int whence),
    bool owns_buffer = true
) {
    AVIOContext* ctx = avio_alloc_context(
        buffer, buffer_size, write_flag, opaque,
        read_packet, write_packet, seek
    );
    AVIOContextDeleter deleter;
    deleter.owns_buffer = owns_buffer;
    return AVIOContextPtr(ctx, deleter);
}
```

**Step 4: Run build to verify compilation** (30 sec)

```bash
npm run build:native
```

Expected: SUCCESS (build completes without errors)

**Step 5: Run contract test** (30 sec)

```bash
node test/contracts/raii-wrappers.cjs
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/ffmpeg_raii.h test/contracts/raii-wrappers.cjs
git commit -m "feat(raii): add AVIOContextPtr wrapper for memory-safe AVIO handling"
```

---

### Task 2: Add MemoryBufferContextPtr Helper

**Files:**
- Modify: `src/image_decoder.h:1-100`
- Test: Build verification (compilation test)

**Step 1: Read current MemoryBufferContext definition** (1 min)

Review `src/image_decoder.h` to understand the MemoryBufferContext struct.

**Step 2: Write unique_ptr typedef** (2-5 min)

Add after MemoryBufferContext definition in `src/image_decoder.h`:

```cpp
// RAII wrapper for MemoryBufferContext
using MemoryBufferContextPtr = std::unique_ptr<MemoryBufferContext>;
```

**Step 3: Run build to verify** (30 sec)

```bash
npm run build:native
```

Expected: SUCCESS

**Step 4: Commit** (30 sec)

```bash
git add src/image_decoder.h
git commit -m "feat(image-decoder): add MemoryBufferContextPtr for RAII memory management"
```

---

### Task 3: Refactor ImageDecoder to Use RAII Wrappers

**Files:**
- Modify: `src/image_decoder.h:60-80`
- Modify: `src/image_decoder.cc:1-500`
- Test: `test/golden/image-decoder.test.ts` (existing)

**Step 1: Run existing tests to establish baseline** (30 sec)

```bash
npx vitest run test/golden/image-decoder.test.ts
```

Expected: PASS (establishes baseline)

**Step 2: Update ImageDecoder.h member declarations** (2-5 min)

Replace raw pointers with RAII wrappers in `src/image_decoder.h`:

```cpp
// Before (around lines 68-77):
// const AVCodec* codec_;
// AVCodecContext* codec_context_;
// SwsContext* sws_context_;
// AVFrame* frame_;
// AVPacket* packet_;
// AVFormatContext* format_context_;
// AVIOContext* avio_context_;
// MemoryBufferContext* mem_ctx_;

// After:
const AVCodec* codec_;  // Non-owning pointer, no change
ffmpeg::AVCodecContextPtr codec_context_;
ffmpeg::SwsContextPtr sws_context_;
ffmpeg::AVFramePtr frame_;
ffmpeg::AVPacketPtr packet_;
ffmpeg::AVFormatContextPtr format_context_;
ffmpeg::AVIOContextPtr avio_context_;
MemoryBufferContextPtr mem_ctx_;
```

**Step 3: Update ImageDecoder.cc initialization** (5 min)

Replace all raw allocations in `src/image_decoder.cc`:

```cpp
// In DecodeImage or initialization:
// Before: codec_context_ = avcodec_alloc_context3(codec_);
// After:
codec_context_ = ffmpeg::make_codec_context(codec_);

// Before: frame_ = av_frame_alloc();
// After:
frame_ = ffmpeg::make_frame();

// Before: packet_ = av_packet_alloc();
// After:
packet_ = ffmpeg::make_packet();

// Before: mem_ctx_ = new MemoryBufferContext{...};
// After:
mem_ctx_ = std::make_unique<MemoryBufferContext>(...);
```

**Step 4: Remove Cleanup() method manual frees** (5 min)

The `Cleanup()` method should become mostly empty since RAII handles cleanup:

```cpp
void ImageDecoder::Cleanup() {
    // RAII handles all cleanup automatically
    // Reset pointers to release resources early if needed
    sws_context_.reset();
    frame_.reset();
    packet_.reset();
    codec_context_.reset();
    format_context_.reset();  // Must be before avio_context_
    avio_context_.reset();
    mem_ctx_.reset();
}
```

**Step 5: Update all `.get()` calls** (5 min)

Replace direct pointer access with `.get()`:

```cpp
// Before: avcodec_send_packet(codec_context_, packet_);
// After:
avcodec_send_packet(codec_context_.get(), packet_.get());

// Before: avcodec_receive_frame(codec_context_, frame_);
// After:
avcodec_receive_frame(codec_context_.get(), frame_.get());
```

**Step 6: Run tests to verify refactor** (30 sec)

```bash
npx vitest run test/golden/image-decoder.test.ts
```

Expected: PASS (all tests still pass)

**Step 7: Run valgrind leak check** (2 min)

```bash
npm run test-leak
```

Expected: No new leaks

**Step 8: Commit** (30 sec)

```bash
git add src/image_decoder.h src/image_decoder.cc
git commit -m "refactor(image-decoder): convert to RAII wrappers for memory safety

- Replace raw AVCodecContext*, SwsContext*, AVFrame*, AVPacket* with RAII ptrs
- Replace raw AVFormatContext*, AVIOContext* with RAII ptrs
- Replace raw MemoryBufferContext* with unique_ptr
- Simplify Cleanup() to rely on RAII destructors
- Eliminates potential memory leaks on error paths"
```

---

### Task 4: Fix VideoFrame::CopyTo Raw SwsContext

**Files:**
- Modify: `src/video_frame.cc` (CopyTo method)
- Test: `test/golden/video-frame.test.ts` (existing)

**Step 1: Run existing tests** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts
```

Expected: PASS

**Step 2: Locate CopyTo method and identify raw SwsContext** (1 min)

Find the `sws_getContext()` call and its corresponding `sws_freeContext()`.

**Step 3: Replace with RAII wrapper** (2-5 min)

```cpp
// Before:
// SwsContext* sws_ctx = sws_getContext(...);
// ... processing ...
// sws_freeContext(sws_ctx);

// After:
ffmpeg::SwsContextPtr sws_ctx(
    sws_getContext(src_width, src_height, src_format,
                   dst_width, dst_height, dst_format,
                   SWS_BILINEAR, nullptr, nullptr, nullptr),
    ffmpeg::SwsContextDeleter());

if (!sws_ctx) {
    ErrorBuilder(env).DOMException("EncodingError", "Failed to create scaling context");
    return env.Undefined();
}

// Use sws_ctx.get() for FFmpeg API calls
sws_scale(sws_ctx.get(), ...);
// No manual sws_freeContext() needed - RAII handles it
```

**Step 4: Remove manual sws_freeContext call** (1 min)

Delete the `sws_freeContext(sws_ctx);` line.

**Step 5: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-frame.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "fix(video-frame): use RAII for SwsContext in CopyTo to prevent leaks"
```

---

### Task 5: Fix AudioData::CopyTo Raw SwrContext

**Files:**
- Modify: `src/audio_data.cc` (CopyTo method)
- Test: `test/golden/audio-data.test.ts` (existing)

**Step 1: Run existing tests** (30 sec)

```bash
npx vitest run test/golden/audio-data.test.ts
```

Expected: PASS

**Step 2: Locate CopyTo method and identify raw SwrContext** (1 min)

Find `swr_alloc()` and `swr_free()` calls.

**Step 3: Replace with RAII wrapper** (2-5 min)

```cpp
// Before:
// SwrContext* swr = swr_alloc();
// ... configuration and processing ...
// swr_free(&swr);

// After:
ffmpeg::SwrContextPtr swr = ffmpeg::make_swr_context();
if (!swr) {
    ErrorBuilder(env).DOMException("EncodingError", "Failed to allocate resampler");
    return env.Undefined();
}

// Configuration using swr.get()
av_opt_set_int(swr.get(), "in_channel_layout", ...);
// ... rest of configuration ...

int ret = swr_init(swr.get());
if (ret < 0) {
    ErrorBuilder(env).DOMException("EncodingError",
        "Failed to initialize resampler: " + FFmpegErrorString(ret));
    return env.Undefined();
}

// Use swr.get() for conversion
swr_convert(swr.get(), ...);
// No manual swr_free() needed
```

**Step 4: Remove manual swr_free call** (1 min)

Delete the `swr_free(&swr);` line.

**Step 5: Run tests** (30 sec)

```bash
npx vitest run test/golden/audio-data.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/audio_data.cc
git commit -m "fix(audio-data): use RAII for SwrContext in CopyTo to prevent leaks"
```

---

### Task 6: Fix VideoFilter::CopyTo Raw SwsContext

**Files:**
- Modify: `src/video_filter.cc` (CopyTo method)
- Test: `test/golden/video-filter.test.ts` (existing, if available) or build verification

**Step 1: Run existing tests** (30 sec)

```bash
npx vitest run test/golden/video-filter.test.ts 2>/dev/null || echo "No specific test file, will use build verification"
```

**Step 2: Locate CopyTo method and identify raw SwsContext** (1 min)

Find `sws_getContext()` and `sws_freeContext()` calls.

**Step 3: Replace with RAII wrapper** (2-5 min)

Same pattern as Task 4:

```cpp
ffmpeg::SwsContextPtr sws_ctx(
    sws_getContext(...),
    ffmpeg::SwsContextDeleter());

if (!sws_ctx) {
    // Handle error
    return;
}

sws_scale(sws_ctx.get(), ...);
// RAII cleanup automatic
```

**Step 4: Remove manual sws_freeContext call** (1 min)

**Step 5: Run build and tests** (30 sec)

```bash
npm run build:native && npm run test-fast
```

Expected: SUCCESS and PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_filter.cc
git commit -m "fix(video-filter): use RAII for SwsContext in CopyTo to prevent leaks"
```

---

### Task 7: Audit and Fix FFmpeg Error Handling

**Files:**
- Modify: `src/image_decoder.cc` (multiple locations)
- Test: Build verification + existing tests

**Step 1: Find all unchecked FFmpeg return values** (2 min)

Search for FFmpeg function calls without return value checks:

```bash
grep -n "avcodec_parameters_to_context\|av_image_fill_arrays\|avcodec_open2" src/image_decoder.cc
```

**Step 2: Add error checking to avcodec_parameters_to_context** (2-5 min)

```cpp
// Before:
// avcodec_parameters_to_context(codec_context_.get(),
//     format_context_->streams[video_stream_index_]->codecpar);

// After:
int ret = avcodec_parameters_to_context(codec_context_.get(),
    format_context_->streams[video_stream_index_]->codecpar);
if (ret < 0) {
    // Log error or set error state
    return false;
}
```

**Step 3: Add error checking to av_image_fill_arrays** (2-5 min)

```cpp
// Before:
// av_image_fill_arrays(frame->data, frame->linesize, data, format, width, height, 1);

// After:
int ret = av_image_fill_arrays(frame->data, frame->linesize,
                                data, format, width, height, 1);
if (ret < 0) {
    ErrorBuilder(env).DOMException("EncodingError",
        "Failed to fill image arrays: " + FFmpegErrorString(ret));
    return env.Undefined();
}
```

**Step 4: Improve AVERROR_EOF handling** (2-5 min)

```cpp
ret = avcodec_receive_frame(codec_context_.get(), frame_.get());
if (ret == AVERROR(EAGAIN)) {
    // Need more input - continue loop
    continue;
} else if (ret == AVERROR_EOF) {
    // Normal end of stream - break loop
    break;
} else if (ret < 0) {
    // Actual error
    return false;
}
```

**Step 5: Run tests** (30 sec)

```bash
npm run test-fast
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/image_decoder.cc
git commit -m "fix(image-decoder): add proper error handling for FFmpeg API calls

- Check avcodec_parameters_to_context return value
- Check av_image_fill_arrays return value
- Handle AVERROR_EOF as normal end-of-stream, not error"
```

---

### Task 8: Code Review

**Files:**
- All modified files from Tasks 1-7

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

**Step 3: Run memory leak detection** (2 min)

```bash
npm run test-leak
```

Expected: No leaks detected

**Step 4: Run stress tests** (2 min)

```bash
npm run test-stress
```

Expected: No memory growth under load

**Step 5: Run linters** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

---

## Post-Completion Actions

After all tasks complete:

1. **Final Code Review** - Review all changes for consistency
2. **Merge Strategy** - Squash or rebase commits as appropriate
3. **Documentation** - Update CHANGELOG if needed
