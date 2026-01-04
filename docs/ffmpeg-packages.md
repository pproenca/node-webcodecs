# FFmpeg Package Management

## Overview

node-webcodecs uses FFmpeg static libraries for native addon compilation. FFmpeg dependencies are distributed via **npm packages** from the [ffmpeg-prebuilds](https://github.com/pproenca/ffmpeg-prebuilds) repository.

## Packages

**Development packages:** `@pproenca/ffmpeg-dev-*` (static libraries + headers)

**Platforms:**
- `@pproenca/ffmpeg-dev-darwin-arm64` (macOS Apple Silicon)
- `@pproenca/ffmpeg-dev-darwin-x64` (macOS Intel)
- `@pproenca/ffmpeg-dev-linux-x64-glibc` (Linux glibc)
- `@pproenca/ffmpeg-dev-linux-x64-musl` (Linux musl/Alpine)

**Included codecs:** H.264, H.265, VP9, AV1, Opus, MP3 (via libmp3lame), Vorbis

**Repository:** [pproenca/ffmpeg-prebuilds](https://github.com/pproenca/ffmpeg-prebuilds)

## CI Workflow

The CI workflow automatically installs the appropriate FFmpeg package for each platform:

```yaml
- name: Install FFmpeg from npm
  run: |
    npm install --no-save @pproenca/ffmpeg-dev-${{ matrix.platform }}
    FFMPEG_ROOT="$(npm root)/@pproenca/ffmpeg-dev-${{ matrix.platform }}"
    echo "FFMPEG_ROOT=$FFMPEG_ROOT" >> "$GITHUB_ENV"
```

The `gyp/ffmpeg-paths-lib.ts` resolver uses `FFMPEG_ROOT` to locate libraries and headers.

## Local Development

```bash
# Install FFmpeg dev package for your platform
npm install --save-dev @pproenca/ffmpeg-dev-darwin-arm64

# Set FFMPEG_ROOT
export FFMPEG_ROOT="$(npm root)/@pproenca/ffmpeg-dev-darwin-arm64"

# Build (gyp will find FFmpeg automatically)
npm run build
```

## Package Versioning

FFmpeg npm package versions follow the FFmpeg release version:

| FFmpeg Version | npm Package Version |
|----------------|---------------------|
| n8.0 | 8.0.0 |
| n8.1 (future) | 8.1.0 |

## Troubleshooting

### npm package not found

```bash
# Check if package exists for your platform
npm view @pproenca/ffmpeg-dev-linux-x64-glibc
```

### Build can't find FFmpeg

```bash
# Verify FFMPEG_ROOT is set
echo $FFMPEG_ROOT

# Check gyp resolution
node gyp/ffmpeg-paths.js include
node gyp/ffmpeg-paths.js lib
```

### Specific FFmpeg version needed

```bash
# Install exact version
npm install --save-dev @pproenca/ffmpeg-dev-darwin-arm64@8.0.0
```

## Related Files

- **CI Workflow:** `.github/workflows/ci.yml` (FFmpeg installation steps)
- **FFmpeg Resolver:** `gyp/ffmpeg-paths-lib.ts` (FFMPEG_ROOT resolution)
- **Binding Config:** `binding.gyp` (uses gyp/ffmpeg-paths.js)

## References

- [ffmpeg-prebuilds Repository](https://github.com/pproenca/ffmpeg-prebuilds) - Build and distribution
- [sharp-libvips](https://github.com/lovell/sharp-libvips) - Pattern inspiration
