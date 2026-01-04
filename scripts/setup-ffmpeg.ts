#!/usr/bin/env tsx
// Download pre-built FFmpeg libraries from CI releases for local development.
// This ensures local builds match CI exactly.
//
// Usage:
//   tsx scripts/setup-ffmpeg.ts                        # Auto-detect platform + latest deps-*
//   tsx scripts/setup-ffmpeg.ts darwin-arm64           # Specific platform + latest deps-*
//   tsx scripts/setup-ffmpeg.ts darwin-x64             # For Intel Mac testing
//   tsx scripts/setup-ffmpeg.ts linux-x64              # For Linux testing (Docker)
//   tsx scripts/setup-ffmpeg.ts darwin-arm64 deps-v5   # Specific deps tag
//
// After running, rebuild with:
//   npm run build

import {existsSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainModule} from './shared/runtime';
import {ensureDir, removeDir} from './shared/fs';
import {runCommand, runCommandOrThrow} from './shared/exec';
import {main as checkMacosAbi} from './check-macos-abi';

const REPO = 'pproenca/node-webcodecs';

interface SetupOptions {
  readonly platform?: string;
  readonly depsTag?: string;
}

function resolveRootDir(): string {
  if (process.env.ROOT_DIR) {
    return resolve(process.env.ROOT_DIR);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function detectPlatform(osName: NodeJS.Platform, arch: string): string | null {
  if (osName === 'darwin') {
    if (arch === 'arm64') return 'darwin-arm64';
    if (arch === 'x64') return 'darwin-x64';
    return null;
  }

  if (osName === 'linux') {
    if (arch === 'x64') return 'linux-x64';
    return null;
  }

  return null;
}

export function parseArgs(args: string[]): SetupOptions {
  return {
    platform: args[0],
    depsTag: args[1],
  };
}

function ensureGhInstalled(): void {
  const result = runCommand('gh', ['--version']);
  if (result.exitCode !== 0) {
    throw new Error('GitHub CLI (gh) is required. Install with: brew install gh');
  }
}

function ensureGhAuth(): void {
  const result = runCommand('gh', ['auth', 'status']);
  if (result.exitCode !== 0) {
    throw new Error('Not authenticated with GitHub CLI. Run: gh auth login');
  }
}

function resolveLatestDepsTag(): string {
  const result = runCommand('gh', [
    'release',
    'list',
    '--repo',
    REPO,
    '--limit',
    '200',
    '--json',
    'tagName',
    '--jq',
    '[.[] | select(.tagName | startswith("deps-"))][0].tagName',
  ]);

  if (result.exitCode !== 0) {
    throw new Error('Failed to resolve latest deps-* tag from GitHub releases.');
  }

  const tag = result.stdout.trim();
  if (!tag) {
    throw new Error('Could not resolve latest deps-* release tag.');
  }

  return tag;
}

function listLibraries(libDir: string): void {
  if (!existsSync(libDir)) {
    return;
  }
  const libs = readdirSync(libDir).filter(file => file.endsWith('.a'));
  for (const lib of libs.slice(0, 5)) {
    console.log(join(libDir, lib));
  }
}

export function main(args: string[]): number {
  const rootDir = resolveRootDir();
  const installDir = join(rootDir, 'ffmpeg-install');

  const parsed = parseArgs(args);
  const platform = parsed.platform ?? detectPlatform(process.platform, process.arch);
  if (!platform) {
    console.error('Error: Could not detect platform. Specify one of:');
    console.error('  darwin-arm64  (Apple Silicon Mac)');
    console.error('  darwin-x64    (Intel Mac)');
    console.error('  linux-x64     (Linux x86_64)');
    return 1;
  }

  try {
    ensureGhInstalled();
    ensureGhAuth();

    const depsTag = parsed.depsTag ?? resolveLatestDepsTag();

    console.log('========================================');
    console.log('FFmpeg Setup for node-webcodecs');
    console.log('========================================');
    console.log(`Platform:     ${platform}`);
    console.log(`Deps version: ${depsTag}`);
    console.log(`Install dir:  ${installDir}`);
    console.log('');

    const assetName = `ffmpeg-${platform}.tar.gz`;
    const downloadPath = join(rootDir, assetName);

    console.log(`Downloading ${assetName} from ${depsTag}...`);
    runCommandOrThrow(
      'gh',
      ['release', 'download', depsTag, '--repo', REPO, '--pattern', assetName, '--output', downloadPath, '--clobber'],
      {stdio: 'inherit'},
    );

    console.log(`Extracting to ${installDir}...`);
    removeDir(installDir);
    ensureDir(installDir);
    runCommandOrThrow('tar', ['-xzf', downloadPath, '-C', installDir], {stdio: 'inherit'});

    rmSync(downloadPath, {force: true});

    const libDir = join(installDir, 'lib');
    const includeDir = join(installDir, 'include');
    if (!existsSync(libDir) || !existsSync(includeDir)) {
      throw new Error('Extraction failed - lib/ or include/ not found');
    }

    console.log('');
    console.log('Installed libraries:');
    listLibraries(libDir);

    if (process.platform === 'darwin') {
      console.log('');
      console.log('Running ABI compatibility check...');
      const status = checkMacosAbi();
      if (status !== 0) {
        return status;
      }
    }

    console.log('');
    console.log('========================================');
    console.log('FFmpeg setup complete!');
    console.log('========================================');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set environment (optional, auto-detected):');
    console.log(`     export FFMPEG_ROOT=${installDir}`);
    console.log('');
    console.log('  2. Rebuild:');
    console.log('     npm run build');
    console.log('');
    console.log('  3. Test:');
    console.log('     npm test');
    console.log('');

    const nativePlatform = detectPlatform(process.platform, process.arch);
    if (nativePlatform && platform !== nativePlatform) {
      console.log(`Note: You downloaded ${platform} but are on ${nativePlatform}.`);
      console.log('To test platform builds, use Docker or appropriate environment.');
      console.log('');
    }

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
