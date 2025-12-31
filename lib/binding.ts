// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader following node-av pattern.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runtimePlatformArch } from './platform';

const rootDir = resolve(__dirname, '..');

/**
 * Load the native binding with fallback logic.
 */
function loadBinding(): unknown {
  const errors: Error[] = [];
  const platform = process.platform;
  const arch = process.arch;
  const platformArch = runtimePlatformArch();
  const loadLocal = process.env.WEBCODECS_FROM_SOURCE === '1';

  // Priority 1: Local build directory (development or --build-from-source)
  try {
    const releasePath = resolve(rootDir, 'build', 'Release', 'node_webcodecs.node');
    const debugPath = resolve(rootDir, 'build', 'Debug', 'node_webcodecs.node');
    const binaryPath = resolve(rootDir, 'binary', 'node_webcodecs.node');

    for (const path of [releasePath, debugPath, binaryPath]) {
      if (existsSync(path)) {
        return require(path);
      }
    }
  } catch (err) {
    errors.push(new Error(`Local build loading failed: ${err}`));
  }

  // Priority 2: Platform-specific package (if not forcing local build)
  if (!loadLocal) {
    try {
      const packageName = `@pproenca/node-webcodecs-${platformArch}`;
      return require(`${packageName}/node-webcodecs.node`);
    } catch (err) {
      errors.push(new Error(`Platform package not found or loading failed: ${err}`));
    }
  }

  // All attempts failed
  const errorMessages = errors.map((e) => e.message).join('\n  ');
  throw new Error(
    `Could not load the node-webcodecs native binding for ${platform}-${arch}.\n` +
      `Errors:\n  ${errorMessages}\n\n` +
      `Solutions:\n` +
      `  1. Install with optional dependencies: npm install --include=optional\n` +
      `  2. Build from source: npm run build:native\n`
  );
}

export const binding = loadBinding();

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  runtimePlatform: runtimePlatformArch(),
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
};
