# ImageDecoder W3C WebCodecs Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-image-decoder-w3c-compliance.md` to implement task-by-task.

**Goal:** Implement full W3C WebCodecs ImageDecoder specification compliance including animated GIF/WebP support, ReadableStream input, proper ImageTrackList/ImageTrack classes, and all configuration options.

**Architecture:** Extend existing C++ native layer (`src/image_decoder.cc`) to support multi-frame animated images using FFmpeg's libavformat for container parsing. TypeScript layer handles W3C spec compliance, state management, and proper class implementations for ImageTrackList/ImageTrack. ReadableStream support implemented in TypeScript by buffering chunks before passing to native layer.

**Tech Stack:** C++17 with node-addon-api (NAPI), FFmpeg (libavcodec, libavformat, libswscale), TypeScript, Vitest for testing

---

## Task Groups for Parallel Execution

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Foundation: Types and test infrastructure (no file overlap) |
| Group 2 | 3 | Native layer animated image support (C++ changes) |
| Group 3 | 4, 5 | TypeScript ImageTrack/ImageTrackList classes (independent) |
| Group 4 | 6 | ImageDecoder TypeScript refactor (depends on 4, 5) |
| Group 5 | 7 | ReadableStream support (depends on 6) |
| Group 6 | 8 | Configuration options (depends on 6) |
| Group 7 | 9 | Integration tests and edge cases |
| Group 8 | 10 | Code Review |

---

### Task 1: Update Type Definitions for Full W3C Compliance

**Files:**
- Modify: `lib/types.ts:779-840` (ImageDecoder types section)

**Step 1: Write the failing test** (2-5 min)

Create test file to verify type definitions match W3C spec:

```typescript
// test/golden/image-decoder-types.test.ts
import {describe, it, expect} from 'vitest';
import type {
  ImageDecoderInit,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageTrack,
  ImageTrackList,
  ImageBufferSource,
  ColorSpaceConversion,
} from '../lib/types';

describe('ImageDecoder Type Definitions', () => {
  it('ImageDecoderInit has all W3C required fields', () => {
    const init: ImageDecoderInit = {
      type: 'image/png',
      data: new Uint8Array([]),
      colorSpaceConversion: 'default',
      desiredWidth: 100,
      desiredHeight: 100,
      preferAnimation: true,
      transfer: [],
    };
    expect(init.type).toBe('image/png');
    expect(init.colorSpaceConversion).toBe('default');
    expect(init.desiredWidth).toBe(100);
    expect(init.desiredHeight).toBe(100);
    expect(init.preferAnimation).toBe(true);
  });

  it('ImageDecodeOptions has frameIndex and completeFramesOnly', () => {
    const options: ImageDecodeOptions = {
      frameIndex: 5,
      completeFramesOnly: false,
    };
    expect(options.frameIndex).toBe(5);
    expect(options.completeFramesOnly).toBe(false);
  });

  it('ImageTrack has all W3C required fields', () => {
    // Type checking - if this compiles, types are correct
    const track: ImageTrack = {
      animated: true,
      frameCount: 10,
      repetitionCount: Infinity,
      selected: true,
    };
    expect(track.animated).toBe(true);
    expect(track.frameCount).toBe(10);
    expect(track.repetitionCount).toBe(Infinity);
  });

  it('ImageTrackList has ready promise and index accessor', () => {
    // Verify ImageTrackList has the required shape
    const mockTrackList = {
      ready: Promise.resolve(),
      length: 1,
      selectedIndex: 0,
      selectedTrack: null,
      0: { animated: false, frameCount: 1, repetitionCount: 0, selected: true },
    } as ImageTrackList;

    expect(mockTrackList.length).toBe(1);
    expect(mockTrackList.selectedIndex).toBe(0);
    expect(mockTrackList[0]).toBeDefined();
  });

  it('ImageBufferSource accepts ReadableStream', () => {
    // ReadableStream should be valid ImageBufferSource
    const stream = new ReadableStream<Uint8Array>();
    const bufferSource: ImageBufferSource = stream;
    expect(bufferSource).toBeInstanceOf(ReadableStream);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/image-decoder-types.test.ts
```

Expected: FAIL (types may not fully match W3C spec)

**Step 3: Update type definitions in lib/types.ts** (2-5 min)

Verify and update the ImageDecoder types section (lines 779-840) to ensure:

```typescript
// lib/types.ts - Verify these types match W3C spec exactly

/**
 * WebIDL:
 * typedef (AllowSharedBufferSource or ReadableStream) ImageBufferSource;
 */
export type ImageBufferSource = AllowSharedBufferSource | ReadableStream<Uint8Array>;

/**
 * WebIDL:
 * dictionary ImageDecoderInit {
 *   required DOMString type;
 *   required ImageBufferSource data;
 *   ColorSpaceConversion colorSpaceConversion = "default";
 *   [EnforceRange] unsigned long desiredWidth;
 *   [EnforceRange] unsigned long desiredHeight;
 *   boolean preferAnimation;
 *   sequence<ArrayBuffer> transfer = [];
 * };
 */
export interface ImageDecoderInit {
  type: string;
  data: ImageBufferSource;
  colorSpaceConversion?: ColorSpaceConversion;
  desiredWidth?: number;
  desiredHeight?: number;
  preferAnimation?: boolean;
  transfer?: ArrayBuffer[];
}

/**
 * WebIDL:
 * dictionary ImageDecodeOptions {
 *   [EnforceRange] unsigned long frameIndex = 0;
 *   boolean completeFramesOnly = true;
 * };
 */
export interface ImageDecodeOptions {
  frameIndex?: number;
  completeFramesOnly?: boolean;
}

/**
 * WebIDL:
 * dictionary ImageDecodeResult {
 *   required VideoFrame image;
 *   required boolean complete;
 * };
 */
export interface ImageDecodeResult {
  image: VideoFrame;
  complete: boolean;
}

/**
 * WebIDL: ImageTrack interface
 */
export interface ImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number; // unrestricted float, Infinity for infinite loop
  selected: boolean;
}

/**
 * WebIDL: ImageTrackList interface
 */
export interface ImageTrackList {
  readonly ready: Promise<void>;
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack: ImageTrack | null;
  [index: number]: ImageTrack;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/image-decoder-types.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/image-decoder-types.test.ts
git commit -m "feat(types): add complete W3C ImageDecoder type definitions"
```

---

### Task 2: Create Test Infrastructure with Sample Animated Images

**Files:**
- Create: `test/fixtures/animated.gif` (binary test file)
- Create: `test/fixtures/animated.webp` (binary test file)
- Create: `test/fixtures/static.png` (binary test file)
- Create: `test/golden/image-decoder.test.ts`

**Step 1: Create test fixtures directory and download sample images** (2-5 min)

```bash
mkdir -p test/fixtures

# Create a minimal 2-frame animated GIF (2x2 pixels, 2 frames)
# This is a valid GIF89a with 2 frames
echo -n 'R0lGODlhAgACAIAAAAAAAP///yH5BAEAAAEALAAAAAACAAIAAAIDjI8FADs=' | base64 -d > test/fixtures/static.gif

# For animated GIF, we'll need to create one programmatically in the test
# Or use a small sample file
```

**Step 2: Write test file with basic structure** (2-5 min)

```typescript
// test/golden/image-decoder.test.ts
import {describe, it, expect, beforeAll} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {ImageDecoder, VideoFrame} from '../../lib';

// Helper to create minimal test images
function createMinimalPNG(): Buffer {
  // 1x1 red pixel PNG
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // compressed data
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd,
    0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

function createMinimalGIF(): Buffer {
  // Minimal 1x1 GIF89a
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00, 0x01, 0x00, // 1x1 dimensions
    0x00, 0x00, 0x00,       // no global color table
    0x2c, 0x00, 0x00, 0x00, 0x00, // image descriptor
    0x01, 0x00, 0x01, 0x00, 0x00, // 1x1, no local color table
    0x02, 0x01, 0x01, 0x00, 0x3b  // minimal LZW data + trailer
  ]);
}

describe('ImageDecoder', () => {
  describe('constructor', () => {
    it('creates decoder with valid PNG data', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(decoder.type).toBe('image/png');
      expect(decoder.complete).toBe(true);
      decoder.close();
    });

    it('throws TypeError for missing type', () => {
      expect(() => {
        new ImageDecoder({
          data: new Uint8Array([]),
        } as any);
      }).toThrow(TypeError);
    });

    it('throws TypeError for missing data', () => {
      expect(() => {
        new ImageDecoder({
          type: 'image/png',
        } as any);
      }).toThrow(TypeError);
    });
  });

  describe('static isTypeSupported', () => {
    it('returns true for supported types', async () => {
      expect(await ImageDecoder.isTypeSupported('image/png')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/jpeg')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/gif')).toBe(true);
      expect(await ImageDecoder.isTypeSupported('image/webp')).toBe(true);
    });

    it('returns false for unsupported types', async () => {
      expect(await ImageDecoder.isTypeSupported('image/unknown')).toBe(false);
      expect(await ImageDecoder.isTypeSupported('video/mp4')).toBe(false);
    });
  });

  describe('tracks property', () => {
    it('returns ImageTrackList with correct structure', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const tracks = decoder.tracks;
      expect(tracks.length).toBe(1);
      expect(tracks.selectedIndex).toBe(0);
      expect(tracks.selectedTrack).not.toBeNull();
      expect(tracks[0]).toBeDefined();

      // Verify ImageTrack properties
      const track = tracks[0];
      expect(track.animated).toBe(false);
      expect(track.frameCount).toBe(1);
      expect(typeof track.repetitionCount).toBe('number');
      expect(track.selected).toBe(true);

      decoder.close();
    });

    it('tracks.ready resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      await expect(decoder.tracks.ready).resolves.toBeUndefined();
      decoder.close();
    });
  });

  describe('decode method', () => {
    it('decodes static image and returns VideoFrame', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      const result = await decoder.decode();
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.complete).toBe(true);
      expect(result.image.codedWidth).toBeGreaterThan(0);
      expect(result.image.codedHeight).toBeGreaterThan(0);

      result.image.close();
      decoder.close();
    });

    it('respects frameIndex option', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      // For static image, frameIndex 0 should work
      const result = await decoder.decode({ frameIndex: 0 });
      expect(result.complete).toBe(true);

      result.image.close();
      decoder.close();
    });

    it('throws for invalid frameIndex', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      // frameIndex 1 should fail for single-frame image
      await expect(decoder.decode({ frameIndex: 1 }))
        .rejects.toThrow();

      decoder.close();
    });

    it('throws InvalidStateError when closed', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      decoder.close();

      await expect(decoder.decode())
        .rejects.toThrow(/closed|InvalidStateError/);
    });
  });

  describe('completed property', () => {
    it('resolves for static images', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      await expect(decoder.completed).resolves.toBeUndefined();
      decoder.close();
    });
  });

  describe('close method', () => {
    it('can be called multiple times without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(() => {
        decoder.close();
        decoder.close();
        decoder.close();
      }).not.toThrow();
    });
  });

  describe('reset method', () => {
    it('can be called without error', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: data,
      });

      expect(() => decoder.reset()).not.toThrow();
      decoder.close();
    });
  });
});
```

**Step 3: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/image-decoder.test.ts
```

Expected: Some tests may pass with existing implementation, others will fail

**Step 4: Commit test infrastructure** (30 sec)

```bash
git add test/golden/image-decoder.test.ts
git commit -m "test(image-decoder): add comprehensive test suite for W3C compliance"
```

---

### Task 3: Native Layer - Animated Image Support with FFmpeg

**Files:**
- Modify: `src/image_decoder.h`
- Modify: `src/image_decoder.cc`

**Step 1: Write native layer test for animated images** (2-5 min)

Add to `test/golden/image-decoder.test.ts`:

```typescript
describe('Animated Images', () => {
  // Create minimal animated GIF with 2 frames
  function createAnimatedGIF(): Buffer {
    // GIF89a with 2 frames (4x4 pixels each)
    // Frame 1: red, Frame 2: blue
    return Buffer.from([
      // Header
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x04, 0x00, 0x04, 0x00, // 4x4 canvas
      0xf0, 0x00, 0x00,       // global color table flag, 2 colors
      // Global Color Table (2 colors)
      0xff, 0x00, 0x00, // red
      0x00, 0x00, 0xff, // blue
      // Netscape extension for looping
      0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43,
      0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01,
      0x00, 0x00, 0x00,
      // Frame 1 - Graphic Control Extension
      0x21, 0xf9, 0x04, 0x04, 0x0a, 0x00, 0x00, 0x00,
      // Frame 1 - Image Descriptor
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00,
      // Frame 1 - Image Data (all red)
      0x02, 0x05, 0x84, 0x1c, 0xa9, 0x71, 0x00, 0x00,
      // Frame 2 - Graphic Control Extension
      0x21, 0xf9, 0x04, 0x04, 0x0a, 0x00, 0x01, 0x00,
      // Frame 2 - Image Descriptor
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00,
      // Frame 2 - Image Data (all blue)
      0x02, 0x05, 0x84, 0x3c, 0xa9, 0x71, 0x00, 0x00,
      // Trailer
      0x3b
    ]);
  }

  it('detects animated GIF with multiple frames', async () => {
    const data = createAnimatedGIF();
    const decoder = new ImageDecoder({
      type: 'image/gif',
      data: data,
    });

    const tracks = decoder.tracks;
    await tracks.ready;

    const track = tracks[0];
    expect(track.animated).toBe(true);
    expect(track.frameCount).toBeGreaterThan(1);

    decoder.close();
  });

  it('decodes specific frame by index', async () => {
    const data = createAnimatedGIF();
    const decoder = new ImageDecoder({
      type: 'image/gif',
      data: data,
    });

    await decoder.tracks.ready;
    const frameCount = decoder.tracks[0].frameCount;

    // Decode each frame
    for (let i = 0; i < frameCount; i++) {
      const result = await decoder.decode({ frameIndex: i });
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.complete).toBe(true);
      result.image.close();
    }

    decoder.close();
  });

  it('reports repetitionCount for animated images', async () => {
    const data = createAnimatedGIF();
    const decoder = new ImageDecoder({
      type: 'image/gif',
      data: data,
    });

    await decoder.tracks.ready;
    const track = decoder.tracks[0];

    // GIF with NETSCAPE extension should have repetitionCount
    expect(typeof track.repetitionCount).toBe('number');

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/image-decoder.test.ts -t "Animated Images"
```

Expected: FAIL (current native layer doesn't support multi-frame)

**Step 3: Update image_decoder.h** (2-5 min)

```cpp
// src/image_decoder.h - Add multi-frame support

#ifndef SRC_IMAGE_DECODER_H_
#define SRC_IMAGE_DECODER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <memory>
#include <string>
#include <vector>

// Struct to hold decoded frame data
struct DecodedFrame {
  std::vector<uint8_t> data;
  int width;
  int height;
  int64_t timestamp;  // microseconds
  int64_t duration;   // microseconds
};

class ImageDecoder : public Napi::ObjectWrap<ImageDecoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Value IsTypeSupported(const Napi::CallbackInfo& info);
  explicit ImageDecoder(const Napi::CallbackInfo& info);
  ~ImageDecoder();

  ImageDecoder(const ImageDecoder&) = delete;
  ImageDecoder& operator=(const ImageDecoder&) = delete;

 private:
  // WebCodecs API methods
  Napi::Value Decode(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  void Reset(const Napi::CallbackInfo& info);
  Napi::Value GetType(const Napi::CallbackInfo& info);
  Napi::Value GetComplete(const Napi::CallbackInfo& info);
  Napi::Value GetCompleted(const Napi::CallbackInfo& info);
  Napi::Value GetTracks(const Napi::CallbackInfo& info);

  // Internal helpers
  void Cleanup();
  bool ParseImageMetadata();
  bool DecodeFrame(int frame_index);
  bool ConvertFrameToRGBA(AVFrame* frame, DecodedFrame& output);
  static AVCodecID MimeTypeToCodecId(const std::string& mime_type);
  static bool IsAnimatedFormat(const std::string& mime_type);

  // Image data
  std::vector<uint8_t> data_;
  std::string type_;

  // FFmpeg state for multi-frame support
  AVFormatContext* format_context_;
  AVCodecContext* codec_context_;
  const AVCodec* codec_;
  int video_stream_index_;
  SwsContext* sws_context_;

  // Frame cache for random access
  std::vector<DecodedFrame> decoded_frames_;

  // Track metadata
  bool animated_;
  int frame_count_;
  double repetition_count_;  // Infinity for infinite loop
  int decoded_width_;
  int decoded_height_;

  // State
  bool complete_;
  bool closed_;
  bool metadata_parsed_;

  // Promise for completed property
  Napi::Promise::Deferred* completed_deferred_;
};

#endif  // SRC_IMAGE_DECODER_H_
```

**Step 4: Update image_decoder.cc with multi-frame support** (5-10 min)

This is a larger change. Key modifications:

```cpp
// src/image_decoder.cc - Key changes for animated image support

// In constructor, use AVFormatContext for multi-frame parsing
ImageDecoder::ImageDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ImageDecoder>(info),
      format_context_(nullptr),
      codec_context_(nullptr),
      codec_(nullptr),
      video_stream_index_(-1),
      sws_context_(nullptr),
      animated_(false),
      frame_count_(1),
      repetition_count_(0),
      decoded_width_(0),
      decoded_height_(0),
      complete_(false),
      closed_(false),
      metadata_parsed_(false),
      completed_deferred_(nullptr) {
  // ... existing validation code ...

  // Parse image to get metadata (frame count, animation info)
  if (ParseImageMetadata()) {
    complete_ = true;
  }
}

bool ImageDecoder::ParseImageMetadata() {
  // For animated formats (GIF, WebP), use AVFormatContext
  if (IsAnimatedFormat(type_)) {
    // Create custom AVIOContext for memory buffer
    // Use avformat_open_input with custom IO
    // Count frames and detect animation
    // ...
  } else {
    // Static image - use existing codec-only approach
    frame_count_ = 1;
    animated_ = false;
    repetition_count_ = 0;
  }
  return true;
}

bool ImageDecoder::DecodeFrame(int frame_index) {
  if (frame_index < 0 || frame_index >= frame_count_) {
    return false;
  }

  // Check cache first
  if (frame_index < decoded_frames_.size() &&
      !decoded_frames_[frame_index].data.empty()) {
    return true;
  }

  // Seek to frame and decode
  // For GIF/WebP: seek to specific frame using av_seek_frame
  // ...

  return true;
}

Napi::Value ImageDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "ImageDecoder is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse options
  int frame_index = 0;
  bool complete_frames_only = true;

  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object options = info[0].As<Napi::Object>();
    if (options.Has("frameIndex")) {
      frame_index = options.Get("frameIndex").As<Napi::Number>().Int32Value();
    }
    if (options.Has("completeFramesOnly")) {
      complete_frames_only = options.Get("completeFramesOnly").As<Napi::Boolean>().Value();
    }
  }

  // Validate frame index
  if (frame_index >= frame_count_) {
    Napi::RangeError::New(env, "frameIndex out of range")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Decode the frame
  if (!DecodeFrame(frame_index)) {
    Napi::Error::New(env, "Failed to decode frame")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create promise and return result
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

  // Create VideoFrame from decoded data
  const DecodedFrame& frame = decoded_frames_[frame_index];
  // ... create VideoFrame object ...

  return deferred.Promise();
}

Napi::Value ImageDecoder::GetTracks(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Create ImageTrack object
  Napi::Object track = Napi::Object::New(env);
  track.Set("animated", Napi::Boolean::New(env, animated_));
  track.Set("frameCount", Napi::Number::New(env, frame_count_));
  track.Set("repetitionCount",
    std::isinf(repetition_count_)
      ? env.Global().Get("Infinity").As<Napi::Number>()
      : Napi::Number::New(env, repetition_count_));
  track.Set("selected", Napi::Boolean::New(env, true));

  // Create ImageTrackList
  Napi::Object trackList = Napi::Object::New(env);
  trackList.Set("length", Napi::Number::New(env, 1));
  trackList.Set("selectedIndex", Napi::Number::New(env, 0));
  trackList.Set("selectedTrack", track);
  trackList.Set(static_cast<uint32_t>(0), track);

  // Create ready promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  if (metadata_parsed_) {
    deferred.Resolve(env.Undefined());
  }
  trackList.Set("ready", deferred.Promise());

  return trackList;
}

bool ImageDecoder::IsAnimatedFormat(const std::string& mime_type) {
  return mime_type == "image/gif" || mime_type == "image/webp";
}
```

**Step 5: Build and run tests** (30 sec)

```bash
npm run build:native && npx vitest run test/golden/image-decoder.test.ts -t "Animated Images"
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/image_decoder.h src/image_decoder.cc
git commit -m "feat(native): add animated GIF/WebP multi-frame support"
```

---

### Task 4: TypeScript ImageTrack Class

**Files:**
- Create: `lib/image-track.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/image-track.test.ts
import {describe, it, expect} from 'vitest';
import {ImageTrack} from '../../lib/image-track';

describe('ImageTrack class', () => {
  it('has readonly animated property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 10,
      repetitionCount: 5,
      selected: false,
    });

    expect(track.animated).toBe(true);
    // Should not be writable
    expect(() => {
      (track as any).animated = false;
    }).toThrow();
  });

  it('has readonly frameCount property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: true,
    });

    expect(track.frameCount).toBe(1);
  });

  it('has readonly repetitionCount property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 5,
      repetitionCount: Infinity,
      selected: true,
    });

    expect(track.repetitionCount).toBe(Infinity);
  });

  it('has writable selected property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: false,
    });

    expect(track.selected).toBe(false);
    track.selected = true;
    expect(track.selected).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/image-track.test.ts
```

Expected: FAIL (ImageTrack class doesn't exist)

**Step 3: Implement ImageTrack class** (2-5 min)

```typescript
// lib/image-track.ts

/**
 * ImageTrack represents a single track in an image.
 * Per W3C WebCodecs ImageTrack interface.
 */
export interface ImageTrackInit {
  animated: boolean;
  frameCount: number;
  repetitionCount: number;
  selected: boolean;
}

export class ImageTrack {
  private _animated: boolean;
  private _frameCount: number;
  private _repetitionCount: number;
  private _selected: boolean;

  constructor(init: ImageTrackInit) {
    this._animated = init.animated;
    this._frameCount = init.frameCount;
    this._repetitionCount = init.repetitionCount;
    this._selected = init.selected;

    // Make readonly properties non-writable
    Object.defineProperty(this, 'animated', {
      get: () => this._animated,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(this, 'frameCount', {
      get: () => this._frameCount,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(this, 'repetitionCount', {
      get: () => this._repetitionCount,
      enumerable: true,
      configurable: false,
    });
  }

  get animated(): boolean {
    return this._animated;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  get repetitionCount(): number {
    return this._repetitionCount;
  }

  get selected(): boolean {
    return this._selected;
  }

  set selected(value: boolean) {
    this._selected = value;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/image-track.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/image-track.ts test/golden/image-track.test.ts
git commit -m "feat(image-decoder): add ImageTrack class per W3C spec"
```

---

### Task 5: TypeScript ImageTrackList Class

**Files:**
- Create: `lib/image-track-list.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/image-track-list.test.ts
import {describe, it, expect} from 'vitest';
import {ImageTrackList} from '../../lib/image-track-list';
import {ImageTrack} from '../../lib/image-track';

describe('ImageTrackList class', () => {
  function createMockTrack(selected = true): ImageTrack {
    return new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected,
    });
  }

  it('has length property', () => {
    const track = createMockTrack();
    const list = new ImageTrackList([track]);

    expect(list.length).toBe(1);
  });

  it('has selectedIndex property', () => {
    const track1 = createMockTrack(false);
    const track2 = createMockTrack(true);
    const list = new ImageTrackList([track1, track2]);

    expect(list.selectedIndex).toBe(1);
  });

  it('has selectedTrack property', () => {
    const track = createMockTrack(true);
    const list = new ImageTrackList([track]);

    expect(list.selectedTrack).toBe(track);
  });

  it('returns null selectedTrack when none selected', () => {
    const track = createMockTrack(false);
    const list = new ImageTrackList([track]);

    expect(list.selectedTrack).toBeNull();
  });

  it('supports index accessor', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    expect(list[0]).toBe(track1);
    expect(list[1]).toBe(track2);
    expect(list[2]).toBeUndefined();
  });

  it('has ready promise that resolves', async () => {
    const track = createMockTrack();
    const list = new ImageTrackList([track]);

    await expect(list.ready).resolves.toBeUndefined();
  });

  it('is iterable', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    const tracks = [...list];
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toBe(track1);
    expect(tracks[1]).toBe(track2);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/image-track-list.test.ts
```

Expected: FAIL (ImageTrackList class doesn't exist)

**Step 3: Implement ImageTrackList class** (2-5 min)

```typescript
// lib/image-track-list.ts
import {ImageTrack} from './image-track';

/**
 * ImageTrackList represents a list of tracks in an image.
 * Per W3C WebCodecs ImageTrackList interface.
 */
export class ImageTrackList {
  private _tracks: ImageTrack[];
  private _ready: Promise<void>;
  private _readyResolve!: () => void;

  constructor(tracks: ImageTrack[], ready?: Promise<void>) {
    this._tracks = tracks;

    // Create ready promise if not provided
    if (ready) {
      this._ready = ready;
    } else {
      this._ready = new Promise(resolve => {
        this._readyResolve = resolve;
      });
      // Resolve immediately for synchronously available tracks
      this._readyResolve();
    }

    // Set up index accessors for array-like access
    for (let i = 0; i < tracks.length; i++) {
      Object.defineProperty(this, i, {
        get: () => this._tracks[i],
        enumerable: true,
        configurable: false,
      });
    }
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  get length(): number {
    return this._tracks.length;
  }

  get selectedIndex(): number {
    for (let i = 0; i < this._tracks.length; i++) {
      if (this._tracks[i].selected) {
        return i;
      }
    }
    return -1;
  }

  get selectedTrack(): ImageTrack | null {
    const index = this.selectedIndex;
    return index >= 0 ? this._tracks[index] : null;
  }

  // Support for index accessor type
  [index: number]: ImageTrack;

  // Make iterable
  *[Symbol.iterator](): Iterator<ImageTrack> {
    for (const track of this._tracks) {
      yield track;
    }
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/image-track-list.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/image-track-list.ts test/golden/image-track-list.test.ts
git commit -m "feat(image-decoder): add ImageTrackList class per W3C spec"
```

---

### Task 6: Refactor ImageDecoder TypeScript to Use New Classes

**Files:**
- Modify: `lib/index.ts` (ImageDecoder class section, lines 1224-1332)

**Step 1: Update imports and refactor ImageDecoder** (2-5 min)

Add imports and update the ImageDecoder class to use proper ImageTrack and ImageTrackList:

```typescript
// lib/index.ts - Add imports at top
import {ImageTrack} from './image-track';
import {ImageTrackList} from './image-track-list';

// Refactor ImageDecoder class
export class ImageDecoder {
  private _native: NativeImageDecoder;
  private _closed: boolean = false;
  private _tracks: ImageTrackList | null = null;
  private _completed: Promise<void>;
  private _completedResolve!: () => void;
  private _completedReject!: (error: Error) => void;

  constructor(init: ImageDecoderInit) {
    // Validate required fields per W3C spec
    if (!init.type) {
      throw new TypeError(
        "Failed to construct 'ImageDecoder': required member type is undefined."
      );
    }
    if (!init.data) {
      throw new TypeError(
        "Failed to construct 'ImageDecoder': required member data is undefined."
      );
    }

    // Check for ReadableStream - defer handling to Task 7
    if (init.data instanceof ReadableStream) {
      throw new TypeError(
        'ReadableStream data source not yet implemented'
      );
    }

    // Convert data to Buffer if needed
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(
        init.data.buffer,
        init.data.byteOffset,
        init.data.byteLength,
      );
    } else {
      throw new TypeError('data must be ArrayBuffer, ArrayBufferView, or ReadableStream');
    }

    // Create completed promise
    this._completed = new Promise((resolve, reject) => {
      this._completedResolve = resolve;
      this._completedReject = reject;
    });

    this._native = new native.ImageDecoder({
      type: init.type,
      data: dataBuffer,
      colorSpaceConversion: init.colorSpaceConversion,
      desiredWidth: init.desiredWidth,
      desiredHeight: init.desiredHeight,
      preferAnimation: init.preferAnimation,
    });

    // Resolve completed promise if already complete
    if (this._native.complete) {
      this._completedResolve();
    }
  }

  get type(): string {
    return this._native.type;
  }

  get complete(): boolean {
    return this._native.complete;
  }

  get completed(): Promise<void> {
    return this._completed;
  }

  get tracks(): ImageTrackList {
    if (this._tracks === null) {
      const nativeTracks = this._native.tracks;
      const tracks: ImageTrack[] = [];

      for (let i = 0; i < nativeTracks.length; i++) {
        const nt = nativeTracks[i];
        tracks.push(new ImageTrack({
          animated: nt.animated,
          frameCount: nt.frameCount,
          repetitionCount: nt.repetitionCount,
          selected: nt.selected,
        }));
      }

      this._tracks = new ImageTrackList(tracks, nativeTracks.ready);
    }
    return this._tracks;
  }

  async decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult> {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }

    const result = await this._native.decode(options || {});

    if (!result.image) {
      throw new DOMException('Failed to decode image', 'EncodingError');
    }

    // Wrap the native frame as a VideoFrame
    const wrapper = Object.create(VideoFrame.prototype) as VideoFrame & {
      _native: NativeVideoFrame;
      _closed: boolean;
      _metadata: VideoFrameMetadata;
    };
    wrapper._native = result.image;
    wrapper._closed = false;
    wrapper._metadata = {};

    return {
      image: wrapper,
      complete: result.complete,
    };
  }

  reset(): void {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }
    this._native.reset();
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  static async isTypeSupported(type: string): Promise<boolean> {
    return native.ImageDecoder.isTypeSupported(type);
  }
}
```

**Step 2: Export new classes from index.ts** (2-5 min)

Add to exports:

```typescript
// lib/index.ts - Add to exports
export {ImageTrack} from './image-track';
export {ImageTrackList} from './image-track-list';
```

**Step 3: Run all ImageDecoder tests** (30 sec)

```bash
npx vitest run test/golden/image-decoder.test.ts test/golden/image-track.test.ts test/golden/image-track-list.test.ts
```

Expected: PASS

**Step 4: Commit** (30 sec)

```bash
git add lib/index.ts lib/image-track.ts lib/image-track-list.ts
git commit -m "refactor(image-decoder): use proper ImageTrack and ImageTrackList classes"
```

---

### Task 7: ReadableStream Support

**Files:**
- Modify: `lib/index.ts` (ImageDecoder constructor)

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/image-decoder-stream.test.ts
import {describe, it, expect} from 'vitest';
import {ImageDecoder} from '../../lib';

describe('ImageDecoder ReadableStream Support', () => {
  function createPNGStream(): ReadableStream<Uint8Array> {
    // Create minimal PNG as chunks
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd,
      0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    return new ReadableStream({
      start(controller) {
        // Send in chunks
        controller.enqueue(pngData.slice(0, 20));
        controller.enqueue(pngData.slice(20, 40));
        controller.enqueue(pngData.slice(40));
        controller.close();
      }
    });
  }

  it('accepts ReadableStream as data source', async () => {
    const stream = createPNGStream();
    const decoder = new ImageDecoder({
      type: 'image/png',
      data: stream,
    });

    // Wait for stream to be fully consumed
    await decoder.completed;
    expect(decoder.complete).toBe(true);

    const result = await decoder.decode();
    expect(result.image.codedWidth).toBe(1);
    expect(result.image.codedHeight).toBe(1);

    result.image.close();
    decoder.close();
  });

  it('tracks.ready resolves after stream consumed', async () => {
    const stream = createPNGStream();
    const decoder = new ImageDecoder({
      type: 'image/png',
      data: stream,
    });

    await decoder.tracks.ready;
    expect(decoder.tracks.length).toBe(1);

    decoder.close();
  });

  it('completed promise rejects on stream error', async () => {
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error('Stream failed'));
      }
    });

    const decoder = new ImageDecoder({
      type: 'image/png',
      data: errorStream,
    });

    await expect(decoder.completed).rejects.toThrow('Stream failed');
    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/image-decoder-stream.test.ts
```

Expected: FAIL (ReadableStream not supported)

**Step 3: Implement ReadableStream support in ImageDecoder constructor** (5-10 min)

```typescript
// lib/index.ts - Update ImageDecoder constructor

export class ImageDecoder {
  private _native: NativeImageDecoder | null = null;
  private _closed: boolean = false;
  private _tracks: ImageTrackList | null = null;
  private _completed: Promise<void>;
  private _completedResolve!: () => void;
  private _completedReject!: (error: Error) => void;
  private _type: string;
  private _streamBuffer: Uint8Array[] = [];
  private _isStreaming: boolean = false;

  constructor(init: ImageDecoderInit) {
    // Validate required fields per W3C spec
    if (!init.type) {
      throw new TypeError(
        "Failed to construct 'ImageDecoder': required member type is undefined."
      );
    }
    if (!init.data) {
      throw new TypeError(
        "Failed to construct 'ImageDecoder': required member data is undefined."
      );
    }

    this._type = init.type;

    // Create completed promise
    this._completed = new Promise((resolve, reject) => {
      this._completedResolve = resolve;
      this._completedReject = reject;
    });

    // Handle ReadableStream
    if (init.data instanceof ReadableStream) {
      this._isStreaming = true;
      this._consumeStream(init.data, init);
      return;
    }

    // Convert data to Buffer if needed
    this._initializeNative(this._convertToBuffer(init.data), init);
  }

  private _convertToBuffer(data: ArrayBuffer | ArrayBufferView): Buffer {
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    } else if (ArrayBuffer.isView(data)) {
      return Buffer.from(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    }
    throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
  }

  private async _consumeStream(
    stream: ReadableStream<Uint8Array>,
    init: ImageDecoderInit
  ): Promise<void> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      // Concatenate all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const fullData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullData.set(chunk, offset);
        offset += chunk.length;
      }

      // Initialize native decoder with complete data
      this._initializeNative(Buffer.from(fullData), init);
      this._isStreaming = false;
      this._completedResolve();
    } catch (error) {
      this._completedReject(error as Error);
    }
  }

  private _initializeNative(dataBuffer: Buffer, init: ImageDecoderInit): void {
    this._native = new native.ImageDecoder({
      type: init.type,
      data: dataBuffer,
      colorSpaceConversion: init.colorSpaceConversion,
      desiredWidth: init.desiredWidth,
      desiredHeight: init.desiredHeight,
      preferAnimation: init.preferAnimation,
    });

    if (this._native.complete && !this._isStreaming) {
      this._completedResolve();
    }
  }

  get type(): string {
    return this._type;
  }

  get complete(): boolean {
    return this._native?.complete ?? false;
  }

  get completed(): Promise<void> {
    return this._completed;
  }

  get tracks(): ImageTrackList {
    if (this._tracks === null) {
      if (!this._native) {
        // Return empty track list while streaming
        return new ImageTrackList([]);
      }

      const nativeTracks = this._native.tracks;
      const tracks: ImageTrack[] = [];

      for (let i = 0; i < nativeTracks.length; i++) {
        const nt = nativeTracks[i];
        tracks.push(new ImageTrack({
          animated: nt.animated,
          frameCount: nt.frameCount,
          repetitionCount: nt.repetitionCount,
          selected: nt.selected,
        }));
      }

      this._tracks = new ImageTrackList(tracks, nativeTracks.ready);
    }
    return this._tracks;
  }

  async decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult> {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }

    // Wait for stream to complete if streaming
    if (this._isStreaming) {
      await this._completed;
    }

    if (!this._native) {
      throw new DOMException('ImageDecoder not initialized', 'InvalidStateError');
    }

    const result = await this._native.decode(options || {});

    if (!result.image) {
      throw new DOMException('Failed to decode image', 'EncodingError');
    }

    // Wrap the native frame as a VideoFrame
    const wrapper = Object.create(VideoFrame.prototype) as VideoFrame & {
      _native: NativeVideoFrame;
      _closed: boolean;
      _metadata: VideoFrameMetadata;
    };
    wrapper._native = result.image;
    wrapper._closed = false;
    wrapper._metadata = {};

    return {
      image: wrapper,
      complete: result.complete,
    };
  }

  reset(): void {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }
    this._native?.reset();
  }

  close(): void {
    if (!this._closed) {
      this._native?.close();
      this._closed = true;
    }
  }

  static async isTypeSupported(type: string): Promise<boolean> {
    return native.ImageDecoder.isTypeSupported(type);
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
npx vitest run test/golden/image-decoder-stream.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/image-decoder-stream.test.ts
git commit -m "feat(image-decoder): add ReadableStream data source support"
```

---

### Task 8: Configuration Options (colorSpaceConversion, desiredWidth/Height, preferAnimation)

**Files:**
- Modify: `src/image_decoder.cc`
- Modify: `lib/index.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// test/golden/image-decoder-options.test.ts
import {describe, it, expect} from 'vitest';
import {ImageDecoder} from '../../lib';

describe('ImageDecoder Configuration Options', () => {
  function createTestPNG(width: number, height: number): Buffer {
    // Create a simple PNG of specified dimensions
    // This is a simplified version - actual implementation would use proper PNG encoding
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = createIHDRChunk(width, height);
    const idat = createIDATChunk(width, height);
    const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

    return Buffer.concat([pngSignature, ihdr, idat, iend]);
  }

  function createIHDRChunk(width: number, height: number): Buffer {
    const chunk = Buffer.alloc(25);
    chunk.writeUInt32BE(13, 0); // length
    chunk.write('IHDR', 4);
    chunk.writeUInt32BE(width, 8);
    chunk.writeUInt32BE(height, 12);
    chunk.writeUInt8(8, 16); // bit depth
    chunk.writeUInt8(2, 17); // color type (RGB)
    chunk.writeUInt8(0, 18); // compression
    chunk.writeUInt8(0, 19); // filter
    chunk.writeUInt8(0, 20); // interlace
    // CRC would go at 21-24
    return chunk;
  }

  function createIDATChunk(width: number, height: number): Buffer {
    // Minimal compressed empty data
    return Buffer.from([
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x00, 0x03, 0x00, 0x01
    ]);
  }

  describe('colorSpaceConversion', () => {
    it('accepts "default" value', () => {
      const data = createTestPNG(10, 10);
      expect(() => {
        const decoder = new ImageDecoder({
          type: 'image/png',
          data,
          colorSpaceConversion: 'default',
        });
        decoder.close();
      }).not.toThrow();
    });

    it('accepts "none" value', () => {
      const data = createTestPNG(10, 10);
      expect(() => {
        const decoder = new ImageDecoder({
          type: 'image/png',
          data,
          colorSpaceConversion: 'none',
        });
        decoder.close();
      }).not.toThrow();
    });
  });

  describe('desiredWidth and desiredHeight', () => {
    it('scales output to desired dimensions', async () => {
      const data = createTestPNG(100, 100);
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        desiredWidth: 50,
        desiredHeight: 50,
      });

      const result = await decoder.decode();
      // Note: displayWidth/displayHeight should match desired
      expect(result.image.displayWidth).toBe(50);
      expect(result.image.displayHeight).toBe(50);

      result.image.close();
      decoder.close();
    });
  });

  describe('preferAnimation', () => {
    it('accepts preferAnimation option', () => {
      const data = createTestPNG(10, 10);
      expect(() => {
        const decoder = new ImageDecoder({
          type: 'image/png',
          data,
          preferAnimation: true,
        });
        decoder.close();
      }).not.toThrow();
    });
  });

  describe('transfer', () => {
    it('detaches transferred ArrayBuffers', () => {
      const buffer = new ArrayBuffer(100);
      const view = new Uint8Array(buffer);
      // Fill with minimal PNG data
      view.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: view,
        transfer: [buffer],
      });

      // Buffer should be detached
      expect(buffer.byteLength).toBe(0);
      decoder.close();
    });
  });
});
```

**Step 2: Run test to verify current state** (30 sec)

```bash
npx vitest run test/golden/image-decoder-options.test.ts
```

**Step 3: Update native layer to support options** (5-10 min)

In `src/image_decoder.cc`, add handling for:
- `colorSpaceConversion`: affects sws_getContext color space
- `desiredWidth`/`desiredHeight`: use swscale for resizing
- `preferAnimation`: affects track selection for multi-track images

**Step 4: Update TypeScript to handle transfer** (2-5 min)

```typescript
// In ImageDecoder constructor, add transfer handling:
if (init.transfer && Array.isArray(init.transfer)) {
  detachArrayBuffers(init.transfer);
}
```

**Step 5: Run tests** (30 sec)

```bash
npx vitest run test/golden/image-decoder-options.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/image_decoder.cc src/image_decoder.h lib/index.ts test/golden/image-decoder-options.test.ts
git commit -m "feat(image-decoder): add colorSpaceConversion, scaling, and transfer options"
```

---

### Task 9: Integration Tests and Edge Cases

**Files:**
- Create: `test/golden/image-decoder-integration.test.ts`

**Step 1: Write comprehensive integration tests** (5-10 min)

```typescript
// test/golden/image-decoder-integration.test.ts
import {describe, it, expect} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {ImageDecoder, VideoFrame} from '../../lib';

describe('ImageDecoder Integration', () => {
  describe('Real file decoding', () => {
    it('decodes actual JPEG file', async () => {
      // Skip if no test file available
      const testFile = path.join(__dirname, '../fixtures/test.jpg');
      if (!fs.existsSync(testFile)) {
        console.log('Skipping: test.jpg not found');
        return;
      }

      const data = fs.readFileSync(testFile);
      const decoder = new ImageDecoder({
        type: 'image/jpeg',
        data,
      });

      expect(decoder.complete).toBe(true);

      const result = await decoder.decode();
      expect(result.image).toBeInstanceOf(VideoFrame);
      expect(result.image.codedWidth).toBeGreaterThan(0);
      expect(result.image.format).toBe('RGBA');

      result.image.close();
      decoder.close();
    });

    it('decodes actual PNG file', async () => {
      const testFile = path.join(__dirname, '../fixtures/test.png');
      if (!fs.existsSync(testFile)) {
        console.log('Skipping: test.png not found');
        return;
      }

      const data = fs.readFileSync(testFile);
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
      });

      const result = await decoder.decode();
      expect(result.complete).toBe(true);

      result.image.close();
      decoder.close();
    });
  });

  describe('Error handling', () => {
    it('throws NotSupportedError for unsupported type', () => {
      expect(() => {
        new ImageDecoder({
          type: 'image/xyz-unsupported',
          data: new Uint8Array([1, 2, 3]),
        });
      }).toThrow(/unsupported|NotSupported/i);
    });

    it('throws EncodingError for invalid data', async () => {
      const decoder = new ImageDecoder({
        type: 'image/png',
        data: new Uint8Array([0, 0, 0, 0]), // Not valid PNG
      });

      await expect(decoder.decode()).rejects.toThrow();
      decoder.close();
    });

    it('handles empty data gracefully', () => {
      expect(() => {
        new ImageDecoder({
          type: 'image/png',
          data: new Uint8Array([]),
        });
      }).toThrow();
    });
  });

  describe('Memory management', () => {
    it('properly releases resources on close', async () => {
      const data = new Uint8Array(1000).fill(0);

      for (let i = 0; i < 100; i++) {
        try {
          const decoder = new ImageDecoder({
            type: 'image/png',
            data,
          });
          decoder.close();
        } catch {
          // Expected to fail with invalid data
        }
      }

      // If we get here without running out of memory, resources are being freed
      expect(true).toBe(true);
    });
  });

  describe('VideoFrame output', () => {
    it('returns VideoFrame with correct properties', async () => {
      // Use minimal valid PNG
      const png = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
        0x08, 0x02, 0x00, 0x00, 0x00, 0xfd, 0xd4, 0x9a,
        0x73, 0x00, 0x00, 0x00, 0x14, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
        0xae, 0x42, 0x60, 0x82
      ]);

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: png,
      });

      const result = await decoder.decode();
      const frame = result.image;

      // Check VideoFrame properties
      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(2);
      expect(frame.codedHeight).toBe(2);
      expect(frame.displayWidth).toBe(2);
      expect(frame.displayHeight).toBe(2);
      expect(frame.timestamp).toBe(0);

      // Can copy data
      const size = frame.allocationSize();
      expect(size).toBe(2 * 2 * 4); // 2x2 RGBA

      const buffer = new Uint8Array(size);
      await frame.copyTo(buffer);
      expect(buffer.length).toBe(size);

      frame.close();
      decoder.close();
    });
  });
});
```

**Step 2: Run all tests** (30 sec)

```bash
npx vitest run test/golden/image-decoder*.test.ts
```

**Step 3: Fix any failing tests** (variable)

Address any edge cases or failures discovered during integration testing.

**Step 4: Commit** (30 sec)

```bash
git add test/golden/image-decoder-integration.test.ts
git commit -m "test(image-decoder): add integration tests and edge case coverage"
```

---

### Task 10: Code Review

**Files:**
- All modified files from Tasks 1-9

**Step 1: Review all changes** (10-15 min)

Run linting and type checking:

```bash
npm run lint
npm run build:ts
```

**Step 2: Run full test suite** (2-5 min)

```bash
npm test
```

**Step 3: Review W3C compliance checklist** (5-10 min)

Verify implementation against W3C spec:

- [ ] ImageDecoder constructor accepts ImageDecoderInit
- [ ] `type` attribute returns MIME type string
- [ ] `complete` attribute indicates parsing complete
- [ ] `completed` Promise resolves when parsing complete
- [ ] `tracks` returns ImageTrackList
- [ ] `decode(options?)` returns Promise<ImageDecodeResult>
- [ ] `reset()` clears pending operations
- [ ] `close()` releases resources
- [ ] `isTypeSupported(type)` static method
- [ ] ImageTrackList has `ready`, `length`, `selectedIndex`, `selectedTrack`
- [ ] ImageTrack has `animated`, `frameCount`, `repetitionCount`, `selected`
- [ ] Animated GIF/WebP multi-frame support
- [ ] ReadableStream data source support
- [ ] colorSpaceConversion option
- [ ] desiredWidth/desiredHeight scaling
- [ ] preferAnimation option
- [ ] ArrayBuffer transfer semantics

**Step 4: Create summary commit** (30 sec)

```bash
git add -A
git commit -m "docs: complete ImageDecoder W3C compliance implementation"
```

---

## Post-Implementation Checklist

After all tasks complete:

1. [ ] All tests pass (`npm test`)
2. [ ] Linting passes (`npm run lint`)
3. [ ] Build succeeds (`npm run build`)
4. [ ] Update CLAUDE.md if needed with new compliance notes
5. [ ] Consider adding ImageDecoder to test/setup.ts globalThis injection
