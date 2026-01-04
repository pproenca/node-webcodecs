// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.
//
// Resolution order:
// 1. FFMPEG_ROOT env var (set by CI from deps-v* release artifacts)
// 2. ./ffmpeg-install directory (local development)
// 3. System pkg-config (fallback)
//
// The FFmpeg static libraries are built from:
// - Linux: docker/Dockerfile.linux-x64 (Alpine musl, fully static)
// - macOS: .github/workflows/build-ffmpeg.yml (native build)
//
// All codec dependencies (x264, x265, vpx, opus, etc.) are resolved automatically
// via the .pc files in the FFmpeg build.
//
// CRITICAL: The --define-variable=prefix= flag relocates hardcoded paths in .pc files
// (e.g., /build → actual extraction path). Without this, pkg-config returns paths
// that don't exist on the build machine.
//
// IMPORTANT: macOS framework flags (-framework X) must be filtered out because
// node-gyp's <!@()> splits output by whitespace, breaking "-framework Metal" into
// two tokens. binding.gyp already explicitly adds required frameworks.

import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const FFMPEG_LIBS = 'libavcodec libavformat libavutil libswscale libswresample libavfilter';

export interface FfmpegRoot {
  readonly root: string;
  readonly pkgconfig: string;
}

export function filterFrameworkFlags(flags: string): string {
  const tokens = flags.split(/\s+/);
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '-framework') {
      i++;
      continue;
    }
    result.push(tokens[i]);
  }
  return result.join(' ');
}

export function getFfmpegRoot(projectRoot: string, env: NodeJS.ProcessEnv): FfmpegRoot | null {
  if (env.FFMPEG_ROOT) {
    const root = env.FFMPEG_ROOT;
    const pkgconfig = join(root, 'lib', 'pkgconfig');
    if (existsSync(pkgconfig)) {
      return {root, pkgconfig};
    }
  }

  const ffmpegInstall = join(projectRoot, 'ffmpeg-install');
  const pkgconfig = join(ffmpegInstall, 'lib', 'pkgconfig');
  if (existsSync(pkgconfig)) {
    return {root: ffmpegInstall, pkgconfig};
  }

  return null;
}

export function runPkgConfig(
  args: string,
  ffmpegRoot: string,
  pkgConfigPath: string,
  env: NodeJS.ProcessEnv,
): string | null {
  const mergedEnv = {...env, PKG_CONFIG_PATH: pkgConfigPath};
  const cmd = `pkg-config --define-variable=prefix="${ffmpegRoot}" ${args}`;

  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    if (env.DEBUG) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`pkg-config failed: ${message}`);
    }
    return null;
  }
}

export function resolveLibFlags(
  projectRoot: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): string | null {
  const ffmpeg = getFfmpegRoot(projectRoot, env);
  if (!ffmpeg) {
    return null;
  }
  const result = runPkgConfig(`--libs --static ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig, env);
  if (!result) {
    return null;
  }
  return platform === 'darwin' ? filterFrameworkFlags(result) : result;
}

export function resolveIncludeFlags(
  projectRoot: string,
  env: NodeJS.ProcessEnv,
): string | null {
  const ffmpeg = getFfmpegRoot(projectRoot, env);
  if (!ffmpeg) {
    return null;
  }
  const result = runPkgConfig(`--cflags-only-I ${FFMPEG_LIBS}`, ffmpeg.root, ffmpeg.pkgconfig, env);
  if (!result) {
    return null;
  }
  return result.replace(/-I/g, '').trim();
}

export function resolveProjectRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, '..');
}
