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
// 2. Fall back to pkg-config (handled by binding.gyp fallback)

'use strict';

const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

// Check for CI-built FFmpeg (from jellyfin-ffmpeg workflow)
function getCIBuildPath(type) {
  const projectRoot = resolve(__dirname, '..');
  const ffmpegInstall = join(projectRoot, 'ffmpeg-install');

  const targetPath = join(ffmpegInstall, type === 'lib' ? 'lib' : 'include');
  return existsSync(targetPath) ? targetPath : null;
}

// Output for node-gyp variable expansion
const mode = process.argv[2] || 'lib';

if (mode === 'lib') {
  const ciPath = getCIBuildPath('lib');
  if (ciPath) {
    console.log(`-L${ciPath}`);
    process.exit(0);
  }
  // No CI path - let binding.gyp fallback to pkg-config
  process.exit(1);
} else if (mode === 'include') {
  const ciPath = getCIBuildPath('include');
  if (ciPath) {
    console.log(ciPath);
    process.exit(0);
  }
  // No CI path - let binding.gyp fallback to pkg-config
  process.exit(1);
} else if (mode === 'rpath') {
  // rpath is not needed for static linking - all symbols are linked into the binary
  // This mode is kept for backwards compatibility but outputs nothing
  process.exit(0);
}
