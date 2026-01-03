#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Bump version across all packages in sync.
// Usage: node scripts/bump-version.js <version>
// Example: node scripts/bump-version.js 0.1.2

'use strict';

const { readFileSync, writeFileSync, readdirSync, existsSync } = require('node:fs');
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

function updateJson(filePath, updater) {
  const content = JSON.parse(readFileSync(filePath, 'utf8'));
  updater(content);
  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`✓ ${filePath.replace(`${ROOT}/`, '')}`);
}

console.log(`\nBumping version to ${version}\n`);

const packagesDir = join(ROOT, 'packages');
const mainPkgPath = join(packagesDir, 'node-webcodecs', 'package.json');

updateJson(mainPkgPath, (pkg) => {
  pkg.version = version;
  if (pkg.optionalDependencies) {
    for (const name of Object.keys(pkg.optionalDependencies)) {
      pkg.optionalDependencies[name] = version;
    }
  }
});

const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== 'node-webcodecs' && name !== 'node_modules')
  .filter((name) => existsSync(join(packagesDir, name, 'package.json')));

for (const dir of packageDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  try {
    updateJson(pkgPath, (pkg) => {
      pkg.version = version;
    });
  } catch (error) {
    console.warn(`Skipping ${pkgPath}: ${(error && error.message) || error}`);
  }
}

console.log(`\nVersion bumped to ${version}`);
console.log('\nNext steps:');
console.log('  git add -A');
console.log(`  git commit -m "chore: bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log('  git push origin main --tags');
