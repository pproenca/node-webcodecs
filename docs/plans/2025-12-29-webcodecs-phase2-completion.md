# WebCodecs Node.js Phase 2: Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the WebCodecs Node.js implementation to production-ready status by implementing Video Decoding, completing Video Encoding spec compliance, and adding essential features.

**Architecture:** Native C++ addon (node-addon-api) wrapping FFmpeg's libavcodec/libavutil/libswscale. TypeScript layer provides WebCodecs-compliant API surface. The existing VideoEncoder and VideoFrame implementations serve as templates for new classes.

**Tech Stack:** Node.js 18+, node-addon-api, cmake-js, FFmpeg (libavcodec, libavutil, libswscale, libswresample), TypeScript 5.3+

---

## Phase Overview

This plan focuses on **Priority 1-3** items from the master TODO:

1. **P1: Complete Video Encoding (A1)** - Fill remaining gaps in VideoEncoder
2. **P2: Video Decoding (A2)** - New VideoDecoder class
3. **P2: Error Handling (D2)** - DOMException-compatible errors
4. **P3: Memory Management (D3)** - VideoFrame.clone(), proper resource tracking

---

## Task 1: VideoEncoder.reset() Method

**Files:**
- Modify: `src/video_encoder.cpp`
- Modify: `src/video_encoder.h`
- Create: `test/10_encoder_reset.js`

**Step 1: Write the failing test**

Create: `test/10_encoder_reset.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 10: VideoEncoder reset()');

let chunksReceived = 0;

const encoder = new native.VideoEncoder({
    output: (chunk) => { chunksReceived++; },
    error: (e) => console.error(e)
});

// Configure and encode one frame
encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30
});

assert.strictEqual(encoder.state, 'configured', 'Should be configured');

const buf = Buffer.alloc(320 * 240 * 4);
const frame = new native.VideoFrame(buf, {
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0
});
encoder.encode(frame);
frame.close();

// Reset should return to unconfigured
encoder.reset();
assert.strictEqual(encoder.state, 'unconfigured', 'Should be unconfigured after reset');

// Should be able to reconfigure
encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30
});
assert.strictEqual(encoder.state, 'configured', 'Should be reconfigured');

encoder.close();
console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/10_encoder_reset.js`
Expected: `TypeError: encoder.reset is not a function`

**Step 3: Add reset() declaration to video_encoder.h**

Add to the private methods section:

```cpp
Napi::Value Reset(const Napi::CallbackInfo& info);
```

**Step 4: Register reset() in Init function**

In `src/video_encoder.cpp`, in the `Init` function's DefineClass call, add:

```cpp
InstanceMethod("reset", &VideoEncoder::Reset),
```

**Step 5: Implement reset() method**

Add to `src/video_encoder.cpp`:

```cpp
Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset a closed encoder");
    }

    // Flush any pending frames (don't emit - discard)
    if (codecContext_) {
        avcodec_send_frame(codecContext_, nullptr);
        while (avcodec_receive_packet(codecContext_, packet_) == 0) {
            av_packet_unref(packet_);
        }
    }

    // Clean up FFmpeg resources
    Cleanup();

    // Reset state
    state_ = "unconfigured";
    frameCount_ = 0;

    return env.Undefined();
}
```

**Step 6: Rebuild and run test**

Run: `npm run build:native && node test/10_encoder_reset.js`
Expected: `PASS`

**Step 7: Commit**

```bash
git add src/video_encoder.cpp src/video_encoder.h test/10_encoder_reset.js
git commit -m "feat(encoder): implement reset() method to return to unconfigured state"
```

---

## Task 2: VideoEncoder.isConfigSupported() Static Method

**Files:**
- Modify: `src/video_encoder.cpp`
- Modify: `src/video_encoder.h`
- Modify: `lib/index.ts`
- Create: `test/11_config_supported.js`

**Step 1: Write the failing test**

Create: `test/11_config_supported.js`

```javascript
const { VideoEncoder } = require('../dist');
const assert = require('assert');

console.log('Test 11: VideoEncoder.isConfigSupported()');

async function runTest() {
    // Test valid H.264 config
    const result1 = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 1280,
        height: 720,
        bitrate: 2000000,
        framerate: 30
    });

    assert.strictEqual(result1.supported, true, 'H.264 should be supported');
    assert.strictEqual(result1.config.codec, 'avc1.42001E');
    assert.strictEqual(result1.config.width, 1280);
    assert.strictEqual(result1.config.height, 720);

    // Test unsupported codec
    const result2 = await VideoEncoder.isConfigSupported({
        codec: 'unsupported-codec',
        width: 1280,
        height: 720
    });

    assert.strictEqual(result2.supported, false, 'Unknown codec should not be supported');

    // Test invalid dimensions
    const result3 = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: -100,
        height: 720
    });

    assert.strictEqual(result3.supported, false, 'Negative dimensions should not be supported');

    console.log('PASS');
}

runTest().catch(e => {
    console.error('FAIL:', e);
    process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:ts && node test/11_config_supported.js`
Expected: `TypeError: VideoEncoder.isConfigSupported is not a function`

**Step 3: Add static method to native code**

In `src/video_encoder.h`, add to public section:

```cpp
static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
```

**Step 4: Register static method in Init**

In `src/video_encoder.cpp`, modify the `Init` function to register the static method:

```cpp
Napi::Object VideoEncoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoEncoder", {
        InstanceMethod("configure", &VideoEncoder::Configure),
        InstanceMethod("encode", &VideoEncoder::Encode),
        InstanceMethod("flush", &VideoEncoder::Flush),
        InstanceMethod("reset", &VideoEncoder::Reset),
        InstanceMethod("close", &VideoEncoder::Close),
        InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
        InstanceAccessor("encodeQueueSize", &VideoEncoder::GetEncodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &VideoEncoder::IsConfigSupported),
    });

    exports.Set("VideoEncoder", func);
    return exports;
}
```

**Step 5: Implement isConfigSupported()**

Add to `src/video_encoder.cpp`:

```cpp
Napi::Value VideoEncoder::IsConfigSupported(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        // Return Promise rejecting with error
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Reject(Napi::Error::New(env, "config must be an object").Value());
        return deferred.Promise();
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Create result object
    Napi::Object result = Napi::Object::New(env);
    bool supported = true;

    // Copy recognized config properties
    Napi::Object normalizedConfig = Napi::Object::New(env);

    // Validate codec
    if (!config.Has("codec") || !config.Get("codec").IsString()) {
        supported = false;
    } else {
        std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
        normalizedConfig.Set("codec", codec);

        // Check if codec is supported
        if (codec.find("avc1") == 0 || codec == "h264") {
            // H.264 supported
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_H264);
            if (!c) supported = false;
        } else if (codec == "vp8") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP8);
            if (!c) supported = false;
        } else if (codec.find("vp09") == 0 || codec == "vp9") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP9);
            if (!c) supported = false;
        } else if (codec.find("av01") == 0 || codec == "av1") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AV1);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    // Validate and copy width
    if (!config.Has("width") || !config.Get("width").IsNumber()) {
        supported = false;
    } else {
        int width = config.Get("width").As<Napi::Number>().Int32Value();
        if (width <= 0 || width > 16384) {
            supported = false;
        }
        normalizedConfig.Set("width", width);
    }

    // Validate and copy height
    if (!config.Has("height") || !config.Get("height").IsNumber()) {
        supported = false;
    } else {
        int height = config.Get("height").As<Napi::Number>().Int32Value();
        if (height <= 0 || height > 16384) {
            supported = false;
        }
        normalizedConfig.Set("height", height);
    }

    // Copy optional properties if present
    if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
        normalizedConfig.Set("bitrate", config.Get("bitrate"));
    }
    if (config.Has("framerate") && config.Get("framerate").IsNumber()) {
        normalizedConfig.Set("framerate", config.Get("framerate"));
    }
    if (config.Has("hardwareAcceleration") && config.Get("hardwareAcceleration").IsString()) {
        normalizedConfig.Set("hardwareAcceleration", config.Get("hardwareAcceleration"));
    }
    if (config.Has("latencyMode") && config.Get("latencyMode").IsString()) {
        normalizedConfig.Set("latencyMode", config.Get("latencyMode"));
    }
    if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
        normalizedConfig.Set("bitrateMode", config.Get("bitrateMode"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    // Return resolved Promise
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}
```

**Step 6: Add TypeScript wrapper**

In `lib/index.ts`, add to the VideoEncoder class:

```typescript
static async isConfigSupported(config: VideoEncoderConfig): Promise<{
    supported: boolean;
    config: VideoEncoderConfig;
}> {
    return native.VideoEncoder.isConfigSupported(config);
}
```

**Step 7: Rebuild and run test**

Run: `npm run build && node test/11_config_supported.js`
Expected: `PASS`

**Step 8: Commit**

```bash
git add src/video_encoder.cpp src/video_encoder.h lib/index.ts test/11_config_supported.js
git commit -m "feat(encoder): implement static isConfigSupported() method"
```

---

## Task 3: EncodedVideoChunk Class with copyTo()

**Files:**
- Create: `src/encoded_video_chunk.cpp`
- Create: `src/encoded_video_chunk.h`
- Modify: `src/addon.cpp`
- Modify: `lib/index.ts`
- Create: `test/12_chunk_copyto.js`

**Step 1: Write the failing test**

Create: `test/12_chunk_copyto.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 12: EncodedVideoChunk.copyTo()');

// Create chunk directly
const data = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1e]);
const chunk = new native.EncodedVideoChunk({
    type: 'key',
    timestamp: 1000,
    duration: 33333,
    data: data
});

assert.strictEqual(chunk.type, 'key');
assert.strictEqual(chunk.timestamp, 1000);
assert.strictEqual(chunk.duration, 33333);
assert.strictEqual(chunk.byteLength, 8);

// Test copyTo
const dest = Buffer.alloc(8);
chunk.copyTo(dest);
assert.deepStrictEqual(dest, data, 'copyTo should copy data correctly');

// Test copyTo with smaller buffer throws
try {
    const smallBuf = Buffer.alloc(4);
    chunk.copyTo(smallBuf);
    assert.fail('Should have thrown');
} catch (e) {
    assert.ok(e.message.includes('too small'), 'Should throw on small buffer');
}

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/12_chunk_copyto.js`
Expected: `TypeError: native.EncodedVideoChunk is not a constructor`

**Step 3: Create encoded_video_chunk.h**

Create: `src/encoded_video_chunk.h`

```cpp
#ifndef ENCODED_VIDEO_CHUNK_H
#define ENCODED_VIDEO_CHUNK_H

#include <napi.h>
#include <vector>

class EncodedVideoChunk : public Napi::ObjectWrap<EncodedVideoChunk> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Object CreateInstance(Napi::Env env,
                                       const std::string& type,
                                       int64_t timestamp,
                                       int64_t duration,
                                       const uint8_t* data,
                                       size_t size);
    EncodedVideoChunk(const Napi::CallbackInfo& info);

    // Property getters
    Napi::Value GetType(const Napi::CallbackInfo& info);
    Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetByteLength(const Napi::CallbackInfo& info);

    // Methods
    void CopyTo(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;
    std::string type_;
    int64_t timestamp_;
    int64_t duration_;
    std::vector<uint8_t> data_;
};

#endif
```

**Step 4: Implement encoded_video_chunk.cpp**

Create: `src/encoded_video_chunk.cpp`

```cpp
#include "encoded_video_chunk.h"

Napi::FunctionReference EncodedVideoChunk::constructor;

Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports) {
    return EncodedVideoChunk::Init(env, exports);
}

Napi::Object EncodedVideoChunk::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "EncodedVideoChunk", {
        InstanceAccessor("type", &EncodedVideoChunk::GetType, nullptr),
        InstanceAccessor("timestamp", &EncodedVideoChunk::GetTimestamp, nullptr),
        InstanceAccessor("duration", &EncodedVideoChunk::GetDuration, nullptr),
        InstanceAccessor("byteLength", &EncodedVideoChunk::GetByteLength, nullptr),
        InstanceMethod("copyTo", &EncodedVideoChunk::CopyTo),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("EncodedVideoChunk", func);
    return exports;
}

Napi::Object EncodedVideoChunk::CreateInstance(Napi::Env env,
                                                const std::string& type,
                                                int64_t timestamp,
                                                int64_t duration,
                                                const uint8_t* data,
                                                size_t size) {
    Napi::Object init = Napi::Object::New(env);
    init.Set("type", type);
    init.Set("timestamp", Napi::Number::New(env, timestamp));
    init.Set("duration", Napi::Number::New(env, duration));
    init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, size));
    return constructor.New({ init });
}

EncodedVideoChunk::EncodedVideoChunk(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EncodedVideoChunk>(info), duration_(0) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::TypeError::New(env, "EncodedVideoChunk requires init object");
    }

    Napi::Object init = info[0].As<Napi::Object>();

    // Required: type
    if (!init.Has("type") || !init.Get("type").IsString()) {
        throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
    }
    type_ = init.Get("type").As<Napi::String>().Utf8Value();
    if (type_ != "key" && type_ != "delta") {
        throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
    }

    // Required: timestamp
    if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
        throw Napi::TypeError::New(env, "init.timestamp must be a number");
    }
    timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

    // Optional: duration
    if (init.Has("duration") && init.Get("duration").IsNumber()) {
        duration_ = init.Get("duration").As<Napi::Number>().Int64Value();
    }

    // Required: data
    if (!init.Has("data")) {
        throw Napi::TypeError::New(env, "init.data is required");
    }

    Napi::Value dataVal = init.Get("data");
    if (dataVal.IsBuffer()) {
        Napi::Buffer<uint8_t> buf = dataVal.As<Napi::Buffer<uint8_t>>();
        data_.assign(buf.Data(), buf.Data() + buf.Length());
    } else if (dataVal.IsArrayBuffer()) {
        Napi::ArrayBuffer ab = dataVal.As<Napi::ArrayBuffer>();
        data_.assign(static_cast<uint8_t*>(ab.Data()),
                     static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
    } else if (dataVal.IsTypedArray()) {
        Napi::TypedArray ta = dataVal.As<Napi::TypedArray>();
        Napi::ArrayBuffer ab = ta.ArrayBuffer();
        size_t offset = ta.ByteOffset();
        size_t length = ta.ByteLength();
        data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                     static_cast<uint8_t*>(ab.Data()) + offset + length);
    } else {
        throw Napi::TypeError::New(env, "init.data must be BufferSource");
    }
}

Napi::Value EncodedVideoChunk::GetType(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), type_);
}

Napi::Value EncodedVideoChunk::GetTimestamp(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value EncodedVideoChunk::GetDuration(const Napi::CallbackInfo& info) {
    if (duration_ == 0) {
        return info.Env().Null();
    }
    return Napi::Number::New(info.Env(), duration_);
}

Napi::Value EncodedVideoChunk::GetByteLength(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), static_cast<double>(data_.size()));
}

void EncodedVideoChunk::CopyTo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        throw Napi::TypeError::New(env, "copyTo requires destination buffer");
    }

    Napi::Value destVal = info[0];
    uint8_t* destData = nullptr;
    size_t destSize = 0;

    if (destVal.IsBuffer()) {
        Napi::Buffer<uint8_t> buf = destVal.As<Napi::Buffer<uint8_t>>();
        destData = buf.Data();
        destSize = buf.Length();
    } else if (destVal.IsArrayBuffer()) {
        Napi::ArrayBuffer ab = destVal.As<Napi::ArrayBuffer>();
        destData = static_cast<uint8_t*>(ab.Data());
        destSize = ab.ByteLength();
    } else if (destVal.IsTypedArray()) {
        Napi::TypedArray ta = destVal.As<Napi::TypedArray>();
        Napi::ArrayBuffer ab = ta.ArrayBuffer();
        destData = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
        destSize = ta.ByteLength();
    } else {
        throw Napi::TypeError::New(env, "destination must be BufferSource");
    }

    if (destSize < data_.size()) {
        throw Napi::TypeError::New(env, "destination buffer too small");
    }

    std::memcpy(destData, data_.data(), data_.size());
}
```

**Step 5: Update addon.cpp**

In `src/addon.cpp`, add forward declaration and call:

```cpp
#include <napi.h>

// Forward declarations
Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports);
Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports);

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    InitVideoEncoder(env, exports);
    InitVideoFrame(env, exports);
    InitEncodedVideoChunk(env, exports);
    return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
```

**Step 6: Update CMakeLists.txt if needed**

Ensure the new source file is included (it should be via the glob pattern).

**Step 7: Rebuild and run test**

Run: `npm run build:native && node test/12_chunk_copyto.js`
Expected: `PASS`

**Step 8: Commit**

```bash
git add src/encoded_video_chunk.cpp src/encoded_video_chunk.h src/addon.cpp test/12_chunk_copyto.js
git commit -m "feat: implement native EncodedVideoChunk class with copyTo()"
```

---

## Task 4: VideoFrame.clone() Method

**Files:**
- Modify: `src/video_frame.cpp`
- Modify: `src/video_frame.h`
- Create: `test/13_frame_clone.js`

**Step 1: Write the failing test**

Create: `test/13_frame_clone.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 13: VideoFrame.clone()');

const width = 100;
const height = 100;
const buffer = Buffer.alloc(width * height * 4);

// Fill with recognizable pattern
for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255;     // R
    buffer[i + 1] = 128; // G
    buffer[i + 2] = 64;  // B
    buffer[i + 3] = 255; // A
}

const frame = new native.VideoFrame(buffer, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 12345,
    format: 'RGBA'
});

// Clone the frame
const cloned = frame.clone();

// Verify clone has same properties
assert.strictEqual(cloned.codedWidth, frame.codedWidth);
assert.strictEqual(cloned.codedHeight, frame.codedHeight);
assert.strictEqual(cloned.timestamp, frame.timestamp);
assert.strictEqual(cloned.format, frame.format);

// Close original - clone should still work
frame.close();

// Clone should still be accessible
assert.strictEqual(cloned.codedWidth, width);
assert.strictEqual(cloned.codedHeight, height);

// Clone should be independent
cloned.close();

// Closing cloned frame should not throw
// (already closed is ok)

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/13_frame_clone.js`
Expected: `TypeError: frame.clone is not a function`

**Step 3: Add clone() declaration to video_frame.h**

Add to public methods:

```cpp
Napi::Value Clone(const Napi::CallbackInfo& info);
```

Add static constructor reference to enable creating new instances:

```cpp
static Napi::FunctionReference constructor;
```

**Step 4: Register clone() and update Init**

In `src/video_frame.cpp`, update the `Init` function:

```cpp
Napi::FunctionReference VideoFrame::constructor;

Napi::Object VideoFrame::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoFrame", {
        InstanceAccessor("codedWidth", &VideoFrame::GetCodedWidth, nullptr),
        InstanceAccessor("codedHeight", &VideoFrame::GetCodedHeight, nullptr),
        InstanceAccessor("timestamp", &VideoFrame::GetTimestamp, nullptr),
        InstanceAccessor("format", &VideoFrame::GetFormat, nullptr),
        InstanceMethod("close", &VideoFrame::Close),
        InstanceMethod("clone", &VideoFrame::Clone),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("VideoFrame", func);
    return exports;
}
```

**Step 5: Implement clone() method**

Add to `src/video_frame.cpp`:

```cpp
Napi::Value VideoFrame::Clone(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (closed_) {
        throw Napi::Error::New(env, "InvalidStateError: Cannot clone a closed VideoFrame");
    }

    // Create init object with current properties
    Napi::Object init = Napi::Object::New(env);
    init.Set("codedWidth", codedWidth_);
    init.Set("codedHeight", codedHeight_);
    init.Set("timestamp", Napi::Number::New(env, timestamp_));
    init.Set("format", format_);

    // Copy data to new buffer
    Napi::Buffer<uint8_t> dataBuffer = Napi::Buffer<uint8_t>::Copy(
        env, data_.data(), data_.size()
    );

    // Create new VideoFrame instance
    return constructor.New({ dataBuffer, init });
}
```

**Step 6: Rebuild and run test**

Run: `npm run build:native && node test/13_frame_clone.js`
Expected: `PASS`

**Step 7: Update TypeScript wrapper**

In `lib/index.ts`, add to VideoFrame class:

```typescript
clone(): VideoFrame {
    const clonedNative = this._native.clone();
    // Wrap the cloned native frame
    const wrapper = Object.create(VideoFrame.prototype);
    wrapper._native = clonedNative;
    wrapper._closed = false;
    return wrapper;
}
```

**Step 8: Commit**

```bash
git add src/video_frame.cpp src/video_frame.h lib/index.ts test/13_frame_clone.js
git commit -m "feat(frame): implement clone() method for VideoFrame"
```

---

## Task 5: VideoDecoder Class - Basic Structure

**Files:**
- Create: `src/video_decoder.cpp`
- Create: `src/video_decoder.h`
- Modify: `src/addon.cpp`
- Create: `test/14_decoder_basic.js`

**Step 1: Write the failing test**

Create: `test/14_decoder_basic.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 14: VideoDecoder basic structure');

let frameCount = 0;
let errorOccurred = false;

const decoder = new native.VideoDecoder({
    output: (frame) => {
        frameCount++;
        console.log(`Decoded frame: ${frame.codedWidth}x${frame.codedHeight} ts=${frame.timestamp}`);
        frame.close();
    },
    error: (e) => {
        errorOccurred = true;
        console.error('Decoder error:', e);
    }
});

assert.strictEqual(decoder.state, 'unconfigured', 'Initial state should be unconfigured');

decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 640,
    codedHeight: 480
});

assert.strictEqual(decoder.state, 'configured', 'State should be configured after configure()');

decoder.close();
assert.strictEqual(decoder.state, 'closed', 'State should be closed after close()');

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/14_decoder_basic.js`
Expected: `TypeError: native.VideoDecoder is not a constructor`

**Step 3: Create video_decoder.h**

Create: `src/video_decoder.h`

```cpp
#ifndef VIDEO_DECODER_H
#define VIDEO_DECODER_H

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoDecoder(const Napi::CallbackInfo& info);
    ~VideoDecoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Decode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value GetDecodeQueueSize(const Napi::CallbackInfo& info);

    // Static methods
    static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);

    // Internal helpers
    void Cleanup();
    void EmitFrames(Napi::Env env);

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
    int codedWidth_;
    int codedHeight_;
};

#endif
```

**Step 4: Implement video_decoder.cpp (configure, close, state)**

Create: `src/video_decoder.cpp`

```cpp
#include "video_decoder.h"
#include "video_frame.h"

Napi::Object InitVideoDecoder(Napi::Env env, Napi::Object exports) {
    return VideoDecoder::Init(env, exports);
}

Napi::Object VideoDecoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoDecoder", {
        InstanceMethod("configure", &VideoDecoder::Configure),
        InstanceMethod("decode", &VideoDecoder::Decode),
        InstanceMethod("flush", &VideoDecoder::Flush),
        InstanceMethod("reset", &VideoDecoder::Reset),
        InstanceMethod("close", &VideoDecoder::Close),
        InstanceAccessor("state", &VideoDecoder::GetState, nullptr),
        InstanceAccessor("decodeQueueSize", &VideoDecoder::GetDecodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &VideoDecoder::IsConfigSupported),
    });

    exports.Set("VideoDecoder", func);
    return exports;
}

VideoDecoder::VideoDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoDecoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swsContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      codedWidth_(0),
      codedHeight_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "VideoDecoder requires init object with output and error callbacks");
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

VideoDecoder::~VideoDecoder() {
    Cleanup();
}

void VideoDecoder::Cleanup() {
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

Napi::Value VideoDecoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder is closed");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse codec string - for now, assume H.264
    std::string codecStr = "avc1";
    if (config.Has("codec") && config.Get("codec").IsString()) {
        codecStr = config.Get("codec").As<Napi::String>().Utf8Value();
    }

    // Determine codec ID
    AVCodecID codecId = AV_CODEC_ID_H264; // default
    if (codecStr.find("avc1") == 0 || codecStr == "h264") {
        codecId = AV_CODEC_ID_H264;
    } else if (codecStr == "vp8") {
        codecId = AV_CODEC_ID_VP8;
    } else if (codecStr.find("vp09") == 0 || codecStr == "vp9") {
        codecId = AV_CODEC_ID_VP9;
    } else if (codecStr.find("av01") == 0 || codecStr == "av1") {
        codecId = AV_CODEC_ID_AV1;
    }

    // Find decoder
    codec_ = avcodec_find_decoder(codecId);
    if (!codec_) {
        throw Napi::Error::New(env, "NotSupportedError: Decoder not found for codec");
    }

    // Clean up any previous context
    Cleanup();

    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Parse dimensions (optional for decoder, may come from bitstream)
    if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
        codedWidth_ = config.Get("codedWidth").As<Napi::Number>().Int32Value();
        codecContext_->width = codedWidth_;
    }
    if (config.Has("codedHeight") && config.Get("codedHeight").IsNumber()) {
        codedHeight_ = config.Get("codedHeight").As<Napi::Number>().Int32Value();
        codecContext_->height = codedHeight_;
    }

    // Handle description (extradata) - SPS/PPS for H.264
    if (config.Has("description")) {
        Napi::Value descVal = config.Get("description");
        if (descVal.IsBuffer()) {
            Napi::Buffer<uint8_t> buf = descVal.As<Napi::Buffer<uint8_t>>();
            codecContext_->extradata_size = buf.Length();
            codecContext_->extradata = static_cast<uint8_t*>(
                av_mallocz(buf.Length() + AV_INPUT_BUFFER_PADDING_SIZE)
            );
            memcpy(codecContext_->extradata, buf.Data(), buf.Length());
        } else if (descVal.IsArrayBuffer()) {
            Napi::ArrayBuffer ab = descVal.As<Napi::ArrayBuffer>();
            codecContext_->extradata_size = ab.ByteLength();
            codecContext_->extradata = static_cast<uint8_t*>(
                av_mallocz(ab.ByteLength() + AV_INPUT_BUFFER_PADDING_SIZE)
            );
            memcpy(codecContext_->extradata, ab.Data(), ab.ByteLength());
        }
    }

    // Open codec
    int ret = avcodec_open2(codecContext_, codec_, nullptr);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        Cleanup();
        throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
    }

    // Allocate frame and packet
    frame_ = av_frame_alloc();
    packet_ = av_packet_alloc();

    state_ = "configured";
    return env.Undefined();
}

Napi::Value VideoDecoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), 0); // TODO: Implement queue tracking
}

void VideoDecoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}

// Stub implementations - will be completed in next task
Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
    }

    // TODO: Implement in Task 6
    return env.Undefined();
}

Napi::Value VideoDecoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // TODO: Implement in Task 6
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}

Napi::Value VideoDecoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset a closed decoder");
    }

    Cleanup();
    state_ = "unconfigured";

    return env.Undefined();
}

Napi::Value VideoDecoder::IsConfigSupported(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Reject(Napi::Error::New(env, "config must be an object").Value());
        return deferred.Promise();
    }

    Napi::Object config = info[0].As<Napi::Object>();
    Napi::Object result = Napi::Object::New(env);
    bool supported = true;

    Napi::Object normalizedConfig = Napi::Object::New(env);

    // Check codec
    if (!config.Has("codec") || !config.Get("codec").IsString()) {
        supported = false;
    } else {
        std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
        normalizedConfig.Set("codec", codec);

        if (codec.find("avc1") == 0 || codec == "h264") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_H264);
            if (!c) supported = false;
        } else if (codec == "vp8") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP8);
            if (!c) supported = false;
        } else if (codec.find("vp09") == 0 || codec == "vp9") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP9);
            if (!c) supported = false;
        } else if (codec.find("av01") == 0 || codec == "av1") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AV1);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    // Copy optional properties
    if (config.Has("codedWidth") && config.Get("codedWidth").IsNumber()) {
        normalizedConfig.Set("codedWidth", config.Get("codedWidth"));
    }
    if (config.Has("codedHeight") && config.Get("codedHeight").IsNumber()) {
        normalizedConfig.Set("codedHeight", config.Get("codedHeight"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}

void VideoDecoder::EmitFrames(Napi::Env env) {
    // TODO: Implement in Task 6
}
```

**Step 5: Update addon.cpp**

In `src/addon.cpp`:

```cpp
#include <napi.h>

// Forward declarations
Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoDecoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports);
Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports);

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    InitVideoEncoder(env, exports);
    InitVideoDecoder(env, exports);
    InitVideoFrame(env, exports);
    InitEncodedVideoChunk(env, exports);
    return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
```

**Step 6: Rebuild and run test**

Run: `npm run build:native && node test/14_decoder_basic.js`
Expected: `PASS`

**Step 7: Commit**

```bash
git add src/video_decoder.cpp src/video_decoder.h src/addon.cpp test/14_decoder_basic.js
git commit -m "feat: implement VideoDecoder class with configure/close/state"
```

---

## Task 6: VideoDecoder decode() and flush()

**Files:**
- Modify: `src/video_decoder.cpp`
- Modify: `src/video_frame.h` (add CreateInstance)
- Modify: `src/video_frame.cpp`
- Create: `test/15_decoder_decode.js`

**Step 1: Write the failing test**

Create: `test/15_decoder_decode.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 15: VideoDecoder decode()');

// First, encode some frames to get valid H.264 data
const encodedChunks = [];

const encoder = new native.VideoEncoder({
    output: (chunk) => {
        encodedChunks.push({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: Buffer.from(chunk.data)
        });
    },
    error: (e) => console.error('Encoder error:', e)
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500000,
    framerate: 30
});

// Encode 10 frames
for (let i = 0; i < 10; i++) {
    const buf = Buffer.alloc(320 * 240 * 4);
    for (let j = 0; j < buf.length; j += 4) {
        buf[j] = i * 25;
        buf[j + 1] = 128;
        buf[j + 2] = 255 - i * 25;
        buf[j + 3] = 255;
    }
    const frame = new native.VideoFrame(buf, {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333
    });
    encoder.encode(frame);
    frame.close();
}
encoder.flush();
encoder.close();

console.log(`Encoded ${encodedChunks.length} chunks`);
assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

// Now decode them
let decodedFrames = 0;

const decoder = new native.VideoDecoder({
    output: (frame) => {
        decodedFrames++;
        console.log(`Decoded frame ${decodedFrames}: ${frame.codedWidth}x${frame.codedHeight} ts=${frame.timestamp}`);
        assert.strictEqual(frame.codedWidth, 320);
        assert.strictEqual(frame.codedHeight, 240);
        frame.close();
    },
    error: (e) => {
        console.error('Decoder error:', e);
        process.exit(1);
    }
});

decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 320,
    codedHeight: 240
});

// Decode all chunks
for (const chunk of encodedChunks) {
    const encodedChunk = new native.EncodedVideoChunk({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration || 33333,
        data: chunk.data
    });
    decoder.decode(encodedChunk);
}

decoder.flush();
decoder.close();

console.log(`Decoded ${decodedFrames} frames from ${encodedChunks.length} chunks`);
assert.ok(decodedFrames > 0, 'Should have decoded at least one frame');

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/15_decoder_decode.js`
Expected: Decode produces no frames (method is stubbed)

**Step 3: Add VideoFrame::CreateInstance static method**

In `src/video_frame.h`, add:

```cpp
static Napi::Object CreateInstance(Napi::Env env,
                                   const uint8_t* data,
                                   size_t dataSize,
                                   int width,
                                   int height,
                                   int64_t timestamp,
                                   const std::string& format);
```

In `src/video_frame.cpp`, implement:

```cpp
Napi::Object VideoFrame::CreateInstance(Napi::Env env,
                                         const uint8_t* data,
                                         size_t dataSize,
                                         int width,
                                         int height,
                                         int64_t timestamp,
                                         const std::string& format) {
    Napi::Object init = Napi::Object::New(env);
    init.Set("codedWidth", width);
    init.Set("codedHeight", height);
    init.Set("timestamp", Napi::Number::New(env, timestamp));
    init.Set("format", format);

    Napi::Buffer<uint8_t> dataBuffer = Napi::Buffer<uint8_t>::Copy(env, data, dataSize);

    return constructor.New({ dataBuffer, init });
}
```

**Step 4: Implement VideoDecoder::Decode()**

In `src/video_decoder.cpp`, replace the stub:

```cpp
Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "decode requires EncodedVideoChunk");
    }

    Napi::Object chunk = info[0].As<Napi::Object>();

    // Get chunk data
    Napi::Value dataVal = chunk.Get("data");
    uint8_t* chunkData = nullptr;
    size_t chunkSize = 0;

    if (dataVal.IsBuffer()) {
        Napi::Buffer<uint8_t> buf = dataVal.As<Napi::Buffer<uint8_t>>();
        chunkData = buf.Data();
        chunkSize = buf.Length();
    } else {
        // Try to call copyTo if it's an EncodedVideoChunk instance
        if (chunk.Has("byteLength") && chunk.Get("byteLength").IsNumber()) {
            chunkSize = chunk.Get("byteLength").As<Napi::Number>().Uint32Value();
            // Allocate temp buffer
            std::vector<uint8_t> tempBuf(chunkSize);
            if (chunk.Has("copyTo") && chunk.Get("copyTo").IsFunction()) {
                Napi::Buffer<uint8_t> dest = Napi::Buffer<uint8_t>::New(env, tempBuf.data(), tempBuf.size());
                chunk.Get("copyTo").As<Napi::Function>().Call(chunk, { dest });
                chunkData = tempBuf.data();
            }
        }
    }

    if (!chunkData || chunkSize == 0) {
        throw Napi::Error::New(env, "Could not get chunk data");
    }

    // Get timestamp
    int64_t timestamp = 0;
    if (chunk.Has("timestamp") && chunk.Get("timestamp").IsNumber()) {
        timestamp = chunk.Get("timestamp").As<Napi::Number>().Int64Value();
    }

    // Check if key frame
    bool isKeyFrame = false;
    if (chunk.Has("type") && chunk.Get("type").IsString()) {
        isKeyFrame = chunk.Get("type").As<Napi::String>().Utf8Value() == "key";
    }

    // Create packet from chunk data
    av_packet_unref(packet_);
    packet_->data = const_cast<uint8_t*>(chunkData);
    packet_->size = chunkSize;
    packet_->pts = timestamp;
    packet_->dts = timestamp;
    if (isKeyFrame) {
        packet_->flags |= AV_PKT_FLAG_KEY;
    }

    // Send packet to decoder
    int ret = avcodec_send_packet(codecContext_, packet_);
    if (ret < 0 && ret != AVERROR(EAGAIN)) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        errorCallback_.Call({ Napi::Error::New(env, std::string("Decode error: ") + errbuf).Value() });
        return env.Undefined();
    }

    // Receive decoded frames
    EmitFrames(env);

    return env.Undefined();
}
```

**Step 5: Implement VideoDecoder::EmitFrames()**

```cpp
void VideoDecoder::EmitFrames(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_frame(codecContext_, frame_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Decode frame error: ") + errbuf).Value() });
            break;
        }

        int width = frame_->width;
        int height = frame_->height;

        // Convert to RGBA
        if (!swsContext_) {
            swsContext_ = sws_getContext(
                width, height, (AVPixelFormat)frame_->format,
                width, height, AV_PIX_FMT_RGBA,
                SWS_BILINEAR, nullptr, nullptr, nullptr
            );
        }

        // Allocate RGBA buffer
        size_t rgbaSize = width * height * 4;
        std::vector<uint8_t> rgbaData(rgbaSize);
        uint8_t* dstData[] = { rgbaData.data() };
        int dstLinesize[] = { width * 4 };

        sws_scale(swsContext_, frame_->data, frame_->linesize, 0, height,
                  dstData, dstLinesize);

        // Create VideoFrame and call output callback
        Napi::Object videoFrame = VideoFrame::CreateInstance(
            env,
            rgbaData.data(),
            rgbaSize,
            width,
            height,
            frame_->pts,
            "RGBA"
        );

        outputCallback_.Call({ videoFrame });

        av_frame_unref(frame_);
    }
}
```

**Step 6: Implement VideoDecoder::Flush()**

```cpp
Napi::Value VideoDecoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Resolve(env.Undefined());
        return deferred.Promise();
    }

    // Send NULL packet to flush decoder
    avcodec_send_packet(codecContext_, nullptr);

    // Get remaining frames
    EmitFrames(env);

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}
```

**Step 7: Include video_frame.h in video_decoder.cpp**

At the top of `src/video_decoder.cpp`:

```cpp
#include "video_decoder.h"
#include "video_frame.h"
```

**Step 8: Rebuild and run test**

Run: `npm run build:native && node test/15_decoder_decode.js`
Expected: `PASS` with decoded frames logged

**Step 9: Commit**

```bash
git add src/video_decoder.cpp src/video_frame.cpp src/video_frame.h test/15_decoder_decode.js
git commit -m "feat(decoder): implement decode() and flush() methods"
```

---

## Task 7: TypeScript VideoDecoder Wrapper

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/index.ts`
- Create: `test/16_decoder_typescript.js`

**Step 1: Write the failing test**

Create: `test/16_decoder_typescript.js`

```javascript
const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../dist');
const assert = require('assert');

console.log('Test 16: VideoDecoder TypeScript wrapper');

async function runTest() {
    // Encode some test data
    const encodedChunks = [];

    const encoder = new VideoEncoder({
        output: (chunk) => encodedChunks.push(chunk),
        error: (e) => console.error(e)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 500000,
        framerate: 30
    });

    for (let i = 0; i < 5; i++) {
        const buf = Buffer.alloc(320 * 240 * 4, i * 50);
        const frame = new VideoFrame(buf, {
            codedWidth: 320,
            codedHeight: 240,
            timestamp: i * 33333
        });
        encoder.encode(frame);
        frame.close();
    }
    encoder.flush();
    encoder.close();

    // Decode
    let decodedCount = 0;
    const decoder = new VideoDecoder({
        output: (frame) => {
            decodedCount++;
            assert.strictEqual(frame.codedWidth, 320);
            frame.close();
        },
        error: (e) => console.error('Decoder error:', e)
    });

    assert.strictEqual(decoder.state, 'unconfigured');

    // Test isConfigSupported
    const support = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42001E',
        codedWidth: 320,
        codedHeight: 240
    });
    assert.strictEqual(support.supported, true);

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 320,
        codedHeight: 240
    });

    assert.strictEqual(decoder.state, 'configured');

    for (const chunk of encodedChunks) {
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    assert.ok(decodedCount > 0, 'Should decode frames');
    console.log(`Decoded ${decodedCount} frames`);
    console.log('PASS');
}

runTest().catch(e => {
    console.error('FAIL:', e);
    process.exit(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run build:ts && node test/16_decoder_typescript.js`
Expected: `TypeError: VideoDecoder is not a constructor`

**Step 3: Add types to lib/types.ts**

Add:

```typescript
export interface VideoDecoderConfig {
    codec: string;
    codedWidth?: number;
    codedHeight?: number;
    description?: ArrayBuffer | ArrayBufferView;
    colorSpace?: VideoColorSpaceInit;
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
    optimizeForLatency?: boolean;
}

export interface VideoDecoderInit {
    output: (frame: any) => void;
    error: (error: Error) => void;
}

export interface VideoColorSpaceInit {
    primaries?: string;
    transfer?: string;
    matrix?: string;
    fullRange?: boolean;
}
```

**Step 4: Add VideoDecoder class to lib/index.ts**

```typescript
import type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoDecoderConfig,
    VideoDecoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
} from './types';

// ... (existing code)

export class VideoDecoder {
    private _native: any;

    constructor(init: VideoDecoderInit) {
        this._native = new native.VideoDecoder({
            output: (frame: any) => {
                // Wrap native frame
                const wrapper = Object.create(VideoFrame.prototype);
                wrapper._native = frame;
                wrapper._closed = false;
                init.output(wrapper);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get decodeQueueSize(): number {
        return this._native.decodeQueueSize;
    }

    configure(config: VideoDecoderConfig): void {
        this._native.configure(config);
    }

    decode(chunk: EncodedVideoChunk): void {
        // If it's our wrapped chunk, unwrap it
        if ((chunk as any)._native) {
            this._native.decode((chunk as any)._native);
        } else {
            // Create native EncodedVideoChunk
            const nativeChunk = new native.EncodedVideoChunk({
                type: chunk.type,
                timestamp: chunk.timestamp,
                duration: chunk.duration || 0,
                data: chunk.data
            });
            this._native.decode(nativeChunk);
        }
    }

    async flush(): Promise<void> {
        return this._native.flush();
    }

    reset(): void {
        this._native.reset();
    }

    close(): void {
        this._native.close();
    }

    static async isConfigSupported(config: VideoDecoderConfig): Promise<{
        supported: boolean;
        config: VideoDecoderConfig;
    }> {
        return native.VideoDecoder.isConfigSupported(config);
    }
}
```

**Step 5: Export VideoDecoder and update types export**

At the end of `lib/index.ts`:

```typescript
export type {
    VideoEncoderConfig,
    VideoEncoderInit,
    VideoDecoderConfig,
    VideoDecoderInit,
    EncodedVideoChunk,
    VideoFrameInit,
    CodecState
} from './types';
```

**Step 6: Rebuild and run test**

Run: `npm run build && node test/16_decoder_typescript.js`
Expected: `PASS`

**Step 7: Commit**

```bash
git add lib/types.ts lib/index.ts test/16_decoder_typescript.js
git commit -m "feat: add TypeScript VideoDecoder wrapper"
```

---

## Task 8: Update Test Suite

**Files:**
- Modify: `test/suite.js`

**Step 1: Add new tests to suite**

Update `test/suite.js`:

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
    '09_robustness.js',
    '10_encoder_reset.js',
    '11_config_supported.js',
    '12_chunk_copyto.js',
    '13_frame_clone.js',
    '14_decoder_basic.js',
    '15_decoder_decode.js',
    '16_decoder_typescript.js'
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
Expected: `Results: 16 passed, 0 failed`

**Step 3: Commit**

```bash
git add test/suite.js
git commit -m "test: add new tests to suite"
```

---

## Task 9: Final Verification and Documentation

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
Expected: All tests pass

**Step 3: Update README.md with new API**

Add VideoDecoder section to README:

```markdown
### VideoDecoder

- `new VideoDecoder({ output, error })` - Create decoder with callbacks
- `configure(config)` - Configure codec settings
- `decode(chunk)` - Decode an EncodedVideoChunk
- `flush()` - Flush remaining frames (returns Promise)
- `reset()` - Reset to unconfigured state
- `close()` - Close decoder and free resources
- `static isConfigSupported(config)` - Check if config is supported
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with VideoDecoder API"
```

---

## Summary

This plan implements the following from the master TODO:

**Completed:**
- [x] VideoEncoder.reset() method
- [x] VideoEncoder.isConfigSupported() static method
- [x] EncodedVideoChunk class with copyTo()
- [x] VideoFrame.clone() method
- [x] VideoDecoder class (complete)
- [x] TypeScript wrappers for all new functionality

**Test Coverage:**
- 16 test files covering encoding, decoding, configuration, memory management

**Architecture preserved:**
- Native C++ (node-addon-api) -> TypeScript wrapper pattern
- FFmpeg for codec operations
- Clean resource management

**Ready for next phase:**
- Audio encoding/decoding
- Hardware acceleration
- Additional codec support (VP8, VP9, AV1)
