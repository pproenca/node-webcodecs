#!/usr/bin/env node
/**
 * Platform package helper for CI workflows.
 *
 * Modes:
 *   pack    - Create a platform package and tarball from a prebuild.
 *   extract - Extract a platform package tarball and optionally copy into prebuilds/.
 */
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=');
    if (inline !== undefined) {
      args[key] = inline;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function requireArg(args, key) {
  const value = args[key];
  if (!value) {
    console.error(`Missing required argument: --${key}`);
    process.exit(1);
  }
  return value;
}

function ensureDir(pathname) {
  mkdirSync(pathname, { recursive: true });
}

function writePlatformPackage({
  platform,
  os,
  cpu,
  version,
  prebuildPath,
  outDir,
  scope
}) {
  const pkgDir = join(outDir, `@${scope}/node-webcodecs-${platform}`);
  const binDir = join(pkgDir, 'bin');
  ensureDir(binDir);

  if (!existsSync(prebuildPath)) {
    console.error(`Prebuild not found: ${prebuildPath}`);
    process.exit(1);
  }

  copyFileSync(prebuildPath, join(binDir, 'node.napi.node'));

  const pkgJson = {
    name: `@${scope}/node-webcodecs-${platform}`,
    version,
    description: `node-webcodecs native addon for ${platform}`,
    os: [os],
    cpu: [cpu],
    files: ['bin/'],
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/pproenca/node-webcodecs'
    }
  };

  writeFileSync(join(pkgDir, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`);
  return { pkgDir };
}

function createTarball({ outDir, platform, scope }) {
  const tarName = `@${scope}-node-webcodecs-${platform}.tar`;
  const tarPath = join(outDir, tarName);
  const pkgDir = `./@${scope}/node-webcodecs-${platform}/`;

  const cwd = resolve(outDir);
  execFileSync('tar', ['-cvf', tarName, pkgDir], { cwd, stdio: 'inherit' });
  return { tarPath };
}

function extractTarball({ tarPath, outDir }) {
  const cwd = resolve(outDir);
  execFileSync('tar', ['-xf', tarPath], { cwd, stdio: 'inherit' });
}

function verifyPlatformPackage({ outDir, platform, scope }) {
  const pkgDir = join(outDir, `@${scope}/node-webcodecs-${platform}`);
  const binPath = join(pkgDir, 'bin', 'node.napi.node');
  if (!existsSync(binPath)) {
    console.error(`Missing binary: ${binPath}`);
    process.exit(1);
  }
  return { binPath, pkgDir };
}

function copyToPrebuilds({ prebuildsDir, platform, binPath }) {
  const targetDir = join(prebuildsDir, platform);
  ensureDir(targetDir);
  copyFileSync(binPath, join(targetDir, 'node.napi.node'));
}

const [mode, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const scope = args.scope || 'pproenca';

if (mode === 'pack') {
  const platform = requireArg(args, 'platform');
  const os = requireArg(args, 'os');
  const cpu = requireArg(args, 'cpu');
  const version = requireArg(args, 'version');
  const outDir = resolve(args.out || 'packages');
  const prebuildPath = resolve(
    args.prebuild || join('prebuilds', platform, 'node.napi.node')
  );

  ensureDir(outDir);
  writePlatformPackage({
    platform,
    os,
    cpu,
    version,
    prebuildPath,
    outDir,
    scope
  });
  createTarball({ outDir, platform, scope });
  console.log(`Packaged @${scope}/node-webcodecs-${platform}`);
  process.exit(0);
}

if (mode === 'extract') {
  const platform = requireArg(args, 'platform');
  const tarPath = resolve(requireArg(args, 'tar'));
  const outDir = resolve(args.out || 'packages');
  const prebuildsDir = args.prebuilds ? resolve(args.prebuilds) : null;

  ensureDir(outDir);
  extractTarball({ tarPath, outDir });
  const { binPath } = verifyPlatformPackage({ outDir, platform, scope });
  if (prebuildsDir) {
    copyToPrebuilds({ prebuildsDir, platform, binPath });
  }
  console.log(`Extracted @${scope}/node-webcodecs-${platform}`);
  process.exit(0);
}

console.error(`Unknown mode: ${mode || '(none)'} (expected: pack | extract)`);
process.exit(1);
