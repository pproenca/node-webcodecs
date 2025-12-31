# Muxer Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-muxer-implementation.md` to implement task-by-task.

**Goal:** Implement a native Muxer class that writes MP4 containers, eliminating FFmpeg CLI calls from examples.

**Architecture:** The Muxer follows the existing Demuxer pattern - native C++ class using FFmpeg's libavformat for container writing, with a TypeScript wrapper exposing `addTrack()`, `write()`, and `finalize()` methods. Video and audio tracks are added with codec configuration, chunks are written with timestamps, and the container is finalized to write the trailer.

**Tech Stack:** C++17, FFmpeg libavformat/libavcodec, node-addon-api (NAPI), TypeScript

---

## Task Groups Overview

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Foundation: native Muxer header and RAII types |
| Group 2 | 2 | Native Muxer implementation |
| Group 3 | 3 | TypeScript wrapper and types |
| Group 4 | 4 | Integration test for Muxer |
| Group 5 | 5 | Update examples to use Muxer |
| Group 6 | 6 | Code Review |

---

### Task 1: Create Native Muxer Header and RAII Deleter

**Files:**
- Create: `src/muxer.h`
- Modify: `src/ffmpeg_raii.h:79-86` (add output context deleter)

**Step 1: Write the failing test** (2-5 min)

Create a minimal test that imports Muxer (will fail until header exists):

```typescript
// test/golden/muxer.test.ts
import {describe, it, expect} from 'vitest';

describe('Muxer', () => {
  it('should be exported from the library', async () => {
    const {Muxer} = await import('../../dist/index.js');
    expect(Muxer).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/muxer.test.ts
```

Expected: FAIL with `Muxer is not exported` or similar import error.

**Step 3: Create the header file** (5 min)

Create `src/muxer.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_MUXER_H_
#define SRC_MUXER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
}

#include <napi.h>

#include <memory>
#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"

struct MuxerTrackConfig {
  std::string type;  // "video" or "audio"
  std::string codec;
  int width;
  int height;
  int sample_rate;
  int channels;
  int bitrate;
  int framerate;
  std::vector<uint8_t> description;  // codec extradata (e.g., avcC for H.264)
};

class Muxer : public Napi::ObjectWrap<Muxer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::FunctionReference constructor;

  explicit Muxer(const Napi::CallbackInfo& info);
  ~Muxer();

  // Disallow copy and assign.
  Muxer(const Muxer&) = delete;
  Muxer& operator=(const Muxer&) = delete;

 private:
  Napi::Value AddVideoTrack(const Napi::CallbackInfo& info);
  Napi::Value AddAudioTrack(const Napi::CallbackInfo& info);
  Napi::Value WriteVideoChunk(const Napi::CallbackInfo& info);
  Napi::Value WriteAudioChunk(const Napi::CallbackInfo& info);
  Napi::Value Finalize(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);

  void Cleanup();
  AVCodecID CodecIdFromString(const std::string& codec);

  ffmpeg::AVFormatContextOutputPtr format_context_;
  std::string filename_;
  bool header_written_;
  bool finalized_;
  int video_stream_index_;
  int audio_stream_index_;
};

Napi::Object InitMuxer(Napi::Env env, Napi::Object exports);

#endif  // SRC_MUXER_H_
```

**Step 4: Add output context RAII deleter to ffmpeg_raii.h** (2 min)

Add after `AVFormatContextDeleter` (around line 86):

```cpp
// AVFormatContext deleter (for muxing - uses different cleanup)
struct AVFormatContextOutputDeleter {
  void operator()(AVFormatContext* ctx) const noexcept {
    if (ctx) {
      if (ctx->pb) {
        avio_closep(&ctx->pb);
      }
      avformat_free_context(ctx);
    }
  }
};
```

And add the type alias after `AVFormatContextPtr` (around line 113):

```cpp
using AVFormatContextOutputPtr =
    std::unique_ptr<AVFormatContext, AVFormatContextOutputDeleter>;
```

**Step 5: Commit** (30 sec)

```bash
git add src/muxer.h src/ffmpeg_raii.h
git commit -m "feat(muxer): add native Muxer header and RAII output context deleter"
```

---

### Task 2: Implement Native Muxer C++ Class

**Files:**
- Create: `src/muxer.cc`
- Modify: `src/addon.cc:21` (add InitMuxer forward declaration)
- Modify: `src/addon.cc:67` (call InitMuxer)
- Modify: `binding.gyp:17` (add muxer.cc to sources)

**Step 1: Write the failing test** (2-5 min)

Extend the test to verify native addon loads:

```typescript
// test/golden/muxer.test.ts (append to existing)
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Muxer', () => {
  it('should be exported from the library', async () => {
    const {Muxer} = await import('../../dist/index.js');
    expect(Muxer).toBeDefined();
  });

  describe('constructor', () => {
    let tempDir: string;
    let outputPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-test-'));
      outputPath = path.join(tempDir, 'test-output.mp4');
    });

    afterEach(() => {
      fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('should create a muxer instance with filename', async () => {
      const {Muxer} = await import('../../dist/index.js');
      const muxer = new Muxer({filename: outputPath});
      expect(muxer).toBeDefined();
      muxer.close();
    });

    it('should throw if filename is missing', async () => {
      const {Muxer} = await import('../../dist/index.js');
      expect(() => new Muxer({})).toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build && npx vitest run test/golden/muxer.test.ts
```

Expected: FAIL - Muxer not found or native module error.

**Step 3: Implement muxer.cc** (10 min)

Create `src/muxer.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/muxer.h"

#include <cstring>
#include <string>

#include "src/common.h"

Napi::FunctionReference Muxer::constructor;

Napi::Object InitMuxer(Napi::Env env, Napi::Object exports) {
  return Muxer::Init(env, exports);
}

Napi::Object Muxer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "Muxer",
      {
          InstanceMethod("addVideoTrack", &Muxer::AddVideoTrack),
          InstanceMethod("addAudioTrack", &Muxer::AddAudioTrack),
          InstanceMethod("writeVideoChunk", &Muxer::WriteVideoChunk),
          InstanceMethod("writeAudioChunk", &Muxer::WriteAudioChunk),
          InstanceMethod("finalize", &Muxer::Finalize),
          InstanceMethod("close", &Muxer::Close),
      });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Muxer", func);
  return exports;
}

Muxer::Muxer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<Muxer>(info),
      header_written_(false),
      finalized_(false),
      video_stream_index_(-1),
      audio_stream_index_(-1) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Options object required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object options = info[0].As<Napi::Object>();

  if (!options.Has("filename")) {
    Napi::TypeError::New(env, "filename is required")
        .ThrowAsJavaScriptException();
    return;
  }

  filename_ = options.Get("filename").As<Napi::String>().Utf8Value();

  // Allocate output format context for MP4.
  AVFormatContext* raw_ctx = nullptr;
  int ret = avformat_alloc_output_context2(&raw_ctx, nullptr, "mp4",
                                            filename_.c_str());
  if (ret < 0 || !raw_ctx) {
    Napi::Error::New(env, "Failed to allocate output format context")
        .ThrowAsJavaScriptException();
    return;
  }
  format_context_.reset(raw_ctx);

  // Open output file.
  ret = avio_open(&format_context_->pb, filename_.c_str(), AVIO_FLAG_WRITE);
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to open output file: ") + err)
        .ThrowAsJavaScriptException();
    return;
  }
}

Muxer::~Muxer() { Cleanup(); }

void Muxer::Cleanup() {
  if (format_context_ && !finalized_ && header_written_) {
    // Try to write trailer if header was written but not finalized.
    av_write_trailer(format_context_.get());
  }
  format_context_.reset();
}

AVCodecID Muxer::CodecIdFromString(const std::string& codec) {
  // Parse codec string to FFmpeg codec ID.
  if (codec.find("avc1") == 0 || codec.find("h264") == 0) {
    return AV_CODEC_ID_H264;
  } else if (codec.find("hvc1") == 0 || codec.find("hev1") == 0 ||
             codec.find("hevc") == 0) {
    return AV_CODEC_ID_HEVC;
  } else if (codec.find("vp09") == 0 || codec.find("vp9") == 0) {
    return AV_CODEC_ID_VP9;
  } else if (codec.find("av01") == 0 || codec.find("av1") == 0) {
    return AV_CODEC_ID_AV1;
  } else if (codec.find("mp4a") == 0 || codec.find("aac") == 0) {
    return AV_CODEC_ID_AAC;
  } else if (codec.find("opus") == 0) {
    return AV_CODEC_ID_OPUS;
  }
  return AV_CODEC_ID_NONE;
}

Napi::Value Muxer::AddVideoTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (header_written_) {
    Napi::Error::New(env, "Cannot add track after writing has started")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  int width = webcodecs::AttrAsInt32(config, "width");
  int height = webcodecs::AttrAsInt32(config, "height");
  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", 2000000);
  int framerate = webcodecs::AttrAsInt32(config, "framerate", 30);

  AVCodecID codec_id = CodecIdFromString(codec);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::Error::New(env, "Unsupported video codec: " + codec)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  AVStream* stream = avformat_new_stream(format_context_.get(), nullptr);
  if (!stream) {
    Napi::Error::New(env, "Failed to create video stream")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  stream->codecpar->codec_type = AVMEDIA_TYPE_VIDEO;
  stream->codecpar->codec_id = codec_id;
  stream->codecpar->width = width;
  stream->codecpar->height = height;
  stream->codecpar->bit_rate = bitrate;
  stream->time_base = {1, 1000000};  // Microseconds (WebCodecs timestamps)

  // Copy extradata (description) if provided.
  if (config.Has("description")) {
    auto [data, size] = webcodecs::AttrAsBuffer(config, "description");
    if (data && size > 0) {
      stream->codecpar->extradata =
          static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));
      if (stream->codecpar->extradata) {
        memcpy(stream->codecpar->extradata, data, size);
        stream->codecpar->extradata_size = static_cast<int>(size);
      }
    }
  }

  video_stream_index_ = stream->index;
  return Napi::Number::New(env, stream->index);
}

Napi::Value Muxer::AddAudioTrack(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (header_written_) {
    Napi::Error::New(env, "Cannot add track after writing has started")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  std::string codec = webcodecs::AttrAsStr(config, "codec");
  int sample_rate = webcodecs::AttrAsInt32(config, "sampleRate", 48000);
  int channels = webcodecs::AttrAsInt32(config, "numberOfChannels", 2);
  int bitrate = webcodecs::AttrAsInt32(config, "bitrate", 128000);

  AVCodecID codec_id = CodecIdFromString(codec);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::Error::New(env, "Unsupported audio codec: " + codec)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  AVStream* stream = avformat_new_stream(format_context_.get(), nullptr);
  if (!stream) {
    Napi::Error::New(env, "Failed to create audio stream")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  stream->codecpar->codec_type = AVMEDIA_TYPE_AUDIO;
  stream->codecpar->codec_id = codec_id;
  stream->codecpar->sample_rate = sample_rate;
  av_channel_layout_default(&stream->codecpar->ch_layout, channels);
  stream->codecpar->bit_rate = bitrate;
  stream->time_base = {1, 1000000};

  // Copy extradata if provided.
  if (config.Has("description")) {
    auto [data, size] = webcodecs::AttrAsBuffer(config, "description");
    if (data && size > 0) {
      stream->codecpar->extradata =
          static_cast<uint8_t*>(av_malloc(size + AV_INPUT_BUFFER_PADDING_SIZE));
      if (stream->codecpar->extradata) {
        memcpy(stream->codecpar->extradata, data, size);
        stream->codecpar->extradata_size = static_cast<int>(size);
      }
    }
  }

  audio_stream_index_ = stream->index;
  return Napi::Number::New(env, stream->index);
}

Napi::Value Muxer::WriteVideoChunk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (video_stream_index_ < 0) {
    Napi::Error::New(env, "No video track added")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Chunk object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Write header on first chunk.
  if (!header_written_) {
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  Napi::Object chunk = info[0].As<Napi::Object>();

  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    Napi::Error::New(env, "Failed to allocate packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get chunk data.
  auto [data, size] = webcodecs::AttrAsBuffer(chunk, "data");
  if (!data || size == 0) {
    // Try to call copyTo method if data is not a direct buffer.
    if (chunk.Has("byteLength") && chunk.Has("copyTo")) {
      int byte_length = chunk.Get("byteLength").As<Napi::Number>().Int32Value();
      Napi::Buffer<uint8_t> buf = Napi::Buffer<uint8_t>::New(env, byte_length);
      chunk.Get("copyTo").As<Napi::Function>().Call(chunk, {buf});
      data = buf.Data();
      size = byte_length;

      // Copy to packet.
      int ret = av_new_packet(packet.get(), static_cast<int>(size));
      if (ret < 0) {
        Napi::Error::New(env, "Failed to allocate packet data")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
      memcpy(packet->data, data, size);
    } else {
      Napi::Error::New(env, "Chunk must have data buffer or copyTo method")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  } else {
    int ret = av_new_packet(packet.get(), static_cast<int>(size));
    if (ret < 0) {
      Napi::Error::New(env, "Failed to allocate packet data")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    memcpy(packet->data, data, size);
  }

  // Set packet metadata.
  int64_t timestamp = webcodecs::AttrAsInt64(chunk, "timestamp");
  int64_t duration = webcodecs::AttrAsInt64(chunk, "duration", 0);
  std::string type = webcodecs::AttrAsStr(chunk, "type", "delta");

  packet->stream_index = video_stream_index_;
  packet->pts = timestamp;
  packet->dts = timestamp;
  packet->duration = duration;

  if (type == "key") {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  // Rescale timestamps from microseconds to stream time base.
  AVStream* stream = format_context_->streams[video_stream_index_];
  av_packet_rescale_ts(packet.get(), {1, 1000000}, stream->time_base);

  int ret = av_interleaved_write_frame(format_context_.get(), packet.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write packet: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

Napi::Value Muxer::WriteAudioChunk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (audio_stream_index_ < 0) {
    Napi::Error::New(env, "No audio track added")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Implementation mirrors WriteVideoChunk but uses audio_stream_index_.
  // For brevity, audio muxing follows same pattern as video.
  // Full implementation would be identical with audio_stream_index_.

  if (!header_written_) {
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Chunk object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object chunk = info[0].As<Napi::Object>();

  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    Napi::Error::New(env, "Failed to allocate packet")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto [data, size] = webcodecs::AttrAsBuffer(chunk, "data");
  if (!data || size == 0) {
    if (chunk.Has("byteLength") && chunk.Has("copyTo")) {
      int byte_length = chunk.Get("byteLength").As<Napi::Number>().Int32Value();
      Napi::Buffer<uint8_t> buf = Napi::Buffer<uint8_t>::New(env, byte_length);
      chunk.Get("copyTo").As<Napi::Function>().Call(chunk, {buf});
      data = buf.Data();
      size = byte_length;

      int ret = av_new_packet(packet.get(), static_cast<int>(size));
      if (ret < 0) {
        Napi::Error::New(env, "Failed to allocate packet data")
            .ThrowAsJavaScriptException();
        return env.Undefined();
      }
      memcpy(packet->data, data, size);
    } else {
      Napi::Error::New(env, "Chunk must have data buffer or copyTo method")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  } else {
    int ret = av_new_packet(packet.get(), static_cast<int>(size));
    if (ret < 0) {
      Napi::Error::New(env, "Failed to allocate packet data")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    memcpy(packet->data, data, size);
  }

  int64_t timestamp = webcodecs::AttrAsInt64(chunk, "timestamp");
  int64_t duration = webcodecs::AttrAsInt64(chunk, "duration", 0);
  std::string type = webcodecs::AttrAsStr(chunk, "type", "delta");

  packet->stream_index = audio_stream_index_;
  packet->pts = timestamp;
  packet->dts = timestamp;
  packet->duration = duration;

  if (type == "key") {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  AVStream* stream = format_context_->streams[audio_stream_index_];
  av_packet_rescale_ts(packet.get(), {1, 1000000}, stream->time_base);

  int ret = av_interleaved_write_frame(format_context_.get(), packet.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write packet: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

Napi::Value Muxer::Finalize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (finalized_) {
    return env.Undefined();
  }

  if (!header_written_) {
    // Write header if no chunks were written.
    int ret = avformat_write_header(format_context_.get(), nullptr);
    if (ret < 0) {
      char err[AV_ERROR_MAX_STRING_SIZE];
      av_strerror(ret, err, sizeof(err));
      Napi::Error::New(env, std::string("Failed to write header: ") + err)
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
    header_written_ = true;
  }

  int ret = av_write_trailer(format_context_.get());
  if (ret < 0) {
    char err[AV_ERROR_MAX_STRING_SIZE];
    av_strerror(ret, err, sizeof(err));
    Napi::Error::New(env, std::string("Failed to write trailer: ") + err)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  finalized_ = true;
  return env.Undefined();
}

Napi::Value Muxer::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  return info.Env().Undefined();
}
```

**Step 4: Update addon.cc** (2 min)

Add forward declaration after line 21:
```cpp
Napi::Object InitMuxer(Napi::Env env, Napi::Object exports);
```

Add initialization call after InitDemuxer (around line 67):
```cpp
InitMuxer(env, exports);
```

**Step 5: Update binding.gyp** (1 min)

Add `"src/muxer.cc"` to the sources array after `"src/demuxer.cc"`.

**Step 6: Build and run test** (30 sec)

```bash
npm run build && npx vitest run test/golden/muxer.test.ts
```

Expected: Still FAIL - TypeScript wrapper not yet created.

**Step 7: Commit native implementation** (30 sec)

```bash
git add src/muxer.cc src/addon.cc binding.gyp
git commit -m "feat(muxer): implement native Muxer C++ class for MP4 output"
```

---

### Task 3: Create TypeScript Wrapper and Types

**Files:**
- Modify: `lib/native-types.ts` (add NativeMuxer interfaces)
- Modify: `lib/types.ts` (add MuxerInit, MuxerVideoTrackConfig types)
- Modify: `lib/index.ts` (add Muxer class export)

**Step 1: Write the failing test** (2-5 min)

The test from Task 2 should now pass once we add the TypeScript wrapper:

```typescript
// test/golden/muxer.test.ts (extended)
describe('Muxer', () => {
  // ... previous tests ...

  describe('addVideoTrack', () => {
    let tempDir: string;
    let outputPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-test-'));
      outputPath = path.join(tempDir, 'test.mp4');
    });

    afterEach(() => {
      fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('should add a video track and return track index', async () => {
      const {Muxer} = await import('../../dist/index.js');
      const muxer = new Muxer({filename: outputPath});

      const trackIndex = muxer.addVideoTrack({
        codec: 'avc1.42001e',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });

      expect(trackIndex).toBe(0);
      muxer.close();
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/muxer.test.ts
```

Expected: FAIL - Muxer not exported from dist/index.js.

**Step 3: Add native types** (3 min)

Add to `lib/native-types.ts` before the `NativeModule` interface:

```typescript
/**
 * Native Muxer object from C++ addon
 */
export interface NativeMuxer {
  addVideoTrack(config: {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    description?: ArrayBuffer | Uint8Array;
  }): number;

  addAudioTrack(config: {
    codec: string;
    sampleRate?: number;
    numberOfChannels?: number;
    bitrate?: number;
    description?: ArrayBuffer | Uint8Array;
  }): number;

  writeVideoChunk(chunk: {
    type: string;
    timestamp: number;
    duration?: number;
    data?: ArrayBuffer | Uint8Array | Buffer;
    byteLength?: number;
    copyTo?: (dest: Uint8Array | ArrayBuffer) => void;
  }): void;

  writeAudioChunk(chunk: {
    type: string;
    timestamp: number;
    duration?: number;
    data?: ArrayBuffer | Uint8Array | Buffer;
    byteLength?: number;
    copyTo?: (dest: Uint8Array | ArrayBuffer) => void;
  }): void;

  finalize(): void;
  close(): void;
}

export interface NativeMuxerConstructor {
  new (options: {filename: string}): NativeMuxer;
}
```

Add `Muxer: NativeMuxerConstructor;` to the `NativeModule` interface.

**Step 4: Add public types** (3 min)

Add to `lib/types.ts` in the appropriate section:

```typescript
// =============================================================================
// MUXER TYPES
// =============================================================================

/**
 * Configuration for Muxer initialization
 */
export interface MuxerInit {
  filename: string;
  format?: 'mp4';  // Currently only MP4 supported
}

/**
 * Configuration for adding a video track to the Muxer
 */
export interface MuxerVideoTrackConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  description?: ArrayBuffer | Uint8Array;
}

/**
 * Configuration for adding an audio track to the Muxer
 */
export interface MuxerAudioTrackConfig {
  codec: string;
  sampleRate?: number;
  numberOfChannels?: number;
  bitrate?: number;
  description?: ArrayBuffer | Uint8Array;
}
```

**Step 5: Add Muxer class to index.ts** (5 min)

Add to `lib/index.ts` after the Demuxer class:

```typescript
import type {
  NativeDemuxer,
  NativeMuxer,
  NativeModule,
  NativeVideoFilter,
  NativeVideoFrame,
} from './native-types';
import type {
  BlurRegion,
  CodecState,
  DemuxerInit,
  MuxerInit,
  MuxerVideoTrackConfig,
  MuxerAudioTrackConfig,
  TrackInfo,
  VideoFilterConfig,
} from './types';

// ... existing code ...

export class Muxer {
  private _native: NativeMuxer;

  constructor(init: MuxerInit) {
    this._native = new native.Muxer({filename: init.filename});
  }

  addVideoTrack(config: MuxerVideoTrackConfig): number {
    return this._native.addVideoTrack(config);
  }

  addAudioTrack(config: MuxerAudioTrackConfig): number {
    return this._native.addAudioTrack(config);
  }

  writeVideoChunk(chunk: EncodedVideoChunk): void {
    this._native.writeVideoChunk(chunk);
  }

  writeAudioChunk(chunk: EncodedAudioChunk): void {
    this._native.writeAudioChunk(chunk);
  }

  finalize(): void {
    this._native.finalize();
  }

  close(): void {
    this._native.close();
  }
}
```

Also add to the type exports:
```typescript
export type {
  // ... existing exports ...
  MuxerInit,
  MuxerVideoTrackConfig,
  MuxerAudioTrackConfig,
} from './types';
```

**Step 6: Build and run test** (30 sec)

```bash
npm run build && npx vitest run test/golden/muxer.test.ts
```

Expected: PASS (all tests should pass now).

**Step 7: Commit TypeScript wrapper** (30 sec)

```bash
git add lib/native-types.ts lib/types.ts lib/index.ts
git commit -m "feat(muxer): add TypeScript Muxer wrapper and type definitions"
```

---

### Task 4: Integration Test - Full Encode to MP4

**Files:**
- Create: `test/golden/muxer-integration.test.ts`

**Step 1: Write the failing test** (5 min)

```typescript
// test/golden/muxer-integration.test.ts
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Muxer Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  it('should encode frames and mux to MP4', async () => {
    const {VideoEncoder, VideoFrame, Muxer} = await import('../../dist/index.js');

    const outputPath = path.join(tempDir, 'output.mp4');
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 10;

    const chunks: Array<{type: string; timestamp: number; duration: number; data: Uint8Array}> = [];
    let codecDescription: ArrayBuffer | undefined;

    // Create encoder
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration || 33333,
          data,
        });
        if (metadata?.decoderConfig?.description) {
          codecDescription = metadata.decoderConfig.description;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
    });

    // Encode frames
    for (let i = 0; i < FRAME_COUNT; i++) {
      const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
      // Simple gradient
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const idx = (y * WIDTH + x) * 4;
          buffer[idx] = (x + i * 10) % 256;
          buffer[idx + 1] = (y + i * 5) % 256;
          buffer[idx + 2] = 128;
          buffer[idx + 3] = 255;
        }
      }

      const frame = new VideoFrame(buffer, {
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: i * 33333,
      });

      encoder.encode(frame, {keyFrame: i === 0});
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);

    // Mux to MP4
    const muxer = new Muxer({filename: outputPath});

    muxer.addVideoTrack({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
      description: codecDescription,
    });

    for (const chunk of chunks) {
      muxer.writeVideoChunk(chunk as any);
    }

    muxer.finalize();
    muxer.close();

    // Verify output file exists and has content
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify it's a valid MP4 by checking for ftyp box
    const header = fs.readFileSync(outputPath).slice(0, 12);
    const ftypOffset = header.indexOf('ftyp');
    expect(ftypOffset).toBeGreaterThanOrEqual(4);  // ftyp should be in first 12 bytes
  });

  it('should be readable by Demuxer', async () => {
    const {VideoEncoder, VideoFrame, Muxer, Demuxer} = await import('../../dist/index.js');

    const outputPath = path.join(tempDir, 'roundtrip.mp4');
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 5;

    const chunks: Array<{type: string; timestamp: number; duration: number; data: Uint8Array}> = [];
    let codecDescription: ArrayBuffer | undefined;

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration || 33333,
          data,
        });
        if (metadata?.decoderConfig?.description) {
          codecDescription = metadata.decoderConfig.description;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
    });

    for (let i = 0; i < FRAME_COUNT; i++) {
      const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const idx = (y * WIDTH + x) * 4;
          buffer[idx] = x % 256;
          buffer[idx + 1] = y % 256;
          buffer[idx + 2] = i * 50;
          buffer[idx + 3] = 255;
        }
      }

      const frame = new VideoFrame(buffer, {
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: i * 33333,
      });

      encoder.encode(frame, {keyFrame: i === 0});
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // Mux
    const muxer = new Muxer({filename: outputPath});
    muxer.addVideoTrack({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      description: codecDescription,
    });

    for (const chunk of chunks) {
      muxer.writeVideoChunk(chunk as any);
    }

    muxer.finalize();
    muxer.close();

    // Demux and verify
    let videoTrack: any = null;
    let demuxedChunks = 0;

    const demuxer = new Demuxer({
      onTrack: (track) => {
        if (track.type === 'video') {
          videoTrack = track;
        }
      },
      onChunk: () => {
        demuxedChunks++;
      },
      onError: (e) => { throw e; },
    });

    await demuxer.open(outputPath);
    await demuxer.demux();
    demuxer.close();

    expect(videoTrack).not.toBeNull();
    expect(videoTrack.width).toBe(WIDTH);
    expect(videoTrack.height).toBe(HEIGHT);
    expect(demuxedChunks).toBe(chunks.length);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run build && npx vitest run test/golden/muxer-integration.test.ts
```

Expected: Initially may fail if Muxer not fully working.

**Step 3: Fix any issues found** (varies)

Debug and fix any issues discovered by the integration test.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/muxer-integration.test.ts
```

Expected: PASS (both tests should pass).

**Step 5: Commit integration tests** (30 sec)

```bash
git add test/golden/muxer-integration.test.ts
git commit -m "test(muxer): add integration tests for encode-to-MP4 pipeline"
```

---

### Task 5: Update Examples to Use Muxer (Remove FFmpeg CLI)

**Files:**
- Modify: `examples/run-demo.js`
- Modify: `examples/02-video-pipeline/index.js`

**Step 1: Update run-demo.js** (10 min)

Changes needed:
1. Remove FFmpeg dependency check for muxing (keep for test video generation OR generate programmatically)
2. Replace `ffmpeg -y -i OUTPUT_H264 -c copy OUTPUT_MP4` with Muxer usage
3. Generate test video programmatically instead of using FFmpeg

Key changes to `examples/run-demo.js`:

```javascript
// At the top, add Muxer import:
const {Demuxer, VideoDecoder, VideoEncoder, VideoFrame, Muxer} = require('../dist/index.js');

// Remove FFmpeg dependency check for muxing (line ~254-262)
// Keep only FFplay check for playback

// Replace test video generation with programmatic approach (Step 2, ~line 285-314):
// Instead of calling ffmpeg, generate frames directly and encode them

async function generateTestVideo(outputPath) {
  console.log('Generating test video programmatically...');

  const WIDTH = 640;
  const HEIGHT = 480;
  const DURATION_SECONDS = 5;
  const FPS = 30;
  const TOTAL_FRAMES = DURATION_SECONDS * FPS;

  const chunks = [];
  let codecDescription;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration || Math.floor(1_000_000 / FPS),
        data,
      });
      if (metadata?.decoderConfig?.description) {
        codecDescription = metadata.decoderConfig.description;
      }
    },
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001e',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 2_000_000,
    framerate: FPS,
  });

  // Generate color bars test pattern
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
    const timeProgress = i / TOTAL_FRAMES;

    // Color bars pattern
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const idx = (y * WIDTH + x) * 4;
        const barIndex = Math.floor(x / (WIDTH / 8));

        // Classic color bars: white, yellow, cyan, green, magenta, red, blue, black
        const bars = [
          [255, 255, 255], [255, 255, 0], [0, 255, 255], [0, 255, 0],
          [255, 0, 255], [255, 0, 0], [0, 0, 255], [0, 0, 0]
        ];
        const color = bars[barIndex] || [0, 0, 0];

        buffer[idx] = color[0];
        buffer[idx + 1] = color[1];
        buffer[idx + 2] = color[2];
        buffer[idx + 3] = 255;
      }
    }

    const frame = new VideoFrame(buffer, {
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: Math.floor(i * (1_000_000 / FPS)),
    });

    encoder.encode(frame, {keyFrame: i % 30 === 0});
    frame.close();

    if (i % 30 === 0) {
      process.stdout.write(`\rGenerating frame ${i}/${TOTAL_FRAMES}...`);
    }
  }

  await encoder.flush();
  encoder.close();

  console.log('\nMuxing to MP4...');

  const muxer = new Muxer({filename: outputPath});
  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 2_000_000,
    framerate: FPS,
    description: codecDescription,
  });

  for (const chunk of chunks) {
    muxer.writeVideoChunk(chunk);
  }

  muxer.finalize();
  muxer.close();

  console.log(`Created: ${outputPath}`);
}

// Replace the ffmpegCmd section (~line 294-314) with:
await generateTestVideo(TEST_VIDEO);

// Replace the MP4 wrapping section (~line 341-353) with Muxer usage:
// Instead of: run(`ffmpeg -y -i "${OUTPUT_H264}" -c copy "${OUTPUT_MP4}"`);
// The processVideo function should now output directly to MP4 using Muxer
```

**Step 2: Update processVideo function** (10 min)

Modify `processVideo` in `run-demo.js` to use Muxer instead of writing raw H.264:

```javascript
async function processVideo(inputPath, outputPath) {
  console.log(`Processing: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  let videoTrack = null;
  let framesProcessed = 0;
  let encoder = null;
  let muxer = null;
  let codecDescription = null;

  const decoder = new VideoDecoder({
    output: frame => {
      // ... existing watermark code ...

      encoder.encode(modifiedFrame, {keyFrame: framesProcessed % 30 === 0});
      modifiedFrame.close();
      frame.close();

      framesProcessed++;
      if (framesProcessed % 10 === 0) {
        process.stdout.write(`\rProcessed ${framesProcessed} frames...`);
      }
    },
    error: e => console.error('Decoder error:', e),
  });

  const demuxer = new Demuxer({
    onTrack: track => {
      console.log(`Found track: ${track.type} (${track.codec})`);
      if (track.type === 'video') {
        videoTrack = track;
        console.log(`  Resolution: ${track.width}x${track.height}`);

        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: track.width,
          codedHeight: track.height,
          description: track.extradata,
        });

        // Create muxer for output
        muxer = new Muxer({filename: outputPath});

        encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            if (metadata?.decoderConfig?.description && !codecDescription) {
              codecDescription = metadata.decoderConfig.description;
              // Add video track with codec description
              muxer.addVideoTrack({
                codec: 'avc1.42001e',
                width: track.width,
                height: track.height,
                bitrate: 2_000_000,
                framerate: 30,
                description: codecDescription,
              });
            }
            // Write chunk to muxer
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            muxer.writeVideoChunk({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration || 33333,
              data,
            });
          },
          error: e => console.error('Encoder error:', e),
        });

        encoder.configure({
          codec: 'avc1.42001e',
          width: track.width,
          height: track.height,
          bitrate: 2_000_000,
          framerate: 30,
        });
      }
    },
    onChunk: (chunk, trackIndex) => {
      if (videoTrack && trackIndex === videoTrack.index) {
        decoder.decode(chunk);
      }
    },
    onError: e => console.error('Demuxer error:', e),
  });

  console.log('Opening file...');
  await demuxer.open(inputPath);

  if (!videoTrack) {
    throw new Error('No video track found in file');
  }

  console.log('Demuxing and processing frames...');
  await demuxer.demux();

  console.log('\nFlushing decoder...');
  await decoder.flush();

  console.log('Flushing encoder...');
  await encoder.flush();

  console.log('Finalizing MP4...');
  muxer.finalize();
  muxer.close();

  demuxer.close();
  decoder.close();
  encoder.close();

  console.log(`\nProcessed ${framesProcessed} frames`);
  const stats = fs.statSync(outputPath);
  console.log(`Written: ${outputPath} (${(stats.size / 1024).toFixed(2)} KB)`);
}
```

**Step 3: Update examples/02-video-pipeline/index.js similarly** (10 min)

Apply same pattern:
1. Replace FFmpeg test video generation with programmatic generation
2. Replace FFmpeg MP4 wrapping with Muxer

**Step 4: Run examples to verify** (2 min)

```bash
npm run build && node examples/run-demo.js
```

Expected: Demo runs without calling FFmpeg for encoding/muxing.

**Step 5: Commit example updates** (30 sec)

```bash
git add examples/run-demo.js examples/02-video-pipeline/index.js
git commit -m "refactor(examples): replace FFmpeg CLI with native Muxer"
```

---

### Task 6: Code Review

**Files:** All files from Tasks 1-5

**Step 1: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass.

**Step 2: Run linter** (1 min)

```bash
npm run lint
```

Expected: No lint errors.

**Step 3: Run examples end-to-end** (2 min)

```bash
node examples/run-demo.js
# Verify MP4 output is created without FFmpeg
```

**Step 4: Review for edge cases** (5 min)

- Empty track handling
- Missing codec description
- Multiple tracks
- Error propagation

**Step 5: Commit any fixes** (30 sec)

```bash
git add -A && git commit -m "fix(muxer): address code review feedback"
```

---

## Summary

This plan implements a complete native Muxer class that:
1. Uses FFmpeg's libavformat for MP4 container writing
2. Supports H.264, H.265, VP9, AV1 video codecs
3. Supports AAC, Opus audio codecs
4. Integrates seamlessly with existing VideoEncoder/AudioEncoder output
5. Eliminates FFmpeg CLI dependency from examples

The examples will generate test videos programmatically and output directly to MP4 using the library's native capabilities.
