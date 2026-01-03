#!/usr/bin/env node
/**
 * Generate a deps manifest and optional SHA256SUMS file.
 *
 * Usage:
 *   node scripts/ffmpeg-manifest.mjs --artifacts release \
 *     --variant gpl --manifest-out release/deps-manifest.json \
 *     --checksums-out release/SHA256SUMS
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, env, exit } from 'node:process';

function parseArgs(args) {
  const result = new Map();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    result.set(key, value);
  }
  return result;
}

function normalizeVariant(value) {
  if (!value || value === 'gpl') return 'gpl';
  if (value === 'lgpl') return 'lgpl';
  throw new Error(`Unsupported variant: ${value}`);
}

function sha256File(path) {
  const hash = createHash('sha256');
  const data = readFileSync(path);
  hash.update(data);
  return hash.digest('hex');
}

function listArtifacts(dir) {
  return readdirSync(dir)
    .filter((name) => name.startsWith('ffmpeg-') && name.endsWith('.tar.gz'))
    .map((name) => {
      const fullPath = join(dir, name);
      const stats = statSync(fullPath);
      return {
        name,
        size: stats.size,
        sha256: sha256File(fullPath),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildManifest({ artifactsDir, versionsPath, variant }) {
  const resolvedVariant = normalizeVariant(variant);
  const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
  const assets = listArtifacts(artifactsDir);

  const gplEnabled = resolvedVariant === 'gpl';
  const enabledLibraries = [
    'libvpx',
    'libaom',
    'opus',
    'lame',
    ...(gplEnabled ? ['x264', 'x265'] : []),
  ];

  return {
    variant: resolvedVariant,
    gplEnabled,
    generatedAt: new Date().toISOString(),
    ffmpegVersion: versions.ffmpeg,
    libraries: enabledLibraries.reduce((acc, name) => {
      acc[name] = versions[name];
      return acc;
    }, {}),
    licenses: versions.licenses ?? {},
    assets,
  };
}

function writeChecksums(path, assets) {
  const lines = assets.map((asset) => `${asset.sha256}  ${asset.name}`);
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function writeManifest(path, manifest) {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(argv.slice(2));
  const artifactsDir = args.get('artifacts');
  if (!artifactsDir) {
    console.error('Missing --artifacts');
    exit(1);
  }

  const versionsPath =
    args.get('versions') ||
    resolve(env.GITHUB_WORKSPACE || process.cwd(), 'ffmpeg', 'versions.json');
  const variant = normalizeVariant(args.get('variant') || 'gpl');

  const manifest = buildManifest({
    artifactsDir,
    versionsPath,
    variant,
  });

  if (args.has('json')) {
    console.log(JSON.stringify(manifest, null, 2));
  }

  const manifestOut = args.get('manifest-out');
  if (manifestOut) {
    writeManifest(manifestOut, manifest);
  }

  const checksumsOut = args.get('checksums-out');
  if (checksumsOut) {
    writeChecksums(checksumsOut, manifest.assets);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    exit(1);
  });
}
