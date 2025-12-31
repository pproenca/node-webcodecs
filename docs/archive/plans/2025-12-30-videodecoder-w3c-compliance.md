# VideoDecoder W3C WebCodecs Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-videodecoder-w3c-compliance.md` to implement task-by-task.

**Goal:** Achieve full W3C WebCodecs compliance for VideoDecoder interface, ensuring perfect one-to-one match with WebCodecs IDL for code portability from browser to Node.js.

**Architecture:** The VideoDecoder has a TypeScript layer (`lib/index.ts:530-651`) wrapping a C++ native layer (`src/video_decoder.cc`). Compliance requires updates to both layers: types in `lib/types.ts`, implementation in `lib/index.ts`, native bindings in `src/video_decoder.cc`, and comprehensive tests.

**Tech Stack:** TypeScript, C++17, node-addon-api (NAPI), FFmpeg, Vitest

---

## Compliance Gap Analysis

### W3C VideoDecoder Interface (per https://www.w3.org/TR/webcodecs/#videodecoder-interface)

| Feature | W3C Spec | Current Implementation | Status |
|---------|----------|----------------------|--------|
| **Constructor** | `VideoDecoder(VideoDecoderInit init)` | Implemented | COMPLIANT |
| **state** | `readonly attribute CodecState state` | Implemented | COMPLIANT |
| **decodeQueueSize** | `readonly attribute unsigned long decodeQueueSize` | Implemented | COMPLIANT |
| **ondequeue** | `attribute EventHandler ondequeue` | Implemented via CodecBase | COMPLIANT |
| **configure()** | `undefined configure(VideoDecoderConfig config)` | Implemented | COMPLIANT |
| **decode()** | `undefined decode(EncodedVideoChunk chunk)` | Implemented | COMPLIANT |
| **flush()** | `Promise<undefined> flush()` | Implemented | COMPLIANT |
| **reset()** | `undefined reset()` | Implemented | COMPLIANT |
| **close()** | `undefined close()` | Implemented | COMPLIANT |
| **isConfigSupported()** | `static Promise<VideoDecoderSupport> isConfigSupported(VideoDecoderConfig)` | Implemented | COMPLIANT |
| **EventTarget** | Extends EventTarget | Implemented via CodecBase | COMPLIANT |

### VideoDecoderConfig Dictionary

| Field | W3C Spec | Current Implementation | Status |
|-------|----------|----------------------|--------|
| **codec** | `required DOMString codec` | Required | COMPLIANT |
| **description** | `AllowSharedBufferSource description` | Optional | COMPLIANT |
| **codedWidth** | `unsigned long codedWidth` | Optional in spec, **REQUIRED in configure()** | GAP |
| **codedHeight** | `unsigned long codedHeight` | Optional in spec, **REQUIRED in configure()** | GAP |
| **displayAspectWidth** | `unsigned long displayAspectWidth` | Type defined, **NOT USED in native** | GAP |
| **displayAspectHeight** | `unsigned long displayAspectHeight` | Type defined, **NOT USED in native** | GAP |
| **colorSpace** | `VideoColorSpaceInit colorSpace` | Type defined, **NOT PASSED to native** | GAP |
| **hardwareAcceleration** | `HardwareAcceleration = "allow"` | Type defined, **NOT IMPLEMENTED** | GAP |
| **optimizeForLatency** | `boolean optimizeForLatency` | Type defined, **NOT IMPLEMENTED** | GAP |

### Non-Standard Extensions (node-webcodecs specific)

| Field | Status | Notes |
|-------|--------|-------|
| **rotation** | Custom extension | Should be preserved but documented |
| **flip** | Custom extension | Should be preserved but documented |

### Error Handling

| Behavior | W3C Spec | Current Implementation | Status |
|----------|----------|----------------------|--------|
| **TypeError for invalid init** | Per spec | Implemented | COMPLIANT |
| **InvalidStateError for closed** | Per spec | Implemented | COMPLIANT |
| **Key frame requirement** | First chunk must be key | Implemented in TS layer | COMPLIANT |
| **NotSupportedError for unsupported codec** | Per spec | Throws generic Error | GAP |
| **DOMException usage** | Specific exception types | Uses Error in native | GAP |

---

## Implementation Tasks

### Task 1: Fix codedWidth/codedHeight to be optional in configure()

**Files:**
- Modify: `src/video_decoder.cc:115-151`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add test to `test/golden/video-decoder.test.ts`:

```typescript
describe('configure', () => {
  it('should accept config without codedWidth/codedHeight per W3C spec', async () => {
    // W3C spec: codedWidth/codedHeight are optional in VideoDecoderConfig
    // Decoder should accept config with only codec and use dimensions from bitstream
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    // This should NOT throw - per W3C spec, dimensions are optional
    expect(() => {
      decoder.configure({
        codec: 'avc1.42001e',
        // No codedWidth/codedHeight - decoder should infer from bitstream
      });
    }).not.toThrow();

    expect(decoder.state).toBe('configured');
    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should accept config without codedWidth"
```

Expected: FAIL with `config.codedWidth is required`

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.cc:135-151`, change from:

```cpp
// Parse dimensions.
if (!config.Has("codedWidth") || !config.Get("codedWidth").IsNumber()) {
  throw Napi::Error::New(env, "config.codedWidth is required");
}
if (!config.Has("codedHeight") || !config.Get("codedHeight").IsNumber()) {
  throw Napi::Error::New(env, "config.codedHeight is required");
}

coded_width_ = config.Get("codedWidth").As<Napi::Number>().Int32Value();
coded_height_ = config.Get("codedHeight").As<Napi::Number>().Int32Value();
```

To:

```cpp
// Parse dimensions (optional per W3C spec - decoder can infer from bitstream).
coded_width_ = 0;
coded_height_ = 0;
if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
  coded_width_ = config.Get("codedWidth").As<Napi::Number>().Int32Value();
  if (coded_width_ < 0 || coded_width_ > kMaxDimension) {
    throw Napi::Error::New(env, "codedWidth must be between 0 and 16384");
  }
}
if (config.Has("codedHeight") && config.Get("codedHeight").IsNumber()) {
  coded_height_ = config.Get("codedHeight").As<Napi::Number>().Int32Value();
  if (coded_height_ < 0 || coded_height_ > kMaxDimension) {
    throw Napi::Error::New(env, "codedHeight must be between 0 and 16384");
  }
}
```

Also remove explicit dimension setting in codec_context if not provided (around line 183-184):

```cpp
// Set dimensions only if provided (decoder will use bitstream dimensions otherwise).
if (coded_width_ > 0) {
  codec_context_->width = coded_width_;
}
if (coded_height_ > 0) {
  codec_context_->height = coded_height_;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should accept config without codedWidth"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): make codedWidth/codedHeight optional per W3C spec"
```

---

### Task 2: Add displayAspectWidth/displayAspectHeight support to native layer

**Files:**
- Modify: `src/video_decoder.h:69-77`
- Modify: `src/video_decoder.cc:115-264`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-decoder.test.ts`:

```typescript
it('should pass displayAspectWidth/displayAspectHeight to VideoFrame output', async () => {
  // Encode a frame first
  const encodedChunks: EncodedVideoChunk[] = [];
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      encodedChunks.push(new EncodedVideoChunk({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration ?? undefined,
        data: data,
      }));
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  });

  const frameData = new Uint8Array(320 * 240 * 4).fill(128);
  const frame = new VideoFrame(frameData, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  encoder.encode(frame, { keyFrame: true });
  await encoder.flush();
  frame.close();
  encoder.close();

  // Decode with display aspect ratio specified
  const outputFrames: VideoFrame[] = [];
  const decoder = new VideoDecoder({
    output: (outputFrame) => {
      outputFrames.push(outputFrame);
    },
    error: (e) => { throw e; },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
    displayAspectWidth: 16,
    displayAspectHeight: 9,
  });

  decoder.decode(encodedChunks[0]);
  await decoder.flush();

  expect(outputFrames.length).toBeGreaterThan(0);
  expect(outputFrames[0].displayWidth).toBe(Math.round(240 * 16 / 9)); // ~427
  expect(outputFrames[0].displayHeight).toBe(240);

  outputFrames.forEach(f => f.close());
  decoder.close();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should pass displayAspectWidth"
```

Expected: FAIL (displayWidth/displayHeight don't reflect aspect ratio)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.h`, add fields after line 77:

```cpp
// Display aspect ratio (per W3C spec).
int display_aspect_width_ = 0;
int display_aspect_height_ = 0;
```

In `src/video_decoder.cc:222`, add after flip parsing:

```cpp
// Parse optional displayAspectWidth/displayAspectHeight (per W3C spec).
display_aspect_width_ = 0;
display_aspect_height_ = 0;
if (config.Has("displayAspectWidth") && config.Get("displayAspectWidth").IsNumber()) {
  display_aspect_width_ = config.Get("displayAspectWidth").As<Napi::Number>().Int32Value();
}
if (config.Has("displayAspectHeight") && config.Get("displayAspectHeight").IsNumber()) {
  display_aspect_height_ = config.Get("displayAspectHeight").As<Napi::Number>().Int32Value();
}
```

In `src/video_decoder.cc:564-566`, update VideoFrame creation to pass display dimensions:

```cpp
// Calculate display dimensions based on aspect ratio if specified.
int display_width = frame_->width;
int display_height = frame_->height;
if (display_aspect_width_ > 0 && display_aspect_height_ > 0) {
  // Use coded height and calculate width from aspect ratio
  display_height = frame_->height;
  display_width = static_cast<int>(
      std::round(static_cast<double>(frame_->height) * display_aspect_width_ / display_aspect_height_));
}

// Create VideoFrame with rotation, flip, and display dimensions from decoder config.
Napi::Object video_frame = VideoFrame::CreateInstance(
    env, rgba_data.data(), rgba_data.size(), frame_->width, frame_->height,
    display_width, display_height, frame_->pts, "RGBA", rotation_, flip_);
```

Note: This requires updating VideoFrame::CreateInstance signature - check if it already supports displayWidth/displayHeight parameters.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should pass displayAspectWidth"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.h src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): add displayAspectWidth/displayAspectHeight support"
```

---

### Task 3: Pass colorSpace config to VideoFrame output

**Files:**
- Modify: `src/video_decoder.h`
- Modify: `src/video_decoder.cc`
- Modify: `src/video_frame.h` (if needed)
- Modify: `src/video_frame.cc` (if needed)
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
it('should pass colorSpace from config to output VideoFrame', async () => {
  // Encode frame first (same pattern as above)
  const encodedChunks: EncodedVideoChunk[] = [];
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      encodedChunks.push(new EncodedVideoChunk({
        type: chunk.type,
        timestamp: chunk.timestamp,
        data: data,
      }));
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30,
  });

  const frameData = new Uint8Array(320 * 240 * 4).fill(128);
  const frame = new VideoFrame(frameData, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
  });

  encoder.encode(frame, { keyFrame: true });
  await encoder.flush();
  frame.close();
  encoder.close();

  // Decode with colorSpace specified
  const outputFrames: VideoFrame[] = [];
  const decoder = new VideoDecoder({
    output: (outputFrame) => {
      outputFrames.push(outputFrame);
    },
    error: (e) => { throw e; },
  });

  decoder.configure({
    codec: 'avc1.42001e',
    codedWidth: 320,
    codedHeight: 240,
    colorSpace: {
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: false,
    },
  });

  decoder.decode(encodedChunks[0]);
  await decoder.flush();

  expect(outputFrames.length).toBeGreaterThan(0);
  expect(outputFrames[0].colorSpace.primaries).toBe('bt709');
  expect(outputFrames[0].colorSpace.transfer).toBe('bt709');
  expect(outputFrames[0].colorSpace.matrix).toBe('bt709');
  expect(outputFrames[0].colorSpace.fullRange).toBe(false);

  outputFrames.forEach(f => f.close());
  decoder.close();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should pass colorSpace from config"
```

Expected: FAIL (colorSpace not passed through)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.h`, add color space fields:

```cpp
// Color space config (per W3C spec).
std::string color_primaries_;
std::string color_transfer_;
std::string color_matrix_;
bool color_full_range_ = false;
bool has_color_space_ = false;
```

In `src/video_decoder.cc`, add parsing after display aspect ratio (around line 230):

```cpp
// Parse optional colorSpace (per W3C spec).
has_color_space_ = false;
if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
  Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
  has_color_space_ = true;

  if (cs.Has("primaries") && cs.Get("primaries").IsString()) {
    color_primaries_ = cs.Get("primaries").As<Napi::String>().Utf8Value();
  }
  if (cs.Has("transfer") && cs.Get("transfer").IsString()) {
    color_transfer_ = cs.Get("transfer").As<Napi::String>().Utf8Value();
  }
  if (cs.Has("matrix") && cs.Get("matrix").IsString()) {
    color_matrix_ = cs.Get("matrix").As<Napi::String>().Utf8Value();
  }
  if (cs.Has("fullRange") && cs.Get("fullRange").IsBoolean()) {
    color_full_range_ = cs.Get("fullRange").As<Napi::Boolean>().Value();
  }
}
```

In `src/video_decoder.cc:564`, pass color space to VideoFrame:

```cpp
// Build colorSpace object if configured.
Napi::Object color_space_obj = Napi::Object::New(env);
if (has_color_space_) {
  if (!color_primaries_.empty()) {
    color_space_obj.Set("primaries", color_primaries_);
  }
  if (!color_transfer_.empty()) {
    color_space_obj.Set("transfer", color_transfer_);
  }
  if (!color_matrix_.empty()) {
    color_space_obj.Set("matrix", color_matrix_);
  }
  color_space_obj.Set("fullRange", color_full_range_);
}

// Create VideoFrame with all config parameters.
Napi::Object video_frame = VideoFrame::CreateInstanceWithColorSpace(
    env, rgba_data.data(), rgba_data.size(), frame_->width, frame_->height,
    display_width, display_height, frame_->pts, "RGBA", rotation_, flip_,
    has_color_space_ ? color_space_obj : env.Null());
```

Note: May need to add CreateInstanceWithColorSpace method to VideoFrame or extend existing CreateInstance.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "should pass colorSpace from config"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.h src/video_decoder.cc src/video_frame.h src/video_frame.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): pass colorSpace config to VideoFrame output"
```

---

### Task 4: Add optimizeForLatency support

**Files:**
- Modify: `src/video_decoder.h`
- Modify: `src/video_decoder.cc`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
describe('optimizeForLatency', () => {
  it('should accept optimizeForLatency config', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    // Should accept optimizeForLatency without error
    expect(() => {
      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
        optimizeForLatency: true,
      });
    }).not.toThrow();

    expect(decoder.state).toBe('configured');
    decoder.close();
  });

  it('should include optimizeForLatency in isConfigSupported result', async () => {
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.42001e',
      optimizeForLatency: true,
    });

    expect(result.supported).toBe(true);
    expect(result.config.optimizeForLatency).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "optimizeForLatency"
```

Expected: PASS (config is accepted, but verify optimizeForLatency is actually used)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.h`, add field:

```cpp
bool optimize_for_latency_ = false;
```

In `src/video_decoder.cc:configure`, parse after colorSpace:

```cpp
// Parse optional optimizeForLatency (per W3C spec).
optimize_for_latency_ = false;
if (config.Has("optimizeForLatency") && config.Get("optimizeForLatency").IsBoolean()) {
  optimize_for_latency_ = config.Get("optimizeForLatency").As<Napi::Boolean>().Value();
}
```

Apply to FFmpeg if true (before avcodec_open2):

```cpp
// Apply latency optimization if requested.
if (optimize_for_latency_) {
  codec_context_->flags |= AV_CODEC_FLAG_LOW_DELAY;
  codec_context_->flags2 |= AV_CODEC_FLAG2_FAST;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "optimizeForLatency"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.h src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): implement optimizeForLatency config option"
```

---

### Task 5: Improve error handling with proper DOMException types

**Files:**
- Modify: `src/video_decoder.cc`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
describe('W3C error handling', () => {
  it('should throw NotSupportedError for unsupported codec', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'unsupported-codec-xyz',
        codedWidth: 320,
        codedHeight: 240,
      });
    }).toThrow(/NotSupportedError/);

    decoder.close();
  });

  it('should throw TypeError for invalid config structure', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({} as any);
    }).toThrow(TypeError);

    decoder.close();
  });

  it('should throw InvalidStateError when configuring closed decoder', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    decoder.close();

    expect(() => {
      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });
    }).toThrow(/InvalidStateError/);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "W3C error handling"
```

Expected: FAIL (errors don't include proper DOMException type names)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.cc`, update error throws to use proper format:

Change line 118-121:
```cpp
if (state_ == "closed") {
  Napi::Error err = Napi::Error::New(env, "InvalidStateError: Cannot configure a closed decoder");
  err.Set("name", Napi::String::New(env, "InvalidStateError"));
  throw err;
}
```

Change line 130-132 (missing codec):
```cpp
if (!config.Has("codec") || !config.Get("codec").IsString()) {
  Napi::TypeError err = Napi::TypeError::New(env, "config.codec is required");
  throw err;
}
```

Change line 166-168 (unsupported codec):
```cpp
} else {
  Napi::Error err = Napi::Error::New(env, "NotSupportedError: Unsupported codec: " + codec_str);
  err.Set("name", Napi::String::New(env, "NotSupportedError"));
  throw err;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "W3C error handling"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "fix(VideoDecoder): use W3C-compliant DOMException error types"
```

---

### Task 6: Add hardwareAcceleration config (stub implementation)

**Files:**
- Modify: `src/video_decoder.cc`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
describe('hardwareAcceleration', () => {
  it('should accept hardwareAcceleration config values', async () => {
    for (const value of ['allow', 'deny', 'prefer']) {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
        hardwareAcceleration: value as HardwareAcceleration,
      });

      expect(result.supported).toBe(true);
      expect(result.config.hardwareAcceleration).toBe(value);
    }
  });

  it('should configure with hardwareAcceleration', () => {
    const decoder = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
        hardwareAcceleration: 'prefer',
      });
    }).not.toThrow();

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "hardwareAcceleration"
```

Expected: PASS (already accepted but not validated)

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_decoder.cc:configure`, add validation:

```cpp
// Parse optional hardwareAcceleration (per W3C spec).
// Note: This implementation uses software decoding via FFmpeg.
// Hardware acceleration would require platform-specific implementations.
if (config.Has("hardwareAcceleration") && config.Get("hardwareAcceleration").IsString()) {
  std::string hw_accel = config.Get("hardwareAcceleration").As<Napi::String>().Utf8Value();
  if (hw_accel != "allow" && hw_accel != "deny" && hw_accel != "prefer") {
    Napi::TypeError err = Napi::TypeError::New(env,
        "hardwareAcceleration must be 'allow', 'deny', or 'prefer'");
    throw err;
  }
  // Note: Currently using software decoding. Hardware acceleration not implemented.
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "hardwareAcceleration"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): validate hardwareAcceleration config values"
```

---

### Task 7: Document non-standard extensions (rotation, flip)

**Files:**
- Modify: `lib/types.ts:537-549`
- Test: `test/golden/video-decoder.test.ts`

**Step 1: Write the test for extension behavior** (2-5 min)

```typescript
describe('node-webcodecs extensions', () => {
  it('should support rotation config (non-standard extension)', async () => {
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.42001e',
      rotation: 90,
    });

    expect(result.supported).toBe(true);
    expect(result.config.rotation).toBe(90);
  });

  it('should support flip config (non-standard extension)', async () => {
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.42001e',
      flip: true,
    });

    expect(result.supported).toBe(true);
    expect(result.config.flip).toBe(true);
  });

  it('should reject invalid rotation values', async () => {
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.42001e',
      rotation: 45, // Invalid - must be 0, 90, 180, or 270
    });

    expect(result.supported).toBe(false);
  });
});
```

**Step 2: Run test to verify behavior** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts -t "node-webcodecs extensions"
```

Expected: PASS (extensions already work)

**Step 3: Update type documentation** (2-5 min)

In `lib/types.ts:537-549`, update comments:

```typescript
export interface VideoDecoderConfig {
  codec: string;
  description?: AllowSharedBufferSource;
  codedWidth?: number; // unsigned long
  codedHeight?: number; // unsigned long
  displayAspectWidth?: number; // unsigned long
  displayAspectHeight?: number; // unsigned long
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
  /**
   * NON-STANDARD EXTENSION (node-webcodecs specific)
   * Rotation in degrees. Must be 0, 90, 180, or 270.
   * Applied to decoded VideoFrames.
   */
  rotation?: number;
  /**
   * NON-STANDARD EXTENSION (node-webcodecs specific)
   * Horizontal flip. Applied to decoded VideoFrames.
   */
  flip?: boolean;
}
```

**Step 4: Run tests to verify no regression** (30 sec)

```bash
npx vitest run test/golden/video-decoder.test.ts
```

Expected: All PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/video-decoder.test.ts
git commit -m "docs(VideoDecoderConfig): document non-standard rotation/flip extensions"
```

---

### Task 8: Comprehensive W3C compliance test suite

**Files:**
- Create: `test/golden/video-decoder-w3c-compliance.test.ts`

**Step 1: Create comprehensive test file** (5-10 min)

```typescript
/**
 * W3C WebCodecs VideoDecoder Compliance Tests
 * Based on https://www.w3.org/TR/webcodecs/#videodecoder-interface
 */

import { beforeEach, afterEach, expect, it, describe } from 'vitest';

describe('VideoDecoder W3C Compliance', () => {
  describe('Interface Definition', () => {
    it('should have all required methods', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // W3C required methods
      expect(typeof decoder.configure).toBe('function');
      expect(typeof decoder.decode).toBe('function');
      expect(typeof decoder.flush).toBe('function');
      expect(typeof decoder.reset).toBe('function');
      expect(typeof decoder.close).toBe('function');

      decoder.close();
    });

    it('should have all required readonly properties', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // W3C required properties
      expect(decoder.state).toBeDefined();
      expect(decoder.decodeQueueSize).toBeDefined();

      // Verify readonly (TypeScript enforces, but verify at runtime)
      const stateDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(decoder),
        'state'
      );
      expect(stateDescriptor?.set).toBeUndefined();

      decoder.close();
    });

    it('should have ondequeue event handler', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      expect(decoder.ondequeue).toBe(null);

      let called = false;
      decoder.ondequeue = () => { called = true; };
      expect(decoder.ondequeue).toBeDefined();

      decoder.close();
    });

    it('should extend EventTarget', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      expect(typeof decoder.addEventListener).toBe('function');
      expect(typeof decoder.removeEventListener).toBe('function');
      expect(typeof decoder.dispatchEvent).toBe('function');

      decoder.close();
    });

    it('should have static isConfigSupported method', () => {
      expect(typeof VideoDecoder.isConfigSupported).toBe('function');
    });
  });

  describe('CodecState', () => {
    it('should start in "unconfigured" state', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      expect(decoder.state).toBe('unconfigured');
      decoder.close();
    });

    it('should transition to "configured" after configure()', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      expect(decoder.state).toBe('configured');
      decoder.close();
    });

    it('should transition to "closed" after close()', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();
      expect(decoder.state).toBe('closed');
    });

    it('should transition to "unconfigured" after reset()', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      expect(decoder.state).toBe('configured');

      decoder.reset();
      expect(decoder.state).toBe('unconfigured');

      decoder.close();
    });
  });

  describe('VideoDecoderInit', () => {
    it('should require output callback', () => {
      expect(() => {
        new VideoDecoder({ error: () => {} } as any);
      }).toThrow(TypeError);
    });

    it('should require error callback', () => {
      expect(() => {
        new VideoDecoder({ output: () => {} } as any);
      }).toThrow(TypeError);
    });
  });

  describe('VideoDecoderConfig', () => {
    it('should require codec string', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        decoder.configure({} as any);
      }).toThrow();

      decoder.close();
    });

    it('should accept all optional W3C config fields', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });

      // All W3C optional fields
      expect(() => {
        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: 320,
          codedHeight: 240,
          displayAspectWidth: 16,
          displayAspectHeight: 9,
          colorSpace: {
            primaries: 'bt709',
            transfer: 'bt709',
            matrix: 'bt709',
            fullRange: false,
          },
          hardwareAcceleration: 'allow',
          optimizeForLatency: true,
        });
      }).not.toThrow();

      decoder.close();
    });
  });

  describe('VideoDecoderSupport', () => {
    it('should return supported and config fields', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001e',
      });

      expect(typeof result.supported).toBe('boolean');
      expect(result.config).toBeDefined();
      expect(result.config.codec).toBe('avc1.42001e');
    });
  });

  describe('Key Frame Requirement', () => {
    it('should require first chunk after configure to be key frame', async () => {
      const errors: DOMException[] = [];
      const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => { errors.push(e); },
      });

      decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: 320,
        codedHeight: 240,
      });

      // Create a delta frame (not key frame)
      const deltaChunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      decoder.decode(deltaChunk);

      // Should have received DataError
      expect(errors.length).toBe(1);
      expect(errors[0].name).toBe('DataError');

      decoder.close();
    });
  });
});
```

**Step 2: Run compliance test suite** (30 sec)

```bash
npx vitest run test/golden/video-decoder-w3c-compliance.test.ts
```

Expected: PASS (all W3C compliance tests pass)

**Step 3: Commit** (30 sec)

```bash
git add test/golden/video-decoder-w3c-compliance.test.ts
git commit -m "test(VideoDecoder): add comprehensive W3C compliance test suite"
```

---

### Task 9: Code Review

**Files:** All modified files from Tasks 1-8

**Step 1: Review all changes** (5-10 min)

Run code review to verify:
- All W3C spec requirements are met
- No regressions in existing functionality
- Type definitions match WebIDL exactly
- Error handling uses proper DOMException types
- Tests cover all compliance requirements

**Step 2: Run full test suite** (1-2 min)

```bash
npm test
```

Expected: All tests PASS

**Step 3: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 4: Final commit if needed** (30 sec)

```bash
git add -A
git commit -m "chore: final cleanup for VideoDecoder W3C compliance"
```

---

## Parallel Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 4, 6 | Independent config field changes, no file overlap |
| Group 2 | 2, 3 | Both modify VideoFrame creation in video_decoder.cc |
| Group 3 | 5, 7 | Independent error handling and documentation |
| Group 4 | 8 | Test suite depends on all implementation tasks |
| Group 5 | 9 | Code review after all tasks complete |

## Summary of Changes

1. **codedWidth/codedHeight** - Made optional per W3C spec (currently required)
2. **displayAspectWidth/displayAspectHeight** - Pass to VideoFrame output
3. **colorSpace** - Pass config to VideoFrame output
4. **optimizeForLatency** - Apply low-latency FFmpeg flags
5. **Error handling** - Use proper DOMException types (NotSupportedError, InvalidStateError)
6. **hardwareAcceleration** - Validate config values (stub implementation)
7. **rotation/flip** - Document as non-standard extensions
8. **Test suite** - Comprehensive W3C compliance tests
