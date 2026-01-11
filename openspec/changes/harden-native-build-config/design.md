## Context

This project builds a Node.js native addon using node-gyp with FFmpeg as the codec engine. The build configuration must support:

- **Platforms:** macOS (arm64, x64), Linux (glibc, musl)
- **FFmpeg resolution:** 4-tier fallback (env var → npm package → local dir → pkg-config)
- **Static linking:** FFmpeg libraries statically linked for distribution
- **Framework linking:** macOS requires system frameworks (VideoToolbox, CoreMedia, etc.)

**Current Architecture:**
```
binding.gyp
    ├── Sources: 21 C++ files
    ├── N-API: v8 with exceptions enabled
    ├── macOS: xcode_settings + frameworks + fallback paths
    └── Linux: cflags_cc + static linking + -Wl,-Bsymbolic

gyp/ffmpeg-paths.js → ffmpeg-paths-lib.ts
    ├── FFMPEG_ROOT env var (priority 1)
    ├── @pproenca/webcodecs-ffmpeg npm package (priority 2)
    ├── ./ffmpeg-install directory (priority 3)
    └── System pkg-config (fallback)
```

**Problem Statement:**

The audit identified 16 issues in the current configuration. The most critical are:

1. **Linux has no hardcoded FFmpeg fallback** — macOS has `/opt/homebrew`, `/usr/local`; Linux has nothing
2. **No RPATH configuration** — Prebuilt binaries can't find FFmpeg libs at runtime
3. **Silent error handling** — `ffmpeg-paths.js` only logs with `DEBUG=1`
4. **No output validation** — Empty pkg-config output passes through silently

## Goals / Non-Goals

**Goals:**
- Fix all 4 critical issues (P0) that cause build/runtime failures
- Fix 4 high-priority issues (P1) affecting portability
- Add missing best practices (P2) for warnings and build configuration
- Improve CI efficiency (P3) with caching

**Non-Goals:**
- Windows support (intentionally dropped per project decision)
- Electron support (not currently needed)
- Cross-compilation (handled by CI matrix)
- prebuild/prebuildify integration (using platform packages instead)

## Decisions

### 1. Linux Fallback Paths

**Decision:** Add hardcoded fallback paths for Linux: `/usr/include`, `/usr/local/include`, `/usr/lib`, `/usr/local/lib`.

**Rationale:** Mirrors macOS behavior. Most Linux distributions with FFmpeg development packages install to these paths. Provides graceful degradation when pkg-config is missing.

**Alternatives considered:**
- No fallback (current): Requires pkg-config, confusing errors when missing
- Only `/usr/include`: Misses custom installations in `/usr/local`

### 2. RPATH Configuration

**Decision:** Add runtime library search paths:
- macOS: `-Wl,-rpath,@loader_path/../lib`
- Linux: `-Wl,-rpath,$ORIGIN/../lib`

**Rationale:** Prebuilt FFmpeg libraries from npm packages install to `node_modules/@pproenca/webcodecs-ffmpeg-*/lib/`. Without RPATH, the native addon can't find them at runtime.

**Alternatives considered:**
- Absolute paths only: Breaks when modules move
- LD_LIBRARY_PATH environment variable: Fragile, requires user configuration

### 3. Explicit Error Logging

**Decision:** Always log errors to stderr in `ffmpeg-paths-lib.ts`, not just when `DEBUG=1`.

**Rationale:** Silent failures cause confusing linker errors. Explicit messages ("FFmpeg pkg-config failed: ...") guide users to the solution.

**Implementation:** Log to stderr (not stdout) to avoid polluting gyp output which expects paths on stdout.

**Alternatives considered:**
- Keep silent by default: Poor developer experience
- Throw exceptions: Would break fallback chain

### 4. Static/Dynamic Linking Fallback

**Decision:** Linux tries `pkg-config --libs --static` first, falls back to `pkg-config --libs` (dynamic).

**Rationale:** Static linking is preferred for distribution, but dynamic linking allows using system FFmpeg when static libs unavailable.

**Alternatives considered:**
- Static only (current): Fails on systems with only dynamic FFmpeg
- Dynamic only: Larger binaries, runtime dependency on system FFmpeg version

### 5. Debug/Release Configurations

**Decision:** Add explicit `configurations` block with distinct optimization and debug symbol settings.

**Rationale:** node-gyp has defaults, but explicit configuration ensures:
- Debug builds have `-g -O0` for debugging
- Release builds have `-O3` for performance
- Consistent behavior across node-gyp versions

### 6. Parallel Compilation

**Decision:** Add `-j max` flag to all `node-gyp rebuild` invocations.

**Rationale:** Significantly faster builds on multi-core systems. No downside on single-core.

### 7. Additional Compiler Warnings

**Decision:** Add `-Wpedantic` and `-Wshadow` to both platforms.

**Rationale:**
- `-Wpedantic`: Enforces ISO C++ compliance
- `-Wshadow`: Catches variable shadowing bugs

**Not adding:** `-Wconversion` — Too noisy with FFmpeg types, would require extensive casts.

## Risks / Trade-offs

**[Risk] RPATH breaks existing deployments**
→ Mitigation: RPATH is additive; existing absolute path resolution still works. Test on all CI platforms.

**[Risk] New warnings surface existing code issues**
→ Mitigation: Review warnings before enabling. May require code fixes.

**[Risk] Dynamic FFmpeg fallback links wrong version**
→ Mitigation: Document that static is preferred, dynamic is fallback. pkg-config returns compatible version.

**[Risk] Stderr logging confuses users who expect silence**
→ Mitigation: Clear message prefix `[node-webcodecs]`. Only on actual errors.

## Migration Plan

1. **Phase 1 (P0):** Critical fixes — Must be deployed together
   - Linux fallback paths
   - RPATH configuration
   - Explicit error logging
   - Output validation

2. **Phase 2 (P1):** Reliability improvements — Can be incremental
   - Dynamic linking fallback
   - MacPorts paths
   - pkg-config existence check

3. **Phase 3 (P2):** Best practices — Low risk
   - Compiler warnings
   - Configurations block
   - Parallel compilation

4. **Phase 4 (P3):** Enhancements — Optional
   - CI caching
   - rpath mode implementation

**Rollback:** All changes are in configuration files. Revert commits to restore previous behavior.

## Open Questions

1. Should we add architecture-specific compiler flags (NEON for ARM, SSE/AVX for x86)?
2. Should we support cross-compilation scenarios (e.g., building Linux x64 on arm64)?
3. Should we add prebuildify integration for automated binary distribution?
