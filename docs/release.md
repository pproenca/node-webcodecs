# Release Guide

This project ships prebuilt Node.js binaries linked to FFmpeg. Releases happen
in two phases: FFmpeg dependency artifacts, then npm packages.

## 1) Build FFmpeg deps

Create a tag to build FFmpeg dependencies:

- GPL deps: `ffmpeg-vX.Y.Z` (e.g. `ffmpeg-v10`)
- LGPL-only deps: `ffmpeg-lgpl-vX.Y.Z`

The CI pipeline builds per-platform tarballs and publishes a `deps-*` GitHub
release with `deps-manifest.json` and `SHA256SUMS`.

## 2) Publish npm packages

1. Bump versions:

   ```bash
   node scripts/bump-version.js <version>
   node scripts/create-platform-packages.mjs
   ```

2. Tag the release:

   ```bash
   git tag v<version>
   git push origin main --tags
   ```

CI publishes platform packages first, then the main package, and runs npm
smoke tests on Linux, macOS, and Alpine (musl).

## 3) Validate

- Confirm `deps-*` release assets include all platforms.
- Check npm smoke tests in `.github/workflows/npm.yml`.
- Verify `SUPPORTED_CODECS.md` matches the FFmpeg build flags.
