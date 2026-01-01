# FFmpeg CI Build Optimization Design

## Context

The node-webcodecs project uses jellyfin-ffmpeg to build FFmpeg static libraries for three platforms (darwin-arm64, darwin-x64, linux-x64). Current pain points:

1. **Docker image fallback builds** — When `docker pull` fails, local image building adds 10-20 minutes
2. **Full FFmpeg recompilation** — Cache misses trigger long builds (~30-60 min)
3. **Slow macOS builds** — Homebrew installs + compilation

### Constraints

- GitHub-hosted runners only (no self-hosted)
- Fork of jellyfin-ffmpeg with modifications (can push Docker images)
- Must work within GitHub Actions cache limits (10GB per repo)

## Design: 4-Point Optimization

### 1. Automated Docker Image Publishing

**Goal:** Eliminate fallback image builds by ensuring images exist on GHCR.

**Approach:**

Create a new workflow `build-docker-images.yml` that:
- Triggers when `externals/jellyfin-ffmpeg` submodule changes
- Builds and pushes Docker images to `ghcr.io/pproenca/jellyfin-ffmpeg/<target>-gpl:latest`
- Tags images with jellyfin-ffmpeg commit hash for cache alignment

**Changes to build-ffmpeg.yml:**
- Remove the `makeimage.sh` fallback
- Fail fast if `docker pull` fails (surfaces missing images immediately)
- Add diagnostic logging for image pull status

**Files affected:**
- Create: `.github/workflows/build-docker-images.yml`
- Modify: `.github/workflows/build-ffmpeg.yml` (lines 136-144)

### 2. ccache Integration

**Goal:** Avoid recompiling unchanged source files.

**Approach:**

**macOS:**
- Install ccache via Homebrew
- Add ccache libexec to PATH (wraps gcc/clang)
- Persist `~/.ccache` via `actions/cache`
- Key on arch + ffmpeg hash with restore-keys fallback

**Linux (Docker):**
- Mount host `~/.ccache` into container at `/root/.ccache`
- Modify jellyfin-ffmpeg builder Dockerfile to install ccache
- Set `CCACHE_DIR=/root/.ccache` and `CC='ccache gcc'` / `CXX='ccache g++'`

**Files affected:**
- Modify: `.github/workflows/build-ffmpeg.yml`
- Modify: `externals/jellyfin-ffmpeg/builder/images/*/Dockerfile` (add ccache)

### 3. Homebrew Dependency Caching (macOS)

**Goal:** Reduce 2-5 minutes of `brew install` on every macOS build.

**Approach:**
- Cache Homebrew Cellar and opt directories
- Key on package list hash + runner arch
- Use conditional install (skip if already present)

**Cache paths:**
```
~/Library/Caches/Homebrew
/opt/homebrew/Cellar
/opt/homebrew/opt
```

**Files affected:**
- Modify: `.github/workflows/build-ffmpeg.yml` (macOS steps)

### 4. Cache Key Hardening

**Goal:** Prevent silent cache misses and improve hit rate.

**Approach:**
- Add `restore-keys` fallback to allow partial hits
- Add diagnostic logging for cache key and hit status
- Verify submodule checkout consistency

**Current key:**
```
ffmpeg-${{ matrix.platform }}-${{ steps.ffmpeg-hash.outputs.hash }}-${{ env.CACHE_VERSION }}
```

**Enhanced restore-keys:**
```
ffmpeg-${{ matrix.platform }}-${{ steps.ffmpeg-hash.outputs.hash }}-
ffmpeg-${{ matrix.platform }}-
```

**Files affected:**
- Modify: `.github/workflows/build-ffmpeg.yml`

## Implementation Order

| Phase | Items | Rationale |
|-------|-------|-----------|
| 1 | #4 (Cache hardening) | Low risk, immediate visibility into cache behavior |
| 2 | #1 (Docker images) | High impact, eliminates fallback builds |
| 3 | #3 (Homebrew caching) | Medium impact, quick to implement |
| 4 | #2 (ccache) | High impact, requires builder modifications |

## Success Criteria

- Docker image pull succeeds on all Linux builds (no fallback)
- ccache hit rate > 80% on incremental builds
- macOS builds skip Homebrew installs when cached
- Cache hit/miss logged explicitly in workflow output

## Trade-offs Considered

**ccache in Docker:** Requires modifying the jellyfin-ffmpeg fork. If upstream jellyfin-ffmpeg changes significantly, may need to re-apply ccache modifications. Acceptable because:
- The builder Dockerfile changes infrequently
- ccache modification is additive (doesn't break builds if removed)

**Homebrew caching:** Cache size can grow large. Mitigated by:
- Only caching specific packages needed for FFmpeg
- Using versioned cache key to invalidate when needed

## Not Included (Future Optimizations)

- Self-hosted runners (out of scope per constraints)
- sccache with S3 backend (requires cloud resources)
- Stripping unneeded codecs (requires feature audit)
- Build-once-per-platform matrix refactoring (already implemented via deps-vN releases)
