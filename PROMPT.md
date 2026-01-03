# node-webcodecs C++ Refactoring Loop

## Mission

Apply all identified C++ code review fixes using TDD methodology. Each iteration should:

1. Pick the next uncompleted fix from the checklist
2. Write/update tests first
3. Implement the fix
4. Verify tests pass
5. Commit with conventional commit message
6. Update progress in this file

## Completion Criteria

When ALL fixes are complete and verified, output:
<promise>ALL_FIXES_COMPLETE</promise>

---

## Progress Tracker

Update this section each iteration. Mark [x] when complete.

### Phase 1: CRITICAL Memory Safety (Priority 1)

- [ ] **FIX-01**: RAII wrapper for MemoryBufferContext
- [ ] **FIX-02**: AVIOContext buffer ownership clarification
- [ ] **FIX-03**: Extradata allocation error handling

### Phase 2: CRITICAL Silent Failures (Priority 1)

- [ ] **FIX-04**: Check `avcodec_send_frame` in flush paths
- [ ] **FIX-05**: Check `avcodec_send_packet` in flush paths
- [ ] **FIX-06**: Check all `sws_scale` return values (8 locations)
- [ ] **FIX-07**: Handle silent worker early returns

### Phase 3: IMPORTANT Error Handling (Priority 2)

- [ ] **FIX-08**: Check `av_frame_get_buffer` returns
- [ ] **FIX-09**: Check critical `av_opt_set` returns
- [ ] **FIX-10**: Surface `ReinitializeCodec` failures
- [ ] **FIX-11**: Check `swr_convert` flush returns
- [ ] **FIX-12**: Log ImageDecoder fallback

### Phase 4: IMPORTANT Refactoring (Priority 2)

- [ ] **FIX-13**: Convert buffer pool to unique_ptr
- [ ] **FIX-14**: Remove/guard debug fprintf statements
- [ ] **FIX-15**: Deduplicate ComputeTemporalLayerId

### Phase 5: Final Verification

- [ ] **VERIFY-01**: Run full test suite
- [ ] **VERIFY-02**: Run memory leak tests
- [ ] **VERIFY-03**: Verify no regressions

---

## Fix Specifications

### FIX-01: RAII Wrapper for MemoryBufferContext

**Location:** `src/image_decoder.cc:324`, `src/image_decoder.h`

**Problem:** `MemoryBufferContext` uses raw `new`/`delete` across 13+ error paths.

**TDD Steps:**

1. **Test First** - Create test that verifies cleanup on error:

```typescript
// test/unit/image-decoder-memory.test.ts
test("ImageDecoder cleans up MemoryBufferContext on parse error", async () => {
  const corruptedGif = Buffer.alloc(100); // Invalid data
  const decoder = new ImageDecoder({ data: corruptedGif, type: "image/gif" });
  // Should not leak - check via process.memoryUsage() delta or counter
});
```

2. **Implementation** - Add RAII wrapper to `ffmpeg_raii.h`:

```cpp
// In ffmpeg_raii.h
struct MemoryBufferContext {
  const uint8_t* data;
  size_t size;
  size_t position;
};

struct MemoryBufferContextDeleter {
  void operator()(MemoryBufferContext* ctx) const noexcept {
    delete ctx;
  }
};

using MemoryBufferContextPtr = std::unique_ptr<MemoryBufferContext, MemoryBufferContextDeleter>;

inline MemoryBufferContextPtr make_memory_buffer_context() {
  return MemoryBufferContextPtr(new MemoryBufferContext());
}
```

3. **Refactor** `image_decoder.cc`:

```cpp
// Change from:
mem_ctx_ = new MemoryBufferContext();
// To:
mem_ctx_ = ffmpeg::make_memory_buffer_context();
```

4. **Verify:** `npm run test:unit -- image-decoder`

5. **Commit:** `fix(image-decoder): wrap MemoryBufferContext in RAII`

---

### FIX-02: AVIOContext Buffer Ownership

**Location:** `src/image_decoder.cc:330-345, 252-256`

**Problem:** AVIO buffer ownership is unclear - allocated with `av_malloc`, manually freed.

**TDD Steps:**

1. **Test First** - Verify no double-free or leak:

```typescript
// Stress test with many decodes
test("ImageDecoder handles repeated decode cycles", async () => {
  for (let i = 0; i < 100; i++) {
    const decoder = new ImageDecoder({ data: validGif, type: "image/gif" });
    decoder.close();
  }
  // No crash = no double-free
});
```

2. **Implementation** - Document ownership and consolidate cleanup:

```cpp
// In Cleanup():
if (avio_context_) {
  // NOTE: avio_context_ owns the buffer passed to avio_alloc_context.
  // avio_context_free does NOT free the buffer, we must do it explicitly.
  if (avio_context_->buffer) {
    av_freep(&avio_context_->buffer);
  }
  avio_context_free(&avio_context_);
}
```

3. **Verify:** `npm run test:unit && ./test/leak/leaks-macos.sh`

4. **Commit:** `fix(image-decoder): clarify AVIO buffer ownership`

---

### FIX-03: Extradata Allocation Error Handling

**Location:** `src/video_decoder.cc:218-228`, `src/audio_decoder.cc:194-215`

**Problem:** Silent failure when `av_malloc` returns null for extradata.

**TDD Steps:**

1. **Test First**:

```typescript
test("VideoDecoder throws on configuration with invalid description", async () => {
  const decoder = new VideoDecoder({ output: () => {}, error: (e) => {} });
  // Configure with extremely large description to trigger allocation failure
  await expect(async () => {
    decoder.configure({ codec: "avc1.42001e", description: hugeBuffer });
  }).rejects.toThrow();
});
```

2. **Implementation**:

```cpp
codec_context_->extradata = static_cast<uint8_t*>(
    av_malloc(desc_size + AV_INPUT_BUFFER_PADDING_SIZE));
if (!codec_context_->extradata) {
  throw Napi::Error::New(env, "Failed to allocate codec extradata");
}
```

3. **Verify:** `npm run test:unit -- video-decoder`

4. **Commit:** `fix(video-decoder): throw on extradata allocation failure`

---

### FIX-04: Check avcodec_send_frame in Flush Paths

**Locations:**

- `src/async_encode_worker.cc:210`
- `src/video_encoder.cc:918`
- `src/video_encoder.cc:943-946`
- `src/audio_encoder.cc:520`

**Problem:** Flush calls ignore return value, causing silent truncation.

**TDD Steps:**

1. **Test First**:

```typescript
test("VideoEncoder flush reports errors via error callback", async () => {
  const errors: Error[] = [];
  const encoder = new VideoEncoder({
    output: () => {},
    error: (e) => errors.push(e),
  });
  // Configure then immediately close to create invalid state
  encoder.configure({ codec: "avc1.42001e", width: 640, height: 480 });
  encoder.close();
  // Flush after close should error, not silently fail
  // (Note: actual test depends on spec behavior)
});
```

2. **Implementation** - `async_encode_worker.cc:210`:

```cpp
if (task.is_flush) {
  int ret = avcodec_send_frame(codec_context_, nullptr);
  if (ret < 0 && ret != AVERROR_EOF) {
    char errbuf[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, errbuf, sizeof(errbuf));
    std::string error_msg = std::string("Flush error: ") + errbuf;
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          if (env == nullptr) { delete msg; return; }
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }
  // ... drain loop
}
```

3. **Apply same pattern to other locations**

4. **Verify:** `npm run test:unit -- video-encoder`

5. **Commit:** `fix(encoder): check avcodec_send_frame return in flush`

---

### FIX-05: Check avcodec_send_packet in Flush Paths

**Location:** `src/async_decode_worker.cc:213`

**Same pattern as FIX-04 but for decoder.**

**Commit:** `fix(decoder): check avcodec_send_packet return in flush`

---

### FIX-06: Check All sws_scale Return Values

**Locations (8 total):**

- `src/async_encode_worker.cc:225`
- `src/async_decode_worker.cc:304`
- `src/video_encoder.cc:766`
- `src/video_decoder.cc:774`
- `src/video_frame.cc:357, 680, 1004`
- `src/video_filter.cc:345, 368`

**Problem:** `sws_scale` returns negative on failure but is never checked.

**TDD Steps:**

1. **Test First**:

```typescript
test('VideoFrame conversion reports errors for incompatible formats', async () => {
  // Create frame with unusual format
  const frame = new VideoFrame(data, { format: 'I420', ... });
  // Try invalid conversion
  await expect(async () => {
    frame.copyTo(buffer, { format: 'INVALID' });
  }).rejects.toThrow(/conversion failed/i);
});
```

2. **Implementation Pattern** (apply to all 8 locations):

```cpp
int ret = sws_scale(sws_context_, src_data, src_linesize, 0, height_,
                    frame_->data, frame_->linesize);
if (ret < 0) {
  // For async workers:
  error_tsfn_.NonBlockingCall(
      new std::string("Pixel format conversion failed"),
      [](Napi::Env env, Napi::Function fn, std::string* msg) {
        if (env == nullptr) { delete msg; return; }
        fn.Call({Napi::Error::New(env, *msg).Value()});
        delete msg;
      });
  return;

  // For sync methods:
  throw Napi::Error::New(env, "Pixel format conversion failed");
}
```

3. **Verify:** `npm test`

4. **Commit:** `fix(video): check sws_scale return values`

---

### FIX-07: Handle Silent Worker Early Returns

**Locations:**

- `src/async_encode_worker.cc:196-203`
- `src/async_decode_worker.cc:197-209`

**Problem:** When `codec_valid_` is false or contexts are null, task is silently dropped without decrementing counters.

**Implementation:**

```cpp
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  if (!codec_valid_.load(std::memory_order_acquire)) {
    // Task intentionally dropped during shutdown - fix counter leak
    webcodecs::counterQueue--;
    return;
  }

  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    webcodecs::counterQueue--;
    return;
  }
  // ...
}
```

**Commit:** `fix(worker): decrement counter on dropped tasks`

---

### FIX-08: Check av_frame_get_buffer Returns

**Locations:**

- `src/video_encoder.cc:886`
- `src/video_filter.cc:111`

**Implementation:**

```cpp
int ret = av_frame_get_buffer(frame_.get(), 32);
if (ret < 0) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(ret, errbuf, sizeof(errbuf));
  throw Napi::Error::New(env, std::string("Frame buffer allocation failed: ") + errbuf);
}
```

**Commit:** `fix(video): check av_frame_get_buffer returns`

---

### FIX-09: Check Critical av_opt_set Returns

**Location:** `src/video_encoder.cc:442-470`

**Implementation:**

```cpp
// Log warnings for failed options (non-fatal)
int ret = av_opt_set(codec_context_->priv_data, "preset", preset.c_str(), 0);
if (ret < 0 && ret != AVERROR_OPTION_NOT_FOUND) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(ret, errbuf, sizeof(errbuf));
  fprintf(stderr, "[WARN] Failed to set encoder preset '%s': %s\n",
          preset.c_str(), errbuf);
}
```

**Commit:** `fix(encoder): log av_opt_set failures`

---

### FIX-10: Surface ReinitializeCodec Failures

**Location:** `src/video_encoder.cc:811-892`

**Implementation:**

```cpp
// Add member variable
std::string reinit_error_;

// In ReinitializeCodec:
int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
if (ret < 0) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(ret, errbuf, sizeof(errbuf));
  reinit_error_ = std::string("Codec reinit failed: ") + errbuf;
  codec_context_.reset();
  return;
}

// In Encode, check reinit_error_ and throw if set
```

**Commit:** `fix(encoder): surface ReinitializeCodec errors`

---

### FIX-11: Check swr_convert Flush Returns

**Location:** `src/audio_encoder.cc:503`

**Implementation:**

```cpp
int out_samples = swr_convert(swr_context_.get(), frame_->data,
                              frame_size, nullptr, 0);
if (out_samples < 0) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(out_samples, errbuf, sizeof(errbuf));
  throw Napi::Error::New(env, std::string("Audio resampler flush failed: ") + errbuf);
}
```

**Commit:** `fix(audio-encoder): check swr_convert flush return`

---

### FIX-12: Log ImageDecoder Fallback

**Location:** `src/image_decoder.cc:217-230`

**Implementation:**

```cpp
if (IsAnimatedFormat(type_)) {
  if (ParseAnimatedImageMetadata()) {
    complete_ = true;
  } else {
    fprintf(stderr, "[WARN] ImageDecoder: Animated parsing failed for %s, "
                    "falling back to static image\n", type_.c_str());
    if (DecodeImage()) {
      complete_ = true;
    }
  }
}
```

**Commit:** `fix(image-decoder): log animated parsing fallback`

---

### FIX-13: Convert Buffer Pool to unique_ptr

**Location:** `src/async_decode_worker.cc:139-159, 383`

**Implementation:**

```cpp
// Change buffer_pool_ type
std::vector<std::unique_ptr<std::vector<uint8_t>>> buffer_pool_;

// AcquireBuffer returns raw pointer (still owned by pool)
std::vector<uint8_t>* AsyncDecodeWorker::AcquireBuffer(size_t size) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  for (auto& buf : buffer_pool_) {
    if (buf && buf->capacity() >= size) {
      buf->resize(size);
      return buf.get();  // Return raw pointer, pool retains ownership
    }
  }
  if (buffer_pool_.size() < kMaxPoolSize) {
    buffer_pool_.push_back(std::make_unique<std::vector<uint8_t>>(size));
    return buffer_pool_.back().get();
  }
  return nullptr;  // Pool full
}

// ReleaseBuffer no longer deletes - buffer stays in pool
void AsyncDecodeWorker::ReleaseBuffer(std::vector<uint8_t>* /* buffer */) {
  // No-op - buffer managed by pool's unique_ptr
}
```

**Commit:** `refactor(decoder): convert buffer pool to unique_ptr`

---

### FIX-14: Remove/Guard Debug fprintf Statements

**Locations:**

- `src/video_encoder.cc:118-222` (~20 statements)
- `src/audio_encoder.cc:69-109` (~10 statements)
- `src/async_encode_worker.cc:319-323`

**Implementation:**

```cpp
// Option A: Remove entirely (recommended)
// Just delete all fprintf(stderr, "[DEBUG]...") lines

// Option B: Conditional compilation
#ifdef WEBCODECS_DEBUG
  fprintf(stderr, "[DEBUG] VideoEncoder::~VideoEncoder() ENTER\n");
#endif
```

**Commit:** `chore(encoder): remove debug fprintf statements`

---

### FIX-15: Deduplicate ComputeTemporalLayerId

**Locations:**

- `src/video_encoder.cc:24-37`
- `src/async_encode_worker.cc:24-37`

**Implementation:**

```cpp
// Move to common.h
namespace webcodecs {

inline int ComputeTemporalLayerId(int frame_index, int num_temporal_layers) {
  if (num_temporal_layers <= 1) return 0;
  // ... implementation
}

}  // namespace webcodecs
```

Remove duplicate from both files, use `webcodecs::ComputeTemporalLayerId`.

**Commit:** `refactor(encoder): deduplicate ComputeTemporalLayerId`

---

## Iteration Protocol

Each iteration:

1. **Check Progress** - Read this file, find first unchecked `[ ]` item
2. **If all checked** - Run final verification, then output `<promise>ALL_FIXES_COMPLETE</promise>`
3. **Execute Fix**:
   - Write test (if applicable)
   - Implement fix
   - Run `npm run check`
   - If pass: `git add -A && git commit -m "<message>"`
   - Update this file: change `[ ]` to `[x]`
4. **Continue** - Let ralph-wiggum restart with updated state

## Constraints

- Use `dev-cpp` skill patterns (Google C++ Style Guide)
- Use `cpp-webcodecs-patterns` skill for FFmpeg patterns
- All commits use conventional commit format
- Never skip tests
- If tests fail, fix before committing

## Verification Commands

```bash
npm run check          # Full validation (must pass)
npm run test:unit      # Quick iteration
npm run lint           # Style check
./test/leak/leaks-macos.sh  # Memory check (macOS)
```

---

## Current State

**Last completed:** None
**Next fix:** FIX-01
**Iteration count:** 0
