# WebCodecs Compliance Gap Closure Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-webcodecs-compliance-gaps.md` to implement task-by-task.

**Goal:** Close all remaining gaps in `docs/compliance.md` using TDD (red-green-refactor).

**Architecture:** TypeScript layer gaps (state validation, type validation, transfer semantics) require minimal changes to existing codec wrappers. C++ layer gaps (quantizer mode, alpha handling, premultiplication) require FFmpeg API integration with existing RAII patterns.

**Tech Stack:** TypeScript, Vitest, Node.js N-API, C++17, FFmpeg (libavcodec, libswscale)

---

## Summary

| Task | Gap | Layer | Files |
|------|-----|-------|-------|
| 1 | VideoEncoder.reset() closed state | TS | `lib/video-encoder.ts` |
| 2 | VideoEncoder.encode() state validation | TS | `lib/video-encoder.ts` |
| 3 | VideoDecoder.configure() flip/rotation validation | TS | `lib/video-decoder.ts` |
| 4 | EncodedAudioChunk type validation | TS | `lib/encoded-chunks.ts` |
| 5 | EncodedVideoChunk transfer semantics | TS | `lib/encoded-chunks.ts` |
| 6 | EncodedAudioChunk transfer semantics | TS | `lib/encoded-chunks.ts` |
| 7 | VideoEncoder bitrateMode="quantizer" | C++ | `src/video_encoder.cc` |
| 8 | VideoFrame alpha option | C++ | `src/video_frame.cc` |
| 9 | ImageDecoder premultiplyAlpha | C++ | `src/image_decoder.cc` |
| 10 | Code Review | - | - |

---

## Task 1: VideoEncoder.reset() - Throw InvalidStateError if Closed

**Files:**
- Modify: `lib/video-encoder.ts:114-118`
- Test: `test/golden/video-encoder-w3c-compliance.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to the "State machine compliance" describe block in `test/golden/video-encoder-w3c-compliance.test.ts`:

```typescript
it('should throw InvalidStateError when reset() called on closed encoder', () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });
  encoder.close();

  expect(() => encoder.reset()).toThrow(/closed|InvalidStateError/i);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts -t "reset() called on closed"
```

Expected: FAIL (reset currently doesn't check closed state)

**Step 3: Write minimal implementation** (2-5 min)

In `lib/video-encoder.ts`, replace the `reset()` method:

```typescript
reset(): void {
  // W3C spec: throw if closed
  if (this.state === 'closed') {
    throw new DOMException('Encoder is closed', 'InvalidStateError');
  }
  this._controlQueue.clear();
  this._encodeQueueSize = 0;
  this._native.reset();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts -t "reset() called on closed"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/video-encoder.ts test/golden/video-encoder-w3c-compliance.test.ts
git commit -m "fix(video-encoder): throw InvalidStateError on reset() when closed"
```

---

## Task 2: VideoEncoder.encode() - Throw InvalidStateError if Not Configured

**Files:**
- Modify: `lib/video-encoder.ts:85-90`
- Test: `test/golden/video-encoder-w3c-compliance.test.ts`

**Step 1: Write the failing test for unconfigured state** (2-5 min)

```typescript
it('should throw InvalidStateError when encode() called on unconfigured encoder', () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });

  const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
    format: 'RGBA',
    codedWidth: 64,
    codedHeight: 64,
    timestamp: 0,
  });

  try {
    expect(() => encoder.encode(frame)).toThrow(/unconfigured|InvalidStateError/i);
  } finally {
    frame.close();
    encoder.close();
  }
});
```

**Step 2: Write the failing test for closed state** (2-5 min)

```typescript
it('should throw InvalidStateError when encode() called on closed encoder', () => {
  const encoder = new VideoEncoder({
    output: () => {},
    error: () => {},
  });
  encoder.close();

  const frame = new VideoFrame(new Uint8Array(64 * 64 * 4), {
    format: 'RGBA',
    codedWidth: 64,
    codedHeight: 64,
    timestamp: 0,
  });

  try {
    expect(() => encoder.encode(frame)).toThrow(/closed|InvalidStateError/i);
  } finally {
    frame.close();
  }
});
```

**Step 3: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts -t "encode() called on"
```

Expected: FAIL (encode currently doesn't check state)

**Step 4: Write minimal implementation** (2-5 min)

In `lib/video-encoder.ts`, replace the `encode()` method:

```typescript
encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
  // W3C spec: throw if not configured
  if (this.state !== 'configured') {
    throw new DOMException(`Encoder is ${this.state}`, 'InvalidStateError');
  }
  ResourceManager.getInstance().recordActivity(this._resourceId);
  this._encodeQueueSize++;
  this._native.encode(frame._nativeFrame, options || {});
}
```

**Step 5: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts -t "encode() called on"
```

Expected: PASS (2 tests)

**Step 6: Commit** (30 sec)

```bash
git add lib/video-encoder.ts test/golden/video-encoder-w3c-compliance.test.ts
git commit -m "fix(video-encoder): throw InvalidStateError on encode() when not configured"
```

---

## Task 3: VideoDecoder.configure() - Validate flip/rotation at TS Layer

**Files:**
- Modify: `lib/video-decoder.ts:73-81`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test for invalid rotation** (2-5 min)

Add new describe block in `test/golden/video-decoder.test.ts`:

```typescript
describe('VideoDecoderConfig validation', () => {
  it('should throw TypeError for invalid rotation value', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => decoder.configure({
      codec: 'avc1.42E01E',
      rotation: 45 as any, // Invalid - must be 0, 90, 180, or 270
    })).toThrow(TypeError);

    decoder.close();
  });
});
```

**Step 2: Write the failing test for invalid flip** (2-5 min)

```typescript
it('should throw TypeError for non-boolean flip value', () => {
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });

  expect(() => decoder.configure({
    codec: 'avc1.42E01E',
    flip: 'yes' as any, // Invalid - must be boolean
  })).toThrow(TypeError);

  decoder.close();
});
```

**Step 3: Write the test for valid values** (2-5 min)

```typescript
it('should accept valid rotation values', () => {
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });

  for (const rotation of [0, 90, 180, 270]) {
    decoder.configure({ codec: 'avc1.42E01E', rotation } as any);
    decoder.reset();
  }

  decoder.close();
});
```

**Step 4: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "VideoDecoderConfig validation"
```

Expected: FAIL (validation not in TS layer)

**Step 5: Write minimal implementation** (2-5 min)

In `lib/video-decoder.ts`, update the `configure()` method after the closed state check:

```typescript
configure(config: VideoDecoderConfig): void {
  // W3C spec: throw if closed
  if (this.state === 'closed') {
    throw new DOMException('Decoder is closed', 'InvalidStateError');
  }

  // Validate rotation (node-webcodecs extension)
  if ('rotation' in config && config.rotation !== undefined) {
    if (![0, 90, 180, 270].includes(config.rotation)) {
      throw new TypeError(`rotation must be 0, 90, 180, or 270, got ${config.rotation}`);
    }
  }

  // Validate flip (node-webcodecs extension)
  if ('flip' in config && config.flip !== undefined) {
    if (typeof config.flip !== 'boolean') {
      throw new TypeError('flip must be a boolean');
    }
  }

  this._needsKeyFrame = true;
  this._native.configure(config);
}
```

**Step 6: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "VideoDecoderConfig validation"
```

Expected: PASS (3 tests)

**Step 7: Commit** (30 sec)

```bash
git add lib/video-decoder.ts test/golden/video-decoder.test.ts
git commit -m "fix(video-decoder): validate flip/rotation options at TypeScript layer"
```

---

## Task 4: EncodedAudioChunk - Add Type Validation

**Files:**
- Modify: `lib/encoded-chunks.ts:82-97`
- Test: `test/golden/encoded-audio-chunk.test.ts` (create)

**Step 1: Create test file with failing test** (2-5 min)

Create `test/golden/encoded-audio-chunk.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

describe('EncodedAudioChunk', () => {
  describe('constructor type validation', () => {
    it('should throw TypeError for invalid type value', () => {
      expect(() => new EncodedAudioChunk({
        type: 'invalid' as any,
        timestamp: 0,
        data: new Uint8Array([1, 2, 3, 4]),
      })).toThrow(TypeError);
    });

    it('should accept key and delta types', () => {
      const keyChunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      expect(keyChunk.type).toBe('key');

      const deltaChunk = new EncodedAudioChunk({
        type: 'delta',
        timestamp: 1000,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      expect(deltaChunk.type).toBe('delta');
    });
  });
});
```

**Step 2: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/encoded-audio-chunk.test.ts
```

Expected: FAIL on first test (no type validation)

**Step 3: Write minimal implementation** (2-5 min)

In `lib/encoded-chunks.ts`, add type validation at the start of `EncodedAudioChunk` constructor:

```typescript
constructor(init: EncodedAudioChunkInit) {
  // W3C spec: type must be 'key' or 'delta'
  if (init.type !== 'key' && init.type !== 'delta') {
    throw new TypeError(`Invalid type: ${init.type}`);
  }

  let dataBuffer: Buffer;
  // ... rest unchanged
```

**Step 4: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/encoded-audio-chunk.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit** (30 sec)

```bash
git add lib/encoded-chunks.ts test/golden/encoded-audio-chunk.test.ts
git commit -m "fix(encoded-audio-chunk): add runtime type validation"
```

---

## Task 5: EncodedVideoChunk - Add Transfer Semantics

**Files:**
- Modify: `lib/encoded-chunks.ts:22-41`
- Test: `test/golden/encoded-video-chunk-transfer.test.ts` (create)

**Step 1: Create test file with failing test** (2-5 min)

Create `test/golden/encoded-video-chunk-transfer.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

describe('EncodedVideoChunk transfer semantics', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const buffer = new ArrayBuffer(100);
    const data = new Uint8Array(buffer);
    data.fill(42);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
      transfer: [buffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    expect(buffer.byteLength).toBe(0);
    // Chunk should still have the data
    expect(chunk.byteLength).toBe(100);
  });

  it('should work without transfer option', () => {
    const buffer = new ArrayBuffer(100);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
    });

    // Buffer should NOT be detached
    expect(buffer.byteLength).toBe(100);
    expect(chunk.byteLength).toBe(100);
  });
});
```

**Step 2: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/encoded-video-chunk-transfer.test.ts
```

Expected: FAIL on first test (transfer not implemented)

**Step 3: Write minimal implementation** (2-5 min)

In `lib/encoded-chunks.ts`, add import and update `EncodedVideoChunk` constructor:

```typescript
import { detachArrayBuffers } from './transfer';

// ... in EncodedVideoChunk constructor, after creating native:
  this._native = new native.EncodedVideoChunk({
    type: init.type,
    timestamp: init.timestamp,
    duration: init.duration,
    data: dataBuffer,
  });

  // Handle ArrayBuffer transfer semantics per W3C spec
  if (init.transfer && Array.isArray(init.transfer)) {
    detachArrayBuffers(init.transfer);
  }
}
```

**Step 4: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/encoded-video-chunk-transfer.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit** (30 sec)

```bash
git add lib/encoded-chunks.ts test/golden/encoded-video-chunk-transfer.test.ts
git commit -m "feat(encoded-video-chunk): implement W3C transfer semantics"
```

---

## Task 6: EncodedAudioChunk - Add Transfer Semantics

**Files:**
- Modify: `lib/encoded-chunks.ts:82-97`
- Test: `test/golden/encoded-audio-chunk.test.ts`

**Step 1: Add transfer test to existing file** (2-5 min)

Add to `test/golden/encoded-audio-chunk.test.ts`:

```typescript
describe('transfer semantics', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const buffer = new ArrayBuffer(100);
    const data = new Uint8Array(buffer);
    data.fill(42);

    const chunk = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
      transfer: [buffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    expect(buffer.byteLength).toBe(0);
    expect(chunk.byteLength).toBe(100);
  });

  it('should work without transfer option', () => {
    const buffer = new ArrayBuffer(100);

    const chunk = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
    });

    expect(buffer.byteLength).toBe(100);
    expect(chunk.byteLength).toBe(100);
  });
});
```

**Step 2: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/encoded-audio-chunk.test.ts -t "transfer semantics"
```

Expected: FAIL on first test (transfer not implemented)

**Step 3: Write minimal implementation** (2-5 min)

In `lib/encoded-chunks.ts`, update `EncodedAudioChunk` constructor (import already added in Task 5):

```typescript
  this._native = new native.EncodedAudioChunk({
    type: init.type,
    timestamp: init.timestamp,
    duration: init.duration,
    data: dataBuffer,
  });

  // Handle ArrayBuffer transfer semantics per W3C spec
  if (init.transfer && Array.isArray(init.transfer)) {
    detachArrayBuffers(init.transfer);
  }
}
```

**Step 4: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/encoded-audio-chunk.test.ts -t "transfer semantics"
```

Expected: PASS (2 tests)

**Step 5: Commit** (30 sec)

```bash
git add lib/encoded-chunks.ts test/golden/encoded-audio-chunk.test.ts
git commit -m "feat(encoded-audio-chunk): implement W3C transfer semantics"
```

---

## Task 7: VideoEncoder - bitrateMode "quantizer" Support

**Files:**
- Modify: `src/video_encoder.cc` (Configure method)
- Test: `test/golden/video-encoder.test.ts`

**Note:** The quantizer parsing code already exists at lines 469-509. This task enables CQP mode so `frame_->quality` is respected.

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('bitrateMode=quantizer', () => {
  it('should produce smaller output with higher quantizer', async () => {
    const chunksLow: EncodedVideoChunk[] = [];
    const chunksHigh: EncodedVideoChunk[] = [];

    // Encode with low quantizer (high quality)
    const encoderLow = new VideoEncoder({
      output: (c) => chunksLow.push(c),
      error: (e) => { throw e; },
    });
    encoderLow.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrateMode: 'quantizer',
    });

    const frame1 = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: 0,
    });
    encoderLow.encode(frame1, { keyFrame: true, avc: { quantizer: 20 } } as any);
    frame1.close();
    await encoderLow.flush();
    encoderLow.close();

    // Encode with high quantizer (low quality)
    const encoderHigh = new VideoEncoder({
      output: (c) => chunksHigh.push(c),
      error: (e) => { throw e; },
    });
    encoderHigh.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrateMode: 'quantizer',
    });

    const frame2 = new VideoFrame(new Uint8Array(320 * 240 * 4), {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: 0,
    });
    encoderHigh.encode(frame2, { keyFrame: true, avc: { quantizer: 45 } } as any);
    frame2.close();
    await encoderHigh.flush();
    encoderHigh.close();

    // High quantizer = smaller output
    const sizeLow = chunksLow.reduce((s, c) => s + c.byteLength, 0);
    const sizeHigh = chunksHigh.reduce((s, c) => s + c.byteLength, 0);
    expect(sizeHigh).toBeLessThan(sizeLow);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "bitrateMode=quantizer"
```

Expected: FAIL (quantizer ignored in bitrate mode)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_encoder.cc` in the `Configure()` method, after parsing `bitrateMode`:

```cpp
// When bitrateMode = "quantizer", enable CQP mode so frame->quality is respected
std::string bitrate_mode = webcodecs::AttrAsStr(config, "bitrateMode", "variable");
if (bitrate_mode == "quantizer") {
  codec_context_->flags |= AV_CODEC_FLAG_QSCALE;
  // Don't set bit_rate - let quality control encoding
} else {
  codec_context_->bit_rate = bitrate;
}
```

**Step 4: Rebuild native addon** (30 sec)

```bash
npm run build:native
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "bitrateMode=quantizer"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(video-encoder): support bitrateMode=quantizer for CQP encoding"
```

---

## Task 8: VideoFrame - Alpha Option

**Files:**
- Modify: `src/video_frame.cc`, `src/video_frame.h`
- Test: `test/golden/video-frame-alpha.test.ts` (create)

**Step 1: Create test file with failing tests** (2-5 min)

Create `test/golden/video-frame-alpha.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

describe('VideoFrame alpha option', () => {
  it('should keep alpha by default', () => {
    const rgba = new Uint8Array(64 * 64 * 4);
    const frame = new VideoFrame(rgba, {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
    });
    expect(frame.format).toBe('RGBA');
    frame.close();
  });

  it('should discard alpha when alpha="discard"', () => {
    const rgba = new Uint8Array(64 * 64 * 4);
    const frame = new VideoFrame(rgba, {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'discard',
    });
    // Format should be non-alpha
    expect(['RGBX', 'I420', 'RGB']).toContain(frame.format);
    frame.close();
  });

  it('should be no-op for formats without alpha', () => {
    const i420Size = Math.floor(64 * 64 * 1.5);
    const i420 = new Uint8Array(i420Size);
    const frame = new VideoFrame(i420, {
      format: 'I420',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'discard',
    });
    expect(frame.format).toBe('I420');
    frame.close();
  });

  it('should throw TypeError for invalid alpha value', () => {
    expect(() => new VideoFrame(new Uint8Array(64 * 64 * 4), {
      format: 'RGBA',
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 0,
      alpha: 'invalid' as any,
    })).toThrow(TypeError);
  });
});
```

**Step 2: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/video-frame-alpha.test.ts
```

Expected: FAIL (alpha option not implemented)

**Step 3: Add helper function to video_frame.cc** (2-5 min)

```cpp
// Add near top of video_frame.cc
static AVPixelFormat GetNonAlphaEquivalent(AVPixelFormat fmt) {
  switch (fmt) {
    case AV_PIX_FMT_RGBA:     return AV_PIX_FMT_RGB0;
    case AV_PIX_FMT_BGRA:     return AV_PIX_FMT_BGR0;
    case AV_PIX_FMT_YUVA420P: return AV_PIX_FMT_YUV420P;
    case AV_PIX_FMT_YUVA422P: return AV_PIX_FMT_YUV422P;
    case AV_PIX_FMT_YUVA444P: return AV_PIX_FMT_YUV444P;
    default: return fmt;
  }
}

static bool FormatHasAlpha(AVPixelFormat fmt) {
  return fmt == AV_PIX_FMT_RGBA || fmt == AV_PIX_FMT_BGRA ||
         fmt == AV_PIX_FMT_YUVA420P || fmt == AV_PIX_FMT_YUVA422P ||
         fmt == AV_PIX_FMT_YUVA444P;
}
```

**Step 4: Add alpha handling to constructor** (2-5 min)

In the VideoFrame constructor, after parsing format:

```cpp
// Parse alpha option (default: "keep")
std::string alpha_option = webcodecs::AttrAsStr(opts, "alpha", "keep");
if (alpha_option != "keep" && alpha_option != "discard") {
  throw Napi::TypeError::New(env, "alpha must be 'keep' or 'discard'");
}

AVPixelFormat av_fmt = PixelFormatToAV(format_);
if (alpha_option == "discard" && FormatHasAlpha(av_fmt)) {
  AVPixelFormat dst_fmt = GetNonAlphaEquivalent(av_fmt);

  ffmpeg::SwsContextPtr sws(sws_getContext(
    coded_width_, coded_height_, av_fmt,
    coded_width_, coded_height_, dst_fmt,
    SWS_BILINEAR, nullptr, nullptr, nullptr
  ));

  if (!sws) {
    throw Napi::Error::New(env, "Failed to create alpha conversion context");
  }

  // Perform conversion (implementation details omitted for brevity)
  // Update format_ to non-alpha equivalent
  format_ = AVToPixelFormat(dst_fmt);
}
```

**Step 5: Rebuild native addon** (30 sec)

```bash
npm run build:native
```

**Step 6: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/video-frame-alpha.test.ts
```

Expected: PASS (4 tests)

**Step 7: Commit** (30 sec)

```bash
git add src/video_frame.cc src/video_frame.h test/golden/video-frame-alpha.test.ts
git commit -m "feat(video-frame): implement alpha option for keep/discard"
```

---

## Task 9: ImageDecoder - premultiplyAlpha Option

**Files:**
- Modify: `lib/types.ts`, `lib/image-decoder.ts`, `src/image_decoder.cc`, `src/image_decoder.h`
- Test: `test/golden/image-decoder-options.test.ts`

**Note:** FFmpeg swscale does NOT support premultiplication. Manual pixel ops required.

**Step 1: Add type definition** (2-5 min)

In `lib/types.ts`, add:

```typescript
export type PremultiplyAlpha = 'none' | 'premultiply' | 'default';
```

And update `ImageDecoderInit`:

```typescript
export interface ImageDecoderInit {
  // ... existing fields ...
  premultiplyAlpha?: PremultiplyAlpha;
}
```

**Step 2: Write failing test** (2-5 min)

Add to `test/golden/image-decoder-options.test.ts`:

```typescript
describe('premultiplyAlpha option', () => {
  it('should accept premultiplyAlpha option', async () => {
    const pngBuffer = fs.readFileSync('test/fixtures/test-image.png');

    const decoder = new ImageDecoder({
      type: 'image/png',
      data: pngBuffer,
      premultiplyAlpha: 'premultiply',
    });

    await decoder.completed;
    const result = await decoder.decode();
    expect(result.image).toBeDefined();

    result.image.close();
    decoder.close();
  });

  it('should throw TypeError for invalid value', () => {
    expect(() => new ImageDecoder({
      type: 'image/png',
      data: new Uint8Array(100),
      premultiplyAlpha: 'invalid' as any,
    })).toThrow(TypeError);
  });
});
```

**Step 3: Run tests to verify they fail** (30 sec)

```bash
npx vitest run test/golden/image-decoder-options.test.ts -t "premultiplyAlpha"
```

Expected: FAIL (option not recognized)

**Step 4: Add member to image_decoder.h** (2-5 min)

```cpp
// Add to ImageDecoder class private section
std::string premultiply_alpha_;
```

**Step 5: Add helper function to image_decoder.cc** (2-5 min)

```cpp
static void PremultiplyAlpha(uint8_t* rgba_data, int width, int height) {
  for (int i = 0; i < width * height; i++) {
    uint8_t* pixel = rgba_data + i * 4;
    uint8_t alpha = pixel[3];
    pixel[0] = (pixel[0] * alpha + 127) / 255;
    pixel[1] = (pixel[1] * alpha + 127) / 255;
    pixel[2] = (pixel[2] * alpha + 127) / 255;
  }
}
```

**Step 6: Add parsing to constructor** (2-5 min)

```cpp
premultiply_alpha_ = webcodecs::AttrAsStr(init, "premultiplyAlpha", "default");
if (premultiply_alpha_ != "none" &&
    premultiply_alpha_ != "premultiply" &&
    premultiply_alpha_ != "default") {
  throw Napi::TypeError::New(env,
    "premultiplyAlpha must be 'none', 'premultiply', or 'default'");
}
```

**Step 7: Apply in ConvertFrameToRGBA** (2-5 min)

After swscale conversion:

```cpp
if (premultiply_alpha_ == "premultiply") {
  PremultiplyAlpha(output->data(), width, height);
}
```

**Step 8: Update TypeScript to pass option** (2-5 min)

In `lib/image-decoder.ts`, add to native init:

```typescript
if ('premultiplyAlpha' in init && init.premultiplyAlpha !== undefined) {
  nativeInit.premultiplyAlpha = init.premultiplyAlpha;
}
```

**Step 9: Rebuild native addon** (30 sec)

```bash
npm run build:native
```

**Step 10: Run tests to verify they pass** (30 sec)

```bash
npx vitest run test/golden/image-decoder-options.test.ts -t "premultiplyAlpha"
```

Expected: PASS (2 tests)

**Step 11: Commit** (30 sec)

```bash
git add lib/types.ts lib/image-decoder.ts src/image_decoder.cc src/image_decoder.h test/golden/image-decoder-options.test.ts
git commit -m "feat(image-decoder): implement premultiplyAlpha option"
```

---

## Task 10: Code Review

**Step 1: Run full test suite** (2-5 min)

```bash
npm run test-all
```

Expected: All tests pass

**Step 2: Update compliance.md** (2-5 min)

Remove all closed gaps, update status columns to "Full".

**Step 3: Commit** (30 sec)

```bash
git add docs/compliance.md
git commit -m "docs: update compliance report - all gaps closed"
```

---

## Parallel Groups

| Task Group | Tasks | Files | Rationale |
|------------|-------|-------|-----------|
| Group 1 | 1, 2 | `lib/video-encoder.ts` | Same file, sequential |
| Group 2 | 3 | `lib/video-decoder.ts` | Independent |
| Group 3 | 4, 5, 6 | `lib/encoded-chunks.ts` | Same file, sequential |
| Group 4 | 7 | `src/video_encoder.cc` | Independent C++ |
| Group 5 | 8 | `src/video_frame.cc` | Independent C++ |
| Group 6 | 9 | `src/image_decoder.cc` | Independent C++ |
| Group 7 | 10 | Review | Final |

**Execution:** Groups 1-6 can run in parallel. Group 7 runs last.
