# Replace FFmpeg CLI Calls with C-Bindings

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-replace-ffmpeg-cli-with-c-bindings.md` to implement task-by-task.

**Goal:** Eliminate all FFmpeg CLI (`ffmpeg`, `ffplay`) calls from examples by using native C-bindings.

**Architecture:** Create a new `TestVideoGenerator` class using libavfilter's `testsrc` filter (same pattern as `VideoFilter`). Update examples to use native `Muxer` instead of `ffmpeg -c copy`. Keep `ffplay` for playback (out of scope) but make it optional.

**Tech Stack:** C++17, node-addon-api (NAPI), FFmpeg libavfilter, TypeScript

---

## Summary of CLI Usages to Replace

| Location | CLI Call | Replacement |
|----------|----------|-------------|
| `examples/run-demo.js:324-332` | `ffmpeg testsrc + sine` | New `TestVideoGenerator` class |
| `examples/02-video-pipeline/index.js:57-61` | `ffmpeg testsrc` | New `TestVideoGenerator` class |
| `examples/02-video-pipeline/index.js:184` | `ffmpeg -c copy` (H.264→MP4) | Existing `Muxer` class |
| `examples/run-demo.js:284-285` | `ffmpeg -version` check | Remove (native bindings require FFmpeg libs anyway) |
| `examples/run-demo.js:382` | `ffplay` playback | Keep as optional (out of scope) |

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | New native class (isolated) |
| Group 2 | 2 | TypeScript wrapper (depends on Task 1) |
| Group 3 | 3, 4 | Example updates (independent files) |
| Group 4 | 5 | Code Review |

---

### Task 1: Create Native TestVideoGenerator Class

**Files:**
- Create: `src/test_video_generator.h`
- Create: `src/test_video_generator.cc`
- Modify: `src/addon.cc` (add Init call)
- Modify: `binding.gyp` (add source file)

**Step 1: Write the failing test** (2-5 min)

Create test file `test/golden/test-video-generator.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TestVideoGenerator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-video-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate test video frames', async () => {
    const generator = new TestVideoGenerator();

    generator.configure({
      width: 320,
      height: 240,
      frameRate: 30,
      duration: 1, // 1 second = 30 frames
      pattern: 'testsrc',
    });

    const frames: VideoFrame[] = [];

    await generator.generate((frame) => {
      frames.push(frame);
    });

    expect(frames.length).toBe(30);
    expect(frames[0].codedWidth).toBe(320);
    expect(frames[0].codedHeight).toBe(240);

    // Clean up frames
    frames.forEach(f => f.close());
    generator.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/test-video-generator.test.ts -t "should generate test video frames"
```

Expected: FAIL with `ReferenceError: TestVideoGenerator is not defined`

**Step 3: Create header file** (2-5 min)

Create `src/test_video_generator.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_TEST_VIDEO_GENERATOR_H_
#define SRC_TEST_VIDEO_GENERATOR_H_

#include <napi.h>

extern "C" {
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/frame.h>
#include <libswscale/swscale.h>
}

#include "src/common.h"

class TestVideoGenerator : public Napi::ObjectWrap<TestVideoGenerator> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit TestVideoGenerator(const Napi::CallbackInfo& info);
  ~TestVideoGenerator();

 private:
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Generate(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);

  void Cleanup();
  bool InitFilterGraph();

  ffmpeg::AVFilterGraphPtr filter_graph_;
  AVFilterContext* buffersink_ctx_;
  ffmpeg::SwsContextPtr sws_yuv_to_rgba_;
  ffmpeg::AVFramePtr output_frame_;

  int width_;
  int height_;
  int frame_rate_;
  int duration_;
  std::string pattern_;
  std::string state_;
};

Napi::Object InitTestVideoGenerator(Napi::Env env, Napi::Object exports);

#endif  // SRC_TEST_VIDEO_GENERATOR_H_
```

**Step 4: Create implementation file** (5-10 min)

Create `src/test_video_generator.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/test_video_generator.h"

#include <cstdio>
#include <string>

#include "src/video_frame.h"

Napi::Object TestVideoGenerator::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "TestVideoGenerator", {
    InstanceMethod("configure", &TestVideoGenerator::Configure),
    InstanceMethod("generate", &TestVideoGenerator::Generate),
    InstanceMethod("close", &TestVideoGenerator::Close),
    InstanceAccessor("state", &TestVideoGenerator::GetState, nullptr),
  });

  exports.Set("TestVideoGenerator", func);
  return exports;
}

TestVideoGenerator::TestVideoGenerator(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<TestVideoGenerator>(info),
      buffersink_ctx_(nullptr),
      width_(0),
      height_(0),
      frame_rate_(30),
      duration_(1),
      pattern_("testsrc"),
      state_("unconfigured") {}

TestVideoGenerator::~TestVideoGenerator() {
  Cleanup();
}

void TestVideoGenerator::Cleanup() {
  filter_graph_.reset();
  sws_yuv_to_rgba_.reset();
  output_frame_.reset();
  buffersink_ctx_ = nullptr;
}

Napi::Value TestVideoGenerator::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value TestVideoGenerator::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
  return info.Env().Undefined();
}

Napi::Value TestVideoGenerator::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "TestVideoGenerator is closed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();

  width_ = webcodecs::AttrAsInt32(config, "width");
  height_ = webcodecs::AttrAsInt32(config, "height");

  if (webcodecs::HasAttr(config, "frameRate")) {
    frame_rate_ = webcodecs::AttrAsInt32(config, "frameRate");
  }
  if (webcodecs::HasAttr(config, "duration")) {
    duration_ = webcodecs::AttrAsInt32(config, "duration");
  }
  if (webcodecs::HasAttr(config, "pattern")) {
    pattern_ = webcodecs::AttrAsStr(config, "pattern");
  }

  if (width_ <= 0 || height_ <= 0) {
    Napi::RangeError::New(env, "width and height must be positive").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Initialize swscale for YUV420P -> RGBA conversion
  sws_yuv_to_rgba_.reset(sws_getContext(width_, height_, AV_PIX_FMT_YUV420P,
                                        width_, height_, AV_PIX_FMT_RGBA,
                                        SWS_BILINEAR, nullptr, nullptr, nullptr));

  if (!sws_yuv_to_rgba_) {
    Napi::Error::New(env, "Failed to create swscale context").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  output_frame_ = ffmpeg::make_frame();

  state_ = "configured";
  return env.Undefined();
}

bool TestVideoGenerator::InitFilterGraph() {
  filter_graph_ = ffmpeg::make_filter_graph();
  if (!filter_graph_) return false;

  const AVFilter* buffersink = avfilter_get_by_name("buffersink");
  const AVFilter* testsrc = avfilter_get_by_name(pattern_.c_str());

  if (!testsrc) {
    // Fallback to testsrc if pattern not found
    testsrc = avfilter_get_by_name("testsrc");
  }

  // Create testsrc filter
  char args[256];
  snprintf(args, sizeof(args), "duration=%d:size=%dx%d:rate=%d",
           duration_, width_, height_, frame_rate_);

  AVFilterContext* testsrc_ctx = nullptr;
  int ret = avfilter_graph_create_filter(&testsrc_ctx, testsrc, "in", args,
                                         nullptr, filter_graph_.get());
  if (ret < 0) return false;

  // Create buffersink
  ret = avfilter_graph_create_filter(&buffersink_ctx_, buffersink, "out",
                                     nullptr, nullptr, filter_graph_.get());
  if (ret < 0) return false;

  // Link testsrc -> buffersink
  ret = avfilter_link(testsrc_ctx, 0, buffersink_ctx_, 0);
  if (ret < 0) return false;

  ret = avfilter_graph_config(filter_graph_.get(), nullptr);
  return ret >= 0;
}

Napi::Value TestVideoGenerator::Generate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "TestVideoGenerator not configured").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Callback function required").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Function callback = info[0].As<Napi::Function>();

  // Initialize filter graph
  if (!InitFilterGraph()) {
    Napi::Error::New(env, "Failed to initialize filter graph").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Generate frames
  int64_t frame_count = 0;
  size_t output_size = width_ * height_ * 4;

  while (true) {
    av_frame_unref(output_frame_.get());
    int ret = av_buffersink_get_frame(buffersink_ctx_, output_frame_.get());

    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      Napi::Error::New(env, "Error getting frame from filter").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Convert YUV420P to RGBA
    Napi::Buffer<uint8_t> output_buffer = Napi::Buffer<uint8_t>::New(env, output_size);
    uint8_t* output_data = output_buffer.Data();
    uint8_t* dst_slices[1] = {output_data};
    int dst_stride[1] = {width_ * 4};

    sws_scale(sws_yuv_to_rgba_.get(), output_frame_->data, output_frame_->linesize,
              0, height_, dst_slices, dst_stride);

    // Calculate timestamp in microseconds
    int64_t timestamp = (frame_count * 1000000) / frame_rate_;

    // Create VideoFrame
    Napi::Value frame = VideoFrame::CreateInstance(env, output_data, output_size,
                                                    width_, height_, timestamp, "RGBA");

    // Call callback with frame
    callback.Call({frame});
    frame_count++;
  }

  // Return a resolved promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

Napi::Object InitTestVideoGenerator(Napi::Env env, Napi::Object exports) {
  return TestVideoGenerator::Init(env, exports);
}
```

**Step 5: Register in addon.cc** (2 min)

Modify `src/addon.cc`, add near other includes:

```cpp
#include "src/test_video_generator.h"
```

And in the `Init` function, add:

```cpp
InitTestVideoGenerator(env, exports);
```

**Step 6: Add to binding.gyp** (2 min)

In `binding.gyp`, add to the `sources` array:

```
"src/test_video_generator.cc",
```

**Step 7: Build and run test** (30 sec)

```bash
npm run build && npx vitest run test/golden/test-video-generator.test.ts -t "should generate test video frames"
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
git add src/test_video_generator.h src/test_video_generator.cc src/addon.cc binding.gyp test/golden/test-video-generator.test.ts
git commit -m "feat(test-video-generator): add native TestVideoGenerator class using libavfilter"
```

---

### Task 2: Create TypeScript Wrapper for TestVideoGenerator

**Files:**
- Create: `lib/test-video-generator.ts`
- Modify: `lib/index.ts` (export class)
- Modify: `lib/native-types.ts` (add interface)
- Modify: `lib/types.ts` (add config type)
- Modify: `test/setup.ts` (register global)

**Step 1: Add types to lib/types.ts** (2 min)

Add to `lib/types.ts`:

```typescript
export interface TestVideoGeneratorConfig {
  width: number;
  height: number;
  frameRate?: number;
  duration?: number;
  pattern?: 'testsrc' | 'testsrc2' | 'color' | 'smptebars';
}
```

**Step 2: Add native interface to lib/native-types.ts** (2 min)

Add to `lib/native-types.ts`:

```typescript
export interface NativeTestVideoGenerator {
  configure(config: TestVideoGeneratorConfig): void;
  generate(callback: (frame: NativeVideoFrame) => void): Promise<void>;
  close(): void;
  readonly state: CodecState;
}
```

And add to `NativeModule` interface:

```typescript
TestVideoGenerator: new () => NativeTestVideoGenerator;
```

**Step 3: Create TypeScript wrapper** (3 min)

Create `lib/test-video-generator.ts`:

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { NativeModule, NativeTestVideoGenerator, NativeVideoFrame } from './native-types';
import type { CodecState, TestVideoGeneratorConfig } from './types';
import { VideoFrame } from './video-frame';

const native = binding as NativeModule;

export class TestVideoGenerator {
  private _native: NativeTestVideoGenerator;

  constructor() {
    this._native = new native.TestVideoGenerator();
  }

  get state(): CodecState {
    return this._native.state;
  }

  configure(config: TestVideoGeneratorConfig): void {
    this._native.configure(config);
  }

  async generate(callback: (frame: VideoFrame) => void): Promise<void> {
    return this._native.generate((nativeFrame: NativeVideoFrame) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(VideoFrame.prototype) as any;
      wrapper._native = nativeFrame;
      wrapper._closed = false;
      wrapper._metadata = {};
      callback(wrapper as VideoFrame);
    });
  }

  close(): void {
    this._native.close();
  }
}
```

**Step 4: Export from lib/index.ts** (1 min)

Add to `lib/index.ts`:

```typescript
export { TestVideoGenerator } from './test-video-generator';
```

**Step 5: Register in test/setup.ts** (1 min)

Add to `test/setup.ts`:

```typescript
import { TestVideoGenerator } from '../lib/test-video-generator';
(globalThis as Record<string, unknown>).TestVideoGenerator = TestVideoGenerator;
```

**Step 6: Run test to verify integration** (30 sec)

```bash
npx vitest run test/golden/test-video-generator.test.ts
```

Expected: PASS

**Step 7: Commit** (30 sec)

```bash
git add lib/test-video-generator.ts lib/index.ts lib/native-types.ts lib/types.ts test/setup.ts
git commit -m "feat(test-video-generator): add TypeScript wrapper and exports"
```

---

### Task 3: Update run-demo.js to Use Native Bindings

**Files:**
- Modify: `examples/run-demo.js`

**Step 1: Read current implementation** (1 min)

Review lines 284-285, 324-332 in `examples/run-demo.js`.

**Step 2: Replace test video generation** (5 min)

Replace the `ffmpeg testsrc` call (lines 324-332) with native `TestVideoGenerator`:

```javascript
// Replace this:
const ffmpegCmd = [
  'ffmpeg -y',
  '-f lavfi -i "testsrc=duration=5:size=640x480:rate=30"',
  '-f lavfi -i "sine=frequency=440:duration=5"',
  '-c:v libx264 -preset fast -crf 23',
  '-c:a aac -b:a 128k',
  '-pix_fmt yuv420p',
  `"${TEST_VIDEO}"`,
].join(' ');
const result = run(ffmpegCmd);

// With this:
const { TestVideoGenerator, VideoEncoder, AudioEncoder, Muxer, AudioData } = require('../lib');

async function generateTestVideo(outputPath) {
  const width = 640;
  const height = 480;
  const frameRate = 30;
  const duration = 5;

  // Generate video frames
  const generator = new TestVideoGenerator();
  generator.configure({ width, height, frameRate, duration, pattern: 'testsrc' });

  const videoChunks = [];
  let codecDescription = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      videoChunks.push(chunk);
      if (metadata?.decoderConfig?.description) {
        codecDescription = metadata.decoderConfig.description;
      }
    },
    error: (err) => console.error('Video encoder error:', err),
  });

  videoEncoder.configure({
    codec: 'avc1.42001e',
    width,
    height,
    bitrate: 1_000_000,
    framerate: frameRate,
    avc: { format: 'avc' },
  });

  await generator.generate((frame) => {
    videoEncoder.encode(frame, { keyFrame: frame.timestamp === 0 });
    frame.close();
  });

  await videoEncoder.flush();
  videoEncoder.close();
  generator.close();

  // Generate audio (440Hz sine wave)
  const sampleRate = 48000;
  const numChannels = 2;
  const audioChunks = [];

  const audioEncoder = new AudioEncoder({
    output: (chunk) => audioChunks.push(chunk),
    error: (err) => console.error('Audio encoder error:', err),
  });

  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels: numChannels,
    bitrate: 128000,
  });

  // Generate 5 seconds of audio in chunks
  const samplesPerChunk = 1024;
  const totalSamples = sampleRate * duration;

  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const numSamples = Math.min(samplesPerChunk, totalSamples - offset);
    const audioData = new Float32Array(numSamples * numChannels);

    for (let i = 0; i < numSamples; i++) {
      const t = (offset + i) / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
      audioData[i * numChannels] = sample;
      audioData[i * numChannels + 1] = sample;
    }

    const frame = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: numSamples,
      numberOfChannels: numChannels,
      timestamp: Math.floor((offset / sampleRate) * 1_000_000),
      data: audioData,
    });

    audioEncoder.encode(frame);
    frame.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();

  // Mux to MP4
  const muxer = new Muxer({ filename: outputPath });
  muxer.addVideoTrack({ codec: 'avc1.42001e', width, height, description: codecDescription });
  muxer.addAudioTrack({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: numChannels });

  videoChunks.forEach((chunk) => muxer.writeVideoChunk(chunk));
  audioChunks.forEach((chunk) => muxer.writeAudioChunk(chunk));

  muxer.finalize();
  muxer.close();
}
```

**Step 3: Remove ffmpeg dependency checks** (2 min)

Remove or make optional the `checkDependency('ffmpeg', ...)` call at line 284.
Keep `ffplay` check as optional for playback.

**Step 4: Test the example** (30 sec)

```bash
node examples/run-demo.js
```

Expected: Demo runs and generates test video without calling ffmpeg CLI.

**Step 5: Commit** (30 sec)

```bash
git add examples/run-demo.js
git commit -m "refactor(examples): replace ffmpeg CLI with native TestVideoGenerator in run-demo"
```

---

### Task 4: Update 02-video-pipeline Example to Use Native Bindings

**Files:**
- Modify: `examples/02-video-pipeline/index.js`

**Step 1: Read current implementation** (1 min)

Review lines 57-61, 184 in `examples/02-video-pipeline/index.js`.

**Step 2: Replace test video generation (line 57-61)** (3 min)

Replace the `execSync('ffmpeg ...')` with native TestVideoGenerator, similar to Task 3.

**Step 3: Replace H.264 to MP4 muxing (line 184)** (2 min)

Replace:
```javascript
execSync(`ffmpeg -y -i "${OUTPUT_H264}" -c copy "${OUTPUT_MP4}"`, {stdio: 'pipe'});
```

With the existing Muxer class (which is already demonstrated in run-demo.js lines 240-256).

**Step 4: Remove child_process import if no longer needed** (1 min)

Remove `execSync` import if no other usages remain.

**Step 5: Test the example** (30 sec)

```bash
node examples/02-video-pipeline/index.js
```

Expected: Pipeline runs without ffmpeg CLI calls.

**Step 6: Commit** (30 sec)

```bash
git add examples/02-video-pipeline/index.js
git commit -m "refactor(examples): replace ffmpeg CLI with native bindings in 02-video-pipeline"
```

---

### Task 5: Code Review

**Files:**
- All files modified in Tasks 1-4

**Step 1: Run full test suite** (1 min)

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No linting errors.

**Step 3: Verify examples work** (2 min)

```bash
node examples/run-demo.js
node examples/02-video-pipeline/index.js
```

Expected: Both examples run successfully without ffmpeg CLI calls.

**Step 4: Review for edge cases** (2 min)

- Verify error handling in TestVideoGenerator
- Check memory cleanup (frame.close() calls)
- Verify timestamps are correct

**Step 5: Final commit if any fixes needed** (30 sec)

```bash
git add -A && git commit -m "fix: address code review feedback"
```
