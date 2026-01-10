# Change: Remove FFmpeg prebuild workflows

## Why

The FFmpeg build infrastructure (workflows, Docker files, build scripts) adds complexity to this repository and increases CI maintenance burden. A dedicated external repository (`pproenca/webcodecs-ffmpeg`) now provides prebuilt FFmpeg binaries and development libraries, following the sharp-libvips pattern. This change simplifies node-webcodecs by removing ~800 lines of build configuration and delegating FFmpeg builds to a purpose-built repository.

## What Changes

- **REMOVED** `.github/workflows/build-ffmpeg.yml` - FFmpeg build workflow (449 lines)
- **REMOVED** `docker/Dockerfile.linux-x64` - Alpine/musl FFmpeg build container
- **REMOVED** `docker/Dockerfile.linux-x64-glibc` - Ubuntu/glibc FFmpeg build container
- **REMOVED** `scripts/ci/build-ffmpeg-workflow.ts` - FFmpeg build orchestration script (723 lines)
- **MODIFIED** `.github/workflows/ci.yml` - Update to consume FFmpeg from external source (GitHub releases or npm packages from webcodecs-ffmpeg)
- **MODIFIED** `.github/workflows/release.yml` - Remove deps-release dependencies, simplify to consume external artifacts
- **REMOVED** Related documentation in `docs/plans/` that describe the old build system

## Impact

- **Affected code:**
  - `.github/workflows/build-ffmpeg.yml` (deleted)
  - `.github/workflows/ci.yml` (modified - FFmpeg source resolution)
  - `.github/workflows/release.yml` (modified - remove deps workflow references)
  - `docker/` directory (deleted entirely)
  - `scripts/ci/build-ffmpeg-workflow.ts` (deleted)
  - `docs/plans/2025-01-04-migrate-binaries-out.md` (archived - plan executed)

- **Dependencies:**
  - CI will download FFmpeg from `pproenca/webcodecs-ffmpeg` GitHub releases
  - Future: npm packages from `@pproenca/ffmpeg-dev-*` scope

- **Breaking changes:** None for end users. This is an internal infrastructure change.

- **Benefits:**
  - Faster node-webcodecs CI (no FFmpeg builds, only downloads)
  - Simpler repository structure (single-purpose: WebCodecs binding)
  - FFmpeg updates decoupled from WebCodecs releases
  - Reduced GHA cache usage (~80% reduction in build cache)
