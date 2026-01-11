## 1. Optional FFmpeg Dependencies

- [x] 1.1 Add `@pproenca/webcodecs-ffmpeg-darwin-arm64` to optionalDependencies in package.json
- [x] 1.2 Add `@pproenca/webcodecs-ffmpeg-darwin-x64` to optionalDependencies in package.json
- [x] 1.3 Add `@pproenca/webcodecs-ffmpeg-linux-x64` to optionalDependencies in package.json
- [x] 1.4 Update `gyp/ffmpeg-paths-lib.ts` to check for `@pproenca/webcodecs-ffmpeg/resolve` before other fallbacks
- [x] 1.5 Add try/catch in resolution to gracefully handle missing npm package
- [x] 1.6 Compile `gyp/ffmpeg-paths-lib.ts` to verify no TypeScript errors

## 2. CI Workflow Setup

- [x] 2.1 Create `.github/workflows/` directory if it doesn't exist
- [x] 2.2 Create `.github/workflows/ci.yml` with workflow name and triggers (push to master, PR to master)
- [x] 2.3 Set minimal permissions (`contents: read`)

## 3. Lint Job

- [x] 3.1 Add `lint` job running on `ubuntu-24.04`
- [x] 3.2 Add checkout step
- [x] 3.3 Add Node.js setup step (version 22)
- [x] 3.4 Add `npm ci --ignore-optional` step
- [x] 3.5 Add `npm run lint:cpp` step
- [x] 3.6 Add `npm run lint:ts` step
- [x] 3.7 Add `npm run lint:types` step
- [x] 3.8 Add `npm run lint:md` step

## 4. Build Matrix Configuration

- [x] 4.1 Define matrix strategy with platform entries (linux-glibc, linux-musl, macos-arm64, macos-x64)
- [x] 4.2 Add Node.js version matrix (20, 22)
- [x] 4.3 Configure container images for Linux entries (rockylinux:8, alpine:3.20)
- [x] 4.4 Configure native runners for macOS entries (macos-14, macos-13)

## 5. Linux glibc Build (Rocky Linux 8)

- [x] 5.1 Add FFmpeg installation via `dnf install -y ffmpeg-free-devel`
- [x] 5.2 Add build dependencies (gcc-c++, make, python3, pkg-config)
- [x] 5.3 Add Node.js installation step appropriate for Rocky Linux container
- [x] 5.4 Add `npm ci --ignore-optional` step
- [x] 5.5 Add `npm run build` step
- [x] 5.6 Add `npm test` step

## 6. Linux musl Build (Alpine 3.20)

- [x] 6.1 Add FFmpeg installation via `apk add ffmpeg-dev`
- [x] 6.2 Add build dependencies (build-base, python3, pkgconfig)
- [x] 6.3 Add Node.js installation step appropriate for Alpine container
- [x] 6.4 Add `npm ci --ignore-optional` step
- [x] 6.5 Add `npm run build` step
- [x] 6.6 Add `npm test` step

## 7. macOS ARM64 Build

- [x] 7.1 Configure job to run on `macos-14` runner
- [x] 7.2 Add FFmpeg installation via `brew install ffmpeg`
- [x] 7.3 Add Node.js setup action
- [x] 7.4 Add `npm ci --ignore-optional` step
- [x] 7.5 Add `npm run build` step
- [x] 7.6 Add `npm test` step

## 8. macOS x64 Build

- [x] 8.1 Configure job to run on `macos-13` runner
- [x] 8.2 Add FFmpeg installation via `brew install ffmpeg`
- [x] 8.3 Add Node.js setup action
- [x] 8.4 Add `npm ci --ignore-optional` step
- [x] 8.5 Add `npm run build` step
- [x] 8.6 Add `npm test` step

## 9. Validation

- [x] 9.1 Run workflow locally with `act` to validate syntax (if available)
- [ ] 9.2 Push to branch and verify workflow triggers on PR
- [ ] 9.3 Verify lint job completes in under 2 minutes
- [ ] 9.4 Verify all matrix entries build and test successfully
- [x] 9.5 Test `npm install` locally includes FFmpeg optional dependency
- [x] 9.6 Test `npm install --omit=optional` locally falls back to system FFmpeg
