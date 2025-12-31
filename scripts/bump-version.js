#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Bump version across all packages in sync.
// Usage: node scripts/bump-version.js <version>
// Example: node scripts/bump-version.js 0.1.2

'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/bump-version.js <version>');
  console.error('Example: node scripts/bump-version.js 0.1.2');
  process.exit(1);
}

// Validate semver format (basic check)
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected: X.Y.Z or X.Y.Z-prerelease');
  process.exit(1);
}

const platforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linuxmusl-x64',
];

function updateJson(filePath, updater) {
  const content = JSON.parse(readFileSync(filePath, 'utf8'));
  updater(content);
  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`✓ ${filePath.replace(`${ROOT}/`, '')}`);
}

console.log(`\nBumping version to ${version}\n`);

// 1. Update main package.json
updateJson(join(ROOT, 'package.json'), (pkg) => {
  pkg.version = version;
  // Update optionalDependencies to match
  for (const platform of platforms) {
    const depName = `@pproenca/node-webcodecs-${platform}`;
    if (pkg.optionalDependencies?.[depName]) {
      pkg.optionalDependencies[depName] = version;
    }
  }
});

// 2. Update each platform package
for (const platform of platforms) {
  updateJson(join(ROOT, 'npm', platform, 'package.json'), (pkg) => {
    pkg.version = version;
  });
}

console.log(`\nVersion bumped to ${version} in ${1 + platforms.length} files`);
console.log('\nNext steps:');
console.log('  git add -A');
console.log(`  git commit -m "chore: bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log('  git push origin master --tags');
