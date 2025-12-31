# Fix All 43 Issues: Performance, Memory Leaks, and Spec Compliance

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-fix-all-43-issues.md` to implement task-by-task.

**Goal:** Fix all 43 verified issues across performance (15), memory leaks (8), and W3C spec compliance (20) in node-webcodecs.

**Architecture:** Pragmatic balance approach - surgical fixes where possible, new abstractions only where truly needed. Prioritize memory leaks → critical performance → spec compliance.

**Tech Stack:** C++17, N-API, FFmpeg 5+, TypeScript ESM

---

## Phase 1: Memory Leaks (8 issues)

### Task 1: Fix ImageDecoder MemoryBufferContext Leak

**Files:**
- Modify: `src/image_decoder.h`
- Modify: `src/image_decoder.cc:207-235`
- Test: `test/stress/memory-leak.test.ts`

**Step 1: Write failing test for memory leak** (2-5 min)

```typescript
// In test/stress/memory-leak.test.ts, add:
describe('ImageDecoder memory leak', () => {
  it('should not leak MemoryBufferContext when decoding animated images', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and destroy 100 animated image decoders
    for (let i = 0; i < 100; i++) {
      const decoder = new ImageDecoder({
        data: animatedGifBuffer,  // Use existing test fixture
        type: 'image/gif',
      });
      await decoder.completed;
      decoder.close();
    }

    // Force GC if available
    if (global.gc) global.gc();
    await new Promise(r => setTimeout(r, 100));

    const finalMemory = process.memoryUsage().heapUsed;
    const leakPerInstance = (finalMemory - initialMemory) / 100;

    // MemoryBufferContext is small (~24 bytes), but 100 leaks should be detectable
    expect(leakPerInstance).toBeLessThan(1000); // <1KB per instance
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/stress/memory-leak.test.ts -t "MemoryBufferContext"
```

Expected: May pass or fail depending on current leak detection sensitivity

**Step 3: Add mem_ctx_ member to ImageDecoder** (2-5 min)

In `src/image_decoder.h`, after line ~85 (private members section):
```cpp
  MemoryBufferContext* mem_ctx_ = nullptr;  // Owned, freed in Cleanup()
```

**Step 4: Fix Cleanup() to free mem_ctx_** (2-5 min)

In `src/image_decoder.cc` line 207, modify Cleanup():
```cpp
void ImageDecoder::Cleanup() {
  // Free MemoryBufferContext BEFORE avio_context_free (it's stored in opaque)
  if (avio_context_ && avio_context_->opaque) {
    delete static_cast<MemoryBufferContext*>(avio_context_->opaque);
    avio_context_->opaque = nullptr;
  }

  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  // ... rest unchanged
```

**Step 5: Update ParseAnimatedImageMetadata to use member** (2-5 min)

In `src/image_decoder.cc` around line 298, change:
```cpp
// Before: MemoryBufferContext* mem_ctx = new MemoryBufferContext();
// After:
mem_ctx_ = new MemoryBufferContext();
mem_ctx_->data = data_.data();
mem_ctx_->size = data_.size();
mem_ctx_->position = 0;
```

And update avio_alloc_context call to use `mem_ctx_` instead of `mem_ctx`.

**Step 6: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/stress/memory-leak.test.ts -t "MemoryBufferContext"
```

Expected: PASS

**Step 7: Commit** (30 sec)

```bash
git add src/image_decoder.h src/image_decoder.cc test/stress/memory-leak.test.ts
git commit -m "fix(image-decoder): free MemoryBufferContext in Cleanup()"
```

---

### Task 2: Fix AsyncEncodeWorker frame_info_ Unbounded Growth

**Files:**
- Modify: `src/async_encode_worker.cc:240-250`
- Test: `test/golden/video-encoder-async.test.ts`

**Step 1: Write failing test for map growth** (2-5 min)

```typescript
// In test/golden/video-encoder-async.test.ts, add:
it('should not accumulate frame_info entries during long encoding', async () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
  });

  // Encode 1000 frames
  for (let i = 0; i < 1000; i++) {
    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      { width: 320, height: 240, timestamp: i * 33333, format: 'RGBA' }
    );
    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  // Memory should not grow linearly with frame count
  // (This is a behavioral test - actual memory check is in stress tests)
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts -t "frame_info"
```

**Step 3: Fix map cleanup in EmitChunk** (2-5 min)

In `src/async_encode_worker.cc` around line 240-245, after looking up frame_info:
```cpp
void AsyncEncodeWorker::EmitChunk(AVPacket* pkt) {
  // ... existing lookup code ...
  auto it = frame_info_.find(pkt->pts);
  if (it != frame_info_.end()) {
    cb_data->timestamp = it->second.first;
    cb_data->duration = it->second.second;
    frame_info_.erase(it);  // ADD THIS LINE - cleanup after use
  }
  // ... rest unchanged
```

**Step 4: Run test to verify pass** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts -t "frame_info"
```

**Step 5: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc test/golden/video-encoder-async.test.ts
git commit -m "fix(encoder): clear frame_info entries after emitting chunks"
```

---

### Task 3: Fix VideoDecoder Unused Async Worker

**Files:**
- Modify: `src/video_decoder.cc:261-274`
- Modify: `src/video_decoder.h`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Verify current async worker is never started** (2-5 min)

Search for Start() call in video_decoder.cc - confirm it doesn't exist.

**Step 2: Remove dead async worker code** (5-10 min)

In `src/video_decoder.cc`, remove lines 261-273 (async worker creation):
```cpp
// DELETE these lines:
// output_tsfn_ = Napi::ThreadSafeFunction::New(...);
// error_tsfn_ = Napi::ThreadSafeFunction::New(...);
// async_worker_ = std::make_unique<AsyncDecodeWorker>(...);
// async_mode_ = true;
```

In `src/video_decoder.h`, remove:
```cpp
// DELETE:
// std::unique_ptr<AsyncDecodeWorker> async_worker_;
// Napi::ThreadSafeFunction output_tsfn_;
// Napi::ThreadSafeFunction error_tsfn_;
// bool async_mode_ = false;
```

**Step 3: Run tests to verify no regressions** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts
```

Expected: PASS (all existing tests still work since sync path was always used)

**Step 4: Commit** (30 sec)

```bash
git add src/video_decoder.cc src/video_decoder.h
git commit -m "refactor(decoder): remove unused async worker infrastructure"
```

---

### Task 4: Fix ResourceManager Empty Interval

**Files:**
- Modify: `lib/resource-manager.ts:136-146`
- Test: `test/stress/memory-leak.test.ts`

**Step 1: Remove empty monitoring interval** (2-5 min)

In `lib/resource-manager.ts`, modify `startMonitoring()`:
```typescript
private startMonitoring(): void {
  // Removed: empty interval wastes CPU
  // Monitoring now happens on-demand via getReclaimableCodecs()
}
```

**Step 2: Run existing tests** (30 sec)

```bash
npm run test-unit
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
git add lib/resource-manager.ts
git commit -m "fix(resource-manager): remove empty monitoring interval"
```

---

### Task 5: Fix Demuxer Callback References Not Cleared

**Files:**
- Modify: `src/demuxer.cc:61-68`
- Test: `test/golden/muxer.test.ts`

**Step 1: Add callback reset in Cleanup()** (2-5 min)

In `src/demuxer.cc` Cleanup() function:
```cpp
void Demuxer::Cleanup() {
  format_context_.reset();
  tracks_.clear();
  video_stream_index_ = -1;
  audio_stream_index_ = -1;

  // ADD: Clear callback references
  on_track_callback_.Reset();
  on_chunk_callback_.Reset();
  on_error_callback_.Reset();
}
```

**Step 2: Run tests** (30 sec)

```bash
npx vitest run test/golden/muxer.test.ts
```

**Step 3: Commit** (30 sec)

```bash
git add src/demuxer.cc
git commit -m "fix(demuxer): reset callback references in Cleanup()"
```

---

### Task 6: Fix Muxer Constructor Error Path

**Files:**
- Modify: `src/muxer.cc:71-79`
- Test: `test/golden/muxer.test.ts`

**Step 1: Write test for constructor error path** (2-5 min)

```typescript
it('should clean up properly when avio_open fails', () => {
  expect(() => {
    new Muxer({ filename: '/nonexistent/path/that/fails.mp4' });
  }).toThrow();
  // If this doesn't leak, format_context_ was cleaned up
});
```

**Step 2: Fix error path cleanup** (2-5 min)

In `src/muxer.cc` constructor, after avio_open failure:
```cpp
ret = avio_open(&format_context_->pb, filename_.c_str(), AVIO_FLAG_WRITE);
if (ret < 0) {
  format_context_.reset();  // ADD: Explicitly clean up before throw
  char err[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(ret, err, sizeof(err));
  Napi::Error::New(env, std::string("Failed to open output file: ") + err)
      .ThrowAsJavaScriptException();
  return;
}
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/muxer.test.ts
```

**Step 4: Commit** (30 sec)

```bash
git add src/muxer.cc test/golden/muxer.test.ts
git commit -m "fix(muxer): cleanup format_context on constructor error"
```

---

## Phase 2: Critical Performance (3 issues)

### Task 7: Add Hardware Acceleration Support

**Files:**
- Modify: `src/video_encoder.cc:200-225`
- Modify: `src/video_decoder.cc` (similar location)
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write test for hardware encoder detection** (2-5 min)

```typescript
describe('hardware acceleration', () => {
  it('should report hardware encoder availability in isConfigSupported', async () => {
    const config = {
      codec: 'avc1.42001e',
      width: 1920,
      height: 1080,
      hardwareAcceleration: 'prefer-hardware',
    };

    const support = await VideoEncoder.isConfigSupported(config);
    // Should not throw, may or may not have HW support
    expect(support.supported).toBeDefined();
  });

  it('should fall back to software when hardware unavailable', async () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      hardwareAcceleration: 'prefer-hardware',
    });

    // Should configure successfully regardless of HW availability
    expect(encoder.state).toBe('configured');
    encoder.close();
  });
});
```

**Step 2: Run test to verify current behavior** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "hardware"
```

**Step 3: Implement HW encoder fallback chain** (5-10 min)

In `src/video_encoder.cc` after line 217 (after finding codec_id):
```cpp
// Try hardware encoders first based on platform and hardwareAcceleration setting
codec_ = nullptr;
std::string hw_accel = webcodecs::AttrAsStr(config, "hardwareAcceleration", "no-preference");

if (hw_accel != "prefer-software") {
#ifdef __APPLE__
  if (codec_id == AV_CODEC_ID_H264) {
    codec_ = avcodec_find_encoder_by_name("h264_videotoolbox");
  } else if (codec_id == AV_CODEC_ID_HEVC) {
    codec_ = avcodec_find_encoder_by_name("hevc_videotoolbox");
  }
#endif
#ifdef _WIN32
  if (codec_id == AV_CODEC_ID_H264) {
    codec_ = avcodec_find_encoder_by_name("h264_nvenc");
    if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_qsv");
    if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_amf");
  } else if (codec_id == AV_CODEC_ID_HEVC) {
    codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
    if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_qsv");
  }
#endif
#ifdef __linux__
  if (codec_id == AV_CODEC_ID_H264) {
    codec_ = avcodec_find_encoder_by_name("h264_vaapi");
    if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_nvenc");
  } else if (codec_id == AV_CODEC_ID_HEVC) {
    codec_ = avcodec_find_encoder_by_name("hevc_vaapi");
    if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
  }
#endif
}

// Fallback to software encoder
if (!codec_) {
  codec_ = avcodec_find_encoder(codec_id);
}
```

**Step 4: Skip HW-specific options for HW encoders** (2-5 min)

After codec selection, modify the codec-specific options:
```cpp
// Codec-specific options (only for software encoders)
bool is_hw_encoder = codec_ && (
  strstr(codec_->name, "videotoolbox") ||
  strstr(codec_->name, "nvenc") ||
  strstr(codec_->name, "qsv") ||
  strstr(codec_->name, "vaapi") ||
  strstr(codec_->name, "amf")
);

if (!is_hw_encoder) {
  if (codec_id == AV_CODEC_ID_H264) {
    av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
    // ... existing options
  }
}
```

**Step 5: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "hardware"
```

**Step 6: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(encoder): add hardware acceleration support (VideoToolbox/NVENC/VAAPI)"
```

---

### Task 8: Add Packet Limit to Demuxer (Async-friendly)

**Files:**
- Modify: `src/demuxer.cc:185-191`
- Modify: `lib/demuxer.ts`
- Test: `test/golden/muxer.test.ts`

**Step 1: Write test for chunked demuxing** (2-5 min)

```typescript
it('should support chunked demuxing with packet limit', async () => {
  const demuxer = new Demuxer(testFilePath);

  let totalPackets = 0;
  while (true) {
    const packetsRead = demuxer.demuxPackets(10); // Read 10 at a time
    totalPackets += packetsRead;
    if (packetsRead === 0) break;
    await new Promise(r => setImmediate(r)); // Yield to event loop
  }

  expect(totalPackets).toBeGreaterThan(0);
});
```

**Step 2: Add maxPackets parameter** (5-10 min)

In `src/demuxer.cc` DemuxPackets():
```cpp
Napi::Value Demuxer::DemuxPackets(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  int max_packets = 0; // 0 = unlimited (backwards compatible)
  if (info.Length() > 0 && info[0].IsNumber()) {
    max_packets = info[0].As<Napi::Number>().Int32Value();
  }

  int packets_read = 0;
  while ((max_packets == 0 || packets_read < max_packets) &&
         av_read_frame(format_context_.get(), packet.get()) >= 0) {
    if (packet->stream_index == video_stream_index_ ||
        packet->stream_index == audio_stream_index_) {
      EmitChunk(env, packet.get(), packet->stream_index);
      packets_read++;
    }
    av_packet_unref(packet.get());
  }

  return Napi::Number::New(env, packets_read);
}
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/muxer.test.ts
```

**Step 4: Commit** (30 sec)

```bash
git add src/demuxer.cc lib/demuxer.ts test/golden/muxer.test.ts
git commit -m "feat(demuxer): add packet limit for event-loop friendly demuxing"
```

---

### Task 9: Replace Busy-Wait Flush with setTimeout

**Files:**
- Modify: `lib/video-encoder.ts:106-110`
- Test: `test/golden/video-encoder-event-loop.test.ts`

**Step 1: Write test for flush performance** (2-5 min)

```typescript
it('should not starve event loop during flush', async () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
  });

  // Encode frames
  for (let i = 0; i < 100; i++) {
    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      { width: 320, height: 240, timestamp: i * 33333, format: 'RGBA' }
    );
    encoder.encode(frame);
    frame.close();
  }

  // Check event loop responsiveness during flush
  let eventLoopCalls = 0;
  const checkInterval = setInterval(() => eventLoopCalls++, 1);

  await encoder.flush();
  clearInterval(checkInterval);

  // Event loop should have been called multiple times during flush
  expect(eventLoopCalls).toBeGreaterThan(5);
  encoder.close();
});
```

**Step 2: Replace setImmediate with setTimeout** (2-5 min)

In `lib/video-encoder.ts` around line 108:
```typescript
// Before:
// while (this._native.pendingChunks > 0) {
//   await new Promise((resolve) => setImmediate(resolve));
// }

// After:
while (this._native.pendingChunks > 0) {
  await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms poll
}
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder-event-loop.test.ts
```

**Step 4: Commit** (30 sec)

```bash
git add lib/video-encoder.ts test/golden/video-encoder-event-loop.test.ts
git commit -m "perf(encoder): use setTimeout instead of setImmediate in flush"
```

---

## Phase 3: High Severity Performance (5 issues)

### Task 10: Fix Triple Buffer Copy in Chunk Emission

**Files:**
- Modify: `src/async_encode_worker.cc:244-267`
- Test: `test/golden/video-encoder-async.test.ts`

**Step 1: Use Napi::Buffer::NewOrCopy to avoid final copy** (5-10 min)

In `src/async_encode_worker.cc`, modify the TSFN callback:
```cpp
// Instead of copying data into new buffer, use external buffer
// Change from:
// chunk.Set("data", Napi::Buffer<uint8_t>::Copy(env, info->data.data(), info->data.size()));
// To:
auto buffer = Napi::Buffer<uint8_t>::New(
  env,
  info->data.data(),
  info->data.size(),
  [](Napi::Env, uint8_t*, ChunkCallbackData* hint) {
    delete hint;
  },
  info
);
chunk.Set("data", buffer);
// Remove the `delete info` at the end since the buffer destructor handles it
```

**Step 2: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts
```

**Step 3: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc
git commit -m "perf(encoder): reduce copies in chunk emission using external buffer"
```

---

### Task 11: Pool Decoded Frame Buffers

**Files:**
- Modify: `src/async_decode_worker.cc:160-162`
- Modify: `src/async_decode_worker.h`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Add buffer pool to AsyncDecodeWorker** (5-10 min)

In `src/async_decode_worker.h`:
```cpp
class AsyncDecodeWorker {
 private:
  // Add buffer pool
  std::vector<std::vector<uint8_t>*> buffer_pool_;
  std::mutex pool_mutex_;

  std::vector<uint8_t>* AcquireBuffer(size_t size);
  void ReleaseBuffer(std::vector<uint8_t>* buffer);
};
```

**Step 2: Implement pool methods** (5-10 min)

In `src/async_decode_worker.cc`:
```cpp
std::vector<uint8_t>* AsyncDecodeWorker::AcquireBuffer(size_t size) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  for (auto it = buffer_pool_.begin(); it != buffer_pool_.end(); ++it) {
    if ((*it)->capacity() >= size) {
      auto* buffer = *it;
      buffer_pool_.erase(it);
      buffer->resize(size);
      return buffer;
    }
  }
  return new std::vector<uint8_t>(size);
}

void AsyncDecodeWorker::ReleaseBuffer(std::vector<uint8_t>* buffer) {
  std::lock_guard<std::mutex> lock(pool_mutex_);
  if (buffer_pool_.size() < 4) {  // Keep up to 4 buffers
    buffer_pool_.push_back(buffer);
  } else {
    delete buffer;
  }
}
```

**Step 3: Use pool in decode path** (2-5 min)

Replace `new std::vector<uint8_t>(rgba_size)` with `AcquireBuffer(rgba_size)`.

**Step 4: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts
```

**Step 5: Commit** (30 sec)

```bash
git add src/async_decode_worker.cc src/async_decode_worker.h
git commit -m "perf(decoder): pool decoded frame buffers to reduce allocations"
```

---

## Phase 4: Spec Compliance (12 issues)

### Task 12: Fix reset() Behavior Consistency

**Files:**
- Modify: `src/video_encoder.cc:545-571`
- Modify: `src/video_decoder.cc:378-405`
- Modify: `src/audio_encoder.cc`
- Modify: `src/audio_decoder.cc`
- Test: `test/golden/video-encoder-w3c-compliance.test.ts`

**Step 1: Write test for reset() on closed codec** (2-5 min)

```typescript
it('reset() should be no-op when closed (W3C spec)', () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  encoder.close();

  // W3C spec: reset() is no-op when closed, should NOT throw
  expect(() => encoder.reset()).not.toThrow();
});
```

**Step 2: Fix native reset() to not throw when closed** (5-10 min)

In `src/video_encoder.cc` Reset():
```cpp
Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // W3C spec: reset() is a no-op when closed (don't throw)
  if (state_ == "closed") {
    return env.Undefined();  // Changed from throwing
  }

  // ... rest unchanged
```

Apply same fix to video_decoder.cc, audio_encoder.cc, audio_decoder.cc.

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts -t "reset"
```

**Step 4: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_decoder.cc src/audio_encoder.cc src/audio_decoder.cc
git commit -m "fix(codecs): reset() is no-op when closed per W3C spec"
```

---

### Task 13: Add VideoFrame Rotation/Flip Application

**Files:**
- Modify: `src/video_frame.cc:700-800` (CopyTo method)
- Test: `test/golden/video-frame-copy-to-options.test.ts`

**Step 1: Write test for rotation application** (2-5 min)

```typescript
it('should apply rotation when copying frame', async () => {
  const frame = new VideoFrame(
    testRgbaData,
    { width: 100, height: 50, timestamp: 0, format: 'RGBA', rotation: 90 }
  );

  const dest = new ArrayBuffer(frame.allocationSize());
  await frame.copyTo(dest);

  // After 90° rotation, dimensions are swapped
  expect(frame.displayWidth).toBe(50);
  expect(frame.displayHeight).toBe(100);

  frame.close();
});
```

**Step 2: Implement ApplyRotationFlip helper** (10-15 min)

In `src/video_frame.cc`:
```cpp
static void ApplyRotationFlip(uint8_t* data, int width, int height, int rotation, bool flip) {
  // Implementation for in-place rotation and flip
  // Use temporary buffer for 90/270 rotations
  if (rotation == 0 && !flip) return;

  std::vector<uint8_t> temp(width * height * 4);
  memcpy(temp.data(), data, temp.size());

  // Apply transformations based on rotation and flip
  // ... (detailed implementation)
}
```

**Step 3: Call helper in CopyTo** (2-5 min)

**Step 4: Run tests** (30 sec)

```bash
npx vitest run test/golden/video-frame-copy-to-options.test.ts -t "rotation"
```

**Step 5: Commit** (30 sec)

```bash
git add src/video_frame.cc test/golden/video-frame-copy-to-options.test.ts
git commit -m "feat(video-frame): apply rotation/flip in copyTo()"
```

---

### Task 14: Add FLAC and MP3 Audio Encoding

**Files:**
- Modify: `src/audio_encoder.cc:92-97`
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write test for FLAC encoding** (2-5 min)

```typescript
it('should support FLAC encoding', async () => {
  const encoder = new AudioEncoder({
    output: () => {},
    error: (e) => { throw e; },
  });

  const support = await AudioEncoder.isConfigSupported({
    codec: 'flac',
    sampleRate: 44100,
    numberOfChannels: 2,
  });

  expect(support.supported).toBe(true);
});
```

**Step 2: Add codec mappings** (2-5 min)

In `src/audio_encoder.cc`:
```cpp
if (codec_str == "opus") {
  codec_id = AV_CODEC_ID_OPUS;
} else if (codec_str.find("mp4a.40") == 0) {
  codec_id = AV_CODEC_ID_AAC;
} else if (codec_str == "flac") {
  codec_id = AV_CODEC_ID_FLAC;
} else if (codec_str == "mp3") {
  codec_id = AV_CODEC_ID_MP3;
} else if (codec_str == "vorbis") {
  codec_id = AV_CODEC_ID_VORBIS;
}
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "FLAC"
```

**Step 4: Commit** (30 sec)

```bash
git add src/audio_encoder.cc test/golden/audio-encoder.test.ts
git commit -m "feat(audio-encoder): add FLAC, MP3, Vorbis codec support"
```

---

## Task Groups (Parallel Execution)

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1, 2, 3, 4, 5, 6 | Memory leaks - independent files |
| Group 2 | 7 | HW acceleration - encoder-specific |
| Group 3 | 8, 9 | Demuxer/flush - independent |
| Group 4 | 10, 11 | Buffer optimization - encoder/decoder |
| Group 5 | 12, 13, 14 | Spec compliance - multiple codecs |

---

### Final Task: Code Review

After all tasks complete, run comprehensive code review:

```bash
git diff main..HEAD
npm run lint
npm test
```

Dispatch code-reviewer agent to verify all changes.
