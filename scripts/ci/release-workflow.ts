#!/usr/bin/env tsx
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {isMainModule} from '../shared/runtime';
import {parseArgs, requireFlag} from '../shared/args';
import {findFirstFile, listDirectories} from './fs-utils';
import {writeGithubEnv, writeGithubOutput} from './github';
import {DEFAULT_RUNNER, type CommandRunner} from './runner';

const REQUIRED_EXPORTS = [
  'VideoDecoder',
  'VideoEncoder',
  'AudioDecoder',
  'AudioEncoder',
  'VideoFrame',
  'AudioData',
];

function ensureDir(pathname: string): void {
  mkdirSync(pathname, {recursive: true});
}

function parsePlatforms(value: string): string[] {
  return value
    .split(/\s+/)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

function findTarballInDir(dir: string, extension: string): string | null {
  const entries = readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(extension)) {
      return join(dir, entry.name);
    }
  }
  return null;
}

function smokeTestScript(platformLabel: string): string {
  return `
    const wc = require('@pproenca/node-webcodecs');
    console.log('Loaded exports:', Object.keys(wc));

    const required = ${JSON.stringify(REQUIRED_EXPORTS)};
    for (const cls of required) {
      if (typeof wc[cls] !== 'function') {
        console.error(cls + ' not a function');
        process.exit(1);
      }
    }

    const encoder = new wc.VideoEncoder({
      output: () => {},
      error: (e) => console.error(e)
    });
    console.log('VideoEncoder created, state:', encoder.state);

    console.log('Smoke Test PASSED for ${platformLabel}!');
  `;
}

export function verifyCiCompleted(
  runner: CommandRunner,
  workflow: string,
  commit: string,
): void {
  const result = runner.run('gh', [
    'run',
    'list',
    `--workflow=${workflow}`,
    `--commit=${commit}`,
    '--status=completed',
    '--limit=1',
    '--json',
    'conclusion',
    '-q',
    '.[0].conclusion',
  ]);

  const conclusion = result.stdout.trim() || 'not_found';
  if (conclusion !== 'success') {
    throw new Error(
      `CI workflow has not successfully completed for commit ${commit} (conclusion: ${conclusion})`,
    );
  }
}

export function extractPlatformArtifact(
  runner: CommandRunner,
  platform: string,
  artifactsDir: string,
  outDir: string,
): void {
  runner.runOrThrow('ls', ['-la', artifactsDir], {stdio: 'inherit'});
  const tarball = findFirstFile(artifactsDir, pathname => pathname.endsWith('.tar'));
  if (!tarball) {
    throw new Error(`No tarball found in ${artifactsDir}`);
  }

  runner.runOrThrow('tar', ['-tf', tarball], {stdio: 'inherit'});
  runner.runOrThrow(
    'npx',
    [
      'tsx',
      'scripts/ci/platform-package.ts',
      'extract',
      '--platform',
      platform,
      '--tar',
      tarball,
      '--out',
      outDir,
    ],
    {stdio: 'inherit'},
  );
}

export function createNpmTarball(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  cwd: string,
): void {
  runner.runOrThrow('npm', ['pack'], {cwd, stdio: 'inherit'});
  const tarball = findTarballInDir(cwd, '.tgz');
  if (!tarball) {
    throw new Error('npm pack did not create a tarball');
  }
  writeGithubEnv(env, 'PACKED_TGZ', tarball);
  const listResult = runner.run('tar', ['-tzf', tarball]);
  if (listResult.exitCode !== 0) {
    throw new Error(`Tarball is corrupted: ${tarball}`);
  }
  const preview = listResult.stdout.split('\n').slice(0, 20).join('\n');
  if (preview) {
    console.log(preview);
  }
}

export function prepublishSmokeTest(
  runner: CommandRunner,
  platform: string,
  tarball: string,
  packagesDir: string,
): void {
  const stageDir = resolve('smoke-stage');
  const resolvedTarball = resolve(tarball);
  ensureDir(stageDir);
  runner.runOrThrow('npm', ['init', '-y'], {cwd: stageDir, stdio: 'inherit'});
  runner.runOrThrow('npm', ['install', '--ignore-scripts', resolvedTarball], {
    cwd: stageDir,
    stdio: 'inherit',
  });

  const platformPackage = resolve(packagesDir, `@pproenca/node-webcodecs-${platform}`);
  runner.runOrThrow('npm', ['install', platformPackage], {cwd: stageDir, stdio: 'inherit'});
  runner.runOrThrow('node', ['-e', smokeTestScript(platform)], {cwd: stageDir, stdio: 'inherit'});
}

export function extractAndVerifyPlatformPackages(
  runner: CommandRunner,
  platforms: string[],
  artifactsDir: string,
  outDir: string,
): void {
  ensureDir(outDir);
  const artifactDirs = listDirectories(artifactsDir).filter(dir => dir.includes('platform-pkg-'));
  for (const artifactDir of artifactDirs) {
    const platform = artifactDir.split('platform-pkg-').pop();
    if (!platform) {
      continue;
    }
    const tarball = findFirstFile(artifactDir, pathname => pathname.endsWith('.tar'));
    if (!tarball) {
      throw new Error(`No tarball found in ${artifactDir}`);
    }

    runner.runOrThrow('tar', ['-tf', tarball], {stdio: 'inherit'});
    runner.runOrThrow(
      'npx',
      [
        'tsx',
        'scripts/ci/platform-package.ts',
        'extract',
        '--platform',
        platform,
        '--tar',
        tarball,
        '--out',
        outDir,
      ],
      {stdio: 'inherit'},
    );
  }

  for (const platform of platforms) {
    const pkgDir = resolve(outDir, `@pproenca/node-webcodecs-${platform}`);
    const binaryPath = join(pkgDir, 'bin', 'node.napi.node');
    if (!existsSync(binaryPath)) {
      throw new Error(`Missing binary for ${platform}`);
    }
  }
}

export function publishPlatformPackages(
  runner: CommandRunner,
  platforms: string[],
  packagesDir: string,
): void {
  for (const platform of platforms) {
    const pkgDir = resolve(packagesDir, `@pproenca/node-webcodecs-${platform}`);
    runner.runOrThrow('npm', ['publish', '--provenance', '--access', 'public'], {
      cwd: pkgDir,
      stdio: 'inherit',
    });
  }
  runner.runOrThrow('sleep', ['15']);
}

export function resolveReleaseVersion(env: NodeJS.ProcessEnv): string {
  const ref = env.GITHUB_REF ?? '';
  if (!ref.startsWith('refs/tags/v')) {
    throw new Error(`smoke-test should only run on tag releases (GITHUB_REF=${ref})`);
  }
  return ref.slice('refs/tags/v'.length);
}

export function smokeTestRegistry(
  runner: CommandRunner,
  platform: string,
  version: string,
): void {
  const stageDir = resolve('smoke-test');
  ensureDir(stageDir);
  runner.runOrThrow('npm', ['init', '-y'], {cwd: stageDir, stdio: 'inherit'});
  runner.runOrThrow('npm', ['install', `@pproenca/node-webcodecs@${version}`], {
    cwd: stageDir,
    stdio: 'inherit',
  });
  runner.runOrThrow('node', ['-e', smokeTestScript(platform)], {cwd: stageDir, stdio: 'inherit'});
}

export function main(
  args: string[],
  runner: CommandRunner = DEFAULT_RUNNER,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const {positional, flags} = parseArgs(args);
  const command = positional[0];

  try {
    if (command === 'verify-ci') {
      const workflow = flags.workflow ?? 'ci.yml';
      const commit = requireFlag(flags, 'commit');
      verifyCiCompleted(runner, workflow, commit);
      return 0;
    }

    if (command === 'extract-platform-artifact') {
      const platform = requireFlag(flags, 'platform');
      const artifactsDir = resolve(flags.artifacts ?? 'platform-artifacts');
      const outDir = resolve(flags.out ?? 'packages');
      extractPlatformArtifact(runner, platform, artifactsDir, outDir);
      return 0;
    }

    if (command === 'npm-pack') {
      createNpmTarball(runner, env, process.cwd());
      return 0;
    }

    if (command === 'prepublish-smoke-test') {
      const platform = requireFlag(flags, 'platform');
      const tarball = requireFlag(flags, 'tarball');
      const packagesDir = resolve(flags.packages ?? 'packages');
      prepublishSmokeTest(runner, platform, tarball, packagesDir);
      return 0;
    }

    if (command === 'extract-platform-packages') {
      const platforms = parsePlatforms(requireFlag(flags, 'platforms'));
      const artifactsDir = resolve(flags.artifacts ?? 'platform-artifacts');
      const outDir = resolve(flags.out ?? 'packages');
      extractAndVerifyPlatformPackages(runner, platforms, artifactsDir, outDir);
      return 0;
    }

    if (command === 'publish-platform-packages') {
      const platforms = parsePlatforms(requireFlag(flags, 'platforms'));
      const packagesDir = resolve(flags.packages ?? 'packages');
      publishPlatformPackages(runner, platforms, packagesDir);
      return 0;
    }

    if (command === 'resolve-release-version') {
      const version = resolveReleaseVersion(env);
      writeGithubOutput(env, 'version', version);
      return 0;
    }

    if (command === 'smoke-test-registry') {
      const platform = requireFlag(flags, 'platform');
      const version = requireFlag(flags, 'version');
      smokeTestRegistry(runner, platform, version);
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
