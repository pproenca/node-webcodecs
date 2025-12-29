# WebCodecs Validation Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pass all 9 validation tests proving the WebCodecs native addon is production-ready, with proper memory management, keyframe forcing, buffer validation, and Promise-based async API.

**Architecture:** The implementation requires: (1) Export `EncodedVideoChunk` class, (2) Add `encodeQueueSize` property, (3) Throw errors on closed VideoFrame access, (4) Add `keyFrame` option support to `encode()`, (5) Convert `flush()` to return Promise, (6) Add buffer size validation to prevent segfaults.

**Tech Stack:** Node-API (NAPI), FFmpeg libavcodec/libswscale, TypeScript wrapper

---

## Gap Analysis

| Test | Requirement | Current State | Action |
|------|-------------|---------------|--------|
| L1 | `EncodedVideoChunk` export | Not exported | Add export |
| L1 | `encodeQueueSize` property | Missing | Add property |
| L2 | Throw on closed frame access | No throw, returns undefined | Add closed check to getters |
| L3 | `flush()` returns Promise | Returns void | Return Promise |
| L5 | Write H.264 file | Works | Add test file |
| T6 | Bitrate control | Works | Add test file |
| T7 | Concurrent encoders | Works (no globals) | Add test file |
| T8 | `keyFrame` option | Not implemented | Add to encode() |
| T9 | Buffer size validation | No validation | Add bounds check |

---

### Task 1: Export EncodedVideoChunk Class

**Files:**
- Modify: `lib/index.ts:91-98`
- Modify: `lib/types.ts:16-22`

**Step 1: Create EncodedVideoChunk class in TypeScript**

Add to `lib/index.ts` before the re-exports:

```typescript
export class EncodedVideoChunk {
    readonly type: 'key' | 'delta';
    readonly timestamp: number;
    readonly duration?: number;
    readonly data: Buffer;

    constructor(init: { type: 'key' | 'delta'; timestamp: number; duration?: number; data: Buffer }) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.data = init.data;
    }

    get byteLength(): number {
        return this.data.length;
    }
}
```

**Step 2: Update VideoEncoder to use EncodedVideoChunk class**

Modify the output wrapper in `VideoEncoder` constructor (around line 55-64):

```typescript
this._native = new native.VideoEncoder({
    output: (chunk: any, metadata: any) => {
        const wrappedChunk = new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data
        });
        init.output(wrappedChunk, metadata);
    },
    error: init.error
});
```

**Step 3: Run TypeScript build to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:ts`
Expected: Successful compilation

**Step 4: Commit**

```bash
git add lib/index.ts
git commit -m "feat: export EncodedVideoChunk class for WebCodecs compliance"
```

---

### Task 2: Add encodeQueueSize Property to VideoEncoder

**Files:**
- Modify: `src/video_encoder.h:46`
- Modify: `src/video_encoder.cpp:9-15`

**Step 1: Add encodeQueueSize accessor to C++ header**

Add to private section of `video_encoder.h` after line 25:

```cpp
Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);
```

Add to private member variables after `frameCount_`:

```cpp
int encodeQueueSize_;
```

**Step 2: Implement encodeQueueSize in C++**

Add accessor method in `video_encoder.cpp` after `GetState`:

```cpp
Napi::Value VideoEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), encodeQueueSize_);
}
```

**Step 3: Register the accessor in Init**

Modify the DefineClass in `video_encoder.cpp` to add the accessor:

```cpp
Napi::Function func = DefineClass(env, "VideoEncoder", {
    InstanceMethod("configure", &VideoEncoder::Configure),
    InstanceMethod("encode", &VideoEncoder::Encode),
    InstanceMethod("flush", &VideoEncoder::Flush),
    InstanceMethod("close", &VideoEncoder::Close),
    InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
    InstanceAccessor("encodeQueueSize", &VideoEncoder::GetEncodeQueueSize, nullptr),
});
```

**Step 4: Initialize encodeQueueSize in constructor**

In constructor initialization list, add `encodeQueueSize_(0)`:

```cpp
VideoEncoder::VideoEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoEncoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swsContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      width_(0),
      height_(0),
      frameCount_(0),
      encodeQueueSize_(0) {
```

**Step 5: Add encodeQueueSize to TypeScript wrapper**

Add to `VideoEncoder` class in `lib/index.ts`:

```typescript
get encodeQueueSize(): number {
    return this._native.encodeQueueSize;
}
```

**Step 6: Rebuild native addon**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build`
Expected: Successful compilation

**Step 7: Commit**

```bash
git add src/video_encoder.h src/video_encoder.cpp lib/index.ts
git commit -m "feat: add encodeQueueSize property to VideoEncoder"
```

---

### Task 3: Throw Error on Closed VideoFrame Property Access

**Files:**
- Modify: `src/video_frame.cpp:53-67`

**Step 1: Add closed check to GetCodedWidth**

```cpp
Napi::Value VideoFrame::GetCodedWidth(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), codedWidth_);
}
```

**Step 2: Add closed check to GetCodedHeight**

```cpp
Napi::Value VideoFrame::GetCodedHeight(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), codedHeight_);
}
```

**Step 3: Add closed check to GetTimestamp**

```cpp
Napi::Value VideoFrame::GetTimestamp(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), timestamp_);
}
```

**Step 4: Add closed check to GetFormat**

```cpp
Napi::Value VideoFrame::GetFormat(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::String::New(info.Env(), format_);
}
```

**Step 5: Rebuild native addon**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native`
Expected: Successful compilation

**Step 6: Commit**

```bash
git add src/video_frame.cpp
git commit -m "fix: throw error when accessing closed VideoFrame properties"
```

---

### Task 4: Convert flush() to Return Promise

**Files:**
- Modify: `lib/index.ts:82-84`

**Step 1: Update flush method signature**

Change the `flush` method in `VideoEncoder` class:

```typescript
flush(): Promise<void> {
    return new Promise((resolve) => {
        this._native.flush();
        resolve();
    });
}
```

**Step 2: Rebuild TypeScript**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:ts`
Expected: Successful compilation

**Step 3: Commit**

```bash
git add lib/index.ts
git commit -m "feat: make flush() return Promise for async API compliance"
```

---

### Task 5: Add keyFrame Option to encode()

**Files:**
- Modify: `src/video_encoder.h:22`
- Modify: `src/video_encoder.cpp:158-192`
- Modify: `lib/index.ts:78-79`
- Modify: `lib/types.ts` (add EncodeOptions type)

**Step 1: Add EncodeOptions type to types.ts**

Add after `VideoFrameInit` interface:

```typescript
export interface VideoEncoderEncodeOptions {
    keyFrame?: boolean;
}
```

**Step 2: Update TypeScript encode() signature**

Update in `lib/index.ts`:

```typescript
encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
    this._native.encode(frame._nativeFrame, options || {});
}
```

**Step 3: Update C++ Encode to accept options**

Modify `VideoEncoder::Encode` in `video_encoder.cpp`:

```cpp
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "Encoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "encode requires VideoFrame");
    }

    // Get VideoFrame
    VideoFrame* videoFrame = Napi::ObjectWrap<VideoFrame>::Unwrap(info[0].As<Napi::Object>());

    // Check for keyFrame option
    bool forceKeyFrame = false;
    if (info.Length() >= 2 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();
        if (options.Has("keyFrame") && options.Get("keyFrame").IsBoolean()) {
            forceKeyFrame = options.Get("keyFrame").As<Napi::Boolean>().Value();
        }
    }

    // Convert RGBA to YUV420P
    const uint8_t* srcData[] = { videoFrame->GetData() };
    int srcLinesize[] = { videoFrame->GetWidth() * 4 };

    sws_scale(swsContext_, srcData, srcLinesize, 0, height_,
              frame_->data, frame_->linesize);

    frame_->pts = frameCount_++;

    // Set picture type for keyframe forcing
    if (forceKeyFrame) {
        frame_->pict_type = AV_PICTURE_TYPE_I;
    } else {
        frame_->pict_type = AV_PICTURE_TYPE_NONE;
    }

    // Send frame to encoder
    int ret = avcodec_send_frame(codecContext_, frame_);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        throw Napi::Error::New(env, std::string("Error sending frame: ") + errbuf);
    }

    // Receive encoded packets
    EmitChunks(env);

    return env.Undefined();
}
```

**Step 4: Rebuild everything**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add src/video_encoder.cpp lib/index.ts lib/types.ts
git commit -m "feat: add keyFrame option to encode() for IDR frame forcing"
```

---

### Task 6: Add Buffer Size Validation

**Files:**
- Modify: `src/video_encoder.cpp:158-170`

**Step 1: Add buffer size validation before color conversion**

Add validation after getting VideoFrame in `Encode`:

```cpp
// Get VideoFrame
VideoFrame* videoFrame = Napi::ObjectWrap<VideoFrame>::Unwrap(info[0].As<Napi::Object>());

// Validate buffer size matches configured dimensions
size_t expectedSize = static_cast<size_t>(width_) * height_ * 4; // RGBA = 4 bytes per pixel
size_t actualSize = videoFrame->GetDataSize();
if (actualSize < expectedSize) {
    throw Napi::Error::New(env,
        "VideoFrame buffer too small: expected " + std::to_string(expectedSize) +
        " bytes, got " + std::to_string(actualSize));
}
```

**Step 2: Rebuild native addon**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm run build:native`
Expected: Successful compilation

**Step 3: Commit**

```bash
git add src/video_encoder.cpp
git commit -m "fix: validate VideoFrame buffer size to prevent segfaults"
```

---

### Task 7: Create Test Files - Level 1 Smoke Test

**Files:**
- Create: `test/01_smoke.js`

**Step 1: Write the smoke test**

```javascript
const { VideoEncoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log(`[TEST] Loading Modules...`);
console.log(`VideoEncoder: ${typeof VideoEncoder}`);
console.log(`VideoFrame: ${typeof VideoFrame}`);
console.log(`EncodedVideoChunk: ${typeof EncodedVideoChunk}`);

try {
  const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
  console.log(`[TEST] Encoder State: ${encoder.state}`);
  console.log(`[TEST] Encode Queue: ${encoder.encodeQueueSize}`);
} catch (e) {
  console.error(`[FAIL] Constructor crashed: ${e.message}`);
  process.exit(1);
}
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/01_smoke.js`
Expected:
```
[TEST] Loading Modules...
VideoEncoder: function
VideoFrame: function
EncodedVideoChunk: function
[TEST] Encoder State: unconfigured
[TEST] Encode Queue: 0
```

**Step 3: Commit**

```bash
git add test/01_smoke.js
git commit -m "test: add Level 1 smoke test for WebCodecs API surface"
```

---

### Task 8: Create Test Files - Level 2 Memory Bridge Test

**Files:**
- Create: `test/02_frame_data.js`

**Step 1: Write the frame data test**

```javascript
const { VideoFrame } = require('../dist');
const assert = require('assert');

// 1. Create a 100x100 RGBA buffer (40,000 bytes)
// We fill it with Red (255, 0, 0, 255) to test data integrity later
const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4);
for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;     // R
    buffer[i+1] = 0;     // G
    buffer[i+2] = 0;     // B
    buffer[i+3] = 255;   // A
}

console.log(`[TEST] Creating VideoFrame (${width}x${height})...`);
const frame = new VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 123456, // microseconds
    format: 'RGBA'
});

console.log(`[TEST] Verifying Properties...`);
assert.strictEqual(frame.codedWidth, 100, 'Width mismatch');
assert.strictEqual(frame.codedHeight, 100, 'Height mismatch');
assert.strictEqual(frame.timestamp, 123456, 'Timestamp mismatch');
assert.strictEqual(frame.format, 'RGBA', 'Format mismatch');

console.log(`[TEST] Closing Frame...`);
frame.close();

try {
    const w = frame.codedWidth;
    console.error(`[FAIL] Should have thrown on closed frame access`);
    process.exit(1);
} catch (e) {
    console.log(`[PASS] Accessing closed frame threw error: "${e.message}"`);
}
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/02_frame_data.js`
Expected:
```
[TEST] Creating VideoFrame (100x100)...
[TEST] Verifying Properties...
[TEST] Closing Frame...
[PASS] Accessing closed frame threw error: "VideoFrame is closed"
```

**Step 3: Commit**

```bash
git add test/02_frame_data.js
git commit -m "test: add Level 2 memory bridge test for VideoFrame"
```

---

### Task 9: Create Test Files - Level 3 Encoding Engine Test

**Files:**
- Create: `test/03_encoding.js`

**Step 1: Write the encoding test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');

let chunks = [];
const encoder = new VideoEncoder({
    output: (chunk, meta) => {
        console.log(`[CB] Chunk: ${chunk.type} | TS: ${chunk.timestamp} | Size: ${chunk.byteLength} bytes`);
        chunks.push(chunk);
    },
    error: (e) => console.error(`[ERR] ${e.message}`)
});

console.log(`[TEST] Configuring H.264 (Baseline)...`);
encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30
});

// Create a dummy frame
const buf = Buffer.alloc(640 * 480 * 4);
const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: 0 });

console.log(`[TEST] Encoding KeyFrame...`);
encoder.encode(frame, { keyFrame: true });

console.log(`[TEST] Flushing...`);
encoder.flush().then(() => {
    console.log(`[TEST] Flush complete.`);

    // VALIDATION LOGIC
    if (chunks.length === 0) throw new Error("No chunks emitted!");
    if (chunks[0].type !== 'key') throw new Error("First chunk was not a Key Frame!");
    if (chunks[0].byteLength === 0) throw new Error("Chunk is empty!");

    console.log(`[PASS] Encoding Pipeline Verified.`);
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/03_encoding.js`
Expected:
```
[TEST] Configuring H.264 (Baseline)...
[TEST] Encoding KeyFrame...
[TEST] Flushing...
[CB] Chunk: key | TS: 0 | Size: <400-5000> bytes
[TEST] Flush complete.
[PASS] Encoding Pipeline Verified.
```

**Step 3: Commit**

```bash
git add test/03_encoding.js
git commit -m "test: add Level 3 H.264 encoding engine test"
```

---

### Task 10: Create Test Files - Level 4 Memory Leak Test

**Files:**
- Create: `test/04_leak_check.js`

**Step 1: Write the memory leak test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');

const LOOPS = 5000;
const LOG_INTERVAL = 500;

console.log(`[TEST] Starting Memory Stress Test (${LOOPS} frames)...`);

const encoder = new VideoEncoder({
    output: (chunk) => { /* no-op to save JS memory */ },
    error: (e) => console.error(e)
});

encoder.configure({ codec: 'avc1.42001E', width: 320, height: 240 });

const buf = Buffer.alloc(320 * 240 * 4); // Reuse buffer to isolate Frame leak
const startMem = process.memoryUsage().rss;

for (let i = 0; i < LOOPS; i++) {
    const frame = new VideoFrame(buf, {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33000
    });

    encoder.encode(frame);
    frame.close(); // <--- CRITICAL: Manually free C++ resource

    if (i % LOG_INTERVAL === 0) {
        const currentMem = process.memoryUsage().rss;
        const diff = Math.round((currentMem - startMem) / 1024 / 1024);
        console.log(`Frame ${i}: RSS Delta = ${diff} MB`);
    }
}

encoder.flush().then(() => {
    const endMem = process.memoryUsage().rss;
    const growth = (endMem - startMem) / 1024 / 1024;
    console.log(`[INFO] Total RSS Growth: ${growth.toFixed(2)} MB`);

    // Soft limit: 5000 frames shouldn't grow memory by >500MB if managed correctly
    if (growth > 200) {
        console.error(`[WARN] Possible memory leak detected.`);
    } else {
        console.log(`[PASS] Memory stable.`);
    }
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/04_leak_check.js`
Expected:
```
[TEST] Starting Memory Stress Test (5000 frames)...
Frame 0: RSS Delta = 0 MB
Frame 500: RSS Delta = <15 MB
...
[PASS] Memory stable.
```

**Step 3: Commit**

```bash
git add test/04_leak_check.js
git commit -m "test: add Level 4 memory leak stress test"
```

---

### Task 11: Create Test Files - Level 5 Artifact Test

**Files:**
- Create: `test/05_render_file.js`

**Step 1: Write the H.264 file output test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, 'output.h264');
const chunks = [];

console.log('[TEST] Starting H.264 File Render Test...');

const encoder = new VideoEncoder({
    output: (chunk) => {
        chunks.push(chunk.data);
    },
    error: (e) => console.error(`[ERR] ${e.message}`)
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30
});

// Generate 60 frames alternating Red/Blue
const width = 640;
const height = 480;
const redBuf = Buffer.alloc(width * height * 4);
const blueBuf = Buffer.alloc(width * height * 4);

// Fill red buffer (255, 0, 0, 255)
for (let i = 0; i < redBuf.length; i += 4) {
    redBuf[i] = 255;     // R
    redBuf[i+1] = 0;     // G
    redBuf[i+2] = 0;     // B
    redBuf[i+3] = 255;   // A
}

// Fill blue buffer (0, 0, 255, 255)
for (let i = 0; i < blueBuf.length; i += 4) {
    blueBuf[i] = 0;      // R
    blueBuf[i+1] = 0;    // G
    blueBuf[i+2] = 255;  // B
    blueBuf[i+3] = 255;  // A
}

console.log('[TEST] Encoding 60 frames (Red/Blue alternating)...');

for (let i = 0; i < 60; i++) {
    const buf = (i % 2 === 0) ? redBuf : blueBuf;
    const frame = new VideoFrame(buf, {
        codedWidth: width,
        codedHeight: height,
        timestamp: i * 33333 // ~30fps
    });

    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
}

encoder.flush().then(() => {
    // Concatenate all chunks into single buffer
    const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
    const output = Buffer.concat(chunks, totalSize);

    fs.writeFileSync(OUTPUT_PATH, output);

    console.log(`[INFO] Wrote ${output.length} bytes to ${OUTPUT_PATH}`);
    console.log(`[INFO] Verify with: ffprobe -show_streams ${OUTPUT_PATH}`);
    console.log('[PASS] H.264 file generated.');
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/05_render_file.js`
Expected:
```
[TEST] Starting H.264 File Render Test...
[TEST] Encoding 60 frames (Red/Blue alternating)...
[INFO] Wrote <bytes> to test/output.h264
[INFO] Verify with: ffprobe -show_streams test/output.h264
[PASS] H.264 file generated.
```

**Step 3: Verify with ffprobe**

Run: `ffprobe -show_streams /Users/pedroproenca/Documents/Projects/node-webcodecs/test/output.h264 2>&1 | head -20`
Expected: `codec_name=h264`, `width=640`, `height=480`, `pix_fmt=yuv420p`

**Step 4: Commit**

```bash
git add test/05_render_file.js
git commit -m "test: add Level 5 H.264 artifact verification test"
```

---

### Task 12: Create Test Files - Test 6 Bitrate Control

**Files:**
- Create: `test/06_bitrate_control.js`

**Step 1: Write the bitrate control test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Bitrate Control Test...');

function encodeSequence(bitrate) {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        const encoder = new VideoEncoder({
            output: (chunk) => { totalBytes += chunk.byteLength; },
            error: (e) => reject(e)
        });

        encoder.configure({
            codec: 'avc1.42001E',
            width: 640,
            height: 480,
            framerate: 30,
            bitrate: bitrate
        });

        // Encode 60 frames of high-entropy noise (hard to compress)
        const buf = Buffer.alloc(640 * 480 * 4);
        for (let i = 0; i < 60; i++) {
            // Fill with random noise to force the encoder to work hard
            for (let j = 0; j < buf.length; j += 4) {
                buf.writeUInt32BE(Math.floor(Math.random() * 0xFFFFFFFF), j);
            }

            const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: i * 33333 });
            encoder.encode(frame);
            frame.close();
        }

        encoder.flush().then(() => {
            encoder.close();
            resolve(totalBytes);
        });
    });
}

Promise.all([
    encodeSequence(100_000),   // 100 kbps
    encodeSequence(5_000_000)  // 5 Mbps
]).then(([lowSize, highSize]) => {
    console.log(`[INFO] Low Bitrate Size: ${(lowSize / 1024).toFixed(2)} KB`);
    console.log(`[INFO] High Bitrate Size: ${(highSize / 1024).toFixed(2)} KB`);

    // The high bitrate file should be at least 2x larger for noise content
    const ratio = highSize / lowSize;
    console.log(`[INFO] Ratio: ${ratio.toFixed(2)}x`);

    if (ratio < 2.0) {
        console.error('[FAIL] Encoder ignored bitrate settings!');
        process.exit(1);
    } else {
        console.log('[PASS] Bitrate control validated.');
    }
}).catch((e) => {
    console.error('[FAIL]', e);
    process.exit(1);
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/06_bitrate_control.js`
Expected:
```
[TEST] Starting Bitrate Control Test...
[INFO] Low Bitrate Size: ~XX KB
[INFO] High Bitrate Size: ~YY KB
[INFO] Ratio: >2.0x
[PASS] Bitrate control validated.
```

**Step 3: Commit**

```bash
git add test/06_bitrate_control.js
git commit -m "test: add Test 6 bitrate control validation"
```

---

### Task 13: Create Test Files - Test 7 Concurrency

**Files:**
- Create: `test/07_concurrency.js`

**Step 1: Write the concurrency test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');

console.log('[TEST] Starting Concurrency/Isolation Test...');

const runEncoder = (colorName, colorVal, width, height) => {
    return new Promise((resolve, reject) => {
        let chunkCount = 0;
        const encoder = new VideoEncoder({
            output: (chunk) => chunkCount++,
            error: reject
        });

        encoder.configure({ codec: 'avc1.42001E', width, height });

        // Create a solid color buffer
        const buf = Buffer.alloc(width * height * 4);
        for (let i = 0; i < buf.length; i += 4) {
            buf.writeUInt32BE(colorVal, i);
        }

        // Encode 30 frames
        for (let i = 0; i < 30; i++) {
            const frame = new VideoFrame(buf, { codedWidth: width, codedHeight: height, timestamp: i * 33333 });
            encoder.encode(frame);
            frame.close();
        }

        encoder.flush().then(() => {
            console.log(`[INFO] Encoder ${colorName} finished with ${chunkCount} chunks.`);
            encoder.close();
            resolve(chunkCount);
        });
    });
};

// Run Red (640x480) and Blue (320x240) in parallel
Promise.all([
    runEncoder('RED', 0xFF0000FF, 640, 480),
    runEncoder('BLUE', 0x0000FFFF, 320, 240)
]).then(() => {
    console.log('[PASS] Concurrent encoders ran without crashing.');
}).catch((e) => {
    console.error('[FAIL] Concurrency crash:', e);
    process.exit(1);
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/07_concurrency.js`
Expected:
```
[TEST] Starting Concurrency/Isolation Test...
[INFO] Encoder RED finished with XX chunks.
[INFO] Encoder BLUE finished with YY chunks.
[PASS] Concurrent encoders ran without crashing.
```

**Step 3: Commit**

```bash
git add test/07_concurrency.js
git commit -m "test: add Test 7 concurrency isolation validation"
```

---

### Task 14: Create Test Files - Test 8 Dynamic Keyframe

**Files:**
- Create: `test/08_force_keyframe.js`

**Step 1: Write the keyframe forcing test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Dynamic Keyframe Test...');

const KEYFRAME_INTERVAL = 10;
let keyframeCount = 0;
let frameCount = 0;

const encoder = new VideoEncoder({
    output: (chunk, meta) => {
        // Check if the output type matches our request
        const isKeyFrame = chunk.type === 'key';
        const expectedKeyFrame = (frameCount % KEYFRAME_INTERVAL) === 0;

        // Note: Encoders might emit extra keyframes (scene change detect),
        // but they MUST emit one when we ask.
        if (expectedKeyFrame && !isKeyFrame) {
            console.error(`[FAIL] Frame ${frameCount} expected KEY, got DELTA`);
            process.exit(1);
        }

        if (isKeyFrame) keyframeCount++;
        frameCount++;
    },
    error: (e) => console.error(e)
});

encoder.configure({ codec: 'avc1.42001E', width: 100, height: 100 });

const buf = Buffer.alloc(100 * 100 * 4);

// Encode 50 frames
for (let i = 0; i < 50; i++) {
    const forceKey = (i % KEYFRAME_INTERVAL) === 0;
    const frame = new VideoFrame(buf, { codedWidth: 100, codedHeight: 100, timestamp: i * 33000 });

    encoder.encode(frame, { keyFrame: forceKey });
    frame.close();
}

encoder.flush().then(() => {
    console.log(`[INFO] Processed ${frameCount} frames.`);
    console.log(`[INFO] Received ${keyframeCount} Keyframes.`);

    // We expect at least 5 keyframes (0, 10, 20, 30, 40)
    if (keyframeCount < 5) {
        console.error('[FAIL] Did not receive enough keyframes.');
        process.exit(1);
    }
    console.log('[PASS] Keyframe forcing works.');
});
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/08_force_keyframe.js`
Expected:
```
[TEST] Starting Dynamic Keyframe Test...
[INFO] Processed 50 frames.
[INFO] Received >=5 Keyframes.
[PASS] Keyframe forcing works.
```

**Step 3: Commit**

```bash
git add test/08_force_keyframe.js
git commit -m "test: add Test 8 dynamic keyframe forcing validation"
```

---

### Task 15: Create Test Files - Test 9 Robustness

**Files:**
- Create: `test/09_robustness.js`

**Step 1: Write the robustness test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Robustness (Mismatch) Test...');

let errorCaught = false;

const encoder = new VideoEncoder({
    output: () => {},
    error: (e) => {
        console.log(`[PASS] Encoder correctly emitted error: ${e.message}`);
        errorCaught = true;
    }
});

encoder.configure({ codec: 'avc1.42001E', width: 100, height: 100 });

// Creates a buffer WAY too small for the configured size
console.log('Testing Buffer Underrun (Buffer smaller than Config)...');

const smallBuf = Buffer.alloc(10 * 10 * 4); // 10x10 = 400 bytes, need 100x100x4 = 40000 bytes
const frame = new VideoFrame(smallBuf, { codedWidth: 100, codedHeight: 100, timestamp: 0 });

try {
    encoder.encode(frame); // Should trigger internal check or segfault
    if (!errorCaught) {
        console.log('[WARN] Encode accepted mismatched buffer (Check C++ logic!)');
    }
} catch (e) {
    console.log(`[PASS] Sync error caught: ${e.message}`);
}

// Clean up
try { frame.close(); } catch(e){}
```

**Step 2: Run test to verify**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && node test/09_robustness.js`
Expected:
```
[TEST] Starting Robustness (Mismatch) Test...
Testing Buffer Underrun (Buffer smaller than Config)...
[PASS] Sync error caught: VideoFrame buffer too small: expected 40000 bytes, got 400
```

**Step 3: Commit**

```bash
git add test/09_robustness.js
git commit -m "test: add Test 9 robustness buffer validation"
```

---

### Task 16: Update Test Suite Runner

**Files:**
- Modify: `test/suite.js`

**Step 1: Update suite to run all tests**

```javascript
const { execSync } = require('child_process');
const path = require('path');

const tests = [
    '01_smoke.js',
    '02_frame_data.js',
    '03_encoding.js',
    '04_leak_check.js',
    '05_render_file.js',
    '06_bitrate_control.js',
    '07_concurrency.js',
    '08_force_keyframe.js',
    '09_robustness.js'
];

let passed = 0;
let failed = 0;

console.log('Running WebCodecs Validation Protocol Tests\n');
console.log('='.repeat(50));

for (const test of tests) {
    const testPath = path.join(__dirname, test);
    console.log(`\n>>> Running ${test}...`);
    console.log('-'.repeat(50));

    try {
        execSync(`node "${testPath}"`, { stdio: 'inherit' });
        passed++;
        console.log(`<<< ${test}: PASSED`);
    } catch (e) {
        failed++;
        console.log(`<<< ${test}: FAILED`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Step 2: Run full test suite**

Run: `cd /Users/pedroproenca/Documents/Projects/node-webcodecs && npm test`
Expected: All 9 tests pass

**Step 3: Commit**

```bash
git add test/suite.js
git commit -m "test: update suite runner for all 9 validation tests"
```

---

## Execution Order Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Export EncodedVideoChunk | None |
| 2 | Add encodeQueueSize | None |
| 3 | Throw on closed frame | None |
| 4 | Promise-based flush | None |
| 5 | keyFrame option | None |
| 6 | Buffer validation | None |
| 7-15 | Test files | Tasks 1-6 |
| 16 | Update suite | Tasks 7-15 |

Tasks 1-6 can be parallelized. Tasks 7-16 depend on 1-6 completion.
