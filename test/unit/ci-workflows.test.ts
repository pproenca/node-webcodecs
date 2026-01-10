import * as assert from 'node:assert';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import type {CommandResult} from '../../scripts/shared/exec';
import type {CommandRunner} from '../../scripts/ci/runner';
import {writeGithubEnv, writeGithubOutput} from '../../scripts/ci/github';
import {
  installFfmpeg,
  resolvePackageVersion,
  runPrebuildify,
} from '../../scripts/ci/ci-workflow';
import {
  createNpmTarball,
  extractAndVerifyPlatformPackages,
  resolveReleaseVersion,
  verifyCiCompleted,
} from '../../scripts/ci/release-workflow';

interface RecordedCall {
  readonly command: string;
  readonly args: string[];
}

function createTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'node-webcodecs-ci-'));
}

function okResult(stdout = ''): CommandResult {
  return {stdout, stderr: '', exitCode: 0};
}

function createRunner(responses: CommandResult[]): {runner: CommandRunner; calls: RecordedCall[]} {
  let index = 0;
  const calls: RecordedCall[] = [];

  function next(): CommandResult {
    if (index >= responses.length) {
      throw new Error('No more responses configured');
    }
    const result = responses[index];
    index += 1;
    return result;
  }

  const runner: CommandRunner = {
    run: (command, args) => {
      calls.push({command, args});
      return next();
    },
    runOrThrow: (command, args) => {
      calls.push({command, args});
      const result = next();
      if (result.exitCode !== 0) {
        throw new Error(`Command failed: ${command}`);
      }
      return result;
    },
  };

  return {runner, calls};
}

test('writeGithubOutput appends to the output file', () => {
  const root = createTempRoot();
  const outputFile = join(root, 'output.txt');
  const env = {GITHUB_OUTPUT: outputFile};
  writeGithubOutput(env, 'version', 'v10');
  const contents = readFileSync(outputFile, 'utf8');
  assert.strictEqual(contents, 'version=v10\n');
});

test('writeGithubEnv throws when env var missing', () => {
  assert.throws(() => writeGithubEnv({}, 'FFMPEG_ROOT', '/tmp/ffmpeg'));
});

test('resolvePackageVersion rejects invalid package.json versions', () => {
  const root = createTempRoot();
  writeFileSync(join(root, 'package.json'), JSON.stringify({version: 'not-a-version'}));
  assert.throws(() => resolvePackageVersion(root));
});

test('runPrebuildify renames the scoped prebuild when needed', () => {
  const root = createTempRoot();
  const originalCwd = process.cwd();
  process.chdir(root);
  try {
    const prebuildDir = join(root, 'prebuilds', 'linux-x64');
    mkdirSync(prebuildDir, {recursive: true});
    writeFileSync(join(prebuildDir, '@scope+demo.node'), 'binary');

    const {runner} = createRunner([okResult()]);
    runPrebuildify(runner, {arch: 'x64', platform: 'linux-x64'});

    assert.ok(readFileSync(join(prebuildDir, 'node.napi.node')));
  } finally {
    process.chdir(originalCwd);
  }
});

test('installFfmpeg installs correct package for linux-x64-glibc', () => {
  const root = createTempRoot();
  const envFile = join(root, 'env.txt');
  const ffmpegDir = join(root, 'node_modules', '@pproenca', 'webcodecs-ffmpeg-dev-linux-x64-non-free');
  mkdirSync(join(ffmpegDir, 'lib', 'pkgconfig'), {recursive: true});
  mkdirSync(join(ffmpegDir, 'include'), {recursive: true});
  writeFileSync(join(ffmpegDir, 'package.json'), '{}');

  const {runner, calls} = createRunner([
    okResult(), // npm install
    okResult(join(ffmpegDir, 'package.json')), // node -e resolve
    okResult(), // ls lib
    okResult(), // ls pkgconfig
  ]);

  installFfmpeg(runner, {GITHUB_ENV: envFile}, {platform: 'linux-x64-glibc', variant: 'non-free'});

  // Verify npm install was called with correct package (linux-x64 not linux-x64-glibc)
  assert.strictEqual(calls[0].command, 'npm');
  assert.ok(calls[0].args.includes('@pproenca/webcodecs-ffmpeg-dev-linux-x64-non-free'));

  const contents = readFileSync(envFile, 'utf8');
  assert.ok(contents.includes('FFMPEG_ROOT='));
});

test('installFfmpeg installs lgpl variant when specified', () => {
  const root = createTempRoot();
  const envFile = join(root, 'env.txt');
  const ffmpegDir = join(root, 'node_modules', '@pproenca', 'webcodecs-ffmpeg-dev-darwin-arm64');
  mkdirSync(join(ffmpegDir, 'lib', 'pkgconfig'), {recursive: true});
  mkdirSync(join(ffmpegDir, 'include'), {recursive: true});
  writeFileSync(join(ffmpegDir, 'package.json'), '{}');

  const {runner, calls} = createRunner([
    okResult(), // npm install
    okResult(join(ffmpegDir, 'package.json')), // node -e resolve
    okResult(), // ls lib
    okResult(), // ls pkgconfig
  ]);

  installFfmpeg(runner, {GITHUB_ENV: envFile}, {platform: 'darwin-arm64', variant: 'lgpl'});

  // Verify npm install was called with LGPL package (no -non-free suffix)
  assert.strictEqual(calls[0].command, 'npm');
  assert.ok(calls[0].args.includes('@pproenca/webcodecs-ffmpeg-dev-darwin-arm64'));
  assert.ok(!calls[0].args.some(arg => arg.includes('-non-free')));
});

test('verifyCiCompleted throws when CI did not succeed', () => {
  const {runner} = createRunner([okResult('failure')]);
  assert.throws(() => verifyCiCompleted(runner, 'ci.yml', 'deadbeef'));
});

test('createNpmTarball writes PACKED_TGZ', () => {
  const root = createTempRoot();
  const tarball = join(root, 'demo.tgz');
  const envFile = join(root, 'env.txt');
  writeFileSync(tarball, 'tar');

  const {runner} = createRunner([okResult(), okResult()]);
  createNpmTarball(runner, {GITHUB_ENV: envFile}, root);
  const contents = readFileSync(envFile, 'utf8');
  assert.ok(contents.includes('PACKED_TGZ='));
});

test('extractAndVerifyPlatformPackages validates binaries', () => {
  const root = createTempRoot();
  const artifactsDir = join(root, 'platform-artifacts');
  const packagesDir = join(root, 'packages');
  const artifactDir = join(artifactsDir, 'platform-pkg-linux-x64');
  mkdirSync(artifactDir, {recursive: true});
  writeFileSync(join(artifactDir, 'pkg.tar'), 'tar');
  const binaryDir = join(packagesDir, '@pproenca', 'node-webcodecs-linux-x64', 'bin');
  const binaryPath = join(binaryDir, 'node.napi.node');
  mkdirSync(binaryDir, {recursive: true});
  writeFileSync(binaryPath, 'node');

  const {runner} = createRunner([okResult(), okResult()]);
  extractAndVerifyPlatformPackages(runner, ['linux-x64'], artifactsDir, packagesDir);
});

test('extractAndVerifyPlatformPackages throws when binary missing', () => {
  const root = createTempRoot();
  const artifactsDir = join(root, 'platform-artifacts');
  const packagesDir = join(root, 'packages');
  const artifactDir = join(artifactsDir, 'platform-pkg-linux-x64');
  mkdirSync(artifactDir, {recursive: true});
  writeFileSync(join(artifactDir, 'pkg.tar'), 'tar');

  const {runner} = createRunner([okResult(), okResult()]);
  assert.throws(() =>
    extractAndVerifyPlatformPackages(runner, ['linux-x64'], artifactsDir, packagesDir),
  );
});

test('resolveReleaseVersion extracts tag versions', () => {
  const version = resolveReleaseVersion({GITHUB_REF: 'refs/tags/v1.2.3'});
  assert.strictEqual(version, '1.2.3');
});

test('resolveReleaseVersion rejects non-tag refs', () => {
  assert.throws(() => resolveReleaseVersion({GITHUB_REF: 'refs/heads/main'}));
});
