#!/usr/bin/env node
/**
 * Sync platform package.json files with the main package version.
 *
 * Usage: node scripts/create-platform-packages.mjs
 *
 * This script reads the version from packages/node-webcodecs/package.json and
 * updates each platform package to match. Use before publishing to ensure
 * version synchronization and optionalDependencies alignment.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');

const mainPkgPath = join(packagesDir, 'node-webcodecs', 'package.json');
const mainPkg = JSON.parse(readFileSync(mainPkgPath, 'utf8'));
const { version } = mainPkg;

console.log(`Syncing platform packages with version: ${version}`);

const PLATFORMS = [
  { name: 'darwin-arm64' },
  { name: 'darwin-x64' },
  { name: 'linux-x64' },
  { name: 'linux-x64-musl' },
];

for (const { name } of PLATFORMS) {
  const pkgPath = join(packagesDir, name, 'package.json');
  if (!existsSync(pkgPath)) {
    console.warn(`  Skipping missing package: ${pkgPath}`);
    continue;
  }

  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkgJson.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
  console.log(`  Updated ${pkgPath}`);
}

// Also update optionalDependencies in the main package.json
const optionalDeps = {};
for (const { name } of PLATFORMS) {
  optionalDeps[`@pproenca/node-webcodecs-${name}`] = version;
}

mainPkg.optionalDependencies = optionalDeps;
writeFileSync(mainPkgPath, `${JSON.stringify(mainPkg, null, 2)}\n`);
console.log(`  Updated ${mainPkgPath} optionalDependencies`);

console.log('\nDone! Platform packages ready for publishing.');
