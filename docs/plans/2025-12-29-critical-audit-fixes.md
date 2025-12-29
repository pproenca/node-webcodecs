# Critical Audit Fixes Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-29-critical-audit-fixes.md` to implement task-by-task.

**Goal:** Fix critical issues identified in the codebase audit: complete async worker implementations and add null checks to video_filter.cc.

**Architecture:** The async workers already have complete thread infrastructure (queue, mutex, condition variable, ThreadSafeFunction). We implement the missing `ProcessPacket()`/`ProcessFrame()` and `EmitFrame()`/`EmitChunk()` methods by transferring FFmpeg context ownership to the workers for thread safety. For video_filter, we add defensive null checks before FFmpeg filter operations.

**Tech Stack:** C++ (C++17), Node.js N-API, FFmpeg (libavcodec, libswscale, libavfilter)

---

## Task 1: Add Null Checks to VideoFilter::ProcessFrame

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_filter.cc:195-210`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/31_filter_null_checks.js`

**Step 1: Write the failing test** (3 min)

Create a test that calls applyBlur after close() to trigger the null pointer path:

```javascript
// test/31_filter_null_checks.js
const { VideoFrame, VideoFilter } = require('../dist');

console.log('[TEST] VideoFilter Null Check Safety');

// Test 1: Calling applyBlur after close should throw, not crash
console.log('[TEST] 1. applyBlur after close throws error...');
const filter = new VideoFilter();
filter.configure({ width: 320, height: 240 });

const buf = Buffer.alloc(320 * 240 * 4, 128);
const frame = new VideoFrame(buf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });

filter.close();

let threw = false;
try {
    filter.applyBlur(frame, []);
} catch (e) {
    threw = true;
    console.log(`  Caught expected error: ${e.message}`);
}

if (!threw) {
    throw new Error('Expected applyBlur after close to throw');
}

frame.close();
console.log('[PASS] Null check prevents crash');
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/31_filter_null_checks.js
```

Expected: FAIL with segfault or undefined behavior (ProcessFrame called with null contexts)

**Step 3: Add null checks to ProcessFrame** (3 min)

Modify `src/video_filter.cc` at line 195, adding null checks:

```cpp
AVFrame* VideoFilter::ProcessFrame(AVFrame* input) {
  // Safety check: filter contexts must be valid
  if (!buffersrc_ctx_ || !buffersink_ctx_) {
    return nullptr;
  }

  // This processes a YUV frame through the filter graph
  // Returns filtered frame (caller does NOT own - internal buffer)
  int ret = av_buffersrc_add_frame_flags(buffersrc_ctx_, input,
                                         AV_BUFFERSRC_FLAG_KEEP_REF);
  if (ret < 0) {
    return nullptr;
  }

  ret = av_buffersink_get_frame(buffersink_ctx_, output_frame_);
  if (ret < 0) {
    return nullptr;
  }

  return output_frame_;
}
```

**Step 4: Add state check to ApplyBlur** (2 min)

The test will still fail because ApplyBlur checks `state_ != "configured"` but after close() the state is "closed", which triggers a different error. Verify the existing check at line 215 handles this:

```cpp
// Already present at line 215-219:
if (state_ != "configured") {
  Napi::Error::New(env, "VideoFilter not configured")
      .ThrowAsJavaScriptException();
  return env.Undefined();
}
```

This correctly blocks calls after close(). The null check in ProcessFrame is defense-in-depth.

**Step 5: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/31_filter_null_checks.js
```

Expected: PASS - error thrown cleanly, no crash

**Step 6: Run full test suite** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm test
```

Expected: All tests pass including test/29_video_filter.js

**Step 7: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add src/video_filter.cc test/31_filter_null_checks.js && git commit -m "fix(video-filter): add null checks to ProcessFrame for crash prevention"
```

---

## Task 2: Implement AsyncDecodeWorker::ProcessPacket

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/async_decode_worker.h`
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/async_decode_worker.cc:100-112`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/26_async_decoder.js` (existing)

**Step 1: Write the failing test** (2 min)

The existing test at `test/26_async_decoder.js` already tests async decode. First verify it works with sync mode. We need to modify VideoDecoder to actually use async mode. For now, verify the current test passes with sync:

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/26_async_decoder.js
```

Expected: PASS (using sync path currently)

**Step 2: Add FFmpeg members to AsyncDecodeWorker header** (3 min)

Modify `src/async_decode_worker.h` to add owned FFmpeg resources:

After line 60 (after `SwsContext* sws_context_;`), add:

```cpp
  AVFrame* frame_;
  AVPacket* packet_;
  int output_width_;
  int output_height_;
```

Add method declaration after line 51 (after `void Flush();`):

```cpp
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                       int width, int height);
```

**Step 3: Implement SetCodecContext** (2 min)

Add to `src/async_decode_worker.cc` after the constructor (line 20):

```cpp
void AsyncDecodeWorker::SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                                        int width, int height) {
  codec_context_ = ctx;
  sws_context_ = sws;
  output_width_ = width;
  output_height_ = height;
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
}
```

**Step 4: Implement ProcessPacket** (5 min)

Replace the stub at lines 100-107 in `src/async_decode_worker.cc`:

```cpp
void AsyncDecodeWorker::ProcessPacket(const DecodeTask& task) {
  if (!codec_context_ || !packet_ || !frame_) {
    return;
  }

  // Set up packet from task data
  av_packet_unref(packet_);
  packet_->data = const_cast<uint8_t*>(task.data.data());
  packet_->size = static_cast<int>(task.data.size());
  packet_->pts = task.timestamp;

  int ret = avcodec_send_packet(codec_context_, packet_);
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    // Post error to main thread
    std::string error_msg = "Decode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }

  while (avcodec_receive_frame(codec_context_, frame_) == 0) {
    EmitFrame(frame_);
    av_frame_unref(frame_);
  }
}
```

**Step 5: Implement EmitFrame** (5 min)

Replace the stub at lines 109-112:

```cpp
void AsyncDecodeWorker::EmitFrame(AVFrame* frame) {
  if (!sws_context_) {
    return;
  }

  // Convert YUV to RGBA
  size_t rgba_size = output_width_ * output_height_ * 4;
  auto* rgba_data = new std::vector<uint8_t>(rgba_size);

  uint8_t* dst_data[1] = {rgba_data->data()};
  int dst_linesize[1] = {output_width_ * 4};

  sws_scale(sws_context_, frame->data, frame->linesize, 0,
            frame->height, dst_data, dst_linesize);

  int64_t timestamp = frame->pts;
  int width = output_width_;
  int height = output_height_;

  output_tsfn_.NonBlockingCall(
      rgba_data,
      [width, height, timestamp](Napi::Env env, Napi::Function fn,
                                  std::vector<uint8_t>* data) {
        Napi::Object frame_obj = VideoFrame::CreateInstance(
            env, data->data(), data->size(),
            width, height, timestamp, "RGBA");
        fn.Call({frame_obj});
        delete data;
      });
}
```

**Step 6: Add cleanup to destructor** (2 min)

Modify the destructor in `src/async_decode_worker.cc` (around line 22):

```cpp
AsyncDecodeWorker::~AsyncDecodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
  // Note: codec_context_ and sws_context_ are owned by VideoDecoder
  // They are cleaned up there, not here
}
```

**Step 7: Add FFmpeg includes** (1 min)

Add to top of `src/async_decode_worker.cc` after line 8:

```cpp
extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}
```

**Step 8: Build and test** (2 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && node test/26_async_decoder.js
```

Expected: PASS (but still using sync path until VideoDecoder calls SetCodecContext)

**Step 9: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add src/async_decode_worker.cc src/async_decode_worker.h && git commit -m "feat(async-decoder): implement ProcessPacket and EmitFrame for worker thread"
```

---

## Task 3: Implement AsyncEncodeWorker::ProcessFrame

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/async_encode_worker.h`
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/async_encode_worker.cc`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/27_async_encoder.js` (existing)

**Step 1: Add FFmpeg members to AsyncEncodeWorker header** (3 min)

Modify `src/async_encode_worker.h`. After the sws_context_ member, add:

```cpp
  AVFrame* frame_;
  AVPacket* packet_;
  int width_;
  int height_;
```

Add method declaration:

```cpp
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                       int width, int height);
```

**Step 2: Implement SetCodecContext** (2 min)

Add to `src/async_encode_worker.cc` after the constructor:

```cpp
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
```

**Step 3: Implement ProcessFrame** (5 min)

Replace the stub ProcessFrame:

```cpp
void AsyncEncodeWorker::ProcessFrame(const EncodeTask& task) {
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    return;
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_data[1] = {task.data.data()};
  int src_linesize[1] = {width_ * 4};

  sws_scale(sws_context_, src_data, src_linesize, 0, height_,
            frame_->data, frame_->linesize);

  frame_->pts = task.timestamp;

  int ret = avcodec_send_frame(codec_context_, task.key_frame ? frame_ : frame_);
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    std::string error_msg = "Encode error: " + std::to_string(ret);
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
    return;
  }

  while (avcodec_receive_packet(codec_context_, packet_) == 0) {
    EmitChunk(packet_);
    av_packet_unref(packet_);
  }
}
```

**Step 4: Implement EmitChunk** (4 min)

Replace the stub EmitChunk:

```cpp
void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // Copy packet data for thread-safe transfer
  auto* chunk_data = new std::vector<uint8_t>(pkt->data, pkt->data + pkt->size);
  int64_t pts = pkt->pts;
  int64_t duration = pkt->duration;
  bool is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;

  output_tsfn_.NonBlockingCall(
      chunk_data,
      [pts, duration, is_key](Napi::Env env, Napi::Function fn,
                               std::vector<uint8_t>* data) {
        Napi::Object init = Napi::Object::New(env);
        init.Set("type", is_key ? "key" : "delta");
        init.Set("timestamp", static_cast<double>(pts));
        init.Set("duration", static_cast<double>(duration));
        init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data->data(), data->size()));

        // Create EncodedVideoChunk via its constructor
        Napi::Function constructor = env.Global()
            .Get("EncodedVideoChunk").As<Napi::Function>();
        Napi::Object chunk = constructor.New({init});

        fn.Call({chunk});
        delete data;
      });
}
```

**Step 5: Add cleanup to destructor** (2 min)

```cpp
AsyncEncodeWorker::~AsyncEncodeWorker() {
  Stop();
  if (frame_) {
    av_frame_free(&frame_);
  }
  if (packet_) {
    av_packet_free(&packet_);
  }
}
```

**Step 6: Add FFmpeg includes** (1 min)

Add to top of `src/async_encode_worker.cc`:

```cpp
extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}
```

**Step 7: Build and test** (2 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && node test/27_async_encoder.js
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add src/async_encode_worker.cc src/async_encode_worker.h && git commit -m "feat(async-encoder): implement ProcessFrame and EmitChunk for worker thread"
```

---

## Task 4: Wire AsyncDecodeWorker to VideoDecoder

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_decoder.cc`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/26_async_decoder.js`

**Step 1: Find Configure method and add worker initialization** (3 min)

In `src/video_decoder.cc`, locate the Configure method. After codec context is opened successfully, add worker initialization when async_mode_ is true:

```cpp
// After avcodec_open2 succeeds and before returning
if (async_mode_ && async_worker_) {
  async_worker_->SetCodecContext(codec_context_, sws_context_,
                                  configured_width_, configured_height_);
  async_worker_->Start();
}
```

**Step 2: Modify Decode to use async path** (3 min)

In the Decode method, when async_mode_ is true, enqueue to worker instead of direct decode:

```cpp
if (async_mode_ && async_worker_) {
  DecodeTask task;
  task.data.assign(chunk_data, chunk_data + data_length);
  task.timestamp = timestamp;
  task.type = chunk_type;
  async_worker_->Enqueue(std::move(task));
  return env.Undefined();
}
```

**Step 3: Run async decoder test** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && node test/26_async_decoder.js
```

Expected: PASS with async decoding

**Step 4: Run full test suite** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm test
```

Expected: All tests pass

**Step 5: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add src/video_decoder.cc && git commit -m "feat(video-decoder): wire async worker for non-blocking decode"
```

---

## Task 5: Wire AsyncEncodeWorker to VideoEncoder

**Files:**
- Modify: `/Users/pedroproenca/Documents/Projects/node-webcodecs/src/video_encoder.cc`
- Test: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/27_async_encoder.js`

**Step 1: Find Configure method and add worker initialization** (3 min)

In `src/video_encoder.cc`, after codec context is opened successfully:

```cpp
if (async_mode_ && async_worker_) {
  async_worker_->SetCodecContext(codec_context_, sws_context_,
                                  configured_width_, configured_height_);
  async_worker_->Start();
}
```

**Step 2: Modify Encode to use async path** (3 min)

In the Encode method, when async_mode_ is true:

```cpp
if (async_mode_ && async_worker_) {
  EncodeTask task;
  task.data.assign(rgba_data, rgba_data + data_size);
  task.timestamp = timestamp;
  task.key_frame = force_keyframe;
  async_worker_->Enqueue(std::move(task));
  return env.Undefined();
}
```

**Step 3: Run async encoder test** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native && node test/27_async_encoder.js
```

Expected: PASS with async encoding

**Step 4: Run full test suite** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm test
```

Expected: All tests pass

**Step 5: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add src/video_encoder.cc && git commit -m "feat(video-encoder): wire async worker for non-blocking encode"
```

---

## Task 6: Code Review

**Files:**
- All modified files from Tasks 1-5

**Step 1: Review changes** (5 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git diff HEAD~5..HEAD --stat
```

Verify:
- No memory leaks (all av_frame_free, av_packet_free pairs)
- Thread safety (no shared mutable state without mutex)
- Error handling (all FFmpeg calls checked)

**Step 2: Run guardrails** (2 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run test:guardrails
```

Expected: Memory sentinel, event loop lag, fuzzer all pass

**Step 3: Run cpplint** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && cpplint --recursive src/
```

Expected: No errors

**Step 4: Create summary** (2 min)

Document what was fixed:
1. VideoFilter null check - prevents crash when filter contexts are null
2. AsyncDecodeWorker - complete ProcessPacket/EmitFrame implementation
3. AsyncEncodeWorker - complete ProcessFrame/EmitChunk implementation
4. VideoDecoder/VideoEncoder - wired to use async workers

---

## Task 7: Edge Case Tests

**Files:**
- Create: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/32_edge_cases.js`

**Step 1: Write edge case test file** (5 min)

```javascript
// test/32_edge_cases.js
const assert = require('assert');
const { VideoEncoder, VideoDecoder, VideoFrame, VideoFilter } = require('../dist');

console.log('[TEST] Edge Case Tests');

// Test 1: Double close should not crash
console.log('[TEST] 1. Double close encoder...');
{
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });
    encoder.configure({ codec: 'avc1.42001e', width: 320, height: 240, bitrate: 1000000, framerate: 30 });
    encoder.close();
    encoder.close(); // Should not crash
    console.log('[PASS] Double close encoder');
}

// Test 2: Double close decoder should not crash
console.log('[TEST] 2. Double close decoder...');
{
    const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => { throw e; }
    });
    decoder.configure({ codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240 });
    decoder.close();
    decoder.close(); // Should not crash
    console.log('[PASS] Double close decoder');
}

// Test 3: Encode after close should throw
console.log('[TEST] 3. Encode after close throws...');
{
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });
    encoder.configure({ codec: 'avc1.42001e', width: 320, height: 240, bitrate: 1000000, framerate: 30 });
    encoder.close();

    const buf = Buffer.alloc(320 * 240 * 4);
    const frame = new VideoFrame(buf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });

    let threw = false;
    try {
        encoder.encode(frame);
    } catch (e) {
        threw = true;
    }
    frame.close();
    assert(threw, 'Expected encode after close to throw');
    console.log('[PASS] Encode after close throws');
}

// Test 4: Decode after close should throw
console.log('[TEST] 4. Decode after close throws...');
{
    const decoder = new VideoDecoder({
        output: () => {},
        error: () => {}
    });
    decoder.configure({ codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240 });
    decoder.close();

    let threw = false;
    try {
        // Create minimal chunk
        const { EncodedVideoChunk } = require('../dist');
        const chunk = new EncodedVideoChunk({
            type: 'key',
            timestamp: 0,
            data: Buffer.alloc(100)
        });
        decoder.decode(chunk);
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected decode after close to throw');
    console.log('[PASS] Decode after close throws');
}

// Test 5: Rapid encode-close sequence
console.log('[TEST] 5. Rapid encode-close sequence...');
{
    for (let i = 0; i < 5; i++) {
        const encoder = new VideoEncoder({
            output: () => {},
            error: () => {}
        });
        encoder.configure({ codec: 'avc1.42001e', width: 160, height: 120, bitrate: 500000, framerate: 30 });

        const buf = Buffer.alloc(160 * 120 * 4, i * 50);
        const frame = new VideoFrame(buf, { codedWidth: 160, codedHeight: 120, timestamp: i * 33333 });
        encoder.encode(frame);
        frame.close();
        encoder.close();
    }
    console.log('[PASS] Rapid encode-close sequence');
}

// Test 6: VideoFrame double close
console.log('[TEST] 6. VideoFrame double close...');
{
    const buf = Buffer.alloc(320 * 240 * 4);
    const frame = new VideoFrame(buf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });
    frame.close();
    frame.close(); // Should not crash
    console.log('[PASS] VideoFrame double close');
}

// Test 7: Operations on closed VideoFrame should throw
console.log('[TEST] 7. Operations on closed VideoFrame throw...');
{
    const buf = Buffer.alloc(320 * 240 * 4);
    const frame = new VideoFrame(buf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });
    frame.close();

    let threw = false;
    try {
        frame.clone();
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected clone on closed frame to throw');
    console.log('[PASS] Operations on closed VideoFrame throw');
}

// Test 8: VideoFilter configure after close
console.log('[TEST] 8. VideoFilter configure after close throws...');
{
    const filter = new VideoFilter();
    filter.close();

    let threw = false;
    try {
        filter.configure({ width: 320, height: 240 });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected configure after close to throw');
    console.log('[PASS] VideoFilter configure after close throws');
}

console.log('[PASS] All edge case tests passed!');
```

**Step 2: Run test** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/32_edge_cases.js
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add test/32_edge_cases.js && git commit -m "test: add edge case tests for invalid states and rapid close sequences"
```

---

## Task 8: Error Path Tests

**Files:**
- Create: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/33_error_paths.js`

**Step 1: Write error path test file** (5 min)

```javascript
// test/33_error_paths.js
const assert = require('assert');
const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log('[TEST] Error Path Tests');

// Test 1: Encoder error callback on invalid config
console.log('[TEST] 1. Invalid encoder config triggers error...');
{
    let errorCalled = false;
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { errorCalled = true; }
    });

    let threw = false;
    try {
        encoder.configure({ codec: 'invalid-codec', width: 320, height: 240, bitrate: 1000000, framerate: 30 });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected invalid codec to throw');
    encoder.close();
    console.log('[PASS] Invalid encoder config triggers error');
}

// Test 2: Decoder with corrupted data calls error callback
console.log('[TEST] 2. Corrupted decode data triggers error callback...');
{
    let errorCalled = false;
    let errorMessage = '';

    const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => {
            errorCalled = true;
            errorMessage = e.message || String(e);
        }
    });

    decoder.configure({ codec: 'avc1.42001e', codedWidth: 320, codedHeight: 240 });

    // Send garbage data that's not valid H.264
    const garbage = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: Buffer.from('this is not valid h264 data at all')
    });

    decoder.decode(garbage);

    // Flush to process
    decoder.flush().catch(() => {});

    decoder.close();
    // Note: Error may be async, so we just verify no crash
    console.log('[PASS] Corrupted decode data handled gracefully');
}

// Test 3: Encoder with zero dimensions throws
console.log('[TEST] 3. Zero dimensions throws...');
{
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    let threw = false;
    try {
        encoder.configure({ codec: 'avc1.42001e', width: 0, height: 0, bitrate: 1000000, framerate: 30 });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected zero dimensions to throw');
    encoder.close();
    console.log('[PASS] Zero dimensions throws');
}

// Test 4: Encoder with negative dimensions throws
console.log('[TEST] 4. Negative dimensions throws...');
{
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    let threw = false;
    try {
        encoder.configure({ codec: 'avc1.42001e', width: -100, height: -100, bitrate: 1000000, framerate: 30 });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected negative dimensions to throw');
    encoder.close();
    console.log('[PASS] Negative dimensions throws');
}

// Test 5: Missing required config fields throws
console.log('[TEST] 5. Missing required config throws...');
{
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    let threw = false;
    try {
        encoder.configure({ codec: 'avc1.42001e' }); // Missing width, height
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected missing config to throw');
    encoder.close();
    console.log('[PASS] Missing required config throws');
}

// Test 6: VideoFrame with mismatched buffer size
console.log('[TEST] 6. VideoFrame buffer size mismatch throws...');
{
    const smallBuf = Buffer.alloc(100); // Too small for 320x240 RGBA

    let threw = false;
    try {
        new VideoFrame(smallBuf, { codedWidth: 320, codedHeight: 240, timestamp: 0 });
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected buffer size mismatch to throw');
    console.log('[PASS] VideoFrame buffer size mismatch throws');
}

// Test 7: Configure without init throws
console.log('[TEST] 7. Configure without prior construction handled...');
{
    // This tests that VideoEncoder requires callbacks
    let threw = false;
    try {
        new VideoEncoder(null);
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Expected null init to throw');
    console.log('[PASS] Null init throws');
}

// Test 8: Encode with wrong frame dimensions
console.log('[TEST] 8. Wrong frame dimensions handled...');
{
    let errorCalled = false;
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { errorCalled = true; }
    });

    encoder.configure({ codec: 'avc1.42001e', width: 320, height: 240, bitrate: 1000000, framerate: 30 });

    // Create frame with different dimensions
    const buf = Buffer.alloc(640 * 480 * 4);
    const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: 0 });

    let threw = false;
    try {
        encoder.encode(frame);
    } catch (e) {
        threw = true;
    }
    frame.close();
    encoder.close();
    // Either throws or calls error callback - both are valid
    console.log('[PASS] Wrong frame dimensions handled');
}

console.log('[PASS] All error path tests passed!');
```

**Step 2: Run test** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/33_error_paths.js
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add test/33_error_paths.js && git commit -m "test: add error path tests for FFmpeg failures and invalid inputs"
```

---

## Task 9: Round-Trip Integration Test

**Files:**
- Create: `/Users/pedroproenca/Documents/Projects/node-webcodecs/test/34_round_trip_integrity.js`

**Step 1: Write round-trip integration test** (5 min)

```javascript
// test/34_round_trip_integrity.js
const assert = require('assert');
const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log('[TEST] Round-Trip Data Integrity Test');

async function testRoundTrip() {
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 30;

    // Store original frame data for comparison
    const originalFrames = [];
    const encodedChunks = [];
    const decodedFrames = [];

    // Step 1: Generate test frames with distinct patterns
    console.log('[TEST] 1. Generating test frames...');
    for (let i = 0; i < FRAME_COUNT; i++) {
        const rgba = new Uint8Array(WIDTH * HEIGHT * 4);

        // Create a gradient pattern that varies per frame
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const idx = (y * WIDTH + x) * 4;
                rgba[idx] = (x + i * 8) % 256;       // R varies with x and frame
                rgba[idx + 1] = (y + i * 8) % 256;   // G varies with y and frame
                rgba[idx + 2] = ((x + y) + i * 4) % 256; // B varies diagonally
                rgba[idx + 3] = 255;                  // A
            }
        }

        originalFrames.push({
            timestamp: i * 33333,
            avgR: rgba.filter((_, idx) => idx % 4 === 0).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            avgG: rgba.filter((_, idx) => idx % 4 === 1).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            avgB: rgba.filter((_, idx) => idx % 4 === 2).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            data: Buffer.from(rgba.buffer)
        });
    }
    console.log(`  Generated ${FRAME_COUNT} frames`);

    // Step 2: Encode all frames
    console.log('[TEST] 2. Encoding frames...');
    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            encodedChunks.push({
                type: chunk.type,
                timestamp: chunk.timestamp,
                byteLength: chunk.byteLength,
                data: (() => {
                    const buf = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(buf);
                    return Buffer.from(buf);
                })()
            });
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001e',
        width: WIDTH,
        height: HEIGHT,
        bitrate: 2_000_000,
        framerate: 30
    });

    for (let i = 0; i < FRAME_COUNT; i++) {
        const frame = new VideoFrame(originalFrames[i].data, {
            format: 'RGBA',
            codedWidth: WIDTH,
            codedHeight: HEIGHT,
            timestamp: originalFrames[i].timestamp
        });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }

    await encoder.flush();
    encoder.close();

    console.log(`  Encoded ${encodedChunks.length} chunks`);
    assert(encodedChunks.length >= FRAME_COUNT, `Expected at least ${FRAME_COUNT} chunks, got ${encodedChunks.length}`);

    // Step 3: Decode all chunks
    console.log('[TEST] 3. Decoding chunks...');
    const decoder = new VideoDecoder({
        output: (frame) => {
            // Calculate average color values for comparison
            const dest = new Uint8Array(WIDTH * HEIGHT * 4);
            frame.copyTo(dest);

            decodedFrames.push({
                timestamp: frame.timestamp,
                width: frame.codedWidth,
                height: frame.codedHeight,
                avgR: dest.filter((_, idx) => idx % 4 === 0).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
                avgG: dest.filter((_, idx) => idx % 4 === 1).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
                avgB: dest.filter((_, idx) => idx % 4 === 2).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT)
            });
            frame.close();
        },
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: WIDTH,
        codedHeight: HEIGHT
    });

    for (const chunk of encodedChunks) {
        const encodedChunk = new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            data: chunk.data
        });
        decoder.decode(encodedChunk);
    }

    await decoder.flush();
    decoder.close();

    console.log(`  Decoded ${decodedFrames.length} frames`);
    assert(decodedFrames.length >= FRAME_COUNT, `Expected at least ${FRAME_COUNT} decoded frames, got ${decodedFrames.length}`);

    // Step 4: Verify data integrity
    console.log('[TEST] 4. Verifying data integrity...');

    // Sort by timestamp for comparison
    decodedFrames.sort((a, b) => a.timestamp - b.timestamp);

    let matchCount = 0;
    const TOLERANCE = 30; // Allow for lossy compression differences

    for (let i = 0; i < Math.min(originalFrames.length, decodedFrames.length); i++) {
        const orig = originalFrames[i];
        const decoded = decodedFrames[i];

        // Check dimensions
        assert.strictEqual(decoded.width, WIDTH, `Frame ${i} width mismatch`);
        assert.strictEqual(decoded.height, HEIGHT, `Frame ${i} height mismatch`);

        // Check timestamp (may have small variance)
        const timestampDiff = Math.abs(orig.timestamp - decoded.timestamp);
        assert(timestampDiff < 1000, `Frame ${i} timestamp differs by ${timestampDiff}`);

        // Check color averages are in reasonable range (lossy compression)
        const rDiff = Math.abs(orig.avgR - decoded.avgR);
        const gDiff = Math.abs(orig.avgG - decoded.avgG);
        const bDiff = Math.abs(orig.avgB - decoded.avgB);

        if (rDiff < TOLERANCE && gDiff < TOLERANCE && bDiff < TOLERANCE) {
            matchCount++;
        }
    }

    const matchRate = matchCount / FRAME_COUNT;
    console.log(`  Color match rate: ${(matchRate * 100).toFixed(1)}% (${matchCount}/${FRAME_COUNT})`);

    // At least 80% of frames should have similar colors after lossy compression
    assert(matchRate >= 0.8, `Expected at least 80% color match, got ${(matchRate * 100).toFixed(1)}%`);

    // Step 5: Verify keyframe presence
    console.log('[TEST] 5. Verifying keyframe structure...');
    const keyframes = encodedChunks.filter(c => c.type === 'key');
    assert(keyframes.length >= 1, 'Expected at least one keyframe');
    console.log(`  Found ${keyframes.length} keyframes`);

    console.log('[PASS] Round-trip integrity test passed!');
}

testRoundTrip().catch(e => {
    console.error('[FAIL]', e);
    process.exit(1);
});
```

**Step 2: Run test** (1 min)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/34_round_trip_integrity.js
```

Expected: PASS with color match rate >= 80%

**Step 3: Commit** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/node-webcodecs && git add test/34_round_trip_integrity.js && git commit -m "test: add round-trip integration test with data integrity verification"
```

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | VideoFilter is independent |
| Group 2 | 2, 3 | Async workers are independent of each other |
| Group 3 | 4, 5 | Both depend on Group 2, but are independent of each other |
| Group 4 | 7, 8, 9 | Test tasks are independent, can run after Group 3 |
| Group 5 | 6 | Code review depends on all implementation and test tasks |
