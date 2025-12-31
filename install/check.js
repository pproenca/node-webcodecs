#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Install-time check for FFmpeg availability.

'use strict';

const {execSync, spawnSync} = require('node:child_process');
const {platform} = require('node:os');

const MIN_FFMPEG_VERSION = '5.0';

/**
 * Check if prebuilt FFmpeg package is available for this platform.
 */
function hasPrebuiltFFmpeg() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    require.resolve(`${packageName}/lib`);
    console.log(`✓ Found prebuilt FFmpeg: ${packageName}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get runtime platform string (matches npm package naming).
 */
function getRuntimePlatform() {
  const os = platform();
  const arch = process.arch;

  if (os === 'linux') {
    // Check for musl
    try {
      const { familySync } = require('detect-libc');
      if (familySync() === 'musl') {
        return `linuxmusl-${arch}`;
      }
    } catch {}
  }

  return `${os}-${arch}`;
}

function checkPkgConfig() {
  const libs = [
    'libavcodec',
    'libavutil',
    'libswscale',
    'libswresample',
    'libavfilter',
  ];

  try {
    execSync(`pkg-config --exists ${libs.join(' ')}`, {stdio: 'pipe'});
    return true;
  } catch {
    return false;
  }
}

function getFFmpegVersion() {
  try {
    const version = execSync('pkg-config --modversion libavcodec', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return version;
  } catch {
    return null;
  }
}

function versionAtLeast(version, minimum) {
  const v1 = version.split('.').map(Number);
  const v2 = minimum.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

function getInstallInstructions() {
  const os = platform();

  const instructions = {
    darwin: `
  Install FFmpeg using Homebrew:
    brew install ffmpeg
`,
    linux: `
  Ubuntu/Debian:
    sudo apt-get update
    sudo apt-get install -y \\
      libavcodec-dev \\
      libavutil-dev \\
      libswscale-dev \\
      libswresample-dev \\
      libavfilter-dev \\
      libavformat-dev \\
      pkg-config

  Fedora:
    sudo dnf install ffmpeg-devel

  Arch Linux:
    sudo pacman -S ffmpeg
`,
    win32: `
  Windows requires manual FFmpeg installation:
    1. Download from https://github.com/BtbN/FFmpeg-Builds/releases
    2. Extract to C:\\ffmpeg
    3. Set FFMPEG_PATH=C:\\ffmpeg in environment variables
    4. Restart your terminal and run: npm run build
`,
  };

  return instructions[os] || instructions.linux;
}

function main() {
  console.log('node-webcodecs: Checking FFmpeg installation...\n');

  // Check for prebuilt FFmpeg first
  if (hasPrebuiltFFmpeg()) {
    console.log('\n✓ Using prebuilt FFmpeg. Ready to build.\n');
    return;
  }

  // Skip detailed checks on Windows
  if (platform() === 'win32') {
    if (!process.env.FFMPEG_PATH) {
      console.warn(
        '⚠️  Windows: Set FFMPEG_PATH environment variable to FFmpeg location.',
      );
      console.log(getInstallInstructions());
    } else {
      console.log('✓ FFMPEG_PATH is set');
    }
    return;
  }

  // Check pkg-config exists
  const pkgConfigResult = spawnSync('which', ['pkg-config'], {stdio: 'pipe'});
  if (pkgConfigResult.status !== 0) {
    console.error('✗ pkg-config not found');
    console.log('\n  Install pkg-config:');
    console.log('    macOS: brew install pkg-config');
    console.log('    Ubuntu: sudo apt-get install pkg-config');
    process.exit(1);
  }
  console.log('✓ pkg-config found');

  // Check FFmpeg libraries
  if (!checkPkgConfig()) {
    console.error('✗ FFmpeg development libraries not found');
    console.log(getInstallInstructions());
    process.exit(1);
  }
  console.log('✓ FFmpeg development libraries found');

  // Check FFmpeg version
  const version = getFFmpegVersion();
  if (version) {
    if (versionAtLeast(version, MIN_FFMPEG_VERSION)) {
      console.log(
        `✓ FFmpeg version ${version} (>= ${MIN_FFMPEG_VERSION} required)`,
      );
    } else {
      console.warn(
        `⚠️  FFmpeg version ${version} is older than recommended ${MIN_FFMPEG_VERSION}`,
      );
    }
  }

  console.log('\n✓ All checks passed. Ready to build.\n');
}

if (require.main === module) {
  main();
}

module.exports = { checkPkgConfig, getFFmpegVersion, hasPrebuiltFFmpeg, getRuntimePlatform };
