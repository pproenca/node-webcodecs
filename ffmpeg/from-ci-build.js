#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Populate FFmpeg packages from CI build artifacts.

'use strict';

const { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const platform = process.argv[2];
if (!platform) {
  console.error('Usage: node from-ci-build.js <platform>');
  console.error('Example: node from-ci-build.js darwin-arm64');
  process.exit(1);
}

const destDir = join(__dirname, platform);
const libDir = join(destDir, 'lib');
const artifactDir = process.env.FFMPEG_ARTIFACT_DIR || join(__dirname, '..', `ffmpeg-${platform}`);

if (!existsSync(destDir)) {
  console.error(`No package template for platform: ${platform}`);
  process.exit(1);
}

if (!existsSync(artifactDir)) {
  console.error(`Artifact directory not found: ${artifactDir}`);
  console.error('Set FFMPEG_ARTIFACT_DIR or ensure ffmpeg-{platform} exists');
  process.exit(1);
}

console.log(`Populating FFmpeg package for platform: ${platform}`);

// Create lib directory
mkdirSync(libDir, { recursive: true });

// Copy libraries
const srcLibDir = join(artifactDir, 'lib');
if (existsSync(srcLibDir)) {
  cpSync(srcLibDir, libDir, { recursive: true });
  console.log('Copied FFmpeg libraries');
}

// Copy versions.json
const versionsFile = join(artifactDir, 'versions.json');
if (existsSync(versionsFile)) {
  copyFileSync(versionsFile, join(destDir, 'versions.json'));
  console.log('Copied versions.json');
}

// Generate LICENSE with FFmpeg attribution
const license = `FFmpeg Libraries - Prebuilt for ${platform}

FFmpeg is licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later.

This package contains prebuilt FFmpeg shared libraries compiled with the following configuration:
- --enable-shared --disable-static
- --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libopus

For FFmpeg source code and full license terms, see:
https://ffmpeg.org/
https://github.com/FFmpeg/FFmpeg

This build includes GPL components. The complete corresponding source code
is available at: https://github.com/pproenca/node-webcodecs
`;

writeFileSync(join(destDir, 'LICENSE'), license);

// Generate README
const pkg = require(`./${platform}/package.json`);
const readme = `# ${pkg.name}

${pkg.description}

This package is automatically installed as an optional dependency of \`@pproenca/node-webcodecs-${platform}\`.

## License

FFmpeg is licensed under LGPL 2.1 or later. Some components are GPL licensed.
See LICENSE file for details.
`;
writeFileSync(join(destDir, 'README.md'), readme);

console.log('Done!');
