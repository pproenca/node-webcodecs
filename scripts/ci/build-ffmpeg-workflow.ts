#!/usr/bin/env tsx
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {isMainModule} from '../shared/runtime';
import {parseArgs, requireFlag} from '../shared/args';
import {findFirstFile, listDirectories} from './fs-utils';
import {writeGithubOutput} from './github';
import {DEFAULT_RUNNER, runShellScript, type CommandRunner} from './runner';

interface DockerExtractOptions {
  readonly image: string;
  readonly container: string;
  readonly platform: string;
  readonly artifactsDir: string;
  readonly lddMode: 'musl' | 'glibc';
}

interface PackageArtifactsOptions {
  readonly artifactsDir: string;
  readonly platform: string;
}

interface MacosPackageOptions {
  readonly targetDir: string;
  readonly artifactsDir: string;
  readonly arch: string;
}

const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$/;
const PLATFORM_ORDER = ['linux-x64', 'linux-x64-glibc', 'darwin-x64', 'darwin-arm64'];

function ensureDir(pathname: string): void {
  mkdirSync(pathname, {recursive: true});
}

function resolveVersionFromRef(refName: string): string {
  const raw = refName.startsWith('v') ? refName.slice(1) : refName;
  if (!SEMVER_PATTERN.test(raw)) {
    return '0.0.0-dev';
  }
  return raw;
}

function parsePlatform(platform: string): {os: string; cpu: string} {
  const parts = platform.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid platform string: ${platform}`);
  }
  return {os: parts[0], cpu: parts[1]};
}

function buildPlatformPackageJson(
  scope: string,
  platform: string,
  version: string,
): Record<string, unknown> {
  const {os, cpu} = parsePlatform(platform);
  return {
    name: `${scope}-${platform}`,
    version,
    description: `FFmpeg static binary for ${platform}`,
    os: [os],
    cpu: [cpu],
    files: ['bin/'],
    license: 'GPL-2.0-or-later',
    repository: {
      type: 'git',
      url: 'https://github.com/pproenca/node-webcodecs',
    },
  };
}

function buildMainPackageJson(scope: string, version: string): Record<string, unknown> {
  return {
    name: scope,
    version,
    description: 'FFmpeg static binaries for Node.js',
    main: 'index.js',
    types: 'index.d.ts',
    scripts: {
      postinstall: 'node install.js',
    },
    optionalDependencies: {
      [`${scope}-linux-x64`]: version,
      [`${scope}-darwin-x64`]: version,
      [`${scope}-darwin-arm64`]: version,
    },
    license: 'GPL-2.0-or-later',
    repository: {
      type: 'git',
      url: 'https://github.com/pproenca/node-webcodecs',
    },
    keywords: ['ffmpeg', 'video', 'audio', 'encoding', 'webcodecs'],
    engines: {
      node: '>=16',
    },
  };
}

function buildIndexJs(scope: string): string {
  return `
const path = require('path');
const { execSync, spawn } = require('child_process');

const PLATFORMS = {
  'darwin-arm64': '${scope}-darwin-arm64',
  'darwin-x64': '${scope}-darwin-x64',
  'linux-x64': '${scope}-linux-x64',
};

function getBinaryPath(binary = 'ffmpeg') {
  const platform = \`\${process.platform}-\${process.arch}\`;
  const pkg = PLATFORMS[platform];

  if (!pkg) {
    throw new Error(
      \`Unsupported platform: \${platform}. \` +
      \`Supported: \${Object.keys(PLATFORMS).join(', ')}\`
    );
  }

  try {
    const pkgPath = require.resolve(\`\${pkg}/package.json\`);
    return path.join(path.dirname(pkgPath), 'bin', binary);
  } catch (e) {
    throw new Error(
      \`Binary package \${pkg} not found. \` +
      \`Run: npm install --include=optional\`
    );
  }
}

function ffmpeg(args, options = {}) {
  const binary = getBinaryPath('ffmpeg');
  if (typeof args === 'string') {
    return execSync(\`"\${binary}" \${args}\`, { encoding: 'utf8', ...options });
  }
  return spawn(binary, args, options);
}

function ffprobe(args, options = {}) {
  const binary = getBinaryPath('ffprobe');
  if (typeof args === 'string') {
    return execSync(\`"\${binary}" \${args}\`, { encoding: 'utf8', ...options });
  }
  return spawn(binary, args, options);
}

module.exports = {
  getBinaryPath,
  ffmpegPath: getBinaryPath('ffmpeg'),
  ffprobePath: getBinaryPath('ffprobe'),
  ffmpeg,
  ffprobe,
};
`.trimStart();
}

function buildIndexDts(): string {
  return `
import { SpawnOptions, ChildProcess, ExecSyncOptions } from 'child_process';

export function getBinaryPath(binary?: 'ffmpeg' | 'ffprobe'): string;
export const ffmpegPath: string;
export const ffprobePath: string;

export function ffmpeg(args: string, options?: ExecSyncOptions): string;
export function ffmpeg(args: string[], options?: SpawnOptions): ChildProcess;

export function ffprobe(args: string, options?: ExecSyncOptions): string;
export function ffprobe(args: string[], options?: SpawnOptions): ChildProcess;
`.trimStart();
}

function buildInstallJs(): string {
  return `
const { getBinaryPath } = require('./index');
const { execSync } = require('child_process');

try {
  const ffmpegPath = getBinaryPath('ffmpeg');
  const version = execSync(\`"\${ffmpegPath}" -version\`, { encoding: 'utf8' });
  console.log('FFmpeg binary verified:', ffmpegPath);
  console.log(version.split('\\n')[0]);
} catch (e) {
  console.warn('Warning: FFmpeg binary not found for this platform');
  console.warn(e.message);
}
`.trimStart();
}

function rewritePkgConfigContent(content: string, originalPrefix: string): string {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal pkg-config variable token
  const prefixToken = '${prefix}';
  return content
    .split('\n')
    .map(line => {
      if (line.startsWith('prefix=')) {
        return line;
      }
      if (line.startsWith(`libdir=${originalPrefix}/lib`)) {
        return `libdir=${prefixToken}/lib`;
      }
      if (line.startsWith(`includedir=${originalPrefix}/include`)) {
        return `includedir=${prefixToken}/include`;
      }
      if (line.startsWith(`libdir=${originalPrefix}`)) {
        return `libdir=${prefixToken}`;
      }
      if (line.startsWith(`includedir=${originalPrefix}`)) {
        return `includedir=${prefixToken}`;
      }
      return line.replaceAll(originalPrefix, prefixToken);
    })
    .join('\n');
}

function rewritePkgConfigFiles(platformDir: string): void {
  const pkgConfigDir = join(platformDir, 'lib', 'pkgconfig');
  if (!existsSync(pkgConfigDir)) {
    return;
  }
  const entries = readdirSync(pkgConfigDir);
  for (const entry of entries) {
    if (!entry.endsWith('.pc')) {
      continue;
    }
    const pcPath = join(pkgConfigDir, entry);
    const content = readFileSync(pcPath, 'utf8');
    const prefixLine = content.split('\n').find(line => line.startsWith('prefix='));
    if (!prefixLine) {
      continue;
    }
    const originalPrefix = prefixLine.slice('prefix='.length);
    if (!originalPrefix) {
      continue;
    }
    const updated = rewritePkgConfigContent(content, originalPrefix);
    writeFileSync(pcPath, updated);
  }
}

export function extractDockerArtifacts(
  runner: CommandRunner,
  options: DockerExtractOptions,
): void {
  const targetDir = resolve(options.artifactsDir, options.platform);
  ensureDir(join(targetDir, 'bin'));
  ensureDir(join(targetDir, 'lib'));
  ensureDir(join(targetDir, 'include'));

  runner.runOrThrow('docker', ['create', '--name', options.container, options.image], {
    stdio: 'inherit',
  });

  runner.runOrThrow('docker', [
    'cp',
    `${options.container}:/build/bin/ffmpeg`,
    join(targetDir, 'bin', 'ffmpeg'),
  ]);
  runner.runOrThrow('docker', [
    'cp',
    `${options.container}:/build/bin/ffprobe`,
    join(targetDir, 'bin', 'ffprobe'),
  ]);
  runner.runOrThrow('docker', [
    'cp',
    `${options.container}:/build/lib/.`,
    join(targetDir, 'lib'),
  ]);
  runner.runOrThrow('docker', [
    'cp',
    `${options.container}:/build/include/.`,
    join(targetDir, 'include'),
  ]);

  runner.run('docker', ['rm', '-f', options.container]);

  const ffmpegPath = join(targetDir, 'bin', 'ffmpeg');
  if (!existsSync(ffmpegPath)) {
    throw new Error('ffmpeg binary not extracted from container');
  }

  runner.runOrThrow('file', [ffmpegPath], {stdio: 'inherit'});

  const lddResult = runner.run('ldd', [ffmpegPath]);
  if (options.lddMode === 'musl') {
    if (lddResult.exitCode === 0) {
      console.log('Warning: binary may have dynamic deps');
    }
  } else if (lddResult.exitCode !== 0) {
    console.log('Note: ldd may fail if glibc versions differ');
  }

  chmodSync(ffmpegPath, 0o755);
  const versionResult = runner.run(ffmpegPath, ['-version']);
  writeFileSync(join(targetDir, 'version.txt'), `${versionResult.stdout}${versionResult.stderr}`);

  runner.runOrThrow('ls', ['-la', join(targetDir, 'lib')], {stdio: 'inherit'});
  const pkgconfigDir = join(targetDir, 'lib', 'pkgconfig');
  if (existsSync(pkgconfigDir)) {
    runner.runOrThrow('ls', ['-la', pkgconfigDir], {stdio: 'inherit'});
  }
}

export function packageArtifacts(
  runner: CommandRunner,
  options: PackageArtifactsOptions,
): void {
  const artifactsRoot = resolve(options.artifactsDir);
  runner.runOrThrow('tar', ['-cvf', `${options.platform}.tar`, `${options.platform}/`], {
    cwd: artifactsRoot,
    stdio: 'inherit',
  });
}

export function installMacosDependencies(runner: CommandRunner): void {
  runner.runOrThrow('brew', ['install', 'autoconf', 'automake', 'libtool', 'nasm', 'cmake', 'pkg-config'], {
    stdio: 'inherit',
  });
}

export function buildMacosCodecs(runner: CommandRunner, env: NodeJS.ProcessEnv): void {
  if (!env.TARGET || !env.ARCH || !env.MACOS_DEPLOYMENT_TARGET) {
    throw new Error('TARGET, ARCH, and MACOS_DEPLOYMENT_TARGET must be set');
  }
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const script = `
set -e
export PATH="$TARGET/bin:$PATH"
export PKG_CONFIG_PATH="$TARGET/lib/pkgconfig"
mkdir -p "$TARGET"/{include,lib,bin}
mkdir -p "${workspace}/ffmpeg_sources" && cd "${workspace}/ffmpeg_sources"

rm -rf x264 x265_git libvpx aom aom_build opus-* lame-* nasm-*

echo "=== Building nasm ==="
NASM_URL="https://github.com/netwide-assembler/nasm/archive/refs/tags/nasm-${env.NASM_VERSION}.tar.gz"

echo "Downloading NASM from GitHub..."
curl -fSL --retry 3 --retry-delay 5 "$NASM_URL" -o nasm.tar.gz || {
  echo "ERROR: Failed to download NASM from $NASM_URL"
  exit 1
}

echo "${env.NASM_SHA256}  nasm.tar.gz" | shasum -a 256 -c - || {
  echo "ERROR: NASM checksum verification failed!"
  echo "Expected: ${env.NASM_SHA256}"
  echo "Got:      $(shasum -a 256 nasm.tar.gz | cut -d' ' -f1)"
  exit 1
}
echo "NASM checksum verified"

tar xzf nasm.tar.gz
cd nasm-nasm-${env.NASM_VERSION}
./autogen.sh
./configure --prefix="$TARGET"
make -j$(sysctl -n hw.ncpu)
mkdir -p "$TARGET/bin"
install -c nasm ndisasm "$TARGET/bin/"
cd ..

echo "=== Building x264 (GPL) ==="
git clone --depth 1 --branch ${env.X264_VERSION} https://code.videolan.org/videolan/x264.git
cd x264
./configure \
  --prefix="$TARGET" \
  --enable-static \
  --disable-shared \
  --enable-pic \
  --disable-cli \
  --extra-cflags="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
  --extra-ldflags="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}"
make -j$(sysctl -n hw.ncpu)
make install
cd ..

echo "=== Building x265 (GPL) ==="
git clone --depth 1 https://bitbucket.org/multicoreware/x265_git.git
mkdir -p x265_git/build/xcode && cd x265_git/build/xcode
cmake \
  -DCMAKE_INSTALL_PREFIX="$TARGET" \
  -DLIB_INSTALL_DIR="$TARGET/lib" \
  -DENABLE_SHARED=OFF \
  -DENABLE_CLI=OFF \
  -DCMAKE_OSX_ARCHITECTURES=$ARCH \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=${env.MACOS_DEPLOYMENT_TARGET} \
  ../../source
make -j$(sysctl -n hw.ncpu)
make install
mkdir -p "$TARGET/lib/pkgconfig"
cat > "$TARGET/lib/pkgconfig/x265.pc" << PCEOF
prefix=$TARGET
exec_prefix=\${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include

Name: x265
Description: H.265/HEVC video encoder
Version: 3.6
Libs: -L\${libdir} -lx265
Libs.private: -lc++ -lm -lpthread
Cflags: -I\${includedir}
PCEOF
cd ../../..

echo "=== Building libvpx (BSD) ==="
git clone --depth 1 --branch ${env.LIBVPX_VERSION} https://chromium.googlesource.com/webm/libvpx.git
cd libvpx
DARWIN_VERSION=$(uname -r | cut -d. -f1)
if [ "$ARCH" = "arm64" ]; then
  VPX_TARGET="arm64-darwin${DARWIN_VERSION}-gcc"
else
  VPX_TARGET="x86_64-darwin${DARWIN_VERSION}-gcc"
fi
echo "Using libvpx target: $VPX_TARGET"
LDFLAGS="-mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
./configure \
  --prefix="$TARGET" \
  --target=$VPX_TARGET \
  --enable-vp8 \
  --enable-vp9 \
  --disable-examples \
  --disable-unit-tests \
  --enable-vp9-highbitdepth \
  --enable-static \
  --disable-shared \
  --extra-cflags="-mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}"
make -j$(sysctl -n hw.ncpu)
make install
cd ..

echo "=== Building libaom (AV1, BSD) ==="
git clone --depth 1 --branch ${env.LIBAOM_VERSION} https://aomedia.googlesource.com/aom
mkdir aom_build && cd aom_build
cmake \
  -DCMAKE_INSTALL_PREFIX="$TARGET" \
  -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_DOCS=OFF \
  -DENABLE_EXAMPLES=OFF \
  -DENABLE_TESTS=OFF \
  -DCMAKE_OSX_ARCHITECTURES=$ARCH \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=${env.MACOS_DEPLOYMENT_TARGET} \
  ../aom
make -j$(sysctl -n hw.ncpu)
make install
cd ..

echo "=== Building libopus (BSD) ==="
curl -fSL --retry 3 https://downloads.xiph.org/releases/opus/opus-${env.OPUS_VERSION}.tar.gz -o opus.tar.gz || {
  echo "ERROR: Failed to download Opus from xiph.org"
  exit 1
}

echo "${env.OPUS_SHA256}  opus.tar.gz" | shasum -a 256 -c - || {
  echo "ERROR: Opus checksum verification failed!"
  echo "Expected: ${env.OPUS_SHA256}"
  echo "Got:      $(shasum -a 256 opus.tar.gz | cut -d' ' -f1)"
  exit 1
}
echo "Opus checksum verified"

tar xzf opus.tar.gz
cd opus-${env.OPUS_VERSION}
./configure \
  --prefix="$TARGET" \
  --disable-shared \
  --enable-static \
  CFLAGS="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
  LDFLAGS="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}"
make -j$(sysctl -n hw.ncpu)
make install
cd ..

echo "=== Building libmp3lame (LGPL) ==="
curl -fSL --retry 3 "https://downloads.sourceforge.net/project/lame/lame/${env.LAME_VERSION}/lame-${env.LAME_VERSION}.tar.gz" -o lame.tar.gz || {
  echo "ERROR: Failed to download LAME from SourceForge"
  exit 1
}

echo "${env.LAME_SHA256}  lame.tar.gz" | shasum -a 256 -c - || {
  echo "ERROR: LAME checksum verification failed!"
  echo "Expected: ${env.LAME_SHA256}"
  echo "Got:      $(shasum -a 256 lame.tar.gz | cut -d' ' -f1)"
  exit 1
}
echo "LAME checksum verified"

tar xzf lame.tar.gz
cd lame-${env.LAME_VERSION}
./configure \
  --prefix="$TARGET" \
  --disable-shared \
  --enable-static \
  --enable-nasm \
  CFLAGS="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
  LDFLAGS="-arch $ARCH -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}"
make -j$(sysctl -n hw.ncpu)
make install
cd ..
`;
  runShellScript(runner, script, {env, stdio: 'inherit'});
}

export function buildMacosFfmpeg(runner: CommandRunner, env: NodeJS.ProcessEnv): void {
  if (!env.TARGET || !env.ARCH || !env.MACOS_DEPLOYMENT_TARGET) {
    throw new Error('TARGET, ARCH, and MACOS_DEPLOYMENT_TARGET must be set');
  }
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const script = `
set -e
export PATH="$TARGET/bin:$PATH"
export PKG_CONFIG_PATH="$TARGET/lib/pkgconfig"

mkdir -p "${workspace}/ffmpeg_sources"
cd "${workspace}/ffmpeg_sources"

if [ ! -d ffmpeg ]; then
  for i in 1 2 3; do
    git clone --depth 1 https://github.com/FFmpeg/FFmpeg.git ffmpeg && break
    echo "Clone attempt $i failed, retrying in 10s..."
    sleep 10
  done
  if [ ! -d ffmpeg ]; then
    echo "ERROR: Failed to clone FFmpeg after 3 attempts"
    exit 1
  fi
fi

cd ffmpeg
make distclean 2>/dev/null || true

./configure \
  --cc="clang -arch $ARCH" \
  --prefix="$TARGET" \
  --extra-cflags="-I$TARGET/include -fno-stack-check -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
  --extra-ldflags="-L$TARGET/lib -mmacosx-version-min=${env.MACOS_DEPLOYMENT_TARGET}" \
  --pkg-config-flags="--static" \
  --enable-static \
  --disable-shared \
  --enable-gpl \
  --enable-version3 \
  --enable-pthreads \
  --enable-runtime-cpudetect \
  --disable-ffplay \
  --disable-doc \
  --disable-debug \
  --enable-libx264 \
  --enable-libx265 \
  --enable-libvpx \
  --enable-libaom \
  --enable-libopus \
  --enable-libmp3lame

make -j$(sysctl -n hw.ncpu)
make install
`;
  runShellScript(runner, script, {env, stdio: 'inherit'});
}

export function verifyMacosTargets(runner: CommandRunner, env: NodeJS.ProcessEnv): void {
  const root = env.TARGET;
  if (!root) {
    throw new Error('TARGET must be set to verify macOS ABI');
  }
  runner.runOrThrow(
    'npx',
    ['tsx', 'scripts/check-macos-abi.ts'],
    {env: {...env, FFMPEG_ROOT: root}, stdio: 'inherit'},
  );
}

export function verifyAndStripMacosBinaries(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
): void {
  if (!env.TARGET) {
    throw new Error('TARGET must be set');
  }
  const targetDir = env.TARGET;
  const ffmpegPath = join(targetDir, 'bin', 'ffmpeg');
  const ffprobePath = join(targetDir, 'bin', 'ffprobe');

  runner.runOrThrow('otool', ['-L', ffmpegPath], {stdio: 'inherit'});
  const depsOutput = runner.run('otool', ['-L', ffmpegPath]);
  const deps = depsOutput.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.includes('libSystem') && !line.endsWith(':'));
  if (deps.length > 0) {
    console.log('Warning: Found unexpected dynamic dependencies');
    for (const line of deps) {
      console.log(line);
    }
  }

  runner.runOrThrow('strip', [ffmpegPath], {stdio: 'inherit'});
  runner.runOrThrow('strip', [ffprobePath], {stdio: 'inherit'});
  runner.runOrThrow('ls', ['-lh', ffmpegPath, ffprobePath], {stdio: 'inherit'});
  runner.runOrThrow(ffmpegPath, ['-version'], {stdio: 'inherit'});
}

export function packageMacosArtifacts(
  runner: CommandRunner,
  options: MacosPackageOptions,
): void {
  const platform = `darwin-${options.arch}`;
  const outputDir = resolve(options.artifactsDir, platform);
  ensureDir(join(outputDir, 'bin'));
  ensureDir(join(outputDir, 'lib'));
  ensureDir(join(outputDir, 'include'));

  const ffmpegPath = join(options.targetDir, 'bin', 'ffmpeg');
  const ffprobePath = join(options.targetDir, 'bin', 'ffprobe');
  copyFileSync(ffmpegPath, join(outputDir, 'bin', 'ffmpeg'));
  copyFileSync(ffprobePath, join(outputDir, 'bin', 'ffprobe'));

  const versionResult = runner.run(ffmpegPath, ['-version']);
  writeFileSync(join(outputDir, 'version.txt'), `${versionResult.stdout}${versionResult.stderr}`);

  const libDir = join(options.targetDir, 'lib');
  const includeDir = join(options.targetDir, 'include');
  runner.runOrThrow('cp', ['-r', `${libDir}/`, `${outputDir}/lib/`], {stdio: 'inherit'});
  runner.runOrThrow('cp', ['-r', `${includeDir}/`, `${outputDir}/include/`], {stdio: 'inherit'});
  runner.runOrThrow('ls', ['-la', join(outputDir, 'lib')], {stdio: 'inherit'});
  runner.runOrThrow('ls', ['-la', join(outputDir, 'lib', 'pkgconfig')], {stdio: 'inherit'});

  runner.runOrThrow('tar', ['-cvf', `${platform}.tar`, `${platform}/`], {
    cwd: resolve(options.artifactsDir),
    stdio: 'inherit',
  });
}

export function extractAndPackageNpm(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  artifactsDir: string,
  packagesDir: string,
): void {
  const scope = env.NPM_SCOPE ?? '@pproenca/ffmpeg';
  const refName = env.GITHUB_REF_NAME ?? '';
  const version = resolveVersionFromRef(refName);

  ensureDir(packagesDir);

  const artifactDirs = listDirectories(artifactsDir).filter(dir => basename(dir).startsWith('ffmpeg-'));
  for (const artifactDir of artifactDirs) {
    const tarball = findFirstFile(artifactDir, pathname => pathname.endsWith('.tar'));
    if (tarball) {
      runner.runOrThrow('tar', ['-xvf', tarball, '-C', artifactDir], {stdio: 'inherit'});
    }

    const platform = basename(artifactDir).replace('ffmpeg-', '');
    const srcDir = join(artifactDir, platform);
    const ffmpegPath = join(srcDir, 'bin', 'ffmpeg');
    if (!existsSync(ffmpegPath)) {
      console.log(`Warning: Skipping ${platform} - binary not found at ${ffmpegPath}`);
      continue;
    }

    const pkgDir = resolve(packagesDir, `${scope}-${platform}`);
    ensureDir(join(pkgDir, 'bin'));
    copyFileSync(join(srcDir, 'bin', 'ffmpeg'), join(pkgDir, 'bin', 'ffmpeg'));
    copyFileSync(join(srcDir, 'bin', 'ffprobe'), join(pkgDir, 'bin', 'ffprobe'));
    chmodSync(join(pkgDir, 'bin', 'ffmpeg'), 0o755);
    chmodSync(join(pkgDir, 'bin', 'ffprobe'), 0o755);

    const pkgJson = buildPlatformPackageJson(scope, platform, version);
    writeFileSync(join(pkgDir, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`);
    console.log(`Created package: ${pkgDir}`);
  }
}

export function createMainNpmPackage(
  env: NodeJS.ProcessEnv,
  packagesDir: string,
): void {
  const scope = env.NPM_SCOPE ?? '@pproenca/ffmpeg';
  const version = resolveVersionFromRef(env.GITHUB_REF_NAME ?? '');
  const mainDir = resolve(packagesDir, scope);
  ensureDir(mainDir);

  const pkgJson = buildMainPackageJson(scope, version);
  writeFileSync(join(mainDir, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`);
  writeFileSync(join(mainDir, 'index.js'), buildIndexJs(scope));
  writeFileSync(join(mainDir, 'index.d.ts'), buildIndexDts());
  writeFileSync(join(mainDir, 'install.js'), buildInstallJs());
}

export function publishFfmpegPackages(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  packagesDir: string,
): void {
  const scope = env.NPM_SCOPE ?? '@pproenca/ffmpeg';
  const packageDirs = listDirectories(packagesDir).filter(dir => basename(dir).startsWith(`${scope}-`));
  for (const dir of packageDirs) {
    runner.runOrThrow('npm', ['publish', '--access', 'public', '--provenance'], {
      cwd: dir,
      stdio: 'inherit',
    });
  }
  runner.runOrThrow('sleep', ['10']);

  const mainDir = resolve(packagesDir, scope);
  runner.runOrThrow('npm', ['publish', '--access', 'public', '--provenance'], {
    cwd: mainDir,
    stdio: 'inherit',
  });
}

export function prepareReleaseAssets(
  runner: CommandRunner,
  env: NodeJS.ProcessEnv,
  artifactsDir: string,
  releaseDir: string,
): void {
  const refName = env.GITHUB_REF_NAME ?? '';
  ensureDir(releaseDir);

  const artifactDirs = listDirectories(artifactsDir).filter(dir => basename(dir).startsWith('ffmpeg-'));
  for (const artifactDir of artifactDirs) {
    const tarball = findFirstFile(artifactDir, pathname => pathname.endsWith('.tar'));
    if (!tarball) {
      continue;
    }
    const platform = basename(artifactDir).replace('ffmpeg-', '');
    runner.runOrThrow('tar', ['-xf', tarball, '-C', artifactsDir], {stdio: 'inherit'});

    const platformDir = resolve(artifactsDir, platform);
    const binDir = join(platformDir, 'bin');
    if (existsSync(binDir)) {
      renameSync(join(binDir, 'ffmpeg'), join(platformDir, 'ffmpeg'));
      renameSync(join(binDir, 'ffprobe'), join(platformDir, 'ffprobe'));
      rmSync(binDir, {recursive: true, force: true});
      rmSync(join(platformDir, 'lib'), {recursive: true, force: true});
      rmSync(join(platformDir, 'include'), {recursive: true, force: true});
    }

    runner.runOrThrow(
      'tar',
      ['-czvf', join(releaseDir, `ffmpeg-${refName}-${platform}.tar.gz`), `${platform}/`],
      {cwd: artifactsDir, stdio: 'inherit'},
    );
  }
  runner.runOrThrow('ls', ['-la', releaseDir], {stdio: 'inherit'});
}

export function resolveDepsVersion(inputVersion: string | undefined, refName: string): string {
  if (inputVersion) {
    return inputVersion;
  }
  return refName.startsWith('deps-') ? refName.slice('deps-'.length) : refName;
}

export function prepareDepsReleaseAssets(
  runner: CommandRunner,
  artifactsDir: string,
  releaseDir: string,
): void {
  ensureDir(releaseDir);
  const artifactDirs = listDirectories(artifactsDir).filter(dir => basename(dir).startsWith('ffmpeg-'));
  for (const artifactDir of artifactDirs) {
    const tarball = findFirstFile(artifactDir, pathname => pathname.endsWith('.tar'));
    if (!tarball) {
      continue;
    }
    const platform = basename(artifactDir).replace('ffmpeg-', '');
    runner.runOrThrow('tar', ['-xf', tarball, '-C', artifactsDir], {stdio: 'inherit'});
    const platformDir = resolve(artifactsDir, platform);
    const libDir = join(platformDir, 'lib');
    if (!existsSync(libDir)) {
      throw new Error(`Missing lib/ directory for ${platform}`);
    }
    rewritePkgConfigFiles(platformDir);

    runner.runOrThrow(
      'tar',
      ['-czvf', join(releaseDir, `ffmpeg-${platform}.tar.gz`), 'lib/', 'include/', 'bin/', 'version.txt'],
      {cwd: platformDir, stdio: 'inherit'},
    );
  }

  runner.runOrThrow('ls', ['-la', releaseDir], {stdio: 'inherit'});
  for (const platform of PLATFORM_ORDER) {
    const path = join(releaseDir, `ffmpeg-${platform}.tar.gz`);
    if (!existsSync(path)) {
      throw new Error(`Missing ffmpeg-${platform}.tar.gz`);
    }
    runner.runOrThrow('tar', ['-tzf', path], {stdio: 'inherit'});
  }
  console.log('All platform artifacts verified.');
}

export function main(
  args: string[],
  runner: CommandRunner = DEFAULT_RUNNER,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const {positional, flags} = parseArgs(args);
  const command = positional[0];

  try {
    if (command === 'extract-docker') {
      const image = requireFlag(flags, 'image');
      const container = requireFlag(flags, 'container');
      const platform = requireFlag(flags, 'platform');
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      const lddMode = (flags.ldd as 'musl' | 'glibc') ?? 'musl';
      extractDockerArtifacts(runner, {image, container, platform, artifactsDir, lddMode});
      return 0;
    }

    if (command === 'package-artifacts') {
      const platform = requireFlag(flags, 'platform');
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      packageArtifacts(runner, {platform, artifactsDir});
      return 0;
    }

    if (command === 'install-macos-deps') {
      installMacosDependencies(runner);
      return 0;
    }

    if (command === 'build-macos-codecs') {
      buildMacosCodecs(runner, env);
      return 0;
    }

    if (command === 'build-macos-ffmpeg') {
      buildMacosFfmpeg(runner, env);
      return 0;
    }

    if (command === 'verify-macos-abi') {
      verifyMacosTargets(runner, env);
      return 0;
    }

    if (command === 'verify-strip') {
      verifyAndStripMacosBinaries(runner, env);
      return 0;
    }

    if (command === 'package-macos') {
      const targetDir = requireFlag(flags, 'target');
      const arch = requireFlag(flags, 'arch');
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      packageMacosArtifacts(runner, {targetDir, artifactsDir, arch});
      return 0;
    }

    if (command === 'extract-package-npm') {
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      const packagesDir = resolve(flags.packages ?? 'packages');
      extractAndPackageNpm(runner, env, artifactsDir, packagesDir);
      return 0;
    }

    if (command === 'create-main-package') {
      const packagesDir = resolve(flags.packages ?? 'packages');
      createMainNpmPackage(env, packagesDir);
      return 0;
    }

    if (command === 'publish-npm') {
      const packagesDir = resolve(flags.packages ?? 'packages');
      publishFfmpegPackages(runner, env, packagesDir);
      return 0;
    }

    if (command === 'prepare-release-assets') {
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      const releaseDir = resolve(flags.release ?? 'release');
      prepareReleaseAssets(runner, env, artifactsDir, releaseDir);
      return 0;
    }

    if (command === 'resolve-deps-version') {
      const inputVersion = flags.input;
      const refName = requireFlag(flags, 'ref');
      const version = resolveDepsVersion(inputVersion, refName);
      writeGithubOutput(env, 'version', version);
      return 0;
    }

    if (command === 'prepare-deps-assets') {
      const artifactsDir = resolve(flags.artifacts ?? 'artifacts');
      const releaseDir = resolve(flags.release ?? 'release');
      prepareDepsReleaseAssets(runner, artifactsDir, releaseDir);
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
