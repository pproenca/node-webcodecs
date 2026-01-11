"use strict";
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.
//
// Include path resolution order:
// 1. @pproenca/webcodecs-ffmpeg-dev npm package (cross-platform headers)
// 2. FFMPEG_ROOT env var + pkg-config
// 3. Platform-specific npm package + pkg-config
// 4. ./ffmpeg-install + pkg-config
// 5. System pkg-config (fallback)
//
// Library flags resolution order:
// 1. Platform-specific npm package ./link-flags export (static paths, no pkg-config)
// 2. FFMPEG_ROOT env var + pkg-config
// 3. Platform-specific npm package + pkg-config
// 4. ./ffmpeg-install + pkg-config
// 5. System pkg-config (fallback)
//
// The FFmpeg static libraries are built from:
// - Linux: docker/Dockerfile.linux-x64 (Alpine musl, fully static)
// - macOS: .github/workflows/build-ffmpeg.yml (native build)
//
// All codec dependencies (x264, x265, vpx, opus, etc.) are resolved automatically
// via the .pc files in the FFmpeg build.
//
// CRITICAL: The --define-variable=prefix= flag relocates hardcoded paths in .pc files
// (e.g., /build → actual extraction path). Without this, pkg-config returns paths
// that don't exist on the build machine.
//
// IMPORTANT: macOS framework flags (-framework X) must be filtered out because
// node-gyp's <!@()> splits output by whitespace, breaking "-framework Metal" into
// two tokens. binding.gyp already explicitly adds required frameworks.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPkgConfigAvailable = isPkgConfigAvailable;
exports.filterFrameworkFlags = filterFrameworkFlags;
exports.getFfmpegRoot = getFfmpegRoot;
exports.runPkgConfig = runPkgConfig;
exports.resolveLibFlags = resolveLibFlags;
exports.resolveIncludeFlags = resolveIncludeFlags;
exports.resolveRpath = resolveRpath;
exports.resolveProjectRoot = resolveProjectRoot;
const node_fs_1 = require("node:fs");
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const FFMPEG_LIBS = 'libavcodec libavformat libavutil libswscale libswresample libavfilter';
const LOG_PREFIX = '[node-webcodecs]';
function logError(message) {
    console.error(`${LOG_PREFIX} ${message}`);
}
function logDebug(message, env) {
    if (env.DEBUG) {
        console.error(`${LOG_PREFIX} [DEBUG] ${message}`);
    }
}
function isPkgConfigAvailable() {
    try {
        (0, node_child_process_1.execSync)('pkg-config --version', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    }
    catch {
        return false;
    }
}
function filterFrameworkFlags(flags) {
    const tokens = flags.split(/\s+/);
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '-framework') {
            i++;
            continue;
        }
        result.push(tokens[i]);
    }
    return result.join(' ');
}
function isMuslLibc() {
    // Check if we're running on musl libc (Alpine Linux, etc.)
    if ((0, node_os_1.platform)() !== 'linux') {
        return false;
    }
    try {
        // ldd --version outputs "musl libc" on musl systems
        const result = (0, node_child_process_1.execSync)('ldd --version 2>&1 || true', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.toLowerCase().includes('musl');
    }
    catch {
        return false;
    }
}
function tryResolveIncludeFromDevPackage() {
    // Try to resolve headers from the cross-platform dev package
    // This package contains only headers, no platform-specific libraries
    try {
        const includeIndex = require.resolve('@pproenca/webcodecs-ffmpeg-dev/include');
        const includeDir = (0, node_path_1.dirname)(includeIndex);
        if ((0, node_fs_1.existsSync)(includeDir)) {
            return includeDir;
        }
    }
    catch {
        // Package not installed
    }
    return null;
}
function tryResolveLinkFlagsFromNpmPackage() {
    // Resolve link flags directly from platform-specific npm package
    // This avoids pkg-config which has hardcoded paths in .pc files
    const basePlatform = `${(0, node_os_1.platform)()}-${(0, node_os_1.arch)()}`;
    const pkgNames = isMuslLibc()
        ? [`@pproenca/webcodecs-ffmpeg-${basePlatform}-musl`, `@pproenca/webcodecs-ffmpeg-${basePlatform}`]
        : [`@pproenca/webcodecs-ffmpeg-${basePlatform}`];
    for (const pkgName of pkgNames) {
        try {
            // Try to resolve the link-flags export from the platform package
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const linkFlags = require(`${pkgName}/link-flags`);
            if (linkFlags?.flags) {
                return linkFlags.flags;
            }
        }
        catch {
            // Package not installed or doesn't have link-flags export
        }
    }
    return null;
}
function tryResolveFromNpmPackage() {
    // Build platform-specific package name (e.g., @pproenca/webcodecs-ffmpeg-darwin-arm64)
    // On musl systems, try the musl-specific package first
    const basePlatform = `${(0, node_os_1.platform)()}-${(0, node_os_1.arch)()}`;
    const pkgNames = isMuslLibc()
        ? [`@pproenca/webcodecs-ffmpeg-${basePlatform}-musl`, `@pproenca/webcodecs-ffmpeg-${basePlatform}`]
        : [`@pproenca/webcodecs-ffmpeg-${basePlatform}`];
    for (const pkgName of pkgNames) {
        try {
            // Resolve the pkgconfig export from the platform package
            // The package exports "./pkgconfig" pointing to "./lib/pkgconfig/index.js"
            const pkgconfigIndex = require.resolve(`${pkgName}/pkgconfig`);
            const pkgconfig = (0, node_path_1.dirname)(pkgconfigIndex);
            if ((0, node_fs_1.existsSync)(pkgconfig)) {
                // The root is two levels up from lib/pkgconfig
                const root = (0, node_path_1.dirname)((0, node_path_1.dirname)(pkgconfig));
                return { root, pkgconfig };
            }
        }
        catch {
            // Package not installed - try next one
        }
    }
    return null;
}
function getFfmpegRoot(projectRoot, env) {
    // 1. FFMPEG_ROOT env var (explicit override)
    if (env.FFMPEG_ROOT) {
        const root = env.FFMPEG_ROOT;
        const pkgconfig = (0, node_path_1.join)(root, 'lib', 'pkgconfig');
        if ((0, node_fs_1.existsSync)(pkgconfig)) {
            return { root, pkgconfig };
        }
    }
    // 2. @pproenca/webcodecs-ffmpeg npm package (if installed)
    const npmPackage = tryResolveFromNpmPackage();
    if (npmPackage) {
        return npmPackage;
    }
    // 3. ./ffmpeg-install directory (local development)
    const ffmpegInstall = (0, node_path_1.join)(projectRoot, 'ffmpeg-install');
    const pkgconfig = (0, node_path_1.join)(ffmpegInstall, 'lib', 'pkgconfig');
    if ((0, node_fs_1.existsSync)(pkgconfig)) {
        return { root: ffmpegInstall, pkgconfig };
    }
    // 4. System pkg-config will be used as fallback by the caller
    return null;
}
function runPkgConfig(args, ffmpegRoot, pkgConfigPath, env) {
    const mergedEnv = { ...env, PKG_CONFIG_PATH: pkgConfigPath };
    const cmd = `pkg-config --define-variable=prefix="${ffmpegRoot}" ${args}`;
    try {
        const result = (0, node_child_process_1.execSync)(cmd, {
            encoding: 'utf8',
            env: mergedEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const trimmed = result.trim();
        if (!trimmed) {
            logError(`pkg-config returned empty output for: ${args}`);
            logError('Ensure FFmpeg 5.0+ development files are installed.');
            return null;
        }
        logDebug(`pkg-config ${args} -> ${trimmed}`, env);
        return trimmed;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(`pkg-config failed: ${message}`);
        logError('Ensure FFmpeg 5.0+ development files are installed.');
        logError('Install with: brew install ffmpeg (macOS), apt install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev (Debian/Ubuntu)');
        return null;
    }
}
function resolveLibFlags(projectRoot, env, currentPlatform) {
    // 1. Try direct link flags from npm package (avoids pkg-config path issues)
    const directFlags = tryResolveLinkFlagsFromNpmPackage();
    if (directFlags) {
        logDebug(`lib (npm link-flags) -> ${directFlags}`, env);
        return currentPlatform === 'darwin' ? filterFrameworkFlags(directFlags) : directFlags;
    }
    // 2. Fall back to pkg-config
    const ffmpeg = getFfmpegRoot(projectRoot, env);
    if (!ffmpeg) {
        return null;
    }
    const result = runPkgConfig(`--libs --static ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig, env);
    if (!result) {
        return null;
    }
    return currentPlatform === 'darwin' ? filterFrameworkFlags(result) : result;
}
function resolveIncludeFlags(projectRoot, env) {
    // 1. Try the cross-platform dev package first (has headers only)
    const devInclude = tryResolveIncludeFromDevPackage();
    if (devInclude) {
        logDebug(`include (dev package) -> ${devInclude}`, env);
        return devInclude;
    }
    // 2. Fall back to pkg-config from FFmpeg root
    const ffmpeg = getFfmpegRoot(projectRoot, env);
    if (!ffmpeg) {
        return null;
    }
    const result = runPkgConfig(`--cflags-only-I ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig, env);
    if (!result) {
        return null;
    }
    return result.replace(/-I/g, '').trim();
}
function resolveRpath(projectRoot, env) {
    const ffmpeg = getFfmpegRoot(projectRoot, env);
    if (!ffmpeg) {
        return null;
    }
    // Return the lib directory path for RPATH configuration
    const libDir = (0, node_path_1.join)(ffmpeg.root, 'lib');
    if ((0, node_fs_1.existsSync)(libDir)) {
        logDebug(`rpath -> ${libDir}`, env);
        return libDir;
    }
    return null;
}
function resolveProjectRoot() {
    return (0, node_path_1.resolve)(__dirname, '..');
}
