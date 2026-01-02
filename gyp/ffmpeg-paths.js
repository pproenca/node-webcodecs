#!/usr/bin/env node
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

'use strict';

const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { join, resolve } = require('node:path');

const FFMPEG_LIBS = 'libavcodec libavformat libavutil libswscale libswresample libavfilter';

// Filter out "-framework X" pairs from linker flags.
// node-gyp's <!@()> command substitution splits by whitespace, which breaks
// "-framework Metal" into ["-framework", "Metal"]. The linker then tries to
// open "Metal" as a file. binding.gyp already adds required frameworks explicitly.
function filterFrameworkFlags(flags) {
  const tokens = flags.split(/\s+/);
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '-framework') {
      // Skip -framework and its argument (the framework name)
      i++;
    } else {
      result.push(tokens[i]);
    }
  }
  return result.join(' ');
}

// Detect FFmpeg root from environment or filesystem
function getFFmpegRoot() {
  // 1. Check FFMPEG_ROOT env var (set by CI workflow)
  if (process.env.FFMPEG_ROOT) {
    const root = process.env.FFMPEG_ROOT;
    const pkgconfig = join(root, 'lib', 'pkgconfig');
    if (existsSync(pkgconfig)) {
      return { root, pkgconfig };
    }
  }

  // 2. Check ffmpeg-install directory (local fallback)
  const projectRoot = resolve(__dirname, '..');
  const ffmpegInstall = join(projectRoot, 'ffmpeg-install');
  const pkgconfig = join(ffmpegInstall, 'lib', 'pkgconfig');
  if (existsSync(pkgconfig)) {
    return { root: ffmpegInstall, pkgconfig };
  }

  return null;
}

// Run pkg-config with relocated prefix
function runPkgConfig(args, ffmpegRoot, pkgConfigPath) {
  const env = { ...process.env, PKG_CONFIG_PATH: pkgConfigPath };

  // --define-variable=prefix= relocates hardcoded paths in .pc files
  // This is CRITICAL: .pc files contain /opt/ffbuild/prefix but we extracted to $FFMPEG_ROOT
  const cmd = `pkg-config --define-variable=prefix="${ffmpegRoot}" ${args}`;

  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim();
  } catch (e) {
    // Log error for debugging in CI
    if (process.env.DEBUG) {
      console.error(`pkg-config failed: ${e.message}`);
      if (e.stderr) console.error(e.stderr);
    }
    return null;
  }
}

const mode = process.argv[2] || 'lib';
const ffmpeg = getFFmpegRoot();

if (mode === 'lib') {
  // Output library flags for linking
  if (ffmpeg) {
    const result = runPkgConfig(`--libs --static ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig);
    if (result) {
      // Filter out -framework flags on macOS (binding.gyp adds them explicitly)
      const filtered = process.platform === 'darwin' ? filterFrameworkFlags(result) : result;
      console.log(filtered);
      process.exit(0);
    }
  }
  // Fallback: let binding.gyp handle it with system pkg-config
  process.exit(1);

} else if (mode === 'include') {
  // Output include paths for compilation
  if (ffmpeg) {
    const result = runPkgConfig(`--cflags-only-I ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig);
    if (result) {
      // Remove -I prefix for node-gyp include_dirs format
      console.log(result.replace(/-I/g, '').trim());
      process.exit(0);
    }
  }
  // Fallback
  process.exit(1);

} else if (mode === 'rpath') {
  // rpath is not needed for static linking - all symbols are in the binary
  process.exit(0);
}
