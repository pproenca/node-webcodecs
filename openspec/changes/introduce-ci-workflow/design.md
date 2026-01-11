## Context

This project is a Node.js native addon providing W3C WebCodecs API using FFmpeg. It requires:

- C++17 compilation with node-gyp
- FFmpeg 5.0+ libraries (libavcodec, libavformat, libavutil, libswscale, libswresample, libavfilter)
- Platform-specific frameworks (VideoToolbox on macOS)
- Multiple libc variants on Linux (glibc, musl)

**FFmpeg Dependency Resolution (`gyp/ffmpeg-paths-lib.ts`) - Current:**
1. `FFMPEG_ROOT` env var → Explicit override
2. `./ffmpeg-install` directory → Local development
3. System pkg-config → Fallback to system FFmpeg

**FFmpeg Dependency Resolution - After This Change:**
1. `FFMPEG_ROOT` env var → Explicit override
2. `@pproenca/webcodecs-ffmpeg` npm package → **NEW: Auto-installed via optionalDeps**
3. `./ffmpeg-install` directory → Local development
4. System pkg-config → Fallback to system FFmpeg

**Related Repository: `pproenca/webcodecs-ffmpeg`**

This separate repository builds and publishes **FFmpeg static libraries** to NPM:
- `@pproenca/webcodecs-ffmpeg` - Main package (LGPL: VP8/9, AV1, Opus, Vorbis, MP3)
- `@pproenca/webcodecs-ffmpeg-non-free` - GPL variant (adds H.264, H.265)
- Platform packages: `*-darwin-arm64`, `*-darwin-x64`, `*-linux-arm64`, `*-linux-x64`

The build workflow (`_build.yml`) produces 8 artifacts (4 platforms × 2 licenses) that are published via `release.yml` on git tags.

**This Project's Prebuild Packages:**

`node-webcodecs` publishes its own native addon prebuilds as optionalDependencies:
- `@pproenca/node-webcodecs-darwin-arm64`
- `@pproenca/node-webcodecs-darwin-x64`
- `@pproenca/node-webcodecs-linux-x64-glibc`
- `@pproenca/node-webcodecs-linux-x64-musl`

Currently, there is no CI. Code quality is enforced manually via `npm run check`. This CI focuses on validation (lint, build, test) - prebuild publishing is a separate concern.

## Goals / Non-Goals

**Goals:**

- Automate lint checks (C++, TypeScript, types, markdown) on every push/PR
- Build and test native addon on all supported platforms
- Fail fast on code quality issues before merge
- Provide clear feedback on build/test failures

**Non-Goals:**

- Native addon prebuild publishing (separate concern, possibly via `prebuildify`)
- Windows support (not currently in optionalDependencies)
- ARM64 Linux builds (not currently in optionalDependencies)
- Release automation or npm publishing
- Building FFmpeg from source (use existing packages)

## Decisions

### 1. Workflow Structure: Separate Lint and Build Jobs

**Decision:** Use two separate jobs - `lint` and `build-native`.

**Rationale:** Lint checks are fast and platform-independent. Running them in a dedicated job provides quick feedback without waiting for slow native builds. Build failures don't block lint feedback.

**Alternatives considered:**
- Single job with all steps: Slower feedback, wastes resources if lint fails
- Matrix including lint: Redundant lint runs across platforms

### 2. Linux Build Strategy: Container-based with Rocky and Alpine

**Decision:** Use official `rockylinux:8` container for glibc builds and `alpine:3.20` for musl builds.

**Rationale:**
- Rocky Linux 8 provides glibc 2.28, compatible with most Linux distributions
- Alpine provides musl libc for lightweight container deployments
- Containers ensure reproducible builds independent of runner updates

**Alternatives considered:**
- Ubuntu runner directly: Higher glibc version limits compatibility
- Custom Docker images: Maintenance burden, slower cold starts

### 3. macOS Strategy: Native Runners with Homebrew FFmpeg

**Decision:** Use `macos-14` (arm64) and `macos-13` (x64) runners with Homebrew-installed FFmpeg.

**Rationale:**
- GitHub provides both architectures natively
- Homebrew FFmpeg is well-maintained and includes hardware acceleration support
- No container overhead on macOS

**Alternatives considered:**
- Pre-built FFmpeg binaries: Version management complexity
- Building FFmpeg from source: Slow, maintenance burden

### 4. Node.js Version Strategy: Test Against Supported Engines

**Decision:** Test on Node.js 20 and 22 (matching `engines` field: `^20.17.0 || ^22.9.0 || >=24`).

**Rationale:** These are the LTS versions currently supported. Node 24 is too new for stable CI.

**Alternatives considered:**
- Test all three versions: Node 24 may have unstable N-API, adds matrix complexity
- Single version only: Misses version-specific issues

### 5. FFmpeg Installation: System Package Managers

**Decision:** Use system package managers - `dnf` on Rocky, `apk` on Alpine, `brew` on macOS.

**Rationale:**
- Simpler setup, no artifact management
- Consistent with how end users install FFmpeg
- Package managers handle dependencies automatically
- Matches the fallback path in `gyp/ffmpeg-paths-lib.ts` (system pkg-config)

**Alternatives considered:**
- Use `@pproenca/webcodecs-ffmpeg` npm packages: More consistent with production builds, but adds complexity (npm install, extract, set `FFMPEG_ROOT`). Better suited for prebuild CI, not validation CI.
- Download artifacts from webcodecs-ffmpeg releases: Requires GitHub token, artifact management. Overkill for validation.
- Build FFmpeg from source: Too slow, maintenance burden

### 6. Test Scope: Full Test Suite Excluding Stress Tests

**Decision:** Run `npm run test:fast` and `npm run test:guardrails` but not `npm run test:stress`.

**Rationale:**
- Fast tests and guardrails catch regressions without excessive CI time
- Stress tests are resource-intensive and may timeout on shared runners

### 7. Optional FFmpeg Dependencies (Sharp-style)

**Decision:** Add `@pproenca/webcodecs-ffmpeg-*` platform packages as `optionalDependencies` in package.json, and update `gyp/ffmpeg-paths-lib.ts` to resolve from npm packages before falling back to system FFmpeg.

**Rationale:**
- Developers get FFmpeg automatically on `npm install` (zero-config)
- Developers can opt-out with `--omit=optional` to use system FFmpeg
- Matches Sharp's pattern for optional native dependencies
- CI uses `--omit=optional` to validate the system fallback works

**Implementation:**
1. Add to package.json `optionalDependencies`:
   - `@pproenca/webcodecs-ffmpeg-darwin-arm64`
   - `@pproenca/webcodecs-ffmpeg-darwin-x64`
   - `@pproenca/webcodecs-ffmpeg-linux-x64`
2. Update `gyp/ffmpeg-paths-lib.ts` to check for `@pproenca/webcodecs-ffmpeg/resolve`
3. CI runs `npm ci --omit=optional` to ensure system fallback is tested

**Alternatives considered:**
- Required dependency: Forces all users to download FFmpeg even if system version available
- No npm FFmpeg: Requires all users to install FFmpeg manually (worse DX)

## Risks / Trade-offs

**[Risk] FFmpeg version drift across platforms** → Pin FFmpeg version where possible (e.g., `ffmpeg-7` on Alpine). Document minimum version in workflow comments.

**[Risk] macOS runner availability/cost** → GitHub provides free macOS minutes for public repos. For private repos, consider running macOS tests only on PRs to main.

**[Risk] Container startup time** → Rocky and Alpine images are small. First-run caches layers. Acceptable trade-off for reproducibility.

**[Risk] Flaky tests on shared runners** → Use `--test-concurrency=1` (already in npm scripts). Consider retry strategy if issues emerge.

**[Risk] webcodecs-ffmpeg version mismatch** → Keep optionalDependencies versions in sync with tested FFmpeg version. Document minimum compatible version.

**[Risk] npm package resolution complexity** → The resolve module must handle missing packages gracefully. Test both paths (with and without optional deps).

## Open Questions

1. Should we add a code coverage reporting step? (e.g., upload to Codecov)
2. Should we cache node_modules and FFmpeg installations for faster runs?
3. Should we add a step to verify the prebuild packages install correctly?
