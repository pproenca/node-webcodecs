// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader with fallback chain.
// Follows patterns from sharp, better-sqlite3, and other production addons.

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {runtimePlatformArch} from './platform';

// Platform detection
const platform = os.platform();
const arch = os.arch();
const runtimePlatform = runtimePlatformArch();

/**
 * Paths to search for the native addon, in priority order.
 * This allows for:
 * 1. Local development builds
 * 2. Prebuilt platform-specific binaries
 * 3. Fallback locations
 */
function getBindingPaths(): string[] {
  const rootDir = path.resolve(__dirname, '..');

  return [
    // Development build (node-gyp output)
    path.join(rootDir, 'build', 'Release', 'node_webcodecs.node'),
    path.join(rootDir, 'build', 'Debug', 'node_webcodecs.node'),

    // Prebuilt from npm package (e.g., @aspect/node-webcodecs-darwin-arm64)
    // This path is resolved by Node's module resolution
    `@aspect/node-webcodecs-${runtimePlatform}/lib/node-webcodecs-${runtimePlatform}.node`,

    // Local prebuilds directory
    path.join(rootDir, 'prebuilds', runtimePlatform, 'node_webcodecs.node'),

    // node-gyp-build compatible location
    path.join(rootDir, 'prebuilds', runtimePlatform, 'node.napi.node'),

    // Fallback: adjacent to dist/
    path.join(rootDir, 'node_webcodecs.node'),
  ];
}

/**
 * Checks if FFmpeg libraries are available on the system.
 */
function checkFFmpegAvailability(): {available: boolean; message?: string} {
  // On macOS, check for Homebrew FFmpeg
  if (platform === 'darwin') {
    const brewPaths = [
      '/opt/homebrew/lib/libavcodec.dylib',
      '/usr/local/lib/libavcodec.dylib',
    ];
    const found = brewPaths.some(p => fs.existsSync(p));
    if (!found) {
      return {
        available: false,
        message: 'FFmpeg not found. Install with: brew install ffmpeg',
      };
    }
  }

  // On Linux, check standard paths
  if (platform === 'linux') {
    const linuxPaths = [
      '/usr/lib/x86_64-linux-gnu/libavcodec.so',
      '/usr/lib/aarch64-linux-gnu/libavcodec.so',
      '/usr/lib/libavcodec.so',
    ];
    const found = linuxPaths.some(p => {
      try {
        // Check if any matching file exists
        const dir = path.dirname(p);
        const base = path.basename(p);
        return (
          fs.existsSync(dir) &&
          fs.readdirSync(dir).some(f => f.startsWith(base.split('.')[0]))
        );
      } catch {
        return false;
      }
    });
    if (!found) {
      return {
        available: false,
        message:
          'FFmpeg not found. Install with: sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev',
      };
    }
  }

  return {available: true};
}

/**
 * Loads the native binding with helpful error messages.
 */
function loadBinding(): unknown {
  const paths = getBindingPaths();
  const errors: Array<{path: string; error: Error}> = [];

  for (const bindingPath of paths) {
    try {
      let resolvedPath: string;

      // Handle npm package paths (start with @) vs filesystem paths
      if (bindingPath.startsWith('@')) {
        // Try to resolve the npm package path
        try {
          resolvedPath = require.resolve(bindingPath);
        } catch {
          // Package not installed, skip
          continue;
        }
      } else {
        // Filesystem path - check if file exists
        if (!fs.existsSync(bindingPath)) {
          continue;
        }
        resolvedPath = bindingPath;
      }

      // Attempt to load the binding
      const binding = require(resolvedPath);

      // Validate that binding has expected exports
      if (typeof binding.VideoEncoder !== 'function') {
        throw new Error('Invalid binding: missing VideoEncoder');
      }

      return binding;
    } catch (err) {
      errors.push({
        path: bindingPath,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  // All paths failed - generate helpful error message
  const ffmpegCheck = checkFFmpegAvailability();

  let message = 'Failed to load native binding for node-webcodecs.\n\n';
  message += `Platform: ${runtimePlatform}\n`;
  message += `Node.js: ${process.version}\n\n`;

  if (!ffmpegCheck.available) {
    message += 'FFmpeg libraries not found:\n';
    message += `  ${ffmpegCheck.message}\n\n`;
  }

  message += 'Searched paths:\n';
  for (const p of paths) {
    const exists = fs.existsSync(p);
    message += `  ${exists ? '✓' : '✗'} ${p}\n`;
  }

  if (errors.length > 0) {
    message += '\nErrors encountered:\n';
    for (const {path: p, error} of errors) {
      message += `  ${p}:\n    ${error.message}\n`;
    }
  }

  message += '\nTo build from source:\n';
  if (platform === 'darwin') {
    message += '  1. Install FFmpeg: brew install ffmpeg pkg-config\n';
  } else if (platform === 'linux') {
    message +=
      '  1. Install FFmpeg: sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev pkg-config\n';
  } else {
    message += '  1. Install FFmpeg development libraries\n';
  }
  message += '  2. Run: npm run build\n';

  throw new Error(message);
}

/**
 * The loaded native binding.
 * Exported for use by other modules.
 */
export const binding = loadBinding();

/**
 * Platform information for debugging.
 */
export const platformInfo = {
  platform,
  arch,
  runtimePlatform,
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
};
