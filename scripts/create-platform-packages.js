#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Generates platform-specific packages from template during CI.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');
const installScriptPath = join(__dirname, 'install.js');

// Platform configurations
const platforms = [
  { name: 'darwin-arm64', os: 'darwin', cpu: 'arm64' },
  { name: 'darwin-x64', os: 'darwin', cpu: 'x64' },
  { name: 'linux-x64', os: 'linux', cpu: 'x64', libc: 'glibc' },
  { name: 'linuxmusl-x64', os: 'linux', cpu: 'x64', libc: 'musl' },
];

// Read template
const template = JSON.parse(readFileSync(join(packagesDir, 'platform-template.json'), 'utf8'));

// Read main package.json for version
const mainPackage = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

// Read FFmpeg version from env (set by CI workflow)
const ffmpegVersion = process.env.FFMPEG_VERSION;
if (!ffmpegVersion) {
  console.error('Error: FFMPEG_VERSION environment variable is required');
  process.exit(1);
}

platforms.forEach((platform) => {
  const packageDir = join(packagesDir, platform.name);

  // Create directory
  mkdirSync(packageDir, { recursive: true });

  // Create package.json
  const packageJson = { ...template };
  packageJson.name = `@pproenca/node-webcodecs-${platform.name}`;
  packageJson.version = mainPackage.version;
  packageJson.description = `node-webcodecs (${platform.name} binary)`;
  packageJson.os = [platform.os];
  packageJson.cpu = [platform.cpu];

  // Add libc field for Linux
  if (platform.libc) {
    packageJson.libc = [platform.libc];
  }

  // Add FFmpeg as optional dependency
  packageJson.optionalDependencies = {
    [`@pproenca/ffmpeg-${platform.name}`]: ffmpegVersion,
  };

  writeFileSync(join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');

  // Create README
  const readme = `# @pproenca/node-webcodecs-${platform.name}

Platform-specific binary for [node-webcodecs](https://github.com/pproenca/node-webcodecs).

**This package is automatically installed as an optional dependency. You should not install it directly.**

## Platform

- OS: ${platform.os}
- Architecture: ${platform.cpu}${platform.libc ? `\n- libc: ${platform.libc}` : ''}

## License

MIT
`;

  writeFileSync(join(packageDir, 'README.md'), readme);

  // Copy install.js
  copyFileSync(installScriptPath, join(packageDir, 'install.js'));

  console.log(`Created package for ${platform.name}`);
});

console.log('\nAll platform packages created successfully!');
