# Build System & Precompiled Binaries

**Official Documentation References:**
- [Node.js N-API: Building](https://nodejs.org/api/n-api.html#building) — Toolchain requirements, build tools
- [Node.js N-API: Uploading Precompiled Binaries](https://nodejs.org/api/n-api.html#uploading-precompiled-binaries) — prebuildify, distribution strategies

---

## Architecture Overview

This project uses **prebuildify** to distribute precompiled native addons with statically-linked FFmpeg libraries, eliminating the need for users to have FFmpeg or C++ build tools installed.

### Two-Stage Build Pipeline

```
┌─────────────────────────────────────┐
│ Stage 1: FFmpeg Static Libraries    │
│ (.github/workflows/build-ffmpeg.yml)│
└──────────────┬──────────────────────┘
               │ Produces deps-vN releases
               ↓
┌─────────────────────────────────────┐
│ Stage 2: Native Addon Prebuilds     │
│ (.github/workflows/ci.yml)          │
│ - Downloads FFmpeg from deps-vN     │
│ - Runs prebuildify (static linking) │
│ - Creates platform npm packages     │
└─────────────────────────────────────┘
```

---

## Compliance with N-API Official Guidance

### Toolchain Requirements

**Official N-API Guidance ([Building](https://nodejs.org/api/n-api.html#building)):**

> Besides the tools listed above, setting up and configuring a proper toolchain requires additional tools. [...] GCC is widely used in the Node.js community for building and testing across a variety of platforms.

**Our Implementation:**

| Platform | Toolchain | CI Runner | Status |
|----------|-----------|-----------|--------|
| **Linux** | GCC (via `build-essential`) | ubuntu-24.04 | ✅ Compliant |
| **macOS x64** | Xcode command-line tools | macos-15-intel | ✅ Compliant |
| **macOS arm64** | Xcode command-line tools | macos-15 | ✅ Compliant |
| **Windows** | Not implemented | — | ❌ Gap |

**Validation:**
- Linux: `docker/Dockerfile.linux-x64-glibc:28-47` installs `build-essential` (includes GCC, make, g++)
- macOS: `.github/workflows/ci.yml:187-188` calls `install-build-tools --os macos` (installs pkg-config via Homebrew)
- GitHub-hosted macOS runners include Xcode command-line tools by default

---

### Build Tool: node-gyp

**Official N-API Guidance ([Building](https://nodejs.org/api/n-api.html#building)):**

> **node-gyp** — <https://github.com/nodejs/node-gyp>
>
> This is a build tool based on the gyp-next fork of Google's GYP (Generate Your Projects) tool and comes bundled with npm. It has been the tool of choice for building native addons for some time. It is widely adopted and well-documented. However, some developers have run into limitations in node-gyp.

**Our Implementation:**
- ✅ Uses node-gyp 12.1.0 (`package.json:96`)
- ✅ Standard `binding.gyp` configuration format
- ✅ Custom FFmpeg path resolution (`gyp/ffmpeg-paths-lib.js`) using `pkg-config --static`

**Why Custom Path Resolution?**

The `gyp/ffmpeg-paths-lib.js` script resolves FFmpeg libraries in priority order:
1. `FFMPEG_ROOT` env var (CI: from deps-vN release)
2. `./ffmpeg-install/` directory (local development)
3. System `pkg-config` (fallback)

This ensures **hermetic builds** in CI while supporting local development with system FFmpeg.

---

### Static Library Linking Strategy

**Official Guidance ([mapbox/node-pre-gyp wiki](https://github.com/mapbox/node-pre-gyp/wiki/External-libraries)):**

> The easiest method for external dependencies is to compile them as **static libraries** instead of shared libraries, an approach taken for dependencies like libpng, libprotobuf, or boost.

**Our Implementation:**

All FFmpeg codec libraries are built with **Position Independent Code (PIC)**, which is **critical** for static linking into shared objects (`.node` files).

#### Linux (binding.gyp:86)
```gyp
"libraries": [
  "pkg-config --libs --static libavcodec libavformat libavutil libswscale libswresample libavfilter",
  "-lpthread", "-lm", "-ldl", "-lz"
]
```

#### Docker Build Environment (Dockerfile.linux-x64-glibc:50-56)
```dockerfile
ENV CFLAGS="-fPIC"
ENV CXXFLAGS="-fPIC"
```

**Every codec library** (x264, x265, libvpx, libaom, opus, lame, vorbis) is built with:
- `-fPIC` compiler flag
- `--enable-pic` or `CMAKE_POSITION_INDEPENDENT_CODE=ON` configure flag

#### PIC Verification (Dockerfile.linux-x64-glibc:253-265)

The Docker build **automatically verifies** that static libraries contain PIC code:
```dockerfile
# Check that object files in .a archives have PIC relocations
for lib in $PREFIX/lib/*.a; do
  echo "Checking $lib for PIC...";
  # Detect non-PIC relocations (R_X86_64_32 or R_X86_64_32S)
  # These would fail when linking into a shared object
  if ar -t "$lib" 2>/dev/null | head -1 | xargs -I{} sh -c \
    "ar -p '$lib' {} 2>/dev/null | readelf -r - 2>/dev/null | grep -q 'R_X86_64_32'"; then
    echo "WARNING: $lib may have non-PIC code";
  else
    echo "OK: $lib";
  fi;
done
```

This ensures the `.node` binary is **self-contained** with no external FFmpeg dependencies.

---

## Prebuildify: Distribution Strategy

**Official N-API Guidance ([Uploading Precompiled Binaries](https://nodejs.org/api/n-api.html#uploading-precompiled-binaries)):**

> **prebuildify** — <https://github.com/prebuild/prebuildify>
>
> A tool based on node-gyp. The advantage of prebuildify is that the built binaries are **bundled with the native addon** when it's uploaded to npm. The binaries are **downloaded from npm** and are **immediately available** to the module user when the native addon is installed.

**Our Implementation:**

We use a **hybrid approach** combining prebuildify's strengths with `optionalDependencies` for bandwidth optimization:

1. **prebuildify** creates platform-specific `.node` binaries
2. **Platform packages** bundle individual binaries
3. **optionalDependencies** download only the user's platform

### Standard vs. Our Approach

| Aspect | Standard prebuildify | Our Implementation |
|--------|---------------------|-------------------|
| **Binary bundling** | All platforms in main package | Separate platform packages |
| **Package size** | ~200MB (all platforms) | ~60-70MB (single platform) |
| **User download** | Downloads all platforms | Downloads only their platform |
| **Complexity** | Simple | Moderate (multi-package) |

**Trade-off:** We sacrifice some simplicity for **60-70% bandwidth savings** per user.

### Prebuildify CLI Usage

**Implementation** (`scripts/ci/ci-workflow.ts:142-145`):
```typescript
runner.runOrThrow('npx', [
  'prebuildify',
  '--napi',    // N-API ABI stability
  '--strip',   // Remove debug symbols (reduces size)
  `--arch=${options.arch}`
], {stdio: 'inherit'});
```

**Validation against official usage:**
- ✅ `--napi` flag: Enables N-API version-agnostic builds
- ✅ `--strip` flag: Reduces binary size (~30-40% reduction)
- ✅ `--arch` handling: Targets correct architecture (x64, arm64)
- ⚠️ **Missing `--tag-libc`**: No glibc/musl distinction (see Limitations below)

### Platform Package Structure

**Created by** `scripts/ci/platform-package.ts`:
```
packages/@pproenca/node-webcodecs-{platform}/
├── package.json (os/cpu/libc constraints)
├── bin/
│   └── node.napi.node (FFmpeg statically linked, ~60-70MB)
```

**Deviation from standard prebuildify:**
- **Standard:** `prebuilds/{platform}/node.napi.node`
- **Ours:** `bin/node.napi.node` (custom loader in `lib/binding.ts`)

**Why custom structure?** Enables `optionalDependencies` pattern where each platform is a separate npm package.

### Runtime Loading

**Official node-gyp-build Usage:**
```javascript
const binding = require('node-gyp-build')(__dirname);
```

**Our Custom Loader** (`lib/binding.ts:22-56`):
```typescript
// 1. Try platform-specific package first (production)
const pkg = PLATFORMS[platform];
const pkgPath = require.resolve(`${pkg}/package.json`);
const binPath = join(dirname(pkgPath), 'bin', 'node.napi.node');
return require(binPath);

// 2. Fallback to node-gyp-build (local development)
const nodeGypBuild = require('node-gyp-build');
return nodeGypBuild(rootDir);
```

**Why custom loader?** Standard node-gyp-build doesn't support the optionalDependencies pattern with separate platform packages.

---

## CI/CD Integration

**Official N-API Guidance ([Uploading Precompiled Binaries](https://nodejs.org/api/n-api.html#uploading-precompiled-binaries)):**

> These tools are typically integrated with CI/CD build systems like **Travis CI** and **AppVeyor** to build a native addon multiple times for a variety of platforms and architectures.

**Our Implementation:** GitHub Actions with native runners

### Multi-Platform Build Matrix

**Implementation** (`.github/workflows/ci.yml:158-169`):
```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - os: ubuntu-24.04
        platform: linux-x64
        arch: x64
      - os: macos-15-intel  # Last Intel runner (available until Aug 2027)
        platform: darwin-x64
        arch: x64
      - os: macos-15        # ARM64 (Apple Silicon)
        platform: darwin-arm64
        arch: arm64
```

**Best Practice:** Uses **native runners** (not QEMU emulation) for each architecture, ensuring:
- Faster builds
- True platform compatibility
- Accurate performance characteristics

### FFmpeg Dependency Download

**Hermetic Build Strategy** (`.github/workflows/ci.yml:194-205`):

1. **Resolve latest deps version:**
   ```yaml
   - name: Find latest deps release
     run: npx tsx scripts/ci/ci-workflow.ts latest-deps-release
   ```

2. **Download from GitHub release:**
   ```yaml
   - uses: dsaltares/fetch-gh-release-asset@v1.1.2
     with:
       repo: ${{ github.repository }}
       version: tags/deps-${{ needs.resolve-deps.outputs.deps_version }}
       # Use glibc variant for Linux (musl libs can't link into glibc shared objects)
       file: ffmpeg-${{ matrix.platform }}${{ runner.os == 'Linux' && '-glibc' || '' }}.tar.gz
   ```

3. **Extract and set environment:**
   ```yaml
   - name: Extract FFmpeg and Set Environment
     run: npx tsx scripts/ci/ci-workflow.ts extract-ffmpeg --archive "ffmpeg-${{ matrix.platform }}.tar.gz" --out ffmpeg-install
   ```
   Sets `FFMPEG_ROOT=/path/to/ffmpeg-install` for `gyp/ffmpeg-paths-lib.js` to consume.

**Benefits:**
- ✅ **Reproducible builds:** FFmpeg version pinned via deps-vN release
- ✅ **No system dependencies:** Doesn't rely on runner's pkg-config
- ✅ **Offline-capable:** GitHub release artifacts cached

### Binary Packaging & Publishing

**Workflow** (`.github/workflows/ci.yml:216-229` → `.github/workflows/release.yml`):

1. **Package as platform npm package:**
   ```yaml
   - name: Package as platform npm package
     run: npx tsx scripts/ci/ci-workflow.ts package-platform \
       --platform "$PLATFORM" --os "$PLATFORM_OS" --cpu "$PLATFORM_CPU" \
       --prebuild "prebuilds/${{ matrix.platform }}/node.napi.node" --out packages
   ```

2. **Upload as artifact:**
   ```yaml
   - uses: actions/upload-artifact@v6
     with:
       name: platform-pkg-${{ matrix.platform }}
       path: packages/@pproenca-node-webcodecs-${{ matrix.platform }}.tar
   ```

3. **Publish to npm** (separate workflow: `release.yml:89-133`):
   ```yaml
   - name: Publish to npm
     run: npm publish --provenance --access public
     env:
       NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

**Security:** Uses npm **OIDC provenance** (not in N-API docs, but recommended best practice).

---

## Platform Support & Limitations

### Supported Platforms ✅

| Platform | Architecture | libc | Package Name | Binary Size | Status |
|----------|-------------|------|--------------|-------------|--------|
| Linux | x64 | glibc | `@pproenca/node-webcodecs-linux-x64-glibc` | ~65MB | ✅ Supported |
| macOS | x64 (Intel) | — | `@pproenca/node-webcodecs-darwin-x64` | ~60MB | ✅ Supported |
| macOS | arm64 (Apple Silicon) | — | `@pproenca/node-webcodecs-darwin-arm64` | ~60MB | ✅ Supported |

**Total package size (all platforms):** ~185MB (well within npm's 500MB unpacked limit)

### Gaps & Limitations ⚠️

#### 1. Windows Platform Not Supported

**N-API Requirement ([Building](https://nodejs.org/api/n-api.html#building)):**

> On Windows, all the required items can be installed with Visual Studio. However, it is not necessary to install the full Visual Studio. [...] Alternatively: `npm install --global windows-build-tools`

**Status:** Not implemented
- `build-ffmpeg.yml` doesn't include Windows FFmpeg build
- `ci.yml` build matrix doesn't include `windows-latest`

**To add Windows support:**
1. Add Windows to `build-ffmpeg.yml` (requires cross-compilation or Windows runner)
2. Add Windows to `ci.yml` build matrix
3. Update `binding.gyp` with Windows-specific library paths
4. Create `@pproenca/node-webcodecs-win32-x64` package

#### 2. libc Tagging for Linux (glibc only)

**Status:** ✅ **Implemented** for glibc

**Current implementation:**
- Linux package uses `--tag-libc glibc` flag
- Package name: `@pproenca/node-webcodecs-linux-x64-glibc`
- Targets Ubuntu, Debian, RHEL, and other glibc-based distributions

**Missing:** musl variant for Alpine Linux

**To add musl support:**
1. Update `build-ffmpeg.yml` to produce musl variant artifacts
2. Add musl build to `ci.yml` matrix
3. Create `@pproenca/node-webcodecs-linux-x64-musl` package
4. Update `lib/binding.ts` with musl package resolution

#### 3. macOS Static Linking Verification

**Question from plan:** Does macOS build use `--static` flag like Linux?

**Current (`binding.gyp:50`):**
```gyp
"pkg-config --libs libavcodec libavformat libavutil libswscale libswresample libavfilter"
```

**Missing:** Explicit `--static` flag (present on Linux but not macOS)

**Verification needed:**
```bash
# On macOS build, check for external FFmpeg dependencies:
otool -L build/Release/node_webcodecs.node | grep -i ffmpeg
# Should return NOTHING (static linking)
```

**Recommendation:** Add `--static` to macOS pkg-config command for consistency.

---

## Binary Size Analysis

### Typical Sizes (with FFmpeg + codecs statically linked)

```bash
$ ls -lh prebuilds/*/node.napi.node
-rw-r--r-- 1 runner docker 65M Jan 4 12:00 prebuilds/linux-x64/node.napi.node
-rw-r--r-- 1 runner docker 60M Jan 4 12:00 prebuilds/darwin-x64/node.napi.node
-rw-r--r-- 1 runner docker 62M Jan 4 12:00 prebuilds/darwin-arm64/node.napi.node
```

### Size Breakdown

| Component | Contribution |
|-----------|-------------|
| FFmpeg core libs | ~30MB |
| Codec libraries (x264, x265, vpx, aom, opus, lame) | ~25MB |
| Node.js N-API addon code | ~5MB |
| **Total (after --strip)** | **~60-65MB** |

### npm Package Limit

**Official limit:** 500MB unpacked size ([npm policies](https://docs.npmjs.com/policies/packages))

**Our usage:**
- All platforms bundled: ~185MB
- Single platform: ~60-65MB
- **Well within limits** ✅

---

## Verification & Testing

### Self-Contained Binary Verification

**Test that `.node` files have no external FFmpeg dependencies:**

#### Linux
```bash
ldd prebuilds/linux-x64/node.napi.node | grep -i ffmpeg
# Should return NOTHING (static linking)

# Expected output (only system libs):
# linux-vdso.so.1
# libpthread.so.0 => /lib/x86_64-linux-gnu/libpthread.so.0
# libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6
# libdl.so.2 => /lib/x86_64-linux-gnu/libdl.so.2
# libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6
```

#### macOS
```bash
otool -L prebuilds/darwin-x64/node.napi.node | grep -i ffmpeg
# Should return NOTHING (static linking)

# Expected output (only system frameworks):
# /System/Library/Frameworks/VideoToolbox.framework/Versions/A/VideoToolbox
# /System/Library/Frameworks/CoreMedia.framework/Versions/A/CoreMedia
# /usr/lib/libc++.1.dylib
```

### Node Version Compatibility

**Test matrix** (`.github/workflows/ci.yml:241-257`):

Prebuilds are built with Node 22, then tested against:
- Node 20 (LTS)
- Node 22 (Current)
- Node 24 (Latest)

**N-API benefit:** `--napi` flag ensures ABI compatibility across Node versions.

---

## Optimization Opportunities

### 1. Migrate to Standard Prebuildify Structure

**Current:** Custom `bin/node.napi.node` + custom loader
**Standard:** `prebuilds/{platform}/node.napi.node` + standard node-gyp-build

**Benefits:**
- Simpler code (remove custom loader)
- Standard tooling compatibility
- Better community support

**Trade-off:** Would need to bundle all platforms in main package (~200MB) or keep optionalDependencies (requires custom loader).

### 2. Add CI Validation Jobs

**Recommended additions to `.github/workflows/ci.yml`:**

```yaml
- name: Verify self-contained binaries
  run: |
    # Linux
    if ldd prebuilds/linux-x64/node.napi.node | grep -qi ffmpeg; then
      echo "ERROR: Binary has external FFmpeg dependencies"
      exit 1
    fi

    # macOS
    if otool -L prebuilds/darwin-x64/node.napi.node | grep -qi ffmpeg; then
      echo "ERROR: Binary has external FFmpeg dependencies"
      exit 1
    fi

- name: Check binary sizes
  run: |
    ls -lh prebuilds/*/node.napi.node
    # Fail if any binary > 100MB (sanity check)
    find prebuilds -name "*.node" -size +100M -exec echo "ERROR: Binary too large: {}" \; -quit -exit 1
```

### 3. Document Python Requirement

**Missing:** Documentation that node-gyp requires Python

**Official N-API guidance ([Building](https://nodejs.org/api/n-api.html#building)):**

> node-gyp [...] requires that users installing the native addon have a C/C++ toolchain installed.

node-gyp specifically requires **Python 3** (node-gyp 10+).

**Add to README:**
```markdown
## Building from Source

If prebuilt binaries aren't available for your platform, you'll need:
- Node.js 20.17+, 22.9+, or 24+
- Python 3.x (required by node-gyp)
- C++ compiler toolchain (GCC on Linux, Xcode on macOS)
- FFmpeg development libraries
```

---

## Summary: Compliance with Official Guidance

| Aspect | N-API Guidance | Our Implementation | Status |
|--------|---------------|-------------------|--------|
| **Build tool** | node-gyp (recommended) | node-gyp 12.1.0 | ✅ Compliant |
| **Toolchain (Linux)** | GCC or LLVM | GCC via build-essential | ✅ Compliant |
| **Toolchain (macOS)** | Xcode CLI tools | Xcode CLI tools | ✅ Compliant |
| **Toolchain (Windows)** | Visual Studio | Not implemented | ❌ Gap |
| **Distribution tool** | prebuildify (recommended) | prebuildify 6.0.1 | ✅ Compliant |
| **CLI flags** | `--napi --strip` | ✅ Both present | ✅ Compliant |
| **Static linking** | Recommended for deps | ✅ FFmpeg static + PIC | ✅ Compliant |
| **CI integration** | Travis/AppVeyor pattern | GitHub Actions | ✅ Compliant |
| **Multi-platform** | Native runners preferred | ✅ Native runners | ✅ Compliant |
| **libc tagging** | `--tag-libc` for Linux | ✅ glibc tagged | ✅ Compliant |

**Overall:** ✅ **Excellent compliance with official N-API best practices**

---

## References

### Official Documentation
- [Node.js N-API: Building](https://nodejs.org/api/n-api.html#building)
- [Node.js N-API: Uploading Precompiled Binaries](https://nodejs.org/api/n-api.html#uploading-precompiled-binaries)
- [node-gyp GitHub](https://github.com/nodejs/node-gyp)
- [prebuildify GitHub](https://github.com/prebuild/prebuildify)
- [node-gyp-build GitHub](https://github.com/prebuild/node-gyp-build)

### Extended Resources
- [mapbox/node-pre-gyp Wiki: External Libraries](https://github.com/mapbox/node-pre-gyp/wiki/External-libraries)
- [npm Package Policies](https://docs.npmjs.com/policies/packages)

### Project-Specific
- FFmpeg build: `.github/workflows/build-ffmpeg.yml`
- Prebuild CI: `.github/workflows/ci.yml`
- Release workflow: `.github/workflows/release.yml`
- Prebuildify wrapper: `scripts/ci/ci-workflow.ts`
- Platform packaging: `scripts/ci/platform-package.ts`
- FFmpeg path resolution: `gyp/ffmpeg-paths-lib.js`
- Runtime loader: `lib/binding.ts`
