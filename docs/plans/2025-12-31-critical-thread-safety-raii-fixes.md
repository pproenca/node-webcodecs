# Critical Thread Safety & RAII Fixes Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-critical-thread-safety-raii-fixes.md` to implement task-by-task.

**Goal:** Fix 4 CRITICAL and 2 HIGH severity security issues in async worker components: raw pointer ownership, unprotected codec context access, TSFN release race, and unsynchronized metadata access.

**Architecture:** Replace raw `AVFrame*`/`AVPacket*` pointers with existing RAII wrappers (`ffmpeg::AVFramePtr`, `ffmpeg::AVPacketPtr`) from `ffmpeg_raii.h`. Add `std::mutex codec_mutex_` to protect all shared state in async workers. Implement TSFN callback drain before Release() to prevent use-after-free.

**Tech Stack:** C++17, N-API, FFmpeg libav*, std::mutex, std::atomic, std::chrono

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Independent async workers, no file overlap |
| Group 2 | 3 | Depends on Group 1 (mutex added in Tasks 1-2) |
| Group 3 | 4 | Independent file (video_encoder.cc) |
| Group 4 | 5 | Independent file (video_decoder.cc) |
| Group 5 | 6 | Final verification, depends on all previous |

---

### Task 1: RAII Wrappers & Mutex in AsyncEncodeWorker

**Files:**
- Modify: `src/async_encode_worker.h`
- Modify: `src/async_encode_worker.cc`
- Test: `npm run test-fast` (existing tests validate behavior)

**Step 1: Add RAII include and mutex to header** (2-5 min)

Open `src/async_encode_worker.h` and make these changes:

```cpp
// After line 13 (#include <libswscale/swscale.h>), add:
#include "src/ffmpeg_raii.h"
```

```cpp
// Replace lines 103-106 (raw pointers):
// FROM:
AVCodecContext* codec_context_;
SwsContext* sws_context_;
AVFrame* frame_;
AVPacket* packet_;

// TO:
AVCodecContext* codec_context_;  // Owned by VideoEncoder, just reference
SwsContext* sws_context_;        // Owned by VideoEncoder, just reference
ffmpeg::AVFramePtr frame_;       // RAII-managed, owned by this worker
ffmpeg::AVPacketPtr packet_;     // RAII-managed, owned by this worker
```

```cpp
// After line 96 (mutable std::mutex queue_mutex_;), add:
std::mutex codec_mutex_;  // Protects codec_context_, sws_context_, frame_, packet_, metadata_config_
```

**Step 2: Run linter to verify header syntax** (30 sec)

```bash
npm run lint-cpp -- src/async_encode_worker.h
```

Expected: No errors (warnings OK)

**Step 3: Update SetCodecContext() with RAII and mutex** (2-5 min)

Open `src/async_encode_worker.cc` and replace lines 46-60:

```cpp
// FROM:
void AsyncEncodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  codec_context_ = ctx;
  sws_context_ = sws;
  width_ = width;
  height_ = height;
  frame_ = av_frame_alloc();
  if (frame_) {
    frame_->format = AV_PIX_FMT_YUV420P;
    frame_->width = width;
    frame_->height = height;
    av_frame_get_buffer(frame_, 32);
  }
  packet_ = av_packet_alloc();
}

// TO:
void AsyncEncodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  sws_context_ = sws;
  width_ = width;
  height_ = height;
  frame_ = ffmpeg::make_frame();
  if (frame_) {
    frame_->format = AV_PIX_FMT_YUV420P;
    frame_->width = width;
    frame_->height = height;
    int ret = av_frame_get_buffer(frame_.get(), 32);
    if (ret < 0) {
      frame_.reset();  // Clear on allocation failure
    }
  }
  packet_ = ffmpeg::make_packet();
}
```

**Step 4: Update SetMetadataConfig() with mutex** (1-2 min)

Replace lines 62-64:

```cpp
// FROM:
void AsyncEncodeWorker::SetMetadataConfig(const EncoderMetadataConfig& config) {
  metadata_config_ = config;
}

// TO:
void AsyncEncodeWorker::SetMetadataConfig(const EncoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}
```

**Step 5: Remove manual cleanup from destructor** (1-2 min)

Replace lines 66-74:

```cpp
// FROM:
AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
}

// TO:
AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  // frame_ and packet_ are RAII-managed, automatically cleaned up
}
```

**Step 6: Protect ProcessFrame() with mutex** (2-5 min)

Replace line 159-162 (beginning of ProcessFrame):

```cpp
// FROM:
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }

// TO:
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }
```

**Step 7: Update frame_/packet_ access to use .get()** (2-5 min)

In `ProcessFrame()`, update all raw pointer usages:

```cpp
// Line 168: Replace packet_ with packet_.get()
while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
  EmitChunk(packet_.get());
  av_packet_unref(packet_.get());
}

// Line 181-182: Replace frame_->data with frame_.get()->data
sws_scale(sws_context_, src_data, src_linesize, 0, height_, frame_->data,
          frame_->linesize);

// Line 186: frame_->pts is OK (operator-> works on unique_ptr)

// Line 192-194: frame_->quality is OK

// Line 197: Replace frame_ with frame_.get()
int ret = avcodec_send_frame(codec_context_, frame_.get());

// Line 209-211: Replace packet_ with packet_.get()
while (avcodec_receive_packet(codec_context_, packet_.get()) == 0) {
  EmitChunk(packet_.get());
  av_packet_unref(packet_.get());
}
```

**Step 8: Protect metadata copy in EmitChunk()** (2-5 min)

In `EmitChunk()`, after line 242, add mutex protection for metadata copy:

```cpp
// After line 242 (frame_info_.erase(it);), add mutex-protected copy:

  // Copy metadata under lock to prevent torn reads
  EncoderMetadataConfig metadata_copy;
  std::vector<uint8_t> extradata_copy;
  {
    std::lock_guard<std::mutex> lock(codec_mutex_);
    metadata_copy = metadata_config_;
    if (codec_context_ && codec_context_->extradata &&
        codec_context_->extradata_size > 0) {
      extradata_copy.assign(
          codec_context_->extradata,
          codec_context_->extradata + codec_context_->extradata_size);
    }
  }

// Then update lines 251-258 to use the copies:
// FROM:
  cb_data->metadata = metadata_config_;
  // Copy extradata from codec_context at emit time (may be set after configure)
  if (codec_context_ && codec_context_->extradata &&
      codec_context_->extradata_size > 0) {
    cb_data->extradata.assign(
        codec_context_->extradata,
        codec_context_->extradata + codec_context_->extradata_size);
  }

// TO:
  cb_data->metadata = metadata_copy;
  cb_data->extradata = std::move(extradata_copy);
```

**Step 9: Build native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors

**Step 10: Run fast tests** (30 sec)

```bash
npm run test-fast
```

Expected: All tests pass

**Step 11: Commit changes** (30 sec)

```bash
git add src/async_encode_worker.h src/async_encode_worker.cc
git commit -m "$(cat <<'EOF'
fix(async-encode): use RAII wrappers and mutex for thread safety

- Replace raw AVFrame*/AVPacket* with ffmpeg::AVFramePtr/AVPacketPtr
- Add codec_mutex_ to protect shared state across threads
- Check av_frame_get_buffer return value (CRITICAL-1, HIGH-1)
- Protect SetCodecContext/SetMetadataConfig/ProcessFrame (CRITICAL-2, CRITICAL-4)
- Protect metadata copy in EmitChunk (HIGH-2)

Addresses: CRITICAL-1, CRITICAL-2, CRITICAL-4, HIGH-1, HIGH-2 (encoder)
EOF
)"
```

---

### Task 2: RAII Wrappers & Mutex in AsyncDecodeWorker

**Files:**
- Modify: `src/async_decode_worker.h`
- Modify: `src/async_decode_worker.cc`
- Test: `npm run test-fast`

**Step 1: Add RAII include and mutex to header** (2-5 min)

Open `src/async_decode_worker.h` and make these changes:

```cpp
// After line 13 (#include <libswscale/swscale.h>), add:
#include "src/ffmpeg_raii.h"
```

```cpp
// Replace lines 94-97 (raw pointers):
// FROM:
AVCodecContext* codec_context_;
SwsContext* sws_context_;  // Created lazily on first frame
AVFrame* frame_;
AVPacket* packet_;

// TO:
AVCodecContext* codec_context_;  // Owned by VideoDecoder, just reference
SwsContext* sws_context_;        // Created lazily, owned by this worker (not RAII - special lifecycle)
ffmpeg::AVFramePtr frame_;       // RAII-managed, owned by this worker
ffmpeg::AVPacketPtr packet_;     // RAII-managed, owned by this worker
```

```cpp
// After line 88 (std::condition_variable queue_cv_;), add:
std::mutex codec_mutex_;  // Protects codec_context_, sws_context_, frame_, packet_, metadata_config_
```

**Step 2: Run linter to verify header syntax** (30 sec)

```bash
npm run lint-cpp -- src/async_decode_worker.h
```

Expected: No errors

**Step 3: Update SetCodecContext() with RAII and mutex** (2-5 min)

Open `src/async_decode_worker.cc` and replace lines 57-67:

```cpp
// FROM:
void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx,
                                        SwsContext* /* sws_unused */,
                                        int width, int height) {
  codec_context_ = ctx;
  // sws_context_ is created lazily in EmitFrame when we know the frame format
  sws_context_ = nullptr;
  output_width_ = width;
  output_height_ = height;
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
}

// TO:
void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx,
                                        SwsContext* /* sws_unused */,
                                        int width, int height) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  codec_context_ = ctx;
  // sws_context_ is created lazily in EmitFrame when we know the frame format
  sws_context_ = nullptr;
  output_width_ = width;
  output_height_ = height;
  frame_ = ffmpeg::make_frame();
  packet_ = ffmpeg::make_packet();
}
```

**Step 4: Update SetMetadataConfig() with mutex** (1-2 min)

Replace lines 69-71:

```cpp
// FROM:
void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  metadata_config_ = config;
}

// TO:
void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  metadata_config_ = config;
}
```

**Step 5: Update destructor to remove manual frame/packet cleanup** (2-5 min)

Replace lines 35-55:

```cpp
// FROM:
AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
  // sws_context_ is created lazily by this worker, so we own it
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  // Note: codec_context_ is owned by VideoDecoder

  // Clean up buffer pool
  for (auto* buffer : buffer_pool_) {
    delete buffer;
  }
  buffer_pool_.clear();
}

// TO:
AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  // frame_ and packet_ are RAII-managed, automatically cleaned up

  // sws_context_ is created lazily by this worker, so we own it
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  // Note: codec_context_ is owned by VideoDecoder

  // Clean up buffer pool
  for (auto* buffer : buffer_pool_) {
    delete buffer;
  }
  buffer_pool_.clear();
}
```

**Step 6: Protect ProcessPacket() with mutex** (2-5 min)

Replace lines 168-171 (beginning of ProcessPacket):

```cpp
// FROM:
void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }

// TO:
void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  std::lock_guard<std::mutex> lock(codec_mutex_);
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }
```

**Step 7: Update packet_/frame_ access to use .get()** (2-5 min)

In `ProcessPacket()`, update raw pointer usages:

```cpp
// Line 174: Replace packet_ with packet_.get()
av_packet_unref(packet_.get());

// Line 175-176: Replace packet_-> with packet_.get()->
packet_->data = const_cast<uint8_t*>(task.data.data());
packet_->size = static_cast<int>(task.data.size());
packet_->pts = task.timestamp;

// Actually, operator-> works on unique_ptr, so packet_-> is fine
// Just update the av_packet_unref and avcodec calls:

// Line 174:
av_packet_unref(packet_.get());

// Line 179:
int ret = avcodec_send_packet(codec_context_, packet_.get());

// Line 192-194:
while (avcodec_receive_frame(codec_context_, frame_.get()) == 0) {
  EmitFrame(frame_.get());
  av_frame_unref(frame_.get());
}
```

**Step 8: Add mutex protection for metadata in EmitFrame()** (2-5 min)

At the beginning of EmitFrame() (line 198), the function receives `AVFrame*` as parameter (already raw pointer from the `.get()` call). Add mutex-protected metadata copy:

```cpp
// After line 231 (output_height_ = frame->height;), add:

  // Copy metadata under lock to prevent torn reads
  DecoderMetadataConfig metadata_copy;
  {
    std::lock_guard<std::mutex> lock(codec_mutex_);
    metadata_copy = metadata_config_;
  }

// Then update lines 248-268 to use metadata_copy instead of metadata_config_:
// Replace all occurrences of metadata_config_. with metadata_copy.
```

**Step 9: Build native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 10: Run fast tests** (30 sec)

```bash
npm run test-fast
```

Expected: All tests pass

**Step 11: Commit changes** (30 sec)

```bash
git add src/async_decode_worker.h src/async_decode_worker.cc
git commit -m "$(cat <<'EOF'
fix(async-decode): use RAII wrappers and mutex for thread safety

- Replace raw AVFrame*/AVPacket* with ffmpeg::AVFramePtr/AVPacketPtr
- Add codec_mutex_ to protect shared state across threads
- Protect SetCodecContext/SetMetadataConfig/ProcessPacket (CRITICAL-2, CRITICAL-4)
- Protect metadata copy in EmitFrame (HIGH-2)

Addresses: CRITICAL-1, CRITICAL-2, CRITICAL-4, HIGH-2 (decoder)
EOF
)"
```

---

### Task 3: Add chrono include to async workers

**Files:**
- Modify: `src/async_encode_worker.cc`
- Modify: `src/async_decode_worker.cc`

**Step 1: Add chrono include to async_encode_worker.cc** (1 min)

Open `src/async_encode_worker.cc`, after line 10 (`#include <vector>`), add:

```cpp
#include <chrono>
```

**Step 2: Add chrono include to async_decode_worker.cc** (1 min)

Open `src/async_decode_worker.cc`, after line 10 (`#include <vector>`), add:

```cpp
#include <chrono>
```

**Step 3: Build to verify** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 4: Commit changes** (30 sec)

```bash
git add src/async_encode_worker.cc src/async_decode_worker.cc
git commit -m "chore: add chrono include for TSFN drain timing"
```

---

### Task 4: TSFN Drain in VideoEncoder::Cleanup()

**Files:**
- Modify: `src/video_encoder.cc`
- Test: `npm run test-fast`

**Step 1: Add chrono include** (1 min)

Open `src/video_encoder.cc`, find the includes section and add:

```cpp
#include <chrono>
#include <thread>
```

**Step 2: Update Cleanup() with TSFN drain** (2-5 min)

Replace lines 117-134:

```cpp
// FROM:
void VideoEncoder::Cleanup() {
  if (async_worker_) {
    async_worker_->Stop();
    async_worker_.reset();
  }

  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

// TO:
void VideoEncoder::Cleanup() {
  if (async_worker_) {
    async_worker_->Stop();

    // Wait for all pending TSFN callbacks to complete before releasing
    // This prevents use-after-free when callbacks reference codec_context_
    auto start = std::chrono::steady_clock::now();
    constexpr auto kDrainTimeout = std::chrono::seconds(5);
    while (async_worker_->GetPendingChunks() > 0) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
      if (std::chrono::steady_clock::now() - start > kDrainTimeout) {
        break;  // Timeout to avoid infinite wait
      }
    }

    async_worker_.reset();
  }

  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}
```

**Step 3: Find and fix av_frame_get_buffer unchecked return** (2-5 min)

Search for `av_frame_get_buffer` in video_encoder.cc (around line 352):

```cpp
// FROM (somewhere around line 350-355):
av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);

// TO:
int ret = av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);
if (ret < 0) {
  Cleanup();
  throw Napi::Error::New(env, "Failed to allocate frame buffer");
}
```

**Step 4: Build native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 5: Run fast tests** (30 sec)

```bash
npm run test-fast
```

Expected: All tests pass

**Step 6: Commit changes** (30 sec)

```bash
git add src/video_encoder.cc
git commit -m "$(cat <<'EOF'
fix(video-encoder): drain TSFN callbacks before release

- Wait for pending chunks before releasing ThreadSafeFunction
- Add 5-second timeout to prevent infinite wait
- Check av_frame_get_buffer return value

Addresses: CRITICAL-3, HIGH-1
EOF
)"
```

---

### Task 5: TSFN Drain in VideoDecoder::Cleanup()

**Files:**
- Modify: `src/video_decoder.cc`
- Test: `npm run test-fast`

**Step 1: Add chrono include** (1 min)

Open `src/video_decoder.cc`, find the includes section and add:

```cpp
#include <chrono>
#include <thread>
```

**Step 2: Update Cleanup() with TSFN drain** (2-5 min)

Replace lines 87-106:

```cpp
// FROM:
void VideoDecoder::Cleanup() {
  // Stop async worker before cleaning up codec context
  if (async_worker_) {
    async_worker_->Stop();
    async_worker_.reset();
  }

  // Release ThreadSafeFunctions
  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

// TO:
void VideoDecoder::Cleanup() {
  // Stop async worker before cleaning up codec context
  if (async_worker_) {
    async_worker_->Stop();

    // Wait for all pending TSFN callbacks to complete before releasing
    // This prevents use-after-free when callbacks reference codec_context_
    auto start = std::chrono::steady_clock::now();
    constexpr auto kDrainTimeout = std::chrono::seconds(5);
    while (async_worker_->GetPendingFrames() > 0) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
      if (std::chrono::steady_clock::now() - start > kDrainTimeout) {
        break;  // Timeout to avoid infinite wait
      }
    }

    async_worker_.reset();
  }

  // Release ThreadSafeFunctions
  if (async_mode_) {
    output_tsfn_.Release();
    error_tsfn_.Release();
    async_mode_ = false;
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}
```

**Step 3: Build native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds

**Step 4: Run fast tests** (30 sec)

```bash
npm run test-fast
```

Expected: All tests pass

**Step 5: Commit changes** (30 sec)

```bash
git add src/video_decoder.cc
git commit -m "$(cat <<'EOF'
fix(video-decoder): drain TSFN callbacks before release

- Wait for pending frames before releasing ThreadSafeFunction
- Add 5-second timeout to prevent infinite wait

Addresses: CRITICAL-3
EOF
)"
```

---

### Task 6: Final Verification & Code Review

**Files:**
- All modified files from Tasks 1-5
- Test: Full test suite

**Step 1: Run full build** (1-2 min)

```bash
npm run build
```

Expected: Build succeeds

**Step 2: Run linter** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 3: Run fast tests** (1-2 min)

```bash
npm run test-fast
```

Expected: All tests pass

**Step 4: Run stress tests** (2-5 min)

```bash
npm run test-stress
```

Expected: No crashes or memory growth

**Step 5: Run guardrails tests** (1-2 min)

```bash
npm run test-guardrails
```

Expected: All guardrails pass (memory sentinel, fuzzer, event loop lag)

**Step 6: Run leak detection if valgrind available** (2-5 min)

```bash
npm run test-leak || echo "Valgrind not available, skipping"
```

Expected: No definite leaks if valgrind is available

**Step 7: Review changes** (2-5 min)

```bash
git log --oneline -5
git diff HEAD~5..HEAD --stat
```

Verify:
- 5 commits with clear messages
- Files modified: async_encode_worker.h/cc, async_decode_worker.h/cc, video_encoder.cc, video_decoder.cc

**Step 8: Final commit summary** (30 sec)

No commit needed - this is verification only.

---

## Summary of Issues Addressed

| Issue ID | Severity | Description | Fixed In |
|----------|----------|-------------|----------|
| CRITICAL-1 | CRITICAL | Raw pointer ownership in async workers | Tasks 1, 2 |
| CRITICAL-2 | CRITICAL | Unprotected AVCodecContext across threads | Tasks 1, 2 |
| CRITICAL-3 | CRITICAL | TSFN Release before callbacks complete | Tasks 4, 5 |
| CRITICAL-4 | CRITICAL | SetCodecContext unsynchronized writes | Tasks 1, 2 |
| HIGH-1 | HIGH | av_frame_get_buffer return unchecked | Tasks 1, 4 |
| HIGH-2 | HIGH | metadata_config_ concurrent access | Tasks 1, 2 |

## Files Modified

| File | Changes |
|------|---------|
| `src/async_encode_worker.h` | RAII types, codec_mutex_ |
| `src/async_encode_worker.cc` | RAII usage, mutex protection, chrono |
| `src/async_decode_worker.h` | RAII types, codec_mutex_ |
| `src/async_decode_worker.cc` | RAII usage, mutex protection, chrono |
| `src/video_encoder.cc` | TSFN drain, av_frame_get_buffer check |
| `src/video_decoder.cc` | TSFN drain |
