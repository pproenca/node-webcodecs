# CI Cache Improvements Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2026-01-01-ci-cache-improvements.md` to implement task-by-task.

**Goal:** Improve CI cache management by using versioned env constants (like node-av) and add `--tag-libc` to prebuildify for proper glibc/musl tagging.

**Architecture:** Convert workflow input-based cache versioning to env-constant pattern for easier cache busting. Add libc tagging to prebuildify output for proper Linux binary naming.

**Tech Stack:** GitHub Actions YAML, prebuildify CLI

---

## Task 1: Add CACHE_VERSION env constants to build-ffmpeg.yml

**Files:**
- Modify: `.github/workflows/build-ffmpeg.yml:1-60`

**Step 1: Add env constants block at top of workflow** (2-3 min)

Add after line 6 (after `on:` section ends, before `permissions:`):

```yaml
env:
  CACHE_VERSION_MACOS: "v5"
  CACHE_VERSION_LINUX: "v5"
```

**Step 2: Update cache key to use env constants** (2-3 min)

Find line 85-87 (the cache key):
```yaml
key: ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-${{ env.CACHE_VERSION }}
```

Change to use platform-specific constants:
```yaml
key: ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-${{ startsWith(matrix.platform, 'darwin') && env.CACHE_VERSION_MACOS || env.CACHE_VERSION_LINUX }}
```

**Step 3: Update restore-keys pattern** (1 min)

Change line 87:
```yaml
restore-keys: |
  ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-
```

To include the platform-specific version:
```yaml
restore-keys: |
  ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-${{ startsWith(matrix.platform, 'darwin') && env.CACHE_VERSION_MACOS || env.CACHE_VERSION_LINUX }}
  ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-
```

**Step 4: Update save cache key** (1 min)

Find line 225 and apply same pattern:
```yaml
key: ffmpeg-${{ matrix.platform }}-${{ env.FFMPEG_VERSION }}-${{ startsWith(matrix.platform, 'darwin') && env.CACHE_VERSION_MACOS || env.CACHE_VERSION_LINUX }}
```

**Step 5: Remove cache_version from workflow inputs** (2 min)

Remove lines 14-16 (workflow_dispatch input) and lines 26-29 (workflow_call input):
```yaml
cache_version:
  description: "Cache version (bump to force rebuild)"
  default: "v4"
```

And remove line 56:
```yaml
CACHE_VERSION: ${{ inputs.cache_version || 'v4' }}
```

**Step 6: Commit** (30 sec)

```bash
git add .github/workflows/build-ffmpeg.yml
git commit -m "ci(build-ffmpeg): use env constants for cache versioning

Like node-av pattern, use CACHE_VERSION_MACOS and CACHE_VERSION_LINUX
env constants instead of workflow inputs for easier cache busting."
```

---

## Task 2: Update build-prebuilds.yml to match

**Files:**
- Modify: `.github/workflows/build-prebuilds.yml:1-50`

**Step 1: Add matching env constants** (1 min)

Add after line 7 (after concurrency block):
```yaml
env:
  CACHE_VERSION_MACOS: "v5"
  CACHE_VERSION_LINUX: "v5"
```

**Step 2: Update cache restore key** (2 min)

Find lines 108-112 and update:
```yaml
key: ffmpeg-${{ matrix.platform }}-${{ inputs.ffmpeg_version }}-${{ startsWith(matrix.platform, 'darwin') && env.CACHE_VERSION_MACOS || env.CACHE_VERSION_LINUX }}
restore-keys: |
  ffmpeg-${{ matrix.platform }}-${{ inputs.ffmpeg_version }}-${{ startsWith(matrix.platform, 'darwin') && env.CACHE_VERSION_MACOS || env.CACHE_VERSION_LINUX }}
  ffmpeg-${{ matrix.platform }}-${{ inputs.ffmpeg_version }}-
```

**Step 3: Remove cache_version from workflow inputs/call** (2 min)

Remove from workflow_dispatch inputs (lines 17-19) and workflow_call inputs (lines 25-28):
```yaml
cache_version:
  description: "Cache version (bump to force rebuild)"
  type: string
  default: "v4"
```

Remove from workflow_call (line 50):
```yaml
cache_version: ${{ inputs.cache_version }}
```

**Step 4: Commit** (30 sec)

```bash
git add .github/workflows/build-prebuilds.yml
git commit -m "ci(build-prebuilds): use env constants for cache versioning

Match build-ffmpeg.yml pattern with CACHE_VERSION_* env constants."
```

---

## Task 3: Add --tag-libc to prebuildify for Linux builds

**Files:**
- Modify: `.github/workflows/build-prebuilds.yml:169-182`

**Step 1: Update prebuildify command** (2 min)

Find line 171:
```yaml
npx prebuildify --napi --strip --arch=${{ matrix.arch }}
```

Change to:
```yaml
npx prebuildify --napi --strip --arch=${{ matrix.arch }} ${{ matrix.container && '--tag-libc' || '' }}
```

This adds `--tag-libc` only for Alpine (linuxmusl) builds since they use containers.

**Step 2: Also add --tag-libc for linux-x64** (2 min)

Actually, we want `--tag-libc` for ALL Linux builds (glibc and musl). Change to:
```yaml
npx prebuildify --napi --strip --arch=${{ matrix.arch }} ${{ runner.os == 'Linux' && '--tag-libc' || '' }}
```

**Step 3: Update rename logic to handle libc suffix** (3 min)

The `--tag-libc` flag changes the output directory name. Update lines 173-182:

```yaml
# Rename the built file to node_webcodecs.node for consistency
BUILT_FILE=$(find prebuilds -name "*.node" -type f | head -1)
if [ -n "$BUILT_FILE" ]; then
  DIR=$(dirname "$BUILT_FILE")
  mv "$BUILT_FILE" "$DIR/node_webcodecs.node"
  echo "Renamed $(basename $BUILT_FILE) -> node_webcodecs.node in $DIR"
else
  echo "Error: No .node file found in prebuilds directory"
  find prebuilds -type f || true
  exit 1
fi
```

No change needed - the find command already handles any directory structure.

**Step 4: Verify artifact path still works** (1 min)

Line 200 uses wildcard which handles the new directory structure:
```yaml
cp prebuilds/*/node_webcodecs.node prebuild-${{ matrix.platform }}/node-webcodecs.node
```

This still works because we're copying from any prebuilds subdirectory.

**Step 5: Commit** (30 sec)

```bash
git add .github/workflows/build-prebuilds.yml
git commit -m "ci(build-prebuilds): add --tag-libc to prebuildify for Linux

Like node-av, use --tag-libc flag for Linux builds to properly
tag binaries as glibc or musl in the output directory name."
```

---

## Task 4: Code Review

**Step 1: Review all changes** (5 min)

Run:
```bash
git diff HEAD~3..HEAD
```

Verify:
- [ ] `CACHE_VERSION_MACOS` and `CACHE_VERSION_LINUX` are defined in both workflows
- [ ] Cache keys use correct conditional syntax
- [ ] `--tag-libc` is added only for Linux builds
- [ ] No workflow syntax errors

**Step 2: Test workflow syntax locally** (2 min)

```bash
act -n -j build-ffmpeg --container-architecture linux/amd64 -W .github/workflows/build-ffmpeg.yml
```

**Step 3: Commit any fixes** (30 sec)

If fixes needed, amend the appropriate commit.

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Both modify workflow files but different files, can run parallel |
| Group 2 | 3 | Depends on Task 2 completing (modifies same file) |
| Group 3 | 4 | Code review depends on all prior tasks |

---

## Summary of Changes

| File | Change |
|------|--------|
| `.github/workflows/build-ffmpeg.yml` | Add `CACHE_VERSION_MACOS`/`CACHE_VERSION_LINUX` env constants, remove `cache_version` input |
| `.github/workflows/build-prebuilds.yml` | Add matching env constants, add `--tag-libc` for Linux, remove `cache_version` input |
