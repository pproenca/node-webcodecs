// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection following sharp's lib/platform.js pattern.

import * as os from 'node:os';

/**
 * Get the runtime platform-architecture string.
 */
export function runtimePlatformArch(): string {
  return `${os.platform()}-${os.arch()}`;
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
] as const;

export type PrebuiltPlatform = (typeof prebuiltPlatforms)[number];

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export function isPrebuiltAvailable(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}
