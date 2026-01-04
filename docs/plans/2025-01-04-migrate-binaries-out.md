# FFmpeg Prebuilds Repository - Implementation Plan

**Created:** 2026-01-04
**Goal:** Create a dedicated `ffmpeg-prebuilds` repository to streamline FFmpeg + codec dependency packaging, following the sharp-libvips model.

## Executive Summary

This plan creates a standalone repository that:
- **Builds** FFmpeg + codecs (x264, x265, libvpx, libaom, opus, lame) for macOS (x64/arm64) and Linux (glibc/musl)
- **Publishes** to npm as platform-specific packages under `@pproenca` scope
- **Integrates** with node-webcodecs via `optionalDependencies` pattern
- **Reduces** CI build time from 90min → ~30min via parallel matrix builds
- **Simplifies** version management with centralized `versions.properties` file

**Timeline:** 4 weeks phased migration (repo creation → npm publish → integration → cleanup)

---

## Repository Setup

### New Repository: `github.com/pproenca/ffmpeg-prebuilds`

**Directory Structure:**
```
ffmpeg-prebuilds/
├── build/
│   ├── orchestrator.sh          # Delegates to platform scripts
│   ├── macos.sh                  # macOS native builds
│   ├── linux.sh                  # Docker-based Linux builds
│   └── verify.sh                 # Post-build validation
├── platforms/
│   ├── linux-x64-glibc/
│   │   └── Dockerfile            # Ubuntu 24.04 with -fPIC
│   ├── linux-x64-musl/
│   │   └── Dockerfile            # Alpine 3.21 fully static
│   ├── darwin-x64/
│   │   └── README.md             # Native runner docs
│   └── darwin-arm64/
│       └── README.md
├── npm/
│   ├── runtime/                  # @pproenca/ffmpeg-* (binaries)
│   └── dev/                      # @pproenca/ffmpeg-dev-* (libs+headers)
├── scripts/
│   ├── package-npm.ts            # NPM package creation
│   ├── verify-build.ts           # ABI validation
│   └── update-versions.ts        # Dependency update automation
├── .github/
│   └── workflows/
│       ├── build.yml             # Matrix build (parallel)
│       └── release.yml           # Tag-based npm publish
├── versions.properties           # SINGLE SOURCE OF TRUTH
├── README.md
├── LICENSE                       # GPL-2.0+ (due to x264/x265)
└── package.json
```

**Key Files to Create:**

1. **versions.properties** - Centralized dependency tracking
   ```properties
   FFMPEG_VERSION=n8.0
   X264_VERSION=stable
   X265_VERSION=3.6
   LIBVPX_VERSION=v1.15.2
   LIBAOM_VERSION=v3.12.1
   OPUS_VERSION=1.5.2
   LAME_VERSION=3.100
   NASM_VERSION=2.16.03
   MACOS_DEPLOYMENT_TARGET=11.0
   ```

2. **build/orchestrator.sh** - Master build script
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   PLATFORM="${1:-}"
   source versions.properties  # Load all versions

   case "$PLATFORM" in
     darwin-*) exec build/macos.sh "$PLATFORM" ;;
     linux-*)  exec build/linux.sh "$PLATFORM" ;;
     *) echo "Unknown platform: $PLATFORM"; exit 1 ;;
   esac
   ```

3. **platforms/linux-x64-glibc/Dockerfile** - Copy from node-webcodecs
   - Source: `/Users/pedroproenca/Documents/Projects/node-webcodecs/docker/Dockerfile.linux-x64-glibc`
   - Modify: Use versions from build args instead of hardcoded
   - Key requirement: **-fPIC flag on all libraries** (for .node linking)

4. **platforms/linux-x64-musl/Dockerfile** - Copy from node-webcodecs
   - Source: `/Users/pedroproenca/Documents/Projects/node-webcodecs/docker/Dockerfile.linux-x64`
   - Purpose: Fully static binaries for runtime package

5. **build/macos.sh** - Port from node-webcodecs workflow
   - Source: `/Users/pedroproenca/Documents/Projects/node-webcodecs/scripts/ci/build-ffmpeg-workflow.ts` (lines 327-513)
   - Convert TypeScript logic to bash
   - Use versions from `versions.properties`

---

## NPM Package Strategy

### Package Types

**1. Runtime Packages** (binaries only, ~30MB each)
```
@pproenca/ffmpeg-darwin-arm64
@pproenca/ffmpeg-darwin-x64
@pproenca/ffmpeg-linux-x64-glibc
@pproenca/ffmpeg-linux-x64-musl
```

**Structure:**
```
@pproenca/ffmpeg-darwin-arm64/
├── package.json
│   {
│     "name": "@pproenca/ffmpeg-darwin-arm64",
│     "version": "8.0.0",
│     "os": ["darwin"],
│     "cpu": ["arm64"],
│     "files": ["bin/"],
│     "license": "GPL-2.0-or-later"
│   }
└── bin/
    ├── ffmpeg   (executable, chmod 755)
    └── ffprobe
```

**2. Development Packages** (libs + headers, ~180MB each)
```
@pproenca/ffmpeg-dev-darwin-arm64
@pproenca/ffmpeg-dev-darwin-x64
@pproenca/ffmpeg-dev-linux-x64-glibc
@pproenca/ffmpeg-dev-linux-x64-musl
```

**Structure:**
```
@pproenca/ffmpeg-dev-darwin-arm64/
├── package.json
│   {
│     "name": "@pproenca/ffmpeg-dev-darwin-arm64",
│     "version": "8.0.0",
│     "os": ["darwin"],
│     "cpu": ["arm64"],
│     "files": ["lib/", "include/"],
│     "license": "GPL-2.0-or-later"
│   }
├── lib/
│   ├── pkgconfig/
│   │   ├── libavcodec.pc
│   │   └── ...
│   ├── libavcodec.a
│   └── ...
└── include/
    ├── libavcodec/
    └── ...
```

**3. Main Package** (meta-package with optionalDependencies)
```
@pproenca/ffmpeg
```

**package.json:**
```json
{
  "name": "@pproenca/ffmpeg",
  "version": "8.0.0",
  "main": "index.js",
  "types": "index.d.ts",
  "optionalDependencies": {
    "@pproenca/ffmpeg-darwin-arm64": "8.0.0",
    "@pproenca/ffmpeg-darwin-x64": "8.0.0",
    "@pproenca/ffmpeg-linux-x64-glibc": "8.0.0",
    "@pproenca/ffmpeg-linux-x64-musl": "8.0.0"
  }
}
```

**index.js** (binary path resolver):
```javascript
const path = require('path');

const PLATFORMS = {
  'darwin-arm64': '@pproenca/ffmpeg-darwin-arm64',
  'darwin-x64': '@pproenca/ffmpeg-darwin-x64',
  'linux-x64': '@pproenca/ffmpeg-linux-x64-glibc',
};

function getPlatformKey() {
  const platform = `${process.platform}-${process.arch}`;
  if (process.platform === 'linux') {
    // Detect musl vs glibc
    const isMusl = process.report?.getReport?.()?.header?.glibcVersionRuntime === undefined;
    return isMusl ? `${platform}-musl` : `${platform}-glibc`;
  }
  return platform;
}

function getBinaryPath(binary = 'ffmpeg') {
  const platformKey = getPlatformKey();
  const pkg = PLATFORMS[platformKey];
  const pkgPath = require.resolve(`${pkg}/package.json`);
  return path.join(path.dirname(pkgPath), 'bin', binary);
}

module.exports = {
  getBinaryPath,
  ffmpegPath: getBinaryPath('ffmpeg'),
  ffprobePath: getBinaryPath('ffprobe'),
};
```

**Package Creation Script:**
Reference implementation: `/Users/pedroproenca/Documents/Projects/node-webcodecs/scripts/ci/platform-package.ts`

---

## GitHub Actions Workflows

### 1. Matrix Build Workflow (.github/workflows/build.yml)

**Triggers:**
- Push to `main` branch
- Pull requests
- Manual workflow dispatch

**Strategy:**
```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: linux-x64-glibc
        runner: ubuntu-24.04
      - platform: linux-x64-musl
        runner: ubuntu-24.04
      - platform: darwin-x64
        runner: macos-15-intel
      - platform: darwin-arm64
        runner: macos-15
```

**Key Steps:**
1. Load versions from `versions.properties`
2. Run `build/orchestrator.sh <platform>`
3. Package artifacts as `.tar.gz` (preserves permissions)
4. Upload artifacts (14-day retention)
5. Run `scripts/verify-build.ts` for ABI checks

**Critical:** Docker Buildx cache configuration
```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
  with:
    cache-from: type=gha,scope=${{ matrix.platform }}
    cache-to: type=gha,mode=max,scope=${{ matrix.platform }}
```

### 2. Release Workflow (.github/workflows/release.yml)

**Trigger:** Tag push `v*`

**Jobs:**
1. **Build** - Reuses build.yml workflow
2. **Package NPM** - Creates npm packages from artifacts
3. **Publish to npm** - With OIDC provenance
4. **Create GitHub Release** - Attach `.tar.gz` assets

**Publishing Sequence:**
```yaml
# Publish platform packages FIRST
- run: |
    for pkg in npm-dist/@pproenca/ffmpeg-*; do
      npm publish "$pkg" --access public --provenance
    done

# Wait for propagation
- run: sleep 30

# Publish main package (depends on platform packages)
- run: npm publish npm-dist/@pproenca/ffmpeg --access public --provenance
```

**Reference:**
- Current workflow: `/Users/pedroproenca/Documents/Projects/node-webcodecs/.github/workflows/build-ffmpeg.yml`
- Port codec build logic from lines 73-243 (matrix jobs)
- Reuse cache strategy from lines 119-133

---

## Integration with node-webcodecs

### Changes Required in node-webcodecs Repository

**File:** `.github/workflows/ci.yml`

**Current (lines 201-216):**
```yaml
- name: Download FFmpeg from Release
  uses: dsaltares/fetch-gh-release-asset@...
  with:
    version: tags/deps-${{ needs.resolve-deps.outputs.deps_version }}
    file: ffmpeg-linux-x64-glibc.tar.gz
```

**New (fallback pattern):**
```yaml
- name: Install FFmpeg development package
  id: ffmpeg-install
  run: |
    # Try npm first (faster, no GitHub API rate limits)
    if npm view @pproenca/ffmpeg-dev-${{ matrix.platform }} > /dev/null 2>&1; then
      npm install --save-dev @pproenca/ffmpeg-dev-${{ matrix.platform }}@latest
      FFMPEG_ROOT="$(npm root)/@pproenca/ffmpeg-dev-${{ matrix.platform }}"
      echo "FFMPEG_ROOT=$FFMPEG_ROOT" >> "$GITHUB_ENV"
      echo "source=npm" >> "$GITHUB_OUTPUT"
    else
      # Fallback to GitHub releases (for backward compatibility)
      echo "source=github-release" >> "$GITHUB_OUTPUT"
    fi

- name: Download from GitHub Release (fallback)
  if: steps.ffmpeg-install.outputs.source == 'github-release'
  uses: dsaltares/fetch-gh-release-asset@...
  # ... (existing logic)
```

**NO CHANGES NEEDED in:**
- `binding.gyp` - Already supports `FFMPEG_ROOT` env var
- `gyp/ffmpeg-paths-lib.ts` - Already resolves `FFMPEG_ROOT` (line 51-56)

**Testing:**
```bash
# Verify resolution works
export FFMPEG_ROOT="$(npm root)/@pproenca/ffmpeg-dev-linux-x64-glibc"
node gyp/ffmpeg-paths.js include  # Should return header paths
node gyp/ffmpeg-paths.js lib      # Should return library paths
```

**Reference Implementation:**
- FFmpeg resolution: `/Users/pedroproenca/Documents/Projects/node-webcodecs/gyp/ffmpeg-paths-lib.ts` (lines 50-66)
- Platform detection already handles `FFMPEG_ROOT` environment variable

---

## 4-Week Migration Timeline

### Week 1: Repository Setup & Local Testing

**Days 1-2: Scaffold repository**
- [ ] Create `pproenca/ffmpeg-prebuilds` repo on GitHub
- [ ] Initialize directory structure (build/, platforms/, npm/, scripts/)
- [ ] Create `versions.properties` with current codec versions
- [ ] Copy LICENSE (GPL-2.0+) from node-webcodecs
- [ ] Initialize `package.json` with CI dependencies (tsx, @types/node)

**Days 3-4: Port build scripts**
- [ ] Copy Dockerfiles from node-webcodecs:
  - `docker/Dockerfile.linux-x64-glibc` → `platforms/linux-x64-glibc/Dockerfile`
  - `docker/Dockerfile.linux-x64` → `platforms/linux-x64-musl/Dockerfile`
- [ ] Modify Dockerfiles to use build args from `versions.properties`
- [ ] Create `build/orchestrator.sh`, `build/macos.sh`, `build/linux.sh`
- [ ] Port macOS build logic from `scripts/ci/build-ffmpeg-workflow.ts`

**Days 5-7: Local builds & verification**
- [ ] Test darwin-arm64 build locally (native Mac)
- [ ] Test linux-x64-glibc build locally (Docker)
- [ ] Verify output matches current `deps-*` structure
- [ ] Create `build/verify.sh` for ABI checks (otool/ldd)
- [ ] Document build process in README.md

### Week 2: CI/CD Pipeline

**Days 8-10: GitHub Actions setup**
- [ ] Create `.github/workflows/build.yml` (matrix build)
- [ ] Configure Docker Buildx with GHA cache
- [ ] Test parallel builds (verify 4x speedup)
- [ ] Add artifact upload/download steps
- [ ] Verify cache hit rates (target >80%)

**Days 11-12: NPM packaging**
- [ ] Create `scripts/package-npm.ts` (based on `platform-package.ts`)
- [ ] Generate runtime packages (@pproenca/ffmpeg-*)
- [ ] Generate dev packages (@pproenca/ffmpeg-dev-*)
- [ ] Create main package with optionalDependencies
- [ ] Test local `npm pack` and `npm install`

**Days 13-14: Release workflow**
- [ ] Create `.github/workflows/release.yml`
- [ ] Set up npm organization scope (@pproenca)
- [ ] Configure `NPM_TOKEN` secret in GitHub repo settings
- [ ] Test publish to npm (use `@pproenca/ffmpeg@8.0.0-rc.1` tag)
- [ ] Verify installation on all platforms

### Week 3: Integration Testing

**Days 15-16: node-webcodecs integration**
- [ ] Create test branch in node-webcodecs: `chore/ffmpeg-npm-packages`
- [ ] Modify `.github/workflows/ci.yml` (add npm fallback logic)
- [ ] Set `FFMPEG_ROOT` environment variable in CI
- [ ] Run full test suite (`npm run check`)
- [ ] Verify binary compatibility (no ABI mismatches)

**Days 17-18: Cross-platform validation**
- [ ] Test macOS x64 on Intel Mac
- [ ] Test macOS arm64 on M-series Mac
- [ ] Test Linux glibc on Ubuntu 24.04
- [ ] Test Linux musl on Alpine 3.21
- [ ] Verify pkg-config resolution on all platforms

**Days 19-21: Documentation & launch**
- [ ] Write comprehensive README.md for ffmpeg-prebuilds
- [ ] Document migration guide for node-webcodecs users
- [ ] Create CONTRIBUTING.md with release process
- [ ] Publish official `v8.0.0` to npm (remove RC tag)
- [ ] Announce in node-webcodecs README

### Week 4: Migration & Stabilization

**Days 22-24: node-webcodecs migration**
- [ ] Merge `chore/ffmpeg-npm-packages` PR to main
- [ ] Monitor CI for issues (check all matrix jobs green)
- [ ] Update node-webcodecs documentation
- [ ] Mark `build-ffmpeg.yml` as deprecated (add header comment)

**Days 25-28: Monitoring & cleanup**
- [ ] Monitor npm download stats (target >100/week)
- [ ] Address platform-specific issues (if any)
- [ ] Keep `deps-*` workflow active for 4 more weeks (safety buffer)
- [ ] Plan removal of `build-ffmpeg.yml` after 8 weeks total

---

## Critical Files Reference

### Files to Copy/Port from node-webcodecs

**Docker builds:**
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/docker/Dockerfile.linux-x64-glibc` → `platforms/linux-x64-glibc/Dockerfile`
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/docker/Dockerfile.linux-x64` → `platforms/linux-x64-musl/Dockerfile`

**Build logic:**
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/scripts/ci/build-ffmpeg-workflow.ts` (lines 327-513) → `build/macos.sh`
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/.github/workflows/build-ffmpeg.yml` (lines 73-243) → `.github/workflows/build.yml`

**NPM packaging pattern:**
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/scripts/ci/platform-package.ts` → `scripts/package-npm.ts`

### Files to Modify in node-webcodecs

**CI workflow:**
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/.github/workflows/ci.yml` (lines 201-216)
  - Add npm install fallback logic
  - Set `FFMPEG_ROOT` environment variable

**No changes needed:**
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/gyp/ffmpeg-paths-lib.ts` (already supports `FFMPEG_ROOT`)
- `/Users/pedroproenca/Documents/Projects/node-webcodecs/binding.gyp` (already uses gyp/ffmpeg-paths.js)

---

## Success Criteria

**Performance:**
- ✅ Build time reduced from 90min → <30min (parallel matrix)
- ✅ Cache hit rate >80% on codec builds
- ✅ Artifact size <100MB per runtime package, <200MB per dev package

**Quality:**
- ✅ All current node-webcodecs tests pass with npm packages
- ✅ Zero ABI compatibility issues (otool/ldd validation)
- ✅ Binaries work on target platforms (macOS 11.0+, Ubuntu 24.04, Alpine 3.21)

**Adoption:**
- ✅ npm downloads >100/week within 1 month
- ✅ node-webcodecs CI 100% green after migration
- ✅ Zero regressions in node-webcodecs functionality

---

## Risk Mitigation

**Risk:** npm package size limits (500MB max)
**Mitigation:** Separate runtime (30MB) and dev (180MB) packages, use Brotli compression if needed

**Risk:** Platform detection edge cases (libc detection on Linux)
**Mitigation:** Robust detection in index.js, document manual override via `FFMPEG_PLATFORM` env var

**Risk:** Breaking changes in FFmpeg**
**Mitigation:** Pin to stable releases (n8.0), automated testing before publish

**Risk:** macOS runner deprecation (macos-15-intel until Aug 2027)
**Mitigation:** Plan ARM64 cross-compilation fallback, document native build instructions

**Risk:** Supply chain attacks (codec tarball compromise)
**Mitigation:** SHA256 verification for all downloads (already in versions.properties)

---

## Post-Migration Cleanup (After 8 Weeks Stable)

**In node-webcodecs:**
- [ ] Remove `.github/workflows/build-ffmpeg.yml` entirely
- [ ] Remove `docker/Dockerfile.linux-x64*` (no longer needed)
- [ ] Remove `scripts/ci/build-ffmpeg-workflow.ts`
- [ ] Archive old `deps-*` GitHub releases (keep for historical reference)
- [ ] Update README to point to ffmpeg-prebuilds repo

**In ffmpeg-prebuilds:**
- [ ] Set up automated dependency updates (Renovate/Dependabot)
- [ ] Add weekly builds for FFmpeg development branch (optional)
- [ ] Consider adding more platforms (Windows, ARM Linux) based on demand

---

## Implementation Notes

**MUST:**
- Use `versions.properties` as single source of truth for all versions
- Maintain `-fPIC` flag on Linux glibc builds (critical for .node linking)
- Verify ABI compatibility before publishing (otool/ldd checks)
- Publish platform packages BEFORE main package (dependency resolution)
- Keep both systems (deps-* and npm) running during 4-week migration

**MUST NOT:**
- Skip SHA256 verification for downloaded tarballs
- Remove deps-* workflow until npm packages proven stable (8 weeks)
- Publish without testing on all target platforms
- Change FFmpeg version without updating all codec dependencies

**OPTIONAL (Future Enhancements):**
- Windows support (MSVC/MinGW builds)
- ARM Linux support (Raspberry Pi, AWS Graviton)
- WebAssembly builds (wasm32-emscripten)
- Automated security scanning (Snyk, Trivy)
- Performance benchmarks in CI

---

## Conclusion

This plan creates a production-ready FFmpeg prebuilds repository following industry best practices (sharp-libvips model). The phased 4-week migration ensures zero downtime and provides multiple rollback points. The separation of concerns (build repo vs binding repo) enables faster iteration on both FFmpeg updates and node-webcodecs features.

**Next Steps:** Begin Week 1 implementation (repository setup and local testing).
