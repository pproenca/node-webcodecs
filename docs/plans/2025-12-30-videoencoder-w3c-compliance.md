# VideoEncoder W3C WebCodecs Full Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-videoencoder-w3c-compliance.md` to implement task-by-task.

**Goal:** Achieve full W3C WebCodecs VideoEncoder interface compliance so that code can be ported one-to-one from browser WebCodecs to node-webcodecs.

**Architecture:** The implementation follows the existing layered architecture:
- TypeScript layer (`lib/index.ts`, `lib/types.ts`) handles W3C-compliant API surface and state machine
- Native C++ layer (`src/video_encoder.cc`) wraps FFmpeg and handles actual encoding
- All config properties must flow through both layers and be echoed correctly in `isConfigSupported`

**Tech Stack:** TypeScript, Node.js, N-API (node-addon-api), FFmpeg (libavcodec, libswscale)

---

## Gap Analysis Summary

### W3C VideoEncoderConfig (spec vs implementation)

| Property | W3C Spec | Current Status | Action |
|----------|----------|----------------|--------|
| `codec` | required DOMString | ✅ Implemented | None |
| `width` | required unsigned long | ✅ Implemented | None |
| `height` | required unsigned long | ✅ Implemented | None |
| `displayWidth` | unsigned long | ⚠️ TS validates, C++ ignores, not echoed | Echo in isConfigSupported |
| `displayHeight` | unsigned long | ⚠️ TS validates, C++ ignores, not echoed | Echo in isConfigSupported |
| `bitrate` | unsigned long long | ✅ Implemented | None |
| `framerate` | double | ✅ Implemented | None |
| `hardwareAcceleration` | HardwareAcceleration | ✅ Echoed | None |
| `alpha` | AlphaOption | ❌ Not implemented | Add echo + future impl |
| `scalabilityMode` | DOMString | ❌ Not implemented | Add echo + future impl |
| `bitrateMode` | VideoEncoderBitrateMode | ✅ Echoed | None |
| `latencyMode` | LatencyMode | ✅ Echoed | None |
| `contentHint` | DOMString | ❌ Not echoed | Add echo |
| `colorSpace` | VideoColorSpaceInit | ❌ Not implemented | Add implementation |

### W3C EncodedVideoChunkMetadata (spec vs implementation)

| Property | W3C Spec | Current Status | Action |
|----------|----------|----------------|--------|
| `decoderConfig` | VideoDecoderConfig | ⚠️ Partial (codec, codedWidth, codedHeight, description) | Add missing properties |
| `svc` | SvcOutputMetadata | ⚠️ Structure exists, not populated | Implement |
| `alphaSideData` | BufferSource | ❌ Not implemented | Add for alpha support |

### W3C isConfigSupported Echo Requirements

Per spec, `isConfigSupported` must return a `VideoEncoderSupport` with `config` that echoes all valid input properties. Currently missing:
- `displayWidth` / `displayHeight`
- `alpha`
- `scalabilityMode`
- `contentHint`

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Independent echo fixes in C++ layer, no file overlap |
| Group 2 | 3 | Config validation depends on echoing being complete |
| Group 3 | 4, 5 | Metadata improvements, independent files |
| Group 4 | 6 | colorSpace in config requires metadata + config changes |
| Group 5 | 7 | Integration tests depend on all features |
| Group 6 | 8 | Code Review (always final) |

---

### Task 1: Echo displayWidth/displayHeight in isConfigSupported

**Files:**
- Modify: `src/video_encoder.cc:549-554`
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts` inside the `isConfigSupported` describe block:

```typescript
it('should echo displayWidth and displayHeight in config', async () => {
  const result = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width: 1920,
    height: 1080,
    displayWidth: 1920,
    displayHeight: 1080,
  });
  expect(result.supported).toBe(true);
  expect(result.config.displayWidth).toBe(1920);
  expect(result.config.displayHeight).toBe(1080);
});

it('should echo displayWidth and displayHeight when different from coded dimensions', async () => {
  const result = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width: 1920,
    height: 1080,
    displayWidth: 1280,
    displayHeight: 720,
  });
  expect(result.supported).toBe(true);
  expect(result.config.displayWidth).toBe(1280);
  expect(result.config.displayHeight).toBe(720);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "echo displayWidth"
```

Expected: FAIL with `expected 1920 to be undefined` or similar

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_encoder.cc`, find the `IsConfigSupported` function around line 549-554 and add after the existing optional property copies:

```cpp
// Copy displayWidth and displayHeight if present (per W3C spec echo requirement)
if (config.Has("displayWidth") && config.Get("displayWidth").IsNumber()) {
  normalized_config.Set("displayWidth", config.Get("displayWidth"));
}
if (config.Has("displayHeight") && config.Get("displayHeight").IsNumber()) {
  normalized_config.Set("displayHeight", config.Get("displayHeight"));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-encoder.test.ts -t "echo displayWidth"
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): echo displayWidth/displayHeight in isConfigSupported"
```

---

### Task 2: Echo alpha, scalabilityMode, contentHint in isConfigSupported

**Files:**
- Modify: `src/video_encoder.cc:549-570`
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts` inside the `isConfigSupported` describe block:

```typescript
it('should echo alpha option in config', async () => {
  const result = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width: 640,
    height: 480,
    alpha: 'discard',
  });
  expect(result.supported).toBe(true);
  expect(result.config.alpha).toBe('discard');
});

it('should echo scalabilityMode in config', async () => {
  const result = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width: 640,
    height: 480,
    scalabilityMode: 'L1T2',
  });
  expect(result.supported).toBe(true);
  expect(result.config.scalabilityMode).toBe('L1T2');
});

it('should echo contentHint in config', async () => {
  const result = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42E01E',
    width: 640,
    height: 480,
    contentHint: 'motion',
  });
  expect(result.supported).toBe(true);
  expect(result.config.contentHint).toBe('motion');
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "echo alpha"
```

Expected: FAIL with `expected 'discard' to be undefined`

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_encoder.cc`, in the `IsConfigSupported` function, add after the latencyMode/bitrateMode copies:

```cpp
// Echo alpha option per W3C spec
if (config.Has("alpha") && config.Get("alpha").IsString()) {
  normalized_config.Set("alpha", config.Get("alpha"));
}
// Echo scalabilityMode per W3C spec
if (config.Has("scalabilityMode") && config.Get("scalabilityMode").IsString()) {
  normalized_config.Set("scalabilityMode", config.Get("scalabilityMode"));
}
// Echo contentHint per W3C spec
if (config.Has("contentHint") && config.Get("contentHint").IsString()) {
  normalized_config.Set("contentHint", config.Get("contentHint"));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-encoder.test.ts -t "echo alpha" && npx vitest run test/golden/video-encoder.test.ts -t "echo scalabilityMode" && npx vitest run test/golden/video-encoder.test.ts -t "echo contentHint"
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): echo alpha, scalabilityMode, contentHint in isConfigSupported"
```

---

### Task 3: Validate displayWidth/displayHeight pairing in configure

**Files:**
- Modify: `lib/index.ts:404-412` (already implemented, verify with test)
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts` inside a new `configure validation` describe block:

```typescript
describe('configure validation', () => {
  it('should throw TypeError if displayWidth provided without displayHeight', () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        displayWidth: 640,
        // displayHeight intentionally omitted
      });
    }).toThrow(TypeError);

    encoder.close();
  });

  it('should throw TypeError if displayHeight provided without displayWidth', () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        // displayWidth intentionally omitted
        displayHeight: 480,
      });
    }).toThrow(TypeError);

    encoder.close();
  });

  it('should accept config with both displayWidth and displayHeight', () => {
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        displayWidth: 640,
        displayHeight: 480,
      });
    }).not.toThrow();

    encoder.close();
  });
});
```

**Step 2: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "configure validation"
```

Expected: PASS (3 passed) - This validation already exists in `lib/index.ts:404-412`

**Step 3: Skip implementation** (already done)

The validation already exists at `lib/index.ts:404-412`:
```typescript
if (
  (config.displayWidth !== undefined) !==
  (config.displayHeight !== undefined)
) {
  throw new TypeError(
    'displayWidth and displayHeight must both be present or both absent',
  );
}
```

**Step 4: Commit** (30 sec)

```bash
git add test/golden/video-encoder.test.ts
git commit -m "test(VideoEncoder): add configure validation tests for displayWidth/displayHeight pairing"
```

---

### Task 4: Add complete decoderConfig to EncodedVideoChunkMetadata

**Files:**
- Modify: `src/video_encoder.cc:450-461`
- Modify: `lib/native-types.ts:232-239`
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('EncodedVideoChunkMetadata', () => {
  it('should include complete decoderConfig on first keyframe', async () => {
    const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push({chunk, metadata});
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
      displayWidth: 800,
      displayHeight: 600,
    });

    const frame = new VideoFrame(
      new Uint8Array(640 * 480 * 4),
      {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
      }
    );

    encoder.encode(frame, {keyFrame: true});
    frame.close();

    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);

    const keyframeChunk = chunks.find(c => c.chunk.type === 'key');
    expect(keyframeChunk).toBeDefined();
    expect(keyframeChunk?.metadata?.decoderConfig).toBeDefined();
    expect(keyframeChunk?.metadata?.decoderConfig?.codec).toContain('avc1');
    expect(keyframeChunk?.metadata?.decoderConfig?.codedWidth).toBe(640);
    expect(keyframeChunk?.metadata?.decoderConfig?.codedHeight).toBe(480);
    // These are the new properties we're adding:
    expect(keyframeChunk?.metadata?.decoderConfig?.displayAspectWidth).toBe(800);
    expect(keyframeChunk?.metadata?.decoderConfig?.displayAspectHeight).toBe(600);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "complete decoderConfig"
```

Expected: FAIL with `expected undefined to be 800`

**Step 3: Write minimal implementation** (2-5 min)

First, update `lib/native-types.ts` to include the new metadata properties. Around line 232-239, update the `VideoEncoderOutputCallback` type:

```typescript
export type VideoEncoderOutputCallback = (
  chunk: {
    type: string;
    timestamp: number;
    duration: number | null;
    data: Buffer;
    byteLength: number;
  },
  metadata?: {
    decoderConfig?: {
      codec: string;
      codedWidth?: number;
      codedHeight?: number;
      displayAspectWidth?: number;
      displayAspectHeight?: number;
      description?: ArrayBuffer;
      colorSpace?: VideoColorSpaceInit;
    };
    svc?: {temporalLayerId: number};
    alphaSideData?: ArrayBuffer;
  },
) => void;
```

Then, in `src/video_encoder.cc`, modify the `EmitChunks` function to store and pass display dimensions. First, add member variables to store display dimensions in the header file `src/video_encoder.h`:

```cpp
// In the private section, add:
int display_width_;
int display_height_;
```

Then in `src/video_encoder.cc`, in `Configure`, store the display dimensions:

```cpp
// After parsing width/height, add:
display_width_ = width_;  // default to coded dimensions
display_height_ = height_;
if (config.Has("displayWidth") && config.Get("displayWidth").IsNumber()) {
  display_width_ = config.Get("displayWidth").As<Napi::Number>().Int32Value();
}
if (config.Has("displayHeight") && config.Get("displayHeight").IsNumber()) {
  display_height_ = config.Get("displayHeight").As<Napi::Number>().Int32Value();
}
```

Finally, in `EmitChunks`, when creating metadata for keyframes, include displayAspectWidth/Height:

```cpp
// In EmitChunks, modify metadata creation for keyframes:
if (packet_->flags & AV_PKT_FLAG_KEY) {
  Napi::Object metadata = Napi::Object::New(env);
  Napi::Object decoder_config = Napi::Object::New(env);

  // Get codec string
  std::string codec_str = "avc1.42E01E";  // Default H.264 baseline
  // ... (existing codec detection code)

  decoder_config.Set("codec", codec_str);
  decoder_config.Set("codedWidth", Napi::Number::New(env, width_));
  decoder_config.Set("codedHeight", Napi::Number::New(env, height_));
  decoder_config.Set("displayAspectWidth", Napi::Number::New(env, display_width_));
  decoder_config.Set("displayAspectHeight", Napi::Number::New(env, display_height_));

  // Add description (extradata) if available
  if (codec_context_->extradata && codec_context_->extradata_size > 0) {
    decoder_config.Set("description",
        Napi::Buffer<uint8_t>::Copy(env, codec_context_->extradata,
                                    codec_context_->extradata_size));
  }

  metadata.Set("decoderConfig", decoder_config);
  output_callback_.Call({chunk, metadata});
} else {
  output_callback_.Call({chunk, env.Null()});
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-encoder.test.ts -t "complete decoderConfig"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.h src/video_encoder.cc lib/native-types.ts test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): add displayAspectWidth/Height to decoderConfig metadata"
```

---

### Task 5: Add SvcOutputMetadata support for temporal layers

**Files:**
- Modify: `src/video_encoder.cc:450-470` (in EmitChunks)
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts` inside the `EncodedVideoChunkMetadata` describe block:

```typescript
it('should include svc metadata with temporalLayerId', async () => {
  const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push({chunk, metadata});
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500_000,
  });

  // Encode a few frames
  for (let i = 0; i < 3; i++) {
    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      }
    );
    encoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await encoder.flush();
  encoder.close();

  expect(chunks.length).toBeGreaterThan(0);

  // Each chunk should have svc metadata
  for (const {metadata} of chunks) {
    if (metadata?.svc) {
      expect(typeof metadata.svc.temporalLayerId).toBe('number');
      expect(metadata.svc.temporalLayerId).toBeGreaterThanOrEqual(0);
    }
  }
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "svc metadata"
```

Expected: May pass (if metadata.svc is undefined, the loop body doesn't execute) - adjust test:

```typescript
// Better test that actually checks svc is present
const keyframeChunk = chunks.find(c => c.chunk.type === 'key');
expect(keyframeChunk?.metadata?.svc).toBeDefined();
expect(keyframeChunk?.metadata?.svc?.temporalLayerId).toBe(0);
```

**Step 3: Write minimal implementation** (2-5 min)

In `src/video_encoder.cc`, modify the `EmitChunks` function to always include svc metadata:

```cpp
// In EmitChunks, after creating chunk object:
Napi::Object metadata = Napi::Object::New(env);

// SVC metadata - for now, always report layer 0 (base layer)
// Future: implement actual temporal/spatial layer tracking
Napi::Object svc = Napi::Object::New(env);
svc.Set("temporalLayerId", Napi::Number::New(env, 0));
metadata.Set("svc", svc);

// Add decoderConfig for keyframes
if (packet_->flags & AV_PKT_FLAG_KEY) {
  Napi::Object decoder_config = Napi::Object::New(env);
  // ... (existing decoderConfig code)
  metadata.Set("decoderConfig", decoder_config);
}

output_callback_.Call({chunk, metadata});
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-encoder.test.ts -t "svc metadata"
```

Expected: PASS (1 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): add SvcOutputMetadata with temporalLayerId"
```

---

### Task 6: Add colorSpace support in VideoEncoderConfig and metadata

**Files:**
- Modify: `src/video_encoder.cc:104-217` (Configure) and `EmitChunks`
- Modify: `src/video_encoder.h`
- Test: `test/golden/video-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('colorSpace support', () => {
  it('should echo colorSpace in isConfigSupported', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      },
    });
    expect(result.supported).toBe(true);
    expect(result.config.colorSpace).toBeDefined();
    expect(result.config.colorSpace?.primaries).toBe('bt709');
    expect(result.config.colorSpace?.transfer).toBe('bt709');
    expect(result.config.colorSpace?.matrix).toBe('bt709');
    expect(result.config.colorSpace?.fullRange).toBe(false);
  });

  it('should include colorSpace in decoderConfig metadata', async () => {
    const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push({chunk, metadata});
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42E01E',
      width: 320,
      height: 240,
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      },
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

    encoder.encode(frame, {keyFrame: true});
    frame.close();

    await encoder.flush();
    encoder.close();

    const keyframe = chunks.find(c => c.chunk.type === 'key');
    expect(keyframe?.metadata?.decoderConfig?.colorSpace).toBeDefined();
    expect(keyframe?.metadata?.decoderConfig?.colorSpace?.primaries).toBe('bt709');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "colorSpace"
```

Expected: FAIL with `expected undefined to be 'bt709'`

**Step 3: Write minimal implementation** (5-10 min)

First, add color space storage in `src/video_encoder.h`:

```cpp
// In private section:
std::string color_primaries_;
std::string color_transfer_;
std::string color_matrix_;
bool color_full_range_;
```

Then in `src/video_encoder.cc`, in `Configure`:

```cpp
// After parsing display dimensions, parse colorSpace
color_primaries_ = "";
color_transfer_ = "";
color_matrix_ = "";
color_full_range_ = false;

if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
  Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
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

In `IsConfigSupported`, add colorSpace echoing:

```cpp
// Echo colorSpace per W3C spec
if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
  Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
  Napi::Object cs_copy = Napi::Object::New(env);
  if (cs.Has("primaries")) cs_copy.Set("primaries", cs.Get("primaries"));
  if (cs.Has("transfer")) cs_copy.Set("transfer", cs.Get("transfer"));
  if (cs.Has("matrix")) cs_copy.Set("matrix", cs.Get("matrix"));
  if (cs.Has("fullRange")) cs_copy.Set("fullRange", cs.Get("fullRange"));
  normalized_config.Set("colorSpace", cs_copy);
}
```

In `EmitChunks`, add colorSpace to decoderConfig:

```cpp
// In EmitChunks, when building decoderConfig:
if (!color_primaries_.empty() || !color_transfer_.empty() ||
    !color_matrix_.empty()) {
  Napi::Object color_space = Napi::Object::New(env);
  if (!color_primaries_.empty()) {
    color_space.Set("primaries", color_primaries_);
  }
  if (!color_transfer_.empty()) {
    color_space.Set("transfer", color_transfer_);
  }
  if (!color_matrix_.empty()) {
    color_space.Set("matrix", color_matrix_);
  }
  color_space.Set("fullRange", color_full_range_);
  decoder_config.Set("colorSpace", color_space);
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/video-encoder.test.ts -t "colorSpace"
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.h src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): add colorSpace support in config and metadata"
```

---

### Task 7: Add comprehensive W3C compliance integration test

**Files:**
- Create: `test/golden/video-encoder-w3c-compliance.test.ts`

**Step 1: Write the test** (5-10 min)

Create comprehensive test file `test/golden/video-encoder-w3c-compliance.test.ts`:

```typescript
/**
 * W3C WebCodecs VideoEncoder Interface Compliance Tests
 * Tests for full compliance with https://www.w3.org/TR/webcodecs/#videoencoder-interface
 */

import {describe, it, expect, beforeEach, afterEach} from 'vitest';

describe('W3C VideoEncoder Interface Compliance', () => {
  describe('VideoEncoderInit', () => {
    it('should require output callback per W3C spec', () => {
      expect(() => new VideoEncoder({} as any)).toThrow(TypeError);
    });

    it('should require error callback per W3C spec', () => {
      expect(() => new VideoEncoder({output: () => {}} as any)).toThrow(TypeError);
    });
  });

  describe('VideoEncoder properties', () => {
    let encoder: VideoEncoder;

    beforeEach(() => {
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    });

    it('should have state property (CodecState)', () => {
      expect(['unconfigured', 'configured', 'closed']).toContain(encoder.state);
    });

    it('should have encodeQueueSize property (unsigned long)', () => {
      expect(typeof encoder.encodeQueueSize).toBe('number');
      expect(encoder.encodeQueueSize).toBeGreaterThanOrEqual(0);
    });

    it('should support ondequeue event handler', () => {
      expect(encoder.ondequeue).toBeNull();
      const handler = () => {};
      encoder.ondequeue = handler;
      expect(encoder.ondequeue).toBe(handler);
    });

    it('should extend EventTarget', () => {
      expect(encoder).toBeInstanceOf(EventTarget);
      expect(typeof encoder.addEventListener).toBe('function');
      expect(typeof encoder.removeEventListener).toBe('function');
      expect(typeof encoder.dispatchEvent).toBe('function');
    });
  });

  describe('VideoEncoderConfig complete echo', () => {
    const fullConfig: VideoEncoderConfig = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      bitrate: 5_000_000,
      framerate: 30,
      hardwareAcceleration: 'no-preference',
      alpha: 'discard',
      scalabilityMode: 'L1T1',
      bitrateMode: 'variable',
      latencyMode: 'quality',
      contentHint: 'detail',
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      },
    };

    it('should echo all VideoEncoderConfig properties in isConfigSupported', async () => {
      const result = await VideoEncoder.isConfigSupported(fullConfig);

      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe(fullConfig.codec);
      expect(result.config.width).toBe(fullConfig.width);
      expect(result.config.height).toBe(fullConfig.height);
      expect(result.config.displayWidth).toBe(fullConfig.displayWidth);
      expect(result.config.displayHeight).toBe(fullConfig.displayHeight);
      expect(result.config.bitrate).toBe(fullConfig.bitrate);
      expect(result.config.framerate).toBe(fullConfig.framerate);
      expect(result.config.hardwareAcceleration).toBe(fullConfig.hardwareAcceleration);
      expect(result.config.alpha).toBe(fullConfig.alpha);
      expect(result.config.scalabilityMode).toBe(fullConfig.scalabilityMode);
      expect(result.config.bitrateMode).toBe(fullConfig.bitrateMode);
      expect(result.config.latencyMode).toBe(fullConfig.latencyMode);
      expect(result.config.contentHint).toBe(fullConfig.contentHint);
      expect(result.config.colorSpace?.primaries).toBe(fullConfig.colorSpace?.primaries);
      expect(result.config.colorSpace?.transfer).toBe(fullConfig.colorSpace?.transfer);
      expect(result.config.colorSpace?.matrix).toBe(fullConfig.colorSpace?.matrix);
      expect(result.config.colorSpace?.fullRange).toBe(fullConfig.colorSpace?.fullRange);
    });
  });

  describe('EncodedVideoChunkMetadata compliance', () => {
    it('should provide complete decoderConfig on keyframes', async () => {
      const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => chunks.push({chunk, metadata}),
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        displayWidth: 800,
        displayHeight: 600,
        colorSpace: {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: false,
        },
      });

      const frame = new VideoFrame(
        new Uint8Array(640 * 480 * 4),
        {format: 'RGBA', codedWidth: 640, codedHeight: 480, timestamp: 0}
      );
      encoder.encode(frame, {keyFrame: true});
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find(c => c.chunk.type === 'key');
      expect(keyframe).toBeDefined();

      const dc = keyframe?.metadata?.decoderConfig;
      expect(dc).toBeDefined();
      expect(dc?.codec).toContain('avc1');
      expect(dc?.codedWidth).toBe(640);
      expect(dc?.codedHeight).toBe(480);
      expect(dc?.displayAspectWidth).toBe(800);
      expect(dc?.displayAspectHeight).toBe(600);
      expect(dc?.colorSpace?.primaries).toBe('bt709');
    });

    it('should include svc metadata with temporalLayerId', async () => {
      const chunks: Array<{chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata}> = [];

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => chunks.push({chunk, metadata}),
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 320,
        height: 240,
      });

      const frame = new VideoFrame(
        new Uint8Array(320 * 240 * 4),
        {format: 'RGBA', codedWidth: 320, codedHeight: 240, timestamp: 0}
      );
      encoder.encode(frame, {keyFrame: true});
      frame.close();

      await encoder.flush();
      encoder.close();

      const keyframe = chunks.find(c => c.chunk.type === 'key');
      expect(keyframe?.metadata?.svc).toBeDefined();
      expect(keyframe?.metadata?.svc?.temporalLayerId).toBe(0);
    });
  });

  describe('State machine compliance', () => {
    it('should transition: unconfigured -> configured -> closed', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(encoder.state).toBe('unconfigured');

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
      });
      expect(encoder.state).toBe('configured');

      encoder.close();
      expect(encoder.state).toBe('closed');
    });

    it('should transition: configured -> unconfigured via reset()', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
      });
      expect(encoder.state).toBe('configured');

      encoder.reset();
      expect(encoder.state).toBe('unconfigured');

      encoder.close();
    });

    it('should throw InvalidStateError when configure() called on closed encoder', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
        });
      }).toThrow(/closed|InvalidStateError/i);
    });

    it('should throw InvalidStateError when flush() called on unconfigured encoder', async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      await expect(encoder.flush()).rejects.toThrow(/configured|InvalidStateError/i);
      encoder.close();
    });
  });

  describe('TypeError validation', () => {
    it('should throw TypeError if displayWidth provided without displayHeight', () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        encoder.configure({
          codec: 'avc1.42E01E',
          width: 640,
          height: 480,
          displayWidth: 640,
        } as any);
      }).toThrow(TypeError);

      encoder.close();
    });
  });
});
```

**Step 2: Run test to verify all pass** (30 sec)

```bash
npx vitest run test/golden/video-encoder-w3c-compliance.test.ts
```

Expected: All tests PASS

**Step 3: Commit** (30 sec)

```bash
git add test/golden/video-encoder-w3c-compliance.test.ts
git commit -m "test(VideoEncoder): add comprehensive W3C compliance test suite"
```

---

### Task 8: Code Review

This task is for final code review after all implementation tasks are complete.

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Run linter**

```bash
npm run lint
```

**Step 3: Review changes**

```bash
git diff main..HEAD
```

**Step 4: Create summary of compliance improvements**

Document what was added:
- `isConfigSupported` now echoes: displayWidth, displayHeight, alpha, scalabilityMode, contentHint, colorSpace
- `EncodedVideoChunkMetadata.decoderConfig` now includes: displayAspectWidth, displayAspectHeight, colorSpace
- `EncodedVideoChunkMetadata.svc` now populated with temporalLayerId
- Full W3C compliance test suite added

---

## Future Work (Out of Scope for This Plan)

The following features require more significant implementation effort and should be addressed in future plans:

1. **Alpha channel encoding** - Requires dual-encode approach or alpha plane handling in FFmpeg
2. **Scalability modes (L1T2, L2T3, etc.)** - Requires temporal/spatial layer encoding in FFmpeg
3. **Hardware acceleration** - Requires hwaccel FFmpeg integration
4. **Real SVC temporal layer tracking** - Currently hardcoded to layer 0
5. **alphaSideData in metadata** - Requires alpha encoding support first
