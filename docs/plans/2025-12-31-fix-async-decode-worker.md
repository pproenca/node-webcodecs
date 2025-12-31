# Fix AsyncDecodeWorker Metadata Passthrough

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-fix-async-decode-worker.md` to implement task-by-task.

**Goal:** Fix AsyncDecodeWorker to pass rotation, flip, displayAspect, and colorSpace metadata to output VideoFrames, matching the proven AsyncEncodeWorker pattern.

**Architecture:** Mirror the EncoderMetadataConfig pattern from async_encode_worker.h:48-62. VideoDecoder::Configure populates a DecoderMetadataConfig struct and passes it to async_worker_->SetMetadataConfig(). EmitFrame uses this metadata when creating VideoFrame objects.

**Tech Stack:** C++17, N-API, FFmpeg

---

## Task 1: Add DecoderMetadataConfig Struct

**Files:**
- Modify: `src/async_decode_worker.h:25-40`

**Step 1: Add struct before AsyncDecodeWorker class**

Open `src/async_decode_worker.h` and add after the includes (line ~24):

```cpp
// Metadata config for decoded video frames (mirrors EncoderMetadataConfig pattern)
struct DecoderMetadataConfig {
  int rotation = 0;
  bool flip = false;
  int display_width = 0;
  int display_height = 0;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range = false;
  bool has_color_space = false;
};
```

**Step 2: Add metadata config member and setter to AsyncDecodeWorker class**

In the public section of AsyncDecodeWorker class (after line ~57):

```cpp
  void SetMetadataConfig(const DecoderMetadataConfig& config);
```

In the private section (after line ~77):

```cpp
  DecoderMetadataConfig metadata_;
```

**Step 3: Build to verify syntax**

```bash
npm run build:native 2>&1 | head -20
```

Expected: Build succeeds (no linker error yet for unimplemented method)

**Step 4: Commit**

```bash
git add src/async_decode_worker.h
git commit -m "feat(decoder): add DecoderMetadataConfig struct"
```

---

## Task 2: Implement SetMetadataConfig

**Files:**
- Modify: `src/async_decode_worker.cc:45-55`

**Step 1: Add SetMetadataConfig implementation**

After the SetCodecContext function (~line 64), add:

```cpp
void AsyncDecodeWorker::SetMetadataConfig(const DecoderMetadataConfig& config) {
  metadata_ = config;
}
```

**Step 2: Build to verify**

```bash
npm run build:native 2>&1 | head -10
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/async_decode_worker.cc
git commit -m "feat(decoder): implement SetMetadataConfig"
```

---

## Task 3: Update EmitFrame to Use Metadata

**Files:**
- Modify: `src/async_decode_worker.cc:191-256`

**Step 1: Update VideoFrame::CreateInstance call with metadata**

Find the EmitFrame function's NonBlockingCall lambda (around line 242-255) and update the VideoFrame creation to include metadata:

```cpp
  // Capture metadata for lambda
  int rotation = metadata_.rotation;
  bool flip = metadata_.flip;
  int disp_width = metadata_.display_width > 0 ? metadata_.display_width : width;
  int disp_height = metadata_.display_height > 0 ? metadata_.display_height : height;
  std::string color_primaries = metadata_.color_primaries;
  std::string color_transfer = metadata_.color_transfer;
  std::string color_matrix = metadata_.color_matrix;
  bool color_full_range = metadata_.color_full_range;
  bool has_color_space = metadata_.has_color_space;

  // Increment pending BEFORE queueing callback for accurate tracking
  pending_frames_++;

  // Capture this pointer for buffer pool release and pending decrement
  AsyncDecodeWorker* worker = this;
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [worker, width, height, timestamp, rotation, flip, disp_width, disp_height,
       color_primaries, color_transfer, color_matrix, color_full_range, has_color_space](
          Napi::Env env, Napi::Function fn, std::vector<uint8_t>* data) {
        Napi::Object frame_obj;
        if (has_color_space) {
          frame_obj = VideoFrame::CreateInstance(
              env, data->data(), data->size(), width, height, timestamp, "RGBA",
              rotation, flip, disp_width, disp_height,
              color_primaries, color_transfer, color_matrix, color_full_range);
        } else {
          frame_obj = VideoFrame::CreateInstance(
              env, data->data(), data->size(), width, height, timestamp, "RGBA",
              rotation, flip, disp_width, disp_height);
        }
        fn.Call({frame_obj});
        worker->ReleaseBuffer(data);
        // Decrement pending AFTER callback completes
        worker->pending_frames_--;
      });
```

**Step 2: Build to verify**

```bash
npm run build:native 2>&1 | head -20
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/async_decode_worker.cc
git commit -m "feat(decoder): pass metadata to VideoFrame in EmitFrame"
```

---

## Task 4: Add Exception Handling to TSFN Callback

**Files:**
- Modify: `src/async_decode_worker.cc:242-270`

**Step 1: Wrap callback body in try-catch**

Update the TSFN callback lambda to ensure pending_frames_ always decrements:

```cpp
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [worker, width, height, timestamp, rotation, flip, disp_width, disp_height,
       color_primaries, color_transfer, color_matrix, color_full_range, has_color_space](
          Napi::Env env, Napi::Function fn, std::vector<uint8_t>* data) {
        // Always clean up, even if callback throws
        try {
          Napi::Object frame_obj;
          if (has_color_space) {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp, "RGBA",
                rotation, flip, disp_width, disp_height,
                color_primaries, color_transfer, color_matrix, color_full_range);
          } else {
            frame_obj = VideoFrame::CreateInstance(
                env, data->data(), data->size(), width, height, timestamp, "RGBA",
                rotation, flip, disp_width, disp_height);
          }
          fn.Call({frame_obj});
        } catch (const std::exception& e) {
          // Log but don't propagate - cleanup must happen
          fprintf(stderr, "AsyncDecodeWorker callback error: %s\n", e.what());
        } catch (...) {
          fprintf(stderr, "AsyncDecodeWorker callback error: unknown exception\n");
        }
        // Always release buffer and decrement pending
        worker->ReleaseBuffer(data);
        worker->pending_frames_--;
      });
```

**Step 2: Build to verify**

```bash
npm run build:native 2>&1 | head -10
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/async_decode_worker.cc
git commit -m "fix(decoder): ensure pending_frames always decrements in TSFN callback"
```

---

## Task 5: Pass Metadata from VideoDecoder::Configure

**Files:**
- Modify: `src/video_decoder.cc:261-285`

**Step 1: Create and populate DecoderMetadataConfig in Configure**

After the async_worker_->SetCodecContext() call (around line 280), add:

```cpp
  // Set metadata config for async output frames (matching encoder pattern)
  DecoderMetadataConfig metadata_config;
  metadata_config.rotation = rotation_;
  metadata_config.flip = flip_;
  metadata_config.display_width = display_aspect_width_;
  metadata_config.display_height = display_aspect_height_;
  metadata_config.color_primaries = color_primaries_;
  metadata_config.color_transfer = color_transfer_;
  metadata_config.color_matrix = color_matrix_;
  metadata_config.color_full_range = color_full_range_;
  metadata_config.has_color_space = has_color_space_;
  async_worker_->SetMetadataConfig(metadata_config);
```

**Step 2: Build to verify**

```bash
npm run build:native 2>&1 | head -10
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/video_decoder.cc
git commit -m "feat(decoder): pass metadata config to async worker in Configure"
```

---

## Task 6: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Build everything**

```bash
npm run build
```

Expected: TypeScript and native build succeed

**Step 2: Run tests**

```bash
npm run test-unit 2>&1 | tail -50
```

Expected: All tests pass, including:
- "should pass displayAspectWidth/displayAspectHeight to VideoFrame output"
- "should pass colorSpace from config to output VideoFrame"

**Step 3: Commit any lint fixes if needed**

```bash
npm run lint-cpp 2>&1 | head -10
```

If errors, fix and commit.

---

## Task 7: Code Review

**Files:**
- All modified files

**Step 1: Review changes**

```bash
git diff HEAD~6..HEAD
```

Verify:
- DecoderMetadataConfig matches EncoderMetadataConfig pattern
- Metadata flows from VideoDecoder::Configure to EmitFrame
- Exception handling ensures cleanup always runs
- No memory leaks

**Step 2: Finalize**

If all tests pass and code review is clean, the fix is complete.

---

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Header and implementation, no overlap |
| Group 2 | 3, 4 | Both modify EmitFrame, must be serial |
| Group 3 | 5 | Configure modification |
| Group 4 | 6, 7 | Verification and review |
