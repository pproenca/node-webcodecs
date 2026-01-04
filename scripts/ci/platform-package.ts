#!/usr/bin/env tsx
/**
 * Platform package helper for CI workflows.
 *
 * Modes:
 *   pack    - Create a platform package and tarball from a prebuild.
 *   extract - Extract a platform package tarball and optionally copy into prebuilds/.
 */
import {copyFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {isMainModule} from '../shared/runtime';
import {parseArgs, requireFlag} from '../shared/args';

interface PackOptions {
  readonly platform: string;
  readonly os: string;
  readonly cpu: string;
  readonly version: string;
  readonly prebuildPath: string;
  readonly outDir: string;
  readonly scope: string;
  readonly libc?: string;
}

function ensureDir(pathname: string): void {
  mkdirSync(pathname, {recursive: true});
}

function writePlatformPackage(options: PackOptions): {pkgDir: string} {
  const platformSuffix = options.libc ? `${options.platform}-${options.libc}` : options.platform;
  const pkgDir = join(options.outDir, `@${options.scope}/node-webcodecs-${platformSuffix}`);
  const binDir = join(pkgDir, 'bin');
  ensureDir(binDir);

  if (!existsSync(options.prebuildPath)) {
    throw new Error(`Prebuild not found: ${options.prebuildPath}`);
  }

  copyFileSync(options.prebuildPath, join(binDir, 'node.napi.node'));

  const pkgJson: Record<string, unknown> = {
    name: `@${options.scope}/node-webcodecs-${platformSuffix}`,
    version: options.version,
    description: `node-webcodecs native addon for ${platformSuffix}`,
    os: [options.os],
    cpu: [options.cpu],
    files: ['bin/'],
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/pproenca/node-webcodecs',
    },
  };

  // Add libc field for Linux packages
  if (options.libc) {
    pkgJson.libc = [options.libc];
  }

  writeFileSync(join(pkgDir, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`);
  return {pkgDir};
}

function createTarball(outDir: string, platform: string, scope: string, libc?: string): {tarPath: string} {
  const platformSuffix = libc ? `${platform}-${libc}` : platform;
  const tarName = `@${scope}-node-webcodecs-${platformSuffix}.tar`;
  const tarPath = join(outDir, tarName);
  const pkgDir = `./@${scope}/node-webcodecs-${platformSuffix}/`;

  const cwd = resolve(outDir);
  execFileSync('tar', ['-cvf', tarName, pkgDir], {cwd, stdio: 'inherit'});
  return {tarPath};
}

function extractTarball(tarPath: string, outDir: string): void {
  const cwd = resolve(outDir);
  execFileSync('tar', ['-xf', tarPath], {cwd, stdio: 'inherit'});
}

function verifyPlatformPackage(outDir: string, platform: string, scope: string, libc?: string): {
  binPath: string;
  pkgDir: string;
} {
  const platformSuffix = libc ? `${platform}-${libc}` : platform;
  const pkgDir = join(outDir, `@${scope}/node-webcodecs-${platformSuffix}`);
  const binPath = join(pkgDir, 'bin', 'node.napi.node');
  if (!existsSync(binPath)) {
    throw new Error(`Missing binary: ${binPath}`);
  }
  return {binPath, pkgDir};
}

function copyToPrebuilds(prebuildsDir: string, platform: string, binPath: string): void {
  const targetDir = join(prebuildsDir, platform);
  ensureDir(targetDir);
  copyFileSync(binPath, join(targetDir, 'node.napi.node'));
}

export function main(args: string[]): number {
  const {positional, flags} = parseArgs(args);
  const mode = positional[0];
  const scope = flags.scope ?? 'pproenca';

  try {
    if (mode === 'pack') {
      const platform = requireFlag(flags, 'platform');
      const os = requireFlag(flags, 'os');
      const cpu = requireFlag(flags, 'cpu');
      const version = requireFlag(flags, 'version');
      const libc = flags.libc;
      const outDir = resolve(flags.out ?? 'packages');
      const prebuildPath = resolve(flags.prebuild ?? join('prebuilds', platform, 'node.napi.node'));

      ensureDir(outDir);
      writePlatformPackage({platform, os, cpu, version, prebuildPath, outDir, scope, libc});
      createTarball(outDir, platform, scope, libc);
      const platformSuffix = libc ? `${platform}-${libc}` : platform;
      console.log(`Packaged @${scope}/node-webcodecs-${platformSuffix}`);
      return 0;
    }

    if (mode === 'extract') {
      const platform = requireFlag(flags, 'platform');
      const libc = flags.libc;
      const tarPath = resolve(requireFlag(flags, 'tar'));
      const outDir = resolve(flags.out ?? 'packages');
      const prebuildsDir = flags.prebuilds ? resolve(flags.prebuilds) : undefined;

      ensureDir(outDir);
      extractTarball(tarPath, outDir);
      const {binPath} = verifyPlatformPackage(outDir, platform, scope, libc);
      if (prebuildsDir) {
        copyToPrebuilds(prebuildsDir, platform, binPath);
      }
      const platformSuffix = libc ? `${platform}-${libc}` : platform;
      console.log(`Extracted @${scope}/node-webcodecs-${platformSuffix}`);
      return 0;
    }

    console.error(`Unknown mode: ${mode ?? '(none)'} (expected: pack | extract)`);
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
