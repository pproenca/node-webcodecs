#!/usr/bin/env tsx
import {existsSync, readFileSync, renameSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {isMainModule} from '../shared/runtime';
import {parseArgs, requireFlag} from '../shared/args';
import {findFirstFile} from './fs-utils';
import {writeGithubEnv} from './github';
import {DEFAULT_RUNNER, type CommandRunner} from './runner';

interface PrebuildifyOptions {
  readonly arch: string;
  readonly platform: string;
  readonly libc?: string;
}

interface PackagePlatformOptions {
  readonly platform: string;
  readonly os: string;
  readonly cpu: string;
  readonly version: string;
  readonly prebuild: string;
  readonly outDir: string;
  readonly scope?: string;
  readonly libc?: string;
}

interface ExtractPrebuiltOptions {
  readonly platform: string;
  readonly tarPath: string;
  readonly outDir: string;
  readonly prebuildsDir: string;
}

interface InstallFfmpegOptions {
  readonly platform: string;
  readonly variant: 'lgpl' | 'non-free';
}

const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+/;

/**
 * Maps node-webcodecs platform names to webcodecs-ffmpeg package platform names.
 * Note: webcodecs-ffmpeg uses different platform names for libc variants.
 */
function mapPlatformToFfmpegPackage(platform: string): string {
  // linux-x64-glibc and linux-x64-musl both map to linux-x64 in webcodecs-ffmpeg
  // The webcodecs-ffmpeg packages handle libc detection internally
  if (platform === 'linux-x64-glibc' || platform === 'linux-x64-musl') {
    return 'linux-x64';
  }
  return platform;
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

/**
 * Installs FFmpeg development package from npm (@pproenca/webcodecs-ffmpeg-dev-*)
 * and sets FFMPEG_ROOT environment variable for the build.
 */
export function installFfmpeg(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  options: InstallFfmpegOptions,
): void {
  const ffmpegPlatform = mapPlatformToFfmpegPackage(options.platform);
  const suffix = options.variant === 'non-free' ? '-non-free' : '';
  const packageName = `@pproenca/webcodecs-ffmpeg-dev-${ffmpegPlatform}${suffix}`;

  console.log(`Installing FFmpeg development package: ${packageName}`);
  runner.runOrThrow('npm', ['install', '--no-save', packageName], {stdio: 'inherit'});

  // Resolve the installed package path and set FFMPEG_ROOT
  const result = runner.run('node', [
    '-e',
    `console.log(require.resolve('${packageName}/package.json'))`,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to resolve installed package ${packageName}`);
  }

  const pkgJsonPath = result.stdout.trim();
  const ffmpegRoot = dirname(pkgJsonPath);

  // Verify the expected directories exist
  const libDir = join(ffmpegRoot, 'lib');
  const pkgConfigDir = join(libDir, 'pkgconfig');
  const includeDir = join(ffmpegRoot, 'include');

  if (!existsSync(libDir)) {
    throw new Error(`Missing lib directory in FFmpeg package: ${libDir}`);
  }
  if (!existsSync(pkgConfigDir)) {
    throw new Error(`Missing pkgconfig directory in FFmpeg package: ${pkgConfigDir}`);
  }
  if (!existsSync(includeDir)) {
    throw new Error(`Missing include directory in FFmpeg package: ${includeDir}`);
  }

  console.log(`FFmpeg installed at: ${ffmpegRoot}`);
  writeGithubEnv(env, 'FFMPEG_ROOT', ffmpegRoot);

  runner.runOrThrow('ls', ['-la', libDir], {stdio: 'inherit'});
  runner.runOrThrow('ls', ['-la', pkgConfigDir], {stdio: 'inherit'});
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
    // Detect if running in Alpine (musl container)
    const isAlpine = existsSync('/etc/alpine-release');

    if (isAlpine) {
      // Alpine Linux - use apk
      runner.runOrThrow('apk', ['add', '--no-cache', 'build-base', 'python3', 'pkgconf'], {
        stdio: 'inherit',
      });
    } else {
      // Ubuntu/Debian - use apt-get
      runner.runOrThrow('sudo', ['apt-get', 'update'], {stdio: 'inherit'});
      runner.runOrThrow('sudo', ['apt-get', 'install', '-y', 'pkg-config'], {stdio: 'inherit'});
    }
    return;
  }
  throw new Error(`Unsupported OS: ${osName}`);
}

export function runPrebuildify(runner: CommandRunner, options: PrebuildifyOptions): void {
  const args = ['prebuildify', '--napi', '--strip', `--arch=${options.arch}`];
  if (options.libc) {
    args.push('--tag-libc', options.libc);
  }
  runner.runOrThrow('npx', args, {
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
    if (command === 'install-ffmpeg') {
      const platform = requireFlag(flags, 'platform');
      const variant = (flags.variant ?? 'non-free') as 'lgpl' | 'non-free';
      if (variant !== 'lgpl' && variant !== 'non-free') {
        throw new Error(`Invalid variant: ${variant}. Must be 'lgpl' or 'non-free'.`);
      }
      installFfmpeg(runner, env, {platform, variant});
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

    if (command === 'prebuildify') {
      const arch = requireFlag(flags, 'arch');
      const platform = requireFlag(flags, 'platform');
      const libc = flags.libc;
      runPrebuildify(runner, {arch, platform, libc});
      return 0;
    }

    if (command === 'package-platform') {
      const platform = requireFlag(flags, 'platform');
      const osName = requireFlag(flags, 'os');
      const cpu = requireFlag(flags, 'cpu');
      const outDir = resolve(flags.out ?? 'packages');
      const prebuild = resolve(flags.prebuild ?? join('prebuilds', platform, 'node.napi.node'));
      const scope = flags.scope;
      const libc = flags.libc;
      const version = flags.version ?? resolvePackageVersion(process.cwd());

      packagePlatform(runner, {platform, os: osName, cpu, version, prebuild, outDir, scope, libc});
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
