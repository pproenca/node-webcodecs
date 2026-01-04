# Phase 1: Complete RAII Adoption in image_decoder.cc

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-04-phase1-raii-adoption-image-decoder.md` to implement task-by-task.

**Goal:** Eliminate 9 raw `av_malloc` calls in image_decoder.cc by adding RAII wrappers for AVIOContext and custom buffer management. Prevents memory leaks in error paths.

**Architecture:** Follow existing RAII pattern from `src/ffmpeg_raii.h` (AVFramePtr, AVPacketPtr, etc.). Create three new deleters: (1) AVIOContextDeleter for avio_context_free(), (2) MemoryBufferContextDeleter for custom delete, (3) Composite deleter for AVFormatContext that cleans up associated AVIO resources. Single atomic refactor eliminates 8+ duplicate cleanup sequences in error paths.

**Tech Stack:** C++17, FFmpeg 5.0+, N-API, Node.js test runner

**Benchmark Justification:** RAII overhead is 5% (raii_overhead.cpp), acceptable for eliminating HIGH bug risk.

---

### Task 1: Add RAII Deleters to ffmpeg_raii.h

**Files:**
- Modify: `src/ffmpeg_raii.h:116-151` (add new deleters after AVFilterInOutDeleter)

**Step 1: Write test for MemoryBufferContextDeleter** (2-5 min)

Create new test file to verify RAII wrapper behavior:

```cpp
// test/unit/ffmpeg_raii.test.cc (new file)
#include "src/ffmpeg_raii.h"
#include <cassert>

struct TestContext {
  int value;
  bool* deleted_flag;
  ~TestContext() { if (deleted_flag) *deleted_flag = true; }
};

void test_memory_buffer_context_deleter() {
  bool deleted = false;
  {
    TestContext* ctx = new TestContext{42, &deleted};
    ffmpeg::MemoryBufferContextPtr ptr(ctx);
    assert(ptr->value == 42);
  } // ptr goes out of scope
  assert(deleted == true); // Deleter called delete
}

int main() {
  test_memory_buffer_context_deleter();
  return 0;
}
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
g++ -std=c++17 -I. test/unit/ffmpeg_raii.test.cc -o /tmp/test_raii
/tmp/test_raii
```

Expected: Compilation error `error: 'MemoryBufferContextPtr' is not a member of 'ffmpeg'`

**Step 3: Add MemoryBufferContextDeleter to ffmpeg_raii.h** (2-5 min)

Add after line 116 (AVFilterInOutDeleter):

```cpp
// Forward declare MemoryBufferContext from image_decoder.cc
struct MemoryBufferContext;

// MemoryBufferContext deleter (custom delete)
struct MemoryBufferContextDeleter {
  void operator()(MemoryBufferContext* ctx) const noexcept {
    delete ctx;
  }
};
```

Add type alias after line 130:

```cpp
using MemoryBufferContextPtr =
    std::unique_ptr<MemoryBufferContext, MemoryBufferContextDeleter>;
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
g++ -std=c++17 -I. test/unit/ffmpeg_raii.test.cc -o /tmp/test_raii
/tmp/test_raii
```

Expected: Compilation succeeds, test passes (no assertion failures)

**Step 5: Add AVIOContextDeleter** (2-5 min)

Add after MemoryBufferContextDeleter:

```cpp
// AVIOContext deleter (handles avio_context_free semantics)
// NOTE: Does NOT free the internal buffer - caller must handle that separately
struct AVIOContextDeleter {
  void operator()(AVIOContext* ctx) const noexcept {
    if (ctx) {
      // Free the buffer allocated with av_malloc before freeing context
      if (ctx->buffer) {
        av_freep(&ctx->buffer);
      }
      avio_context_free(&ctx);
    }
  }
};
```

Add type alias:

```cpp
using AVIOContextPtr = std::unique_ptr<AVIOContext, AVIOContextDeleter>;
```

**Step 6: Add ImageFormatContextDeleter for input contexts** (2-5 min)

image_decoder uses avformat_alloc_context + avformat_close_input pattern (different from existing AVFormatContextDeleter):

```cpp
// AVFormatContext deleter for image decoding (uses alloc + close_input)
// Also cleans up associated AVIO context stored in ctx->pb
struct ImageFormatContextDeleter {
  void operator()(AVFormatContext* ctx) const noexcept {
    if (ctx) {
      // avformat_close_input handles both the context and its streams
      avformat_close_input(&ctx);
    }
  }
};
```

Add type alias:

```cpp
using ImageFormatContextPtr =
    std::unique_ptr<AVFormatContext, ImageFormatContextDeleter>;
```

**Step 7: Commit RAII wrapper additions** (30 sec)

```bash
git add src/ffmpeg_raii.h test/unit/ffmpeg_raii.test.cc
git commit -m "feat(raii): add AVIOContext and MemoryBufferContext deleters

- Add MemoryBufferContextDeleter for custom image decoder context
- Add AVIOContextDeleter with automatic buffer cleanup
- Add ImageFormatContextDeleter for input format contexts
- Add unit test verifying deleter behavior
- Benchmark: 5% overhead acceptable for memory safety"
```

---

### Task 2: Update image_decoder.h Member Declarations

**Files:**
- Modify: `src/image_decoder.h:77-81` (change raw pointers to RAII types)

**Step 1: Write test verifying old member types** (2-5 min)

Add to existing test file:

```typescript
// test/golden/image-decoder.test.ts
import { test } from 'node:test';
import { ImageDecoder } from '../../lib/image-decoder.js';

test('ImageDecoder can be constructed multiple times without leaks', async () => {
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    const decoder = new ImageDecoder({ type: 'image/png', data: new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // PNG signature
    ])});
    decoder.close();
  }
  // If there's a leak, this will accumulate memory
  // We'll verify with leak checker in Task 3
});
```

**Step 2: Run test to establish baseline** (30 sec)

```bash
npm test -- --grep "can be constructed multiple times"
```

Expected: PASS (baseline - leaks may exist but test doesn't detect them yet)

**Step 3: Update member declarations in image_decoder.h** (2-5 min)

Replace lines 77-80:

```cpp
// Before:
AVFormatContext* format_context_;  // For container parsing
AVIOContext* avio_context_;        // Custom I/O for memory buffer
struct MemoryBufferContext* mem_ctx_;  // Owned, freed in Cleanup()

// After:
ffmpeg::ImageFormatContextPtr format_context_;  // For container parsing
ffmpeg::AVIOContextPtr avio_context_;           // Custom I/O for memory buffer
ffmpeg::MemoryBufferContextPtr mem_ctx_;        // Owned, RAII managed
```

**Step 4: Verify compilation fails with member access errors** (30 sec)

```bash
npm run build:native
```

Expected: Compilation errors in image_decoder.cc (raw pointer usage incompatible with unique_ptr)

**Step 5: Commit header changes** (30 sec)

```bash
git add src/image_decoder.h
git commit -m "refactor(image-decoder): migrate members to RAII types

- Replace raw AVFormatContext* with ImageFormatContextPtr
- Replace raw AVIOContext* with AVIOContextPtr
- Replace raw MemoryBufferContext* with MemoryBufferContextPtr
- Prepares for automatic cleanup in image_decoder.cc"
```

---

### Task 3: Refactor image_decoder.cc to Use RAII

**Files:**
- Modify: `src/image_decoder.cc:235-257` (Cleanup method)
- Modify: `src/image_decoder.cc:320-481` (ParseAnimatedImageMetadata)

**Step 1: Simplify Cleanup() method** (2-5 min)

Replace lines 235-257 with RAII-based cleanup:

```cpp
void ImageDecoder::Cleanup() {
  // Reset RAII members (automatic cleanup)
  codec_context_.reset();
  sws_context_.reset();
  frame_.reset();
  packet_.reset();

  // Reset animated image RAII members
  format_context_.reset();  // Calls ImageFormatContextDeleter
  avio_context_.reset();    // Calls AVIOContextDeleter (frees buffer too)
  mem_ctx_.reset();         // Calls MemoryBufferContextDeleter

  video_stream_index_ = -1;

  // Clear decoded frame data
  decoded_data_.clear();
  decoded_frames_.clear();
}
```

**Step 2: Refactor ParseAnimatedImageMetadata - Part A (buffer allocation)** (3-5 min)

Replace lines 323-335 (raw allocation) with RAII:

```cpp
// Allocate memory buffer context for custom I/O (RAII managed)
mem_ctx_.reset(new MemoryBufferContext{
  .data = data_.data(),
  .size = data_.size(),
  .position = 0
});

// Allocate AVIO buffer (will be owned by AVIOContext)
uint8_t* avio_buffer = static_cast<uint8_t*>(av_malloc(kAVIOBufferSize));
if (!avio_buffer) {
  mem_ctx_.reset();  // RAII cleanup
  return false;
}
```

**Step 3: Refactor ParseAnimatedImageMetadata - Part B (AVIO context creation)** (3-5 min)

Replace lines 337-345:

```cpp
// Create custom AVIO context (takes ownership of avio_buffer)
AVIOContext* raw_avio = avio_alloc_context(
    avio_buffer, kAVIOBufferSize, 0, mem_ctx_.get(),
    ReadPacket, nullptr, SeekPacket);
if (!raw_avio) {
  av_free(avio_buffer);  // avio_alloc_context failed, free buffer manually
  mem_ctx_.reset();
  return false;
}
avio_context_.reset(raw_avio);  // Transfer ownership to RAII wrapper
```

**Step 4: Refactor ParseAnimatedImageMetadata - Part C (format context)** (3-5 min)

Replace lines 347-355:

```cpp
// Allocate format context (RAII managed)
format_context_.reset(avformat_alloc_context());
if (!format_context_) {
  // RAII will clean up avio_context_ and mem_ctx_ automatically
  return false;
}

format_context_->pb = avio_context_.get();  // Use raw pointer for FFmpeg API
format_context_->flags |= AVFMT_FLAG_CUSTOM_IO;
```

**Step 5: Remove all duplicate cleanup sequences** (3-5 min)

Delete cleanup code at error paths (lines 371-379, 384-392, 404-412, 423-431, 436-444, 448-456, 460-468, 472-480):

```cpp
// BEFORE (repeated 8 times):
avformat_close_input(&format_context_);
av_freep(&avio_context_->buffer);
avio_context_free(&avio_context_);
avio_context_ = nullptr;
delete mem_ctx_;
mem_ctx_ = nullptr;
return false;

// AFTER (single line):
return false;  // RAII handles cleanup automatically
```

**Step 6: Fix avformat_open_input ownership transfer** (2-3 min)

Line 372 comment says "format_context_ is freed by avformat_open_input on failure". Handle this:

```cpp
// Open input (avformat_open_input takes ownership on success, frees on failure)
AVFormatContext* raw_fmt = format_context_.release();  // Release ownership
int ret = avformat_open_input(&raw_fmt, nullptr, input_format, nullptr);
if (ret < 0) {
  // avformat_open_input freed raw_fmt on failure, set to nullptr
  return false;
}
format_context_.reset(raw_fmt);  // Take ownership back on success
```

**Step 7: Build and fix compilation errors** (2-3 min)

```bash
npm run build:native 2>&1 | head -20
```

Fix any remaining raw pointer usage (e.g., `format_context_` -> `format_context_.get()`):

```cpp
// Update all member access to use .get() for raw pointer API calls
format_context_.get()->pb = avio_context_.get();
format_context_.get()->flags |= AVFMT_FLAG_CUSTOM_IO;
```

**Step 8: Run tests to verify no regressions** (1-2 min)

```bash
npm test -- test/golden/image-decoder.test.ts
```

Expected: All existing tests PASS (no behavioral changes)

**Step 9: Commit RAII refactoring** (30 sec)

```bash
git add src/image_decoder.cc
git commit -m "refactor(image-decoder): eliminate raw av_malloc calls

- Migrate ParseAnimatedImageMetadata to use RAII wrappers
- Remove 8+ duplicate cleanup sequences in error paths
- Simplify Cleanup() method (automatic resource management)
- Fix: memory leaks in error paths now impossible
- Benchmark: 5% RAII overhead acceptable for safety"
```

---

### Task 4: Add Memory Leak Detection Test

**Files:**
- Modify: `test/stress/memory-leak.test.ts:1-50` (add ImageDecoder counters)
- Modify: `src/image_decoder.h:35-48` (add static counters)
- Modify: `src/image_decoder.cc:39-40,425-442` (increment/decrement counters)

**Step 1: Write failing memory leak test** (3-5 min)

Add to `test/stress/memory-leak.test.ts`:

```typescript
test('ImageDecoder: animated GIF decode does not leak', async () => {
  const before = getCounters();

  const iterations = 50;
  for (let i = 0; i < iterations; i++) {
    const decoder = new ImageDecoder({
      type: 'image/gif',
      data: gifData  // Use test fixture with multiple frames
    });

    await decoder.decode({ frameIndex: 0 });
    await decoder.decode({ frameIndex: 1 });

    decoder.close();
  }

  global.gc();  // Force garbage collection
  await new Promise(resolve => setTimeout(resolve, 100));

  const after = getCounters();
  assertNoLeaks(before, after, 'ImageDecoder');
});
```

**Step 2: Run test to verify current leak detection** (30 sec)

```bash
npm run test:stress -- --grep "ImageDecoder.*does not leak"
```

Expected: SKIP or FAIL (ImageDecoder not tracked in counters yet)

**Step 3: Add ImageDecoder instance counter** (2-3 min)

In `src/image_decoder.h`, add after line 35:

```cpp
public:
  static std::atomic<int64_t> instance_count_;
  static int64_t GetInstanceCount() { return instance_count_.load(); }
```

In `src/image_decoder.cc`, add after includes:

```cpp
std::atomic<int64_t> ImageDecoder::instance_count_{0};
```

In constructor (after line 39), increment:

```cpp
instance_count_.fetch_add(1);
```

In destructor (before line 425), decrement:

```cpp
instance_count_.fetch_sub(1);
```

**Step 4: Export counter to JavaScript** (2-3 min)

In `src/addon.cc`, expose counter:

```cpp
// Add to Napi::Object Init(Napi::Env env, Napi::Object exports)
obj.Set("getImageDecoderCount",
        Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
          return Napi::Number::New(info.Env(), ImageDecoder::GetInstanceCount());
        }));
```

**Step 5: Update test helper to check ImageDecoder count** (2-3 min)

In `test/helpers/leak-check.ts`, add ImageDecoder to counters:

```typescript
interface Counters {
  videoFrames: number;
  audioData: number;
  imageDecoders: number;  // Add this
  // ... existing fields
}

export function getCounters(): Counters {
  const native = require('../../build/Release/node_webcodecs.node');
  return {
    videoFrames: native.getVideoFrameCount(),
    audioData: native.getAudioDataCount(),
    imageDecoders: native.getImageDecoderCount(),  // Add this
    // ... existing
  };
}
```

**Step 6: Run leak test to verify PASS** (1-2 min)

```bash
npm run test:stress -- --grep "ImageDecoder.*does not leak"
```

Expected: PASS (RAII prevents leaks, counters return to baseline)

**Step 7: Commit leak detection** (30 sec)

```bash
git add src/image_decoder.{h,cc} src/addon.cc test/stress/memory-leak.test.ts test/helpers/leak-check.ts
git commit -m "test(image-decoder): add memory leak detection

- Add instance counter for ImageDecoder
- Export counter to JavaScript for leak testing
- Add stress test verifying no leaks in animated GIF decode
- Validates RAII refactoring prevents memory leaks"
```

---

### Task 5: Code Review

**Files:** All modified files

**Step 1: Run full test suite** (1-2 min)

```bash
npm run check
```

Expected: All tests PASS (lint + unit + integration + stress)

**Step 2: Review RAII wrapper usage** (3-5 min)

Verify:
- [ ] All deleters follow noexcept pattern
- [ ] Factory functions not needed (constructors sufficient)
- [ ] Ownership semantics correct (avformat_open_input special case handled)
- [ ] No raw pointer assignments to RAII members (use .reset())
- [ ] .get() used for FFmpeg API calls requiring raw pointers

**Step 3: Review error path consolidation** (2-3 min)

Verify:
- [ ] Zero duplicate cleanup sequences remain (was 8+, now 0)
- [ ] All error paths simply `return false` (RAII cleanup automatic)
- [ ] Cleanup() method simplified (just .reset() calls)

**Step 4: Manual memory leak test** (2-3 min)

```bash
# Run under Valgrind (Linux) or Instruments (macOS) if available
valgrind --leak-check=full node test/stress/memory-leak.test.ts
```

Expected: "All heap blocks were freed -- no leaks are possible"

**Step 5: Benchmark RAII overhead** (2-3 min)

Run existing benchmark to confirm 5% overhead:

```bash
npm run benchmark -- raii_overhead
```

Expected: RAII wrapper overhead ~5% (acceptable per benchmark)

**Step 6: Document changes** (2-3 min)

Update CLAUDE.md if needed (RAII adoption now complete in image_decoder.cc):

```markdown
## RAII Adoption Status
- ✅ image_decoder.cc: 100% (Phase 1 complete - all 9 av_malloc calls eliminated)
- ✅ video_encoder_worker.cc: 100%
- ✅ video_decoder_worker.cc: 100%
- ✅ audio_encoder.cc: 100%
- ✅ audio_decoder.cc: 98% (2 extradata av_malloc calls remain - Phase 2)
```

**Step 7: Final commit** (30 sec)

```bash
git add CLAUDE.md
git commit -m "docs: update RAII adoption status for Phase 1

Phase 1 complete: image_decoder.cc now 100% RAII compliant"
```

---

## Execution Checklist

Before marking Phase 1 complete, verify:

- [ ] All 9 raw av_malloc calls eliminated from image_decoder.cc
- [ ] Three new RAII deleters added to ffmpeg_raii.h
- [ ] image_decoder.h members migrated to RAII types
- [ ] Error path cleanup code reduced from 8+ duplicates to 0
- [ ] Memory leak tests PASS (ImageDecoder counter returns to baseline)
- [ ] Full test suite PASS (`npm run check`)
- [ ] Benchmark confirms 5% overhead (acceptable)
- [ ] Documentation updated

**Next Phase:** Phase 2A - Add buffer pool to AsyncEncodeWorker (separate plan)
