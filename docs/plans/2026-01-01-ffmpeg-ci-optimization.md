# FFmpeg CI Build Optimization Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-01-ffmpeg-ci-optimization.md` to implement task-by-task.

**Goal:** Optimize FFmpeg CI builds by hardening cache keys, automating Docker image publishing, adding Homebrew caching, and integrating ccache.

**Architecture:** Four-phase optimization: (1) Add cache diagnostics and restore-keys fallbacks, (2) Create automated Docker image workflow, (3) Cache Homebrew on macOS, (4) Add ccache for compilation. Each phase is independent and can be deployed incrementally.

**Tech Stack:** GitHub Actions, Docker BuildKit, ccache, Homebrew, actions/cache@v5

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Cache key hardening (standalone, no deps) |
| Group 2 | 2 | Docker image workflow (standalone, no deps) |
| Group 3 | 3 | Homebrew caching (standalone, no deps) |
| Group 4 | 4, 5 | ccache integration (Linux base Dockerfile + workflow must be serial) |
| Group 5 | 6 | Code Review |

---

### Task 1: Harden Cache Keys with Diagnostics and Restore-Keys

**Files:**
- Modify: `.github/workflows/build-ffmpeg.yml:57-64`

**Step 1: Read the current cache restore block** (1 min)

Review lines 57-64 of build-ffmpeg.yml to understand current structure.

**Step 2: Add restore-keys and diagnostic logging** (3 min)

Replace the cache restore step (lines 57-64) with:

```yaml
      - name: Restore FFmpeg cache
        if: ${{ github.event.inputs.force_rebuild != 'true' }}
        id: cache-ffmpeg
        uses: actions/cache/restore@v5
        with:
          path: ffmpeg-install
          key: ffmpeg-${{ matrix.platform }}-${{ steps.ffmpeg-hash.outputs.hash }}-${{ env.CACHE_VERSION }}
          restore-keys: |
            ffmpeg-${{ matrix.platform }}-${{ steps.ffmpeg-hash.outputs.hash }}-
            ffmpeg-${{ matrix.platform }}-

      - name: Log cache status
        run: |
          echo "::group::Cache Diagnostics"
          echo "Cache hit: ${{ steps.cache-ffmpeg.outputs.cache-hit }}"
          echo "Cache key: ffmpeg-${{ matrix.platform }}-${{ steps.ffmpeg-hash.outputs.hash }}-${{ env.CACHE_VERSION }}"
          echo "FFmpeg hash: ${{ steps.ffmpeg-hash.outputs.hash }}"
          echo "Cache version: ${{ env.CACHE_VERSION }}"
          if [[ "${{ steps.cache-ffmpeg.outputs.cache-hit }}" == "true" ]]; then
            echo "✓ Cache HIT - skipping build"
          else
            echo "⚠ Cache MISS - will rebuild FFmpeg"
          fi
          echo "::endgroup::"
```

**Step 3: Verify YAML syntax** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-ffmpeg.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

**Step 4: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml
git commit -m "ci(ffmpeg): add cache diagnostics and restore-keys fallback"
```

---

### Task 2: Create Automated Docker Image Publishing Workflow

**Files:**
- Create: `.github/workflows/build-docker-images.yml`
- Modify: `.github/workflows/build-ffmpeg.yml:137-144`

**Step 1: Create the Docker image workflow** (5 min)

Create `.github/workflows/build-docker-images.yml`:

```yaml
name: build-docker-images

# Build and push Docker images when jellyfin-ffmpeg submodule changes.
# This ensures build-ffmpeg.yml can always pull pre-built images.

on:
  push:
    paths:
      - "externals/jellyfin-ffmpeg/**"
  workflow_dispatch:
    inputs:
      force_rebuild:
        description: "Force rebuild (ignore cache)"
        type: boolean
        default: false

permissions:
  contents: read
  packages: write

jobs:
  build-images:
    name: "docker-${{ matrix.target }}"
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: linux64
            variant: gpl
    steps:
      - uses: actions/checkout@v6
        with:
          submodules: recursive

      - name: Get jellyfin-ffmpeg commit hash
        id: ffmpeg-hash
        run: |
          cd externals/jellyfin-ffmpeg
          echo "hash=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
          echo "full_hash=$(git rev-parse HEAD)" >> $GITHUB_OUTPUT

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push base image
        uses: docker/build-push-action@v6
        with:
          context: externals/jellyfin-ffmpeg/builder/images/base
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/base:latest
            ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/base:${{ steps.ffmpeg-hash.outputs.hash }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push target image
        uses: docker/build-push-action@v6
        with:
          context: externals/jellyfin-ffmpeg/builder/images/base-${{ matrix.target }}
          build-args: |
            GH_REPO=ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-${{ matrix.variant }}:latest
            ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-${{ matrix.variant }}:${{ steps.ffmpeg-hash.outputs.hash }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Generate final image with FFmpeg scripts
        run: |
          cd externals/jellyfin-ffmpeg/builder

          # Generate the Dockerfile for the full build image
          export GITHUB_REPOSITORY="${{ github.repository_owner }}/jellyfin-ffmpeg"
          ./generate.sh ${{ matrix.target }} ${{ matrix.variant }}

          # Build and push the final image
          docker buildx build \
            --push \
            --tag "ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-${{ matrix.variant }}:latest" \
            --tag "ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-${{ matrix.variant }}:${{ steps.ffmpeg-hash.outputs.hash }}" \
            --cache-from "type=registry,ref=ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-${{ matrix.variant }}:latest" \
            .
```

**Step 2: Update build-ffmpeg.yml to fail fast on missing image** (3 min)

Replace lines 137-144 in build-ffmpeg.yml:

```yaml
          # Pre-pull the Docker image - fail fast if missing
          IMAGE="ghcr.io/${{ github.repository_owner }}/jellyfin-ffmpeg/${{ matrix.target }}-gpl:latest"

          echo "::group::Docker Image Pull"
          if ! docker pull "${IMAGE}"; then
            echo "::error::Docker image not found: ${IMAGE}"
            echo "::error::Run the build-docker-images workflow first, or check GHCR permissions"
            exit 1
          fi
          echo "✓ Using pre-built Docker image: ${IMAGE}"
          echo "::endgroup::"
```

**Step 3: Verify YAML syntax for both files** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-docker-images.yml'))" && echo "build-docker-images.yml valid"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-ffmpeg.yml'))" && echo "build-ffmpeg.yml valid"
```

Expected: Both files valid

**Step 4: Commit** (30 sec)

```bash
git add .github/workflows/build-docker-images.yml .github/workflows/build-ffmpeg.yml
git commit -m "ci(ffmpeg): add automated Docker image publishing workflow

- New workflow builds and pushes Docker images on submodule changes
- build-ffmpeg.yml now fails fast if image is missing (no silent fallback)
- Images tagged with commit hash for cache alignment"
```

---

### Task 3: Add Homebrew Dependency Caching for macOS

**Files:**
- Modify: `.github/workflows/build-ffmpeg.yml:76-81`

**Step 1: Add Homebrew cache step before install** (3 min)

Insert before the "Install build tools (macOS)" step (around line 76):

```yaml
      - name: Cache Homebrew packages
        if: runner.os == 'macOS' && steps.cache-ffmpeg.outputs.cache-hit != 'true'
        uses: actions/cache@v5
        with:
          path: |
            ~/Library/Caches/Homebrew
            /opt/homebrew/Cellar
            /opt/homebrew/opt
            /usr/local/Cellar
            /usr/local/opt
          key: brew-ffmpeg-${{ runner.arch }}-v1
          restore-keys: |
            brew-ffmpeg-${{ runner.arch }}-
```

**Step 2: Update brew install to be conditional** (2 min)

Replace the "Install build tools (macOS)" step:

```yaml
      - name: Install build tools (macOS)
        if: runner.os == 'macOS' && steps.cache-ffmpeg.outputs.cache-hit != 'true'
        run: |
          # Install dependencies as listed in jellyfin-ffmpeg/builder/Buildmac.md
          # Only install packages not already present (from cache)
          PACKAGES="nasm pkg-config autoconf automake libtool cmake meson ninja quilt"
          MISSING=""
          for pkg in $PACKAGES; do
            if ! brew list "$pkg" &>/dev/null; then
              MISSING="$MISSING $pkg"
            fi
          done
          if [[ -n "$MISSING" ]]; then
            echo "Installing missing packages:$MISSING"
            brew install $MISSING
          else
            echo "All packages already installed (from cache)"
          fi
```

**Step 3: Verify YAML syntax** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-ffmpeg.yml'))" && echo "YAML valid"
```

**Step 4: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml
git commit -m "ci(ffmpeg): cache Homebrew packages on macOS

Caches Cellar and opt directories to skip brew install on cache hit.
Conditional install only installs missing packages."
```

---

### Task 4: Add ccache to Linux Docker Base Image

**Files:**
- Modify: `externals/jellyfin-ffmpeg/builder/images/base/Dockerfile`

**Step 1: Add ccache installation to base Dockerfile** (3 min)

After the main apt-get install block (around line 23), add ccache:

```dockerfile
RUN \
    apt-get -y update && \
    apt-get -y dist-upgrade && \
    apt-get -y install build-essential yasm nasm quilt rsync \
        xxd pkgconf curl wget unzip git subversion mercurial \
        autoconf automake libtool libtool-bin autopoint gettext cmake clang meson ninja-build \
        texinfo texi2html help2man flex bison groff \
        gperf itstool ragel libc6-dev zlib1g-dev libssl-dev \
        gtk-doc-tools gobject-introspection gawk \
        ocaml ocamlbuild libnum-ocaml-dev indent p7zip-full \
        python3-setuptools python3-jinja2 python3-apt python-is-python3 \
        ccache && \
    apt-get -y clean && \
    git config --global user.email "builder@localhost" && \
    git config --global user.name "Builder" && \
    git config --global advice.detachedHead false
```

Then add ccache configuration after the apt-get block:

```dockerfile
# Configure ccache
ENV CCACHE_DIR=/root/.ccache \
    CCACHE_MAXSIZE=2G \
    CCACHE_COMPRESS=1
```

**Step 2: Verify Dockerfile syntax** (30 sec)

```bash
docker build --check externals/jellyfin-ffmpeg/builder/images/base/ 2>/dev/null || echo "Check manually - docker build --check may not be available"
```

**Step 3: Commit** (30 sec)

```bash
git add externals/jellyfin-ffmpeg/builder/images/base/Dockerfile
git commit -m "ci(ffmpeg): add ccache to Linux Docker base image

Installs ccache and configures CCACHE_DIR, CCACHE_MAXSIZE, CCACHE_COMPRESS.
Requires workflow to mount host ccache directory into container."
```

---

### Task 5: Integrate ccache in build-ffmpeg Workflow

**Files:**
- Modify: `.github/workflows/build-ffmpeg.yml`

**Step 1: Add ccache cache restore for Linux** (3 min)

Insert before the "Build FFmpeg (Linux)" step:

```yaml
      - name: Restore ccache (Linux)
        if: runner.os == 'Linux' && steps.cache-ffmpeg.outputs.cache-hit != 'true'
        uses: actions/cache@v5
        with:
          path: ~/.ccache
          key: ccache-linux-${{ steps.ffmpeg-hash.outputs.hash }}-${{ env.CACHE_VERSION }}
          restore-keys: |
            ccache-linux-${{ steps.ffmpeg-hash.outputs.hash }}-
            ccache-linux-
```

**Step 2: Update Linux build to mount ccache** (3 min)

In the "Build FFmpeg (Linux)" step, after the docker pull, update the docker run in build.sh to include ccache mount. Since build.sh handles the docker run internally, we need to set environment variables:

Add to the "Build FFmpeg (Linux)" step, before calling build.sh:

```yaml
          # Prepare ccache directory for Docker mount
          mkdir -p ~/.ccache
          export CCACHE_DIR="$HOME/.ccache"

          # Build FFmpeg using Docker with ccache mount
          # Note: build.sh uses docker run internally, we modify environment
          export DOCKER_EXTRA_ARGS="-v $HOME/.ccache:/root/.ccache -e CCACHE_DIR=/root/.ccache"
```

Since build.sh doesn't support DOCKER_EXTRA_ARGS, we need to modify the docker run command inline:

Replace the `./build.sh ${{ matrix.target }} gpl` call with:

```yaml
          # Run docker directly with ccache mount instead of using build.sh
          # This gives us control over the mount options
          docker run --rm \
            -v "$PWD/ffbuild:/ffbuild" \
            -v "$HOME/.ccache:/root/.ccache" \
            -e CCACHE_DIR=/root/.ccache \
            "${IMAGE}" bash -c '
              set -xe
              cd /ffbuild/ffmpeg
              if [[ -f "debian/patches/series" ]]; then
                ln -s /ffbuild/ffmpeg/debian/patches patches
                quilt push -a
              fi
              # Use ccache for compilation
              export CC="ccache gcc"
              export CXX="ccache g++"
              ./configure --prefix=/ffbuild/prefix \
                $FFBUILD_TARGET_FLAGS \
                --extra-version="Jellyfin"
              make -j$(nproc) V=1
              make install
              # Show ccache stats
              ccache -s
            '
```

**Step 3: Add ccache for macOS** (3 min)

Add after Homebrew cache step:

```yaml
      - name: Restore ccache (macOS)
        if: runner.os == 'macOS' && steps.cache-ffmpeg.outputs.cache-hit != 'true'
        uses: actions/cache@v5
        with:
          path: ~/.ccache
          key: ccache-macos-${{ matrix.arch }}-${{ steps.ffmpeg-hash.outputs.hash }}-${{ env.CACHE_VERSION }}
          restore-keys: |
            ccache-macos-${{ matrix.arch }}-${{ steps.ffmpeg-hash.outputs.hash }}-
            ccache-macos-${{ matrix.arch }}-
```

Update "Install build tools (macOS)" to add ccache:

```yaml
          PACKAGES="nasm pkg-config autoconf automake libtool cmake meson ninja quilt ccache"
```

Add after install step:

```yaml
      - name: Configure ccache (macOS)
        if: runner.os == 'macOS' && steps.cache-ffmpeg.outputs.cache-hit != 'true'
        run: |
          # Add ccache to PATH so it wraps compiler calls
          echo "$(brew --prefix ccache)/libexec" >> $GITHUB_PATH
          # Configure ccache
          ccache --set-config=max_size=2G
          ccache --set-config=compression=true
          ccache -z  # Zero stats for this run
```

**Step 4: Verify YAML syntax** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-ffmpeg.yml'))" && echo "YAML valid"
```

**Step 5: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml
git commit -m "ci(ffmpeg): integrate ccache for Linux and macOS builds

- Restores ccache from previous runs via actions/cache
- Linux: mounts host ccache into Docker container
- macOS: uses Homebrew ccache with PATH wrapper
- Shows ccache stats after build for monitoring"
```

---

### Task 6: Code Review

**Files:**
- All modified files from Tasks 1-5

**Step 1: Review all changes** (5 min)

```bash
git log --oneline -6
git diff HEAD~5..HEAD --stat
```

**Step 2: Run YAML validation on all workflows** (1 min)

```bash
for f in .github/workflows/*.yml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "✓ $f valid" || echo "✗ $f INVALID"
done
```

**Step 3: Verify no secrets or sensitive data exposed** (1 min)

```bash
git diff HEAD~5..HEAD | grep -i -E "(secret|token|password|key)" || echo "No sensitive patterns found"
```

**Step 4: Review checklist** (2 min)

- [ ] Cache keys include version suffix for invalidation
- [ ] restore-keys provide fallback for partial cache hits
- [ ] Docker image workflow requires packages:write permission
- [ ] build-ffmpeg.yml fails fast on missing Docker image
- [ ] Homebrew cache paths cover both Intel (/usr/local) and ARM (/opt/homebrew)
- [ ] ccache has size limits configured (2G)
- [ ] ccache stats logged for monitoring

**Step 5: Final commit if any fixes needed** (30 sec)

```bash
# Only if fixes were made
git add -A && git commit -m "ci(ffmpeg): address code review feedback"
```
