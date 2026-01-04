"use strict";
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.
//
// Resolution order:
// 1. FFMPEG_ROOT env var (set by CI from deps-v* release artifacts)
// 2. ./ffmpeg-install directory (local development)
// 3. System pkg-config (fallback)
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
exports.filterFrameworkFlags = filterFrameworkFlags;
exports.getFfmpegRoot = getFfmpegRoot;
exports.runPkgConfig = runPkgConfig;
exports.resolveLibFlags = resolveLibFlags;
exports.resolveIncludeFlags = resolveIncludeFlags;
exports.resolveProjectRoot = resolveProjectRoot;
const node_fs_1 = require("node:fs");
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const FFMPEG_LIBS = 'libavcodec libavformat libavutil libswscale libswresample libavfilter';
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
function getFfmpegRoot(projectRoot, env) {
    if (env.FFMPEG_ROOT) {
        const root = env.FFMPEG_ROOT;
        const pkgconfig = (0, node_path_1.join)(root, 'lib', 'pkgconfig');
        if ((0, node_fs_1.existsSync)(pkgconfig)) {
            return { root, pkgconfig };
        }
    }
    const ffmpegInstall = (0, node_path_1.join)(projectRoot, 'ffmpeg-install');
    const pkgconfig = (0, node_path_1.join)(ffmpegInstall, 'lib', 'pkgconfig');
    if ((0, node_fs_1.existsSync)(pkgconfig)) {
        return { root: ffmpegInstall, pkgconfig };
    }
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
        return result.trim();
    }
    catch (error) {
        if (env.DEBUG) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`pkg-config failed: ${message}`);
        }
        return null;
    }
}
function resolveLibFlags(projectRoot, env, platform) {
    const ffmpeg = getFfmpegRoot(projectRoot, env);
    if (!ffmpeg) {
        return null;
    }
    const result = runPkgConfig(`--libs --static ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig, env);
    if (!result) {
        return null;
    }
    return platform === 'darwin' ? filterFrameworkFlags(result) : result;
}
function resolveIncludeFlags(projectRoot, env) {
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
function resolveProjectRoot() {
    const currentDir = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url));
    return (0, node_path_1.resolve)(currentDir, '..');
}
