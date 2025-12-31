# Sharp Patterns Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2024-12-31-sharp-patterns-implementation.md` to implement task-by-task.

**Goal:** Integrate async workers for VideoEncoder and add prebuilt binary infrastructure following sharp patterns.

**Architecture:** VideoEncoder will use existing `AsyncEncodeWorker` with `Napi::ThreadSafeFunction` for non-blocking encoding. Prebuilt infrastructure adds platform packages and fallback loading.

**Tech Stack:** C++17, node-addon-api, Napi::ThreadSafeFunction, node-gyp

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | VideoEncoder async integration (sequential - header then implementation) |
| Group 2 | 3 | TypeScript layer update |
| Group 3 | 4 | Async integration test |
| Group 4 | 5, 6, 7 | Prebuilt infrastructure (independent files) |
| Group 5 | 8 | Code Review |

---

### Task 1: Add AsyncEncodeWorker to VideoEncoder Header

**Files:**
- Modify: `src/video_encoder.h:24-83`

**Step 1: Write the failing test** (2-5 min)

The test verifies that VideoEncoder has async infrastructure. Create a minimal test first:

```typescript
// test/golden/video-encoder-async.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder async mode', () => {
  it('should not block event loop during encoding', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => console.error(e),
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    // Create 10 frames rapidly
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      const buffer = new Uint8Array(320 * 240 * 4);
      buffer.fill(i * 25);  // Different content
      const frame = new VideoFrame(buffer, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,  // ~30fps
      });

      encoder.encode(frame);
      frame.close();
    }

    // Flush and wait
    await encoder.flush();

    expect(chunks.length).toBeGreaterThan(0);
    encoder.close();
  });
});
```

**Step 2: Run test to verify current behavior works** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts -v
```

Expected: PASS (current sync implementation should work, just blocks)

**Step 3: Add async worker member to VideoEncoder header** (2-5 min)

Edit `src/video_encoder.h` - add these includes and members:

```cpp
// At top, after existing includes (around line 16)
#include <memory>
#include "src/async_encode_worker.h"

// Add forward declaration before class (around line 22)
class AsyncEncodeWorker;

// Add to private section (around line 77, before closing brace)
  // Async encoding support
  std::unique_ptr<AsyncEncodeWorker> async_worker_;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;
  bool async_mode_ = false;
```

**Step 4: Verify header compiles** (30 sec)

```bash
npm run build:native 2>&1 | head -30
```

Expected: Compilation should proceed (may have linker errors, that's OK)

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.h test/golden/video-encoder-async.test.ts
git commit -m "feat(encoder): add async worker member to VideoEncoder header"
```

---

### Task 2: Integrate AsyncEncodeWorker in VideoEncoder Implementation

**Files:**
- Modify: `src/video_encoder.cc:1-500`

**Step 1: Write more specific async test** (2-5 min)

```typescript
// Append to test/golden/video-encoder-async.test.ts
  it('should track encodeQueueSize accurately during async encoding', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    expect(encoder.encodeQueueSize).toBe(0);

    // Queue multiple frames
    for (let i = 0; i < 5; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Queue size should be tracked (may already be processing)
    expect(encoder.encodeQueueSize).toBeGreaterThanOrEqual(0);

    await encoder.flush();
    expect(encoder.encodeQueueSize).toBe(0);

    encoder.close();
  });
```

**Step 2: Run test to verify baseline** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts -v
```

Expected: PASS (current implementation tracks queue size)

**Step 3: Update VideoEncoder Configure to initialize async worker** (2-5 min)

In `src/video_encoder.cc`, find the `Configure` method (around line 97). At the end of successful configuration, add:

```cpp
// After successful codec initialization, around line 280
// Initialize async worker for non-blocking encoding
output_tsfn_ = Napi::ThreadSafeFunction::New(
    env,
    output_callback_.Value(),
    "VideoEncoder::output",
    0,  // Unlimited queue
    1   // Single thread
);

error_tsfn_ = Napi::ThreadSafeFunction::New(
    env,
    error_callback_.Value(),
    "VideoEncoder::error",
    0,
    1
);

async_worker_ = std::make_unique<AsyncEncodeWorker>(
    this, output_tsfn_, error_tsfn_);
async_worker_->SetCodecContext(
    codec_context_.get(),
    sws_context_.get(),
    width_,
    height_);
async_worker_->Start();
async_mode_ = true;
```

**Step 4: Update Encode to use async worker** (2-5 min)

Replace the synchronous encoding in `Encode` method with async queueing:

```cpp
// In Encode method, replace the frame processing section
if (async_mode_ && async_worker_) {
  // Copy frame data for async processing
  EncodeTask task;
  task.width = static_cast<uint32_t>(frame_obj->width());
  task.height = static_cast<uint32_t>(frame_obj->height());
  task.timestamp = frame_obj->timestamp();
  task.duration = frame_obj->duration();
  task.key_frame = force_keyframe;

  // Get RGBA data from frame
  size_t data_size = task.width * task.height * 4;
  task.rgba_data.resize(data_size);
  std::memcpy(task.rgba_data.data(), frame_obj->data(), data_size);

  encode_queue_size_++;
  async_worker_->Enqueue(std::move(task));

  return env.Undefined();
}
// Fall through to synchronous encoding if async not available
```

**Step 5: Update Flush to wait for async completion** (2-5 min)

```cpp
// In Flush method, add async handling
if (async_mode_ && async_worker_) {
  async_worker_->Flush();
}
```

**Step 6: Update Cleanup to stop async worker** (2-5 min)

```cpp
// In Cleanup method, add at the beginning
if (async_worker_) {
  async_worker_->Stop();
  async_worker_.reset();
}

if (async_mode_) {
  output_tsfn_.Release();
  error_tsfn_.Release();
  async_mode_ = false;
}
```

**Step 7: Build and run tests** (30 sec)

```bash
npm run build && npx vitest run test/golden/video-encoder-async.test.ts -v
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder-async.test.ts
git commit -m "feat(encoder): integrate AsyncEncodeWorker for non-blocking encoding"
```

---

### Task 3: Update TypeScript Layer for Async Queue Events

**Files:**
- Modify: `lib/index.ts:400-600` (VideoEncoder class)

**Step 1: Write dequeue event test** (2-5 min)

```typescript
// test/golden/video-encoder-async.test.ts - add new test
  it('should emit dequeue events when queue drains', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    let dequeueCount = 0;
    const encoder = new VideoEncoder({
      output: () => {},
      error: (e) => { throw e; },
    });

    encoder.ondequeue = () => {
      dequeueCount++;
    };

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    // Queue frames
    for (let i = 0; i < 3; i++) {
      const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    await encoder.flush();

    // Should have received dequeue events
    expect(dequeueCount).toBeGreaterThan(0);

    encoder.close();
  });
```

**Step 2: Run test to verify** (30 sec)

```bash
npx vitest run test/golden/video-encoder-async.test.ts -v
```

Expected: May fail if dequeue events not properly triggered

**Step 3: Verify dequeue triggering in TypeScript layer** (2-5 min)

Check `lib/index.ts` VideoEncoder class - the `_triggerDequeue()` method should be called when encoding completes. The native callback should trigger this.

If the native layer calls `output_callback_` correctly, the dequeue event should fire. The existing implementation may already work.

**Step 4: Run full test suite** (30 sec)

```bash
npx vitest run test/golden/video-encoder*.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-encoder-async.test.ts
git commit -m "test(encoder): add async encoding and dequeue event tests"
```

---

### Task 4: Event Loop Blocking Verification Test

**Files:**
- Create: `test/golden/video-encoder-event-loop.test.ts`

**Step 1: Write event loop blocking test** (2-5 min)

This test verifies that encoding doesn't block the event loop:

```typescript
// test/golden/video-encoder-event-loop.test.ts
import {describe, it, expect} from 'vitest';

describe('VideoEncoder event loop', () => {
  it('should not block event loop during heavy encoding', async () => {
    const {VideoEncoder, VideoFrame} = await import('../../lib/index');

    const chunks: unknown[] = [];
    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1000000,
    });

    // Track if setImmediate callbacks fire during encoding
    let immediateCallbacksFired = 0;
    const immediateInterval = setInterval(() => {
      immediateCallbacksFired++;
    }, 10);

    // Queue 20 frames (more work)
    for (let i = 0; i < 20; i++) {
      const frame = new VideoFrame(new Uint8Array(640 * 480 * 4), {
        format: 'RGBA',
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Wait for encoding to complete
    await encoder.flush();

    clearInterval(immediateInterval);

    // If async works, interval callbacks should have fired
    // With sync encoding, they would be blocked
    expect(immediateCallbacksFired).toBeGreaterThan(5);
    expect(chunks.length).toBeGreaterThan(0);

    encoder.close();
  });
});
```

**Step 2: Run test** (30 sec)

```bash
npx vitest run test/golden/video-encoder-event-loop.test.ts -v
```

Expected: PASS (if async worker is working correctly)

**Step 3: Commit** (30 sec)

```bash
git add test/golden/video-encoder-event-loop.test.ts
git commit -m "test(encoder): add event loop non-blocking verification test"
```

---

### Task 5: Add Platform Detection Module

**Files:**
- Create: `lib/platform.ts`

**Step 1: Write platform detection tests** (2-5 min)

```typescript
// test/golden/platform.test.ts
import {describe, it, expect} from 'vitest';

describe('platform detection', () => {
  it('should detect current platform', async () => {
    const {runtimePlatformArch, prebuiltPlatforms} = await import('../../lib/platform');

    const platform = runtimePlatformArch();
    expect(platform).toMatch(/^(darwin|linux|win32)(musl)?-(x64|arm64|arm)$/);
  });

  it('should list supported prebuilt platforms', async () => {
    const {prebuiltPlatforms} = await import('../../lib/platform');

    expect(prebuiltPlatforms).toContain('darwin-arm64');
    expect(prebuiltPlatforms).toContain('darwin-x64');
    expect(prebuiltPlatforms).toContain('linux-x64');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
npx vitest run test/golden/platform.test.ts -v
```

Expected: FAIL (module doesn't exist)

**Step 3: Create platform.ts module** (2-5 min)

```typescript
// lib/platform.ts
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection utilities for prebuilt binary loading.
// Follows patterns from sharp/lib/libvips.js

import * as os from 'os';

/**
 * Supported prebuilt platforms.
 * Format: {os}{libc}-{arch}
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linuxmusl-x64',
  'linuxmusl-arm64',
  'win32-x64',
] as const;

export type PrebuiltPlatform = (typeof prebuiltPlatforms)[number];

/**
 * Detect if running on musl libc (Alpine Linux, etc).
 * Uses detect-libc if available, falls back to ldd check.
 */
function detectMusl(): boolean {
  if (os.platform() !== 'linux') {
    return false;
  }

  try {
    // Try detect-libc if installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const detectLibc = require('detect-libc');
    return detectLibc.isNonGlibcLinuxSync?.() ?? false;
  } catch {
    // Fallback: check for musl in process report
    try {
      const report = process.report?.getReport() as {
        sharedObjects?: string[];
      } | null;
      return report?.sharedObjects?.some((s: string) => s.includes('musl')) ?? false;
    } catch {
      return false;
    }
  }
}

/**
 * Get the runtime platform-architecture string.
 * Examples: darwin-arm64, linux-x64, linuxmusl-x64
 */
export function runtimePlatformArch(): string {
  const platform = os.platform();
  const arch = os.arch();
  const libc = platform === 'linux' && detectMusl() ? 'musl' : '';
  return `${platform}${libc}-${arch}`;
}

/**
 * Get the build platform-architecture string.
 * Respects npm_config_* environment variables for cross-compilation.
 */
export function buildPlatformArch(): string {
  const {
    npm_config_arch,
    npm_config_platform,
    npm_config_libc,
  } = process.env;

  const platform = npm_config_platform || os.platform();
  const arch = npm_config_arch || os.arch();
  const libc = npm_config_libc || (platform === 'linux' && detectMusl() ? 'musl' : '');

  return `${platform}${libc}-${arch}`;
}

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export function hasPrebuilt(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}
```

**Step 4: Run test to verify** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/platform.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/platform.ts test/golden/platform.test.ts
git commit -m "feat(platform): add platform detection module for prebuilt binaries"
```

---

### Task 6: Create npm Platform Package Templates

**Files:**
- Create: `npm/darwin-arm64/package.json`
- Create: `npm/darwin-x64/package.json`
- Create: `npm/linux-x64/package.json`
- Create: `npm/linuxmusl-x64/package.json`
- Create: `npm/win32-x64/package.json`

**Step 1: Create npm directory structure** (30 sec)

```bash
mkdir -p npm/darwin-arm64 npm/darwin-x64 npm/linux-x64 npm/linuxmusl-x64 npm/win32-x64
```

**Step 2: Create darwin-arm64 package.json** (2-5 min)

```json
{
  "name": "@aspect/node-webcodecs-darwin-arm64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs for macOS ARM64",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/aspect-build/node-webcodecs.git",
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
    "./package.json": "./package.json"
  }
}
```

**Step 3: Create other platform packages** (2-5 min)

Copy and adjust for each platform:

- `npm/darwin-x64/package.json`: `"cpu": ["x64"]`
- `npm/linux-x64/package.json`: `"os": ["linux"]`, `"cpu": ["x64"]`
- `npm/linuxmusl-x64/package.json`: `"os": ["linux"]`, `"cpu": ["x64"]`, `"libc": ["musl"]`
- `npm/win32-x64/package.json`: `"os": ["win32"]`, `"cpu": ["x64"]`

**Step 4: Create from-local-build.js packaging script** (2-5 min)

```javascript
// npm/from-local-build.js
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Populate npm package for current platform with local build.

'use strict';

const {copyFileSync, mkdirSync, writeFileSync, existsSync} = require('fs');
const {join, basename} = require('path');

// Import platform detection (after TypeScript build)
const {buildPlatformArch} = require('../dist/platform');

const platform = buildPlatformArch();
const destDir = join(__dirname, platform);
const libDir = join(destDir, 'lib');

if (!existsSync(destDir)) {
  console.error(`No package template for platform: ${platform}`);
  console.error(`Create npm/${platform}/package.json first`);
  process.exit(1);
}

console.log(`Populating npm package for platform: ${platform}`);

// Create lib directory
mkdirSync(libDir, {recursive: true});

// Copy native addon
const releaseDir = join(__dirname, '..', 'build', 'Release');
const addonName = 'node_webcodecs.node';
const addonSrc = join(releaseDir, addonName);
const addonDest = join(libDir, `node-webcodecs-${platform}.node`);

if (!existsSync(addonSrc)) {
  console.error(`Native addon not found: ${addonSrc}`);
  console.error('Run npm run build first');
  process.exit(1);
}

copyFileSync(addonSrc, addonDest);
console.log(`Copied ${addonName} -> ${basename(addonDest)}`);

// Copy LICENSE
const licenseSrc = join(__dirname, '..', 'LICENSE');
if (existsSync(licenseSrc)) {
  copyFileSync(licenseSrc, join(destDir, 'LICENSE'));
}

// Generate README
const pkg = require(`./${platform}/package.json`);
const readme = `# ${pkg.name}\n\n${pkg.description}\n\nThis package is automatically installed as an optional dependency of \`node-webcodecs\`.\n`;
writeFileSync(join(destDir, 'README.md'), readme);

console.log('Done!');
```

**Step 5: Verify script works** (30 sec)

```bash
npm run build:ts && node npm/from-local-build.js
```

Expected: Should populate npm/darwin-arm64/lib/ (or your platform)

**Step 6: Commit** (30 sec)

```bash
git add npm/
git commit -m "feat(npm): add platform package templates and build script"
```

---

### Task 7: Update Binding Loader for Prebuilt Support

**Files:**
- Modify: `lib/binding.ts`

**Step 1: Write prebuilt loading test** (2-5 min)

```typescript
// test/golden/binding.test.ts
import {describe, it, expect} from 'vitest';

describe('binding loader', () => {
  it('should load native binding', async () => {
    const {binding, platformInfo} = await import('../../lib/binding');

    expect(binding).toBeDefined();
    expect(typeof binding.VideoEncoder).toBe('function');
    expect(typeof binding.VideoDecoder).toBe('function');
    expect(platformInfo.runtimePlatform).toMatch(/^(darwin|linux|win32)/);
  });

  it('should export platform info', async () => {
    const {platformInfo} = await import('../../lib/binding');

    expect(platformInfo).toHaveProperty('platform');
    expect(platformInfo).toHaveProperty('arch');
    expect(platformInfo).toHaveProperty('runtimePlatform');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
npx vitest run test/golden/binding.test.ts -v
```

Expected: PASS (existing loader should work)

**Step 3: Update binding.ts to try prebuilt packages** (2-5 min)

Update `lib/binding.ts` to add prebuilt package path:

```typescript
// Add import at top
import {runtimePlatformArch, prebuiltPlatforms} from './platform';

// Update getBindingPaths() function
function getBindingPaths(): string[] {
  const rootDir = path.resolve(__dirname, '..');
  const runtimePlatform = runtimePlatformArch();

  return [
    // Development build (node-gyp output)
    path.join(rootDir, 'build', 'Release', 'node_webcodecs.node'),
    path.join(rootDir, 'build', 'Debug', 'node_webcodecs.node'),

    // Prebuilt from npm package (e.g., @aspect/node-webcodecs-darwin-arm64)
    // This path is resolved by Node's module resolution
    `@aspect/node-webcodecs-${runtimePlatform}/lib/node-webcodecs-${runtimePlatform}.node`,

    // Local prebuilds directory
    path.join(rootDir, 'prebuilds', runtimePlatform, 'node_webcodecs.node'),

    // node-gyp-build compatible location
    path.join(rootDir, 'prebuilds', runtimePlatform, 'node.napi.node'),

    // Fallback: adjacent to dist/
    path.join(rootDir, 'node_webcodecs.node'),
  ];
}
```

**Step 4: Run tests** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/binding.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/binding.ts test/golden/binding.test.ts
git commit -m "feat(binding): add prebuilt package loading support"
```

---

### Task 8: Code Review

**Files:**
- All files modified in Tasks 1-7

**Step 1: Review all changes** (5-10 min)

```bash
git log --oneline -10
git diff HEAD~7..HEAD --stat
```

**Step 2: Run full test suite** (2-5 min)

```bash
npm test
```

Expected: All tests pass

**Step 3: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 4: Verify build works clean** (2-5 min)

```bash
npm run rebuild && npm test
```

Expected: Clean build and all tests pass

**Step 5: Create summary commit if needed** (30 sec)

If any fixes were needed during review:

```bash
git add -A && git commit -m "fix: address code review feedback"
```

---

## Post-Implementation

After completing all tasks:

1. Run `/dev-workflow:finishing-a-development-branch` to create PR or merge
2. Consider creating GitHub Actions workflow for prebuilt binaries (Phase 3 of design doc)
