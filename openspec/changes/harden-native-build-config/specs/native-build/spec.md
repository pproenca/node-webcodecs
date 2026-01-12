## ADDED Requirements

### Requirement: FFmpeg Path Resolution

The build system SHALL resolve FFmpeg include and library paths using a prioritized fallback chain.

#### Scenario: Resolution via FFMPEG_ROOT environment variable
- **WHEN** the `FFMPEG_ROOT` environment variable is set
- **AND** `$FFMPEG_ROOT/lib/pkgconfig` exists
- **THEN** FFmpeg paths SHALL be resolved from that location

#### Scenario: Resolution via npm package
- **WHEN** `FFMPEG_ROOT` is not set
- **AND** `@pproenca/webcodecs-ffmpeg-{platform}-{arch}` package is installed
- **THEN** FFmpeg paths SHALL be resolved from the npm package location

#### Scenario: Resolution via local directory
- **WHEN** neither env var nor npm package is available
- **AND** `./ffmpeg-install/lib/pkgconfig` exists
- **THEN** FFmpeg paths SHALL be resolved from the local directory

#### Scenario: Resolution via system pkg-config
- **WHEN** none of the above sources are available
- **AND** `pkg-config` is installed and FFmpeg .pc files are discoverable
- **THEN** FFmpeg paths SHALL be resolved from system pkg-config

#### Scenario: Fallback to hardcoded paths
- **WHEN** all resolution methods fail
- **THEN** the build system SHALL use platform-specific hardcoded paths:
  - macOS: `/opt/homebrew/include`, `/usr/local/include`, `/opt/local/include`
  - Linux: `/usr/include`, `/usr/local/include`

### Requirement: Error Reporting

The build system SHALL report FFmpeg resolution errors explicitly to stderr.

#### Scenario: pkg-config failure
- **WHEN** pkg-config execution fails
- **THEN** an error message SHALL be logged to stderr with prefix `[node-webcodecs]`
- **AND** the message SHALL include the failure reason
- **AND** the message SHALL suggest ensuring FFmpeg 5.0+ is installed

#### Scenario: Empty pkg-config output
- **WHEN** pkg-config returns empty output
- **THEN** an error message SHALL be logged to stderr
- **AND** resolution SHALL fall back to the next method in the chain

### Requirement: Runtime Library Path Configuration

The build system SHALL configure runtime library search paths (RPATH) for the native addon.

#### Scenario: macOS RPATH configuration
- **WHEN** building on macOS
- **THEN** the native addon SHALL be linked with `-Wl,-rpath,@loader_path/../lib`
- **AND** the native addon SHALL be linked with `-Wl,-rpath,@loader_path/../../ffmpeg-install/lib`

#### Scenario: Linux RPATH configuration
- **WHEN** building on Linux
- **THEN** the native addon SHALL be linked with `-Wl,-rpath,$ORIGIN/../lib`
- **AND** the native addon SHALL be linked with `-Wl,-rpath,$ORIGIN/../../ffmpeg-install/lib`

### Requirement: Linux Library Linking Fallback

The Linux build SHALL support both static and dynamic FFmpeg linking.

#### Scenario: Static linking preferred
- **WHEN** building on Linux
- **THEN** the build system SHALL first attempt `pkg-config --libs --static`

#### Scenario: Dynamic linking fallback
- **WHEN** static linking fails on Linux
- **THEN** the build system SHALL fall back to `pkg-config --libs` (dynamic)

### Requirement: Build Configuration

The build system SHALL support explicit Debug and Release configurations.

#### Scenario: Debug configuration
- **WHEN** building with `--debug` flag
- **THEN** the build SHALL use `-g -O0` compiler flags
- **AND** the build SHALL define `DEBUG` and `_DEBUG` preprocessor macros

#### Scenario: Release configuration
- **WHEN** building without `--debug` flag (default)
- **THEN** the build SHALL use `-O3` optimization
- **AND** the build SHALL define `NDEBUG` preprocessor macro

### Requirement: Parallel Compilation

The build system SHALL enable parallel compilation by default.

#### Scenario: Default parallel build
- **WHEN** running `npm run build:native`
- **THEN** node-gyp SHALL be invoked with `-j max` flag
- **AND** all available CPU cores SHALL be utilized

### Requirement: Compiler Warnings

The build system SHALL enable comprehensive compiler warnings.

#### Scenario: Warning flags on macOS
- **WHEN** building on macOS
- **THEN** the compiler SHALL use flags: `-Wall -Wextra -Wpedantic -Wshadow -Wno-unused-parameter`

#### Scenario: Warning flags on Linux
- **WHEN** building on Linux
- **THEN** the compiler SHALL use flags: `-Wall -Wextra -Wpedantic -Wshadow -Wno-unused-parameter`

### Requirement: pkg-config Availability Check

The build system SHALL verify pkg-config availability before using it.

#### Scenario: pkg-config available
- **WHEN** `pkg-config --version` succeeds
- **THEN** pkg-config-based resolution SHALL proceed normally

#### Scenario: pkg-config unavailable
- **WHEN** `pkg-config --version` fails
- **THEN** pkg-config-based resolution SHALL be skipped
- **AND** the build SHALL fall back to hardcoded paths

### Requirement: CI Build Caching

The CI workflow SHALL cache node-gyp headers for faster builds.

#### Scenario: Cache node-gyp headers
- **WHEN** running CI builds
- **THEN** the `~/.node-gyp` directory SHALL be cached
- **AND** the cache key SHALL include `binding.gyp` hash
