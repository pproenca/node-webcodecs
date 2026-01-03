// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Native binding loader using esbuild-style platform resolution.
// Tries platform-specific package first, falls back to node-gyp-build for local dev.

import { resolve, dirname, join } from 'node:path';
import { familySync } from 'detect-libc';

const PLATFORMS: Record<string, string> = {
  'darwin-arm64': '@pproenca/node-webcodecs-darwin-arm64',
  'darwin-x64': '@pproenca/node-webcodecs-darwin-x64',
  'linux-x64': '@pproenca/node-webcodecs-linux-x64',
  'linux-x64-musl': '@pproenca/node-webcodecs-linux-x64-musl',
};

/**
 * Detect the platform identifier including libc variant for Linux.
 * Returns platform string like 'linux-x64' or 'linux-x64-musl'.
 */
function detectPlatform(): string {
  const base = `${process.platform}-${process.arch}`;
  if (process.platform === 'linux') {
    const libc = familySync();
    if (libc === 'musl') {
      return `${base}-musl`;
    }
    if (libc === null) {
      // Could not detect libc - this is unusual and likely indicates a problem
      // Use console.error to ensure visibility even when warnings are suppressed
      const warningMessage =
        '[node-webcodecs] WARNING: Could not detect libc type (detect-libc returned null). ' +
        'Falling back to glibc binary. If you are on Alpine Linux or another musl-based ' +
        'system, loading will likely fail. Ensure the musl platform package is installed: ' +
        'npm install @pproenca/node-webcodecs-linux-x64-musl';
      console.error(warningMessage);
    }
    // libc === 'glibc' or null (fallback to glibc)
  }
  return base;
}

/**
 * Load the native binding.
 *
 * Resolution order:
 * 1. Platform-specific npm package (production path via optionalDependencies)
 * 2. node-gyp-build (local development fallback)
 */
function loadBinding(): unknown {
  const platform = detectPlatform();
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
    const binPath = join(dirname(pkgPath), 'webcodecs.node');
    return require(binPath);
  } catch (err: unknown) {
    // Check if package is installed but loading failed (vs. not installed at all)
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = (err as NodeJS.ErrnoException)?.code;

    if (errorCode === 'MODULE_NOT_FOUND' && errorMessage.includes(pkg)) {
      // Package not installed - this is expected in dev, fall through to node-gyp-build
    } else {
      // Package is installed but failed to load - this is a real error
      throw new Error(
        `Platform package ${pkg} is installed but failed to load:\n` +
          `${errorMessage}\n\n` +
          `This usually indicates:\n` +
          `  - Node.js version mismatch (try: npm rebuild)\n` +
          `  - Corrupted installation (try: rm -rf node_modules && npm install)\n` +
          `  - Missing system library (check native dependencies)`
      );
    }
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

// Export detectPlatform for testing
export { detectPlatform };

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
  // Include the detected platform with libc variant for verification
  detectedPlatform: detectPlatform(),
};
