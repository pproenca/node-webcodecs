#!/usr/bin/env node
/**
 * Generate platform package.json files with synchronized version.
 *
 * Usage: node scripts/create-platform-packages.mjs
 *
 * This script reads the version from the main package.json and generates
 * package.json files for each platform package with the same version.
 * Use before publishing to ensure version synchronization.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');

// Read version from main package.json
const mainPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const { version } = mainPkg;

console.log(`Creating platform packages with version: ${version}`);

const PLATFORMS = [
  { name: 'darwin-arm64', os: 'darwin', cpu: 'arm64' },
  { name: 'darwin-x64', os: 'darwin', cpu: 'x64' },
  { name: 'linux-x64', os: 'linux', cpu: 'x64', libc: 'musl' },
];

for (const { name, os, cpu, libc } of PLATFORMS) {
  const pkgDir = join(packagesDir, `@pproenca/node-webcodecs-${name}`);
  const binDir = join(pkgDir, 'bin');

  // Ensure directories exist
  mkdirSync(binDir, { recursive: true });

  // Create .gitkeep in bin dir if empty
  const gitkeepPath = join(binDir, '.gitkeep');
  if (!existsSync(gitkeepPath)) {
    writeFileSync(gitkeepPath, '');
  }

  const pkgJson = {
    name: `@pproenca/node-webcodecs-${name}`,
    version,
    description: `node-webcodecs native addon for ${name}`,
    os: [os],
    cpu: [cpu],
    ...(libc && { libc: [libc] }),
    files: ['bin/'],
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/pproenca/node-webcodecs',
    },
  };

  const pkgPath = join(pkgDir, 'package.json');
  writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
  console.log(`  Created ${pkgPath}`);
}

// Also update optionalDependencies in main package.json
const optionalDeps = {};
for (const { name } of PLATFORMS) {
  optionalDeps[`@pproenca/node-webcodecs-${name}`] = version;
}

mainPkg.optionalDependencies = optionalDeps;
const mainPkgPath = join(rootDir, 'package.json');
writeFileSync(mainPkgPath, `${JSON.stringify(mainPkg, null, 2)}\n`);
console.log(`  Updated ${mainPkgPath} optionalDependencies`);

console.log('\nDone! Platform packages ready for publishing.');
