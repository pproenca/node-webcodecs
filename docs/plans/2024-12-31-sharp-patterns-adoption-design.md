# Sharp Patterns Adoption Design

## Overview

This document captures patterns from lovell/sharp that should be adopted in node-webcodecs to achieve production quality for async operations and NPM distribution.

## Part 1: Async Worker Pattern

### Current State (node-webcodecs)

Encoding and decoding operations currently run synchronously on the main thread. This blocks the Node.js event loop during CPU-intensive FFmpeg operations.

```cpp
// Current: Synchronous encode in video_encoder.cc
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
  // ... extract frame data
  avcodec_send_frame(codec_context_, frame_);  // BLOCKS main thread
  avcodec_receive_packet(codec_context_, packet_);  // BLOCKS main thread
  // ... call JS callback
}
```

### Target State (sharp pattern)

All heavy FFmpeg operations run on libuv thread pool via `Napi::AsyncWorker`:

```cpp
class EncodeWorker : public Napi::AsyncWorker {
 public:
  EncodeWorker(Napi::Function callback, EncodeBaton* baton)
    : Napi::AsyncWorker(callback), baton_(baton) {}

  void Execute() override {
    // Runs on libuv worker thread - does NOT block event loop
    webcodecs::counterQueue--;
    webcodecs::counterProcess++;

    int ret = avcodec_send_frame(baton_->codec_ctx, baton_->frame);
    if (ret < 0) {
      baton_->err = av_err2str(ret);
      return;
    }

    ret = avcodec_receive_packet(baton_->codec_ctx, baton_->packet);
    if (ret < 0 && ret != AVERROR(EAGAIN)) {
      baton_->err = av_err2str(ret);
    }
  }

  void OnOK() override {
    // Runs on main thread after Execute() completes
    Napi::Env env = Env();

    if (!baton_->err.empty()) {
      Callback().Call({Napi::Error::New(env, baton_->err).Value()});
    } else {
      // Create EncodedVideoChunk and call output callback
      Napi::Object chunk = CreateEncodedVideoChunk(env, baton_->packet);
      Callback().Call({env.Null(), chunk});
    }

    // Notify queue listener
    webcodecs::counterProcess--;
    NotifyQueueChange(env);

    delete baton_;
  }

 private:
  EncodeBaton* baton_;
};
```

### Baton Pattern

All parameters passed between JS and C++ via a struct:

```cpp
struct EncodeBaton {
  // Input
  AVCodecContext* codec_ctx;
  AVFrame* frame;
  int64_t timestamp;
  bool keyframe;

  // Output
  AVPacket* packet;
  std::string err;

  EncodeBaton() : packet(av_packet_alloc()) {}
  ~EncodeBaton() { av_packet_free(&packet); }
};
```

### Queue Tracking

Global atomic counters for monitoring:

```cpp
// common.h
namespace webcodecs {
  extern std::atomic<int> counterQueue;    // Tasks waiting for thread
  extern std::atomic<int> counterProcess;  // Tasks being processed
}

// common.cc
std::atomic<int> webcodecs::counterQueue(0);
std::atomic<int> webcodecs::counterProcess(0);
```

### JS Layer Changes

```typescript
// lib/index.ts - VideoEncoder.encode()

encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void {
  if (this._state !== 'configured') {
    throw new DOMException('Encoder not configured', 'InvalidStateError');
  }

  this._encodeQueueSize++;
  this._native.encodeAsync(
    frame._native,
    options?.keyFrame ?? false,
    frame.timestamp,
    (err: Error | null, chunk?: EncodedVideoChunk) => {
      this._encodeQueueSize--;
      this._triggerDequeue();

      if (err) {
        this._errorCallback(err);
      } else if (chunk) {
        this._outputCallback(chunk, this._getMetadata());
      }
    }
  );
}
```

### Methods to Make Async

| Class | Method | Rationale |
|-------|--------|-----------|
| VideoEncoder | encode() | Frame encoding is CPU-intensive |
| VideoEncoder | flush() | May encode pending frames |
| VideoDecoder | decode() | Packet decoding is CPU-intensive |
| VideoDecoder | flush() | May decode pending frames |
| AudioEncoder | encode() | Audio encoding |
| AudioDecoder | decode() | Audio decoding |
| ImageDecoder | decode() | Image decoding |
| Demuxer | demux() | Container parsing |
| VideoFilter | apply() | Filter operations |

### Thread Safety Considerations

1. **FFmpeg contexts are NOT thread-safe** - each encoder/decoder instance must have its own context
2. **Callbacks must be invoked on main thread** - `OnOK()` handles this automatically
3. **Frame data must be copied** before queueing - source frame may be closed/reused
4. **Resource cleanup** - use Reference counting or ensure baton owns resources

---

## Part 2: Prebuilt Binary Distribution

### Current State

- Users must have FFmpeg development libraries installed system-wide
- `install/check.js` verifies FFmpeg availability but doesn't provide fallback
- No prebuilt binaries - every install requires compilation

### Target Architecture

```
node-webcodecs (main package)
├── package.json
│   └── optionalDependencies:
│       ├── "@ffmpeg/node-webcodecs-darwin-arm64": "0.2.0"
│       ├── "@ffmpeg/node-webcodecs-darwin-x64": "0.2.0"
│       ├── "@ffmpeg/node-webcodecs-linux-x64": "0.2.0"
│       ├── "@ffmpeg/node-webcodecs-linuxmusl-x64": "0.2.0"
│       ├── "@ffmpeg/node-webcodecs-win32-x64": "0.2.0"
│       └── "@ffmpeg/node-webcodecs-wasm32": "0.2.0"  # Fallback
│
├── lib/binding.ts (loader with fallback)
└── install/check.js (controls install vs build)

Platform packages (@ffmpeg/node-webcodecs-{platform}):
├── package.json
│   ├── "os": ["darwin"]
│   ├── "cpu": ["arm64"]
│   └── "files": ["lib"]
├── lib/
│   ├── node-webcodecs-darwin-arm64.node
│   └── ffmpeg-libs/ (bundled FFmpeg shared libs)
└── LICENSE
```

### Binding Loader (lib/binding.ts)

```typescript
import { familySync } from 'detect-libc';

const runtimePlatform = `${process.platform}${
  process.platform === 'linux' && familySync() === 'musl' ? 'musl' : ''
}-${process.arch}`;

const paths = [
  // 1. Local development build
  `../build/Release/node-webcodecs.node`,
  // 2. Prebuilt binary from platform package
  `@ffmpeg/node-webcodecs-${runtimePlatform}/lib/node-webcodecs-${runtimePlatform}.node`,
  // 3. WASM fallback (experimental)
  '@ffmpeg/node-webcodecs-wasm32/lib/node-webcodecs-wasm32.node',
];

let binding: NativeModule | null = null;
const errors: Error[] = [];

for (const path of paths) {
  try {
    binding = require(path);
    break;
  } catch (err) {
    errors.push(err as Error);
  }
}

if (!binding) {
  const help = [
    `Could not load node-webcodecs for ${runtimePlatform}`,
    '',
    'Possible solutions:',
    '- Ensure optional dependencies are installed:',
    '    npm install --include=optional',
    '- Install FFmpeg development libraries and rebuild:',
    '    npm run build:native',
    '',
    'Platform install instructions:',
    process.platform === 'darwin'
      ? '    brew install ffmpeg'
      : '    apt-get install libavcodec-dev libavutil-dev ...',
  ];
  throw new Error(help.join('\n'));
}

export { binding };
export const platformInfo = {
  platform: runtimePlatform,
  prebuilt: !paths[0].includes('Release'),
};
```

### Install Check (install/check.js)

```javascript
#!/usr/bin/env node
'use strict';

const { runtimePlatformArch, prebuiltPlatforms } = require('../lib/platform');

// Skip build if prebuilt is available
try {
  const platform = runtimePlatformArch();
  if (prebuiltPlatforms.includes(platform)) {
    const prebuiltPath = `@ffmpeg/node-webcodecs-${platform}`;
    require.resolve(prebuiltPath);
    console.log(`node-webcodecs: Using prebuilt binary for ${platform}`);
    process.exit(0);  // Skip build
  }
} catch {}

// Check if building from source is possible
if (process.env.npm_config_build_from_source) {
  process.exit(1);  // Force build
}

// Check FFmpeg availability for source build
const { checkPkgConfig, getFFmpegVersion } = require('./ffmpeg-check');
if (!checkPkgConfig()) {
  console.error('node-webcodecs: FFmpeg not found, cannot build from source');
  process.exit(1);
}

console.log('node-webcodecs: Building from source');
process.exit(1);
```

### Platform Package Structure

**npm/darwin-arm64/package.json:**
```json
{
  "name": "@ffmpeg/node-webcodecs-darwin-arm64",
  "version": "0.2.0",
  "description": "Prebuilt node-webcodecs for macOS ARM64",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/user/node-webcodecs.git",
    "directory": "npm/darwin-arm64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["darwin"],
  "cpu": ["arm64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib/*": "./lib/*",
    "./package": "./package.json"
  }
}
```

### CI/CD Build Matrix

**.github/workflows/build-prebuilts.yml:**
```yaml
name: Build Prebuilt Binaries

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-22.04
            platform: linux-x64
            ffmpeg_install: |
              sudo apt-get update
              sudo apt-get install -y libavcodec-dev libavutil-dev \
                libswscale-dev libswresample-dev libavfilter-dev

          - os: ubuntu-22.04
            container: node:18-alpine3.18
            platform: linuxmusl-x64
            ffmpeg_install: apk add ffmpeg-dev

          - os: macos-14  # ARM64
            platform: darwin-arm64
            ffmpeg_install: brew install ffmpeg

          - os: macos-13  # x64
            platform: darwin-x64
            ffmpeg_install: brew install ffmpeg

          - os: windows-2022
            platform: win32-x64
            ffmpeg_install: choco install ffmpeg

    runs-on: ${{ matrix.os }}
    container: ${{ matrix.container }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v5
        with:
          node-version: '18'

      - name: Install FFmpeg
        run: ${{ matrix.ffmpeg_install }}

      - run: npm install
      - run: npm run build
      - run: npm test

      - name: Package binary
        run: node npm/from-local-build.js

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}
          path: npm/${{ matrix.platform }}
          retention-days: 7

  publish:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: npm/

      - uses: actions/setup-node@v5
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Publish platform packages
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          for dir in npm/*/; do
            if [ -f "$dir/package.json" ]; then
              cd "$dir"
              npm publish --access public
              cd -
            fi
          done

      - name: Publish main package
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npm publish
```

### Bundling FFmpeg Libraries

For full prebuilt support, FFmpeg shared libraries must be bundled:

```javascript
// npm/from-local-build.js
const { copyFileSync, cpSync, mkdirSync } = require('fs');
const { join } = require('path');
const { buildPlatformArch, getFFmpegLibs } = require('../lib/platform');

const platform = buildPlatformArch();
const destDir = join(__dirname, platform);
const libDir = join(destDir, 'lib');

mkdirSync(libDir, { recursive: true });

// Copy node addon
const releaseDir = join(__dirname, '..', 'build', 'Release');
cpSync(releaseDir, libDir, {
  filter: (file) => file.endsWith('.node'),
  recursive: true
});

// Copy FFmpeg shared libraries (platform-specific)
const ffmpegLibs = getFFmpegLibs();  // Returns paths based on platform
for (const lib of ffmpegLibs) {
  copyFileSync(lib, join(libDir, basename(lib)));
}

// Generate README
const { name, description } = require(`./${platform}/package.json`);
writeFileSync(join(destDir, 'README.md'), `# ${name}\n\n${description}\n`);
```

---

## Implementation Phases

### Phase 1: Async Workers (High Priority)
1. Create `EncodeBaton`, `DecodeBaton` structs in `src/common.h`
2. Add atomic queue counters
3. Implement `EncodeWorker` for VideoEncoder
4. Update `lib/index.ts` to use async encoding
5. Add queue size tracking and dequeue events
6. Repeat for VideoDecoder, AudioEncoder, AudioDecoder
7. Add tests for concurrent operations

### Phase 2: Prebuilt Infrastructure
1. Create `lib/binding.ts` with fallback loading
2. Create `lib/platform.ts` with detection helpers
3. Update `install/check.js` to check for prebuilts
4. Create npm/{platform}/package.json templates
5. Create `npm/from-local-build.js` packaging script

### Phase 3: CI/CD Pipeline
1. Create `.github/workflows/build-prebuilts.yml`
2. Set up GitHub secrets for NPM publishing
3. Test publish flow with beta versions
4. Document release process

### Phase 4: FFmpeg Bundling (Optional, Complex)
1. Research static linking vs shared lib bundling
2. Create FFmpeg build scripts per platform
3. Handle licensing (LGPL compliance)
4. Test bundle size and load time

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Thread safety issues with FFmpeg | High | Ensure one context per encoder instance, test under load |
| Large bundle size with FFmpeg | Medium | Use dynamic linking, strip unused symbols |
| FFmpeg licensing (LGPL) | High | Document compliance, consider static linking options |
| CI build time | Low | Use caching, parallel jobs |
| Platform coverage gaps | Medium | Start with top 5 platforms, add incrementally |

---

## Success Criteria

- [ ] VideoEncoder.encode() does not block event loop
- [ ] `npm install` works without FFmpeg on supported platforms
- [ ] Queue size tracking matches actual pending operations
- [ ] Concurrent encode operations work correctly
- [ ] <100ms install time on prebuilt platforms
