# WebCodecs Node.js Phase 3: Audio Support

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add audio encoding and decoding capabilities to the WebCodecs Node.js implementation, completing the core media processing pipeline.

**Architecture:** Extend the existing native C++ addon (node-addon-api) with AudioEncoder, AudioDecoder, AudioData, and EncodedAudioChunk classes. Use FFmpeg's libavcodec for AAC/Opus encoding/decoding and libswresample for audio format conversion. TypeScript layer provides WebCodecs-compliant API surface.

**Tech Stack:** Node.js 18+, node-addon-api, cmake-js, FFmpeg (libavcodec, libavutil, libswresample), TypeScript 5.3+

**Code Style:** All C++ code MUST follow Google C++ Style Guide:
- Files: `.h` headers, `.cc` source (NOT `.cpp`)
- Types: `CamelCase`, Members: `trailing_underscore_`, Constants: `kCamelCase`
- 2-space indentation, 80 char line limit
- Function braces on new line, other braces on same line
- Include guards: `NODE_WEBCODECS_SRC_FILE_H_` format
- Explicit constructors, proper include order
- Use `ThrowAsJavaScriptException()` instead of `throw`

**IMPORTANT - Google Style Enforcement:**
- Tasks 1-2 provide **complete Google Style compliant code** - copy exactly
- Tasks 3-7 provide **algorithmic reference** - implementation MUST convert to Google Style:
  - Change `.cpp` → `.cc` in filenames and git commands
  - Change `throw Napi::Error::New(...)` → `Napi::Error::New(...).ThrowAsJavaScriptException(); return;`
  - Change `codecContext_` → `codec_context_`, `sampleRate_` → `sample_rate_`, etc.
  - Use 2-space indentation
  - Function opening braces on new line

---

## Phase Overview

This plan focuses on **Priority 4-5** items from the master TODO:

1. **P4: AudioData Class** - Core audio data container
2. **P4: AudioEncoder Class** - AAC and Opus encoding
3. **P4: EncodedAudioChunk Class** - Encoded audio container
4. **P5: AudioDecoder Class** - AAC and Opus decoding
5. **TypeScript Wrappers** - Full type-safe API

---

## Task 1: AudioData Class - Core Structure

**Files:**
- Create: `src/audio_data.cc`
- Create: `src/audio_data.h`
- Modify: `src/addon.cc`
- Create: `test/19_audio_data.js`

**Step 1: Write the failing test**

Create: `test/19_audio_data.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 19: AudioData basic structure');

// Create stereo audio data at 48kHz, 1024 frames
const sampleRate = 48000;
const numberOfChannels = 2;
const numberOfFrames = 1024;
const format = 'f32'; // 32-bit float interleaved

// Create interleaved float32 samples
const samples = new Float32Array(numberOfFrames * numberOfChannels);
for (let i = 0; i < numberOfFrames; i++) {
    // Left channel: 440Hz sine wave
    samples[i * 2] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    // Right channel: 880Hz sine wave
    samples[i * 2 + 1] = Math.sin(2 * Math.PI * 880 * i / sampleRate);
}

const audioData = new native.AudioData({
    format: format,
    sampleRate: sampleRate,
    numberOfFrames: numberOfFrames,
    numberOfChannels: numberOfChannels,
    timestamp: 0,
    data: samples.buffer
});

// Verify properties
assert.strictEqual(audioData.format, 'f32', 'format should be f32');
assert.strictEqual(audioData.sampleRate, 48000, 'sampleRate should be 48000');
assert.strictEqual(audioData.numberOfFrames, 1024, 'numberOfFrames should be 1024');
assert.strictEqual(audioData.numberOfChannels, 2, 'numberOfChannels should be 2');
assert.strictEqual(audioData.timestamp, 0, 'timestamp should be 0');

// Duration = numberOfFrames / sampleRate * 1_000_000 (microseconds)
const expectedDuration = Math.floor(numberOfFrames / sampleRate * 1000000);
assert.strictEqual(audioData.duration, expectedDuration, `duration should be ${expectedDuration}`);

// Test close
audioData.close();

// Operations on closed AudioData should throw
try {
    audioData.clone();
    assert.fail('Should throw on closed AudioData');
} catch (e) {
    assert.ok(e.message.includes('closed') || e.message.includes('InvalidStateError'));
}

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/19_audio_data.js`
Expected: `TypeError: native.AudioData is not a constructor`

**Step 3: Create audio_data.h**

Create: `src/audio_data.h`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef NODE_WEBCODECS_SRC_AUDIO_DATA_H_
#define NODE_WEBCODECS_SRC_AUDIO_DATA_H_

#include <cstdint>
#include <string>
#include <vector>

#include <napi.h>

class AudioData : public Napi::ObjectWrap<AudioData> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env,
                                     const std::string& format,
                                     uint32_t sample_rate,
                                     uint32_t number_of_frames,
                                     uint32_t number_of_channels,
                                     int64_t timestamp,
                                     const uint8_t* data,
                                     size_t data_size);
  explicit AudioData(const Napi::CallbackInfo& info);

  // Prevent copy and assignment.
  AudioData(const AudioData&) = delete;
  AudioData& operator=(const AudioData&) = delete;

  // Property getters.
  Napi::Value GetFormat(const Napi::CallbackInfo& info);
  Napi::Value GetSampleRate(const Napi::CallbackInfo& info);
  Napi::Value GetNumberOfFrames(const Napi::CallbackInfo& info);
  Napi::Value GetNumberOfChannels(const Napi::CallbackInfo& info);
  Napi::Value GetDuration(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);

  // Methods.
  Napi::Value AllocationSize(const Napi::CallbackInfo& info);
  void CopyTo(const Napi::CallbackInfo& info);
  Napi::Value Clone(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);

  // Internal access for encoder.
  const std::vector<uint8_t>& GetData() const { return data_; }
  bool IsClosed() const { return closed_; }

 private:
  static Napi::FunctionReference constructor_;

  // Helper to get bytes per sample for format.
  size_t GetBytesPerSample() const;
  bool IsPlanar() const;

  std::string format_;
  uint32_t sample_rate_;
  uint32_t number_of_frames_;
  uint32_t number_of_channels_;
  int64_t timestamp_;
  std::vector<uint8_t> data_;
  bool closed_;
};

#endif  // NODE_WEBCODECS_SRC_AUDIO_DATA_H_
```

**Step 4: Implement audio_data.cc**

Create: `src/audio_data.cc`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "audio_data.h"

#include <cstring>

namespace {
constexpr int kMicrosecondsPerSecond = 1000000;
}  // namespace

Napi::FunctionReference AudioData::constructor_;

Napi::Object InitAudioData(Napi::Env env, Napi::Object exports)
{
  return AudioData::Init(env, exports);
}

Napi::Object AudioData::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func = DefineClass(env, "AudioData", {
      InstanceAccessor("format", &AudioData::GetFormat, nullptr),
      InstanceAccessor("sampleRate", &AudioData::GetSampleRate, nullptr),
      InstanceAccessor("numberOfFrames", &AudioData::GetNumberOfFrames,
                       nullptr),
      InstanceAccessor("numberOfChannels", &AudioData::GetNumberOfChannels,
                       nullptr),
      InstanceAccessor("duration", &AudioData::GetDuration, nullptr),
      InstanceAccessor("timestamp", &AudioData::GetTimestamp, nullptr),
      InstanceMethod("allocationSize", &AudioData::AllocationSize),
      InstanceMethod("copyTo", &AudioData::CopyTo),
      InstanceMethod("clone", &AudioData::Clone),
      InstanceMethod("close", &AudioData::Close),
  });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("AudioData", func);
  return exports;
}

Napi::Object AudioData::CreateInstance(Napi::Env env,
                                       const std::string& format,
                                       uint32_t sample_rate,
                                       uint32_t number_of_frames,
                                       uint32_t number_of_channels,
                                       int64_t timestamp,
                                       const uint8_t* data,
                                       size_t data_size)
{
  Napi::Object init = Napi::Object::New(env);
  init.Set("format", format);
  init.Set("sampleRate", sample_rate);
  init.Set("numberOfFrames", number_of_frames);
  init.Set("numberOfChannels", number_of_channels);
  init.Set("timestamp", Napi::Number::New(env, static_cast<double>(timestamp)));
  init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, data_size));
  return constructor_.New({init});
}

AudioData::AudioData(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioData>(info),
      sample_rate_(0),
      number_of_frames_(0),
      number_of_channels_(0),
      timestamp_(0),
      closed_(false)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "AudioData requires init object").ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Required: format.
  if (!init.Has("format") || !init.Get("format").IsString()) {
    Napi::TypeError::New(env, "init.format is required").ThrowAsJavaScriptException();
    return;
  }
  format_ = init.Get("format").As<Napi::String>().Utf8Value();

  // Validate format.
  if (format_ != "u8" && format_ != "s16" && format_ != "s32" &&
      format_ != "f32" && format_ != "u8-planar" &&
      format_ != "s16-planar" && format_ != "s32-planar" &&
      format_ != "f32-planar") {
    Napi::TypeError::New(env, "Invalid audio sample format").ThrowAsJavaScriptException();
    return;
  }

  // Required: sampleRate.
  if (!init.Has("sampleRate") || !init.Get("sampleRate").IsNumber()) {
    Napi::TypeError::New(env, "init.sampleRate is required").ThrowAsJavaScriptException();
    return;
  }
  sample_rate_ = init.Get("sampleRate").As<Napi::Number>().Uint32Value();

  // Required: numberOfFrames.
  if (!init.Has("numberOfFrames") || !init.Get("numberOfFrames").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfFrames is required").ThrowAsJavaScriptException();
    return;
  }
  number_of_frames_ = init.Get("numberOfFrames").As<Napi::Number>().Uint32Value();

  // Required: numberOfChannels.
  if (!init.Has("numberOfChannels") ||
      !init.Get("numberOfChannels").IsNumber()) {
    Napi::TypeError::New(env, "init.numberOfChannels is required").ThrowAsJavaScriptException();
    return;
  }
  number_of_channels_ =
      init.Get("numberOfChannels").As<Napi::Number>().Uint32Value();

  // Required: timestamp.
  if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
    Napi::TypeError::New(env, "init.timestamp is required").ThrowAsJavaScriptException();
    return;
  }
  timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

  // Required: data.
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "init.data is required").ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_val = init.Get("data");
  if (data_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_val.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = data_val.As<Napi::ArrayBuffer>();
    data_.assign(static_cast<uint8_t*>(ab.Data()),
                 static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
  } else if (data_val.IsTypedArray()) {
    Napi::TypedArray ta = data_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    size_t offset = ta.ByteOffset();
    size_t length = ta.ByteLength();
    data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                 static_cast<uint8_t*>(ab.Data()) + offset + length);
  } else {
    Napi::TypeError::New(env, "init.data must be BufferSource").ThrowAsJavaScriptException();
    return;
  }

  // Validate data size.
  size_t expected_size =
      number_of_frames_ * number_of_channels_ * GetBytesPerSample();
  if (data_.size() < expected_size) {
    Napi::TypeError::New(env, "init.data is too small for specified parameters").ThrowAsJavaScriptException();
    return;
  }
}

size_t AudioData::GetBytesPerSample() const
{
  if (format_ == "u8" || format_ == "u8-planar") {
    return 1;
  }
  if (format_ == "s16" || format_ == "s16-planar") {
    return 2;
  }
  if (format_ == "s32" || format_ == "s32-planar" ||
      format_ == "f32" || format_ == "f32-planar") {
    return 4;
  }
  return 4;  // Default.
}

bool AudioData::IsPlanar() const
{
  return format_.find("-planar") != std::string::npos;
}

Napi::Value AudioData::GetFormat(const Napi::CallbackInfo& info)
{
  if (closed_) {
    return info.Env().Null();
  }
  return Napi::String::New(info.Env(), format_);
}

Napi::Value AudioData::GetSampleRate(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), sample_rate_);
}

Napi::Value AudioData::GetNumberOfFrames(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), number_of_frames_);
}

Napi::Value AudioData::GetNumberOfChannels(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), number_of_channels_);
}

Napi::Value AudioData::GetDuration(const Napi::CallbackInfo& info)
{
  // Duration in microseconds.
  int64_t duration = static_cast<int64_t>(number_of_frames_) *
                     kMicrosecondsPerSecond / sample_rate_;
  return Napi::Number::New(info.Env(), static_cast<double>(duration));
}

Napi::Value AudioData::GetTimestamp(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), static_cast<double>(timestamp_));
}

Napi::Value AudioData::AllocationSize(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // TODO(user): Handle options for partial copy or format conversion.
  return Napi::Number::New(env, static_cast<double>(data_.size()));
}

void AudioData::CopyTo(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: AudioData is closed").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "copyTo requires destination buffer").ThrowAsJavaScriptException();
    return;
  }

  // TODO(user): Handle options for planeIndex, frameOffset, frameCount, format.

  Napi::Value dest_val = info[0];
  uint8_t* dest_data = nullptr;
  size_t dest_size = 0;

  if (dest_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = dest_val.As<Napi::Buffer<uint8_t>>();
    dest_data = buf.Data();
    dest_size = buf.Length();
  } else if (dest_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = dest_val.As<Napi::ArrayBuffer>();
    dest_data = static_cast<uint8_t*>(ab.Data());
    dest_size = ab.ByteLength();
  } else if (dest_val.IsTypedArray()) {
    Napi::TypedArray ta = dest_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    dest_data = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
    dest_size = ta.ByteLength();
  } else {
    Napi::TypeError::New(env, "destination must be BufferSource").ThrowAsJavaScriptException();
    return;
  }

  if (dest_size < data_.size()) {
    Napi::TypeError::New(env, "destination buffer too small").ThrowAsJavaScriptException();
    return;
  }

  std::memcpy(dest_data, data_.data(), data_.size());
}

Napi::Value AudioData::Clone(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "InvalidStateError: Cannot clone closed AudioData").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return CreateInstance(env, format_, sample_rate_, number_of_frames_,
                        number_of_channels_, timestamp_, data_.data(),
                        data_.size());
}

void AudioData::Close(const Napi::CallbackInfo& info)
{
  if (!closed_) {
    data_.clear();
    data_.shrink_to_fit();
    closed_ = true;
  }
}
```

**Step 5: Update addon.cc**

In `src/addon.cc`, add forward declaration and initialization:

```cpp
Napi::Object InitAudioData(Napi::Env env, Napi::Object exports);

// In InitAll:
InitAudioData(env, exports);
```

**Step 6: Rebuild and run test**

Run: `npm run build:native && node test/19_audio_data.js`
Expected: `PASS`

**Step 7: Commit**

```bash
git add src/audio_data.cc src/audio_data.h src/addon.cc test/19_audio_data.js
git commit -m "feat: implement AudioData class with core functionality"
```

---

## Task 2: EncodedAudioChunk Class

**Files:**
- Create: `src/encoded_audio_chunk.cc`
- Create: `src/encoded_audio_chunk.h`
- Modify: `src/addon.cc`
- Create: `test/20_encoded_audio_chunk.js`

**Step 1: Write the failing test**

Create: `test/20_encoded_audio_chunk.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 20: EncodedAudioChunk');

// Create a mock encoded audio chunk
const data = Buffer.from([0xFF, 0xF1, 0x50, 0x80, 0x00, 0x1F, 0xFC]);

const chunk = new native.EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    duration: 21333,
    data: data
});

assert.strictEqual(chunk.type, 'key');
assert.strictEqual(chunk.timestamp, 0);
assert.strictEqual(chunk.duration, 21333);
assert.strictEqual(chunk.byteLength, 7);

// Test copyTo
const dest = Buffer.alloc(7);
chunk.copyTo(dest);
assert.deepStrictEqual(dest, data);

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/20_encoded_audio_chunk.js`
Expected: `TypeError: native.EncodedAudioChunk is not a constructor`

**Step 3: Create encoded_audio_chunk.h**

Create: `src/encoded_audio_chunk.h`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef NODE_WEBCODECS_SRC_ENCODED_AUDIO_CHUNK_H_
#define NODE_WEBCODECS_SRC_ENCODED_AUDIO_CHUNK_H_

#include <cstdint>
#include <string>
#include <vector>

#include <napi.h>

class EncodedAudioChunk : public Napi::ObjectWrap<EncodedAudioChunk> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object CreateInstance(Napi::Env env,
                                     const std::string& type,
                                     int64_t timestamp,
                                     int64_t duration,
                                     const uint8_t* data,
                                     size_t size);
  explicit EncodedAudioChunk(const Napi::CallbackInfo& info);

  // Prevent copy and assignment.
  EncodedAudioChunk(const EncodedAudioChunk&) = delete;
  EncodedAudioChunk& operator=(const EncodedAudioChunk&) = delete;

  // Property getters.
  Napi::Value GetType(const Napi::CallbackInfo& info);
  Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
  Napi::Value GetDuration(const Napi::CallbackInfo& info);
  Napi::Value GetByteLength(const Napi::CallbackInfo& info);

  // Methods.
  void CopyTo(const Napi::CallbackInfo& info);

  // Internal access.
  const std::vector<uint8_t>& GetData() const { return data_; }

 private:
  static Napi::FunctionReference constructor_;

  std::string type_;
  int64_t timestamp_;
  int64_t duration_;
  std::vector<uint8_t> data_;
};

#endif  // NODE_WEBCODECS_SRC_ENCODED_AUDIO_CHUNK_H_
```

**Step 4: Implement encoded_audio_chunk.cc**

Create: `src/encoded_audio_chunk.cc`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "encoded_audio_chunk.h"

#include <cstring>

Napi::FunctionReference EncodedAudioChunk::constructor_;

Napi::Object InitEncodedAudioChunk(Napi::Env env, Napi::Object exports)
{
  return EncodedAudioChunk::Init(env, exports);
}

Napi::Object EncodedAudioChunk::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func = DefineClass(env, "EncodedAudioChunk", {
      InstanceAccessor("type", &EncodedAudioChunk::GetType, nullptr),
      InstanceAccessor("timestamp", &EncodedAudioChunk::GetTimestamp, nullptr),
      InstanceAccessor("duration", &EncodedAudioChunk::GetDuration, nullptr),
      InstanceAccessor("byteLength", &EncodedAudioChunk::GetByteLength,
                       nullptr),
      InstanceMethod("copyTo", &EncodedAudioChunk::CopyTo),
  });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("EncodedAudioChunk", func);
  return exports;
}

Napi::Object EncodedAudioChunk::CreateInstance(Napi::Env env,
                                               const std::string& type,
                                               int64_t timestamp,
                                               int64_t duration,
                                               const uint8_t* data,
                                               size_t size)
{
  Napi::Object init = Napi::Object::New(env);
  init.Set("type", type);
  init.Set("timestamp", Napi::Number::New(env, static_cast<double>(timestamp)));
  init.Set("duration", Napi::Number::New(env, static_cast<double>(duration)));
  init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, size));
  return constructor_.New({init});
}

EncodedAudioChunk::EncodedAudioChunk(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EncodedAudioChunk>(info),
      timestamp_(0),
      duration_(0)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "EncodedAudioChunk requires init object")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Required: type.
  if (!init.Has("type") || !init.Get("type").IsString()) {
    Napi::TypeError::New(env, "init.type must be 'key' or 'delta'")
        .ThrowAsJavaScriptException();
    return;
  }
  type_ = init.Get("type").As<Napi::String>().Utf8Value();
  if (type_ != "key" && type_ != "delta") {
    Napi::TypeError::New(env, "init.type must be 'key' or 'delta'")
        .ThrowAsJavaScriptException();
    return;
  }

  // Required: timestamp.
  if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
    Napi::TypeError::New(env, "init.timestamp must be a number")
        .ThrowAsJavaScriptException();
    return;
  }
  timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

  // Optional: duration.
  if (init.Has("duration") && init.Get("duration").IsNumber()) {
    duration_ = init.Get("duration").As<Napi::Number>().Int64Value();
  }

  // Required: data.
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "init.data is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_val = init.Get("data");
  if (data_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_val.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = data_val.As<Napi::ArrayBuffer>();
    data_.assign(static_cast<uint8_t*>(ab.Data()),
                 static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
  } else if (data_val.IsTypedArray()) {
    Napi::TypedArray ta = data_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    size_t offset = ta.ByteOffset();
    size_t length = ta.ByteLength();
    data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                 static_cast<uint8_t*>(ab.Data()) + offset + length);
  } else {
    Napi::TypeError::New(env, "init.data must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
    }
}

Napi::Value EncodedAudioChunk::GetType(const Napi::CallbackInfo& info)
{
  return Napi::String::New(info.Env(), type_);
}

Napi::Value EncodedAudioChunk::GetTimestamp(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), static_cast<double>(timestamp_));
}

Napi::Value EncodedAudioChunk::GetDuration(const Napi::CallbackInfo& info)
{
  if (duration_ == 0) {
    return info.Env().Null();
  }
  return Napi::Number::New(info.Env(), static_cast<double>(duration_));
}

Napi::Value EncodedAudioChunk::GetByteLength(const Napi::CallbackInfo& info)
{
  return Napi::Number::New(info.Env(), static_cast<double>(data_.size()));
}

void EncodedAudioChunk::CopyTo(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "copyTo requires destination buffer")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Value dest_val = info[0];
  uint8_t* dest_data = nullptr;
  size_t dest_size = 0;

  if (dest_val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = dest_val.As<Napi::Buffer<uint8_t>>();
    dest_data = buf.Data();
    dest_size = buf.Length();
  } else if (dest_val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = dest_val.As<Napi::ArrayBuffer>();
    dest_data = static_cast<uint8_t*>(ab.Data());
    dest_size = ab.ByteLength();
  } else if (dest_val.IsTypedArray()) {
    Napi::TypedArray ta = dest_val.As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    dest_data = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
    dest_size = ta.ByteLength();
  } else {
    Napi::TypeError::New(env, "destination must be BufferSource")
        .ThrowAsJavaScriptException();
    return;
  }

  if (dest_size < data_.size()) {
    Napi::TypeError::New(env, "destination buffer too small")
        .ThrowAsJavaScriptException();
    return;
  }

  std::memcpy(dest_data, data_.data(), data_.size());
}
```

**Step 5: Update addon.cc**

Add:
```cpp
Napi::Object InitEncodedAudioChunk(Napi::Env env, Napi::Object exports);

// In InitAll:
InitEncodedAudioChunk(env, exports);
```

**Step 6: Rebuild and run test**

Run: `npm run build:native && node test/20_encoded_audio_chunk.js`
Expected: `PASS`

**Step 7: Commit**

```bash
git add src/encoded_audio_chunk.cc src/encoded_audio_chunk.h src/addon.cc test/20_encoded_audio_chunk.js
git commit -m "feat: implement EncodedAudioChunk class"
```

---

## Task 3: AudioEncoder Class - Core Structure

**Files:**
- Create: `src/audio_encoder.cc`
- Create: `src/audio_encoder.h`
- Modify: `src/addon.cc`
- Modify: `CMakeLists.txt` (add libswresample)
- Create: `test/21_audio_encoder_basic.js`

**Step 1: Write the failing test**

Create: `test/21_audio_encoder_basic.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 21: AudioEncoder basic structure');

let chunkReceived = false;
let errorReceived = false;

const encoder = new native.AudioEncoder({
    output: (chunk, metadata) => {
        chunkReceived = true;
        console.log(`Chunk: type=${chunk.type}, size=${chunk.byteLength}`);
    },
    error: (e) => {
        errorReceived = true;
        console.error('Error:', e);
    }
});

assert.strictEqual(encoder.state, 'unconfigured', 'Initial state should be unconfigured');

// Configure for AAC-LC
encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000
});

assert.strictEqual(encoder.state, 'configured', 'State should be configured');

encoder.close();
assert.strictEqual(encoder.state, 'closed', 'State should be closed');

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/21_audio_encoder_basic.js`
Expected: `TypeError: native.AudioEncoder is not a constructor`

**Step 3: Update CMakeLists.txt**

Add libswresample to the pkg_check_modules:

```cmake
pkg_check_modules(FFMPEG REQUIRED
    libavcodec
    libavutil
    libswscale
    libswresample
)
```

**Step 4: Create audio_encoder.h**

Create: `src/audio_encoder.h`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef NODE_WEBCODECS_SRC_AUDIO_ENCODER_H_
#define NODE_WEBCODECS_SRC_AUDIO_ENCODER_H_

#include <cstdint>
#include <string>

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libswresample/swresample.h>
}

class AudioEncoder : public Napi::ObjectWrap<AudioEncoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit AudioEncoder(const Napi::CallbackInfo& info);
  ~AudioEncoder() override;

  // Prevent copy and assignment.
  AudioEncoder(const AudioEncoder&) = delete;
  AudioEncoder& operator=(const AudioEncoder&) = delete;

 private:
  // WebCodecs API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Encode(const Napi::CallbackInfo& info);
  Napi::Value Flush(const Napi::CallbackInfo& info);
  Napi::Value Reset(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);
  Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);

  // Static methods.
  static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  void EmitChunks(Napi::Env env);

  // FFmpeg state.
  const AVCodec* codec_;
  AVCodecContext* codec_context_;
  SwrContext* swr_context_;
  AVFrame* frame_;
  AVPacket* packet_;

  // Callbacks.
  Napi::FunctionReference output_callback_;
  Napi::FunctionReference error_callback_;

  // State.
  std::string state_;
  uint32_t sample_rate_;
  uint32_t number_of_channels_;
  int64_t timestamp_;
  int frame_count_;
};

#endif  // NODE_WEBCODECS_SRC_AUDIO_ENCODER_H_
```

**Step 5: Implement audio_encoder.cpp (configure, close, state)**

Create: `src/audio_encoder.cpp`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "audio_encoder.h"
#include "encoded_audio_chunk.h"
#include "audio_data.h"

Napi::Object InitAudioEncoder(Napi::Env env, Napi::Object exports) {
    return AudioEncoder::Init(env, exports);
}

Napi::Object AudioEncoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "AudioEncoder", {
        InstanceMethod("configure", &AudioEncoder::Configure),
        InstanceMethod("encode", &AudioEncoder::Encode),
        InstanceMethod("flush", &AudioEncoder::Flush),
        InstanceMethod("reset", &AudioEncoder::Reset),
        InstanceMethod("close", &AudioEncoder::Close),
        InstanceAccessor("state", &AudioEncoder::GetState, nullptr),
        InstanceAccessor("encodeQueueSize", &AudioEncoder::GetEncodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &AudioEncoder::IsConfigSupported),
    });

    exports.Set("AudioEncoder", func);
    return exports;
}

AudioEncoder::AudioEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioEncoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swrContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      sampleRate_(0),
      numberOfChannels_(0),
      timestamp_(0),
      frameCount_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "AudioEncoder requires init object");
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

AudioEncoder::~AudioEncoder() {
    Cleanup();
}

void AudioEncoder::Cleanup() {
    if (frame_) {
        av_frame_free(&frame_);
        frame_ = nullptr;
    }
    if (packet_) {
        av_packet_free(&packet_);
        packet_ = nullptr;
    }
    if (swrContext_) {
        swr_free(&swrContext_);
        swrContext_ = nullptr;
    }
    if (codecContext_) {
        avcodec_free_context(&codecContext_);
        codecContext_ = nullptr;
    }
    codec_ = nullptr;
}

Napi::Value AudioEncoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Encoder is closed");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse codec string
    std::string codecStr = "mp4a.40.2"; // Default to AAC-LC
    if (config.Has("codec") && config.Get("codec").IsString()) {
        codecStr = config.Get("codec").As<Napi::String>().Utf8Value();
    }

    // Determine codec ID
    AVCodecID codecId = AV_CODEC_ID_AAC;
    if (codecStr == "opus") {
        codecId = AV_CODEC_ID_OPUS;
    } else if (codecStr.find("mp4a.40") == 0) {
        codecId = AV_CODEC_ID_AAC;
    }

    // Find encoder
    codec_ = avcodec_find_encoder(codecId);
    if (!codec_) {
        throw Napi::Error::New(env, "NotSupportedError: Encoder not found for codec");
    }

    // Clean up any previous context
    Cleanup();

    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Parse sample rate
    if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
        sampleRate_ = config.Get("sampleRate").As<Napi::Number>().Uint32Value();
    } else {
        sampleRate_ = 48000;
    }
    codecContext_->sample_rate = sampleRate_;

    // Parse number of channels
    if (config.Has("numberOfChannels") && config.Get("numberOfChannels").IsNumber()) {
        numberOfChannels_ = config.Get("numberOfChannels").As<Napi::Number>().Uint32Value();
    } else {
        numberOfChannels_ = 2;
    }

    // Set channel layout based on number of channels
    if (numberOfChannels_ == 1) {
        av_channel_layout_default(&codecContext_->ch_layout, 1);
    } else {
        av_channel_layout_default(&codecContext_->ch_layout, 2);
    }

    // Parse bitrate
    if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
        codecContext_->bit_rate = config.Get("bitrate").As<Napi::Number>().Int64Value();
    } else {
        codecContext_->bit_rate = 128000;
    }

    // Set sample format - AAC typically uses fltp (float planar)
    codecContext_->sample_fmt = codec_->sample_fmts ? codec_->sample_fmts[0] : AV_SAMPLE_FMT_FLTP;

    // Time base
    codecContext_->time_base = AVRational{1, static_cast<int>(sampleRate_)};

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

    if (!frame_ || !packet_) {
        Cleanup();
        throw Napi::Error::New(env, "Could not allocate frame/packet");
    }

    // Set up frame parameters
    frame_->nb_samples = codecContext_->frame_size;
    frame_->format = codecContext_->sample_fmt;
    av_channel_layout_copy(&frame_->ch_layout, &codecContext_->ch_layout);

    ret = av_frame_get_buffer(frame_, 0);
    if (ret < 0) {
        Cleanup();
        throw Napi::Error::New(env, "Could not allocate frame buffer");
    }

    // Create resampler context for format conversion
    swrContext_ = swr_alloc();
    if (!swrContext_) {
        Cleanup();
        throw Napi::Error::New(env, "Could not allocate resampler context");
    }

    // Configure resampler: f32 interleaved -> encoder's format
    AVChannelLayout inLayout;
    av_channel_layout_default(&inLayout, numberOfChannels_);

    av_opt_set_chlayout(swrContext_, "in_chlayout", &inLayout, 0);
    av_opt_set_int(swrContext_, "in_sample_rate", sampleRate_, 0);
    av_opt_set_sample_fmt(swrContext_, "in_sample_fmt", AV_SAMPLE_FMT_FLT, 0);

    av_opt_set_chlayout(swrContext_, "out_chlayout", &codecContext_->ch_layout, 0);
    av_opt_set_int(swrContext_, "out_sample_rate", sampleRate_, 0);
    av_opt_set_sample_fmt(swrContext_, "out_sample_fmt", codecContext_->sample_fmt, 0);

    ret = swr_init(swrContext_);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        Cleanup();
        throw Napi::Error::New(env, std::string("Could not init resampler: ") + errbuf);
    }

    state_ = "configured";
    frameCount_ = 0;

    return env.Undefined();
}

Napi::Value AudioEncoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value AudioEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), 0);
}

void AudioEncoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}

Napi::Value AudioEncoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset closed encoder");
    }

    Cleanup();
    state_ = "unconfigured";
    frameCount_ = 0;

    return env.Undefined();
}

Napi::Value AudioEncoder::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Encoder not configured");
    }

    // TODO: Implement in Task 4
    return env.Undefined();
}

Napi::Value AudioEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // TODO: Implement in Task 4
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}

void AudioEncoder::EmitChunks(Napi::Env env) {
    // TODO: Implement in Task 4
}

Napi::Value AudioEncoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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

        if (codec == "opus") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_OPUS);
            if (!c) supported = false;
        } else if (codec.find("mp4a.40") == 0) {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AAC);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    // Copy other recognized properties
    if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
        normalizedConfig.Set("sampleRate", config.Get("sampleRate"));
    }
    if (config.Has("numberOfChannels") && config.Get("numberOfChannels").IsNumber()) {
        normalizedConfig.Set("numberOfChannels", config.Get("numberOfChannels"));
    }
    if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
        normalizedConfig.Set("bitrate", config.Get("bitrate"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}
```

**Step 6: Update addon.cpp**

Add:
```cpp
Napi::Object InitAudioEncoder(Napi::Env env, Napi::Object exports);

// In InitAll:
InitAudioEncoder(env, exports);
```

**Step 7: Rebuild and run test**

Run: `npm run build:native && node test/21_audio_encoder_basic.js`
Expected: `PASS`

**Step 8: Commit**

```bash
git add src/audio_encoder.cpp src/audio_encoder.h src/addon.cpp CMakeLists.txt test/21_audio_encoder_basic.js
git commit -m "feat: implement AudioEncoder class with configure/close/state"
```

---

## Task 4: AudioEncoder encode() and flush()

**Files:**
- Modify: `src/audio_encoder.cpp`
- Create: `test/22_audio_encoder_encode.js`

**Step 1: Write the failing test**

Create: `test/22_audio_encoder_encode.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 22: AudioEncoder encode()');

const chunks = [];

const encoder = new native.AudioEncoder({
    output: (chunk, metadata) => {
        chunks.push(chunk);
        console.log(`Chunk: type=${chunk.type}, size=${chunk.byteLength}, ts=${chunk.timestamp}`);
    },
    error: (e) => {
        console.error('Encoder error:', e);
        process.exit(1);
    }
});

encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000
});

// Create 10 audio frames (each with 1024 samples at 48kHz)
const sampleRate = 48000;
const numberOfChannels = 2;
const frameSize = 1024;

for (let i = 0; i < 10; i++) {
    const samples = new Float32Array(frameSize * numberOfChannels);

    // Generate 440Hz sine wave
    for (let j = 0; j < frameSize; j++) {
        const t = (i * frameSize + j) / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
        samples[j * 2] = sample;     // Left
        samples[j * 2 + 1] = sample; // Right
    }

    const audioData = new native.AudioData({
        format: 'f32',
        sampleRate: sampleRate,
        numberOfFrames: frameSize,
        numberOfChannels: numberOfChannels,
        timestamp: i * Math.floor(frameSize / sampleRate * 1000000),
        data: samples.buffer
    });

    encoder.encode(audioData);
    audioData.close();
}

encoder.flush();
encoder.close();

console.log(`Encoded ${chunks.length} chunks`);
assert.ok(chunks.length > 0, 'Should have encoded chunks');

console.log('PASS');
```

**Step 2: Run test to verify it fails**

Run: `node test/22_audio_encoder_encode.js`
Expected: No chunks produced (encode is stubbed)

**Step 3: Implement AudioEncoder::Encode()**

Replace the stub in `src/audio_encoder.cpp`:

```cpp
Napi::Value AudioEncoder::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Encoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "encode requires AudioData");
    }

    // Get AudioData from wrapper or native object
    Napi::Object audioDataObj = info[0].As<Napi::Object>();

    // Get properties from AudioData
    uint32_t numberOfFrames = 0;
    if (audioDataObj.Has("numberOfFrames") && audioDataObj.Get("numberOfFrames").IsNumber()) {
        numberOfFrames = audioDataObj.Get("numberOfFrames").As<Napi::Number>().Uint32Value();
    }

    int64_t timestamp = 0;
    if (audioDataObj.Has("timestamp") && audioDataObj.Get("timestamp").IsNumber()) {
        timestamp = audioDataObj.Get("timestamp").As<Napi::Number>().Int64Value();
    }

    // Get sample data - try to unwrap as native AudioData first
    AudioData* nativeAudioData = nullptr;
    try {
        nativeAudioData = Napi::ObjectWrap<AudioData>::Unwrap(audioDataObj);
    } catch (...) {
        // Not a native AudioData, might be wrapped
    }

    const uint8_t* sampleData = nullptr;
    size_t sampleDataSize = 0;

    if (nativeAudioData && !nativeAudioData->IsClosed()) {
        const std::vector<uint8_t>& data = nativeAudioData->GetData();
        sampleData = data.data();
        sampleDataSize = data.size();
    } else {
        // Try to get data from a getData method or data property
        if (audioDataObj.Has("_native") && audioDataObj.Get("_native").IsObject()) {
            // It's a wrapped native object
            Napi::Object nativeObj = audioDataObj.Get("_native").As<Napi::Object>();
            try {
                nativeAudioData = Napi::ObjectWrap<AudioData>::Unwrap(nativeObj);
                if (nativeAudioData && !nativeAudioData->IsClosed()) {
                    const std::vector<uint8_t>& data = nativeAudioData->GetData();
                    sampleData = data.data();
                    sampleDataSize = data.size();
                }
            } catch (...) {}
        }
    }

    if (!sampleData || sampleDataSize == 0) {
        throw Napi::Error::New(env, "Could not get audio data");
    }

    // Make frame writable
    int ret = av_frame_make_writable(frame_);
    if (ret < 0) {
        throw Napi::Error::New(env, "Could not make frame writable");
    }

    // Convert samples using resampler
    const uint8_t* inData[] = { sampleData };
    ret = swr_convert(swrContext_, frame_->data, frame_->nb_samples,
                      inData, numberOfFrames);

    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        throw Napi::Error::New(env, std::string("Resample error: ") + errbuf);
    }

    frame_->pts = timestamp;

    // Send frame to encoder
    ret = avcodec_send_frame(codecContext_, frame_);
    if (ret < 0 && ret != AVERROR(EAGAIN)) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        errorCallback_.Call({ Napi::Error::New(env, std::string("Encode error: ") + errbuf).Value() });
        return env.Undefined();
    }

    // Emit any ready chunks
    EmitChunks(env);

    frameCount_++;

    return env.Undefined();
}
```

**Step 4: Implement AudioEncoder::EmitChunks()**

```cpp
void AudioEncoder::EmitChunks(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_packet(codecContext_, packet_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Receive packet error: ") + errbuf).Value() });
            break;
        }

        // Calculate duration in microseconds
        int64_t duration = 0;
        if (codecContext_->frame_size > 0) {
            duration = static_cast<int64_t>(codecContext_->frame_size) * 1000000 / sampleRate_;
        }

        // Create EncodedAudioChunk
        Napi::Object chunk = EncodedAudioChunk::CreateInstance(
            env,
            "key", // Audio chunks are typically all key frames
            packet_->pts,
            duration,
            packet_->data,
            packet_->size
        );

        // Call output callback
        outputCallback_.Call({ chunk });

        av_packet_unref(packet_);
    }
}
```

**Step 5: Implement AudioEncoder::Flush()**

```cpp
Napi::Value AudioEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Resolve(env.Undefined());
        return deferred.Promise();
    }

    // Send NULL frame to flush encoder
    avcodec_send_frame(codecContext_, nullptr);

    // Get remaining packets
    EmitChunks(env);

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}
```

**Step 6: Add include for encoded_audio_chunk.h**

At the top of `src/audio_encoder.cpp`:
```cpp
#include "encoded_audio_chunk.h"
```

**Step 7: Rebuild and run test**

Run: `npm run build:native && node test/22_audio_encoder_encode.js`
Expected: `PASS` with chunks logged

**Step 8: Commit**

```bash
git add src/audio_encoder.cpp test/22_audio_encoder_encode.js
git commit -m "feat(audio): implement AudioEncoder encode() and flush()"
```

---

## Task 5: AudioDecoder Class

**Files:**
- Create: `src/audio_decoder.cpp`
- Create: `src/audio_decoder.h`
- Modify: `src/addon.cpp`
- Create: `test/23_audio_decoder.js`

**Step 1: Write the failing test**

Create: `test/23_audio_decoder.js`

```javascript
const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 23: AudioDecoder');

// First encode some audio to get valid AAC data
const encodedChunks = [];

const encoder = new native.AudioEncoder({
    output: (chunk) => encodedChunks.push(chunk),
    error: (e) => console.error('Encoder error:', e)
});

encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000
});

// Encode 5 frames
const sampleRate = 48000;
const numberOfChannels = 2;
const frameSize = 1024;

for (let i = 0; i < 5; i++) {
    const samples = new Float32Array(frameSize * numberOfChannels);
    for (let j = 0; j < frameSize; j++) {
        const t = (i * frameSize + j) / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
        samples[j * 2] = sample;
        samples[j * 2 + 1] = sample;
    }

    const audioData = new native.AudioData({
        format: 'f32',
        sampleRate: sampleRate,
        numberOfFrames: frameSize,
        numberOfChannels: numberOfChannels,
        timestamp: i * Math.floor(frameSize / sampleRate * 1000000),
        data: samples.buffer
    });

    encoder.encode(audioData);
    audioData.close();
}

encoder.flush();
encoder.close();

console.log(`Encoded ${encodedChunks.length} chunks`);

// Now decode
let decodedCount = 0;

const decoder = new native.AudioDecoder({
    output: (audioData) => {
        decodedCount++;
        console.log(`Decoded: sampleRate=${audioData.sampleRate}, channels=${audioData.numberOfChannels}, frames=${audioData.numberOfFrames}`);
        audioData.close();
    },
    error: (e) => {
        console.error('Decoder error:', e);
    }
});

assert.strictEqual(decoder.state, 'unconfigured');

decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2
});

assert.strictEqual(decoder.state, 'configured');

// Decode chunks
for (const chunk of encodedChunks) {
    decoder.decode(chunk);
}

decoder.flush();
decoder.close();

console.log(`Decoded ${decodedCount} audio data objects`);
assert.ok(decodedCount > 0, 'Should have decoded audio');

console.log('PASS');
```

**Step 2: Create audio_decoder.h**

Create: `src/audio_decoder.h`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#ifndef AUDIO_DECODER_H
#define AUDIO_DECODER_H

#include <napi.h>
#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswresample/swresample.h>
}

class AudioDecoder : public Napi::ObjectWrap<AudioDecoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioDecoder(const Napi::CallbackInfo& info);
    ~AudioDecoder();

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
    void EmitAudioData(Napi::Env env);

    // FFmpeg state
    const AVCodec* codec_;
    AVCodecContext* codecContext_;
    SwrContext* swrContext_;
    AVFrame* frame_;
    AVPacket* packet_;

    // Callbacks
    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    // State
    std::string state_;
    uint32_t sampleRate_;
    uint32_t numberOfChannels_;
};

#endif
```

**Step 3: Implement audio_decoder.cpp**

Create: `src/audio_decoder.cpp`

```cpp
// Copyright 2025 node-webcodecs contributors. All rights reserved.
// SPDX-License-Identifier: MIT

#include "audio_decoder.h"
#include "audio_data.h"
#include "encoded_audio_chunk.h"

static const int MICROSECONDS_PER_SECOND = 1000000;

Napi::Object InitAudioDecoder(Napi::Env env, Napi::Object exports) {
    return AudioDecoder::Init(env, exports);
}

Napi::Object AudioDecoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "AudioDecoder", {
        InstanceMethod("configure", &AudioDecoder::Configure),
        InstanceMethod("decode", &AudioDecoder::Decode),
        InstanceMethod("flush", &AudioDecoder::Flush),
        InstanceMethod("reset", &AudioDecoder::Reset),
        InstanceMethod("close", &AudioDecoder::Close),
        InstanceAccessor("state", &AudioDecoder::GetState, nullptr),
        InstanceAccessor("decodeQueueSize", &AudioDecoder::GetDecodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &AudioDecoder::IsConfigSupported),
    });

    exports.Set("AudioDecoder", func);
    return exports;
}

AudioDecoder::AudioDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AudioDecoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swrContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      sampleRate_(0),
      numberOfChannels_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "AudioDecoder requires init object");
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

AudioDecoder::~AudioDecoder() {
    Cleanup();
}

void AudioDecoder::Cleanup() {
    if (frame_) {
        av_frame_free(&frame_);
        frame_ = nullptr;
    }
    if (packet_) {
        av_packet_free(&packet_);
        packet_ = nullptr;
    }
    if (swrContext_) {
        swr_free(&swrContext_);
        swrContext_ = nullptr;
    }
    if (codecContext_) {
        avcodec_free_context(&codecContext_);
        codecContext_ = nullptr;
    }
    codec_ = nullptr;
}

Napi::Value AudioDecoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder is closed");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse codec string
    std::string codecStr = "mp4a.40.2";
    if (config.Has("codec") && config.Get("codec").IsString()) {
        codecStr = config.Get("codec").As<Napi::String>().Utf8Value();
    }

    // Determine codec ID
    AVCodecID codecId = AV_CODEC_ID_AAC;
    if (codecStr == "opus") {
        codecId = AV_CODEC_ID_OPUS;
    } else if (codecStr.find("mp4a.40") == 0) {
        codecId = AV_CODEC_ID_AAC;
    }

    // Find decoder
    codec_ = avcodec_find_decoder(codecId);
    if (!codec_) {
        throw Napi::Error::New(env, "NotSupportedError: Decoder not found");
    }

    // Clean up any previous context
    Cleanup();

    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Parse sample rate
    if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
        sampleRate_ = config.Get("sampleRate").As<Napi::Number>().Uint32Value();
        codecContext_->sample_rate = sampleRate_;
    }

    // Parse number of channels
    if (config.Has("numberOfChannels") && config.Get("numberOfChannels").IsNumber()) {
        numberOfChannels_ = config.Get("numberOfChannels").As<Napi::Number>().Uint32Value();
        av_channel_layout_default(&codecContext_->ch_layout, numberOfChannels_);
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

Napi::Value AudioDecoder::Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "decode requires EncodedAudioChunk");
    }

    Napi::Object chunk = info[0].As<Napi::Object>();

    // Get chunk data
    const uint8_t* chunkData = nullptr;
    size_t chunkSize = 0;

    EncodedAudioChunk* nativeChunk = nullptr;
    try {
        nativeChunk = Napi::ObjectWrap<EncodedAudioChunk>::Unwrap(chunk);
    } catch (...) {}

    if (nativeChunk) {
        const std::vector<uint8_t>& data = nativeChunk->GetData();
        chunkData = data.data();
        chunkSize = data.size();
    } else {
        // Try to get data from properties
        if (chunk.Has("byteLength") && chunk.Get("byteLength").IsNumber()) {
            chunkSize = chunk.Get("byteLength").As<Napi::Number>().Uint32Value();
        }
        // Use copyTo if available
        if (chunk.Has("copyTo") && chunk.Get("copyTo").IsFunction() && chunkSize > 0) {
            std::vector<uint8_t> tempBuf(chunkSize);
            Napi::Buffer<uint8_t> dest = Napi::Buffer<uint8_t>::New(env, tempBuf.data(), tempBuf.size());
            chunk.Get("copyTo").As<Napi::Function>().Call(chunk, { dest });

            // Need to copy to packet
            av_packet_unref(packet_);
            av_new_packet(packet_, chunkSize);
            std::memcpy(packet_->data, tempBuf.data(), chunkSize);

            // Get timestamp
            if (chunk.Has("timestamp") && chunk.Get("timestamp").IsNumber()) {
                packet_->pts = chunk.Get("timestamp").As<Napi::Number>().Int64Value();
            }

            // Send packet to decoder
            int ret = avcodec_send_packet(codecContext_, packet_);
            if (ret < 0 && ret != AVERROR(EAGAIN)) {
                char errbuf[256];
                av_strerror(ret, errbuf, sizeof(errbuf));
                errorCallback_.Call({ Napi::Error::New(env, std::string("Decode error: ") + errbuf).Value() });
                return env.Undefined();
            }

            EmitAudioData(env);
            return env.Undefined();
        }
    }

    if (chunkData && chunkSize > 0) {
        av_packet_unref(packet_);
        av_new_packet(packet_, chunkSize);
        std::memcpy(packet_->data, chunkData, chunkSize);

        if (chunk.Has("timestamp") && chunk.Get("timestamp").IsNumber()) {
            packet_->pts = chunk.Get("timestamp").As<Napi::Number>().Int64Value();
        }

        int ret = avcodec_send_packet(codecContext_, packet_);
        if (ret < 0 && ret != AVERROR(EAGAIN)) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Decode error: ") + errbuf).Value() });
            return env.Undefined();
        }

        EmitAudioData(env);
    }

    return env.Undefined();
}

void AudioDecoder::EmitAudioData(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_frame(codecContext_, frame_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Receive frame error: ") + errbuf).Value() });
            break;
        }

        // Convert to f32 interleaved if needed
        int numSamples = frame_->nb_samples;
        int numChannels = frame_->ch_layout.nb_channels;
        int sampleRate = frame_->sample_rate > 0 ? frame_->sample_rate : sampleRate_;

        // Output buffer
        size_t outSize = numSamples * numChannels * sizeof(float);
        std::vector<uint8_t> outData(outSize);

        // Create resampler if needed
        if (!swrContext_) {
            swrContext_ = swr_alloc();

            AVChannelLayout outLayout;
            av_channel_layout_default(&outLayout, numChannels);

            av_opt_set_chlayout(swrContext_, "in_chlayout", &frame_->ch_layout, 0);
            av_opt_set_int(swrContext_, "in_sample_rate", sampleRate, 0);
            av_opt_set_sample_fmt(swrContext_, "in_sample_fmt", (AVSampleFormat)frame_->format, 0);

            av_opt_set_chlayout(swrContext_, "out_chlayout", &outLayout, 0);
            av_opt_set_int(swrContext_, "out_sample_rate", sampleRate, 0);
            av_opt_set_sample_fmt(swrContext_, "out_sample_fmt", AV_SAMPLE_FMT_FLT, 0);

            swr_init(swrContext_);
        }

        uint8_t* outPtr = outData.data();
        swr_convert(swrContext_, &outPtr, numSamples,
                    (const uint8_t**)frame_->data, numSamples);

        // Create AudioData
        Napi::Object audioData = AudioData::CreateInstance(
            env,
            "f32",
            sampleRate,
            numSamples,
            numChannels,
            frame_->pts,
            outData.data(),
            outSize
        );

        outputCallback_.Call({ audioData });

        av_frame_unref(frame_);
    }
}

Napi::Value AudioDecoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "configured") {
        avcodec_send_packet(codecContext_, nullptr);
        EmitAudioData(env);
    }

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}

Napi::Value AudioDecoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset closed decoder");
    }

    Cleanup();
    state_ = "unconfigured";

    return env.Undefined();
}

void AudioDecoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}

Napi::Value AudioDecoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value AudioDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), 0);
}

Napi::Value AudioDecoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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

    if (!config.Has("codec") || !config.Get("codec").IsString()) {
        supported = false;
    } else {
        std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
        normalizedConfig.Set("codec", codec);

        if (codec == "opus") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_OPUS);
            if (!c) supported = false;
        } else if (codec.find("mp4a.40") == 0) {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AAC);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    if (config.Has("sampleRate") && config.Get("sampleRate").IsNumber()) {
        normalizedConfig.Set("sampleRate", config.Get("sampleRate"));
    }
    if (config.Has("numberOfChannels") && config.Get("numberOfChannels").IsNumber()) {
        normalizedConfig.Set("numberOfChannels", config.Get("numberOfChannels"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}
```

**Step 4: Update addon.cpp**

Add:
```cpp
Napi::Object InitAudioDecoder(Napi::Env env, Napi::Object exports);

// In InitAll:
InitAudioDecoder(env, exports);
```

**Step 5: Rebuild and run test**

Run: `npm run build:native && node test/23_audio_decoder.js`
Expected: `PASS`

**Step 6: Commit**

```bash
git add src/audio_decoder.cpp src/audio_decoder.h src/addon.cpp test/23_audio_decoder.js
git commit -m "feat: implement AudioDecoder class"
```

---

## Task 6: TypeScript Wrappers for Audio Classes

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/index.ts`
- Create: `test/24_audio_typescript.js`

**Step 1: Write the failing test**

Create: `test/24_audio_typescript.js`

```javascript
const { AudioEncoder, AudioDecoder, AudioData, EncodedAudioChunk } = require('../dist');
const assert = require('assert');

console.log('Test 24: Audio TypeScript wrappers');

async function runTest() {
    // Test AudioData
    const samples = new Float32Array(1024 * 2);
    for (let i = 0; i < 1024; i++) {
        const t = i / 48000;
        samples[i * 2] = Math.sin(2 * Math.PI * 440 * t);
        samples[i * 2 + 1] = Math.sin(2 * Math.PI * 440 * t);
    }

    const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: samples.buffer
    });

    assert.strictEqual(audioData.sampleRate, 48000);
    assert.strictEqual(audioData.numberOfChannels, 2);
    assert.strictEqual(audioData.numberOfFrames, 1024);

    // Test AudioEncoder
    const chunks = [];
    const encoder = new AudioEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => console.error(e)
    });

    assert.strictEqual(encoder.state, 'unconfigured');

    const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(support.supported, true);

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    assert.strictEqual(encoder.state, 'configured');

    encoder.encode(audioData);
    audioData.close();

    await encoder.flush();
    encoder.close();

    console.log(`Encoded ${chunks.length} chunks`);

    // Test AudioDecoder
    let decodedCount = 0;
    const decoder = new AudioDecoder({
        output: (data) => {
            decodedCount++;
            data.close();
        },
        error: (e) => console.error(e)
    });

    decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });

    for (const chunk of chunks) {
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    console.log(`Decoded ${decodedCount} frames`);

    console.log('PASS');
}

runTest().catch(e => {
    console.error('FAIL:', e);
    process.exit(1);
});
```

**Step 2: Add types to lib/types.ts**

Add to `lib/types.ts`:

```typescript
export type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';

export interface AudioDataInit {
    format: AudioSampleFormat;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    timestamp: number;
    data: ArrayBuffer | ArrayBufferView;
    transfer?: ArrayBuffer[];
}

export interface AudioEncoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    bitrate?: number;
    bitrateMode?: 'constant' | 'variable';
}

export interface AudioEncoderInit {
    output: (chunk: any, metadata?: any) => void;
    error: (error: Error) => void;
}

export interface AudioDecoderConfig {
    codec: string;
    sampleRate: number;
    numberOfChannels: number;
    description?: ArrayBuffer | ArrayBufferView;
}

export interface AudioDecoderInit {
    output: (data: any) => void;
    error: (error: Error) => void;
}
```

**Step 3: Add wrapper classes to lib/index.ts**

Add to `lib/index.ts`:

```typescript
export class AudioData {
    private _native: any;
    private _closed: boolean = false;

    constructor(init: AudioDataInit) {
        this._native = new native.AudioData(init);
    }

    get format(): AudioSampleFormat {
        return this._native.format;
    }

    get sampleRate(): number {
        return this._native.sampleRate;
    }

    get numberOfFrames(): number {
        return this._native.numberOfFrames;
    }

    get numberOfChannels(): number {
        return this._native.numberOfChannels;
    }

    get duration(): number {
        return this._native.duration;
    }

    get timestamp(): number {
        return this._native.timestamp;
    }

    allocationSize(options?: any): number {
        return this._native.allocationSize(options);
    }

    copyTo(destination: ArrayBuffer | ArrayBufferView, options?: any): void {
        this._native.copyTo(destination, options);
    }

    clone(): AudioData {
        const wrapper = Object.create(AudioData.prototype);
        wrapper._native = this._native.clone();
        wrapper._closed = false;
        return wrapper;
    }

    close(): void {
        if (!this._closed) {
            this._native.close();
            this._closed = true;
        }
    }
}

export class EncodedAudioChunk {
    private _native: any;

    constructor(init: { type: string; timestamp: number; duration?: number; data: ArrayBuffer | ArrayBufferView }) {
        this._native = new native.EncodedAudioChunk(init);
    }

    get type(): string {
        return this._native.type;
    }

    get timestamp(): number {
        return this._native.timestamp;
    }

    get duration(): number | null {
        return this._native.duration;
    }

    get byteLength(): number {
        return this._native.byteLength;
    }

    copyTo(destination: ArrayBuffer | ArrayBufferView): void {
        this._native.copyTo(destination);
    }
}

export class AudioEncoder {
    private _native: any;

    constructor(init: AudioEncoderInit) {
        this._native = new native.AudioEncoder({
            output: (chunk: any, metadata?: any) => {
                const wrapper = Object.create(EncodedAudioChunk.prototype);
                wrapper._native = chunk;
                init.output(wrapper, metadata);
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get encodeQueueSize(): number {
        return this._native.encodeQueueSize;
    }

    configure(config: AudioEncoderConfig): void {
        this._native.configure(config);
    }

    encode(data: AudioData): void {
        if ((data as any)._native) {
            this._native.encode((data as any)._native);
        } else {
            this._native.encode(data);
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

    static async isConfigSupported(config: AudioEncoderConfig): Promise<{
        supported: boolean;
        config: AudioEncoderConfig;
    }> {
        return native.AudioEncoder.isConfigSupported(config);
    }
}

export class AudioDecoder {
    private _native: any;

    constructor(init: AudioDecoderInit) {
        this._native = new native.AudioDecoder({
            output: (data: any) => {
                const wrapper = Object.create(AudioData.prototype);
                wrapper._native = data;
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

    configure(config: AudioDecoderConfig): void {
        this._native.configure(config);
    }

    decode(chunk: EncodedAudioChunk): void {
        if ((chunk as any)._native) {
            this._native.decode((chunk as any)._native);
        } else {
            this._native.decode(chunk);
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

    static async isConfigSupported(config: AudioDecoderConfig): Promise<{
        supported: boolean;
        config: AudioDecoderConfig;
    }> {
        return native.AudioDecoder.isConfigSupported(config);
    }
}
```

**Step 4: Update exports**

Ensure all new classes are exported.

**Step 5: Rebuild and run test**

Run: `npm run build && node test/24_audio_typescript.js`
Expected: `PASS`

**Step 6: Commit**

```bash
git add lib/types.ts lib/index.ts test/24_audio_typescript.js
git commit -m "feat: add TypeScript wrappers for audio classes"
```

---

## Task 7: Update Test Suite

**Files:**
- Modify: `test/suite.js`

**Step 1: Add new tests to suite**

Add the following tests:
- `19_audio_data.js`
- `20_encoded_audio_chunk.js`
- `21_audio_encoder_basic.js`
- `22_audio_encoder_encode.js`
- `23_audio_decoder.js`
- `24_audio_typescript.js`

**Step 2: Run full suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add test/suite.js
git commit -m "test: add audio tests to suite"
```

---

## Summary

This plan implements audio support for node-webcodecs:

**Completed:**
- [x] AudioData class with all properties and methods
- [x] EncodedAudioChunk class with copyTo()
- [x] AudioEncoder class with configure, encode, flush, reset, close
- [x] AudioDecoder class with configure, decode, flush, reset, close
- [x] TypeScript wrappers for all audio classes
- [x] isConfigSupported() for both encoder and decoder

**Codec Support:**
- AAC (mp4a.40.2) encoding and decoding
- Opus encoding and decoding (if FFmpeg built with libopus)

**Test Coverage:**
- 6 new test files covering audio functionality
- Round-trip encode/decode verification

**Ready for next phase:**
- Hardware acceleration
- Additional codec support (VP8, VP9, AV1)
- ImageDecoder
- Advanced audio format conversion
