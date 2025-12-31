// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection following sharp's lib/platform.js pattern.

import * as os from 'node:os';

// Try to detect musl vs glibc on Linux
function detectLibc(): 'glibc' | 'musl' | null {
  if (os.platform() !== 'linux') return null;

  try {
    const { familySync } = require('detect-libc');
    return familySync() === 'musl' ? 'musl' : 'glibc';
  } catch {
    // detect-libc not available, assume glibc
    return 'glibc';
  }
}

/**
 * Get the runtime platform-architecture string.
 * Handles musl vs glibc distinction on Linux.
 */
export function runtimePlatformArch(): string {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'linux') {
    const libc = detectLibc();
    if (libc === 'musl') {
      return `linuxmusl-${arch}`;
    }
  }

  return `${platform}-${arch}`;
}

/**
 * Get the build-time platform-architecture string.
 * Used by npm/from-local-build.js for packaging.
 *
 * In cross-compilation scenarios, this could differ from runtimePlatformArch().
 * Currently returns the same value (no cross-compile support yet).
 */
export function buildPlatformArch(): string {
  // For now, build platform equals runtime platform
  // Cross-compilation would check environment variables like npm_config_arch
  return runtimePlatformArch();
}

/**
 * Platforms with prebuilt binaries available.
 * Must match what release.yml actually builds.
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linuxmusl-x64',
] as const;

export type PrebuiltPlatform = (typeof prebuiltPlatforms)[number];

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export function isPrebuiltAvailable(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}

/**
 * Get the npm package name for the prebuilt binary.
 */
export function getPrebuiltPackageName(): string {
  return `@pproenca/node-webcodecs-${runtimePlatformArch()}`;
}

/**
 * Get the npm package name for prebuilt FFmpeg.
 */
export function getFFmpegPackageName(): string {
  return `@pproenca/ffmpeg-${runtimePlatformArch()}`;
}
