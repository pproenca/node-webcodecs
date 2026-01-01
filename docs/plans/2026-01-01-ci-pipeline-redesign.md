# CI Pipeline Redesign: Decoupled "Gold Master" Architecture

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-01-ci-pipeline-redesign.md` to implement task-by-task.

**Goal:** Eliminate build timeouts and race conditions by decoupling the heavy "Vendor" build (FFmpeg with many codecs) from the fast "Product" build (Node addon).

**Architecture:**
1. **Vendor Pipeline (`build-ffmpeg.yml`):** Manual trigger only. Builds massive static FFmpeg with all codecs. Uploads to GitHub Releases as `deps-vN` tag.
2. **Product Pipeline (`ci.yml`, `release.yml`):** Runs on push/PR/release. Downloads pre-built FFmpeg from `deps-vN` release. Builds addon in <5 minutes.

**Flow:**
```
[Manual/Monthly]                    [Per-commit/PR]
build-ffmpeg.yml ──────┐            ci.yml
  │                    │              │
  ▼                    │              ▼
GitHub Release ◄───────┘         Download deps-vN
(deps-v1.tar.gz)                      │
                                      ▼
                                 Build addon (<5min)
                                      │
                                      ▼
                                 Run tests
```

---

## Task Group 1: Update FFmpeg Builder for GitHub Releases

### Task 1: Update build-ffmpeg.yml to Create GitHub Releases

**Files:**
- Modify: `.github/workflows/build-ffmpeg.yml`

**Context:** Current workflow caches FFmpeg and uploads artifacts within the run. We need to:
1. Make it manual-only (remove push/PR triggers)
2. Create a GitHub Release with the FFmpeg binaries instead of just artifacts
3. Use a versioned tag like `deps-v1` so product workflows can download it

**Step 1: Read current workflow triggers** (30 sec)

```bash
sed -n '1,32p' .github/workflows/build-ffmpeg.yml
```

Verify the current `on:` block includes push/PR triggers that we need to remove.

**Step 2: Update triggers to manual-only** (3 min)

Replace lines 6-29 (current `on:` block):
```yaml
on:
  workflow_dispatch:
    inputs:
      cache_version:
        description: "Cache version (bump to force rebuild)"
        default: "v1"
      force_rebuild:
        description: "Force rebuild (ignore cache)"
        type: boolean
        default: false
  workflow_call:
    inputs:
      cache_version:
        description: "Cache version (bump to force rebuild)"
        type: string
        default: "v1"
  push:
    paths:
      - ".github/workflows/build-ffmpeg.yml"
      - "externals/jellyfin-ffmpeg/**"
  pull_request:
    paths:
      - ".github/workflows/build-ffmpeg.yml"
      - "externals/jellyfin-ffmpeg/**"
```

With:
```yaml
on:
  workflow_dispatch:
    inputs:
      deps_version:
        description: "Dependencies version tag (e.g., v1, v2)"
        required: true
        default: "v1"
      force_rebuild:
        description: "Force rebuild (ignore cache)"
        type: boolean
        default: false
```

**Step 3: Add release job at the end of the workflow** (5 min)

After the existing `build-ffmpeg` job (after line 238), add a new job that creates a GitHub release:

```yaml

  create-release:
    name: "Create Dependencies Release"
    needs: [build-ffmpeg]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download all FFmpeg artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: ffmpeg-*
          path: deps

      - name: Package for release
        run: |
          mkdir -p release
          for platform in darwin-arm64 darwin-x64 linux-x64; do
            if [ -d "deps/ffmpeg-$platform" ]; then
              tar -czvf "release/ffmpeg-$platform.tar.gz" -C "deps/ffmpeg-$platform" .
              echo "Created ffmpeg-$platform.tar.gz"
            fi
          done
          ls -la release/

      - name: Create or Update Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: deps-${{ inputs.deps_version }}
          name: "FFmpeg Dependencies ${{ inputs.deps_version }}"
          body: |
            Pre-built static FFmpeg libraries for node-webcodecs.

            **Source:** jellyfin-ffmpeg (commit from submodule)
            **Platforms:** darwin-arm64, darwin-x64, linux-x64

            Download the appropriate `.tar.gz` for your platform and extract to `ffmpeg-install/`.
          files: release/*.tar.gz
          fail_on_unmatched_files: true
          make_latest: true
```

**Step 4: Verify YAML validity** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-ffmpeg.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

**Step 5: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml && git commit -m "feat(ci): update build-ffmpeg to create GitHub Releases

- Remove push/PR triggers (manual/admin only)
- Add create-release job that uploads FFmpeg as deps-vN release
- Enables fast product builds that download pre-built FFmpeg

To use: Run workflow manually with deps_version input"
```

---

## Task Group 2: Fix Static Linking Configuration

### Task 2: Update gyp/ffmpeg-paths.js to Use pkg-config from CI Build

**Files:**
- Modify: `gyp/ffmpeg-paths.js`

**Context:** The current helper outputs only `-L<path>` when CI FFmpeg is found, but `pkg-config --libs --static` still runs from binding.gyp. Two critical issues:

1. **PKG_CONFIG_PATH** must point to the CI build's `.pc` files
2. **`--define-variable=prefix=`** must relocate hardcoded paths in `.pc` files (e.g., `/opt/ffbuild/prefix` → actual extraction path)

The workflow will set `FFMPEG_ROOT` env var pointing to the extracted FFmpeg location.

**Step 1: Read current ffmpeg-paths.js** (30 sec)

```bash
cat gyp/ffmpeg-paths.js
```

**Step 2: Update to run pkg-config with path relocation** (5 min)

Replace the entire file content with:
```javascript
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.
// Uses pkg-config with PKG_CONFIG_PATH pointing to CI-built FFmpeg when available.
// All codec dependencies (x264, x265, vpx, opus, etc.) are resolved automatically
// via the .pc files in the FFmpeg build.
//
// CRITICAL: The --define-variable=prefix= flag relocates hardcoded paths in .pc files
// (e.g., /opt/ffbuild/prefix → actual extraction path). Without this, pkg-config
// returns paths that don't exist on the build machine.

'use strict';

const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { join, resolve } = require('node:path');

const FFMPEG_LIBS = 'libavcodec libavformat libavutil libswscale libswresample libavfilter';

// Detect FFmpeg root from environment or filesystem
function getFFmpegRoot() {
  // 1. Check FFMPEG_ROOT env var (set by CI workflow)
  if (process.env.FFMPEG_ROOT) {
    const root = process.env.FFMPEG_ROOT;
    const pkgconfig = join(root, 'lib', 'pkgconfig');
    if (existsSync(pkgconfig)) {
      return { root, pkgconfig };
    }
  }

  // 2. Check ffmpeg-install directory (local fallback)
  const projectRoot = resolve(__dirname, '..');
  const ffmpegInstall = join(projectRoot, 'ffmpeg-install');
  const pkgconfig = join(ffmpegInstall, 'lib', 'pkgconfig');
  if (existsSync(pkgconfig)) {
    return { root: ffmpegInstall, pkgconfig };
  }

  return null;
}

// Run pkg-config with relocated prefix
function runPkgConfig(args, ffmpegRoot, pkgConfigPath) {
  const env = { ...process.env, PKG_CONFIG_PATH: pkgConfigPath };

  // --define-variable=prefix= relocates hardcoded paths in .pc files
  // This is CRITICAL: .pc files contain /opt/ffbuild/prefix but we extracted to $FFMPEG_ROOT
  const cmd = `pkg-config --define-variable=prefix="${ffmpegRoot}" ${args}`;

  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim();
  } catch (e) {
    // Log error for debugging in CI
    if (process.env.DEBUG) {
      console.error(`pkg-config failed: ${e.message}`);
      if (e.stderr) console.error(e.stderr);
    }
    return null;
  }
}

const mode = process.argv[2] || 'lib';
const ffmpeg = getFFmpegRoot();

if (mode === 'lib') {
  // Output library flags for linking
  if (ffmpeg) {
    const result = runPkgConfig(`--libs --static ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig);
    if (result) {
      console.log(result);
      process.exit(0);
    }
  }
  // Fallback: let binding.gyp handle it with system pkg-config
  process.exit(1);

} else if (mode === 'include') {
  // Output include paths for compilation
  if (ffmpeg) {
    const result = runPkgConfig(`--cflags-only-I ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig);
    if (result) {
      // Remove -I prefix for node-gyp include_dirs format
      console.log(result.replace(/-I/g, '').trim());
      process.exit(0);
    }
  }
  // Fallback
  process.exit(1);

} else if (mode === 'rpath') {
  // rpath is not needed for static linking - all symbols are in the binary
  process.exit(0);
}
```

**Step 3: Verify the script runs** (30 sec)

```bash
node gyp/ffmpeg-paths.js lib
node gyp/ffmpeg-paths.js include
```

Expected: Exit code 1 (no CI build present locally), but no errors.

**Step 4: Commit** (30 sec)

```bash
git add gyp/ffmpeg-paths.js && git commit -m "fix(build): update ffmpeg-paths.js to use pkg-config with path relocation

- Support FFMPEG_ROOT env var from CI workflow
- Use --define-variable=prefix= to relocate hardcoded .pc paths
- Automatically resolves all codec dependencies (x264, vpx, opus)
- No more manual library lists - pkg-config handles transitives"
```

---

### Task 3: Simplify binding.gyp Libraries Section

**Files:**
- Modify: `binding.gyp`

**Context:** Now that `ffmpeg-paths.js` outputs the full `pkg-config --libs --static` result (including all transitive dependencies), we can simplify `binding.gyp` to just use the helper output.

**Step 1: Read current libraries sections** (30 sec)

```bash
sed -n '47,60p' binding.gyp   # macOS libraries
sed -n '78,85p' binding.gyp   # Linux libraries
```

**Step 2: Simplify macOS libraries** (3 min)

Replace lines 47-60 (macOS libraries):
```json
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
            "<!@(pkg-config --libs --static libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter')",
            "-framework VideoToolbox",
            "-framework AudioToolbox",
            "-framework CoreMedia",
            "-framework CoreVideo",
            "-framework CoreFoundation",
            "-framework CoreServices",
            "-framework Security",
            "-liconv",
            "-lbz2",
            "-lz"
          ],
```

With:
```json
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || pkg-config --libs --static libavcodec libavformat libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavformat -lavutil -lswscale -lswresample -lavfilter')",
            "-framework VideoToolbox",
            "-framework AudioToolbox",
            "-framework CoreMedia",
            "-framework CoreVideo",
            "-framework CoreFoundation",
            "-framework CoreServices",
            "-framework Security",
            "-liconv",
            "-lbz2",
            "-lz"
          ],
```

Note: The helper now outputs the full `pkg-config --libs --static` result, so we don't need the separate line.

**Step 3: Simplify Linux libraries** (2 min)

Replace lines 78-85 (Linux libraries):
```json
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
            "<!@(pkg-config --libs --static libavcodec libavutil libswscale libswresample libavfilter)",
            "-lpthread",
            "-lm",
            "-ldl",
            "-lz"
          ],
```

With:
```json
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || pkg-config --libs --static libavcodec libavformat libavutil libswscale libswresample libavfilter)",
            "-lpthread",
            "-lm",
            "-ldl",
            "-lz"
          ],
```

**Step 4: Verify binding.gyp is valid JSON** (30 sec)

```bash
python3 -c "import json; json.load(open('binding.gyp'))" && echo "JSON valid"
```

Expected: `JSON valid`

**Step 5: Commit** (30 sec)

```bash
git add binding.gyp && git commit -m "fix(build): simplify binding.gyp to use ffmpeg-paths.js output

- ffmpeg-paths.js now outputs full pkg-config result
- Removed duplicate pkg-config call
- Added libavformat to library list for muxer/demuxer support"
```

---

## Task Group 3: Update Product Workflows

### Task 4: Update ci.yml to Download FFmpeg from Release

**Files:**
- Modify: `.github/workflows/ci.yml`

**Context:** Current workflow calls `build-ffmpeg.yml` and uses cache. We need to:
1. Remove the `build-ffmpeg` job dependency
2. Download FFmpeg from the `deps-vN` GitHub release instead
3. Remove system fallbacks (no more `apt-get install ffmpeg`)

**Step 1: Read current structure** (30 sec)

```bash
head -60 .github/workflows/ci.yml
```

Identify the `build-ffmpeg` job reference and the build-and-test `needs` clause.

**Step 2: Remove build-ffmpeg job call** (2 min)

Delete lines 22-30 (the `build-ffmpeg` job that calls the reusable workflow):
```yaml
  build-ffmpeg:
    permissions:
      contents: read
      id-token: write
      attestations: write
    uses: ./.github/workflows/build-ffmpeg.yml
    with:
      cache_version: ${{ inputs.cache_version || 'v1' }}
```

**Step 3: Update build-and-test job** (5 min)

Replace the `needs` clause and FFmpeg setup steps. Change:
```yaml
  build-and-test:
    permissions:
      contents: read
    needs: [lint, build-ffmpeg]
```

To:
```yaml
  build-and-test:
    permissions:
      contents: read
    needs: [lint]
    env:
      DEPS_VERSION: v1  # Bump when running new build-ffmpeg workflow
```

Replace the cache restore + fallback steps (approximately lines 95-148) with:
```yaml
      - name: Download FFmpeg from Release
        uses: dsaltares/fetch-gh-release-asset@1.1.2
        with:
          repo: ${{ github.repository }}
          version: tags/deps-${{ env.DEPS_VERSION }}
          file: ffmpeg-${{ matrix.platform }}.tar.gz
          target: ffmpeg-${{ matrix.platform }}.tar.gz
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract FFmpeg and Set Environment
        run: |
          mkdir -p ffmpeg-install
          tar -xzvf ffmpeg-${{ matrix.platform }}.tar.gz -C ffmpeg-install

          # Set FFMPEG_ROOT for ffmpeg-paths.js to use --define-variable=prefix=
          echo "FFMPEG_ROOT=${{ github.workspace }}/ffmpeg-install" >> $GITHUB_ENV

          ls -la ffmpeg-install/lib/
          ls -la ffmpeg-install/lib/pkgconfig/ || { echo "ERROR: No pkgconfig directory"; exit 1; }
```

Also remove the `CACHE_VERSION` env and the `cache_version` input since we no longer use caching.

**Step 4: Verify YAML validity** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

**Step 5: Commit** (30 sec)

```bash
git add .github/workflows/ci.yml && git commit -m "fix(ci): download FFmpeg from release instead of building

- Remove build-ffmpeg job call (no longer rebuilds on every PR)
- Download pre-built FFmpeg from deps-vN GitHub release
- Remove apt-get/brew fallbacks (fail fast if release missing)
- CI now completes in <10 minutes instead of 60+"
```

---

### Task 5: Update build-prebuilds.yml to Download FFmpeg from Release

**Files:**
- Modify: `.github/workflows/build-prebuilds.yml`

**Context:** Same changes as ci.yml - download from release instead of building/caching.

**Step 1: Read current structure** (30 sec)

```bash
head -50 .github/workflows/build-prebuilds.yml
```

Identify the `build-ffmpeg` job reference.

**Step 2: Remove build-ffmpeg job call** (2 min)

Delete lines 36-44 (the `build-ffmpeg` job):
```yaml
  build-ffmpeg:
    permissions:
      contents: read
      id-token: write
      attestations: write
    uses: ./.github/workflows/build-ffmpeg.yml
    with:
      cache_version: ${{ inputs.cache_version || 'v1' }}
```

**Step 3: Update build-prebuilds job** (5 min)

Change `needs: build-ffmpeg` to remove the dependency (or remove `needs` entirely).

Add `DEPS_VERSION` env:
```yaml
    env:
      DEPS_VERSION: ${{ inputs.deps_version || 'v1' }}
```

Replace cache restore + fallback steps (lines 80-139) with:
```yaml
      - name: Download FFmpeg from Release
        uses: dsaltares/fetch-gh-release-asset@1.1.2
        with:
          repo: ${{ github.repository }}
          version: tags/deps-${{ env.DEPS_VERSION }}
          file: ffmpeg-${{ matrix.platform }}.tar.gz
          target: ffmpeg-${{ matrix.platform }}.tar.gz
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract FFmpeg and Set Environment
        run: |
          mkdir -p ffmpeg-install
          tar -xzvf ffmpeg-${{ matrix.platform }}.tar.gz -C ffmpeg-install

          # Set FFMPEG_ROOT for ffmpeg-paths.js to use --define-variable=prefix=
          echo "FFMPEG_ROOT=${{ github.workspace }}/ffmpeg-install" >> $GITHUB_ENV

          ls -la ffmpeg-install/lib/
          ls -la ffmpeg-install/lib/pkgconfig/ || { echo "ERROR: No pkgconfig directory"; exit 1; }
```

**Step 4: Also update the workflow_call input** (1 min)

Change the input from `cache_version` to `deps_version`:
```yaml
on:
  workflow_dispatch:
    inputs:
      deps_version:
        description: "FFmpeg dependencies version tag"
        default: "v1"
  workflow_call:
    inputs:
      deps_version:
        description: "FFmpeg dependencies version tag"
        type: string
        default: "v1"
```

**Step 5: Verify YAML validity** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-prebuilds.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

**Step 6: Commit** (30 sec)

```bash
git add .github/workflows/build-prebuilds.yml && git commit -m "fix(ci): download FFmpeg from release in build-prebuilds

- Remove build-ffmpeg job call
- Download pre-built FFmpeg from deps-vN release
- Remove system fallbacks
- Prebuild workflow now completes in <5 minutes"
```

---

### Task 6: Update release.yml with Smoke Test

**Files:**
- Modify: `.github/workflows/release.yml`

**Context:** The workflow already calls build-prebuilds. We need to:
1. Add `deps_version` input passthrough
2. Add smoke test job after publish

**Step 1: Read current release.yml** (30 sec)

```bash
cat .github/workflows/release.yml
```

**Step 2: Update build-prebuilds call** (2 min)

Change:
```yaml
  build-prebuilds:
    uses: ./.github/workflows/build-prebuilds.yml
```

To:
```yaml
  build-prebuilds:
    uses: ./.github/workflows/build-prebuilds.yml
    with:
      deps_version: v1  # Update when deps change
```

**Step 3: Add smoke test job after publish** (5 min)

Add after the publish job (after line 82):
```yaml

  smoke-test:
    name: "Smoke Test ${{ matrix.platform }}"
    needs: [publish]
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-24.04
            platform: linux-x64
          - os: macos-15-intel
            platform: darwin-x64
          - os: macos-latest
            platform: darwin-arm64
    steps:
      - name: Wait for NPM Registry Propagation
        run: sleep 30

      - uses: actions/setup-node@v6
        with:
          node-version: "22"

      - name: Get Release Version
        id: version
        run: |
          VERSION="${GITHUB_REF#refs/tags/v}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Testing version: $VERSION"

      - name: Install and Verify
        run: |
          mkdir smoke-test && cd smoke-test
          npm init -y
          npm install @pproenca/node-webcodecs@${{ steps.version.outputs.version }}
          node -e "
            const wc = require('@pproenca/node-webcodecs');
            console.log('Loaded exports:', Object.keys(wc));
            if (typeof wc.VideoDecoder !== 'function') {
              console.error('VideoDecoder not a function');
              process.exit(1);
            }
            if (typeof wc.VideoEncoder !== 'function') {
              console.error('VideoEncoder not a function');
              process.exit(1);
            }
            console.log('Smoke Test Passed!');
          "
```

**Step 4: Verify YAML validity** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

**Step 5: Commit** (30 sec)

```bash
git add .github/workflows/release.yml && git commit -m "feat(ci): add smoke test phase to release.yml

- Smoke test runs AFTER npm publish (no race condition)
- Tests on all 3 platforms
- Verifies published package loads correctly"
```

---

## Task Group 4: Cleanup Dead Code

### Task 7: Delete npm-smoke.yml

**Files:**
- Delete: `.github/workflows/npm-smoke.yml`

**Context:** The smoke test now lives in release.yml. This separate workflow caused race conditions.

**Step 1: Delete the file** (30 sec)

```bash
rm .github/workflows/npm-smoke.yml
```

**Step 2: Verify deletion** (30 sec)

```bash
ls .github/workflows/npm-smoke.yml 2>&1 | grep "No such file"
```

Expected: `ls: .github/workflows/npm-smoke.yml: No such file or directory`

**Step 3: Commit** (30 sec)

```bash
git add -A && git commit -m "chore(ci): delete npm-smoke.yml

Race condition eliminated - smoke test now in release.yml after publish"
```

---

## Task Group 5: Verification

### Task 8: Code Review

**Files:**
- Review: All modified workflows and build files

**Step 1: Verify no cache-restore in product workflows** (1 min)

```bash
grep -n "cache/restore" .github/workflows/ci.yml .github/workflows/build-prebuilds.yml .github/workflows/release.yml 2>/dev/null
```

Expected: No matches

**Step 2: Verify no system fallbacks** (1 min)

```bash
grep -n "brew install ffmpeg\|apt-get.*ffmpeg\|cache miss" .github/workflows/*.yml
```

Expected: No matches in product workflows (only comments if any)

**Step 3: Verify deps-vN download is used** (1 min)

```bash
grep -n "fetch-gh-release-asset\|deps-" .github/workflows/*.yml
```

Expected: Matches in ci.yml, build-prebuilds.yml

**Step 4: Verify npm-smoke.yml is gone** (30 sec)

```bash
ls .github/workflows/npm-smoke.yml 2>&1
```

Expected: `No such file or directory`

**Step 5: Verify ffmpeg-paths.js uses pkg-config** (30 sec)

```bash
grep -n "runPkgConfig\|PKG_CONFIG_PATH" gyp/ffmpeg-paths.js
```

Expected: Matches showing pkg-config integration

**Step 6: Validate all YAML files** (1 min)

```bash
for f in .github/workflows/*.yml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "$f: valid" || echo "$f: INVALID"
done
```

Expected: All `valid`

**Step 7: Validate binding.gyp** (30 sec)

```bash
python3 -c "import json; json.load(open('binding.gyp'))" && echo "binding.gyp: valid"
```

Expected: `binding.gyp: valid`

**Step 8: Commit any fixes** (30 sec)

```bash
git diff --quiet || git add -A && git commit -m "fix(ci): address code review findings"
```

---

## Summary of Changes

| File | Action | Reason |
|------|--------|--------|
| `build-ffmpeg.yml` | Modify | Manual-only trigger, creates GitHub Release with FFmpeg |
| `gyp/ffmpeg-paths.js` | Modify | Run pkg-config with correct PKG_CONFIG_PATH for CI builds |
| `binding.gyp` | Modify | Simplify to use ffmpeg-paths.js output, add libavformat |
| `ci.yml` | Modify | Download FFmpeg from deps-vN release, remove cache/fallback |
| `build-prebuilds.yml` | Modify | Download FFmpeg from deps-vN release, remove cache/fallback |
| `release.yml` | Modify | Add smoke test job after publish, pass deps_version |
| `npm-smoke.yml` | Delete | Race condition - smoke test now in release.yml |

## Post-Implementation: Create Initial Release

After all tasks are complete, run `build-ffmpeg.yml` manually with `deps_version: v1` to create the first FFmpeg release:

```bash
gh workflow run build-ffmpeg.yml -f deps_version=v1
```

Then verify the release was created:

```bash
gh release view deps-v1
```

## Verification Checklist

- [ ] `build-ffmpeg.yml` creates GitHub Release with deps-vN tag
- [ ] `gyp/ffmpeg-paths.js` runs pkg-config with correct PKG_CONFIG_PATH
- [ ] `binding.gyp` uses ffmpeg-paths.js output (no duplicate pkg-config)
- [ ] `ci.yml` downloads from deps-vN (no cache/restore)
- [ ] `build-prebuilds.yml` downloads from deps-vN (no cache/restore)
- [ ] `release.yml` has smoke-test job after publish
- [ ] `npm-smoke.yml` deleted
- [ ] No `brew install ffmpeg` or `apt-get install ffmpeg` fallbacks
- [ ] All YAML files validate
- [ ] CI completes in <10 minutes (vs 60+ before)
