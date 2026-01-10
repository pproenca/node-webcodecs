# Tasks: Remove FFmpeg prebuild workflows

## 1. Preparation

- [x] 1.1 Verify webcodecs-ffmpeg repository has working releases at `pproenca/webcodecs-ffmpeg`
- [x] 1.2 Confirm FFmpeg release artifact naming matches expected format (npm packages `@pproenca/webcodecs-ffmpeg-dev-*`)
- [x] 1.3 Document current DEPS_VERSION being used in ci.yml for reference (replaced with npm packages)

## 2. Update CI Workflow

- [x] 2.1 Modify `.github/workflows/ci.yml` to fetch FFmpeg from npm packages
- [x] 2.2 Remove `resolve-deps` job (no longer needed with npm packages)
- [x] 2.3 Add `install-ffmpeg` command to `scripts/ci/ci-workflow.ts`
- [x] 2.4 Update build-native matrix jobs to use new `install-ffmpeg` command

## 3. Update Release Workflow

- [x] 3.1 Verify release.yml has no deps-* references (confirmed clean)
- [x] 3.2 No changes needed - release.yml consumes CI artifacts only

## 4. Remove Build Infrastructure

- [x] 4.1 Delete `.github/workflows/build-ffmpeg.yml`
- [x] 4.2 Delete `docker/Dockerfile.linux-x64`
- [x] 4.3 Delete `docker/Dockerfile.linux-x64-glibc`
- [x] 4.4 Delete `docker/` directory
- [x] 4.5 Delete `scripts/ci/build-ffmpeg-workflow.ts`

## 5. Update Scripts and Configuration

- [x] 5.1 Update `scripts/ci/ci-workflow.ts`:
  - Added `installFfmpeg` function
  - Added `mapPlatformToFfmpegPackage` helper
  - Removed `resolveLatestDepsTag`, `resolveDeps`, `extractFfmpegArchive` functions
- [x] 5.2 No changes needed to binding.gyp (FFMPEG_ROOT still works)
- [x] 5.3 Removed resolve-deps job from ci.yml

## 6. Documentation Cleanup

- [x] 6.1 Updated CLAUDE.md CI Testing section (removed build-ffmpeg.yml reference)
- [x] 6.2 Updated `docs/build-system.md` with new architecture:
  - Changed from two-stage (build-ffmpeg + ci) to single-stage (ci with npm install)
  - Updated FFmpeg installation documentation
  - Added musl support to platform table
  - Referenced pproenca/webcodecs-ffmpeg repository

## 7. Testing and Validation

- [x] 7.1 TypeScript compiles successfully (`npm run build:ts`)
- [x] 7.2 Lint passes (`npm run lint`)
- [x] 7.3 Test file imports updated for removed functions
- [ ] 7.4 Full CI pipeline verification (requires running on GitHub Actions)

## 8. Cleanup

- [x] 8.1 Updated test/unit/ci-workflows.test.ts:
  - Removed imports from deleted `build-ffmpeg-workflow.ts`
  - Removed tests for `resolveLatestDepsTag`, `resolveDeps`, `extractFfmpegArchive`
  - Added tests for new `installFfmpeg` function
- [x] 8.2 Removed unused `ensureDir` function from ci-workflow.ts
- [ ] 8.3 Remove obsolete deps-* releases from GitHub (optional, can be archived)

## Notes

- FFmpeg packages are now installed from npm: `@pproenca/webcodecs-ffmpeg-dev-{platform}[-non-free]`
- Platform mapping: `linux-x64-glibc` and `linux-x64-musl` both map to `linux-x64` FFmpeg packages
- Full test suite requires native build which runs in CI
