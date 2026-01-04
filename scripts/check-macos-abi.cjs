#!/usr/bin/env node
/**
 * Check for macOS ABI mismatches between FFmpeg libraries and binding.gyp
 *
 * ABI mismatches occur when FFmpeg is built targeting a different macOS version
 * than the native addon. This causes subtle crashes in STL types (std::function,
 * std::vector, std::string) due to different memory layouts between libc++ versions.
 *
 * Usage: node scripts/check-macos-abi.cjs
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const BINDING_GYP = path.join(ROOT_DIR, 'binding.gyp');
const FFMPEG_ROOT = process.env.FFMPEG_ROOT
  ? path.resolve(process.env.FFMPEG_ROOT)
  : path.join(ROOT_DIR, 'ffmpeg-install');
const FFMPEG_LIB_DIR = path.join(FFMPEG_ROOT, 'lib');

/**
 * Extract macOS deployment target from binding.gyp
 */
function getBindingTarget() {
  try {
    const content = fs.readFileSync(BINDING_GYP, 'utf8');
    // Look for -mmacosx-version-min=X.Y or MACOSX_DEPLOYMENT_TARGET
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

function normalizeVersion(version) {
  return version.includes('.') ? version : `${version}.0`;
}

/**
 * Extract macOS deployment targets from a static library using otool
 */
function getLibraryTargets(libPath) {
  try {
    // Use otool -l to get load commands, look for LC_BUILD_VERSION or LC_VERSION_MIN_MACOSX
    const output = execSync(`otool -l "${libPath}" 2>/dev/null`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large .a files
    });

    const targets = new Set();
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
  } catch {
    return [];
  }
}

/**
 * Find FFmpeg static libraries
 */
function findFFmpegLibs() {
  if (!fs.existsSync(FFMPEG_LIB_DIR)) {
    return [];
  }

  const libs = [];
  const files = fs.readdirSync(FFMPEG_LIB_DIR);
  for (const file of files) {
    if (file.endsWith('.a')) {
      libs.push(path.join(FFMPEG_LIB_DIR, file));
    }
  }
  return libs;
}

/**
 * Compare version strings (e.g., "10.15" vs "11.0")
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

function main() {
  // Only run on macOS
  if (process.platform !== 'darwin') {
    console.log('This script only runs on macOS');
    process.exit(0);
  }

  const bindingTarget = getBindingTarget();
  if (!bindingTarget) {
    console.log('Could not determine macOS target from binding.gyp');
    process.exit(0);
  }

  const ffmpegLibs = findFFmpegLibs();
  if (ffmpegLibs.length === 0) {
    console.log(`No FFmpeg libraries found in ${FFMPEG_LIB_DIR}/`);
    console.log('This is normal for CI builds that download pre-built binaries.');
    process.exit(0);
  }

  console.log(`binding.gyp target:  macOS ${bindingTarget}`);
  console.log(`FFmpeg lib path:     ${FFMPEG_LIB_DIR}`);
  console.log('');

  const newerThanTarget = [];
  const mixedTargets = [];
  const noTargets = [];

  for (const lib of ffmpegLibs) {
    const targets = getLibraryTargets(lib);
    if (targets.length === 0) {
      noTargets.push(lib);
      continue;
    }

    targets.sort(compareVersions);
    const maxTarget = targets[targets.length - 1];

    if (targets.length > 1) {
      mixedTargets.push({ lib, targets });
    }

    if (compareVersions(maxTarget, bindingTarget) > 0) {
      newerThanTarget.push({ lib, targets, maxTarget });
    }
  }

  if (noTargets.length > 0) {
    console.log('\u26A0\uFE0F  Some libraries did not report a macOS deployment target:');
    for (const lib of noTargets) {
      console.log(`   - ${path.basename(lib)}`);
    }
    console.log('');
  }

  if (mixedTargets.length > 0) {
    console.log('\u26A0\uFE0F  Mixed macOS targets detected within libraries:');
    for (const entry of mixedTargets) {
      console.log(`   - ${path.basename(entry.lib)}: ${entry.targets.join(', ')}`);
    }
    console.log('');
  }

  if (newerThanTarget.length === 0) {
    console.log('\u2705 ABI targets match - no mismatch detected');
    process.exit(0);
  }

  const box = [
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
    ...newerThanTarget.map(entry =>
      `${`\u2551  - ${path.basename(entry.lib)}: ${entry.targets.join(', ')}`.padEnd(69)}\u2551`
    ),
    `\u2551${' '.repeat(68)}\u2551`,
    `${'\u2551  Solutions:                                                       '.padEnd(69)}\u2551`,
    `${`\u2551  1. Rebuild FFmpeg with -mmacosx-version-min=${bindingTarget}`.padEnd(69)}\u2551`,
    `${`\u2551  2. Update binding.gyp to target macOS ${newerThanTarget[0].maxTarget}`.padEnd(69)}\u2551`,
    `${'\u2551  3. Use pre-built FFmpeg from CI releases (recommended)           '.padEnd(69)}\u2551`,
    `\u255A${'\u2550'.repeat(68)}\u255D`,
  ];
  console.error(box.join('\n'));
  process.exit(1);
}

main();
