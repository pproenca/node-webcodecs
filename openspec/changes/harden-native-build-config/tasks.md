## 1. Critical Fixes (P0)

### 1.1 Linux FFmpeg Fallback
- [x] 1.1.1 Add fallback include paths to `binding.gyp:83-84` (`/usr/include /usr/local/include`)
- [x] 1.1.2 Add fallback library paths to `binding.gyp:86` (`-L/usr/lib -L/usr/local/lib`)
- [x] 1.1.3 Test build without pkg-config available

### 1.2 Explicit Error Logging
- [x] 1.2.1 Update `gyp/ffmpeg-paths-lib.ts:116-122` to always log errors to stderr
- [x] 1.2.2 Add `[node-webcodecs]` prefix to error messages
- [x] 1.2.3 Add helpful message suggesting FFmpeg 5.0+ installation
- [x] 1.2.4 Rebuild gyp scripts (`npm run build:scripts`)

### 1.3 RPATH Configuration
- [x] 1.3.1 Add macOS RPATH to `binding.gyp` xcode_settings OTHER_LDFLAGS
- [x] 1.3.2 Add Linux RPATH to `binding.gyp` ldflags array
- [x] 1.3.3 Verify RPATH with `otool -l` (macOS) / `readelf -d` (Linux)

### 1.4 Output Validation
- [x] 1.4.1 Add empty output check in `runPkgConfig()` function
- [x] 1.4.2 Log warning when pkg-config returns empty string
- [x] 1.4.3 Rebuild and test with mocked empty output

## 2. High Priority (P1)

### 2.1 Dynamic Linking Fallback
- [x] 2.1.1 Update Linux library resolution to try `--static` first, then without
- [x] 2.1.2 Test with FFmpeg dynamic-only installation

### 2.2 MacPorts Support
- [x] 2.2.1 Add `/opt/local/include` to macOS include fallback paths
- [x] 2.2.2 Add `/opt/local/lib` to macOS library fallback paths

### 2.3 pkg-config Existence Check
- [x] 2.3.1 Add `isPkgConfigAvailable()` helper function to `ffmpeg-paths-lib.ts`
- [x] 2.3.2 Check availability before attempting pkg-config resolution
- [x] 2.3.3 Log clear message when pkg-config is unavailable

## 3. Medium Priority (P2)

### 3.1 Compiler Warnings
- [x] 3.1.1 Add `-Wpedantic` and `-Wshadow` to macOS OTHER_CPLUSPLUSFLAGS
- [x] 3.1.2 Add `-Wpedantic` and `-Wshadow` to Linux cflags_cc
- [x] 3.1.3 Fix any new warnings that surface
- [x] 3.1.4 Verify clean build on both platforms

### 3.2 Configurations Block
- [x] 3.2.1 Add `configurations` block to binding.gyp with Debug settings
- [x] 3.2.2 Add Release settings to configurations block
- [x] 3.2.3 Test `npm run build:debug` produces debug symbols
- [x] 3.2.4 Test default build produces optimized output

### 3.3 Parallel Compilation
- [x] 3.3.1 Update `package.json` build:native script with `-j max`
- [x] 3.3.2 Update build script with `-j max`
- [x] 3.3.3 Verify parallel compilation works

## 4. Low Priority (P3)

### 4.1 CI Caching
- [x] 4.1.1 Add node-gyp cache configuration to `.github/workflows/ci.yml`
- [x] 4.1.2 Use cache key based on `binding.gyp` hash
- [x] 4.1.3 Test CI with and without cache

### 4.2 rpath Mode Implementation
- [x] 4.2.1 Implement `rpath` mode in `gyp/ffmpeg-paths-lib.ts`
- [x] 4.2.2 Return FFmpeg lib directory path
- [x] 4.2.3 Update compiled `ffmpeg-paths.js`

## 5. Verification

### 5.1 Build Verification
- [x] 5.1.1 Run `npm run build` (clean rebuild)
- [x] 5.1.2 Run `npm run build:debug` (debug build)
- [ ] 5.1.3 Run `npm run build -- --enable_sanitizers=1` (sanitizers)

### 5.2 Test Verification
- [x] 5.2.1 Run `npm run check` (lint + test)
- [ ] 5.2.2 Run `npm run test:native` (C++ tests)

### 5.3 Platform Verification
- [x] 5.3.1 Verify linked libraries with `otool -L` (macOS) or `ldd` (Linux)
- [x] 5.3.2 Verify RPATH with `otool -l | grep -A2 LC_RPATH` (macOS)
- [ ] 5.3.3 Verify RPATH with `readelf -d | grep RUNPATH` (Linux)

### 5.4 FFmpeg Resolution Verification
- [x] 5.4.1 Test with `DEBUG=1 node gyp/ffmpeg-paths.js lib`
- [ ] 5.4.2 Test with `FFMPEG_ROOT=/path/to/ffmpeg node gyp/ffmpeg-paths.js lib`
- [x] 5.4.3 Test with pkg-config unavailable (verify fallback)
