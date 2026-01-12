import * as assert from 'node:assert';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {bumpVersion} from '../../scripts/bump-version';
import {createPlatformPackages} from '../../scripts/create-platform-packages';
import {
  compareVersions,
  normalizeVersion,
  parseTargetsFromOtool,
} from '../../scripts/check-macos-abi';
import {detectPlatform, parseArgs} from '../../scripts/setup-ffmpeg';
import {filterFrameworkFlags, getFfmpegRoot} from '../../gyp/ffmpeg-paths-lib';
import {main as platformPackageMain} from '../../scripts/ci/platform-package';

function createTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'node-webcodecs-'));
}

test('bumpVersion updates package.json', () => {
  const root = createTempRoot();
  const pkgPath = join(root, 'package.json');
  writeFileSync(pkgPath, JSON.stringify({name: 'demo', version: '0.1.0'}, null, 2));

  bumpVersion(root, '0.2.0');

  const updated = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version: string};
  assert.strictEqual(updated.version, '0.2.0');
});

test('createPlatformPackages writes platform package.json files', () => {
  const root = createTempRoot();
  writeFileSync(join(root, 'package.json'), JSON.stringify({name: 'demo', version: '1.2.3'}, null, 2));
  mkdirSync(join(root, 'packages'), {recursive: true});

  createPlatformPackages(root);

  const pkgPath = join(root, 'packages', '@pproenca', 'node-webcodecs-darwin-arm64', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version: string};
  assert.strictEqual(pkg.version, '1.2.3');

  const mainPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    optionalDependencies: Record<string, string>;
  };
  assert.strictEqual(mainPkg.optionalDependencies['@pproenca/node-webcodecs-darwin-arm64'], '1.2.3');
});

test('normalizeVersion and compareVersions handle macOS targets', () => {
  assert.strictEqual(normalizeVersion('15'), '15.0');
  assert.strictEqual(compareVersions('11.0', '15.0'), -1);
  assert.strictEqual(compareVersions('15.0', '11.0'), 1);
  assert.strictEqual(compareVersions('11.0', '11.0'), 0);
});

test('parseTargetsFromOtool extracts minos values', () => {
  const output = `cmd LC_BUILD_VERSION\n    minos 11.0\ncmd LC_BUILD_VERSION\n    minos 15\n`;
  const targets = parseTargetsFromOtool(output);
  assert.deepStrictEqual(targets.sort(), ['11.0', '15.0']);
});

test('detectPlatform maps OS and arch', () => {
  assert.strictEqual(detectPlatform('darwin', 'arm64'), 'darwin-arm64');
  assert.strictEqual(detectPlatform('darwin', 'x64'), 'darwin-x64');
  assert.strictEqual(detectPlatform('linux', 'x64'), 'linux-x64');
  assert.strictEqual(detectPlatform('linux', 'arm64'), null);
});

test('parseArgs maps platform and deps tag', () => {
  const parsed = parseArgs(['darwin-arm64', 'deps-v10']);
  assert.strictEqual(parsed.platform, 'darwin-arm64');
  assert.strictEqual(parsed.depsTag, 'deps-v10');
});

test('filterFrameworkFlags removes framework pairs', () => {
  const input = '-framework Metal -L/foo -lavcodec -framework CoreVideo';
  assert.strictEqual(filterFrameworkFlags(input), '-L/foo -lavcodec');
});

test('getFfmpegRoot resolves npm package or ffmpeg-install', () => {
  const root = createTempRoot();
  const pkgconfig = join(root, 'ffmpeg-install', 'lib', 'pkgconfig');
  mkdirSync(pkgconfig, {recursive: true});

  const result = getFfmpegRoot(root, {});
  assert.ok(result);
  // npm package takes precedence over ffmpeg-install when installed
  // Either npm package or ffmpeg-install is acceptable
  assert.ok(
    result?.root.includes('ffmpeg-install') || result?.root.includes('webcodecs-ffmpeg'),
    `Expected ffmpeg-install or npm package, got: ${result?.root}`
  );
});

test('platform-package main returns error for unknown mode', () => {
  const exitCode = platformPackageMain([]);
  assert.strictEqual(exitCode, 1);
});
