#!/usr/bin/env tsx
/**
 * Check for macOS ABI mismatches between FFmpeg libraries and binding.gyp
 *
 * ABI mismatches occur when FFmpeg is built targeting a different macOS version
 * than the native addon. This causes subtle crashes in STL types (std::function,
 * std::vector, std::string) due to different memory layouts between libc++ versions.
 *
 * Usage: tsx scripts/check-macos-abi.ts
 */

import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainModule} from './shared/runtime';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BINDING_GYP = join(ROOT_DIR, 'binding.gyp');
const FFMPEG_ROOT = process.env.FFMPEG_ROOT
  ? resolve(process.env.FFMPEG_ROOT)
  : join(ROOT_DIR, 'ffmpeg-install');
const FFMPEG_LIB_DIR = join(FFMPEG_ROOT, 'lib');

export function normalizeVersion(version: string): string {
  return version.includes('.') ? version : `${version}.0`;
}

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

export function parseTargetsFromOtool(output: string): string[] {
  const targets = new Set<string>();
  const lines = output.split('\n');
  let expectMinos = false;
  let expectVersion = false;

  for (const line of lines) {
    if (line.includes('cmd LC_BUILD_VERSION')) {
      expectMinos = true;
      expectVersion = false;
      continue;
    }
    if (line.includes('cmd LC_VERSION_MIN_MACOSX')) {
      expectVersion = true;
      expectMinos = false;
      continue;
    }
    if (expectMinos && line.includes('minos')) {
      const match = line.match(/minos\s+(\d+(?:\.\d+)?)/);
      if (match) {
        targets.add(normalizeVersion(match[1]));
      }
      expectMinos = false;
      continue;
    }
    if (expectVersion && line.includes('version')) {
      const match = line.match(/version\s+(\d+(?:\.\d+)?)/);
      if (match) {
        targets.add(normalizeVersion(match[1]));
      }
      expectVersion = false;
    }
  }

  return Array.from(targets);
}

function getBindingTarget(): string | null {
  try {
    const content = readFileSync(BINDING_GYP, 'utf8');
    const versionMinMatch = content.match(/-mmacosx-version-min=(\d+\.\d+)/);
    if (versionMinMatch) {
      return versionMinMatch[1];
    }

    const deployTargetMatch = content.match(/MACOSX_DEPLOYMENT_TARGET.*?(\d+\.\d+)/);
    if (deployTargetMatch) {
      return deployTargetMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

function getLibraryTargets(libPath: string): string[] {
  try {
    const output = execSync(`otool -l "${libPath}" 2>/dev/null`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return parseTargetsFromOtool(output);
  } catch {
    return [];
  }
}

function findFfmpegLibs(): string[] {
  if (!existsSync(FFMPEG_LIB_DIR)) {
    return [];
  }

  const libs: string[] = [];
  const files = readdirSync(FFMPEG_LIB_DIR);
  for (const file of files) {
    if (file.endsWith('.a')) {
      libs.push(join(FFMPEG_LIB_DIR, file));
    }
  }
  return libs;
}

function formatMismatchBox(bindingTarget: string, offenders: string[]): string {
  const rows = [
    '',
    `\u2554${'\u2550'.repeat(68)}\u2557`,
    `\u2551  \u274C ABI MISMATCH DETECTED${' '.repeat(43)}\u2551`,
    `\u2560${'\u2550'.repeat(68)}\u2563`,
    `${`\u2551  FFmpeg contains objects newer than macOS ${bindingTarget}`.padEnd(69)}\u2551`,
    `\u2551${' '.repeat(68)}\u2551`,
    `${'\u2551  This causes segfaults in STL types (std::function, std::vector)  '.padEnd(69)}\u2551`,
    `${'\u2551  that appear as crashes during object instantiation.              '.padEnd(69)}\u2551`,
    `\u2551${' '.repeat(68)}\u2551`,
    `${'\u2551  Offending libraries:                                              '.padEnd(69)}\u2551`,
    ...offenders.map(line => `${`\u2551  - ${line}`.padEnd(69)}\u2551`),
    `\u2551${' '.repeat(68)}\u2551`,
    `${'\u2551  Solutions:                                                       '.padEnd(69)}\u2551`,
    `${`\u2551  1. Rebuild FFmpeg with -mmacosx-version-min=${bindingTarget}`.padEnd(69)}\u2551`,
    `${`\u2551  2. Update binding.gyp to target macOS ${bindingTarget}`.padEnd(69)}\u2551`,
    `${'\u2551  3. Use pre-built FFmpeg from CI releases (recommended)           '.padEnd(69)}\u2551`,
    `\u255A${'\u2550'.repeat(68)}\u255D`,
  ];
  return rows.join('\n');
}

export function main(): number {
  if (process.platform !== 'darwin') {
    console.log('This script only runs on macOS');
    return 0;
  }

  const bindingTarget = getBindingTarget();
  if (!bindingTarget) {
    console.log('Could not determine macOS target from binding.gyp');
    return 0;
  }

  const ffmpegLibs = findFfmpegLibs();
  if (ffmpegLibs.length === 0) {
    console.log(`No FFmpeg libraries found in ${FFMPEG_LIB_DIR}/`);
    console.log('This is normal for CI builds that download pre-built binaries.');
    return 0;
  }

  console.log(`binding.gyp target:  macOS ${bindingTarget}`);
  console.log(`FFmpeg lib path:     ${FFMPEG_LIB_DIR}`);
  console.log('');

  const newerThanTarget: Array<{lib: string; targets: string[]}> = [];
  const mixedTargets: Array<{lib: string; targets: string[]}> = [];
  const noTargets: string[] = [];

  for (const lib of ffmpegLibs) {
    const targets = getLibraryTargets(lib);
    if (targets.length === 0) {
      noTargets.push(lib);
      continue;
    }

    targets.sort(compareVersions);
    const maxTarget = targets[targets.length - 1];

    if (targets.length > 1) {
      mixedTargets.push({lib, targets});
    }

    if (compareVersions(maxTarget, bindingTarget) > 0) {
      newerThanTarget.push({lib, targets});
    }
  }

  if (noTargets.length > 0) {
    console.log('\u26A0\uFE0F  Some libraries did not report a macOS deployment target:');
    for (const lib of noTargets) {
      console.log(`   - ${lib.split('/').pop()}`);
    }
    console.log('');
  }

  if (mixedTargets.length > 0) {
    console.log('\u26A0\uFE0F  Mixed macOS targets detected within libraries:');
    for (const entry of mixedTargets) {
      console.log(`   - ${entry.lib.split('/').pop()}: ${entry.targets.join(', ')}`);
    }
    console.log('');
  }

  if (newerThanTarget.length === 0) {
    console.log('\u2705 ABI targets match - no mismatch detected');
    return 0;
  }

  const offenders = newerThanTarget.map(entry => {
    const name = entry.lib.split('/').pop() ?? entry.lib;
    return `${name}: ${entry.targets.join(', ')}`;
  });

  console.error(formatMismatchBox(bindingTarget, offenders));
  return 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main());
}
