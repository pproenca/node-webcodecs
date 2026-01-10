# CI Infrastructure Spec Delta

## REMOVED Requirements

### Requirement: FFmpeg Build Workflow

The repository SHALL NOT contain FFmpeg compilation infrastructure.

**Reason:** FFmpeg builds are now handled by the external `pproenca/webcodecs-ffmpeg` repository following the sharp-libvips separation-of-concerns pattern.

**Migration:** CI consumes pre-built FFmpeg artifacts from `pproenca/webcodecs-ffmpeg` GitHub releases.

#### Scenario: No local FFmpeg builds
- **WHEN** the CI pipeline runs
- **THEN** it SHALL NOT execute any FFmpeg compilation steps
- **AND** it SHALL download pre-built FFmpeg from an external source

### Requirement: Docker Build Containers

The repository SHALL NOT contain Docker containers for FFmpeg builds.

**Reason:** Build containers are maintained in the dedicated `pproenca/webcodecs-ffmpeg` repository.

**Migration:** Remove `docker/` directory entirely.

#### Scenario: No Docker files present
- **WHEN** listing repository contents
- **THEN** no `docker/Dockerfile.*` files SHALL exist for FFmpeg builds

### Requirement: Build Orchestration Scripts

The repository SHALL NOT contain FFmpeg build orchestration scripts.

**Reason:** Build scripts are maintained in `pproenca/webcodecs-ffmpeg`.

**Migration:** Remove `scripts/ci/build-ffmpeg-workflow.ts`.

#### Scenario: No build-ffmpeg scripts
- **WHEN** listing `scripts/ci/` contents
- **THEN** no `build-ffmpeg-workflow.ts` file SHALL exist

---

## MODIFIED Requirements

### Requirement: CI FFmpeg Resolution

The CI pipeline SHALL resolve FFmpeg development dependencies from an external source.

#### Scenario: FFmpeg downloaded from external repository
- **WHEN** the CI `build-native` job executes
- **THEN** it SHALL download FFmpeg artifacts from `pproenca/webcodecs-ffmpeg` GitHub releases
- **AND** it SHALL use the `dsaltares/fetch-gh-release-asset` action with `repo: pproenca/webcodecs-ffmpeg`

#### Scenario: Resolve latest FFmpeg version
- **WHEN** the CI `resolve-deps` job executes
- **THEN** it SHALL query `pproenca/webcodecs-ffmpeg` for the latest release tag
- **AND** it SHALL output the version for downstream jobs

#### Scenario: FFmpeg extraction unchanged
- **WHEN** FFmpeg tarball is downloaded
- **THEN** the extraction process SHALL remain unchanged
- **AND** the `FFMPEG_ROOT` environment variable SHALL be set correctly
- **AND** `pkg-config` paths SHALL resolve FFmpeg libraries

### Requirement: Release Workflow Simplification

The release workflow SHALL NOT create FFmpeg dependency releases.

#### Scenario: No deps releases created
- **WHEN** a release tag is pushed
- **THEN** the release workflow SHALL NOT create `deps-*` releases
- **AND** it SHALL only handle node-webcodecs package releases
