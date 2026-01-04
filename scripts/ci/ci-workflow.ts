#!/usr/bin/env tsx
import {existsSync, mkdirSync, readFileSync, renameSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {isMainModule} from '../shared/runtime';
import {parseArgs, requireFlag} from '../shared/args';
import {findFirstFile} from './fs-utils';
import {writeGithubEnv, writeGithubOutput} from './github';
import {DEFAULT_RUNNER, type CommandRunner} from './runner';

interface PrebuildifyOptions {
  readonly arch: string;
  readonly platform: string;
}

interface PackagePlatformOptions {
  readonly platform: string;
  readonly os: string;
  readonly cpu: string;
  readonly version: string;
  readonly prebuild: string;
  readonly outDir: string;
  readonly scope?: string;
}

interface ExtractPrebuiltOptions {
  readonly platform: string;
  readonly tarPath: string;
  readonly outDir: string;
  readonly prebuildsDir: string;
}

const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+/;

function ensureDir(pathname: string): void {
  mkdirSync(pathname, {recursive: true});
}

export function resolveLatestDepsTag(runner: CommandRunner, repo: string): string {
  const result = runner.run('gh', [
    'release',
    'list',
    '--repo',
    repo,
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
    throw new Error('No deps-* release found in repository.');
  }

  return tag;
}

export function resolvePackageVersion(rootDir: string): string {
  const pkgPath = resolve(rootDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version?: string};
  const version = pkg.version ?? '';
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Failed to extract valid version from package.json: '${version}'`);
  }
  return version;
}

export function resolveDeps(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  repo: string,
): void {
  const latestTag = resolveLatestDepsTag(runner, repo);
  const version = latestTag.startsWith('deps-') ? latestTag.slice('deps-'.length) : latestTag;
  console.log(`Detected latest dependencies: ${latestTag} (version: ${version})`);
  writeGithubOutput(env, 'version', version);
}

export function fixMacosPowerServices(runner: CommandRunner): void {
  const defaultsResult = runner.run('sudo', [
    'defaults',
    '-currentHost',
    'write',
    '/Library/Preferences/com.apple.powerlogd',
    'SMCMonitorCadence',
    '0',
  ]);
  if (defaultsResult.exitCode !== 0) {
    console.log('Warning: defaults write failed (may not be needed on this macOS version)');
  }

  const killResult = runner.run('sudo', ['killall', 'PerfPowerServices']);
  if (killResult.exitCode !== 0) {
    console.log('Warning: killall failed (PerfPowerServices not running?)');
  }
}

export function installBuildTools(runner: CommandRunner, osName: string): void {
  if (osName === 'macos') {
    runner.runOrThrow('brew', ['install', 'pkg-config'], {stdio: 'inherit'});
    return;
  }
  if (osName === 'linux') {
    runner.runOrThrow('sudo', ['apt-get', 'update'], {stdio: 'inherit'});
    runner.runOrThrow('sudo', ['apt-get', 'install', '-y', 'pkg-config'], {stdio: 'inherit'});
    return;
  }
  throw new Error(`Unsupported OS: ${osName}`);
}

export function extractFfmpegArchive(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  archivePath: string,
  outDir: string,
): void {
  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  ensureDir(outDir);
  runner.runOrThrow('tar', ['-xzvf', archivePath, '-C', outDir], {stdio: 'inherit'});

  const libDir = join(outDir, 'lib');
  const pkgConfigDir = join(libDir, 'pkgconfig');
  if (!existsSync(libDir)) {
    throw new Error(`Missing lib directory after extract: ${libDir}`);
  }
  if (!existsSync(pkgConfigDir)) {
    throw new Error(`Missing pkgconfig directory after extract: ${pkgConfigDir}`);
  }

  writeGithubEnv(env, 'FFMPEG_ROOT', outDir);
  runner.runOrThrow('ls', ['-la', libDir], {stdio: 'inherit'});
  runner.runOrThrow('ls', ['-la', pkgConfigDir], {stdio: 'inherit'});
}

export function runPrebuildify(runner: CommandRunner, options: PrebuildifyOptions): void {
  runner.runOrThrow('npx', ['prebuildify', '--napi', '--strip', `--arch=${options.arch}`], {
    stdio: 'inherit',
  });

  const prebuildDir = resolve('prebuilds', options.platform);
  const expected = join(prebuildDir, 'node.napi.node');
  if (existsSync(expected)) {
    console.log(`Prebuild OK: ${expected}`);
    return;
  }

  const fallback = findFirstFile(prebuildDir, pathname => pathname.endsWith('.node'));
  if (!fallback) {
    throw new Error(`No .node file found in ${prebuildDir}`);
  }

  console.log(`Renaming ${fallback} to ${expected}`);
  renameSync(fallback, expected);
}

export function packagePlatform(
  runner: CommandRunner,
  options: PackagePlatformOptions,
): void {
  const args = [
    'tsx',
    'scripts/ci/platform-package.ts',
    'pack',
    '--platform',
    options.platform,
    '--os',
    options.os,
    '--cpu',
    options.cpu,
    '--version',
    options.version,
    '--prebuild',
    options.prebuild,
    '--out',
    options.outDir,
  ];
  if (options.scope) {
    args.push('--scope', options.scope);
  }
  runner.runOrThrow('npx', args, {stdio: 'inherit'});
}

export function extractPrebuilt(
  runner: CommandRunner,
  options: ExtractPrebuiltOptions,
): void {
  runner.runOrThrow(
    'npx',
    [
      'tsx',
      'scripts/ci/platform-package.ts',
      'extract',
      '--platform',
      options.platform,
      '--tar',
      options.tarPath,
      '--out',
      options.outDir,
      '--prebuilds',
      options.prebuildsDir,
    ],
    {stdio: 'inherit'},
  );

  const expected = join(options.prebuildsDir, options.platform, 'node.napi.node');
  if (!existsSync(expected)) {
    throw new Error(`Extracted prebuild missing: ${expected}`);
  }
}

export function main(
  args: string[],
  runner: CommandRunner = DEFAULT_RUNNER,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const {positional, flags} = parseArgs(args);
  const command = positional[0];

  try {
    if (command === 'resolve-deps') {
      const repo = requireFlag(flags, 'repo');
      resolveDeps(runner, env, repo);
      return 0;
    }

    if (command === 'fix-macos-power') {
      fixMacosPowerServices(runner);
      return 0;
    }

    if (command === 'install-build-tools') {
      const osName = requireFlag(flags, 'os');
      installBuildTools(runner, osName);
      return 0;
    }

    if (command === 'extract-ffmpeg') {
      const archive = resolve(requireFlag(flags, 'archive'));
      const outDir = resolve(flags.out ?? 'ffmpeg-install');
      extractFfmpegArchive(runner, env, archive, outDir);
      return 0;
    }

    if (command === 'prebuildify') {
      const arch = requireFlag(flags, 'arch');
      const platform = requireFlag(flags, 'platform');
      runPrebuildify(runner, {arch, platform});
      return 0;
    }

    if (command === 'package-platform') {
      const platform = requireFlag(flags, 'platform');
      const osName = requireFlag(flags, 'os');
      const cpu = requireFlag(flags, 'cpu');
      const outDir = resolve(flags.out ?? 'packages');
      const prebuild = resolve(flags.prebuild ?? join('prebuilds', platform, 'node.napi.node'));
      const scope = flags.scope;
      const version = flags.version ?? resolvePackageVersion(process.cwd());

      packagePlatform(runner, {platform, os: osName, cpu, version, prebuild, outDir, scope});
      return 0;
    }

    if (command === 'extract-prebuilt') {
      const platform = requireFlag(flags, 'platform');
      const tarName = flags.tar ?? `@pproenca-node-webcodecs-${platform}.tar`;
      const tarPath =
        flags.tar ? resolve(flags.tar) : findFirstFile(process.cwd(), pathname => basename(pathname) === tarName);
      if (!tarPath) {
        throw new Error(`Platform tarball not found for ${platform}`);
      }

      const outDir = resolve(flags.out ?? 'packages');
      const prebuildsDir = resolve(flags.prebuilds ?? 'prebuilds');
      extractPrebuilt(runner, {platform, tarPath, outDir, prebuildsDir});
      return 0;
    }

    console.error(`Unknown command: ${command ?? '(none)'}`);
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
