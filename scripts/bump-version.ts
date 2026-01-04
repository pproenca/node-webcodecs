#!/usr/bin/env tsx
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Bump version across all packages in sync.
// Usage: tsx scripts/bump-version.ts <version>
// Example: tsx scripts/bump-version.ts 0.1.2

import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainModule} from './shared/runtime';

interface PackageJson {
  readonly [key: string]: unknown;
  version?: string;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

function resolveRootDir(): string {
  if (process.env.ROOT_DIR) {
    return resolve(process.env.ROOT_DIR);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function isValidVersion(version: string): boolean {
  return VERSION_PATTERN.test(version);
}

function readJson(filePath: string): PackageJson {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Expected JSON object in ${filePath}`);
  }
  return raw as PackageJson;
}

function writeJson(filePath: string, payload: PackageJson): void {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function bumpVersion(rootDir: string, version: string): void {
  if (!isValidVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const packagePath = join(rootDir, 'package.json');
  const pkg = readJson(packagePath);
  pkg.version = version;
  writeJson(packagePath, pkg);
  console.log(`\u2713 ${packagePath.replace(`${rootDir}/`, '')}`);
}

export function main(args: string[]): number {
  const version = args[0];
  if (!version) {
    console.error('Usage: tsx scripts/bump-version.ts <version>');
    console.error('Example: tsx scripts/bump-version.ts 0.1.2');
    return 1;
  }

  const rootDir = resolveRootDir();
  try {
    console.log(`\nBumping version to ${version}\n`);
    bumpVersion(rootDir, version);
    console.log(`\nVersion bumped to ${version}`);
    console.log('\nNext steps:');
    console.log('  git add -A');
    console.log(`  git commit -m "chore: bump version to ${version}"`);
    console.log(`  git tag v${version}`);
    console.log('  git push origin master --tags');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
