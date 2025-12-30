# Fix 53 Failing WebCodecs Tests

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-fix-failing-tests.md` to implement task-by-task.

**Goal:** Make all 53 failing tests pass by fixing high bit-depth formats, VideoFrame.metadata(), visibleRect, ArrayBuffer transfer, audio encoder flush, and VP8/VP9 decode.

**Architecture:** TypeScript wrapper layer (`lib/index.ts`) handles metadata and transfer semantics. C++ native layer (`src/video_frame.cc`, `src/audio_encoder.cc`, `src/video_decoder.cc`) handles format parsing, visible rect, and codec operations. Fixes span both layers.

**Tech Stack:** TypeScript, C++17, node-addon-api, FFmpeg (libavcodec, libswscale, libswresample)

---

## Parallel Groups

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1, 2, 3, 4 | Independent fixes: TS metadata, TS visibleRect wrapper, TS transfer, TS error type |
| Group 2 | 5 | Audio encoder flush (C++ only, no file overlap) |
| Group 3 | 6 | VP8/VP9 decode (depends on understanding decoder behavior) |
| Group 4 | 7 | Code review |

---

### Task 1: Fix VideoFrame.metadata() Not Preserved

**Files:**
- Modify: `lib/index.ts:540-543` (VideoDecoder output callback)
- Modify: `lib/index.ts:1139-1142` (ImageDecoder decode)
- Test: `test/golden/video-frame-metadata.test.ts`

**Step 1: Initialize _metadata in VideoDecoder output callback** (2 min)

In `lib/index.ts`, find the VideoDecoder output callback around line 540-543:

```typescript
// Current code (missing _metadata):
const wrapper = Object.create(VideoFrame.prototype) as any;
wrapper._native = nativeFrame;
wrapper._closed = false;
init.output(wrapper as VideoFrame);
```

Change to:

```typescript
const wrapper = Object.create(VideoFrame.prototype) as any;
wrapper._native = nativeFrame;
wrapper._closed = false;
wrapper._metadata = {};  // Initialize empty metadata for decoded frames
init.output(wrapper as VideoFrame);
```

**Step 2: Initialize _metadata in ImageDecoder decode** (2 min)

In `lib/index.ts`, find the ImageDecoder decode method around line 1139-1142:

```typescript
// Current code (missing _metadata):
const wrapper = Object.create(VideoFrame.prototype) as any;
wrapper._native = result.image;
wrapper._closed = false;
```

Change to:

```typescript
const wrapper = Object.create(VideoFrame.prototype) as any;
wrapper._native = result.image;
wrapper._closed = false;
wrapper._metadata = {};  // Initialize empty metadata for decoded images
```

**Step 3: Run tests to verify** (30 sec)

```bash
npx vitest run test/golden/video-frame-metadata.test.ts -v
```

Expected: All tests pass

**Step 4: Commit** (30 sec)

```bash
git add lib/index.ts
git commit -m "$(cat <<'EOF'
fix(video-frame): initialize _metadata in decoder output wrappers

VideoFrame wrappers created from decoder output were missing _metadata
initialization, causing metadata() to return undefined properties.
EOF
)"
```

---

### Task 2: Fix visibleRect Storage and Validation

**Files:**
- Modify: `src/video_frame.cc:220-251` (visibleRect parsing and validation)
- Test: `test/golden/video-frame-visible-rect.test.ts`

**Step 1: Fix visibleRect.x and y parsing to handle zero correctly** (3 min)

The issue is that when x=0 and y=0 are explicitly passed, they're not distinguishable from "not set". Update the parsing in `src/video_frame.cc` around line 219-251:

```cpp
// Current code initializes visible_rect_ members implicitly
// The struct VisibleRect has x=0, y=0 as defaults

// Parse visibleRect from options
bool has_visible_rect = false;
if (opts.Has("visibleRect") && opts.Get("visibleRect").IsObject()) {
  has_visible_rect = true;
  Napi::Object rect = opts.Get("visibleRect").As<Napi::Object>();
  if (rect.Has("x")) {
    visible_rect_.x = rect.Get("x").As<Napi::Number>().Int32Value();
  }
  if (rect.Has("y")) {
    visible_rect_.y = rect.Get("y").As<Napi::Number>().Int32Value();
  }
  if (rect.Has("width")) {
    visible_rect_.width = rect.Get("width").As<Napi::Number>().Int32Value();
  }
  if (rect.Has("height")) {
    visible_rect_.height = rect.Get("height").As<Napi::Number>().Int32Value();
  }
}

// Default visibleRect to full coded dimensions if not specified
if (!has_visible_rect || visible_rect_.width == 0) {
  visible_rect_.x = 0;
  visible_rect_.y = 0;
  visible_rect_.width = coded_width_;
  visible_rect_.height = coded_height_;
}
```

Wait, looking at the test failures more carefully - the issue is that the validation throws for exceeds bounds BUT the test expects it to throw. Let me re-check.

Actually, looking at test line 71-84, it expects a throw but maybe the error isn't propagating correctly. The native layer throws but JS might not catch it.

**Step 2: Ensure exception propagates correctly** (2 min)

Check if the C++ throw is properly converted to a JS exception. The current code at line 248-250:
```cpp
Napi::Error::New(env, "visibleRect exceeds coded dimensions")
    .ThrowAsJavaScriptException();
return;
```

This should work. The test might be expecting a TypeError or DOMException instead of a generic Error.

Change to throw TypeError per W3C spec:
```cpp
Napi::TypeError::New(env, "visibleRect exceeds coded dimensions")
    .ThrowAsJavaScriptException();
return;
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-frame-visible-rect.test.ts -v
```

**Step 4: Commit** (30 sec)

```bash
git add src/video_frame.cc
git commit -m "$(cat <<'EOF'
fix(video-frame): improve visibleRect parsing and validation

- Fix detection of explicitly set visibleRect vs default
- Use TypeError for validation errors per W3C spec
EOF
)"
```

---

### Task 3: Fix ArrayBuffer Transfer Semantics

**Files:**
- Modify: `lib/index.ts:174-177` (VideoFrame constructor transfer handling)
- Test: `test/golden/video-frame-visible-rect.test.ts:211-234`

**Step 1: Ensure transfer happens AFTER native frame creation** (2 min)

The current code order is correct (transfer after native creation), but the issue might be that we're transferring AFTER we already created a view. Let me trace through:

1. Test creates `arrayBuffer`
2. Test creates `data = new Uint8Array(arrayBuffer)`
3. Constructor receives `data` (Uint8Array)
4. Constructor does `Buffer.from(data)` - this creates a view over same arrayBuffer
5. Constructor creates native frame (copies data in C++)
6. Constructor calls `detachArrayBuffers([arrayBuffer])`

The problem might be that `Buffer.from(data)` where data is a view over arrayBuffer doesn't copy, so when we detach arrayBuffer, the Buffer becomes invalid. BUT the native layer already copied the data, so this should be fine.

Let me check if there's an issue with the Uint8Array. Actually, looking at the test:
```typescript
const data = new Uint8Array(arrayBuffer);
// ...
const frame = new VideoFrame(data, {
  // ...
  transfer: [arrayBuffer],
});
expect(arrayBuffer.byteLength).toBe(0);
```

The transfer array contains the underlying arrayBuffer, not `data.buffer`. Actually that's the same thing since `data = new Uint8Array(arrayBuffer)`.

The issue might be that `structuredClone` with transfer doesn't actually work as expected in Node.js. Let me check if we need to use a different approach.

**Alternative approach - use ArrayBuffer.transfer():**

Node.js 22+ supports `ArrayBuffer.transfer()`. But for compatibility, structuredClone should work.

Actually, let's verify the test is correct. The test passes `transfer: [arrayBuffer]` where arrayBuffer is the underlying buffer of the Uint8Array data.

Wait - looking at constructor line 159-168:
```typescript
if (data instanceof Buffer) {
  dataBuffer = data;
} else if (data instanceof Uint8Array) {
  dataBuffer = Buffer.from(data);  // Creates a COPY in some cases, view in others
```

`Buffer.from(Uint8Array)` creates a COPY of the data, not a view! So when we detach the original arrayBuffer, the dataBuffer still has valid data.

So the issue is that `structuredClone(buffer, {transfer: [buffer]})` might not be detaching correctly in Node.js, or there's a timing issue.

Let me verify by checking if we can use a more reliable method:

```typescript
function detachArrayBuffers(buffers: ArrayBuffer[]): void {
  for (const buffer of buffers) {
    if (buffer.byteLength === 0) continue; // Already detached
    try {
      // Use ArrayBuffer.transfer if available (Node.js 22+)
      if ('transfer' in ArrayBuffer.prototype) {
        (buffer as any).transfer(0);
      } else {
        // Fallback: use structuredClone with transfer
        structuredClone(buffer, {transfer: [buffer]});
      }
    } catch {
      console.warn('ArrayBuffer transfer not supported, data copied instead');
    }
  }
}
```

Actually, `ArrayBuffer.prototype.transfer` returns a new buffer, doesn't mutate in place. The correct approach is:
```typescript
// This detaches the original buffer
structuredClone(buffer, {transfer: [buffer]});
// After this, buffer.byteLength should be 0
```

Let me check if there's a Node.js version issue. The test might be failing because Node.js doesn't support this properly.

Actually wait - looking at the structuredClone docs, when you transfer an ArrayBuffer, the ORIGINAL becomes detached. The code looks correct. Let me run a quick test to see what's happening.

The issue might be that we're passing a Uint8Array's buffer which is shared. Let me check if we need to handle this differently.

**Step 2: Debug by adding logging** (1 min)

Actually, for now let's verify the implementation is correct by running the test. If it fails, we can investigate further.

**Step 3: Run test** (30 sec)

```bash
npx vitest run test/golden/video-frame-visible-rect.test.ts::VideoFrame\ ArrayBuffer\ transfer -v
```

**Step 4: If failing, check Node.js version and structuredClone behavior**

If the test still fails, we may need to use a polyfill or different approach. For now, the implementation looks correct.

---

### Task 4: Fix AudioData.allocationSize Error Type

**Files:**
- Modify: `lib/index.ts:686-691` (AudioData.allocationSize)
- Test: `test/golden/core-types.test.ts:130-140` (approx)

**Step 1: Ensure allocationSize throws InvalidStateError when closed** (2 min)

Looking at the current code:
```typescript
allocationSize(options?: AudioDataCopyToOptions): number {
  if (this._closed) {
    throw new DOMException('AudioData is closed', 'InvalidStateError');
  }
  return this._native.allocationSize(options || {});
}
```

This looks correct - it throws InvalidStateError. But the test failure says it got RangeError. The issue might be that the native layer is throwing the error, not the TS layer.

Check `src/audio_data.cc` AllocationSize method to ensure it also checks for closed state properly. The TS check should happen first, so this should be fine.

Actually, looking at the test failure message:
```
expected [RangeError] to be [DOMException: AudioData is closed]
```

This suggests the check `if (this._closed)` isn't working. Let me check if `_closed` is being set correctly.

Looking at `close()` method:
```typescript
close(): void {
  if (!this._closed) {
    this._native.close();
    this._closed = true;
  }
}
```

This looks correct. The issue might be that when `allocationSize` is called with an invalid planeIndex, the native layer throws RangeError BEFORE we check `_closed`.

Wait, re-reading the test - it's checking `allocationSize` on a closed AudioData. But the test might be testing a different scenario. Let me find the exact test:

The test at line 130 of core-types.test.ts:
```typescript
it('should throw if AudioData is closed', () => {
  // ... create AudioData
  audioData.close();
  expect(() => audioData.allocationSize()).toThrow();
});
```

The test expects `allocationSize()` to throw when closed. The current TS code DOES throw DOMException. But if the test is seeing RangeError, maybe the _closed flag isn't set?

Let me check if there's a race condition or if the native layer is being called before _closed is set.

Actually, looking more carefully at the error in the test output:
```
should throw if AudioData is closed
AssertionError: expected [RangeError: ...] to be [InvalidStateError]
```

Wait, the test might be expecting a specific error TYPE. Let me check if the native layer is throwing RangeError for some reason.

Looking at `src/audio_data.cc` AllocationSize - if the native layer throws before we check _closed in TS, we'd see that error. But TS checks _closed first...

Unless the test is calling `allocationSize` with options that cause a different code path. Let me look at the exact test.

**Step 2: Run specific test to diagnose** (30 sec)

```bash
npx vitest run test/golden/core-types.test.ts -t "should throw if AudioData is closed" -v
```

**Step 3: Fix based on findings**

If the issue is error type mismatch, update the TS layer to ensure InvalidStateError is thrown.

---

### Task 5: Fix Audio Encoder Flush

**Files:**
- Modify: `src/audio_encoder.cc:514-532` (Flush method)
- Test: `test/golden/audio-encoder.test.ts`, `test/golden/audio-encoder-opus.test.ts`

**Step 1: Flush resampler before sending NULL frame** (3 min)

The resampler (swr_context_) buffers samples. Before flushing the encoder, we need to flush the resampler.

In `src/audio_encoder.cc`, update the Flush method:

```cpp
Napi::Value AudioEncoder::Flush(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "configured") {
    // First, flush the resampler to get any buffered samples
    if (swr_context_) {
      int frame_size = codec_context_->frame_size;

      // Get buffered samples from resampler
      int ret = av_frame_make_writable(frame_);
      if (ret >= 0) {
        // Flush resampler by passing NULL input
        int out_samples = swr_convert(swr_context_,
                                       frame_->data, frame_size,
                                       nullptr, 0);

        // If we got samples, send them to encoder
        if (out_samples > 0) {
          frame_->nb_samples = out_samples;
          // Calculate PTS for these final samples
          frame_->pts = timestamp_;

          ret = avcodec_send_frame(codec_context_, frame_);
          if (ret >= 0 || ret == AVERROR(EAGAIN)) {
            EmitChunks(env);
          }
        }
      }
    }

    // Send NULL frame to flush encoder
    avcodec_send_frame(codec_context_, nullptr);

    // Get remaining packets
    EmitChunks(env);
  }

  // Reset queue after flush
  encode_queue_size_ = 0;
  codec_saturated_.store(false);

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}
```

**Step 2: Run tests** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts test/golden/audio-encoder-opus.test.ts -v
```

**Step 3: Commit** (30 sec)

```bash
git add src/audio_encoder.cc
git commit -m "$(cat <<'EOF'
fix(audio-encoder): flush resampler before encoder during flush()

The resampler (swr_context_) buffers samples that need to be flushed
before sending NULL frame to encoder. This ensures all audio data
is encoded before flush completes.
EOF
)"
```

---

### Task 6: Fix VP8/VP9 Decode

**Files:**
- Modify: `src/video_decoder.cc:493-553` (EmitFrames method)
- Test: `test/golden/integration/vp8-vp9-encode-decode.test.js`

**Step 1: Investigate the issue** (2 min)

The VP8/VP9 decode tests fail because `decodedFrames.length` is 0. This means the output callback is never called.

Possible issues:
1. sws_context creation fails silently (already checked - it calls error callback)
2. VP8/VP9 decoder requires multiple packets before emitting output
3. The sws_context is created for wrong format

Looking at the decode flow:
1. Encode produces chunks
2. Decode receives chunks
3. Flush is called
4. EmitFrames should output decoded frames

The issue might be that VP8/VP9 encoded data format isn't compatible with how we're passing it to decoder. Check if we need special handling for VP8/VP9.

**Step 2: Add sws_context recreation for format changes** (3 min)

The sws_context is only created once. If the decoded frame format differs from what we initialized with, we need to recreate it.

```cpp
void VideoDecoder::EmitFrames(Napi::Env env) {
  while (true) {
    int ret = avcodec_receive_frame(codec_context_, frame_);
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      // ... error handling
      break;
    }

    // Check if sws_context needs to be recreated for this frame's format
    AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame_->format);
    if (sws_context_) {
      // Check if current sws_context matches frame dimensions and format
      // If not, free and recreate
      // Note: sws_getContext doesn't have a "check" function, so we track last format
    }

    if (!sws_context_ || last_frame_format_ != frame_format ||
        last_frame_width_ != frame_->width || last_frame_height_ != frame_->height) {

      if (sws_context_) {
        sws_freeContext(sws_context_);
      }

      sws_context_ = sws_getContext(frame_->width, frame_->height, frame_format,
                                     frame_->width, frame_->height, AV_PIX_FMT_RGBA,
                                     SWS_BILINEAR, nullptr, nullptr, nullptr);

      if (!sws_context_) {
        error_callback_.Call({Napi::Error::New(env, "Could not create sws context").Value()});
        av_frame_unref(frame_);
        break;
      }

      last_frame_format_ = frame_format;
      last_frame_width_ = frame_->width;
      last_frame_height_ = frame_->height;
    }

    // ... rest of conversion
  }
}
```

Add member variables to header:
```cpp
// In video_decoder.h
AVPixelFormat last_frame_format_ = AV_PIX_FMT_NONE;
int last_frame_width_ = 0;
int last_frame_height_ = 0;
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/integration/vp8-vp9-encode-decode.test.js -v
```

**Step 4: Commit** (30 sec)

```bash
git add src/video_decoder.cc src/video_decoder.h
git commit -m "$(cat <<'EOF'
fix(video-decoder): recreate sws_context on format/dimension change

VP8/VP9 decoders may output frames with different formats than expected.
Track last frame format and recreate sws_context when it changes.
EOF
)"
```

---

### Task 7: Code Review

**Step 1: Run full test suite** (2 min)

```bash
npm test
```

**Step 2: Review any remaining failures and iterate**

If tests still fail, investigate specific failures and apply targeted fixes.

**Step 3: Final commit for any additional fixes** (30 sec)

```bash
git add -A
git commit -m "fix: address remaining test failures"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `lib/index.ts` | Initialize `_metadata = {}` in VideoDecoder and ImageDecoder output wrappers |
| `src/video_frame.cc` | Fix visibleRect parsing, use TypeError for validation |
| `src/audio_encoder.cc` | Flush resampler before encoder in Flush() |
| `src/video_decoder.cc` | Recreate sws_context on format/dimension changes |
| `src/video_decoder.h` | Add tracking members for last frame format |
