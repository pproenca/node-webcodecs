# Sharp Quality Bar Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-sharp-quality-bar-implementation.md` to implement task-by-task.

**Goal:** Transform node-webcodecs repository structure, tooling, and documentation to match sharp's production quality bar.

**Architecture:** Five sequential phases: (1) file cleanup, (2) biome migration, (3) documentation, (4) lib/ split, (5) CI/CD polish. Each phase is self-contained with its own verification.

**Tech Stack:** Biome for linting, TypeDoc for API docs, tsd for type testing, Vitest for unit tests.

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | File cleanup - independent deletions |
| Group 2 | 3, 4, 5 | Biome migration - must be sequential (install → config → test) |
| Group 3 | 6, 7, 8 | Documentation - can run in parallel |
| Group 4 | 9, 10, 11 | lib/ split - must be sequential (base → classes → index) |
| Group 5 | 12, 13 | CI/CD - sequential (lint job → smoke tests) |
| Group 6 | 14 | Code Review |

---

### Task 1: Delete Orphaned Root Files

**Files:**
- Delete: `Makefile`
- Delete: `progress.txt`
- Delete: `.c8rc.json`

**Step 1: Verify files exist and check content** (30 sec)

```bash
ls -la Makefile progress.txt .c8rc.json
```

**Step 2: Review Makefile to confirm it's outdated** (1 min)

```bash
head -20 Makefile
```

Verify it references `cmake-js` (outdated) while `package.json` uses `node-gyp`.

**Step 3: Delete the files** (30 sec)

```bash
rm Makefile progress.txt .c8rc.json
```

**Step 4: Verify deletion** (30 sec)

```bash
ls Makefile progress.txt .c8rc.json 2>&1 | grep -c "No such file"
```

Expected: `3` (all three files not found)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "chore: remove orphaned files (Makefile, progress.txt, .c8rc.json)"
```

---

### Task 2: Archive and Delete TODO.md and plan.md

**Files:**
- Delete: `TODO.md`
- Delete: `plan.md`

**Step 1: Check if content is already captured in docs/plans/** (2 min)

```bash
cat TODO.md
cat plan.md
```

Review content. The `plan.md` content should already exist in `docs/plans/` from earlier work. The `TODO.md` items marked `[x]` are done; remaining items should become GitHub Issues.

**Step 2: Verify plan.md content exists in docs/plans/** (30 sec)

```bash
ls docs/plans/*compliance*.md docs/plans/*w3c*.md
```

Expected: Files like `2025-12-30-webcodecs-spec-compliance.md` should exist.

**Step 3: Delete the files** (30 sec)

```bash
rm TODO.md plan.md
```

**Step 4: Verify deletion** (30 sec)

```bash
ls TODO.md plan.md 2>&1 | grep -c "No such file"
```

Expected: `2`

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "chore: remove TODO.md and plan.md (content in docs/plans/)"
```

---

### Task 3: Install Biome and Create Configuration

**Files:**
- Create: `biome.json`
- Modify: `package.json`

**Step 1: Install biome as dev dependency** (1 min)

```bash
npm install --save-dev @biomejs/biome
```

**Step 2: Create biome.json configuration** (2 min)

Create `biome.json` with sharp-inspired settings:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "complexity": {
        "noForEach": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "build",
      "*.d.ts"
    ]
  }
}
```

**Step 3: Verify biome config is valid** (30 sec)

```bash
npx biome check --config-path biome.json
```

Expected: Should not error on config parsing (may show lint warnings, that's OK)

**Step 4: Commit** (30 sec)

```bash
git add biome.json package.json package-lock.json && git commit -m "build: add biome for linting and formatting"
```

---

### Task 4: Remove ESLint/Prettier and Update package.json Scripts

**Files:**
- Delete: `eslint.config.js`
- Delete: `eslint.ignores.js`
- Delete: `.prettierrc.js`
- Modify: `package.json`

**Step 1: Delete old linting config files** (30 sec)

```bash
rm eslint.config.js eslint.ignores.js .prettierrc.js
```

**Step 2: Uninstall old linting dependencies** (1 min)

```bash
npm uninstall gts eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-node eslint-plugin-prettier
```

Note: Some packages may not be installed directly. That's OK - npm will ignore them.

**Step 3: Update package.json scripts** (3 min)

Update the scripts section in `package.json`:

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
    "test-unit": "vitest run --config test/vitest.config.ts",
    "test-stress": "vitest run test/stress/ --config test/vitest.config.ts",
    "lint": "npm run lint-js && npm run lint-cpp",
    "lint-js": "biome check --write lib/ test/",
    "lint-cpp": "cpplint --quiet src/*.h src/*.cc",
    "format": "biome format --write lib/ test/",
    "typecheck": "tsc --noEmit",
    "bench": "npx tsx bench/index.ts",
    "bench:gc": "node --expose-gc --import tsx bench/index.ts",
    "prepublishOnly": "npm run clean && npm run build && npm test"
  }
}
```

**Step 4: Verify lint script works** (30 sec)

```bash
npm run lint-js
```

Expected: Biome runs and may auto-fix some files.

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "build: migrate from eslint/prettier/gts to biome"
```

---

### Task 5: Fix Biome Lint Errors

**Files:**
- Modify: Various files in `lib/` and `test/`

**Step 1: Run biome check to see all issues** (30 sec)

```bash
npx biome check lib/ test/ 2>&1 | head -50
```

**Step 2: Auto-fix what biome can fix** (1 min)

```bash
npx biome check --write lib/ test/
```

**Step 3: Review remaining errors** (2 min)

```bash
npx biome check lib/ test/
```

If there are remaining errors that can't be auto-fixed, manually address them. Common issues:
- `noExplicitAny` - add proper types or use `unknown`
- `useConst` - change `let` to `const` where applicable

**Step 4: Run TypeScript check to ensure no regressions** (1 min)

```bash
npm run typecheck
```

Expected: No TypeScript errors

**Step 5: Run tests to ensure nothing broke** (2 min)

```bash
npm test
```

Expected: All tests pass

**Step 6: Commit** (30 sec)

```bash
git add -A && git commit -m "style: fix biome lint errors"
```

---

### Task 6: Create Professional README.md

**Files:**
- Create: `README.md`

**Step 1: Create README.md with examples** (5 min)

Create `README.md`:

```markdown
# node-webcodecs

W3C WebCodecs API implementation for Node.js using FFmpeg.

Encode and decode video/audio with the same API used in browsers.

## Features

- **Video Codecs:** H.264, H.265/HEVC, VP8, VP9, AV1
- **Audio Codecs:** AAC, Opus, MP3, FLAC
- **Full W3C WebCodecs API compliance**
- **Async/await and callback patterns**
- **Cross-platform:** macOS, Linux, Windows

## Installation

```sh
npm install node-webcodecs
```

### Prerequisites

FFmpeg development libraries are required:

**macOS:**
```sh
brew install ffmpeg
```

**Ubuntu/Debian:**
```sh
sudo apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev
```

## Quick Start

### Encode Video Frames

```javascript
import { VideoEncoder, VideoFrame } from 'node-webcodecs';

const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    console.log('Encoded chunk:', chunk.byteLength, 'bytes');
  },
  error: (e) => console.error(e),
});

encoder.configure({
  codec: 'avc1.42001e',
  width: 640,
  height: 480,
  bitrate: 1_000_000,
});

// Create a frame from RGBA data
const frame = new VideoFrame(rgbaBuffer, {
  format: 'RGBA',
  codedWidth: 640,
  codedHeight: 480,
  timestamp: 0,
});

encoder.encode(frame);
frame.close();

await encoder.flush();
encoder.close();
```

### Decode Video Chunks

```javascript
import { VideoDecoder, EncodedVideoChunk } from 'node-webcodecs';

const decoder = new VideoDecoder({
  output: (frame) => {
    console.log('Decoded frame:', frame.codedWidth, 'x', frame.codedHeight);
    frame.close();
  },
  error: (e) => console.error(e),
});

decoder.configure({
  codec: 'avc1.42001e',
});

const chunk = new EncodedVideoChunk({
  type: 'key',
  timestamp: 0,
  data: h264Data,
});

decoder.decode(chunk);
await decoder.flush();
decoder.close();
```

## API Reference

This library implements the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/):

- `VideoEncoder` / `VideoDecoder`
- `AudioEncoder` / `AudioDecoder`
- `VideoFrame` / `AudioData`
- `EncodedVideoChunk` / `EncodedAudioChunk`
- `ImageDecoder`

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
```

**Step 2: Verify README renders correctly** (30 sec)

```bash
head -50 README.md
```

**Step 3: Commit** (30 sec)

```bash
git add README.md && git commit -m "docs: add professional README with examples"
```

---

### Task 7: Create CONTRIBUTING.md

**Files:**
- Create: `.github/CONTRIBUTING.md`

**Step 1: Create .github directory if needed** (30 sec)

```bash
mkdir -p .github
```

**Step 2: Create CONTRIBUTING.md** (3 min)

Create `.github/CONTRIBUTING.md`:

```markdown
# Contributing to node-webcodecs

Thank you for your interest in contributing!

## Reporting Bugs

Please create a [new issue](https://github.com/aspect-build/node-webcodecs/issues/new) with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- node-webcodecs version

## Development Setup

1. **Prerequisites:**
   - Node.js 18+
   - FFmpeg development libraries
   - C++17 compiler

2. **Clone and build:**
   ```sh
   git clone https://github.com/aspect-build/node-webcodecs.git
   cd node-webcodecs
   npm install
   npm run build
   ```

3. **Run tests:**
   ```sh
   npm test
   ```

## Code Style

- **TypeScript:** Formatted with Biome. Run `npm run lint-js` to check.
- **C++:** Follows Google C++ style. Run `npm run lint-cpp` to check.

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run `npm test` to verify
5. Submit a PR against `main`

## Running Tests

```sh
# All tests
npm test

# Specific test file
npx vitest run test/golden/video-encoder.test.ts

# Stress tests
npm run test-stress
```

## Building

```sh
# Full build (native + TypeScript)
npm run build

# Native only (C++ addon)
npm run build:native

# TypeScript only
npm run build:ts
```

## Questions

Open an issue or reach out to maintainers.
```

**Step 3: Commit** (30 sec)

```bash
git add .github/CONTRIBUTING.md && git commit -m "docs: add CONTRIBUTING.md"
```

---

### Task 8: Create GitHub Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`

**Step 1: Create ISSUE_TEMPLATE directory** (30 sec)

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

**Step 2: Create config.yml** (1 min)

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: https://github.com/aspect-build/node-webcodecs#readme
    about: Please read the README before opening an issue
```

**Step 3: Create bug_report.yml** (2 min)

Create `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug Report
description: Something isn't working as expected
labels: ["bug", "triage"]
body:
  - type: checkboxes
    attributes:
      label: Prerequisites
      options:
        - label: I have searched existing issues
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
    validations:
      required: true

  - type: input
    attributes:
      label: node-webcodecs version
      placeholder: "0.1.0"
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Operating system
      options:
        - macOS
        - Linux (glibc)
        - Linux (musl/Alpine)
        - Windows
    validations:
      required: true
```

**Step 4: Create feature_request.yml** (1 min)

Create `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature Request
description: Suggest an enhancement
labels: ["enhancement"]
body:
  - type: textarea
    attributes:
      label: Problem
      description: What problem does this solve?
    validations:
      required: true

  - type: textarea
    attributes:
      label: Proposed solution
      description: How would you like it to work?
    validations:
      required: true

  - type: textarea
    attributes:
      label: Alternatives considered
      description: What alternatives have you considered?
```

**Step 5: Commit** (30 sec)

```bash
git add .github/ISSUE_TEMPLATE/ && git commit -m "docs: add GitHub issue templates"
```

---

### Task 9: Extract CodecBase Class to Separate File

**Files:**
- Create: `lib/codec-base.ts`
- Modify: `lib/index.ts`

**Step 1: Identify CodecBase in lib/index.ts** (1 min)

```bash
grep -n "class CodecBase" lib/index.ts
```

Find the line numbers where `CodecBase` is defined.

**Step 2: Create lib/codec-base.ts** (3 min)

Extract the `CodecBase` class to `lib/codec-base.ts`. The file should include:

```typescript
// lib/codec-base.ts
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import {ControlMessageQueue} from './control-message-queue';
import type {CodecState} from './types';

/**
 * Base class for all codecs (VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder).
 * Provides shared state management, queue handling, and EventTarget-like behavior.
 */
export abstract class CodecBase {
  protected _state: CodecState = 'unconfigured';
  protected _queue: ControlMessageQueue;
  protected _errorCallback: (error: Error) => void;

  // ondequeue callback (EventTarget-like)
  public ondequeue: (() => void) | null = null;

  constructor(init: {error: (error: Error) => void}) {
    this._errorCallback = init.error;
    this._queue = new ControlMessageQueue();
  }

  get state(): CodecState {
    return this._state;
  }

  protected _triggerDequeue(): void {
    if (this.ondequeue) {
      try {
        this.ondequeue();
      } catch (e) {
        // Ignore errors from dequeue callback
      }
    }
  }

  protected _checkState(expected: CodecState, methodName: string): void {
    if (this._state !== expected) {
      throw new DOMException(
        `Cannot call ${methodName} in state '${this._state}'`,
        'InvalidStateError'
      );
    }
  }

  protected _setState(newState: CodecState): void {
    this._state = newState;
  }
}
```

Note: The exact implementation should match what's in `lib/index.ts`. Read the actual CodecBase from index.ts and extract it.

**Step 3: Build to verify no syntax errors** (30 sec)

```bash
npm run build:ts
```

Expected: No TypeScript errors

**Step 4: Commit** (30 sec)

```bash
git add lib/codec-base.ts && git commit -m "refactor: extract CodecBase to separate file"
```

---

### Task 10: Extract Encoder/Decoder Classes to Separate Files

**Files:**
- Create: `lib/video-encoder.ts`
- Create: `lib/video-decoder.ts`
- Create: `lib/audio-encoder.ts`
- Create: `lib/audio-decoder.ts`
- Create: `lib/video-frame.ts`
- Create: `lib/audio-data.ts`
- Create: `lib/encoded-chunks.ts`
- Create: `lib/image-decoder.ts`
- Modify: `lib/index.ts`

**Step 1: Analyze lib/index.ts structure** (2 min)

```bash
grep -n "^export class\|^class" lib/index.ts
```

Identify all classes and their line numbers.

**Step 2: Extract VideoEncoder class** (3 min)

Create `lib/video-encoder.ts` with the VideoEncoder class extracted from index.ts. Include:
- All imports it needs
- The class definition
- Export the class

```typescript
// lib/video-encoder.ts
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import {CodecBase} from './codec-base';
import {binding} from './binding';
import type {
  VideoEncoderConfig,
  VideoEncoderInit,
  VideoEncoderEncodeOptions,
  EncodedVideoChunkMetadata,
} from './types';
import {VideoFrame} from './video-frame';
import {EncodedVideoChunk} from './encoded-chunks';

export class VideoEncoder extends CodecBase {
  // ... extracted implementation
}
```

**Step 3: Extract remaining classes** (10 min)

Repeat for:
- `lib/video-decoder.ts` - VideoDecoder class
- `lib/audio-encoder.ts` - AudioEncoder class
- `lib/audio-decoder.ts` - AudioDecoder class
- `lib/video-frame.ts` - VideoFrame, VideoColorSpace classes
- `lib/audio-data.ts` - AudioData class
- `lib/encoded-chunks.ts` - EncodedVideoChunk, EncodedAudioChunk classes
- `lib/image-decoder.ts` - ImageDecoder class

Each file should:
1. Have copyright header
2. Import dependencies from other lib files
3. Export the class(es)

**Step 4: Build to verify extraction is correct** (1 min)

```bash
npm run build:ts
```

Expected: No TypeScript errors (may have import errors if circular)

**Step 5: Commit** (30 sec)

```bash
git add lib/*.ts && git commit -m "refactor: extract all codec classes to separate files"
```

---

### Task 11: Create New index.ts with Re-exports

**Files:**
- Modify: `lib/index.ts`

**Step 1: Replace lib/index.ts with re-exports** (2 min)

Replace the entire `lib/index.ts` with clean re-exports:

```typescript
// lib/index.ts
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Main entry point - re-exports all WebCodecs classes.

// Core codec classes
export {VideoEncoder} from './video-encoder';
export {VideoDecoder} from './video-decoder';
export {AudioEncoder} from './audio-encoder';
export {AudioDecoder} from './audio-decoder';

// Data classes
export {VideoFrame, VideoColorSpace} from './video-frame';
export {AudioData} from './audio-data';
export {EncodedVideoChunk, EncodedAudioChunk} from './encoded-chunks';

// Image decoding
export {ImageDecoder} from './image-decoder';
export {ImageTrack, ImageTrackList} from './image-track';

// Types (re-export everything)
export * from './types';
```

**Step 2: Verify index.ts is now small** (30 sec)

```bash
wc -l lib/index.ts
```

Expected: < 50 lines

**Step 3: Build and run tests** (2 min)

```bash
npm run build && npm test
```

Expected: All tests pass

**Step 4: Commit** (30 sec)

```bash
git add lib/index.ts && git commit -m "refactor: simplify index.ts to re-exports only"
```

---

### Task 12: Add Lint-First Job to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Read current CI workflow** (1 min)

```bash
cat .github/workflows/ci.yml
```

**Step 2: Add lint job that runs first** (3 min)

Modify `.github/workflows/ci.yml` to add a lint job at the top:

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm run lint-js
      - run: npm run lint-cpp
        continue-on-error: true  # cpplint may not be installed

  build-and-test:
    needs: lint
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20, 22]
    # ... rest of existing job
```

**Step 3: Verify YAML syntax** (30 sec)

```bash
head -40 .github/workflows/ci.yml
```

**Step 4: Commit** (30 sec)

```bash
git add .github/workflows/ci.yml && git commit -m "ci: add lint-first job pattern"
```

---

### Task 13: Add npm Smoke Test Workflow

**Files:**
- Create: `.github/workflows/npm-smoke.yml`

**Step 1: Create npm smoke test workflow** (3 min)

Create `.github/workflows/npm-smoke.yml`:

```yaml
name: npm smoke test

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  smoke-test:
    name: "${{ matrix.os }} - ${{ matrix.pm }}"
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            pm: npm
          - os: ubuntu-latest
            pm: pnpm
          - os: macos-latest
            pm: npm

    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 20

      - name: Setup pnpm
        if: matrix.pm == 'pnpm'
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install FFmpeg (Ubuntu)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libavcodec-dev \
            libavutil-dev \
            libswscale-dev \
            libswresample-dev \
            libavfilter-dev

      - name: Install FFmpeg (macOS)
        if: runner.os == 'macOS'
        run: brew install ffmpeg

      - name: Create test project
        run: |
          mkdir test-project
          cd test-project
          echo '{"name":"test","type":"module"}' > package.json

      - name: Install package (npm)
        if: matrix.pm == 'npm'
        run: cd test-project && npm install node-webcodecs

      - name: Install package (pnpm)
        if: matrix.pm == 'pnpm'
        run: cd test-project && pnpm install node-webcodecs

      - name: Smoke test
        run: |
          cd test-project
          node -e "
            const { VideoEncoder, VideoFrame } = require('node-webcodecs');
            console.log('VideoEncoder:', typeof VideoEncoder);
            console.log('VideoFrame:', typeof VideoFrame);
            if (typeof VideoEncoder !== 'function') process.exit(1);
          "
```

**Step 2: Commit** (30 sec)

```bash
git add .github/workflows/npm-smoke.yml && git commit -m "ci: add npm smoke test workflow for releases"
```

---

### Task 14: Code Review

**Files:**
- All files modified in Tasks 1-13

**Step 1: Review all commits** (2 min)

```bash
git log --oneline -15
```

**Step 2: Verify file structure matches target** (1 min)

```bash
ls -la *.md *.json biome.json 2>/dev/null
ls lib/*.ts | wc -l
```

Expected:
- README.md exists
- biome.json exists
- No Makefile, TODO.md, plan.md, progress.txt
- lib/ has multiple .ts files (not just one giant index.ts)

**Step 3: Run full test suite** (2 min)

```bash
npm run build && npm test
```

Expected: All tests pass

**Step 4: Run lint** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 5: Verify index.ts is small** (30 sec)

```bash
wc -l lib/index.ts
```

Expected: < 50 lines

**Step 6: Create summary if fixes needed** (30 sec)

If any fixes were needed:

```bash
git add -A && git commit -m "fix: address code review feedback"
```

---

## Post-Implementation Checklist

After completing all tasks:

- [ ] No orphaned files: `ls Makefile TODO.md plan.md progress.txt` should fail
- [ ] README.md exists with examples
- [ ] .github/CONTRIBUTING.md exists
- [ ] .github/ISSUE_TEMPLATE/ has config.yml, bug_report.yml, feature_request.yml
- [ ] biome.json exists, eslint.config.js does not
- [ ] lib/index.ts is < 50 lines
- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] CI has lint-first job
- [ ] npm-smoke.yml workflow exists
