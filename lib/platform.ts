// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection utilities for prebuilt binary loading.
// Follows patterns from sharp/lib/libvips.js

import * as os from 'os';

/**
 * Supported prebuilt platforms.
 * Format: {os}{libc}-{arch}
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linuxmusl-x64',
  'linuxmusl-arm64',
  'win32-x64',
] as const;

export type PrebuiltPlatform = (typeof prebuiltPlatforms)[number];

/**
 * Detect if running on musl libc (Alpine Linux, etc).
 * Uses detect-libc if available, falls back to ldd check.
 */
function detectMusl(): boolean {
  if (os.platform() !== 'linux') {
    return false;
  }

  try {
    // Try detect-libc if installed
    const detectLibc = require('detect-libc');
    return detectLibc.isNonGlibcLinuxSync?.() ?? false;
  } catch {
    // Fallback: check for musl in process report
    try {
      const report = process.report?.getReport() as {
        sharedObjects?: string[];
      } | null;
      return (
        report?.sharedObjects?.some((s: string) => s.includes('musl')) ?? false
      );
    } catch {
      return false;
    }
  }
}

/**
 * Get the runtime platform-architecture string.
 * Examples: darwin-arm64, linux-x64, linuxmusl-x64
 */
export function runtimePlatformArch(): string {
  const platform = os.platform();
  const arch = os.arch();
  const libc = platform === 'linux' && detectMusl() ? 'musl' : '';
  return `${platform}${libc}-${arch}`;
}

/**
 * Get the build platform-architecture string.
 * Respects npm_config_* environment variables for cross-compilation.
 */
export function buildPlatformArch(): string {
  const {npm_config_arch, npm_config_platform, npm_config_libc} = process.env;

  const platform = npm_config_platform || os.platform();
  const arch = npm_config_arch || os.arch();
  const libc =
    npm_config_libc || (platform === 'linux' && detectMusl() ? 'musl' : '');

  return `${platform}${libc}-${arch}`;
}

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export function hasPrebuilt(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}
