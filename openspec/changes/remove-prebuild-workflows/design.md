# Design: Remove FFmpeg prebuild workflows

## Context

The node-webcodecs repository currently contains a complete FFmpeg build infrastructure:
- GitHub Actions workflow (`build-ffmpeg.yml`) that builds FFmpeg with codecs for 4 platforms
- Docker containers for Linux builds (glibc and musl variants)
- TypeScript build orchestration scripts
- Cache management for codec compilation

This infrastructure was necessary during initial development but now adds maintenance overhead. A dedicated repository (`pproenca/webcodecs-ffmpeg`) has been created following the sharp-libvips model to handle FFmpeg builds independently.

## Goals / Non-Goals

**Goals:**
- Remove FFmpeg build complexity from node-webcodecs
- Simplify CI by only consuming pre-built artifacts
- Enable independent FFmpeg update cycles
- Reduce repository maintenance burden

**Non-Goals:**
- Changing how the native addon links to FFmpeg (binding.gyp unchanged)
- Modifying platform support matrix
- Changing npm package structure for end users

## Decisions

### Decision 1: Consume FFmpeg from external repository releases

The CI workflow will download FFmpeg tarballs from `pproenca/webcodecs-ffmpeg` GitHub releases instead of building locally or using this repo's `deps-*` releases.

**Rationale:**
- GitHub releases are reliable and don't require npm package infrastructure
- Same pattern currently used (just different source repo)
- No changes needed to extraction/linking logic
- Simple transition: just change the `repo:` parameter in fetch-gh-release-asset

**Alternatives considered:**
1. **npm packages** (`@pproenca/ffmpeg-dev-*`): More elegant long-term but requires npm publishing infrastructure first
2. **GitHub artifact sharing**: Workflows can't easily share artifacts across repositories
3. **Git submodule**: Adds complexity, doesn't solve the build problem

### Decision 2: Keep resolve-deps pattern

The CI will continue using a `resolve-deps` job that queries for the latest release tag, just pointing to the new repository.

**Rationale:**
- Avoids hardcoding versions
- Allows webcodecs-ffmpeg releases to be picked up automatically
- Proven pattern already working in ci.yml

### Decision 3: Delete rather than deprecate

Build infrastructure files will be deleted entirely, not deprecated with comments.

**Rationale:**
- Dead code is confusing and accumulates
- Git history preserves everything if needed
- webcodecs-ffmpeg repo has the authoritative build scripts now

## Risks / Trade-offs

### Risk: External repository unavailable
**Impact:** CI fails if pproenca/webcodecs-ffmpeg is deleted or releases are removed
**Mitigation:** Pedro owns both repositories; releases are immutable once created; could mirror to npm as backup

### Risk: Version mismatch between FFmpeg and native addon
**Impact:** ABI incompatibility could cause crashes
**Mitigation:** Keep using same FFmpeg version (n8.0) and codec versions; version is embedded in release tags

### Risk: Breaking existing deps-* workflow consumers
**Impact:** Other tools/scripts relying on deps-* releases would break
**Mitigation:** Keep deps-* releases archived (don't delete); document migration path

## Migration Plan

### Phase 1: Update CI to use external source (non-breaking)
1. Modify ci.yml to fetch from pproenca/webcodecs-ffmpeg
2. Test on feature branch
3. Merge when all matrix jobs pass

### Phase 2: Remove build infrastructure (cleanup)
1. Delete build-ffmpeg.yml workflow
2. Delete docker/ directory
3. Delete build-ffmpeg-workflow.ts script
4. Update documentation

### Rollback
If issues arise, revert to previous ci.yml and re-enable build-ffmpeg.yml workflow.
Git history preserves all deleted files for recovery.

## Open Questions

1. **Should deps-* releases be deleted or archived?**
   - Recommendation: Archive (keep but don't advertise) for historical reference

2. **When to transition to npm packages for FFmpeg?**
   - Future work: Once @pproenca/ffmpeg-dev-* packages are published to npm, ci.yml can optionally use npm install as primary source with GitHub release fallback
