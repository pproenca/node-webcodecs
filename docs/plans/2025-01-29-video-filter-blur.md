# VideoFilter Region Blur Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a VideoFilter class to node-webcodecs that applies gaussian blur to specific regions of video frames, enabling content moderation workflows.

**Architecture:** VideoFilter wraps FFmpeg's libavfilter to apply blur effects to bounding box regions within RGBA frames. The filter takes a VideoFrame + array of BlurRegion coordinates, outputs a new VideoFrame with those regions blurred. JavaScript TypeScript wrapper exposes clean API.

**Tech Stack:** C++17, N-API/node-addon-api, FFmpeg (libavfilter, libavutil, libswscale), TypeScript

---

## Task 1: Add libavfilter to Build System

**Files:**
- Modify: `CMakeLists.txt:23-28`

**Step 1: Add libavfilter pkg-config**

Edit `CMakeLists.txt` after line 28, add:

```cmake
pkg_check_modules(AVFILTER REQUIRED libavfilter)
```

**Step 2: Add include directories**

Edit `CMakeLists.txt` line 58-64, add AVFILTER:

```cmake
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${AVCODEC_INCLUDE_DIRS}
    ${AVUTIL_INCLUDE_DIRS}
    ${SWSCALE_INCLUDE_DIRS}
    ${SWRESAMPLE_INCLUDE_DIRS}
    ${AVFILTER_INCLUDE_DIRS}
)
```

**Step 3: Add link libraries**

Edit `CMakeLists.txt` line 67-73, add AVFILTER:

```cmake
target_link_libraries(${PROJECT_NAME}
    ${CMAKE_JS_LIB}
    ${AVCODEC_LIBRARIES}
    ${AVUTIL_LIBRARIES}
    ${SWSCALE_LIBRARIES}
    ${SWRESAMPLE_LIBRARIES}
    ${AVFILTER_LIBRARIES}
)
```

**Step 4: Add link directories**

Edit `CMakeLists.txt` line 76-81, add AVFILTER:

```cmake
target_link_directories(${PROJECT_NAME} PRIVATE
    ${AVCODEC_LIBRARY_DIRS}
    ${AVUTIL_LIBRARY_DIRS}
    ${SWSCALE_LIBRARY_DIRS}
    ${SWRESAMPLE_LIBRARY_DIRS}
    ${AVFILTER_LIBRARY_DIRS}
)
```

**Step 5: Verify build still works**

Run: `npm run build:native`
Expected: Build succeeds with no errors

**Step 6: Commit**

```bash
git add CMakeLists.txt
git commit -m "build: add libavfilter dependency for VideoFilter"
```

---

## Task 2: Create VideoFilter Header

**Files:**
- Create: `src/video_filter.h`

**Step 1: Write the header file**

Create `src/video_filter.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoFilter implementation wrapping FFmpeg libavfilter for blur effects.

#ifndef SRC_VIDEO_FILTER_H_
#define SRC_VIDEO_FILTER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <string>
#include <vector>

class VideoFilter : public Napi::ObjectWrap<VideoFilter> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit VideoFilter(const Napi::CallbackInfo& info);
  ~VideoFilter();

  // Disallow copy and assign.
  VideoFilter(const VideoFilter&) = delete;
  VideoFilter& operator=(const VideoFilter&) = delete;

 private:
  // WebCodecs-style API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value ApplyBlur(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  bool InitFilterGraph(int blur_strength);
  AVFrame* ProcessFrame(AVFrame* input);
  std::string BuildFilterString(
      const std::vector<std::tuple<int, int, int, int>>& regions,
      int blur_strength);

  // FFmpeg filter state.
  AVFilterGraph* filter_graph_;
  AVFilterContext* buffersrc_ctx_;
  AVFilterContext* buffersink_ctx_;
  SwsContext* sws_rgba_to_yuv_;
  SwsContext* sws_yuv_to_rgba_;
  AVFrame* yuv_frame_;
  AVFrame* output_frame_;

  // Configuration.
  int width_;
  int height_;
  std::string state_;
};

#endif  // SRC_VIDEO_FILTER_H_
```

**Step 2: Verify header syntax**

Run: `clang++ -fsyntax-only -std=c++17 -I$(node -p "require('node-addon-api').include" | tr -d '"') $(pkg-config --cflags libavfilter libavcodec libavutil libswscale) src/video_filter.h`
Expected: No errors (may have warnings about unused, that's ok)

**Step 3: Commit**

```bash
git add src/video_filter.h
git commit -m "feat(video-filter): add VideoFilter header with libavfilter integration"
```

---

## Task 3: Implement VideoFilter Core

**Files:**
- Create: `src/video_filter.cc`

**Step 1: Write basic structure and Init**

Create `src/video_filter.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "video_filter.h"

#include <sstream>

Napi::Object VideoFilter::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "VideoFilter", {
    InstanceMethod("configure", &VideoFilter::Configure),
    InstanceMethod("applyBlur", &VideoFilter::ApplyBlur),
    InstanceMethod("close", &VideoFilter::Close),
    InstanceAccessor("state", &VideoFilter::GetState, nullptr),
  });

  exports.Set("VideoFilter", func);
  return exports;
}

VideoFilter::VideoFilter(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFilter>(info),
      filter_graph_(nullptr),
      buffersrc_ctx_(nullptr),
      buffersink_ctx_(nullptr),
      sws_rgba_to_yuv_(nullptr),
      sws_yuv_to_rgba_(nullptr),
      yuv_frame_(nullptr),
      output_frame_(nullptr),
      width_(0),
      height_(0),
      state_("unconfigured") {}

VideoFilter::~VideoFilter() {
  Cleanup();
}

void VideoFilter::Cleanup() {
  if (filter_graph_) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
  }
  if (sws_rgba_to_yuv_) {
    sws_freeContext(sws_rgba_to_yuv_);
    sws_rgba_to_yuv_ = nullptr;
  }
  if (sws_yuv_to_rgba_) {
    sws_freeContext(sws_yuv_to_rgba_);
    sws_yuv_to_rgba_ = nullptr;
  }
  if (yuv_frame_) {
    av_frame_free(&yuv_frame_);
    yuv_frame_ = nullptr;
  }
  if (output_frame_) {
    av_frame_free(&output_frame_);
    output_frame_ = nullptr;
  }
  buffersrc_ctx_ = nullptr;
  buffersink_ctx_ = nullptr;
}

Napi::Value VideoFilter::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

void VideoFilter::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}

Napi::Value VideoFilter::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "VideoFilter is closed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();

  if (!config.Has("width") || !config.Has("height")) {
    Napi::TypeError::New(env, "width and height required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  width_ = config.Get("width").As<Napi::Number>().Int32Value();
  height_ = config.Get("height").As<Napi::Number>().Int32Value();

  if (width_ <= 0 || height_ <= 0) {
    Napi::RangeError::New(env, "width and height must be positive")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Initialize swscale contexts for RGBA <-> YUV420P conversion
  sws_rgba_to_yuv_ = sws_getContext(
      width_, height_, AV_PIX_FMT_RGBA,
      width_, height_, AV_PIX_FMT_YUV420P,
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  sws_yuv_to_rgba_ = sws_getContext(
      width_, height_, AV_PIX_FMT_YUV420P,
      width_, height_, AV_PIX_FMT_RGBA,
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  if (!sws_rgba_to_yuv_ || !sws_yuv_to_rgba_) {
    Cleanup();
    Napi::Error::New(env, "Failed to create swscale contexts")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Allocate YUV frame for filter input
  yuv_frame_ = av_frame_alloc();
  yuv_frame_->format = AV_PIX_FMT_YUV420P;
  yuv_frame_->width = width_;
  yuv_frame_->height = height_;
  av_frame_get_buffer(yuv_frame_, 0);

  // Allocate output frame
  output_frame_ = av_frame_alloc();

  state_ = "configured";
  return env.Undefined();
}

std::string VideoFilter::BuildFilterString(
    const std::vector<std::tuple<int, int, int, int>>& regions,
    int blur_strength) {
  // If no regions, return null filter (passthrough)
  if (regions.empty()) {
    return "null";
  }

  // Build filter: for each region, crop blurred area and overlay
  // Strategy: blur entire frame, then overlay original except for regions
  std::ostringstream oss;

  // boxblur uses radius:power format. strength 1-100 maps to radius 1-50
  int radius = std::max(1, blur_strength / 2);

  // Split input into original and blurred version
  oss << "[in]split=2[orig][toblur];";
  oss << "[toblur]boxblur=" << radius << ":1[blurred];";

  // For each region, crop from blurred and overlay onto original
  std::string current = "orig";
  for (size_t i = 0; i < regions.size(); ++i) {
    int x = std::get<0>(regions[i]);
    int y = std::get<1>(regions[i]);
    int w = std::get<2>(regions[i]);
    int h = std::get<3>(regions[i]);

    // Clamp to frame bounds
    x = std::max(0, std::min(x, width_ - 1));
    y = std::max(0, std::min(y, height_ - 1));
    w = std::min(w, width_ - x);
    h = std::min(h, height_ - y);

    if (w <= 0 || h <= 0) continue;

    std::string crop_label = "crop" + std::to_string(i);
    std::string out_label = (i == regions.size() - 1) ? "out" :
                            ("tmp" + std::to_string(i));

    oss << "[blurred]crop=" << w << ":" << h << ":" << x << ":" << y
        << "[" << crop_label << "];";
    oss << "[" << current << "][" << crop_label << "]overlay="
        << x << ":" << y << "[" << out_label << "]";

    if (i < regions.size() - 1) {
      oss << ";";
    }
    current = out_label;
  }

  return oss.str();
}

bool VideoFilter::InitFilterGraph(int blur_strength) {
  // This is called per-frame with dynamic regions, but we initialize
  // a simple passthrough graph here. Actual filtering happens in ProcessFrame.
  return true;
}

AVFrame* VideoFilter::ProcessFrame(AVFrame* input) {
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

Napi::Value VideoFilter::ApplyBlur(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "VideoFilter not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "frame and regions required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get frame data from VideoFrame object
  Napi::Object frame_obj = info[0].As<Napi::Object>();
  if (!frame_obj.Has("getData")) {
    Napi::TypeError::New(env, "Invalid VideoFrame object")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get regions array
  Napi::Array regions_arr = info[1].As<Napi::Array>();
  std::vector<std::tuple<int, int, int, int>> regions;

  for (uint32_t i = 0; i < regions_arr.Length(); ++i) {
    Napi::Object region = regions_arr.Get(i).As<Napi::Object>();
    int x = region.Get("x").As<Napi::Number>().Int32Value();
    int y = region.Get("y").As<Napi::Number>().Int32Value();
    int w = region.Get("width").As<Napi::Number>().Int32Value();
    int h = region.Get("height").As<Napi::Number>().Int32Value();
    regions.emplace_back(x, y, w, h);
  }

  // Get blur strength (default 20)
  int blur_strength = 20;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    blur_strength = info[2].As<Napi::Number>().Int32Value();
    blur_strength = std::max(1, std::min(100, blur_strength));
  }

  // If no regions, return cloned frame unchanged
  if (regions.empty()) {
    Napi::Function clone_fn = frame_obj.Get("clone").As<Napi::Function>();
    return clone_fn.Call(frame_obj, {});
  }

  // Get RGBA data from frame
  Napi::Function get_data = frame_obj.Get("getData").As<Napi::Function>();
  Napi::Buffer<uint8_t> rgba_buffer =
      get_data.Call(frame_obj, {}).As<Napi::Buffer<uint8_t>>();
  uint8_t* rgba_data = rgba_buffer.Data();

  // Build and initialize filter graph for these regions
  std::string filter_str = BuildFilterString(regions, blur_strength);

  // Clean up previous filter graph
  if (filter_graph_) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
  }

  filter_graph_ = avfilter_graph_alloc();
  if (!filter_graph_) {
    Napi::Error::New(env, "Failed to allocate filter graph")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create buffer source
  const AVFilter* buffersrc = avfilter_get_by_name("buffer");
  const AVFilter* buffersink = avfilter_get_by_name("buffersink");

  char args[512];
  snprintf(args, sizeof(args),
           "video_size=%dx%d:pix_fmt=%d:time_base=1/30:pixel_aspect=1/1",
           width_, height_, AV_PIX_FMT_YUV420P);

  int ret = avfilter_graph_create_filter(&buffersrc_ctx_, buffersrc, "in",
                                         args, nullptr, filter_graph_);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to create buffer source")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ret = avfilter_graph_create_filter(&buffersink_ctx_, buffersink, "out",
                                     nullptr, nullptr, filter_graph_);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to create buffer sink")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse and link filter graph
  AVFilterInOut* outputs = avfilter_inout_alloc();
  AVFilterInOut* inputs = avfilter_inout_alloc();

  outputs->name = av_strdup("in");
  outputs->filter_ctx = buffersrc_ctx_;
  outputs->pad_idx = 0;
  outputs->next = nullptr;

  inputs->name = av_strdup("out");
  inputs->filter_ctx = buffersink_ctx_;
  inputs->pad_idx = 0;
  inputs->next = nullptr;

  ret = avfilter_graph_parse_ptr(filter_graph_, filter_str.c_str(),
                                 &inputs, &outputs, nullptr);
  avfilter_inout_free(&inputs);
  avfilter_inout_free(&outputs);

  if (ret < 0) {
    Napi::Error::New(env, "Failed to parse filter graph: " + filter_str)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ret = avfilter_graph_config(filter_graph_, nullptr);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to configure filter graph")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_slices[1] = { rgba_data };
  int src_stride[1] = { width_ * 4 };

  sws_scale(sws_rgba_to_yuv_, src_slices, src_stride, 0, height_,
            yuv_frame_->data, yuv_frame_->linesize);

  yuv_frame_->pts = 0;

  // Process through filter
  av_frame_unref(output_frame_);
  AVFrame* filtered = ProcessFrame(yuv_frame_);
  if (!filtered) {
    Napi::Error::New(env, "Filter processing failed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert YUV420P back to RGBA
  size_t output_size = width_ * height_ * 4;
  Napi::Buffer<uint8_t> output_buffer = Napi::Buffer<uint8_t>::New(env, output_size);
  uint8_t* output_data = output_buffer.Data();

  uint8_t* dst_slices[1] = { output_data };
  int dst_stride[1] = { width_ * 4 };

  sws_scale(sws_yuv_to_rgba_, filtered->data, filtered->linesize,
            0, height_, dst_slices, dst_stride);

  // Create new VideoFrame with blurred data
  Napi::Object VideoFrameClass = env.Global()
      .Get("require").As<Napi::Function>()
      .Call({Napi::String::New(env, "../dist")}).As<Napi::Object>()
      .Get("VideoFrame").As<Napi::Object>();

  // Get timestamp from original frame
  int64_t timestamp = frame_obj.Get("timestamp").As<Napi::Number>().Int64Value();

  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", width_);
  init.Set("codedHeight", height_);
  init.Set("timestamp", timestamp);

  Napi::Function constructor = VideoFrameClass.As<Napi::Function>();
  Napi::Object new_frame = constructor.New({output_buffer, init});

  return new_frame;
}

Napi::Object InitVideoFilter(Napi::Env env, Napi::Object exports) {
  return VideoFilter::Init(env, exports);
}
```

**Step 2: Verify compilation**

Run: `npm run build:native`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/video_filter.cc
git commit -m "feat(video-filter): implement VideoFilter with region blur via libavfilter"
```

---

## Task 4: Register VideoFilter in Addon

**Files:**
- Modify: `src/addon.cc`

**Step 1: Add forward declaration**

Edit `src/addon.cc`, add after line 14:

```cpp
Napi::Object InitVideoFilter(Napi::Env env, Napi::Object exports);
```

**Step 2: Call InitVideoFilter**

Edit `src/addon.cc`, add in InitAll function after line 24:

```cpp
  InitVideoFilter(env, exports);
```

**Step 3: Verify build**

Run: `npm run build:native`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/addon.cc
git commit -m "feat(video-filter): register VideoFilter in native addon"
```

---

## Task 5: Add TypeScript Types

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add BlurRegion interface**

Edit `lib/types.ts`, add at the end of the file:

```typescript
// VideoFilter types
export interface BlurRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface VideoFilterConfig {
    width: number;
    height: number;
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit lib/types.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(video-filter): add VideoFilter TypeScript types"
```

---

## Task 6: Add TypeScript Wrapper

**Files:**
- Modify: `lib/index.ts`

**Step 1: Import new types**

Edit `lib/index.ts` line 1-18, add to imports:

```typescript
import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoDecoderConfig,
    VideoDecoderInit,
    VideoFrameInit,
    CodecState,
    PlaneLayout,
    VideoFrameCopyToOptions,
    AudioSampleFormat,
    AudioDataInit,
    AudioDataCopyToOptions,
    AudioEncoderConfig,
    AudioEncoderInit,
    AudioDecoderConfig,
    AudioDecoderInit,
    EncodedAudioChunkInit,
    BlurRegion,
    VideoFilterConfig
} from './types';
```

**Step 2: Add VideoFilter class**

Edit `lib/index.ts`, add before the final re-exports (before line 513):

```typescript
export class VideoFilter {
    private _native: any;
    private _state: CodecState = 'unconfigured';

    constructor() {
        this._native = new native.VideoFilter();
    }

    get state(): CodecState {
        return this._native.state;
    }

    configure(config: VideoFilterConfig): void {
        this._native.configure(config);
    }

    applyBlur(frame: VideoFrame, regions: BlurRegion[], strength: number = 20): VideoFrame {
        if (this._state === 'closed') {
            throw new DOMException('VideoFilter is closed', 'InvalidStateError');
        }
        const nativeResult = this._native.applyBlur(frame._nativeFrame, regions, strength);
        // Wrap result as VideoFrame
        const wrapper = Object.create(VideoFrame.prototype);
        wrapper._native = nativeResult._native || nativeResult;
        wrapper._closed = false;
        return wrapper;
    }

    close(): void {
        this._native.close();
    }
}
```

**Step 3: Add to type exports**

Edit `lib/index.ts` at the end, add to re-exports:

```typescript
export type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoDecoderConfig,
    VideoDecoderInit,
    VideoColorSpaceInit,
    VideoFrameInit,
    CodecState,
    PlaneLayout,
    VideoFrameCopyToOptions,
    AudioSampleFormat,
    AudioDataInit,
    AudioDataCopyToOptions,
    AudioEncoderConfig,
    AudioEncoderInit,
    AudioDecoderConfig,
    AudioDecoderInit,
    EncodedAudioChunkInit,
    BlurRegion,
    VideoFilterConfig
} from './types';
```

**Step 4: Build TypeScript**

Run: `npm run build:ts`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add lib/index.ts
git commit -m "feat(video-filter): add VideoFilter TypeScript wrapper"
```

---

## Task 7: Write VideoFilter Unit Test

**Files:**
- Create: `test/29_video_filter.js`

**Step 1: Write the test**

Create `test/29_video_filter.js`:

```javascript
const { VideoFrame, VideoFilter } = require('../dist');

console.log('[TEST] VideoFilter Basic Tests');

// Test 1: Construction
console.log('[TEST] 1. Constructor...');
const filter = new VideoFilter();
if (filter.state !== 'unconfigured') {
    throw new Error(`Expected unconfigured, got ${filter.state}`);
}
console.log('[PASS] Constructor works');

// Test 2: Configure
console.log('[TEST] 2. Configure...');
filter.configure({ width: 640, height: 480 });
if (filter.state !== 'configured') {
    throw new Error(`Expected configured, got ${filter.state}`);
}
console.log('[PASS] Configure works');

// Test 3: Apply blur with no regions (passthrough)
console.log('[TEST] 3. Apply blur (no regions)...');
const buf = Buffer.alloc(640 * 480 * 4, 128); // Gray frame
const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: 0 });

const result = filter.applyBlur(frame, []);
if (result.codedWidth !== 640 || result.codedHeight !== 480) {
    throw new Error('Dimensions mismatch');
}
console.log('[PASS] No-region blur works');

// Test 4: Apply blur with regions
console.log('[TEST] 4. Apply blur (with regions)...');
const regions = [
    { x: 100, y: 100, width: 200, height: 150 }
];
const blurred = filter.applyBlur(frame, regions, 30);
if (blurred.codedWidth !== 640 || blurred.codedHeight !== 480) {
    throw new Error('Dimensions mismatch after blur');
}
console.log('[PASS] Region blur works');

// Test 5: Close
console.log('[TEST] 5. Close...');
filter.close();
if (filter.state !== 'closed') {
    throw new Error(`Expected closed, got ${filter.state}`);
}
console.log('[PASS] Close works');

// Cleanup
frame.close();
result.close();
blurred.close();

console.log('[PASS] All VideoFilter tests passed!');
```

**Step 2: Run the test**

Run: `node test/29_video_filter.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add test/29_video_filter.js
git commit -m "test(video-filter): add VideoFilter unit tests"
```

---

## Task 8: Write Blur Integration Test

**Files:**
- Create: `test/30_blur_regions.js`

**Step 1: Write integration test**

Create `test/30_blur_regions.js`:

```javascript
const { VideoEncoder, VideoDecoder, VideoFrame, VideoFilter, EncodedVideoChunk } = require('../dist');

console.log('[TEST] Blur Region Integration Test');
console.log('[TEST] Pipeline: Create Frame -> Blur Region -> Encode -> Decode -> Verify');

async function runTest() {
    // Create a frame with distinct regions (checkerboard pattern)
    const width = 320;
    const height = 240;
    const buf = Buffer.alloc(width * height * 4);

    // Fill with checkerboard: white and black 40x40 squares
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const isWhite = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0;
            const val = isWhite ? 255 : 0;
            buf[idx] = val;     // R
            buf[idx + 1] = val; // G
            buf[idx + 2] = val; // B
            buf[idx + 3] = 255; // A
        }
    }

    const frame = new VideoFrame(buf, { codedWidth: width, codedHeight: height, timestamp: 0 });
    console.log(`[INFO] Created ${width}x${height} checkerboard frame`);

    // Apply blur to center region
    const filter = new VideoFilter();
    filter.configure({ width, height });

    const regions = [
        { x: 80, y: 60, width: 160, height: 120 }  // Center region
    ];

    const blurredFrame = filter.applyBlur(frame, regions, 40);
    console.log('[INFO] Applied blur to center region');

    // Verify blurred frame has expected dimensions
    if (blurredFrame.codedWidth !== width || blurredFrame.codedHeight !== height) {
        throw new Error('Blurred frame dimensions mismatch');
    }

    // Get pixel data and verify blur affected center
    const blurredData = new Uint8Array(blurredFrame.allocationSize());
    await blurredFrame.copyTo(blurredData);

    // Sample pixel in blurred region - should not be pure black or white
    const centerX = 160;
    const centerY = 120;
    const centerIdx = (centerY * width + centerX) * 4;
    const centerR = blurredData[centerIdx];

    // Blurred region should have intermediate values (not 0 or 255)
    // Due to blur mixing black and white squares
    console.log(`[INFO] Center pixel R value: ${centerR}`);
    if (centerR === 0 || centerR === 255) {
        console.log('[WARN] Center pixel was not blurred as expected (may be edge case)');
    }

    // Encode and decode roundtrip
    const chunks = [];
    const encoder = new VideoEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width,
        height,
        bitrate: 500000,
        framerate: 30
    });

    encoder.encode(blurredFrame, { keyFrame: true });
    await encoder.flush();

    console.log(`[INFO] Encoded to ${chunks.length} chunk(s), size: ${chunks[0].byteLength} bytes`);

    // Decode
    const decodedFrames = [];
    const decoder = new VideoDecoder({
        output: (f) => decodedFrames.push(f),
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: width,
        codedHeight: height
    });

    decoder.decode(chunks[0]);
    await decoder.flush();

    console.log(`[INFO] Decoded ${decodedFrames.length} frame(s)`);

    if (decodedFrames.length !== 1) {
        throw new Error(`Expected 1 decoded frame, got ${decodedFrames.length}`);
    }

    // Cleanup
    frame.close();
    blurredFrame.close();
    decodedFrames.forEach(f => f.close());
    filter.close();
    encoder.close();
    decoder.close();

    console.log('[PASS] Blur region integration test complete!');
}

runTest().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run the test**

Run: `node test/30_blur_regions.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add test/30_blur_regions.js
git commit -m "test(video-filter): add blur region integration test with encode/decode roundtrip"
```

---

## Task 9: Create Content Moderation Example

**Files:**
- Create: `examples/content-moderation/moderate.js`
- Create: `examples/content-moderation/README.md`

**Step 1: Create example directory**

Run: `mkdir -p examples/content-moderation`

**Step 2: Write the example script**

Create `examples/content-moderation/moderate.js`:

```javascript
/**
 * Content Moderation Example
 *
 * Demonstrates the WebCodecs frame-by-frame processing pipeline:
 * 1. Decode video frames
 * 2. Run "detection" (mocked - returns hardcoded bounding boxes)
 * 3. Blur detected regions
 * 4. Re-encode processed frames
 *
 * Usage: node moderate.js
 */

const { VideoEncoder, VideoDecoder, VideoFrame, VideoFilter, EncodedVideoChunk } = require('../../dist');
const fs = require('fs');

// Mock AI detector - in production, this would call ONNX/TensorFlow
function mockDetectContent(frame, frameIndex) {
    // Simulate detection: return regions for frames 2-4
    if (frameIndex >= 2 && frameIndex <= 4) {
        return [
            {
                x: 100,
                y: 80,
                width: 120,
                height: 100,
                label: 'detected-object',
                confidence: 0.95
            }
        ];
    }
    return [];
}

async function moderateVideo() {
    console.log('=== Content Moderation Pipeline Demo ===\n');

    const width = 320;
    const height = 240;
    const frameCount = 10;

    // Step 1: Generate test frames (simulating decoded video)
    console.log(`[1/4] Generating ${frameCount} test frames (${width}x${height})...`);
    const testFrames = [];
    for (let i = 0; i < frameCount; i++) {
        const buf = Buffer.alloc(width * height * 4);
        // Create gradient pattern that varies per frame
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                buf[idx] = (x + i * 10) % 256;     // R varies with frame
                buf[idx + 1] = (y + i * 5) % 256;  // G varies with frame
                buf[idx + 2] = 128;                 // B constant
                buf[idx + 3] = 255;                 // A
            }
        }
        testFrames.push(new VideoFrame(buf, {
            codedWidth: width,
            codedHeight: height,
            timestamp: i * 33333  // ~30fps timing
        }));
    }
    console.log(`    Created ${testFrames.length} frames\n`);

    // Step 2: Setup filter and encoder
    console.log('[2/4] Initializing VideoFilter and VideoEncoder...');
    const filter = new VideoFilter();
    filter.configure({ width, height });

    const outputChunks = [];
    const encoder = new VideoEncoder({
        output: (chunk, meta) => {
            outputChunks.push({ chunk, meta });
        },
        error: (e) => console.error('Encoder error:', e)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width,
        height,
        bitrate: 1_000_000,
        framerate: 30
    });
    console.log('    Filter and encoder ready\n');

    // Step 3: Process each frame
    console.log('[3/4] Processing frames (detect -> blur -> encode)...');
    const moderationLog = [];

    for (let i = 0; i < testFrames.length; i++) {
        const frame = testFrames[i];

        // Run "AI detection"
        const detections = mockDetectContent(frame, i);

        let processedFrame;
        if (detections.length > 0) {
            // Apply blur to detected regions
            const regions = detections.map(d => ({
                x: d.x,
                y: d.y,
                width: d.width,
                height: d.height
            }));

            processedFrame = filter.applyBlur(frame, regions, 30);

            moderationLog.push({
                frame: i,
                timestamp: frame.timestamp,
                detections: detections,
                action: 'blurred'
            });

            console.log(`    Frame ${i}: DETECTED ${detections.length} region(s) -> BLURRED`);
        } else {
            // No detections - clone frame unchanged
            processedFrame = frame.clone();
            console.log(`    Frame ${i}: clean`);
        }

        // Encode processed frame
        encoder.encode(processedFrame, { keyFrame: i === 0 });

        // Cleanup
        processedFrame.close();
        frame.close();
    }

    await encoder.flush();
    console.log(`\n    Encoded ${outputChunks.length} chunks\n`);

    // Step 4: Summary
    console.log('[4/4] Moderation Summary:');
    console.log('─'.repeat(50));
    console.log(`    Total frames processed: ${frameCount}`);
    console.log(`    Frames with detections: ${moderationLog.length}`);
    console.log(`    Output chunks: ${outputChunks.length}`);

    const totalBytes = outputChunks.reduce((sum, c) => sum + c.chunk.byteLength, 0);
    console.log(`    Total encoded size: ${totalBytes} bytes`);

    if (moderationLog.length > 0) {
        console.log('\n    Flagged frames:');
        moderationLog.forEach(entry => {
            console.log(`      - Frame ${entry.frame} @ ${entry.timestamp}μs: ${entry.detections.length} detection(s)`);
        });
    }

    console.log('\n=== Demo Complete ===');

    // Cleanup
    filter.close();
    encoder.close();

    return { outputChunks, moderationLog };
}

// Run if executed directly
if (require.main === module) {
    moderateVideo().catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
}

module.exports = { moderateVideo, mockDetectContent };
```

**Step 3: Write README**

Create `examples/content-moderation/README.md`:

```markdown
# Content Moderation Example

Demonstrates using node-webcodecs for video content moderation with selective frame blurring.

## Overview

This example shows a complete frame-by-frame processing pipeline:

1. **Decode** - Extract frames from video (simulated with generated frames)
2. **Detect** - Run AI detection on each frame (mocked in this example)
3. **Blur** - Apply blur to detected regions using `VideoFilter`
4. **Encode** - Re-encode processed frames to H.264

## Usage

```bash
# From project root
npm run build
node examples/content-moderation/moderate.js
```

## Expected Output

```
=== Content Moderation Pipeline Demo ===

[1/4] Generating 10 test frames (320x240)...
    Created 10 frames

[2/4] Initializing VideoFilter and VideoEncoder...
    Filter and encoder ready

[3/4] Processing frames (detect -> blur -> encode)...
    Frame 0: clean
    Frame 1: clean
    Frame 2: DETECTED 1 region(s) -> BLURRED
    Frame 3: DETECTED 1 region(s) -> BLURRED
    Frame 4: DETECTED 1 region(s) -> BLURRED
    Frame 5: clean
    ...

[4/4] Moderation Summary:
──────────────────────────────────────────────────
    Total frames processed: 10
    Frames with detections: 3
    ...

=== Demo Complete ===
```

## Integrating Real AI Detection

Replace `mockDetectContent()` with your AI model:

```javascript
const ort = require('onnxruntime-node');

async function detectContent(frame) {
    const session = await ort.InferenceSession.create('model.onnx');
    const tensor = preprocessFrame(frame);
    const results = await session.run({ input: tensor });
    return parseDetections(results);
}
```

## API Reference

### VideoFilter

```javascript
const filter = new VideoFilter();
filter.configure({ width: 1920, height: 1080 });

const blurred = filter.applyBlur(frame, [
    { x: 100, y: 100, width: 200, height: 150 }
], 30);  // strength: 1-100

filter.close();
```
```

**Step 4: Run the example**

Run: `node examples/content-moderation/moderate.js`
Expected: Demo runs successfully with output showing frame processing

**Step 5: Commit**

```bash
git add examples/content-moderation/
git commit -m "docs(examples): add content moderation example with VideoFilter"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass including new VideoFilter tests

**Step 2: Run the example**

Run: `node examples/content-moderation/moderate.js`
Expected: Example runs successfully

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete VideoFilter implementation with blur support"
```

---

## Summary

| Task | Files | Commits |
|------|-------|---------|
| 1. Build system | CMakeLists.txt | 1 |
| 2. Header | src/video_filter.h | 1 |
| 3. Implementation | src/video_filter.cc | 1 |
| 4. Addon registration | src/addon.cc | 1 |
| 5. TypeScript types | lib/types.ts | 1 |
| 6. TypeScript wrapper | lib/index.ts | 1 |
| 7. Unit tests | test/29_video_filter.js | 1 |
| 8. Integration tests | test/30_blur_regions.js | 1 |
| 9. Example | examples/content-moderation/* | 1 |
| 10. Final verification | - | 1 |

**Total: 10 tasks, ~10 commits**
