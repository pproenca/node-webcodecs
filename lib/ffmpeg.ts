// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// FFmpeg library loading following sharp's lib/libvips.js pattern.

import * as path from 'node:path';
import { runtimePlatformArch, prebuiltPlatforms, PrebuiltPlatform } from './platform';

const runtimePlatform = runtimePlatformArch();

/**
 * Check if prebuilt FFmpeg libraries are available for current platform.
 */
export function hasPrebuiltFFmpeg(): boolean {
  if (!prebuiltPlatforms.includes(runtimePlatform as PrebuiltPlatform)) {
    return false;
  }

  try {
    require.resolve(`@pproenca/ffmpeg-${runtimePlatform}/lib`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to prebuilt FFmpeg libraries.
 * Returns null if not available.
 */
export function getFFmpegLibPath(): string | null {
  if (!hasPrebuiltFFmpeg()) {
    return null;
  }

  try {
    const libEntry = require.resolve(`@pproenca/ffmpeg-${runtimePlatform}/lib`);
    return path.dirname(libEntry);
  } catch {
    return null;
  }
}

/**
 * Check environment variable to force system FFmpeg usage.
 */
export function useSystemFFmpeg(): boolean {
  return process.env.NODE_WEBCODECS_SYSTEM_FFMPEG === '1';
}

/**
 * Get FFmpeg version from prebuilt package.
 */
export function getPrebuiltFFmpegVersion(): string | null {
  try {
    const versions = require(`@pproenca/ffmpeg-${runtimePlatform}/versions`);
    return versions.ffmpeg || null;
  } catch {
    return null;
  }
}

/**
 * Log FFmpeg detection status.
 */
export function logFFmpegStatus(): void {
  if (useSystemFFmpeg()) {
    console.log('node-webcodecs: Using system FFmpeg (NODE_WEBCODECS_SYSTEM_FFMPEG=1)');
    return;
  }

  if (hasPrebuiltFFmpeg()) {
    const version = getPrebuiltFFmpegVersion();
    console.log(`node-webcodecs: Using prebuilt FFmpeg ${version || 'unknown'} for ${runtimePlatform}`);
  } else {
    console.log(`node-webcodecs: No prebuilt FFmpeg for ${runtimePlatform}, using system libraries`);
  }
}
