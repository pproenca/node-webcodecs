## ADDED Requirements

### Requirement: FFmpeg packages are optional dependencies

The package.json SHALL declare `@pproenca/webcodecs-ffmpeg` platform packages as `optionalDependencies`, allowing developers to skip them with `--omit=optional`.

#### Scenario: Standard install includes FFmpeg packages

- **WHEN** a developer runs `npm install`
- **THEN** the appropriate platform-specific FFmpeg package is installed (e.g., `@pproenca/webcodecs-ffmpeg-darwin-arm64` on Apple Silicon)

#### Scenario: Install with ignore-optional skips FFmpeg

- **WHEN** a developer runs `npm install --omit=optional`
- **THEN** no `@pproenca/webcodecs-ffmpeg-*` packages are installed
- **AND** the build falls back to system FFmpeg via pkg-config

### Requirement: FFmpeg resolution prefers npm packages

The `gyp/ffmpeg-paths-lib.ts` SHALL resolve FFmpeg in this order:
1. `FFMPEG_ROOT` environment variable (explicit override)
2. `@pproenca/webcodecs-ffmpeg` npm package (if installed)
3. `./ffmpeg-install` directory (local development)
4. System pkg-config (fallback)

#### Scenario: Resolve from npm package when installed

- **WHEN** `@pproenca/webcodecs-ffmpeg` is installed
- **AND** no `FFMPEG_ROOT` env var is set
- **THEN** FFmpeg paths resolve from the npm package's lib/pkgconfig directory

#### Scenario: Fallback to system when npm package missing

- **WHEN** `@pproenca/webcodecs-ffmpeg` is NOT installed
- **AND** no `FFMPEG_ROOT` env var is set
- **AND** no `./ffmpeg-install` directory exists
- **THEN** FFmpeg paths resolve from system pkg-config

### Requirement: Platform packages follow naming convention

The optionalDependencies SHALL include platform-specific packages matching the pattern `@pproenca/webcodecs-ffmpeg-{os}-{arch}`.

#### Scenario: Supported platforms are declared

- **WHEN** package.json is parsed
- **THEN** optionalDependencies includes:
  - `@pproenca/webcodecs-ffmpeg-darwin-arm64`
  - `@pproenca/webcodecs-ffmpeg-darwin-x64`
  - `@pproenca/webcodecs-ffmpeg-linux-x64`

### Requirement: Resolution uses webcodecs-ffmpeg resolve module

The `gyp/ffmpeg-paths-lib.ts` SHALL use `@pproenca/webcodecs-ffmpeg/resolve` to locate the FFmpeg installation when the npm package is available.

#### Scenario: Resolve module provides paths

- **WHEN** resolving FFmpeg from npm package
- **THEN** the code requires `@pproenca/webcodecs-ffmpeg/resolve`
- **AND** uses its `pkgconfig` property to get the pkg-config directory

#### Scenario: Graceful fallback when resolve fails

- **WHEN** `require('@pproenca/webcodecs-ffmpeg/resolve')` throws
- **THEN** resolution continues to the next fallback (./ffmpeg-install or system)

### Requirement: CI uses system FFmpeg not npm packages

The CI workflow SHALL NOT install FFmpeg via npm optionalDependencies. It SHALL use system package managers to ensure the build works without the npm packages.

#### Scenario: CI installs with ignore-optional

- **WHEN** the CI workflow runs `npm install` or `npm ci`
- **THEN** it uses `--omit=optional` flag
- **AND** FFmpeg is installed via system package manager (dnf, apk, brew)

#### Scenario: CI validates system FFmpeg fallback works

- **WHEN** CI builds complete successfully
- **THEN** this proves the system FFmpeg fallback path works correctly
