## ADDED Requirements

### Requirement: CI workflow triggers on push and pull request

The CI workflow SHALL execute on every push to `master` branch and on every pull request targeting `master`.

#### Scenario: Push to master triggers CI

- **WHEN** a commit is pushed to the `master` branch
- **THEN** the CI workflow executes all jobs

#### Scenario: Pull request triggers CI

- **WHEN** a pull request is opened or updated targeting `master`
- **THEN** the CI workflow executes all jobs

### Requirement: Lint job validates code quality

The CI workflow SHALL include a lint job that runs C++ linting, TypeScript linting, type checking, and markdown formatting checks.

#### Scenario: Lint job runs all checks

- **WHEN** the lint job executes
- **THEN** the following checks run in sequence:
  - `npm run lint:cpp` (cpplint)
  - `npm run lint:ts` (biome)
  - `npm run lint:types` (tsd)
  - `npm run lint:md` (prettier)

#### Scenario: Lint failure blocks merge

- **WHEN** any lint check fails
- **THEN** the workflow reports failure and the PR cannot be merged

### Requirement: Build job compiles native addon on Linux glibc

The CI workflow SHALL build the native addon on Linux x64 with glibc using a Rocky Linux 8 container.

#### Scenario: Rocky Linux build with FFmpeg

- **WHEN** the build job runs on Linux glibc matrix entry
- **THEN** the job:
  - Uses `rockylinux:8` container
  - Installs FFmpeg development packages via `dnf`
  - Runs `npm run build`
  - Runs `npm test`

### Requirement: Build job compiles native addon on Linux musl

The CI workflow SHALL build the native addon on Linux x64 with musl libc using an Alpine container.

#### Scenario: Alpine Linux build with FFmpeg

- **WHEN** the build job runs on Linux musl matrix entry
- **THEN** the job:
  - Uses `alpine:3.20` container
  - Installs FFmpeg development packages via `apk`
  - Runs `npm run build`
  - Runs `npm test`

### Requirement: Build job compiles native addon on macOS ARM64

The CI workflow SHALL build the native addon on macOS ARM64 (Apple Silicon) using a native runner.

#### Scenario: macOS ARM64 build with Homebrew FFmpeg

- **WHEN** the build job runs on macOS ARM64 matrix entry
- **THEN** the job:
  - Uses `macos-14` runner
  - Installs FFmpeg via Homebrew
  - Runs `npm run build`
  - Runs `npm test`

### Requirement: Build job compiles native addon on macOS x64

The CI workflow SHALL build the native addon on macOS x64 (Intel) using a native runner.

#### Scenario: macOS x64 build with Homebrew FFmpeg

- **WHEN** the build job runs on macOS x64 matrix entry
- **THEN** the job:
  - Uses `macos-13` runner
  - Installs FFmpeg via Homebrew
  - Runs `npm run build`
  - Runs `npm test`

### Requirement: Build job tests multiple Node.js versions

The CI workflow SHALL test against Node.js 20 and 22 on each platform.

#### Scenario: Matrix includes Node.js versions

- **WHEN** the build matrix is configured
- **THEN** each platform entry includes Node.js versions `20` and `22`

### Requirement: Test execution includes fast tests and guardrails

The CI workflow SHALL run the standard test suite excluding stress tests.

#### Scenario: Test commands execute

- **WHEN** tests run in the build job
- **THEN** the following commands execute:
  - `npm run test:fast` (unit and golden tests)
  - `npm run test:guardrails` (fuzzer and event loop lag tests)

#### Scenario: Stress tests are excluded

- **WHEN** tests run in the build job
- **THEN** `npm run test:stress` is NOT executed

### Requirement: Workflow uses minimal permissions

The CI workflow SHALL request only the minimum required GitHub permissions.

#### Scenario: Default permissions are restricted

- **WHEN** the workflow file is parsed
- **THEN** the top-level `permissions` block sets `contents: read` only

### Requirement: Lint job provides fast feedback

The lint job SHALL run independently and complete before build jobs finish, providing quick feedback on code quality issues.

#### Scenario: Lint job runs in parallel with builds

- **WHEN** the workflow executes
- **THEN** the lint job runs concurrently with build jobs (no `needs` dependency)

#### Scenario: Lint job completes quickly

- **WHEN** the lint job executes
- **THEN** it completes in under 2 minutes on a standard runner
