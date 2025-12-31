# Sharp Quality Bar Adoption Design (v2)

## Overview

Comprehensive pass to match lovell/sharp's production quality bar.

**Scope:** Full platform matrix CI, release automation, install infrastructure, package polish.

**User Selections:**
- License: MIT (add LICENSE file)
- CI matrix: Full sharp-style (~20 jobs covering Linux/macOS/Windows × Node 18/20/22)
- Release automation: Yes (npm publish on v* tags)

---

## Part 1: File Cleanup and Consolidation

### Current State (node-webcodecs)

```
node-webcodecs/
├── CLAUDE.md          # Claude Code instructions (keep)
├── Makefile           # References cmake-js (outdated - uses node-gyp now)
├── plan.md            # Orphaned compliance plan
├── progress.txt       # Orphaned progress notes
├── TODO.md            # Orphaned TODO list
├── SECURITY.md        # Good (keep)
├── binding.gyp        # Native build config (keep)
├── tsconfig.json      # TypeScript config (keep)
├── eslint.config.js   # Linting config (keep)
├── eslint.ignores.js  # Linting ignores (keep)
├── .prettierrc.js     # Formatter config (keep)
├── .clang-format      # C++ formatter config (keep)
├── .clang-tidy        # C++ linting config (keep)
├── .c8rc.json         # Coverage config (keep)
├── webcodecs.idl      # Reference spec (keep)
└── docs/plans/        # 24+ plan files (review needed)
```

### Target State (sharp pattern)

```
node-webcodecs/
├── README.md           # Professional README with badges, examples
├── LICENSE             # License file
├── CONTRIBUTING.md     # Contribution guide (link to .github)
├── package.json        # Consolidated scripts
├── binding.gyp         # Native build config
├── tsconfig.json       # TypeScript config
├── biome.json          # Biome replaces eslint+prettier (sharp uses biome)
├── .clang-format       # C++ formatter
├── CLAUDE.md           # Claude instructions (project-specific)
├── webcodecs.idl       # Reference spec
├── docs/               # Documentation
│   └── api/            # Generated API docs
├── install/            # Install scripts
├── lib/                # TypeScript source
├── src/                # C++ source
├── test/               # Tests
└── npm/                # Platform packages (from prebuilts plan)
```

### Files to Remove

| File | Reason |
|------|--------|
| `Makefile` | References cmake-js but project uses node-gyp. npm scripts sufficient. |
| `plan.md` | Content moved to `docs/plans/`. Delete after review. |
| `progress.txt` | Transient session notes. Delete. |
| `TODO.md` | Items mostly complete. Consolidate remaining to GitHub Issues. |
| `eslint.config.js` | Replace with biome.json (sharper, faster) |
| `eslint.ignores.js` | Replace with biome.json |
| `.prettierrc.js` | Replace with biome.json |
| `.c8rc.json` | Vitest has built-in coverage; consolidate config |

### Consolidation Actions

1. **Migrate eslint+prettier to biome** (matches sharp pattern)
2. **Move plan.md content to docs/plans/** if not already captured
3. **Create GitHub Issues from TODO.md** then delete
4. **Remove Makefile** (npm scripts already cover all commands)

---

## Part 2: Package.json Cleanup

### Current State

```json
{
  "scripts": {
    "install": "node install/check.js && (node-gyp-build || npm run build:native)",
    "build": "npm run build:native && npm run build:ts",
    "build:native": "node-gyp rebuild",
    "build:native:debug": "node-gyp rebuild --debug",
    "build:ts": "tsc",
    "rebuild": "npm run clean && npm run build",
    "clean": "node-gyp clean && rm -rf dist",
    "test": "vitest run --config test/vitest.config.ts",
    "test:stress": "vitest run test/stress/ --config test/vitest.config.ts",
    "test:coverage:js": "c8 npm test",
    "coverage": "npm run test:coverage:js && c8 report --reporter=html",
    "bench": "npx tsx bench/index.ts",
    "bench:gc": "node --expose-gc --import tsx bench/index.ts",
    "lint": "gts lint",
    "fix": "gts fix",
    "typecheck": "tsc --noEmit"
  }
}
```

### Target State (sharp-inspired)

```json
{
  "scripts": {
    "install": "node install/check.js || npm run build",
    "build": "node-gyp rebuild && tsc",
    "clean": "rm -rf build/ dist/",
    "test": "npm run lint && npm run test-unit",
    "test-unit": "vitest run",
    "test-stress": "vitest run test/stress/",
    "lint": "npm run lint-cpp && npm run lint-js && npm run lint-types",
    "lint-cpp": "cpplint --quiet src/*.h src/*.cc",
    "lint-js": "biome lint",
    "lint-types": "tsd --files ./test/types/index.test-d.ts",
    "docs-build": "typedoc --out docs/api lib/index.ts",
    "prepublishOnly": "npm run clean && npm run build && npm test"
  }
}
```

### Key Changes

1. **Flatten scripts** - Remove redundant `build:native`, `build:ts` splits
2. **Add `prepublishOnly`** - Ensures tests pass before publishing
3. **Separate lint commands** - Following sharp: `lint-cpp`, `lint-js`, `lint-types`
4. **Add `docs-build`** - Generate API documentation
5. **Add `lint-types`** - Type definition testing (requires tsd setup)

---

## Part 3: lib/ Directory Organization

### Current State

```
lib/
├── binding.ts              # Native binding loader
├── control-message-queue.ts # Async queue implementation
├── errors.ts               # Error classes
├── image-track-list.ts     # ImageDecoder tracks
├── image-track.ts          # ImageDecoder track
├── index.ts                # Main API (55KB!)
├── is.ts                   # Type guards (already sharp-pattern!)
├── native-types.ts         # Native binding types
├── resource-manager.ts     # Codec lifecycle
└── types.ts                # W3C type definitions
```

### Issues

1. **`lib/index.ts` is 55KB (1600+ lines)** - Too large, should split
2. **Missing TypeScript declaration file** - Should have `lib/index.d.ts`

### Target State (sharp pattern)

Sharp organizes by concern with mixin pattern:

```javascript
// sharp/lib/index.js (15 lines!)
const Sharp = require('./constructor');
require('./input')(Sharp);
require('./resize')(Sharp);
require('./composite')(Sharp);
require('./operation')(Sharp);
require('./colour')(Sharp);
require('./channel')(Sharp);
require('./output')(Sharp);
require('./utility')(Sharp);
module.exports = Sharp;
```

### Recommended Split for node-webcodecs

```
lib/
├── index.ts                # Entry point, exports all (small)
├── binding.ts              # Native loader (keep)
├── is.ts                   # Type guards (keep)
├── types.ts                # W3C types (keep)
├── errors.ts               # Errors (keep)
├── control-message-queue.ts # Queue (keep)
├── resource-manager.ts     # Lifecycle (keep)
├── native-types.ts         # Native types (keep)
├── video-encoder.ts        # VideoEncoder class
├── video-decoder.ts        # VideoDecoder class
├── audio-encoder.ts        # AudioEncoder class
├── audio-decoder.ts        # AudioDecoder class
├── video-frame.ts          # VideoFrame class
├── audio-data.ts           # AudioData class
├── encoded-chunks.ts       # EncodedVideoChunk, EncodedAudioChunk
├── image-decoder.ts        # ImageDecoder class
├── image-track.ts          # ImageTrack, ImageTrackList (keep)
└── codec-base.ts           # Shared CodecBase class
```

New `lib/index.ts` (after split):

```typescript
// lib/index.ts - Entry point only
export {VideoEncoder} from './video-encoder';
export {VideoDecoder} from './video-decoder';
export {AudioEncoder} from './audio-encoder';
export {AudioDecoder} from './audio-decoder';
export {VideoFrame} from './video-frame';
export {AudioData} from './audio-data';
export {EncodedVideoChunk, EncodedAudioChunk} from './encoded-chunks';
export {ImageDecoder} from './image-decoder';
export {ImageTrack, ImageTrackList} from './image-track';
export * from './types';
```

---

## Part 4: Documentation

### Current State

- No README.md (critical!)
- No API documentation
- No CONTRIBUTING.md
- No examples in README

### Target State (sharp pattern)

**README.md structure:**

```markdown
# node-webcodecs

<img src="logo.svg" width="160" height="160" alt="logo" align="right">

W3C WebCodecs API implementation for Node.js using FFmpeg.
Encode and decode video/audio with hardware acceleration support.

## Features

- H.264, H.265/HEVC, VP8, VP9, AV1 video codecs
- AAC, Opus, MP3 audio codecs
- Full WebCodecs API compliance
- Async/await and callback patterns
- Stream support
- Cross-platform (macOS, Linux, Windows)

## Installation

```sh
npm install node-webcodecs
```

Most macOS/Linux systems work out of the box. See [installation docs](docs/install.md) for details.

## Examples

### Encode video frames
[code example]

### Decode video chunks
[code example]

### Process with streams
[code example]

## Documentation

- [API Reference](https://...)
- [Installation Guide](docs/install.md)
- [Examples](examples/)
- [Changelog](CHANGELOG.md)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md)

## License

MIT © [Your Name]
```

**CONTRIBUTING.md (in .github/):**

- How to submit bugs
- How to submit features
- How to run tests
- Code style guidelines
- PR guidelines

**API Documentation:**

Generate with TypeDoc from JSDoc comments.

---

## Part 5: Type Definition Testing

### Sharp Pattern

Sharp uses `tsd` to test TypeScript declarations:

```typescript
// test/types/sharp.test-d.ts
import {expectType, expectError} from 'tsd';
import sharp from 'sharp';

expectType<sharp.Sharp>(sharp('input.jpg'));
expectError(sharp(123)); // Should error
```

### Recommended for node-webcodecs

```typescript
// test/types/index.test-d.ts
import {expectType, expectError} from 'tsd';
import {VideoEncoder, VideoFrame, EncodedVideoChunk} from 'node-webcodecs';

// VideoEncoder
const encoder = new VideoEncoder({
  output: (chunk) => expectType<EncodedVideoChunk>(chunk),
  error: (e) => expectType<Error>(e),
});

expectType<'unconfigured' | 'configured' | 'closed'>(encoder.state);
expectType<number>(encoder.encodeQueueSize);

// VideoFrame
const frame = new VideoFrame(new Uint8Array(100), {
  format: 'RGBA',
  codedWidth: 10,
  codedHeight: 10,
  timestamp: 0,
});

expectType<number>(frame.codedWidth);
expectType<number | null>(frame.duration);

// Should error
expectError(new VideoFrame('invalid'));
expectError(new VideoEncoder({}));
```

---

## Part 6: GitHub Issue Templates

### Sharp Pattern

Sharp has structured issue templates:

```
.github/ISSUE_TEMPLATE/
├── config.yml          # Disable blank issues, link to docs
├── possible-bug.md     # Bug report template
├── installation.md     # Install issues template
├── feature_request.md  # Feature request template
└── question.md         # Question template
```

### Recommended for node-webcodecs

**config.yml:**
```yaml
blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: https://github.com/user/node-webcodecs#readme
    about: Please read the documentation before opening an issue
```

**possible-bug.md:**
```yaml
name: Possible bug
description: Something isn't working as expected
labels: ["triage"]
body:
  - type: checkboxes
    attributes:
      label: Prerequisites
      options:
        - label: I have searched for existing issues
          required: true
        - label: I have read the installation guide
          required: true
  - type: textarea
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. Create VideoEncoder with config...
        2. Encode frames...
        3. See error...
    validations:
      required: true
  - type: textarea
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: textarea
    attributes:
      label: Actual behavior
    validations:
      required: true
  - type: input
    attributes:
      label: Node.js version
      placeholder: "20.10.0"
  - type: input
    attributes:
      label: node-webcodecs version
      placeholder: "0.1.0"
  - type: dropdown
    attributes:
      label: Operating system
      options:
        - macOS
        - Linux (glibc)
        - Linux (musl/Alpine)
        - Windows
```

---

## Part 7: CI/CD Enhancements

### Current State

- Multi-platform build (Ubuntu, macOS)
- Sanitizer builds (ASan, UBSan)
- Static analysis (cppcheck, clang-tidy)
- cpplint

### Missing (vs sharp)

1. **No lint job that runs first** - Sharp runs lint before build
2. **No smoke tests** - Sharp tests npm install across package managers
3. **No release workflow** - Sharp auto-publishes on tag

### Recommended Additions

**1. Add lint-first job:**

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
      - run: npm ci --ignore-scripts
      - run: npm run lint-cpp
      - run: npm run lint-js
      - run: npm run lint-types

  build:
    needs: lint
    # ... existing build job
```

**2. Add npm smoke test workflow (for releases):**

```yaml
# .github/workflows/npm-smoke.yml
name: npm smoke test
on:
  push:
    tags: ['v*']

jobs:
  smoke-test:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            pm: npm
          - os: ubuntu-latest
            pm: pnpm
          - os: macos-latest
            pm: npm
    runs-on: ${{ matrix.os }}
    steps:
      - run: mkdir test && cd test && npm init -y
      - run: cd test && ${{ matrix.pm }} install node-webcodecs@${{ github.ref_name }}
      - run: cd test && node -e "const {VideoEncoder}=require('node-webcodecs');console.log(VideoEncoder)"
```

---

## Part 8: Full CI Platform Matrix

### Sharp's Matrix Strategy

Sharp tests on 20+ platform combinations:

| Platform | Container/Runner | Node Versions |
|----------|------------------|---------------|
| linux-x64 | rockylinux:8 | 18, 20, 22 |
| linux-arm64 | arm64v8/rockylinux:8 | 18, 20 |
| linuxmusl-x64 | node:XX-alpine | 18, 20, 22 |
| linuxmusl-arm64 | node:XX-alpine (ARM) | 18, 20 |
| darwin-x64 | macos-15-intel | 18, 20, 22 |
| darwin-arm64 | macos-15 | 18, 20, 22 |
| win32-x64 | windows-2022 | 18, 20, 22 |
| win32-arm64 | windows-11-arm | 20, 22 |

### FFmpeg Installation Per Platform

| Platform | FFmpeg Install |
|----------|----------------|
| Rocky Linux | `dnf install -y epel-release && dnf install -y ffmpeg-free-devel` |
| Alpine | `apk add ffmpeg-dev` |
| macOS | `brew install ffmpeg` |
| Windows | vcpkg or download prebuilt FFmpeg |

### Recommended node-webcodecs Matrix

Start with essential platforms, expand over time:

**Phase 1 (immediate):**
- linux-x64: Ubuntu 24.04 × Node 18, 20, 22
- darwin-x64: macos-15-intel × Node 18, 20, 22
- darwin-arm64: macos-15 × Node 18, 20, 22

**Phase 2 (after stabilization):**
- win32-x64: windows-2022 × Node 18, 20, 22
- linux-arm64: ubuntu-24.04-arm × Node 18, 20

**Phase 3 (stretch):**
- linuxmusl-x64: Alpine × Node 20, 22
- win32-arm64: windows-11-arm × Node 22

---

## Part 9: Release Automation

### Workflow: .github/workflows/release.yml

```yaml
name: Release

on:
  push:
    tags:
      - "v**"

permissions: {}

jobs:
  build-and-test:
    # Same as ci.yml matrix

  publish:
    needs: build-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Publish to npm
        run: npm publish --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Required Secrets

- `NPM_TOKEN`: npm access token with publish permissions

---

## Part 10: Install Infrastructure

### Current install/check.js

Only checks for FFmpeg presence via pkg-config.

### Enhanced Pattern (from sharp)

```javascript
// install/check.js
try {
  // 1. Check for prebuilt binary
  const binding = require('../build/Release/node_webcodecs.node');
  if (binding) process.exit(0); // Prebuilt found, skip build
} catch {
  // No prebuilt, check for FFmpeg
  const { execSync } = require('child_process');
  try {
    execSync('pkg-config --exists libavcodec', { stdio: 'ignore' });
    process.exit(1); // FFmpeg found, trigger build
  } catch {
    console.error('FFmpeg development libraries not found');
    console.error('See: https://github.com/pproenca/node-webcodecs#installation');
    process.exit(1);
  }
}
```

### New install/build.js

```javascript
// install/build.js
const { spawnSync } = require('child_process');

console.log('Building node-webcodecs from source...');

// Verify node-gyp available
try {
  require('node-gyp');
} catch {
  console.error('node-gyp required for source build');
  process.exit(1);
}

const result = spawnSync('npx', ['node-gyp', 'rebuild'], {
  stdio: 'inherit',
  shell: true
});

process.exit(result.status);
```

---

## Implementation Phases

### Phase 1: Quick Wins (Low Risk) ✅ DONE
- [x] Delete orphaned files (Makefile, TODO.md, etc.)
- [x] Add biome.json, remove eslint/prettier
- [x] Add README.md, CONTRIBUTING.md
- [x] Split lib/index.ts

### Phase 2: Package Polish
1. Add LICENSE file (MIT)
2. Update package.json with homepage, repository, files, funding
3. Improve install/check.js with better error messages

### Phase 3: CI Hardening
1. Add explicit `permissions: {}` to workflows
2. Expand platform matrix (darwin-arm64, etc.)
3. Add Windows CI (requires FFmpeg setup)

### Phase 4: Release Automation
1. Create release.yml workflow
2. Add npm-smoke.yml for post-release testing
3. Set up NPM_TOKEN secret

### Phase 5: Issue Templates
1. Add installation.yml template
2. Enhance bug_report.yml with diagnostic commands
3. Add config.yml to disable blank issues

---

## Success Criteria

- [ ] LICENSE file exists in root
- [ ] `npm pack` includes only necessary files via `files` array
- [ ] CI runs on Linux, macOS (Intel + ARM), Windows
- [ ] Git tags trigger npm publish
- [ ] Issue templates capture environment info
- [ ] install/check.js provides helpful error messages
- [ ] All tests pass on all platforms
