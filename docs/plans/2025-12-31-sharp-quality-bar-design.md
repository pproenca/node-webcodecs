# Sharp Quality Bar Adoption Design

## Overview

This document captures repository structure, documentation, and code organization patterns from lovell/sharp that should be adopted in node-webcodecs to achieve production-grade quality.

**Scope:** This design focuses on areas NOT already covered in existing plans:
- `2024-12-31-sharp-patterns-adoption-design.md` (async workers, prebuilts)
- `2024-12-31-sharp-patterns-implementation.md` (implementation details)

This design addresses: code organization, documentation, dev workflow, and cleanup.

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

## Implementation Phases

### Phase 1: File Cleanup (Low Risk)

1. Delete `Makefile`, `progress.txt`
2. Create GitHub Issues from `TODO.md`, then delete
3. Move `plan.md` to docs/plans if needed, then delete
4. Update `.gitignore` if needed

### Phase 2: Package.json & Tooling

1. Replace eslint+prettier with biome
2. Flatten package.json scripts
3. Add `lint-types` with tsd
4. Add `prepublishOnly` script

### Phase 3: Documentation

1. Create README.md with examples
2. Create .github/CONTRIBUTING.md
3. Create .github/ISSUE_TEMPLATE/ structure
4. Set up TypeDoc for API docs

### Phase 4: lib/ Split (Higher Risk)

1. Extract classes from index.ts to separate files
2. Create new index.ts that re-exports
3. Ensure all tests pass
4. Verify tree-shaking still works

### Phase 5: CI/CD Polish

1. Add lint-first job pattern
2. Add npm smoke test workflow
3. Add release workflow (after prebuilts from other plan)

---

## Success Criteria

- [ ] No orphaned files in root (Makefile, TODO.md, etc.)
- [ ] README.md exists with examples and badges
- [ ] CONTRIBUTING.md exists in .github/
- [ ] Issue templates configured
- [ ] lib/index.ts is < 100 lines (just exports)
- [ ] TypeDoc generates API documentation
- [ ] CI runs lint before build
- [ ] Type definitions tested with tsd
