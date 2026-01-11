# Change: Harden Native Build Configuration

## Why

The `binding.gyp` and FFmpeg path resolution system has 16 identified issues ranging from critical build failures to best-practice gaps. A comprehensive audit revealed:

- **4 critical issues** causing silent build failures or runtime crashes
- **4 high-priority issues** affecting reliability and portability
- **4 medium-priority issues** missing best practices
- **4 low-priority enhancements** for CI efficiency

Key problems:
1. Linux builds fail silently if FFmpeg is missing (no fallback paths like macOS)
2. Runtime library resolution fails without RPATH configuration
3. Errors are suppressed by default in `ffmpeg-paths.js`
4. No validation that pkg-config returns non-empty output

## What Changes

### Critical Fixes (P0)
- Add Linux FFmpeg include/library fallback paths
- Make `ffmpeg-paths.js` errors explicit (always log to stderr)
- Add RPATH configuration for macOS (`@loader_path`) and Linux (`$ORIGIN`)
- Validate pkg-config output is non-empty before processing

### High Priority (P1)
- Add dynamic linking fallback for Linux (when `--static` fails)
- Add MacPorts support in macOS fallback paths (`/opt/local`)
- Add pkg-config existence check before using it

### Medium Priority (P2)
- Add missing compiler warnings (`-Wpedantic`, `-Wshadow`)
- Add explicit Debug/Release `configurations` block
- Enable parallel compilation (`-j max`) by default

### Low Priority (P3)
- Add node-gyp header caching in CI
- Implement `rpath` mode in `ffmpeg-paths.js`

## Impact

- **Affected specs:** Creates new `native-build` capability spec (none exists)
- **Affected code:**
  - `binding.gyp` — Platform conditions, RPATH, warnings, configurations
  - `gyp/ffmpeg-paths-lib.ts` — Error logging, validation, pkg-config check
  - `package.json` — Build script flags
  - `.github/workflows/ci.yml` — Caching configuration

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| RPATH addition | May affect existing builds | Test on all CI platforms |
| Explicit error logging | May break silent fallback behavior | Log to stderr only, not stdout |
| Static→dynamic fallback | May link wrong FFmpeg version | Document precedence clearly |
| Additional warnings | May surface new warnings | Review before enabling |
