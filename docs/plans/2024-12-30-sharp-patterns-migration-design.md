# Sharp Patterns Migration Design

**Date:** 2024-12-30
**Status:** Approved for implementation
**Goal:** Align node-webcodecs with sharp's production patterns for build system, C++ organization, and JS validation layer.

## Background

Sharp (https://github.com/lovell/sharp) is a widely-used Node.js native addon with 37k+ stars. Its patterns represent battle-tested approaches for:
- Build system (node-gyp)
- C++ code organization (namespace, helpers, baton pattern)
- JavaScript validation layer (type guards, error factories)
- Platform detection and error handling

This migration adopts these patterns while preserving node-webcodecs' WebCodecs API compliance.

---

## Section 1: Build System Migration (CMake → node-gyp)

### Current State
- Uses `cmake-js` with `CMakeLists.txt`
- FFmpeg discovery via `pkg-config`
- Sanitizer and coverage options

### Target State
- Uses `node-gyp` with `binding.gyp`
- FFmpeg discovery via `pkg-config` (preserved)
- Platform-specific configurations for macOS, Linux, Windows

### binding.gyp

```python
{
  'targets': [
    {
      'target_name': 'node_webcodecs',
      'sources': [
        'src/addon.cc',
        'src/common.cc',
        'src/video_encoder.cc',
        'src/video_decoder.cc',
        'src/video_frame.cc',
        'src/audio_encoder.cc',
        'src/audio_decoder.cc',
        'src/audio_data.cc',
        'src/encoded_video_chunk.cc',
        'src/encoded_audio_chunk.cc',
        'src/video_filter.cc',
        'src/demuxer.cc',
        'src/image_decoder.cc'
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")",
        '.'
      ],
      'defines': [
        'NAPI_VERSION=8',
        'NAPI_CPP_EXCEPTIONS',
        'NODE_ADDON_API_DISABLE_DEPRECATED'
      ],
      'dependencies': [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      'conditions': [
        ['OS=="mac"', {
          'include_dirs': [
            '<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo "/opt/homebrew/include /usr/local/include")'
          ],
          'libraries': [
            '<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo "-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter")'
          ],
          'xcode_settings': {
            'CLANG_CXX_LANGUAGE_STANDARD': 'c++17',
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'GCC_ENABLE_CPP_RTTI': 'YES',
            'MACOSX_DEPLOYMENT_TARGET': '10.15',
            'OTHER_CPLUSPLUSFLAGS': [
              '-fexceptions',
              '-Wall',
              '-Wextra',
              '-Wno-unused-parameter'
            ]
          }
        }],
        ['OS=="linux"', {
          'include_dirs': [
            '<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter | sed s/-I//g)'
          ],
          'libraries': [
            '<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter)'
          ],
          'cflags_cc': [
            '-std=c++17',
            '-fexceptions',
            '-Wall',
            '-Wextra',
            '-Wno-unused-parameter',
            '-fPIC'
          ]
        }],
        ['OS=="win"', {
          'include_dirs': [
            '<!(echo %FFMPEG_PATH%)/include'
          ],
          'libraries': [
            '-l<!(echo %FFMPEG_PATH%)/lib/avcodec',
            '-l<!(echo %FFMPEG_PATH%)/lib/avutil',
            '-l<!(echo %FFMPEG_PATH%)/lib/swscale',
            '-l<!(echo %FFMPEG_PATH%)/lib/swresample',
            '-l<!(echo %FFMPEG_PATH%)/lib/avfilter'
          ],
          'msvs_settings': {
            'VCCLCompilerTool': {
              'AdditionalOptions': ['/std:c++17', '/EHsc'],
              'ExceptionHandling': 1
            }
          },
          'defines': ['_HAS_EXCEPTIONS=1']
        }]
      ]
    }
  ]
}
```

### package.json Script Changes

```json
{
  "scripts": {
    "install": "node install/check.js && (node-gyp-build || npm run build:native)",
    "build": "npm run build:native && npm run build:ts",
    "build:native": "node-gyp rebuild",
    "build:native:debug": "node-gyp rebuild --debug",
    "build:ts": "tsc",
    "rebuild": "npm run clean && npm run build",
    "clean": "node-gyp clean && rm -rf dist"
  },
  "dependencies": {
    "node-addon-api": "^8.0.0",
    "node-gyp-build": "^4.8.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  },
  "gypfile": true
}
```

---

## Section 2: C++ Namespace and Common Helpers

### src/common.h

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

#include <atomic>
#include <functional>
#include <string>
#include <tuple>
#include <vector>
#include <unordered_map>
#include <mutex>

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libavutil/pixdesc.h>
#include <libavutil/error.h>
}

// Verify FFmpeg version compatibility
#if LIBAVCODEC_VERSION_MAJOR < 59
#error "FFmpeg 5.0+ (libavcodec 59+) is required"
#endif

namespace webcodecs {

//==============================================================================
// Napi::Object Attribute Helpers
//==============================================================================

bool HasAttr(Napi::Object obj, const std::string& attr);
std::string AttrAsStr(Napi::Object obj, const std::string& attr);
std::string AttrAsStr(Napi::Object obj, const std::string& attr, const std::string& default_val);
uint32_t AttrAsUint32(Napi::Object obj, const std::string& attr);
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr);
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr, int32_t default_val);
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr);
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr, int64_t default_val);
double AttrAsDouble(Napi::Object obj, const std::string& attr);
double AttrAsDouble(Napi::Object obj, const std::string& attr, double default_val);
bool AttrAsBool(Napi::Object obj, const std::string& attr);
bool AttrAsBool(Napi::Object obj, const std::string& attr, bool default_val);
std::tuple<const uint8_t*, size_t> AttrAsBuffer(Napi::Object obj, const std::string& attr);

//==============================================================================
// Validation Helpers
//==============================================================================

void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr);
void RequirePositiveInt(Napi::Env env, const std::string& name, int32_t value);
void RequireNonNegativeInt(Napi::Env env, const std::string& name, int32_t value);
void RequireInRange(Napi::Env env, const std::string& name, int32_t value, int32_t min, int32_t max);
void RequireOneOf(Napi::Env env, const std::string& name, const std::string& value, const std::vector<std::string>& allowed);

//==============================================================================
// Error Helpers
//==============================================================================

Napi::Error InvalidParameterError(Napi::Env env, const std::string& name, const std::string& expected, const Napi::Value& actual);
Napi::Error FFmpegError(Napi::Env env, const std::string& operation, int errnum);
std::string FFmpegErrorString(int errnum);

//==============================================================================
// Pixel Format Utilities
//==============================================================================

AVPixelFormat PixelFormatFromString(const std::string& format);
std::string PixelFormatToString(AVPixelFormat format);
int BytesPerPixel(AVPixelFormat format);
bool HasAlpha(AVPixelFormat format);
bool IsPlanar(AVPixelFormat format);

//==============================================================================
// Codec Utilities
//==============================================================================

AVCodecID CodecIdFromString(const std::string& codec);
std::string CodecIdToString(AVCodecID id);
bool IsEncoderSupported(const std::string& codec);
bool IsDecoderSupported(const std::string& codec);

//==============================================================================
// Color Space Utilities
//==============================================================================

AVColorPrimaries ColorPrimariesFromString(const std::string& primaries);
AVColorTransferCharacteristic TransferFromString(const std::string& transfer);
AVColorSpace MatrixFromString(const std::string& matrix);
std::string ColorPrimariesToString(AVColorPrimaries primaries);
std::string TransferToString(AVColorTransferCharacteristic transfer);
std::string MatrixToString(AVColorSpace matrix);

//==============================================================================
// Global Counters
//==============================================================================

extern std::atomic<int> counterQueue;
extern std::atomic<int> counterProcess;
extern std::atomic<int> counterFrames;

//==============================================================================
// FFmpeg Initialization
//==============================================================================

void InitFFmpeg();
void FFmpegLogCallback(void* ptr, int level, const char* fmt, va_list vl);

}  // namespace webcodecs

#endif  // SRC_COMMON_H_
```

### src/common.cc

Full implementation of all helpers declared in common.h, including:
- Attribute extraction with type safety
- Validation with descriptive errors
- FFmpeg pixel format mapping
- FFmpeg codec ID parsing
- Color space conversions
- Thread-safe initialization

---

## Section 3: JS Validation Layer (lib/is.ts)

### lib/is.ts

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

// Type guards
export function defined<T>(val: T | undefined | null): val is T;
export function object(val: unknown): val is object;
export function plainObject(val: unknown): val is Record<string, unknown>;
export function fn(val: unknown): val is Function;
export function bool(val: unknown): val is boolean;
export function buffer(val: unknown): val is Buffer;
export function typedArray(val: unknown): val is ArrayBufferView;
export function arrayBuffer(val: unknown): val is ArrayBuffer;
export function bufferLike(val: unknown): val is Buffer | ArrayBuffer | ArrayBufferView;
export function string(val: unknown): val is string;
export function anyString(val: unknown): val is string;
export function number(val: unknown): val is number;
export function integer(val: unknown): val is number;
export function positiveInteger(val: unknown): val is number;
export function nonNegativeInteger(val: unknown): val is number;

// Range/enum validation
export function inRange(val: number, min: number, max: number): boolean;
export function inArray<T>(val: T, list: readonly T[]): boolean;

// Domain-specific guards
export function pixelFormat(val: unknown): val is string;
export function sampleFormat(val: unknown): val is string;
export function codecState(val: unknown): val is 'unconfigured' | 'configured' | 'closed';

// Error factories (sharp pattern)
export function invalidParameterError(name: string, expected: string, actual: unknown): Error;
export function missingParameterError(name: string): Error;
export function rangeError(name: string, min: number, max: number, actual: number): Error;
export function enumError(name: string, allowed: readonly string[], actual: unknown): Error;
export function nativeError(native: Error, context: Error): Error;

// Assertion helpers
export function assertDefined<T>(val: T | undefined | null, name: string): asserts val is T;
export function assertPositiveInteger(val: unknown, name: string): asserts val is number;
export function assertNonNegativeInteger(val: unknown, name: string): asserts val is number;
export function assertInRange(val: number, name: string, min: number, max: number): void;
export function assertFunction(val: unknown, name: string): asserts val is Function;
export function assertPlainObject(val: unknown, name: string): asserts val is Record<string, unknown>;
export function assertOneOf<T extends string>(val: unknown, name: string, allowed: readonly T[]): asserts val is T;
export function assertBufferLike(val: unknown, name: string): asserts val is Buffer | ArrayBuffer | ArrayBufferView;
```

---

## Section 4: Project Structure & Native Loading

### Directory Structure

```
node-webcodecs/
├── binding.gyp                  # node-gyp build config
├── package.json                 # Updated scripts & deps
├── src/
│   ├── addon.cc                 # Entry point with version export
│   ├── common.cc                # Shared helpers
│   ├── common.h                 # Namespace declarations
│   ├── ffmpeg_raii.h            # RAII wrappers (keep)
│   ├── video_encoder.cc/.h
│   ├── video_decoder.cc/.h
│   ├── video_frame.cc/.h
│   ├── audio_encoder.cc/.h
│   ├── audio_decoder.cc/.h
│   ├── audio_data.cc/.h
│   ├── encoded_video_chunk.cc/.h
│   ├── encoded_audio_chunk.cc/.h
│   ├── video_filter.cc/.h
│   ├── demuxer.cc/.h
│   └── image_decoder.cc/.h
├── lib/
│   ├── index.ts                 # Main API (updated validation)
│   ├── binding.ts               # Enhanced native loader
│   ├── is.ts                    # Type guards & validation
│   ├── errors.ts                # Error classes (keep)
│   ├── types.ts                 # W3C types (keep)
│   ├── native-types.ts          # Native interfaces (keep)
│   ├── control-message-queue.ts # Keep
│   └── resource-manager.ts      # Keep
├── install/
│   └── check.js                 # Install-time FFmpeg check
└── docs/
    └── plans/                   # This document
```

### lib/binding.ts (Enhanced Loader)

```typescript
// Features:
// - Multiple binding path search
// - Platform-specific error messages
// - FFmpeg installation instructions
// - Version detection
// - Helpful diagnostics

const bindingPaths = [
  '../build/Release/node_webcodecs.node',
  '../build/Debug/node_webcodecs.node',
  `../prebuilds/${runtimePlatformArch()}/node_webcodecs.node`,
];

// Error message includes:
// - Current platform/arch
// - Node.js version check
// - Rebuild instructions
// - FFmpeg installation for OS
// - pkg-config verification
```

### install/check.js

```javascript
// Install-time checks:
// - pkg-config availability
// - FFmpeg libraries detectable
// - FFmpeg version >= 5.0
// - Platform-specific instructions on failure
```

---

## Section 5: Migration Phases

### Phase 1: Add New Infrastructure (Non-Breaking)
- Create `lib/is.ts`
- Create `src/common.h` and `src/common.cc`
- Create `install/check.js`
- Create `binding.gyp`
- Update `package.json` (add deps, keep cmake-js working)

### Phase 2: Integrate C++ Helpers
- Add `#include "src/common.h"` to all .cc files
- Replace manual attribute access with `AttrAsInt32`, `AttrAsStr`, etc.
- Replace error creation with `InvalidParameterError`, `FFmpegError`
- Add `webcodecs::InitFFmpeg()` to addon.cc
- Add counter increments to encoders/decoders

### Phase 3: Integrate JS Validation Layer
- Import `* as is from './is'` in lib/index.ts
- Replace inline validation with `is.assert*` functions
- Update error messages to use `is.invalidParameterError`
- Add native error wrapping with `is.nativeError`

### Phase 4: Switch Build System
- Update package.json scripts to use node-gyp
- Update lib/binding.ts with enhanced loader
- Remove CMakeLists.txt
- Remove cmake-js dependency

### Phase 5: Add Enhanced Error Messages
- Audit all throw statements
- Ensure consistent "Expected X for Y but received Z" format
- Add platform-specific help in binding loader

### Phase 6: Documentation & Cleanup
- Update README.md with new build instructions
- Update CLAUDE.md with new architecture
- Add TSDoc to lib/is.ts
- Remove deprecated files

---

## Testing Strategy

Each phase must pass:
```bash
npm run clean
npm run build
npm test
```

Add validation tests:
```typescript
describe('Parameter Validation', () => {
  it('provides helpful error for invalid width', () => {
    expect(() => {
      new VideoEncoder({ output: () => {}, error: () => {} })
        .configure({ codec: 'avc1.42E01E', width: -1, height: 480 });
    }).toThrow(/Expected positive integer for .* width .* but received -1/);
  });
});
```

---

## Rollback Strategy

Each phase independently reversible via git revert.

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Build system | cmake-js | node-gyp |
| C++ organization | scattered | `webcodecs::` namespace |
| JS validation | inline | centralized `lib/is.ts` |
| Error messages | basic | "Expected X for Y but received Z" |
| Install check | none | FFmpeg validation |
| Native loading | simple | diagnostic with help |
