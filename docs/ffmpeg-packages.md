# FFmpeg Package Management

## Overview

node-webcodecs uses FFmpeg static libraries for native addon compilation. As of this update, FFmpeg dependencies are sourced from **npm packages with automatic fallback** to GitHub releases.

## Package Sources (Priority Order)

### 1. npm Packages (Primary) ✅

**Packages:** `@pproenca/ffmpeg-dev-*` (development libraries + headers)

**Platforms:**
- `@pproenca/ffmpeg-dev-darwin-arm64` (macOS Apple Silicon)
- `@pproenca/ffmpeg-dev-darwin-x64` (macOS Intel)
- `@pproenca/ffmpeg-dev-linux-x64-glibc` (Linux glibc)
- `@pproenca/ffmpeg-dev-linux-x64-musl` (Linux musl/Alpine)

**Advantages:**
- ✅ Faster installation (no GitHub API rate limits)
- ✅ Better caching (npm cache vs GitHub artifact download)
- ✅ Consistent with Node.js ecosystem patterns
- ✅ Supports semantic versioning

**Repository:** [pproenca/ffmpeg-prebuilds](https://github.com/pproenca/ffmpeg-prebuilds)

### 2. GitHub Releases (Fallback) 📦

**Source:** `deps-v*` releases in this repository

**Used when:** npm package doesn't exist yet (e.g., during migration period or new FFmpeg versions)

**File pattern:** `ffmpeg-{platform}.tar.gz`

## CI Workflow Behavior

### Automatic Source Resolution

The CI workflow automatically determines which source to use:

```yaml
1. Check if npm package exists (npm view @pproenca/ffmpeg-dev-{platform})
2. If exists → Install from npm
3. If not exists → Download from GitHub releases (fallback)
```

### Environment Variable

Both sources set `FFMPEG_ROOT` for `gyp/ffmpeg-paths.js`:

```bash
# npm source
FFMPEG_ROOT=$(npm root)/@pproenca/ffmpeg-dev-{platform}

# GitHub release source
FFMPEG_ROOT=./ffmpeg-install
```

The `gyp/ffmpeg-paths-lib.ts` resolver already supports `FFMPEG_ROOT` (lines 51-56), so no changes needed.

## Local Development

### Using npm Packages

```bash
# Install FFmpeg dev package for your platform
npm install --save-dev @pproenca/ffmpeg-dev-darwin-arm64

# Set FFMPEG_ROOT
export FFMPEG_ROOT="$(npm root)/@pproenca/ffmpeg-dev-darwin-arm64"

# Build (gyp will find FFmpeg automatically)
npm run build
```

### Using Local FFmpeg Build

The existing `npm run setup-ffmpeg` still works:

```bash
npm run setup-ffmpeg darwin-arm64
# Creates ffmpeg-install/ directory
# FFMPEG_ROOT automatically detected by gyp/ffmpeg-paths.js
```

## Migration Timeline

### Phase 1: Parallel Operation (Current)
- CI tries npm first, falls back to GitHub releases
- Both systems coexist
- Zero breaking changes

### Phase 2: npm Primary (After 4 Weeks)
- npm packages stable and proven
- GitHub releases kept as emergency fallback
- Documentation updated to recommend npm approach

### Phase 3: Cleanup (After 8 Weeks)
- Remove `build-ffmpeg.yml` workflow
- Archive old `deps-*` releases
- npm becomes sole distribution method

## Package Version Mapping

| FFmpeg Version | npm Package Version | GitHub Release Tag |
|----------------|---------------------|-------------------|
| n8.0 | 8.0.0 | deps-v5 |
| n8.1 (future) | 8.1.0 | deps-v6 |

## Troubleshooting

### npm package not found

```bash
# Check if package exists
npm view @pproenca/ffmpeg-dev-linux-x64-glibc

# Fallback to GitHub release
npm run setup-ffmpeg linux-x64-glibc deps-v5
```

### Build can't find FFmpeg

```bash
# Verify FFMPEG_ROOT is set
echo $FFMPEG_ROOT

# Check gyp resolution
node gyp/ffmpeg-paths.js include
node gyp/ffmpeg-paths.js lib
```

### Wrong FFmpeg version

```bash
# Specify exact version
npm install --save-dev @pproenca/ffmpeg-dev-darwin-arm64@8.0.0

# Or use GitHub release with specific tag
npm run setup-ffmpeg darwin-arm64 deps-v5
```

## Related Files

- **CI Workflow:** `.github/workflows/ci.yml` (lines 203-256)
- **FFmpeg Resolver:** `gyp/ffmpeg-paths-lib.ts` (lines 50-66)
- **Setup Script:** `scripts/setup-ffmpeg.ts`
- **Binding Config:** `binding.gyp` (uses gyp/ffmpeg-paths.js)

## References

- [ffmpeg-prebuilds Repository](https://github.com/pproenca/ffmpeg-prebuilds)
- [sharp-libvips](https://github.com/lovell/sharp-libvips) (inspiration for this approach)
- [npm Optional Dependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#optionaldependencies)
