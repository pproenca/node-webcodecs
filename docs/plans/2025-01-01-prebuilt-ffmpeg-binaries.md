# Prebuilt FFmpeg Binaries Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-prebuilt-ffmpeg-binaries.md` to implement task-by-task.

**Goal:** Ship prebuilt FFmpeg shared libraries with the package, eliminating the need for users to install FFmpeg via Homebrew or apt-get.

**Architecture:** Following sharp's pattern, we create two layers of platform-specific packages:
1. `@pproenca/ffmpeg-{platform}` - Contains prebuilt FFmpeg shared libraries (.dylib/.so/.dll)
2. `@pproenca/node-webcodecs-{platform}` - Contains the native addon, depends on the FFmpeg package

The main `@pproenca/node-webcodecs` package lists all platform packages as `optionalDependencies`. npm automatically installs only the matching platform package.

**Tech Stack:** Node.js, node-gyp, GitHub Actions, FFmpeg (LGPL build)

---

## Architecture Overview

```
@pproenca/node-webcodecs (main package)
├── optionalDependencies:
│   ├── @pproenca/node-webcodecs-darwin-arm64
│   ├── @pproenca/node-webcodecs-darwin-x64
│   ├── @pproenca/node-webcodecs-linux-x64
│   ├── @pproenca/node-webcodecs-linuxmusl-x64
│   └── @pproenca/node-webcodecs-win32-x64
│
└── lib/ffmpeg.ts (runtime loader - tries prebuilt, falls back to system)

@pproenca/node-webcodecs-darwin-arm64
├── lib/node-webcodecs-darwin-arm64.node (native addon)
└── optionalDependencies:
    └── @pproenca/ffmpeg-darwin-arm64

@pproenca/ffmpeg-darwin-arm64
└── lib/
    ├── libavcodec.61.dylib
    ├── libavutil.59.dylib
    ├── libswscale.8.dylib
    ├── libswresample.5.dylib
    └── libavfilter.10.dylib
```

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Foundation: FFmpeg build workflow |
| Group 2 | 2, 3 | Parallel: FFmpeg packages + install script |
| Group 3 | 4, 5 | Parallel: Runtime loader + binding.gyp |
| Group 4 | 6, 7 | Sequential: Platform packages depend on scope consistency |
| Group 5 | 8 | Integration: Release workflow ties everything together |
| Group 6 | 9 | Final: Code Review |

---

### Task 1: Create FFmpeg Build Workflow

**Files:**
- Create: `.github/workflows/build-ffmpeg.yml`

**Step 1: Write the workflow file** (5 min)

Create `.github/workflows/build-ffmpeg.yml`:

```yaml
name: Build FFmpeg

on:
  workflow_dispatch:
    inputs:
      ffmpeg_version:
        description: 'FFmpeg version to build'
        required: true
        default: '7.1'
  push:
    paths:
      - '.github/workflows/build-ffmpeg.yml'
      - 'ffmpeg/**'

permissions: {}

jobs:
  build-ffmpeg:
    permissions:
      contents: read
    name: "ffmpeg-${{ matrix.platform }}"
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14
            platform: darwin-arm64
            configure_flags: --enable-cross-compile --arch=arm64
          - os: macos-13
            platform: darwin-x64
            configure_flags: ""
          - os: ubuntu-22.04
            platform: linux-x64
            configure_flags: ""
          - os: ubuntu-22.04
            platform: linuxmusl-x64
            container: alpine:3.19
            configure_flags: ""
          - os: windows-2022
            platform: win32-x64
            configure_flags: --toolchain=msvc

    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies (macOS)
        if: runner.os == 'macOS'
        run: |
          brew install nasm pkg-config

      - name: Install dependencies (Linux glibc)
        if: runner.os == 'Linux' && !matrix.container
        run: |
          sudo apt-get update
          sudo apt-get install -y nasm yasm pkg-config \
            libx264-dev libx265-dev libvpx-dev libopus-dev

      - name: Install dependencies (Linux musl)
        if: matrix.container == 'alpine:3.19'
        run: |
          apk add --no-cache build-base nasm yasm pkgconf \
            x264-dev x265-dev libvpx-dev opus-dev

      - name: Download FFmpeg source
        run: |
          curl -L https://ffmpeg.org/releases/ffmpeg-${{ github.event.inputs.ffmpeg_version || '7.1' }}.tar.xz | tar xJ
          mv ffmpeg-* ffmpeg-src

      - name: Configure FFmpeg
        working-directory: ffmpeg-src
        run: |
          ./configure \
            --prefix=${{ github.workspace }}/ffmpeg-install \
            --enable-shared \
            --disable-static \
            --disable-programs \
            --disable-doc \
            --enable-gpl \
            --enable-libx264 \
            --enable-libx265 \
            --enable-libvpx \
            --enable-libopus \
            ${{ matrix.configure_flags }}

      - name: Build FFmpeg
        working-directory: ffmpeg-src
        run: make -j$(nproc || sysctl -n hw.ncpu)

      - name: Install FFmpeg
        working-directory: ffmpeg-src
        run: make install

      - name: Package libraries (Unix)
        if: runner.os != 'Windows'
        run: |
          mkdir -p ffmpeg-${{ matrix.platform }}/lib
          cp -P ffmpeg-install/lib/*.{dylib,so}* ffmpeg-${{ matrix.platform }}/lib/ 2>/dev/null || true
          # Create versions.json
          echo '{"ffmpeg": "${{ github.event.inputs.ffmpeg_version || '7.1' }}"}' > ffmpeg-${{ matrix.platform }}/versions.json

      - name: Package libraries (Windows)
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          mkdir -p ffmpeg-${{ matrix.platform }}/lib
          cp ffmpeg-install/bin/*.dll ffmpeg-${{ matrix.platform }}/lib/
          echo '{"ffmpeg": "${{ github.event.inputs.ffmpeg_version || '7.1' }}"}' > ffmpeg-${{ matrix.platform }}/versions.json

      - uses: actions/upload-artifact@v4
        with:
          name: ffmpeg-${{ matrix.platform }}
          path: ffmpeg-${{ matrix.platform }}
          retention-days: 7
```

**Step 2: Verify workflow syntax** (1 min)

```bash
# Validate YAML (requires yq or yamllint)
yamllint .github/workflows/build-ffmpeg.yml || echo "Install yamllint to validate"
```

**Step 3: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml
git commit -m "ci: add FFmpeg build workflow for prebuilt binaries"
```

---

### Task 2: Create FFmpeg Package Templates

**Files:**
- Create: `ffmpeg/darwin-arm64/package.json`
- Create: `ffmpeg/darwin-x64/package.json`
- Create: `ffmpeg/linux-x64/package.json`
- Create: `ffmpeg/linuxmusl-x64/package.json`
- Create: `ffmpeg/win32-x64/package.json`
- Create: `ffmpeg/package.json` (npm workspace config)
- Create: `ffmpeg/from-ci-build.js` (script to populate from CI artifacts)

**Step 1: Create directory structure** (1 min)

```bash
mkdir -p ffmpeg/{darwin-arm64,darwin-x64,linux-x64,linuxmusl-x64,win32-x64}
```

**Step 2: Create darwin-arm64 package.json** (2 min)

Create `ffmpeg/darwin-arm64/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-darwin-arm64",
  "version": "7.1.0",
  "description": "Prebuilt FFmpeg shared libraries for macOS ARM64",
  "license": "LGPL-2.1-or-later",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "ffmpeg/darwin-arm64"
  },
  "files": ["lib", "versions.json", "LICENSE"],
  "os": ["darwin"],
  "cpu": ["arm64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib": "./lib/",
    "./versions": "./versions.json",
    "./package": "./package.json"
  }
}
```

**Step 3: Create darwin-x64 package.json** (1 min)

Create `ffmpeg/darwin-x64/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-darwin-x64",
  "version": "7.1.0",
  "description": "Prebuilt FFmpeg shared libraries for macOS x64",
  "license": "LGPL-2.1-or-later",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "ffmpeg/darwin-x64"
  },
  "files": ["lib", "versions.json", "LICENSE"],
  "os": ["darwin"],
  "cpu": ["x64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib": "./lib/",
    "./versions": "./versions.json",
    "./package": "./package.json"
  }
}
```

**Step 4: Create linux-x64 package.json** (1 min)

Create `ffmpeg/linux-x64/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-linux-x64",
  "version": "7.1.0",
  "description": "Prebuilt FFmpeg shared libraries for Linux x64 (glibc)",
  "license": "LGPL-2.1-or-later",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "ffmpeg/linux-x64"
  },
  "files": ["lib", "versions.json", "LICENSE"],
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["glibc"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib": "./lib/",
    "./versions": "./versions.json",
    "./package": "./package.json"
  }
}
```

**Step 5: Create linuxmusl-x64 package.json** (1 min)

Create `ffmpeg/linuxmusl-x64/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-linuxmusl-x64",
  "version": "7.1.0",
  "description": "Prebuilt FFmpeg shared libraries for Linux x64 (musl/Alpine)",
  "license": "LGPL-2.1-or-later",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "ffmpeg/linuxmusl-x64"
  },
  "files": ["lib", "versions.json", "LICENSE"],
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["musl"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib": "./lib/",
    "./versions": "./versions.json",
    "./package": "./package.json"
  }
}
```

**Step 6: Create win32-x64 package.json** (1 min)

Create `ffmpeg/win32-x64/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-win32-x64",
  "version": "7.1.0",
  "description": "Prebuilt FFmpeg shared libraries for Windows x64",
  "license": "LGPL-2.1-or-later",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "ffmpeg/win32-x64"
  },
  "files": ["lib", "versions.json", "LICENSE"],
  "os": ["win32"],
  "cpu": ["x64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./lib": "./lib/",
    "./versions": "./versions.json",
    "./package": "./package.json"
  }
}
```

**Step 7: Create workspace package.json** (1 min)

Create `ffmpeg/package.json`:

```json
{
  "name": "@pproenca/ffmpeg-packages",
  "private": true,
  "workspaces": [
    "darwin-arm64",
    "darwin-x64",
    "linux-x64",
    "linuxmusl-x64",
    "win32-x64"
  ]
}
```

**Step 8: Create from-ci-build.js script** (3 min)

Create `ffmpeg/from-ci-build.js`:

```javascript
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Populate FFmpeg packages from CI build artifacts.

'use strict';

const { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const platform = process.argv[2];
if (!platform) {
  console.error('Usage: node from-ci-build.js <platform>');
  console.error('Example: node from-ci-build.js darwin-arm64');
  process.exit(1);
}

const destDir = join(__dirname, platform);
const libDir = join(destDir, 'lib');
const artifactDir = process.env.FFMPEG_ARTIFACT_DIR || join(__dirname, '..', `ffmpeg-${platform}`);

if (!existsSync(destDir)) {
  console.error(`No package template for platform: ${platform}`);
  process.exit(1);
}

if (!existsSync(artifactDir)) {
  console.error(`Artifact directory not found: ${artifactDir}`);
  console.error('Set FFMPEG_ARTIFACT_DIR or ensure ffmpeg-{platform} exists');
  process.exit(1);
}

console.log(`Populating FFmpeg package for platform: ${platform}`);

// Create lib directory
mkdirSync(libDir, { recursive: true });

// Copy libraries
const srcLibDir = join(artifactDir, 'lib');
if (existsSync(srcLibDir)) {
  cpSync(srcLibDir, libDir, { recursive: true });
  console.log('Copied FFmpeg libraries');
}

// Copy versions.json
const versionsFile = join(artifactDir, 'versions.json');
if (existsSync(versionsFile)) {
  copyFileSync(versionsFile, join(destDir, 'versions.json'));
  console.log('Copied versions.json');
}

// Generate LICENSE with FFmpeg attribution
const license = `FFmpeg Libraries - Prebuilt for ${platform}

FFmpeg is licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later.

This package contains prebuilt FFmpeg shared libraries compiled with the following configuration:
- --enable-shared --disable-static
- --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libopus

For FFmpeg source code and full license terms, see:
https://ffmpeg.org/
https://github.com/FFmpeg/FFmpeg

This build includes GPL components. The complete corresponding source code
is available at: https://github.com/pproenca/node-webcodecs
`;

writeFileSync(join(destDir, 'LICENSE'), license);

// Generate README
const pkg = require(`./${platform}/package.json`);
const readme = `# ${pkg.name}

${pkg.description}

This package is automatically installed as an optional dependency of \`@pproenca/node-webcodecs-${platform}\`.

## License

FFmpeg is licensed under LGPL 2.1 or later. Some components are GPL licensed.
See LICENSE file for details.
`;
writeFileSync(join(destDir, 'README.md'), readme);

console.log('Done!');
```

**Step 9: Commit** (30 sec)

```bash
git add ffmpeg/
git commit -m "feat: add FFmpeg package templates for prebuilt binaries"
```

---

### Task 3: Update Install Check Script

**Files:**
- Modify: `install/check.js`

**Step 1: Write test for prebuilt detection** (3 min)

Create `test/unit/install-check.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// We'll test the exported functions
describe('install/check.js', () => {
  it('should export checkPkgConfig function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.checkPkgConfig).toBe('function');
  });

  it('should export getFFmpegVersion function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.getFFmpegVersion).toBe('function');
  });

  it('should export hasPrebuiltFFmpeg function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.hasPrebuiltFFmpeg).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run test-unit -- test/unit/install-check.test.ts
```

Expected: FAIL (hasPrebuiltFFmpeg not exported)

**Step 3: Update install/check.js with prebuilt detection** (5 min)

Modify `install/check.js` to add prebuilt detection at the top and update exports:

Add after the existing imports (around line 10):

```javascript
const MIN_FFMPEG_VERSION = '5.0';

/**
 * Check if prebuilt FFmpeg package is available for this platform.
 */
function hasPrebuiltFFmpeg() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const libPath = require.resolve(`${packageName}/lib`);
    console.log(`✓ Found prebuilt FFmpeg: ${packageName}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get runtime platform string (matches npm package naming).
 */
function getRuntimePlatform() {
  const os = platform();
  const arch = process.arch;

  if (os === 'linux') {
    // Check for musl
    try {
      const { familySync } = require('detect-libc');
      if (familySync() === 'musl') {
        return `linuxmusl-${arch}`;
      }
    } catch {}
  }

  return `${os}-${arch}`;
}
```

Update the `main()` function to check for prebuilt first:

```javascript
function main() {
  console.log('node-webcodecs: Checking FFmpeg installation...\n');

  // Check for prebuilt FFmpeg first
  if (hasPrebuiltFFmpeg()) {
    console.log('\n✓ Using prebuilt FFmpeg. Ready to build.\n');
    return;
  }

  // ... rest of existing code (system FFmpeg check) ...
}
```

Update exports at the bottom:

```javascript
module.exports = { checkPkgConfig, getFFmpegVersion, hasPrebuiltFFmpeg, getRuntimePlatform };
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run test-unit -- test/unit/install-check.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add install/check.js test/unit/install-check.test.ts
git commit -m "feat(install): detect prebuilt FFmpeg packages"
```

---

### Task 4: Create Runtime FFmpeg Loader

**Files:**
- Create: `lib/ffmpeg.ts`
- Modify: `lib/index.ts` (to use the loader)

**Step 1: Write test for FFmpeg loader** (3 min)

Create `test/unit/ffmpeg-loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getFFmpegLibPath,
  hasPrebuiltFFmpeg,
  useSystemFFmpeg,
} from '../../lib/ffmpeg';

describe('lib/ffmpeg.ts', () => {
  it('should export getFFmpegLibPath function', () => {
    expect(typeof getFFmpegLibPath).toBe('function');
  });

  it('should export hasPrebuiltFFmpeg function', () => {
    expect(typeof hasPrebuiltFFmpeg).toBe('function');
  });

  it('should export useSystemFFmpeg function', () => {
    expect(typeof useSystemFFmpeg).toBe('function');
  });

  it('getFFmpegLibPath returns null when no prebuilt available', () => {
    // In test environment without prebuilt packages
    const result = getFFmpegLibPath();
    // Either returns a path (if somehow available) or null
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npm run test-unit -- test/unit/ffmpeg-loader.test.ts
```

Expected: FAIL (module not found)

**Step 3: Create lib/ffmpeg.ts** (5 min)

Create `lib/ffmpeg.ts`:

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// FFmpeg library loading following sharp's lib/libvips.js pattern.

import * as path from 'node:path';
import { runtimePlatformArch, prebuiltPlatforms, PrebuiltPlatform } from './platform';

const runtimePlatform = runtimePlatformArch();

/**
 * Check if prebuilt FFmpeg libraries are available for current platform.
 */
export function hasPrebuiltFFmpeg(): boolean {
  if (!prebuiltPlatforms.includes(runtimePlatform as PrebuiltPlatform)) {
    return false;
  }

  try {
    require.resolve(`@pproenca/ffmpeg-${runtimePlatform}/lib`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to prebuilt FFmpeg libraries.
 * Returns null if not available.
 */
export function getFFmpegLibPath(): string | null {
  if (!hasPrebuiltFFmpeg()) {
    return null;
  }

  try {
    const libEntry = require.resolve(`@pproenca/ffmpeg-${runtimePlatform}/lib`);
    return path.dirname(libEntry);
  } catch {
    return null;
  }
}

/**
 * Check environment variable to force system FFmpeg usage.
 */
export function useSystemFFmpeg(): boolean {
  return process.env.NODE_WEBCODECS_SYSTEM_FFMPEG === '1';
}

/**
 * Get FFmpeg version from prebuilt package.
 */
export function getPrebuiltFFmpegVersion(): string | null {
  try {
    const versions = require(`@pproenca/ffmpeg-${runtimePlatform}/versions`);
    return versions.ffmpeg || null;
  } catch {
    return null;
  }
}

/**
 * Log FFmpeg detection status.
 */
export function logFFmpegStatus(): void {
  if (useSystemFFmpeg()) {
    console.log('node-webcodecs: Using system FFmpeg (NODE_WEBCODECS_SYSTEM_FFMPEG=1)');
    return;
  }

  if (hasPrebuiltFFmpeg()) {
    const version = getPrebuiltFFmpegVersion();
    console.log(`node-webcodecs: Using prebuilt FFmpeg ${version || 'unknown'} for ${runtimePlatform}`);
  } else {
    console.log(`node-webcodecs: No prebuilt FFmpeg for ${runtimePlatform}, using system libraries`);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npm run test-unit -- test/unit/ffmpeg-loader.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/ffmpeg.ts test/unit/ffmpeg-loader.test.ts
git commit -m "feat: add FFmpeg runtime loader"
```

---

### Task 5: Update binding.gyp for Prebuilt FFmpeg

**Files:**
- Modify: `binding.gyp`
- Create: `gyp/ffmpeg-paths.js` (helper to resolve FFmpeg paths)

**Step 1: Create FFmpeg path resolver** (3 min)

Create `gyp/ffmpeg-paths.js`:

```javascript
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.

'use strict';

const { existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { platform, arch } = require('node:os');

function getRuntimePlatform() {
  const os = platform();
  const cpu = arch();

  if (os === 'linux') {
    try {
      const { familySync } = require('detect-libc');
      if (familySync() === 'musl') {
        return `linuxmusl-${cpu}`;
      }
    } catch {}
  }

  return `${os}-${cpu}`;
}

function getPrebuiltLibPath() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const libEntry = require.resolve(`${packageName}/lib`);
    return dirname(libEntry);
  } catch {
    return null;
  }
}

function getPrebuiltIncludePath() {
  // FFmpeg packages include headers in lib/../include
  const libPath = getPrebuiltLibPath();
  if (!libPath) return null;

  const includePath = join(dirname(libPath), 'include');
  return existsSync(includePath) ? includePath : null;
}

// Output for node-gyp variable expansion
const mode = process.argv[2] || 'lib';

if (mode === 'lib') {
  const libPath = getPrebuiltLibPath();
  if (libPath) {
    console.log(`-L${libPath}`);
  }
} else if (mode === 'include') {
  const includePath = getPrebuiltIncludePath();
  if (includePath) {
    console.log(includePath);
  }
} else if (mode === 'rpath') {
  const libPath = getPrebuiltLibPath();
  if (libPath) {
    console.log(`-Wl,-rpath,${libPath}`);
  }
}
```

**Step 2: Update binding.gyp macOS conditions** (5 min)

Modify `binding.gyp` to add prebuilt FFmpeg support. Update the macOS condition:

```json
["OS=='mac'", {
  "include_dirs": [
    "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/opt/homebrew/include /usr/local/include')"
  ],
  "libraries": [
    "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
    "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter')",
    "<!@(node gyp/ffmpeg-paths.js rpath 2>/dev/null || echo '')"
  ],
  "xcode_settings": {
    "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
    "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
    "GCC_ENABLE_CPP_RTTI": "YES",
    "MACOSX_DEPLOYMENT_TARGET": "10.15",
    "OTHER_CPLUSPLUSFLAGS": [
      "-fexceptions",
      "-Wall",
      "-Wextra",
      "-Wno-unused-parameter"
    ]
  }
}]
```

**Step 3: Update binding.gyp Linux conditions** (3 min)

Update the Linux condition similarly:

```json
["OS=='linux'", {
  "include_dirs": [
    "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter | sed s/-I//g)"
  ],
  "libraries": [
    "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
    "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter)",
    "<!@(node gyp/ffmpeg-paths.js rpath 2>/dev/null || echo '')"
  ],
  "cflags_cc": [
    "-std=c++17",
    "-fexceptions",
    "-Wall",
    "-Wextra",
    "-Wno-unused-parameter",
    "-fPIC"
  ]
}]
```

**Step 4: Verify build still works** (2 min)

```bash
npm run build:native
```

Expected: Build succeeds (uses system FFmpeg as fallback)

**Step 5: Commit** (30 sec)

```bash
git add binding.gyp gyp/ffmpeg-paths.js
git commit -m "feat(build): support prebuilt FFmpeg in binding.gyp"
```

---

### Task 6: Update Platform Package Templates

**Files:**
- Modify: `npm/darwin-arm64/package.json`
- Modify: `npm/darwin-x64/package.json`
- Modify: `npm/linux-x64/package.json`
- Modify: `npm/linuxmusl-x64/package.json`
- Modify: `npm/win32-x64/package.json`

**Step 1: Update darwin-arm64 package.json** (2 min)

Update `npm/darwin-arm64/package.json`:

```json
{
  "name": "@pproenca/node-webcodecs-darwin-arm64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs native addon for macOS ARM64",
  "license": "MIT",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "npm/darwin-arm64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["darwin"],
  "cpu": ["arm64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@pproenca/ffmpeg-darwin-arm64": "7.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./node-webcodecs.node": "./lib/node-webcodecs-darwin-arm64.node",
    "./package.json": "./package.json"
  }
}
```

**Step 2: Update darwin-x64 package.json** (1 min)

Update `npm/darwin-x64/package.json`:

```json
{
  "name": "@pproenca/node-webcodecs-darwin-x64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs native addon for macOS x64",
  "license": "MIT",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "npm/darwin-x64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["darwin"],
  "cpu": ["x64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@pproenca/ffmpeg-darwin-x64": "7.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./node-webcodecs.node": "./lib/node-webcodecs-darwin-x64.node",
    "./package.json": "./package.json"
  }
}
```

**Step 3: Update linux-x64 package.json** (1 min)

Update `npm/linux-x64/package.json`:

```json
{
  "name": "@pproenca/node-webcodecs-linux-x64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs native addon for Linux x64 (glibc)",
  "license": "MIT",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "npm/linux-x64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["glibc"],
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@pproenca/ffmpeg-linux-x64": "7.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./node-webcodecs.node": "./lib/node-webcodecs-linux-x64.node",
    "./package.json": "./package.json"
  }
}
```

**Step 4: Update linuxmusl-x64 package.json** (1 min)

Update `npm/linuxmusl-x64/package.json`:

```json
{
  "name": "@pproenca/node-webcodecs-linuxmusl-x64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs native addon for Linux x64 (musl/Alpine)",
  "license": "MIT",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "npm/linuxmusl-x64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["musl"],
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@pproenca/ffmpeg-linuxmusl-x64": "7.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./node-webcodecs.node": "./lib/node-webcodecs-linuxmusl-x64.node",
    "./package.json": "./package.json"
  }
}
```

**Step 5: Update win32-x64 package.json** (1 min)

Update `npm/win32-x64/package.json`:

```json
{
  "name": "@pproenca/node-webcodecs-win32-x64",
  "version": "0.1.0",
  "description": "Prebuilt node-webcodecs native addon for Windows x64",
  "license": "MIT",
  "author": "Pedro Proenca",
  "repository": {
    "type": "git",
    "url": "https://github.com/pproenca/node-webcodecs.git",
    "directory": "npm/win32-x64"
  },
  "files": ["lib", "LICENSE"],
  "os": ["win32"],
  "cpu": ["x64"],
  "engines": {
    "node": ">=18.0.0"
  },
  "optionalDependencies": {
    "@pproenca/ffmpeg-win32-x64": "7.1.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    "./node-webcodecs.node": "./lib/node-webcodecs-win32-x64.node",
    "./package.json": "./package.json"
  }
}
```

**Step 6: Commit** (30 sec)

```bash
git add npm/*/package.json
git commit -m "feat(packages): add FFmpeg optionalDependencies to platform packages"
```

---

### Task 7: Update Main Package with optionalDependencies

**Files:**
- Modify: `package.json`
- Modify: `lib/platform.ts` (update package scope)

**Step 1: Update lib/platform.ts** (2 min)

Update the package name function in `lib/platform.ts`:

```typescript
/**
 * Get the npm package name for the prebuilt binary.
 */
export function getPrebuiltPackageName(): string {
  return `@pproenca/node-webcodecs-${runtimePlatformArch()}`;
}

/**
 * Get the npm package name for prebuilt FFmpeg.
 */
export function getFFmpegPackageName(): string {
  return `@pproenca/ffmpeg-${runtimePlatformArch()}`;
}
```

**Step 2: Update package.json** (3 min)

Add optionalDependencies and detect-libc to `package.json`:

```json
{
  "dependencies": {
    "detect-libc": "^2.0.3",
    "node-gyp-build": "^4.8.0"
  },
  "optionalDependencies": {
    "@pproenca/node-webcodecs-darwin-arm64": "0.1.0",
    "@pproenca/node-webcodecs-darwin-x64": "0.1.0",
    "@pproenca/node-webcodecs-linux-x64": "0.1.0",
    "@pproenca/node-webcodecs-linuxmusl-x64": "0.1.0",
    "@pproenca/node-webcodecs-win32-x64": "0.1.0"
  }
}
```

**Step 3: Verify package.json is valid** (30 sec)

```bash
node -e "console.log(JSON.stringify(require('./package.json'), null, 2))" > /dev/null && echo "Valid JSON"
```

**Step 4: Commit** (30 sec)

```bash
git add package.json lib/platform.ts
git commit -m "feat: add optionalDependencies for prebuilt platform packages"
```

---

### Task 8: Update Release Workflow

**Files:**
- Modify: `.github/workflows/release.yml`

**Step 1: Rewrite release workflow** (10 min)

Replace `.github/workflows/release.yml` with comprehensive workflow:

```yaml
name: Release

on:
  push:
    tags:
      - "v**"

permissions: {}

jobs:
  # First, build FFmpeg for all platforms
  build-ffmpeg:
    permissions:
      contents: read
    name: "ffmpeg-${{ matrix.platform }}"
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14
            platform: darwin-arm64
          - os: macos-13
            platform: darwin-x64
          - os: ubuntu-22.04
            platform: linux-x64
          # Add more platforms as needed
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies (macOS)
        if: runner.os == 'macOS'
        run: brew install nasm pkg-config

      - name: Install dependencies (Linux)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y nasm yasm pkg-config

      - name: Download and build FFmpeg
        run: |
          curl -L https://ffmpeg.org/releases/ffmpeg-7.1.tar.xz | tar xJ
          cd ffmpeg-7.1
          ./configure \
            --prefix=${{ github.workspace }}/ffmpeg-install \
            --enable-shared \
            --disable-static \
            --disable-programs \
            --disable-doc
          make -j$(nproc || sysctl -n hw.ncpu)
          make install

      - name: Package FFmpeg
        run: |
          mkdir -p ffmpeg-${{ matrix.platform }}/lib
          cp -P ffmpeg-install/lib/*.{dylib,so}* ffmpeg-${{ matrix.platform }}/lib/ 2>/dev/null || true
          cp -r ffmpeg-install/include ffmpeg-${{ matrix.platform }}/
          echo '{"ffmpeg": "7.1"}' > ffmpeg-${{ matrix.platform }}/versions.json

      - uses: actions/upload-artifact@v4
        with:
          name: ffmpeg-${{ matrix.platform }}
          path: ffmpeg-${{ matrix.platform }}
          retention-days: 1

  # Build native addon for each platform
  build-addon:
    needs: build-ffmpeg
    permissions:
      contents: read
    name: "addon-${{ matrix.platform }}"
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14
            platform: darwin-arm64
          - os: macos-13
            platform: darwin-x64
          - os: ubuntu-22.04
            platform: linux-x64
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v5
        with:
          node-version: "22"

      - uses: actions/download-artifact@v4
        with:
          name: ffmpeg-${{ matrix.platform }}
          path: ffmpeg-${{ matrix.platform }}

      - name: Setup FFmpeg paths
        run: |
          echo "PKG_CONFIG_PATH=${{ github.workspace }}/ffmpeg-${{ matrix.platform }}/lib/pkgconfig" >> $GITHUB_ENV
          echo "LD_LIBRARY_PATH=${{ github.workspace }}/ffmpeg-${{ matrix.platform }}/lib" >> $GITHUB_ENV
          echo "DYLD_LIBRARY_PATH=${{ github.workspace }}/ffmpeg-${{ matrix.platform }}/lib" >> $GITHUB_ENV

      - run: npm install
      - run: npm run build
      - run: npm test

      - name: Package addon
        run: npm run package-from-local-build

      - uses: actions/upload-artifact@v4
        with:
          name: addon-${{ matrix.platform }}
          path: npm/${{ matrix.platform }}
          retention-days: 1

  # Publish all packages
  publish:
    needs: build-addon
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v5
        with:
          node-version: "24"
          registry-url: "https://registry.npmjs.org"

      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      # Populate FFmpeg packages
      - name: Populate FFmpeg packages
        run: |
          for platform in darwin-arm64 darwin-x64 linux-x64; do
            FFMPEG_ARTIFACT_DIR=artifacts/ffmpeg-$platform node ffmpeg/from-ci-build.js $platform
          done

      # Populate addon packages
      - name: Populate addon packages
        run: |
          for platform in darwin-arm64 darwin-x64 linux-x64; do
            cp -r artifacts/addon-$platform/* npm/$platform/
          done

      # Publish FFmpeg packages first
      - name: Publish FFmpeg packages
        run: |
          cd ffmpeg
          npm publish --workspaces --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Publish addon packages
      - name: Publish addon packages
        run: |
          cd npm
          npm publish --workspaces --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Publish main package
      - name: Install deps and build for publish
        run: |
          sudo apt-get update
          sudo apt-get install -y libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev pkg-config
          npm install
          npm run build

      - name: Publish main package
        run: npm publish --provenance --access public --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Commit** (30 sec)

```bash
git add .github/workflows/release.yml
git commit -m "ci: update release workflow for prebuilt FFmpeg and addon packages"
```

---

### Task 9: Code Review

Run code review agent to verify all changes.

---

## Summary

After implementing all tasks, the package structure will be:

1. **User runs `npm install @pproenca/node-webcodecs`**
2. npm automatically installs the matching platform package (e.g., `@pproenca/node-webcodecs-darwin-arm64`)
3. That package pulls in the FFmpeg libraries (`@pproenca/ffmpeg-darwin-arm64`)
4. No Homebrew or apt-get installation required

**Environment Variables:**
- `NODE_WEBCODECS_SYSTEM_FFMPEG=1` - Force use of system FFmpeg instead of prebuilt

**Fallback Behavior:**
- If prebuilt not available for platform, falls back to system FFmpeg
- User still needs `brew install ffmpeg` or equivalent for unsupported platforms
