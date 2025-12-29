# WebCodecs Node.js MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement WebCodecs VideoEncoder API for Node.js using FFmpeg native bindings to enable server-side video encoding.

**Architecture:** Native C++ addon using node-addon-api wraps FFmpeg's libavcodec/libswscale. TypeScript layer provides WebCodecs-compliant API surface. RGB buffers from JS are converted to YUV in C++ before encoding to H.264.

**Tech Stack:** Node.js 18+, node-addon-api, cmake-js, FFmpeg (libavcodec, libavutil, libswscale), TypeScript

---

## Prerequisites (Manual Steps)

Before starting, ensure FFmpeg development libraries are installed:

**Mac:**
```bash
brew install ffmpeg pkg-config cmake
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install libavcodec-dev libavutil-dev libavformat-dev libswscale-dev pkg-config cmake
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "node-webcodecs",
  "version": "0.1.0",
  "description": "WebCodecs API implementation for Node.js using FFmpeg",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build:native": "cmake-js compile",
    "build:ts": "tsc",
    "build": "npm run build:native && npm run build:ts",
    "test": "node test/suite.js",
    "clean": "rm -rf build dist"
  },
  "keywords": ["webcodecs", "video", "encoder", "ffmpeg", "nodejs"],
  "license": "MIT",
  "dependencies": {
    "node-addon-api": "^7.0.0"
  },
  "devDependencies": {
    "cmake-js": "^7.3.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create .gitignore**

```
node_modules/
build/
dist/
*.node
.DS_Store
output.h264
*.mp4
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./lib",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["lib/**/*"],
  "exclude": ["node_modules", "build", "dist"]
}
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: `added X packages`

**Step 5: Commit**

```bash
git init
git add package.json .gitignore tsconfig.json
git commit -m "chore: initial project setup"
```

---

## Task 2: CMake Build Configuration

**Files:**
- Create: `CMakeLists.txt`

**Step 1: Create CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.10)
project(node_webcodecs)

# C++17 for modern features
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Node-API configuration
add_definitions(-DNAPI_VERSION=8)
add_definitions(-DNAPI_CPP_EXCEPTIONS)

# Find FFmpeg libraries using pkg-config
find_package(PkgConfig REQUIRED)
pkg_check_modules(AVCODEC REQUIRED libavcodec)
pkg_check_modules(AVUTIL REQUIRED libavutil)
pkg_check_modules(SWSCALE REQUIRED libswscale)

# Include cmake-js headers
include_directories(${CMAKE_JS_INC})

# Source files
file(GLOB SOURCE_FILES
    "src/*.cpp"
    "src/*.h"
)

# Build shared library
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

# Set output name and extension for Node.js
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    ${AVCODEC_INCLUDE_DIRS}
    ${AVUTIL_INCLUDE_DIRS}
    ${SWSCALE_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(${PROJECT_NAME}
    ${CMAKE_JS_LIB}
    ${AVCODEC_LIBRARIES}
    ${AVUTIL_LIBRARIES}
    ${SWSCALE_LIBRARIES}
)

# Link directories for FFmpeg
target_link_directories(${PROJECT_NAME} PRIVATE
    ${AVCODEC_LIBRARY_DIRS}
    ${AVUTIL_LIBRARY_DIRS}
    ${SWSCALE_LIBRARY_DIRS}
)
```

**Step 2: Verify cmake-js can parse it**

Run: `npx cmake-js print-configure`
Expected: Shows cmake configuration (no errors)

**Step 3: Commit**

```bash
git add CMakeLists.txt
git commit -m "build: add CMake configuration for FFmpeg"
```

---

## Task 3: Native Addon Entry Point (Stub)

**Files:**
- Create: `src/addon.cpp`

**Step 1: Create minimal addon.cpp**

```cpp
#include <napi.h>

// Forward declarations
Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports);

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    InitVideoEncoder(env, exports);
    InitVideoFrame(env, exports);
    return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
```

**Step 2: Create stub video_encoder.cpp**

Create: `src/video_encoder.cpp`

```cpp
#include <napi.h>

Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports) {
    // Stub - will be implemented
    return exports;
}
```

**Step 3: Create stub video_frame.cpp**

Create: `src/video_frame.cpp`

```cpp
#include <napi.h>

Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports) {
    // Stub - will be implemented
    return exports;
}
```

**Step 4: Compile native addon**

Run: `npm run build:native`
Expected: `[100%] Built target node_webcodecs` and `build/Release/node_webcodecs.node` exists

**Step 5: Verify module loads**

Run: `node -e "require('./build/Release/node_webcodecs.node'); console.log('OK')"`
Expected: `OK`

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add native addon stub that compiles"
```

---

## Task 4: VideoFrame Implementation

**Files:**
- Modify: `src/video_frame.cpp`
- Create: `src/video_frame.h`
- Create: `test/03_frame.js`

**Step 1: Write the failing test**

Create: `test/03_frame.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 3: VideoFrame Allocation');

const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4); // RGBA

const frame = new native.VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    format: 'RGBA',
    timestamp: 0
});

assert.strictEqual(frame.codedWidth, 100);
assert.strictEqual(frame.codedHeight, 100);
assert.strictEqual(frame.timestamp, 0);

frame.close();
console.log('✅ PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/03_frame.js`
Expected: `TypeError: native.VideoFrame is not a constructor`

**Step 3: Create video_frame.h**

```cpp
#ifndef VIDEO_FRAME_H
#define VIDEO_FRAME_H

#include <napi.h>
#include <vector>

class VideoFrame : public Napi::ObjectWrap<VideoFrame> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoFrame(const Napi::CallbackInfo& info);
    ~VideoFrame();

    // Getters
    Napi::Value GetCodedWidth(const Napi::CallbackInfo& info);
    Napi::Value GetCodedHeight(const Napi::CallbackInfo& info);
    Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
    Napi::Value GetFormat(const Napi::CallbackInfo& info);

    // Methods
    void Close(const Napi::CallbackInfo& info);

    // Internal accessors for VideoEncoder
    uint8_t* GetData() { return data_.data(); }
    size_t GetDataSize() { return data_.size(); }
    int GetWidth() { return codedWidth_; }
    int GetHeight() { return codedHeight_; }

private:
    std::vector<uint8_t> data_;
    int codedWidth_;
    int codedHeight_;
    int64_t timestamp_;
    std::string format_;
    bool closed_;
};

#endif
```

**Step 4: Implement video_frame.cpp**

```cpp
#include "video_frame.h"

Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports) {
    return VideoFrame::Init(env, exports);
}

Napi::Object VideoFrame::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoFrame", {
        InstanceAccessor("codedWidth", &VideoFrame::GetCodedWidth, nullptr),
        InstanceAccessor("codedHeight", &VideoFrame::GetCodedHeight, nullptr),
        InstanceAccessor("timestamp", &VideoFrame::GetTimestamp, nullptr),
        InstanceAccessor("format", &VideoFrame::GetFormat, nullptr),
        InstanceMethod("close", &VideoFrame::Close),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("VideoFrame", func);
    return exports;
}

VideoFrame::VideoFrame(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFrame>(info), closed_(false) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        throw Napi::Error::New(env, "VideoFrame requires buffer and options");
    }

    // Get buffer data
    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    data_.assign(buffer.Data(), buffer.Data() + buffer.Length());

    // Get options
    Napi::Object opts = info[1].As<Napi::Object>();
    codedWidth_ = opts.Get("codedWidth").As<Napi::Number>().Int32Value();
    codedHeight_ = opts.Get("codedHeight").As<Napi::Number>().Int32Value();
    timestamp_ = opts.Get("timestamp").As<Napi::Number>().Int64Value();

    if (opts.Has("format")) {
        format_ = opts.Get("format").As<Napi::String>().Utf8Value();
    } else {
        format_ = "RGBA";
    }
}

VideoFrame::~VideoFrame() {
    data_.clear();
}

Napi::Value VideoFrame::GetCodedWidth(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), codedWidth_);
}

Napi::Value VideoFrame::GetCodedHeight(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), codedHeight_);
}

Napi::Value VideoFrame::GetTimestamp(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value VideoFrame::GetFormat(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), format_);
}

void VideoFrame::Close(const Napi::CallbackInfo& info) {
    if (!closed_) {
        data_.clear();
        closed_ = true;
    }
}
```

**Step 5: Rebuild and run test**

Run: `npm run build:native && node test/03_frame.js`
Expected: `✅ PASS`

**Step 6: Commit**

```bash
git add src/video_frame.h src/video_frame.cpp test/03_frame.js
git commit -m "feat: implement VideoFrame class"
```

---

## Task 5: VideoEncoder Configuration

**Files:**
- Modify: `src/video_encoder.cpp`
- Create: `src/video_encoder.h`
- Create: `test/02_config.js`

**Step 1: Write the failing test**

Create: `test/02_config.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 2: Configuration Validation');

const encoder = new native.VideoEncoder({
    output: () => {},
    error: (e) => console.error(e)
});

// Case A: Valid Config (should not throw)
try {
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1000000,
        framerate: 30
    });
    console.log('Valid config accepted');
} catch (e) {
    console.error('Valid config threw:', e);
    process.exit(1);
}

encoder.close();
console.log('✅ PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/02_config.js`
Expected: `TypeError: native.VideoEncoder is not a constructor`

**Step 3: Create video_encoder.h**

```cpp
#ifndef VIDEO_ENCODER_H
#define VIDEO_ENCODER_H

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoEncoder(const Napi::CallbackInfo& info);
    ~VideoEncoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Encode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetState(const Napi::CallbackInfo& info);

    // Internal helpers
    void Cleanup();
    void EmitChunks(Napi::Env env);

    // FFmpeg state
    const AVCodec* codec_;
    AVCodecContext* codecContext_;
    SwsContext* swsContext_;
    AVFrame* frame_;
    AVPacket* packet_;

    // Callbacks
    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    // State
    std::string state_;
    int width_;
    int height_;
    int64_t frameCount_;
};

#endif
```

**Step 4: Implement video_encoder.cpp (Configure only)**

```cpp
#include "video_encoder.h"
#include "video_frame.h"

Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports) {
    return VideoEncoder::Init(env, exports);
}

Napi::Object VideoEncoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoEncoder", {
        InstanceMethod("configure", &VideoEncoder::Configure),
        InstanceMethod("encode", &VideoEncoder::Encode),
        InstanceMethod("flush", &VideoEncoder::Flush),
        InstanceMethod("close", &VideoEncoder::Close),
        InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
    });

    exports.Set("VideoEncoder", func);
    return exports;
}

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
      frameCount_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "VideoEncoder requires init object with output and error callbacks");
    }

    Napi::Object init = info[0].As<Napi::Object>();

    if (!init.Has("output") || !init.Get("output").IsFunction()) {
        throw Napi::Error::New(env, "init.output must be a function");
    }
    if (!init.Has("error") || !init.Get("error").IsFunction()) {
        throw Napi::Error::New(env, "init.error must be a function");
    }

    outputCallback_ = Napi::Persistent(init.Get("output").As<Napi::Function>());
    errorCallback_ = Napi::Persistent(init.Get("error").As<Napi::Function>());
}

VideoEncoder::~VideoEncoder() {
    Cleanup();
}

void VideoEncoder::Cleanup() {
    if (frame_) {
        av_frame_free(&frame_);
        frame_ = nullptr;
    }
    if (packet_) {
        av_packet_free(&packet_);
        packet_ = nullptr;
    }
    if (swsContext_) {
        sws_freeContext(swsContext_);
        swsContext_ = nullptr;
    }
    if (codecContext_) {
        avcodec_free_context(&codecContext_);
        codecContext_ = nullptr;
    }
    codec_ = nullptr;
}

Napi::Value VideoEncoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse config
    width_ = config.Get("width").As<Napi::Number>().Int32Value();
    height_ = config.Get("height").As<Napi::Number>().Int32Value();

    int bitrate = 1000000; // Default 1Mbps
    if (config.Has("bitrate")) {
        bitrate = config.Get("bitrate").As<Napi::Number>().Int32Value();
    }

    int framerate = 30; // Default 30fps
    if (config.Has("framerate")) {
        framerate = config.Get("framerate").As<Napi::Number>().Int32Value();
    }

    // Find H.264 encoder
    codec_ = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec_) {
        throw Napi::Error::New(env, "H.264 encoder not found");
    }

    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Configure encoder
    codecContext_->width = width_;
    codecContext_->height = height_;
    codecContext_->time_base = {1, framerate};
    codecContext_->framerate = {framerate, 1};
    codecContext_->pix_fmt = AV_PIX_FMT_YUV420P;
    codecContext_->bit_rate = bitrate;
    codecContext_->gop_size = 30; // Keyframe every 30 frames
    codecContext_->max_b_frames = 2;

    // H.264 specific options
    av_opt_set(codecContext_->priv_data, "preset", "fast", 0);
    av_opt_set(codecContext_->priv_data, "tune", "zerolatency", 0);

    int ret = avcodec_open2(codecContext_, codec_, nullptr);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        Cleanup();
        throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
    }

    // Allocate frame and packet
    frame_ = av_frame_alloc();
    frame_->format = codecContext_->pix_fmt;
    frame_->width = width_;
    frame_->height = height_;
    av_frame_get_buffer(frame_, 32);

    packet_ = av_packet_alloc();

    // Setup color converter (RGBA -> YUV420P)
    swsContext_ = sws_getContext(
        width_, height_, AV_PIX_FMT_RGBA,
        width_, height_, AV_PIX_FMT_YUV420P,
        SWS_BILINEAR, nullptr, nullptr, nullptr
    );

    state_ = "configured";
    frameCount_ = 0;

    return env.Undefined();
}

Napi::Value VideoEncoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

// Stub implementations for now
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    return info.Env().Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    return info.Env().Undefined();
}

void VideoEncoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}
```

**Step 5: Rebuild and run test**

Run: `npm run build:native && node test/02_config.js`
Expected: `✅ PASS`

**Step 6: Commit**

```bash
git add src/video_encoder.h src/video_encoder.cpp test/02_config.js
git commit -m "feat: implement VideoEncoder configure()"
```

---

## Task 6: VideoEncoder Encode Method

**Files:**
- Modify: `src/video_encoder.cpp`
- Create: `test/04_encoding.js`

**Step 1: Write the failing test**

Create: `test/04_encoding.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 4: End-to-End Encoding');

let chunksReceived = 0;
let firstChunkIsKey = false;

const encoder = new native.VideoEncoder({
    output: (chunk, metadata) => {
        chunksReceived++;
        if (chunksReceived === 1) {
            firstChunkIsKey = chunk.type === 'key';
        }
        console.log(`Chunk ${chunksReceived}: type=${chunk.type} size=${chunk.data.length} ts=${chunk.timestamp}`);
    },
    error: (e) => {
        console.error('Encoder error:', e);
        process.exit(1);
    }
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30
});

const w = 640, h = 480;
const frameSize = w * h * 4;

// Encode 30 frames
for (let i = 0; i < 30; i++) {
    const buf = Buffer.alloc(frameSize);
    // Fill with pattern
    for (let j = 0; j < frameSize; j += 4) {
        buf[j] = i * 8;     // R
        buf[j+1] = 128;     // G
        buf[j+2] = 255 - i * 8; // B
        buf[j+3] = 255;     // A
    }

    const frame = new native.VideoFrame(buf, {
        codedWidth: w,
        codedHeight: h,
        timestamp: i * 33333
    });

    encoder.encode(frame);
    frame.close();
}

// Flush to get remaining frames
encoder.flush();
encoder.close();

console.log(`Total chunks received: ${chunksReceived}`);
assert.ok(chunksReceived > 0, 'Should have received encoded chunks');
assert.ok(firstChunkIsKey, 'First chunk must be a keyframe');
console.log('✅ PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/04_encoding.js`
Expected: `Total chunks received: 0` (encode is stubbed)

**Step 3: Implement Encode and Flush methods**

Update `src/video_encoder.cpp`, replace the Encode and Flush stubs:

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

    // Convert RGBA to YUV420P
    const uint8_t* srcData[] = { videoFrame->GetData() };
    int srcLinesize[] = { videoFrame->GetWidth() * 4 };

    sws_scale(swsContext_, srcData, srcLinesize, 0, height_,
              frame_->data, frame_->linesize);

    frame_->pts = frameCount_++;

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

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        return env.Undefined();
    }

    // Send NULL frame to flush encoder
    avcodec_send_frame(codecContext_, nullptr);

    // Get remaining packets
    EmitChunks(env);

    return env.Undefined();
}

void VideoEncoder::EmitChunks(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_packet(codecContext_, packet_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Encoding error: ") + errbuf).Value() });
            break;
        }

        // Create EncodedVideoChunk-like object
        Napi::Object chunk = Napi::Object::New(env);
        chunk.Set("type", (packet_->flags & AV_PKT_FLAG_KEY) ? "key" : "delta");
        chunk.Set("timestamp", Napi::Number::New(env, packet_->pts));
        chunk.Set("duration", Napi::Number::New(env, packet_->duration));
        chunk.Set("data", Napi::Buffer<uint8_t>::Copy(env, packet_->data, packet_->size));

        // Call output callback
        outputCallback_.Call({ chunk, env.Null() });

        av_packet_unref(packet_);
    }
}
```

**Step 4: Rebuild and run test**

Run: `npm run build:native && node test/04_encoding.js`
Expected: `✅ PASS` with multiple chunks logged

**Step 5: Commit**

```bash
git add src/video_encoder.cpp test/04_encoding.js
git commit -m "feat: implement VideoEncoder encode() and flush()"
```

---

## Task 7: TypeScript API Layer

**Files:**
- Create: `lib/types.ts`
- Create: `lib/index.ts`
- Create: `test/01_smoke.js`

**Step 1: Write the failing test**

Create: `test/01_smoke.js`

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');
const assert = require('assert');

console.log('Test 1: Smoke Test - Loading Module');
assert.ok(VideoEncoder, 'VideoEncoder should be exported');
assert.ok(VideoFrame, 'VideoFrame should be exported');
console.log('✅ PASS');
```

**Step 2: Run test to verify it fails**

Run: `npm run build:ts && node test/01_smoke.js`
Expected: `Cannot find module '../dist'`

**Step 3: Create lib/types.ts**

```typescript
export interface VideoEncoderConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
    latencyMode?: 'quality' | 'realtime';
}

export interface VideoEncoderInit {
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
    error: (error: Error) => void;
}

export interface EncodedVideoChunk {
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
    data: Buffer;
    byteLength: number;
}

export interface EncodedVideoChunkMetadata {
    decoderConfig?: {
        codec: string;
        codedWidth: number;
        codedHeight: number;
        description?: ArrayBuffer;
    };
}

export interface VideoFrameInit {
    codedWidth: number;
    codedHeight: number;
    timestamp: number;
    duration?: number;
    format?: 'RGBA' | 'BGRA' | 'I420' | 'NV12';
}

export type CodecState = 'unconfigured' | 'configured' | 'closed';
```

**Step 4: Create lib/index.ts**

```typescript
import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
} from './types';

// Load native addon
const native = require('../build/Release/node_webcodecs.node');

export class VideoFrame {
    private _native: any;
    private _closed: boolean = false;

    constructor(data: Buffer, init: VideoFrameInit) {
        this._native = new native.VideoFrame(data, init);
    }

    get codedWidth(): number {
        return this._native.codedWidth;
    }

    get codedHeight(): number {
        return this._native.codedHeight;
    }

    get timestamp(): number {
        return this._native.timestamp;
    }

    get format(): string {
        return this._native.format;
    }

    close(): void {
        if (!this._closed) {
            this._native.close();
            this._closed = true;
        }
    }

    // Internal access for native binding
    get _nativeFrame(): any {
        return this._native;
    }
}

export class VideoEncoder {
    private _native: any;
    private _state: CodecState = 'unconfigured';

    constructor(init: VideoEncoderInit) {
        this._native = new native.VideoEncoder({
            output: (chunk: any, metadata: any) => {
                // Wrap native chunk with byteLength getter
                const wrappedChunk: EncodedVideoChunk = {
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data,
                    get byteLength() { return this.data.length; }
                };
                init.output(wrappedChunk, metadata);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    configure(config: VideoEncoderConfig): void {
        this._native.configure(config);
    }

    encode(frame: VideoFrame): void {
        this._native.encode(frame._nativeFrame);
    }

    flush(): void {
        this._native.flush();
    }

    close(): void {
        this._native.close();
    }
}

// Re-export types
export type {
    VideoEncoderConfig,
    VideoEncoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
} from './types';
```

**Step 5: Build and run test**

Run: `npm run build:ts && node test/01_smoke.js`
Expected: `✅ PASS`

**Step 6: Commit**

```bash
git add lib/
git commit -m "feat: add TypeScript API layer"
```

---

## Task 8: Test Suite Runner

**Files:**
- Create: `test/suite.js`

**Step 1: Create test suite runner**

```javascript
const { execSync } = require('child_process');
const path = require('path');

const tests = [
    '01_smoke.js',
    '02_config.js',
    '03_frame.js',
    '04_encoding.js'
];

console.log('Running WebCodecs Node.js Test Suite\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const test of tests) {
    const testPath = path.join(__dirname, test);
    console.log(`\nRunning ${test}...`);
    console.log('-'.repeat(50));

    try {
        execSync(`node "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        passed++;
    } catch (e) {
        failed++;
        console.log(`FAILED: ${test}`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}
```

**Step 2: Run full suite**

Run: `npm test`
Expected: `Results: 4 passed, 0 failed`

**Step 3: Commit**

```bash
git add test/suite.js
git commit -m "test: add test suite runner"
```

---

## Task 9: Example and Documentation

**Files:**
- Create: `examples/basic-encode.js`
- Create: `README.md`

**Step 1: Create basic-encode.js example**

```javascript
const fs = require('fs');
const { VideoEncoder, VideoFrame } = require('../dist');

// Output file
const outFile = fs.createWriteStream('output.h264');
let totalBytes = 0;

// Create encoder
const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
        console.log(`[${chunk.type}] ts=${chunk.timestamp} size=${chunk.byteLength}`);
        outFile.write(chunk.data);
        totalBytes += chunk.byteLength;
    },
    error: (e) => {
        console.error('Encoder error:', e);
    }
});

// Configure for 720p H.264
encoder.configure({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30
});

const width = 1280;
const height = 720;
const frameSize = width * height * 4;
const fps = 30;
const duration = 5; // seconds
const totalFrames = fps * duration;

console.log(`Encoding ${totalFrames} frames (${duration}s @ ${fps}fps)...`);

for (let i = 0; i < totalFrames; i++) {
    // Generate gradient frame
    const buffer = Buffer.alloc(frameSize);
    const progress = i / totalFrames;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            buffer[idx] = Math.floor((x / width) * 255);     // R: horizontal gradient
            buffer[idx + 1] = Math.floor((y / height) * 255); // G: vertical gradient
            buffer[idx + 2] = Math.floor(progress * 255);     // B: time-based
            buffer[idx + 3] = 255;                             // A
        }
    }

    const frame = new VideoFrame(buffer, {
        codedWidth: width,
        codedHeight: height,
        timestamp: Math.floor(i * (1000000 / fps)) // microseconds
    });

    encoder.encode(frame);
    frame.close();

    if ((i + 1) % 30 === 0) {
        console.log(`Progress: ${i + 1}/${totalFrames} frames`);
    }
}

encoder.flush();
encoder.close();
outFile.end();

console.log(`\nDone! Output: output.h264 (${totalBytes} bytes)`);
console.log('Play with: ffplay output.h264');
```

**Step 2: Create README.md**

```markdown
# node-webcodecs

WebCodecs API implementation for Node.js using FFmpeg.

## Installation

### Prerequisites

**macOS:**
```bash
brew install ffmpeg pkg-config cmake
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libavcodec-dev libavutil-dev libavformat-dev libswscale-dev pkg-config cmake
```

### Install

```bash
npm install
npm run build
```

## Quick Start

```javascript
const { VideoEncoder, VideoFrame } = require('node-webcodecs');

const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
        console.log(`Encoded: ${chunk.type} ${chunk.byteLength} bytes`);
    },
    error: (e) => console.error(e)
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30
});

// Create and encode frames
const buffer = Buffer.alloc(1280 * 720 * 4); // RGBA
const frame = new VideoFrame(buffer, {
    codedWidth: 1280,
    codedHeight: 720,
    timestamp: 0
});

encoder.encode(frame);
frame.close();

encoder.flush();
encoder.close();
```

## API

### VideoEncoder

- `new VideoEncoder({ output, error })` - Create encoder with callbacks
- `configure(config)` - Configure codec settings
- `encode(frame)` - Encode a VideoFrame
- `flush()` - Flush remaining frames
- `close()` - Close encoder and free resources

### VideoFrame

- `new VideoFrame(buffer, { codedWidth, codedHeight, timestamp })` - Create frame from RGBA buffer
- `codedWidth`, `codedHeight`, `timestamp`, `format` - Properties
- `close()` - Free resources

## Examples

```bash
node examples/basic-encode.js
ffplay output.h264
```

## Development

```bash
npm run build:native  # Build C++ addon
npm run build:ts      # Build TypeScript
npm run build         # Build all
npm test              # Run tests
```

## Known Limitations

- Currently only supports H.264 encoding
- Input format is RGBA only
- Synchronous encoding (no AsyncWorker yet)
- Audio not yet implemented

## License

MIT

## Submission

WebCodecs Node.js $10k Challenge entry by [Your Name].
```

**Step 3: Run example**

Run: `node examples/basic-encode.js`
Expected: Creates `output.h264` file

**Step 4: Verify with ffplay**

Run: `ffplay output.h264` (or VLC)
Expected: Plays gradient video

**Step 5: Commit**

```bash
git add examples/ README.md
git commit -m "docs: add example and README"
```

---

## Task 10: Final Verification

**Step 1: Clean build**

```bash
npm run clean
npm install
npm run build
```

**Step 2: Run all tests**

```bash
npm test
```
Expected: `Results: 4 passed, 0 failed`

**Step 3: Run example**

```bash
node examples/basic-encode.js
```
Expected: Creates playable `output.h264`

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for submission"
```

---

## Submission Preparation

1. **Push to GitHub:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/node-webcodecs.git
git push -u origin main
```

2. **Create issue on challenge repo** with:
   - Implementation explanation
   - Build/run instructions
   - Your name

---
