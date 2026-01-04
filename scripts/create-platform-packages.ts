#!/usr/bin/env tsx
/**
 * Generate platform package.json files with synchronized version.
 *
 * Usage: tsx scripts/create-platform-packages.ts
 *
 * This script reads the version from the main package.json and generates
 * package.json files for each platform package with the same version.
 * Use before publishing to ensure version synchronization.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainModule} from './shared/runtime';

interface PackageJson {
  readonly [key: string]: unknown;
  optionalDependencies?: Record<string, string>;
  version?: string;
}

interface PlatformConfig {
  readonly name: string;
  readonly os: string;
  readonly cpu: string;
  readonly libc?: string;
}

const PLATFORMS: PlatformConfig[] = [
  {name: 'darwin-arm64', os: 'darwin', cpu: 'arm64'},
  {name: 'darwin-x64', os: 'darwin', cpu: 'x64'},
  {name: 'linux-x64', os: 'linux', cpu: 'x64', libc: 'musl'},
];

function resolveRootDir(): string {
  if (process.env.ROOT_DIR) {
    return resolve(process.env.ROOT_DIR);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

export function createPlatformPackages(rootDir: string): void {
  const packagesDir = join(rootDir, 'packages');
  const mainPkgPath = join(rootDir, 'package.json');
  const mainPkg = readJson(mainPkgPath);

  if (!mainPkg.version) {
    throw new Error('Main package.json missing version');
  }

  const version = mainPkg.version;
  console.log(`Creating platform packages with version: ${version}`);

  for (const {name, os, cpu, libc} of PLATFORMS) {
    const pkgDir = join(packagesDir, `@pproenca/node-webcodecs-${name}`);
    const binDir = join(pkgDir, 'bin');

    mkdirSync(binDir, {recursive: true});

    const gitkeepPath = join(binDir, '.gitkeep');
    if (!existsSync(gitkeepPath)) {
      writeFileSync(gitkeepPath, '');
    }

    const pkgJson: PackageJson = {
      name: `@pproenca/node-webcodecs-${name}`,
      version,
      description: `node-webcodecs native addon for ${name}`,
      os: [os],
      cpu: [cpu],
      ...(libc ? {libc: [libc]} : {}),
      files: ['bin/'],
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/pproenca/node-webcodecs',
      },
    };

    const pkgPath = join(pkgDir, 'package.json');
    writeJson(pkgPath, pkgJson);
    console.log(`  Created ${pkgPath}`);
  }

  const optionalDeps: Record<string, string> = {};
  for (const {name} of PLATFORMS) {
    optionalDeps[`@pproenca/node-webcodecs-${name}`] = version;
  }

  mainPkg.optionalDependencies = optionalDeps;
  writeJson(mainPkgPath, mainPkg);
  console.log(`  Updated ${mainPkgPath} optionalDependencies`);
  console.log('\nDone! Platform packages ready for publishing.');
}

if (isMainModule(import.meta.url)) {
  try {
    createPlatformPackages(resolveRootDir());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
