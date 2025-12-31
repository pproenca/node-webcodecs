// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection following sharp's lib/platform.js pattern.

import * as os from 'os';

// Try to detect musl vs glibc on Linux
function detectLibc(): 'glibc' | 'musl' | null {
  if (os.platform() !== 'linux') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {familySync} = require('detect-libc');
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
 * Platforms with prebuilt binaries available.
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'linuxmusl-x64',
  'linuxmusl-arm64',
  'win32-x64',
  'win32-arm64',
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
  return `@ffmpeg/node-webcodecs-${runtimePlatformArch()}`;
}
