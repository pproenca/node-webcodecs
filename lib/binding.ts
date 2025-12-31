// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader with fallback chain and enhanced error messages.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPrebuiltPackageName, isPrebuiltAvailable, runtimePlatformArch } from './platform';

const rootDir = path.resolve(__dirname, '..');

type LoadCandidate = string | (() => unknown);

const candidates: LoadCandidate[] = [
  // Development build (node-gyp output)
  path.join(rootDir, 'build', 'Release', 'node_webcodecs.node'),
  path.join(rootDir, 'build', 'Debug', 'node_webcodecs.node'),

  // node-gyp-build compatible
  () => {
    try {
      return require('node-gyp-build')(rootDir);
    } catch {
      throw new Error('node-gyp-build not available');
    }
  },

  // Prebuilt from platform package (sharp pattern: @scope/pkg-platform/binding.node)
  () => {
    const pkg = getPrebuiltPackageName();
    const bindingPath = `${pkg}/node-webcodecs.node`;
    return require(bindingPath);
  },
];

function getPlatformBuildInstructions(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return `  brew install ffmpeg pkg-config
  npm run build:native`;
  }
  if (platform === 'linux') {
    return `  sudo apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev pkg-config
  npm run build:native`;
  }
  return `  Install FFmpeg development libraries
  npm run build:native`;
}

function buildHelpMessage(errors: Array<{ path: string; error: Error }>): string {
  const platform = runtimePlatformArch();
  const hasPrebuilt = isPrebuiltAvailable();

  let msg = `Could not load native binding for ${platform}.\n\n`;
  msg += `Node.js: ${process.version}\n\n`;

  msg += 'Attempted paths:\n';
  for (const { path: p, error } of errors) {
    msg += `  - ${p}: ${error.message}\n`;
  }

  msg += '\nPossible solutions:\n';

  if (hasPrebuilt) {
    msg += '  1. Install with optional dependencies:\n';
    msg += '     npm install --include=optional\n\n';
    msg += '  2. Build from source:\n';
  } else {
    msg += '  1. Build from source:\n';
  }

  msg += getPlatformBuildInstructions();

  return msg;
}

function loadBinding(): unknown {
  const errors: Array<{ path: string; error: Error }> = [];

  for (const candidate of candidates) {
    try {
      if (typeof candidate === 'function') {
        const binding = candidate();
        if (binding && typeof (binding as Record<string, unknown>).VideoEncoder === 'function') {
          return binding;
        }
        throw new Error('Invalid binding: missing VideoEncoder');
      }

      if (!fs.existsSync(candidate)) {
        continue;
      }

      const binding = require(candidate);
      if (typeof binding.VideoEncoder !== 'function') {
        throw new Error('Invalid binding: missing VideoEncoder');
      }
      return binding;
    } catch (err) {
      errors.push({
        path: typeof candidate === 'string' ? candidate : 'dynamic loader',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  throw new Error(buildHelpMessage(errors));
}

export const binding = loadBinding();

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  runtimePlatform: runtimePlatformArch(),
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
  prebuiltAvailable: isPrebuiltAvailable(),
};
