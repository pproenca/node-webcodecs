// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection following sharp's lib/libvips.js pattern.

import { familySync, isNonGlibcLinuxSync } from 'detect-libc';

/**
 * Platforms with prebuilt binaries available.
 * Must match what CI actually builds and package names.
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-x64-musl',
];

/**
 * Get the runtime platform-architecture string including libc variant.
 * Uses format: platform-arch[-libc] to match package naming convention.
 * Examples: 'darwin-arm64', 'linux-x64', 'linux-x64-musl'
 */
export const runtimePlatformArch = (): string => {
  const base = `${process.platform}-${process.arch}`;
  if (process.platform === 'linux' && isNonGlibcLinuxSync()) {
    const libc = familySync();
    if (libc === 'musl') {
      return `${base}-musl`;
    }
  }
  return base;
};

/**
 * Get the build-time platform-architecture string.
 * Used for cross-compilation scenarios.
 */
export const buildPlatformArch = (): string => {
  const { npm_config_arch, npm_config_platform, npm_config_libc } = process.env;
  const platform = npm_config_platform || process.platform;
  const arch = npm_config_arch || process.arch;
  const base = `${platform}-${arch}`;

  if (platform === 'linux') {
    const libc = npm_config_libc || (isNonGlibcLinuxSync() ? familySync() : null);
    if (libc === 'musl') {
      return `${base}-musl`;
    }
  }
  return base;
};

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export const isPrebuiltAvailable = (): boolean =>
  prebuiltPlatforms.includes(runtimePlatformArch());
