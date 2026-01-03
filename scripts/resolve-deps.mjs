#!/usr/bin/env node
/**
 * Resolve the latest deps release and asset availability.
 *
 * Usage:
 *   node scripts/resolve-deps.mjs --repo owner/repo [--variant gpl|lgpl]
 *   node scripts/resolve-deps.mjs --repo owner/repo --json
 *   node scripts/resolve-deps.mjs --repo owner/repo --github-output "$GITHUB_OUTPUT"
 */
import { writeFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';

const DEFAULT_PLATFORMS = [
  'linux-x64',
  'linux-x64-musl',
  'darwin-x64',
  'darwin-arm64',
];

const ASSET_NAMES = {
  'linux-x64': ['ffmpeg-linux-x64.tar.gz', 'ffmpeg-linux-x64-glibc.tar.gz'],
  'linux-x64-musl': ['ffmpeg-linux-x64-musl.tar.gz'],
  'darwin-x64': ['ffmpeg-darwin-x64.tar.gz'],
  'darwin-arm64': ['ffmpeg-darwin-arm64.tar.gz'],
};

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

function releasePrefixForVariant(variant) {
  return variant === 'lgpl' ? 'deps-lgpl-' : 'deps-';
}

function parseDate(value) {
  const date = value ? new Date(value).getTime() : 0;
  return Number.isNaN(date) ? 0 : date;
}

function sortByPublishedAt(releases) {
  return [...releases].sort((a, b) => {
    const left = parseDate(a.published_at || a.created_at);
    const right = parseDate(b.published_at || b.created_at);
    return right - left;
  });
}

function hasAsset(assetNames, expected) {
  return expected.some((name) => assetNames.includes(name));
}

function buildResolution(release, variant, prefix) {
  const assets = (release.assets ?? [])
    .map((asset) => asset.name)
    .filter(Boolean)
    .sort();
  const availability = {
    linux_x64: hasAsset(assets, ASSET_NAMES['linux-x64']),
    linux_x64_musl: hasAsset(assets, ASSET_NAMES['linux-x64-musl']),
    darwin_x64: hasAsset(assets, ASSET_NAMES['darwin-x64']),
    darwin_arm64: hasAsset(assets, ASSET_NAMES['darwin-arm64']),
  };

  return {
    tag: release.tag_name,
    version: release.tag_name?.slice(prefix.length),
    variant,
    assets,
    availability,
  };
}

export function resolveDepsFromReleases(releases, variant, required = []) {
  const normalizedVariant = normalizeVariant(variant);
  const prefix = releasePrefixForVariant(normalizedVariant);
  const filtered = releases.filter((release) => {
    if (release.draft || release.prerelease) return false;
    if (!release.tag_name?.startsWith(prefix)) return false;
    if (normalizedVariant === 'gpl' && release.tag_name.startsWith('deps-lgpl-')) {
      return false;
    }
    return true;
  });
  const sorted = sortByPublishedAt(filtered);
  if (sorted.length === 0) return null;

  const requiredPlatforms = Array.isArray(required) ? required : [];
  if (requiredPlatforms.length === 0) {
    return buildResolution(sorted[0], normalizedVariant, prefix);
  }

  for (const release of sorted) {
    const resolved = buildResolution(release, normalizedVariant, prefix);
    const missing = missingRequiredPlatforms(requiredPlatforms, resolved.availability);
    if (missing.length === 0) {
      return resolved;
    }
  }

  const latest = buildResolution(sorted[0], normalizedVariant, prefix);
  return {
    ...latest,
    missingRequired: missingRequiredPlatforms(requiredPlatforms, latest.availability),
  };
}

async function fetchReleases(repo, token) {
  const url = `https://api.github.com/repos/${repo}/releases`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'node-webcodecs/resolve-deps',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }
  return response.json();
}

function writeGithubOutput(path, payload, prefix) {
  const lines = [];
  const outputPrefix = prefix ?? '';
  const entries = {
    deps_tag: payload.tag,
    deps_version: payload.version,
    deps_variant: payload.variant,
    has_linux_x64: String(payload.availability.linux_x64),
    has_linux_x64_musl: String(payload.availability.linux_x64_musl),
    has_darwin_x64: String(payload.availability.darwin_x64),
    has_darwin_arm64: String(payload.availability.darwin_arm64),
  };
  for (const [key, value] of Object.entries(entries)) {
    lines.push(`${outputPrefix}${key}=${value}`);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function parseRequiredPlatforms(value) {
  if (!value) return [];
  if (value === 'all') return DEFAULT_PLATFORMS;
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function missingRequiredPlatforms(required, availability) {
  const missing = [];
  for (const platform of required) {
    if (platform === 'linux-x64' && !availability.linux_x64) missing.push(platform);
    if (platform === 'linux-x64-musl' && !availability.linux_x64_musl) missing.push(platform);
    if (platform === 'darwin-x64' && !availability.darwin_x64) missing.push(platform);
    if (platform === 'darwin-arm64' && !availability.darwin_arm64) missing.push(platform);
  }
  return missing;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  const repo = args.get('repo') || env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error('Missing --repo and GITHUB_REPOSITORY not set.');
    exit(1);
  }

  const variant = normalizeVariant(args.get('variant') || 'gpl');
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  const required = parseRequiredPlatforms(args.get('require'));

  const releases = await fetchReleases(repo, token);
  const resolved = resolveDepsFromReleases(releases, variant, required);
  if (!resolved) {
    console.error(`No deps releases found for variant "${variant}".`);
    exit(1);
  }
  if (resolved.missingRequired?.length) {
    console.error(
      `No deps releases found for variant "${variant}" with required assets: ` +
        `${required.join(', ')}. Latest release ${resolved.tag} missing: ` +
        `${resolved.missingRequired.join(', ')}`
    );
    exit(1);
  }

  if (args.has('json')) {
    console.log(JSON.stringify(resolved, null, 2));
  }

  const outputPath = args.get('github-output') || env.GITHUB_OUTPUT;
  if (outputPath) {
    writeGithubOutput(outputPath, resolved, args.get('output-prefix'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    exit(1);
  });
}
