## Why

This project currently has no CI workflow. Without automated testing, lint failures and regressions can slip into the codebase. A CI workflow ensures code quality gates are enforced on every push and pull request, and enables automated cross-platform native addon builds.

The project relies on FFmpeg libraries, which are available via:
1. System package managers (for local dev and CI)
2. `@pproenca/webcodecs-ffmpeg` npm packages (pre-built static FFmpeg libraries)

This CI workflow focuses on testing and validation. Prebuild publishing for `@pproenca/node-webcodecs-*` packages is a separate concern.

## What Changes

**CI Workflow:**
- Add `.github/workflows/ci.yml` with automated checks on push and pull request
- Lint job: C++ linting (`cpplint`), TypeScript linting (`biome`), type checking (`tsd`), markdown formatting (`prettier`)
- Build and test job: Multi-platform matrix (Linux x64 glibc/musl, macOS x64/arm64)
- Native addon compilation using `node-gyp` with FFmpeg dependencies
- Test execution for unit tests, golden tests, and guardrails
- Container-based Linux builds for consistent glibc/musl environments

**Optional FFmpeg Dependencies (Sharp-style):**
- Add `@pproenca/webcodecs-ffmpeg` platform packages as `optionalDependencies`
- Update `gyp/ffmpeg-paths-lib.ts` to resolve FFmpeg from npm packages first
- Developers can use `--ignore-optional` to skip and use system FFmpeg instead

## Capabilities

### New Capabilities

- `ci-workflow`: GitHub Actions workflow for automated linting, building, and testing across platforms
- `optional-ffmpeg-deps`: Optional FFmpeg dependencies allowing developers to use system FFmpeg or npm packages

### Modified Capabilities

(none - no existing specs are modified)

## Impact

- **Code**: New `.github/workflows/ci.yml` file, updated `gyp/ffmpeg-paths-lib.ts`
- **Dependencies**: New `optionalDependencies` for `@pproenca/webcodecs-ffmpeg-*` packages
- **External**: GitHub Actions integration; prebuild publishing remains in `pproenca/webcodecs-ffmpeg` repo
- **Platforms**: macOS (x64, arm64), Linux (x64 glibc via Rocky, x64 musl via Alpine)
- **Developer Experience**: `npm install` gets FFmpeg automatically; `npm install --ignore-optional` uses system FFmpeg
