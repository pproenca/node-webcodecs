#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Populate npm package for current platform with local build.



const {copyFileSync, mkdirSync, writeFileSync, existsSync} = require('node:fs');
const {join, basename} = require('node:path');

// Import platform detection (after TypeScript build)
const {buildPlatformArch} = require('../dist/platform');

const platform = buildPlatformArch();
const destDir = join(__dirname, platform);
const libDir = join(destDir, 'lib');

if (!existsSync(destDir)) {
  console.error(`No package template for platform: ${platform}`);
  console.error(`Create npm/${platform}/package.json first`);
  process.exit(1);
}

console.log(`Populating npm package for platform: ${platform}`);

// Create lib directory
mkdirSync(libDir, {recursive: true});

// Copy native addon
const releaseDir = join(__dirname, '..', 'build', 'Release');
const addonName = 'node_webcodecs.node';
const addonSrc = join(releaseDir, addonName);
const addonDest = join(libDir, `node-webcodecs-${platform}.node`);

if (!existsSync(addonSrc)) {
  console.error(`Native addon not found: ${addonSrc}`);
  console.error('Run npm run build first');
  process.exit(1);
}

copyFileSync(addonSrc, addonDest);
console.log(`Copied ${addonName} -> ${basename(addonDest)}`);

// Copy LICENSE
const licenseSrc = join(__dirname, '..', 'LICENSE');
if (existsSync(licenseSrc)) {
  copyFileSync(licenseSrc, join(destDir, 'LICENSE'));
}

// Generate README
const pkg = require(`./${platform}/package.json`);
const readme = `# ${pkg.name}\n\n${pkg.description}\n\nThis package is automatically installed as an optional dependency of \`node-webcodecs\`.\n`;
writeFileSync(join(destDir, 'README.md'), readme);

console.log('Done!');
