// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader using node-gyp-build.

import { resolve } from 'node:path';

// node-gyp-build searches prebuilds/{platform}-{arch}/ for node.napi.node
// Falls back to build/Release/node_webcodecs.node if no prebuild found
const nodeGypBuild = require('node-gyp-build');

const rootDir = resolve(__dirname, '..');

/**
 * Load the native binding via node-gyp-build.
 */
function loadBinding(): unknown {
  try {
    return nodeGypBuild(rootDir);
  } catch (err) {
    const platform = process.platform;
    const arch = process.arch;
    throw new Error(
      `Could not load the node-webcodecs native binding for ${platform}-${arch}.\n` +
        `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
        `Solutions:\n` +
        `  1. Supported platforms: darwin-arm64, darwin-x64, linux-x64\n` +
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
