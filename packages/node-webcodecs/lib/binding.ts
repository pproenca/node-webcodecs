// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Native binding loader following sharp's lib/sharp.js pattern.
// Inspects the runtime environment and exports the relevant webcodecs.node binary.

import { resolve } from 'node:path';
import { familySync, versionSync } from 'detect-libc';
import { prebuiltPlatforms, runtimePlatformArch } from './platform';

const runtimePlatform = runtimePlatformArch();

// Load paths in order of preference:
// 1. Local node-gyp build (development)
// 2. Platform-specific npm package (production)
const paths = [
  () => {
    // Try node-gyp-build for local development
    const nodeGypBuild = require('node-gyp-build');
    return nodeGypBuild(resolve(__dirname, '..'));
  },
  () => require(`@pproenca/node-webcodecs-${runtimePlatform}/webcodecs.node`),
];

let binding: unknown;
const errors: Error[] = [];

for (const loadFn of paths) {
  try {
    binding = loadFn();
    break;
  } catch (err) {
    errors.push(err as Error);
  }
}

if (binding) {
  module.exports = binding;
} else {
  const isLinux = runtimePlatform.startsWith('linux');
  const isMacOs = runtimePlatform.startsWith('darwin');

  const help = [
    `Could not load the "node-webcodecs" module using the ${runtimePlatform} runtime`,
  ];

  errors.forEach((err) => {
    if ((err as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
      help.push(`${(err as NodeJS.ErrnoException).code}: ${err.message}`);
    }
  });

  const messages = errors.map((err) => err.message).join(' ');
  help.push('Possible solutions:');

  if (prebuiltPlatforms.includes(runtimePlatform)) {
    help.push(
      '- Ensure optional dependencies can be installed:',
      '    npm install --include=optional @pproenca/node-webcodecs',
      '- Ensure your package manager supports multi-platform installation:',
      '    See https://sharp.pixelplumbing.com/install#cross-platform',
      '- Add platform-specific dependencies:',
      `    npm install @pproenca/node-webcodecs-${runtimePlatform}`
    );
  } else {
    help.push(
      `- Platform ${runtimePlatform} does not have prebuilt binaries`,
      '- Build from source with FFmpeg development libraries:',
      '    npm rebuild --build-from-source'
    );
  }

  if (isLinux && /(symbol not found|CXXABI_)/i.test(messages)) {
    try {
      const libcFound = `${familySync()} ${versionSync()}`;
      help.push('- Update your OS:', `    Found ${libcFound}`);
    } catch {
      // Ignore libc detection errors
    }
  }

  if (isLinux && /\/snap\/core[0-9]{2}/.test(messages)) {
    help.push(
      '- Remove the Node.js Snap, which does not support native modules',
      '    snap remove node'
    );
  }

  if (isMacOs && /Incompatible library version/.test(messages)) {
    help.push('- Rebuild native modules:', '    npm rebuild');
  }

  if (errors.some((err) => (err as NodeJS.ErrnoException).code === 'ERR_DLOPEN_DISABLED')) {
    help.push('- Run Node.js without using the --no-addons flag');
  }

  help.push(
    '- Consult the installation documentation:',
    '    See https://github.com/pproenca/node-webcodecs#readme'
  );

  throw new Error(help.join('\n'));
}

// Re-export for TypeScript consumers
export { binding };

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
  detectedPlatform: runtimePlatform,
};
