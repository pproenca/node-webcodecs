// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader using esbuild-style platform resolution.
// Tries platform-specific package first, falls back to node-gyp-build for local dev.

import * as detectLibc from 'detect-libc';
import { resolve, dirname, join } from 'node:path';

const PLATFORMS: Record<string, string> = {
  'darwin-arm64': '@pproenca/node-webcodecs-darwin-arm64',
  'darwin-x64': '@pproenca/node-webcodecs-darwin-x64',
  'linux-x64-glibc': '@pproenca/node-webcodecs-linux-x64-glibc',
  'linux-x64-musl': '@pproenca/node-webcodecs-linux-x64-musl',
};

/**
 * Load the native binding.
 *
 * Resolution order:
 * 1. Platform-specific npm package (production path via optionalDependencies)
 * 2. node-gyp-build (local development fallback)
 */
function loadBinding(): unknown {
  let platform = `${process.platform}-${process.arch}`;

  // Detect libc on Linux
  if (process.platform === 'linux') {
    const libc = detectLibc.familySync(); // Returns 'glibc' or 'musl'
    if (libc) {
      platform = `${platform}-${libc}`;
    } else {
      // Fallback to glibc (most common)
      platform = `${platform}-glibc`;
      console.warn(
        `Warning: Could not detect libc, falling back to glibc. ` +
          `If you're on Alpine Linux, please install the musl package manually: ` +
          `npm install @pproenca/node-webcodecs-linux-x64-musl`
      );
    }
  }

  const pkg = PLATFORMS[platform];

  if (!pkg) {
    throw new Error(
      `Unsupported platform: ${platform}. ` +
        `Supported platforms: ${Object.keys(PLATFORMS).join(', ')}`
    );
  }

  // Try platform-specific package first (production path)
  try {
    const pkgPath = require.resolve(`${pkg}/package.json`);
    const binPath = join(dirname(pkgPath), 'bin', 'node.napi.node');
    return require(binPath);
  } catch {
    // Platform package not installed - fallback to local build
  }

  // Fallback to node-gyp-build for local development
  try {
    const nodeGypBuild = require('node-gyp-build');
    const rootDir = resolve(__dirname, '..');
    return nodeGypBuild(rootDir);
  } catch (err) {
    throw new Error(
      `Could not load the node-webcodecs native binding for ${platform}.\n` +
        `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
        `Solutions:\n` +
        `  1. Install the main package: npm install @pproenca/node-webcodecs\n` +
        `  2. Build from source: npm rebuild --build-from-source\n` +
        `  3. Ensure FFmpeg dev libs: pkg-config --exists libavcodec\n`
    );
  }
}

export const binding = loadBinding();

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
};
