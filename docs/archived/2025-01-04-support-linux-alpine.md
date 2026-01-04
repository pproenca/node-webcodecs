# Alpine Linux (musl) Support Implementation Plan

**Goal:** Add musl (Alpine Linux) support to node-webcodecs by leveraging existing FFmpeg musl build infrastructure.

**Status:** Infrastructure exists (FFmpeg musl builds), needs CI integration + runtime detection.

**Previous Work:** glibc tagging fully implemented (commit: `feat: add libc tagging support for Linux packages`)

---

## Key Findings from Documentation Review

### Official N-API Documentation
- **nodejs.org/api/n-api.html#uploading-precompiled-binaries** does NOT cover libc tagging
- Libc tagging is handled by prebuildify tool, not Node.js N-API
- N-API docs only briefly mention prebuildify as a tool option

### Prebuildify Documentation (github.com/prebuild/prebuildify)
- `--tag-libc` flag: Auto-detects libc (defaults to glibc, detects musl on Alpine)
- Can override with `--tag-libc --libc musl` for explicit musl builds
- Adds libc identifier to prebuild filenames
- `node-gyp-build` selects appropriate binary at runtime based on system libc

### Existing Infrastructure Analysis

**FFmpeg Builds (`build-ffmpeg.yml`):**
- ✅ `build-linux-x64` (lines 77-118): Alpine container → musl FFmpeg static libs
- ✅ `build-linux-x64-glibc` (lines 127-167): Ubuntu container → glibc FFmpeg static libs
- Both upload to GitHub releases: `ffmpeg-linux-x64.tar.gz` (musl), `ffmpeg-linux-x64-glibc.tar.gz` (glibc)

**Current CI (`ci.yml`):**
- ❌ Only builds glibc variant: `platform: linux-x64` downloads `ffmpeg-linux-x64-glibc.tar.gz`
- ❌ No musl build in matrix

**Runtime Dependencies:**
- ✅ `detect-libc@2.1.2` already installed (can use for runtime libc detection)

---

## Background: Current Architecture

### What You Have ✅
1. **glibc support fully implemented** - `@pproenca/node-webcodecs-linux-x64-glibc` package
2. **FFmpeg musl builds** - `build-ffmpeg.yml` produces musl static libs (Alpine container)
3. **FFmpeg glibc builds** - `build-ffmpeg.yml` produces glibc static libs (Ubuntu container)
4. **Prebuildify with libc tagging** - `scripts/ci/ci-workflow.ts` supports `--libc` flag
5. **Runtime loader** - `lib/binding.ts` maps platform to package (needs libc detection)
6. **detect-libc package** - Already installed as dependency

### What's Missing ❌
1. **musl in CI build matrix** - No `linux-x64-musl` entry in `ci.yml`
2. **Runtime libc detection** - `lib/binding.ts` hardcodes `linux-x64` → `linux-x64-glibc`
3. **musl platform package** - Missing `@pproenca/node-webcodecs-linux-x64-musl`
4. **optionalDependencies** - Missing musl package in `package.json`

---

## Implementation Plan

### Phase 1: Update CI Build Matrix (.github/workflows/ci.yml)

**File:** `.github/workflows/ci.yml`
**Lines:** 160-203 (build matrix and FFmpeg download)

#### Changes Required

**1. Add musl to build matrix** (after line 169):
```yaml
matrix:
  include:
    - os: ubuntu-24.04
      platform: linux-x64-glibc  # Rename from linux-x64
      arch: x64
      libc: glibc               # Add libc field
    - os: ubuntu-24.04          # NEW ENTRY
      platform: linux-x64-musl  # NEW
      arch: x64                  # NEW
      libc: musl                 # NEW
      container: alpine:latest   # NEW - Use Alpine for musl build
    - os: macos-15-intel
      platform: darwin-x64
      arch: x64
    - os: macos-15
      platform: darwin-arm64
      arch: arm64
```

**2. Update FFmpeg download logic** (line 200):
```yaml
# Current:
file: ffmpeg-${{ matrix.platform }}${{ runner.os == 'Linux' && '-glibc' || '' }}.tar.gz

# New (simplified):
file: ffmpeg-${{ matrix.platform }}.tar.gz
```
**Rationale:** Platform name now includes libc suffix, so no conditional logic needed.

**3. Update prebuildify command** (line 208):
```yaml
# Already supports --libc flag from previous implementation
run: npx tsx scripts/ci/ci-workflow.ts prebuildify --arch "${{ matrix.arch }}" --platform "${{ matrix.platform }}"${{ runner.os == 'Linux' && ' --libc ' }}${{ matrix.libc || '' }}
```

**4. Update package-platform command** (line 222):
```yaml
# Already supports --libc flag from previous implementation
run: npx tsx scripts/ci/ci-workflow.ts package-platform ... ${{ runner.os == 'Linux' && ' --libc ' }}${{ matrix.libc || '' }}
```

**5. Update artifact names** (lines 227-228, 235):
```yaml
# Already use matrix.platform which now includes -glibc or -musl
name: platform-pkg-${{ matrix.platform }}
path: packages/@pproenca/node-webcodecs-${{ matrix.platform }}.tar
```

#### Docker Container Requirement for musl

**Challenge:** GitHub-hosted `ubuntu-24.04` runner uses glibc. To build musl binaries, we need Alpine.

**Solution:** Use `container: alpine:latest` in matrix entry (shown above).

**Build tools installation:**
Alpine needs different package manager commands than Ubuntu:
```bash
# Current (Ubuntu):
apt-get install -y build-essential python3 pkg-config

# New (Alpine):
apk add --no-cache build-base python3 pkgconf
```

**Action:** Update `scripts/ci/ci-workflow.ts install-build-tools` to detect Alpine and use `apk` instead of `apt-get`.

---

### Phase 2: Add Runtime libc Detection (lib/binding.ts)

**File:** `lib/binding.ts`
**Lines:** 9-13 (PLATFORMS mapping), 22-40 (loadBinding function)

#### Current Implementation Problem

```typescript
// Line 9-13: Hardcoded mapping
const PLATFORMS: Record<string, string> = {
  'darwin-arm64': '@pproenca/node-webcodecs-darwin-arm64',
  'darwin-x64': '@pproenca/node-webcodecs-darwin-x64',
  'linux-x64': '@pproenca/node-webcodecs-linux-x64-glibc',  // ❌ Always glibc
};

// Line 23-24: No libc detection
const platform = `${process.platform}-${process.arch}`;
const pkg = PLATFORMS[platform];
```

**Problem:** Alpine Linux users will incorrectly download glibc package, causing `GLIBC not found` errors.

#### Proposed Solution

**Option 1: Use detect-libc package (RECOMMENDED)**
```typescript
import GLIBC from 'detect-libc';

const PLATFORMS: Record<string, string> = {
  'darwin-arm64': '@pproenca/node-webcodecs-darwin-arm64',
  'darwin-x64': '@pproenca/node-webcodecs-darwin-x64',
  'linux-x64-glibc': '@pproenca/node-webcodecs-linux-x64-glibc',
  'linux-x64-musl': '@pproenca/node-webcodecs-linux-x64-musl',
};

function loadBinding(): unknown {
  let platform = `${process.platform}-${process.arch}`;

  // Detect libc on Linux
  if (process.platform === 'linux') {
    const libc = GLIBC.familySync(); // Returns 'glibc' or 'musl'
    if (libc) {
      platform = `${platform}-${libc}`;
    } else {
      // Fallback to glibc (most common)
      platform = `${platform}-glibc`;
    }
  }

  const pkg = PLATFORMS[platform];
  // ... rest of function unchanged
}
```

**Option 2: Use Node.js built-in detection** (no external dependency)
```typescript
function detectLibc(): string {
  // Node.js 16+ includes glibc version in process.report
  const report = process.report?.getReport?.();
  if (report?.header?.glibcVersionRuntime) {
    return 'glibc';
  }
  // If no glibc detected, assume musl
  return 'musl';
}
```

**Recommendation:** Use **Option 1** (`detect-libc`) because:
- ✅ Already installed as dependency
- ✅ Maintained by Node.js team
- ✅ Handles edge cases (Android, FreeBSD)
- ✅ More reliable than process.report heuristics

#### Fallback Strategy

If libc detection fails or returns unknown value:
- **Default to glibc** (most common Linux distribution)
- **Log warning** to stderr suggesting manual package installation
- **Still attempt to load** (might work on some systems)

---

### Phase 3: Update Platform Packages Configuration

#### File 1: package.json

**Line 78-81:** optionalDependencies

**Current:**
```json
"optionalDependencies": {
  "@pproenca/node-webcodecs-darwin-arm64": "0.1.1-alpha.8",
  "@pproenca/node-webcodecs-darwin-x64": "0.1.1-alpha.8",
  "@pproenca/node-webcodecs-linux-x64-glibc": "0.1.1-alpha.8"
}
```

**Add:**
```json
"optionalDependencies": {
  "@pproenca/node-webcodecs-darwin-arm64": "0.1.1-alpha.8",
  "@pproenca/node-webcodecs-darwin-x64": "0.1.1-alpha.8",
  "@pproenca/node-webcodecs-linux-x64-glibc": "0.1.1-alpha.8",
  "@pproenca/node-webcodecs-linux-x64-musl": "0.1.1-alpha.8"  // NEW
}
```

**Note:** `detect-libc` should be moved from extraneous to `dependencies`:
```json
"dependencies": {
  "node-gyp-build": "^4.8.0",
  "detect-libc": "^2.1.2"  // NEW - needed for runtime libc detection
}
```

#### File 2: scripts/create-platform-packages.ts

**Line 29-33:** PLATFORMS array

**Current:**
```typescript
const PLATFORMS: PlatformConfig[] = [
  {name: 'darwin-arm64', os: 'darwin', cpu: 'arm64'},
  {name: 'darwin-x64', os: 'darwin', cpu: 'x64'},
  {name: 'linux-x64-glibc', os: 'linux', cpu: 'x64', libc: 'glibc'},
];
```

**Add:**
```typescript
const PLATFORMS: PlatformConfig[] = [
  {name: 'darwin-arm64', os: 'darwin', cpu: 'arm64'},
  {name: 'darwin-x64', os: 'darwin', cpu: 'x64'},
  {name: 'linux-x64-glibc', os: 'linux', cpu: 'x64', libc: 'glibc'},
  {name: 'linux-x64-musl', os: 'linux', cpu: 'x64', libc: 'musl'},  // NEW
];
```

**Action:** Run `npm run create-platform-packages` to scaffold musl package directory.

---

### Phase 4: Handle Alpine Container Build Tools

**File:** `scripts/ci/ci-workflow.ts`
**Function:** `installBuildTools`

#### Challenge

Alpine uses `apk` package manager, not `apt-get`. Current implementation only supports Ubuntu/Debian.

#### Solution

Add Alpine detection and use correct package manager:

```typescript
export function installBuildTools(runner: CommandRunner, os: string): void {
  if (os === 'linux') {
    // Detect if running in Alpine (musl container)
    const isAlpine = existsSync('/etc/alpine-release');

    if (isAlpine) {
      // Alpine Linux - use apk
      runner.runOrThrow('apk', ['add', '--no-cache', 'build-base', 'python3', 'pkgconf'], {stdio: 'inherit'});
    } else {
      // Ubuntu/Debian - use apt-get
      runner.runOrThrow('apt-get', ['update'], {stdio: 'inherit'});
      runner.runOrThrow('apt-get', ['install', '-y', 'build-essential', 'python3', 'pkg-config'], {stdio: 'inherit'});
    }
  } else if (os === 'macos') {
    // macOS - use brew (unchanged)
    runner.runOrThrow('brew', ['install', 'pkg-config'], {stdio: 'inherit'});
  }
}
```

**Validation:** Test that Alpine container can install build tools successfully.

---

### Phase 5: Update Documentation

#### File 1: docs/libc-tagging-implementation.md

**Lines 154-168:** Update "Supported/Unsupported Linux Distributions"

**Change:**
```markdown
### Unsupported Linux Distributions (musl) ⚠️
```

**To:**
```markdown
### Supported Linux Distributions (musl) ✅
- Alpine Linux (v3.14+)
- Void Linux (musl variant)
- Other musl-based distributions

**Installation:**
```bash
npm install @pproenca/node-webcodecs
# Automatically selects musl package on Alpine
```
```

#### File 2: docs/build-system.md

Update platform support table to include musl variant.

---

### Phase 6: Testing & Validation

#### Before Publishing

**1. Build scripts compile successfully:**
```bash
npm run build:scripts
# ✅ Verify no TypeScript errors
```

**2. Create platform packages:**
```bash
npm run create-platform-packages
# ✅ Verify packages/@pproenca/node-webcodecs-linux-x64-musl/ exists
# ✅ Check package.json includes "libc": ["musl"]
```

**3. Test Alpine container build (local):**
```bash
docker run --rm -it -v $(pwd):/work -w /work alpine:latest sh
apk add --no-cache nodejs npm build-base python3 pkgconf
npm install --ignore-scripts
npm run build:native
# ✅ Verify native addon compiles
```

#### After CI Runs

**1. Verify musl artifact created:**
```yaml
# CI should upload: platform-pkg-linux-x64-musl
```

**2. Test installation on Alpine:**
```bash
docker run --rm -it alpine:latest sh
apk add nodejs npm
npm install @pproenca/node-webcodecs
# ✅ Verify musl package installed:
ls node_modules/@pproenca/node-webcodecs-linux-x64-musl/
```

**3. Test installation on Ubuntu (verify glibc still works):**
```bash
docker run --rm -it ubuntu:24.04 bash
apt update && apt install -y nodejs npm
npm install @pproenca/node-webcodecs
# ✅ Verify glibc package installed:
ls node_modules/@pproenca/node-webcodecs-linux-x64-glibc/
```

**4. Verify binary loading:**
```javascript
const {binding} = require('@pproenca/node-webcodecs/dist/binding');
console.log('Loaded successfully:', binding !== null);
```

---

## Critical Files Reference

| File | Lines | Changes |
|------|-------|---------|
| `.github/workflows/ci.yml` | 160-203 | Add musl to build matrix, update FFmpeg download |
| `lib/binding.ts` | 1-60 | Add detect-libc import, runtime libc detection |
| `package.json` | 78-85 | Add musl to optionalDependencies, move detect-libc to dependencies |
| `scripts/create-platform-packages.ts` | 29-33 | Add musl to PLATFORMS array |
| `scripts/ci/ci-workflow.ts` | `installBuildTools()` | Add Alpine detection and apk support |
| `docs/libc-tagging-implementation.md` | 154-168 | Update musl support status |
| `docs/build-system.md` | Platform table | Add musl variant |

---

## Success Criteria

1. ✅ CI builds both glibc and musl variants
2. ✅ Runtime libc detection works on both glibc and musl systems
3. ✅ Alpine Linux users can `npm install` and get musl package
4. ✅ Ubuntu/Debian users still get glibc package (no regression)
5. ✅ All tests pass on both platforms
6. ✅ Documentation updated to reflect musl support

---

## Implementation Sequence

**Follow this order to minimize errors:**

1. **Phase 3 first** - Update `scripts/create-platform-packages.ts` and run it to create musl package directory
2. **Phase 3** - Update `package.json` with musl optionalDependency
3. **Phase 2** - Update `lib/binding.ts` with libc detection
4. **Phase 4** - Update `scripts/ci/ci-workflow.ts` for Alpine build tools
5. **Phase 1** - Update `.github/workflows/ci.yml` with musl matrix entry
6. **Phase 5** - Update documentation
7. **Phase 6** - Test locally with Docker
8. **Build scripts** - Run `npm run build:scripts` to verify TypeScript compiles

**Rationale:** Creating platform packages and dependencies first ensures runtime loader has correct imports when we add libc detection.

---

## Risks & Mitigations

### Risk 1: Alpine container build tools fail
**Mitigation:** Test locally with `docker run alpine:latest` before pushing to CI.

### Risk 2: libc detection fails on edge case distros
**Mitigation:** Fallback to glibc (most common). Log warning to stderr.

### Risk 3: Musl package breaks glibc users
**Mitigation:** Keep separate packages (`-glibc` vs `-musl`). Test both in Docker before release.

### Risk 4: FFmpeg musl build incompatible with node-gyp-build
**Mitigation:** Verify FFmpeg static libs from `build-ffmpeg.yml` work with `binding.gyp` (already tested for glibc).

---

## Open Questions

**Q1: Should we add `detect-libc` to `dependencies` or keep it extraneous?**
**A:** Move to `dependencies` - it's needed for runtime libc detection, not optional.

**Q2: What if libc detection returns `null` or `unknown`?**
**A:** Fallback to glibc (most common Linux). Log warning suggesting manual package selection.

**Q3: Should we test Windows in this PR?**
**A:** No, out of scope. Windows requires separate FFmpeg Windows build implementation.

---

## Expected Outcome

After implementation:

**Platform support:**
- ✅ macOS x64 (Intel)
- ✅ macOS arm64 (Apple Silicon)
- ✅ Linux x64 glibc (Ubuntu, Debian, RHEL, CentOS, etc.)
- ✅ Linux x64 musl (Alpine, Void Linux)
- ❌ Windows (future work)

**User experience:**
```bash
# Alpine Linux
npm install @pproenca/node-webcodecs
# → Installs @pproenca/node-webcodecs-linux-x64-musl

# Ubuntu/Debian
npm install @pproenca/node-webcodecs
# → Installs @pproenca/node-webcodecs-linux-x64-glibc
```

**No user action required** - libc detection is automatic.

---

## Summary

**Infrastructure:** ✅ Already exists (FFmpeg musl builds in `build-ffmpeg.yml`)
**Implementation:** Add musl to CI matrix + runtime libc detection
**Complexity:** Low (leverages existing glibc implementation)
**Testing:** Docker-based (Alpine + Ubuntu)
**Documentation compliance:** prebuildify GitHub docs (Node.js N-API docs don't cover libc tagging)

**Total files to modify:** 7
**Estimated implementation time:** 1-2 hours
**Risk level:** Low (separate packages prevent breaking glibc users)
