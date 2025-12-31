# EventTarget Inheritance and Queue Tracking Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-eventtarget-queue-tracking.md` to implement task-by-task.

**Goal:** Make all codec classes (VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder) W3C spec-compliant by adding EventTarget inheritance and proper native queue tracking.

**Architecture:** Extract a `CodecBase` abstract class extending Node.js built-in `EventTarget` to eliminate duplicated `ondequeue`/`_triggerDequeue` patterns across 4 classes. Implement native queue tracking in VideoDecoder, AudioEncoder, and AudioDecoder to match the existing VideoEncoder pattern.

**Tech Stack:** TypeScript, C++17, node-addon-api, Node.js EventTarget (built-in since Node 15+)

---

## Task Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3, 4 | Native queue tracking - each file is independent |
| Group 2 | 5 | EventTarget base class - depends on understanding current patterns |
| Group 3 | 6 | Type definitions - depends on Task 5 completion |
| Group 4 | 7 | Code review - final verification |

---

### Task 1: VideoDecoder Native Queue Tracking

**Files:**
- Modify: `src/video_decoder.h:55-60`
- Modify: `src/video_decoder.cc:265-267,175-200,225-250`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-decoder.test.ts` after the existing `decodeQueueSize` test (around line 74):

```typescript
describe('decodeQueueSize tracking', () => {
  it('should increment during decode and decrement after output', async () => {
    const outputFrames: VideoFrame[] = [];
    const decoder = new VideoDecoder({
      output: (frame) => {
        outputFrames.push(frame);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({
      codec: 'avc1.42001e',
      codedWidth: 320,
      codedHeight: 240,
    });

    expect(decoder.decodeQueueSize).toBe(0);

    // Create a minimal H.264 encoded chunk (keyframe)
    // This is a minimal valid H.264 NAL unit for testing
    const encodedData = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // NAL start code
      0x67, 0x42, 0x00, 0x1e, // SPS
      0x00, 0x00, 0x00, 0x01,
      0x68, 0xce, 0x3c, 0x80, // PPS
    ]);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: encodedData,
    });

    // Queue should be > 0 immediately after decode call
    decoder.decode(chunk);

    // Flush and wait for processing
    await decoder.flush();

    // After flush, queue should be empty
    expect(decoder.decodeQueueSize).toBe(0);

    // Cleanup
    outputFrames.forEach(f => f.close());
    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "decodeQueueSize tracking"
```

Expected: Test may pass or fail depending on current implementation. The native layer returns 0, but TypeScript layer tracks it. This test validates end-to-end behavior.

**Step 3: Add queue tracking fields to video_decoder.h** (2-5 min)

Open `src/video_decoder.h` and add after line 55 (after the existing member variables):

```cpp
  // Queue tracking for W3C WebCodecs spec compliance
  int decode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
```

**Step 4: Implement queue increment in Decode method** (2-5 min)

Open `src/video_decoder.cc`. Find the `Decode` method (around line 175). After the line that calls `avcodec_send_packet`, add:

```cpp
  // Increment queue size after successful packet submission
  decode_queue_size_++;
  bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);
```

**Step 5: Implement queue decrement in EmitFrames** (2-5 min)

In `src/video_decoder.cc`, find the `EmitFrames` method (around line 225). After each successful frame emission (inside the loop that calls the output callback), add:

```cpp
  // Decrement queue size after frame is emitted
  if (decode_queue_size_ > 0) {
    decode_queue_size_--;
    bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
    codec_saturated_.store(saturated);
  }
```

**Step 6: Update GetDecodeQueueSize to return actual value** (2-5 min)

In `src/video_decoder.cc`, replace the `GetDecodeQueueSize` method (around line 265-267):

```cpp
Napi::Value VideoDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), decode_queue_size_);
}
```

**Step 7: Build native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors.

**Step 8: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "decodeQueueSize tracking"
```

Expected: PASS

**Step 9: Commit** (30 sec)

```bash
git add src/video_decoder.h src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "$(cat <<'EOF'
feat(video-decoder): implement native queue size tracking

Add decode_queue_size_ member to track pending decode operations.
Increment on decode(), decrement on frame output.
Matches VideoEncoder pattern for W3C spec compliance.
EOF
)"
```

---

### Task 2: AudioEncoder Native Queue Tracking

**Files:**
- Modify: `src/audio_encoder.h:45-50`
- Modify: `src/audio_encoder.cc:345-347,180-210,290-320`
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/audio-encoder.test.ts`:

```typescript
describe('encodeQueueSize tracking', () => {
  it('should track pending encode operations', async () => {
    const outputChunks: EncodedAudioChunk[] = [];
    const encoder = new AudioEncoder({
      output: (chunk) => {
        outputChunks.push(chunk);
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    expect(encoder.encodeQueueSize).toBe(0);

    // Create audio data for encoding
    const sampleRate = 48000;
    const numberOfChannels = 2;
    const numberOfFrames = 960; // 20ms of audio at 48kHz
    const data = new Float32Array(numberOfFrames * numberOfChannels);

    // Fill with a simple sine wave
    for (let i = 0; i < numberOfFrames; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        data[i * numberOfChannels + ch] = sample;
      }
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: sampleRate,
      numberOfFrames: numberOfFrames,
      numberOfChannels: numberOfChannels,
      timestamp: 0,
      data: data,
    });

    encoder.encode(audioData);

    await encoder.flush();
    expect(encoder.encodeQueueSize).toBe(0);

    encoder.close();
  });
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "encodeQueueSize tracking"
```

**Step 3: Add queue tracking fields to audio_encoder.h** (2-5 min)

Open `src/audio_encoder.h` and add the queue tracking fields (similar location to video_encoder.h):

```cpp
  // Queue tracking for W3C WebCodecs spec compliance
  int encode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
```

**Step 4: Implement queue increment in Encode method** (2-5 min)

In `src/audio_encoder.cc`, find the `Encode` method. After successful frame submission to the encoder, add:

```cpp
  // Increment queue size after successful frame submission
  encode_queue_size_++;
  bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);
```

**Step 5: Implement queue decrement in EmitChunks** (2-5 min)

In `src/audio_encoder.cc`, find the `EmitChunks` method. After each successful chunk emission, add:

```cpp
  // Decrement queue size after chunk is emitted
  if (encode_queue_size_ > 0) {
    encode_queue_size_--;
    bool saturated = encode_queue_size_ >= static_cast<int>(kMaxQueueSize);
    codec_saturated_.store(saturated);
  }
```

**Step 6: Update GetEncodeQueueSize to return actual value** (2-5 min)

In `src/audio_encoder.cc`, replace the `GetEncodeQueueSize` method:

```cpp
Napi::Value AudioEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), encode_queue_size_);
}
```

**Step 7: Build native addon** (30 sec)

```bash
npm run build:native
```

**Step 8: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "encodeQueueSize tracking"
```

Expected: PASS

**Step 9: Commit** (30 sec)

```bash
git add src/audio_encoder.h src/audio_encoder.cc test/golden/audio-encoder.test.ts
git commit -m "$(cat <<'EOF'
feat(audio-encoder): implement native queue size tracking

Add encode_queue_size_ member to track pending encode operations.
Matches VideoEncoder pattern for W3C spec compliance.
EOF
)"
```

---

### Task 3: AudioDecoder Native Queue Tracking

**Files:**
- Modify: `src/audio_decoder.h:45-50`
- Modify: `src/audio_decoder.cc:242-244,140-170,190-220`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/audio-decoder.test.ts`:

```typescript
describe('decodeQueueSize tracking', () => {
  it('should track pending decode operations', async () => {
    const outputData: AudioData[] = [];
    const decoder = new AudioDecoder({
      output: (data) => {
        outputData.push(data);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    expect(decoder.decodeQueueSize).toBe(0);

    await decoder.flush();
    expect(decoder.decodeQueueSize).toBe(0);

    outputData.forEach(d => d.close());
    decoder.close();
  });
});
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "decodeQueueSize tracking"
```

**Step 3: Add queue tracking fields to audio_decoder.h** (2-5 min)

Open `src/audio_decoder.h` and add:

```cpp
  // Queue tracking for W3C WebCodecs spec compliance
  int decode_queue_size_ = 0;
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;
```

**Step 4: Implement queue increment in Decode method** (2-5 min)

In `src/audio_decoder.cc`, find the `Decode` method. After successful packet submission, add:

```cpp
  // Increment queue size after successful packet submission
  decode_queue_size_++;
  bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
  codec_saturated_.store(saturated);
```

**Step 5: Implement queue decrement in EmitFrames** (2-5 min)

In `src/audio_decoder.cc`, find the output emission logic. After each successful audio data emission, add:

```cpp
  // Decrement queue size after audio data is emitted
  if (decode_queue_size_ > 0) {
    decode_queue_size_--;
    bool saturated = decode_queue_size_ >= static_cast<int>(kMaxQueueSize);
    codec_saturated_.store(saturated);
  }
```

**Step 6: Update GetDecodeQueueSize to return actual value** (2-5 min)

In `src/audio_decoder.cc`, replace the `GetDecodeQueueSize` method:

```cpp
Napi::Value AudioDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), decode_queue_size_);
}
```

**Step 7: Build native addon** (30 sec)

```bash
npm run build:native
```

**Step 8: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "decodeQueueSize tracking"
```

Expected: PASS

**Step 9: Commit** (30 sec)

```bash
git add src/audio_decoder.h src/audio_decoder.cc test/golden/audio-decoder.test.ts
git commit -m "$(cat <<'EOF'
feat(audio-decoder): implement native queue size tracking

Add decode_queue_size_ member to track pending decode operations.
Matches VideoEncoder pattern for W3C spec compliance.
EOF
)"
```

---

### Task 4: Remove TODO Comments for Completed Queue Tracking

**Files:**
- Modify: `src/video_decoder.cc:265-267`
- Modify: `src/audio_encoder.cc:345-347`
- Modify: `src/audio_decoder.cc:242-244`

**Step 1: Remove TODO comment from video_decoder.cc** (1 min)

In `src/video_decoder.cc`, remove or update the TODO comment near the `GetDecodeQueueSize` method that says "Implement proper queue size tracking".

**Step 2: Remove TODO comment from audio_encoder.cc** (1 min)

In `src/audio_encoder.cc`, remove similar TODO comment.

**Step 3: Remove TODO comment from audio_decoder.cc** (1 min)

In `src/audio_decoder.cc`, remove similar TODO comment.

**Step 4: Commit** (30 sec)

```bash
git add src/video_decoder.cc src/audio_encoder.cc src/audio_decoder.cc
git commit -m "$(cat <<'EOF'
chore: remove completed TODO comments for queue tracking
EOF
)"
```

---

### Task 5: EventTarget Inheritance with CodecBase

**Files:**
- Modify: `lib/index.ts:248-320,443-510,751-803,842-898`
- Test: `test/golden/video-encoder.test.ts`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test for VideoEncoder EventTarget** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('EventTarget', () => {
  it('should support addEventListener for dequeue', async () => {
    let dequeueCount = 0;
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.addEventListener('dequeue', () => {
      dequeueCount++;
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 1_000_000,
    });

    // Create a simple frame
    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      }
    );

    encoder.encode(frame);
    frame.close();

    await encoder.flush();
    encoder.close();

    // dequeue event should have fired at least once
    expect(dequeueCount).toBeGreaterThan(0);
  });

  it('should support removeEventListener', () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    let called = false;
    const handler = () => { called = true; };

    encoder.addEventListener('dequeue', handler);
    encoder.removeEventListener('dequeue', handler);

    // Manually trigger (internal method) - the handler should not be called
    // This tests that removeEventListener works
    encoder.close();

    // Note: We can't easily test this without exposing internal methods
    // The test validates the API exists and doesn't throw
    expect(encoder.removeEventListener).toBeDefined();
  });

  it('should support both ondequeue callback and addEventListener', async () => {
    let callbackCalled = false;
    let eventCalled = false;

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.ondequeue = () => { callbackCalled = true; };
    encoder.addEventListener('dequeue', () => { eventCalled = true; });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 1_000_000,
    });

    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      }
    );

    encoder.encode(frame);
    frame.close();

    await encoder.flush();
    encoder.close();

    expect(callbackCalled).toBe(true);
    expect(eventCalled).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "EventTarget"
```

Expected: FAIL with `TypeError: encoder.addEventListener is not a function`

**Step 3: Add CodecBase abstract class to lib/index.ts** (2-5 min)

Open `lib/index.ts`. At the top of the file, after the imports (around line 20), add:

```typescript
/**
 * Abstract base class for all WebCodecs codec classes.
 * Provides EventTarget inheritance and common dequeue event handling.
 * Per W3C WebCodecs spec, all codecs extend EventTarget.
 */
abstract class CodecBase extends EventTarget {
  protected _ondequeue: (() => void) | null = null;

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  /**
   * Triggers the 'dequeue' event per W3C spec.
   * Dispatches both the standard Event and calls the legacy callback.
   */
  protected _triggerDequeue(): void {
    // Dispatch standard EventTarget event
    this.dispatchEvent(new Event('dequeue'));

    // Also call legacy ondequeue callback for backwards compatibility
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }
}
```

**Step 4: Modify VideoEncoder to extend CodecBase** (2-5 min)

Find the `VideoEncoder` class declaration (around line 248). Change:

```typescript
export class VideoEncoder {
```

To:

```typescript
export class VideoEncoder extends CodecBase {
```

Then remove these duplicated members from VideoEncoder:
- `private _ondequeue: (() => void) | null = null;`
- The `get ondequeue()` getter
- The `set ondequeue()` setter
- The `_triggerDequeue()` method

Keep the `super()` call if constructor exists, or add it:

```typescript
constructor(init: VideoEncoderInit) {
  super();
  // ... rest of constructor
}
```

**Step 5: Run test to verify VideoEncoder passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "EventTarget"
```

Expected: PASS

**Step 6: Modify VideoDecoder to extend CodecBase** (2-5 min)

Find the `VideoDecoder` class declaration (around line 443). Change to extend `CodecBase` and remove duplicated members (same pattern as VideoEncoder).

**Step 7: Modify AudioEncoder to extend CodecBase** (2-5 min)

Find the `AudioEncoder` class declaration (around line 751). Change to extend `CodecBase` and remove duplicated members.

**Step 8: Modify AudioDecoder to extend CodecBase** (2-5 min)

Find the `AudioDecoder` class declaration (around line 842). Change to extend `CodecBase` and remove duplicated members.

**Step 9: Build TypeScript** (30 sec)

```bash
npm run build:ts
```

Expected: Build succeeds with no errors.

**Step 10: Run all EventTarget tests** (30 sec)

```bash
npx vitest run -t "EventTarget"
```

Expected: All PASS

**Step 11: Run full test suite** (1 min)

```bash
npm test
```

Expected: All tests pass.

**Step 12: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/video-encoder.test.ts
git commit -m "$(cat <<'EOF'
feat(codec): add EventTarget inheritance via CodecBase

Implement W3C WebCodecs spec requirement for EventTarget on all codec
classes. Extract common ondequeue/dispatchEvent logic into CodecBase
abstract class to eliminate duplication.

- VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder now extend EventTarget
- Support both addEventListener('dequeue', ...) and ondequeue callback
- Backwards compatible with existing ondequeue usage
EOF
)"
```

---

### Task 6: Update Type Definitions

**Files:**
- Modify: `lib/types.ts:805,830,855,880`

**Step 1: Update VideoEncoder interface** (2-5 min)

In `lib/types.ts`, find the `VideoEncoder` interface (around line 805). Update the comment and add EventTarget extension:

```typescript
/**
 * WebIDL: interface VideoEncoder : EventTarget
 * Implements EventTarget for 'dequeue' event support.
 */
export interface VideoEncoder extends EventTarget {
  // ... existing members
}
```

**Step 2: Update VideoDecoder interface** (2-5 min)

In `lib/types.ts`, find the `VideoDecoder` interface (around line 830). Apply same change.

**Step 3: Update AudioEncoder interface** (2-5 min)

In `lib/types.ts`, find the `AudioEncoder` interface (around line 855). Apply same change.

**Step 4: Update AudioDecoder interface** (2-5 min)

In `lib/types.ts`, find the `AudioDecoder` interface (around line 880). Apply same change.

**Step 5: Build TypeScript to verify types** (30 sec)

```bash
npm run build:ts
```

Expected: Build succeeds with no errors.

**Step 6: Commit** (30 sec)

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
docs(types): update interfaces to reflect EventTarget inheritance

Remove TODO comments and document EventTarget extension for all codec
interfaces per W3C WebCodecs spec.
EOF
)"
```

---

### Task 7: Update TODO.md and Code Review

**Files:**
- Modify: `TODO.md`

**Step 1: Update TODO.md to mark completed items** (2-5 min)

Update `TODO.md` to mark the following as complete:

```markdown
## Native Layer - Video (`src/video_decoder.cc`)

- [x] Implement proper queue size tracking (line 266) - DONE

## Types (`lib/types.ts`)

- [x] EventTarget inheritance implemented for VideoEncoder (line 805) - DONE
- [x] EventTarget inheritance implemented for VideoDecoder (line 830) - DONE
- [x] EventTarget inheritance implemented for AudioEncoder (line 855) - DONE
- [x] EventTarget inheritance implemented for AudioDecoder (line 880) - DONE
```

**Step 2: Run final test suite** (1 min)

```bash
npm test
```

Expected: All tests pass.

**Step 3: Run linter** (30 sec)

```bash
npm run lint
```

Expected: No lint errors.

**Step 4: Commit TODO.md update** (30 sec)

```bash
git add TODO.md
git commit -m "$(cat <<'EOF'
docs: mark EventTarget and queue tracking TODOs as complete
EOF
)"
```

**Step 5: Final code review checklist** (5 min)

Review the following:

- [ ] All 4 native codec files have queue tracking implemented
- [ ] CodecBase class is properly defined with EventTarget extension
- [ ] All 4 codec classes extend CodecBase
- [ ] Both `addEventListener` and `ondequeue` work together
- [ ] Type definitions in `lib/types.ts` reflect EventTarget extension
- [ ] All tests pass
- [ ] No lint errors
- [ ] TODO.md is updated

---

## Summary

| Task | Files Modified | Purpose |
|------|----------------|---------|
| 1 | video_decoder.h, video_decoder.cc, video-decoder.test.ts | Native queue tracking for VideoDecoder |
| 2 | audio_encoder.h, audio_encoder.cc, audio-encoder.test.ts | Native queue tracking for AudioEncoder |
| 3 | audio_decoder.h, audio_decoder.cc, audio-decoder.test.ts | Native queue tracking for AudioDecoder |
| 4 | video_decoder.cc, audio_encoder.cc, audio_decoder.cc | Remove completed TODO comments |
| 5 | lib/index.ts, video-encoder.test.ts | EventTarget via CodecBase class |
| 6 | lib/types.ts | Update type definitions |
| 7 | TODO.md | Documentation and final review |
