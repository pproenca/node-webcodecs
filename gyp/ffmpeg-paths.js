#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.
// FFmpeg is statically linked, so we only need lib path (-L) and include path.
// No rpath is needed since all symbols are statically linked into the .node binary.
//
// Path resolution order:
// 1. CI-built FFmpeg in ffmpeg-install/ directory (from jellyfin-ffmpeg build)
// 2. Prebuilt @pproenca/ffmpeg-{platform} npm package
// 3. Fall back to pkg-config (handled by binding.gyp fallback)

'use strict';

const { existsSync } = require('node:fs');
const { join, dirname, resolve } = require('node:path');
const { platform, arch } = require('node:os');

function getRuntimePlatform() {
  return `${platform()}-${arch()}`;
}

// Check for CI-built FFmpeg (from jellyfin-ffmpeg workflow)
function getCIBuildPath(type) {
  // Check relative to project root
  const projectRoot = resolve(__dirname, '..');
  const ffmpegInstall = join(projectRoot, 'ffmpeg-install');

  if (type === 'lib') {
    const libPath = join(ffmpegInstall, 'lib');
    if (existsSync(libPath)) {
      return libPath;
    }
  } else if (type === 'include') {
    const includePath = join(ffmpegInstall, 'include');
    if (existsSync(includePath)) {
      return includePath;
    }
  }

  return null;
}

function getPrebuiltLibPath() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const libEntry = require.resolve(`${packageName}/lib`);
    return dirname(libEntry);
  } catch {
    return null;
  }
}

function getPrebuiltIncludePath() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const includeEntry = require.resolve(`${packageName}/include`);
    return dirname(includeEntry);
  } catch {
    // Fallback: check relative to lib path
    const libPath = getPrebuiltLibPath();
    if (!libPath) return null;
    const includePath = join(dirname(libPath), 'include');
    return existsSync(includePath) ? includePath : null;
  }
}

// Output for node-gyp variable expansion
const mode = process.argv[2] || 'lib';

if (mode === 'lib') {
  // Priority: CI build > prebuilt package > pkg-config (fallback in binding.gyp)
  const ciPath = getCIBuildPath('lib');
  if (ciPath) {
    console.log(`-L${ciPath}`);
    process.exit(0);
  }

  const libPath = getPrebuiltLibPath();
  if (libPath) {
    console.log(`-L${libPath}`);
  } else {
    process.exit(1);
  }
} else if (mode === 'include') {
  // Priority: CI build > prebuilt package > pkg-config (fallback in binding.gyp)
  const ciPath = getCIBuildPath('include');
  if (ciPath) {
    console.log(ciPath);
    process.exit(0);
  }

  const includePath = getPrebuiltIncludePath();
  if (includePath) {
    console.log(includePath);
  } else {
    process.exit(1);
  }
} else if (mode === 'rpath') {
  // rpath is not needed for static linking - all symbols are linked into the binary
  // This mode is kept for backwards compatibility but outputs nothing
  process.exit(0);
}
