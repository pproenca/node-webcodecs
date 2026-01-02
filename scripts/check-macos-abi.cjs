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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BINDING_GYP = path.join(ROOT_DIR, 'binding.gyp');
const FFMPEG_LIB_DIR = path.join(ROOT_DIR, 'ffmpeg-install', 'lib');

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
  } catch (err) {
    return null;
  }
}

/**
 * Extract minimum macOS version from a static library using otool
 */
function getLibraryTarget(libPath) {
  try {
    // Use otool -l to get load commands, look for LC_BUILD_VERSION or LC_VERSION_MIN_MACOSX
    const output = execSync(`otool -l "${libPath}" 2>/dev/null`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large .a files
    });

    // Look for LC_BUILD_VERSION (newer format) - minos can be "15.0" or "15"
    const buildVersionMatch = output.match(/LC_BUILD_VERSION[\s\S]*?minos\s+(\d+(?:\.\d+)?)/);
    if (buildVersionMatch) {
      // Normalize to X.Y format
      const version = buildVersionMatch[1];
      return version.includes('.') ? version : version + '.0';
    }

    // Look for LC_VERSION_MIN_MACOSX (older format)
    const versionMinMatch = output.match(/LC_VERSION_MIN_MACOSX[\s\S]*?version\s+(\d+(?:\.\d+)?)/);
    if (versionMinMatch) {
      const version = versionMinMatch[1];
      return version.includes('.') ? version : version + '.0';
    }

    return null;
  } catch (err) {
    return null;
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
    console.log('No FFmpeg libraries found in ffmpeg-install/lib/');
    console.log('This is normal for CI builds that download pre-built binaries.');
    process.exit(0);
  }

  // Check the first library (they should all have the same target)
  const sampleLib = ffmpegLibs.find(lib => lib.includes('libavcodec')) || ffmpegLibs[0];
  const ffmpegTarget = getLibraryTarget(sampleLib);

  if (!ffmpegTarget) {
    console.log(`Could not determine macOS target from ${path.basename(sampleLib)}`);
    process.exit(0);
  }

  console.log(`binding.gyp target:  macOS ${bindingTarget}`);
  console.log(`FFmpeg lib target:   macOS ${ffmpegTarget}`);
  console.log(`Library checked:     ${path.basename(sampleLib)}`);
  console.log('');

  if (ffmpegTarget === bindingTarget) {
    console.log('\u2705 ABI targets match - no mismatch detected');
    process.exit(0);
  }

  // Check if FFmpeg was built for a NEWER macOS than binding.gyp targets
  // This is the problematic case - newer libc++ features in FFmpeg won't work
  // with older deployment target
  if (compareVersions(ffmpegTarget, bindingTarget) > 0) {
    const box = [
      '',
      '\u2554' + '\u2550'.repeat(68) + '\u2557',
      '\u2551  \u274C ABI MISMATCH DETECTED' + ' '.repeat(43) + '\u2551',
      '\u2560' + '\u2550'.repeat(68) + '\u2563',
      `\u2551  FFmpeg was built for macOS ${ffmpegTarget}, but binding.gyp targets ${bindingTarget}`.padEnd(69) + '\u2551',
      '\u2551' + ' '.repeat(68) + '\u2551',
      '\u2551  This causes segfaults in STL types (std::function, std::vector)  '.padEnd(69) + '\u2551',
      '\u2551  that appear as crashes during object instantiation.              '.padEnd(69) + '\u2551',
      '\u2551' + ' '.repeat(68) + '\u2551',
      '\u2551  Solutions:                                                       '.padEnd(69) + '\u2551',
      `\u2551  1. Rebuild FFmpeg with -mmacosx-version-min=${bindingTarget}`.padEnd(69) + '\u2551',
      `\u2551  2. Update binding.gyp to target macOS ${ffmpegTarget}`.padEnd(69) + '\u2551',
      '\u2551  3. Use pre-built FFmpeg from CI releases (recommended)           '.padEnd(69) + '\u2551',
      '\u255A' + '\u2550'.repeat(68) + '\u255D',
    ];
    console.error(box.join('\n'));
    process.exit(1);
  }

  // FFmpeg built for older macOS than binding.gyp - generally OK
  console.log('\u26A0\uFE0F  FFmpeg targets older macOS than binding.gyp');
  console.log('   This is usually safe but may miss optimizations.');
  process.exit(0);
}

main();
