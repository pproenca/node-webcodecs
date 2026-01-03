#!/usr/bin/env node
/**
 * Helper script for binding.gyp to locate FFmpeg libraries
 * Uses FFMPEG_ROOT environment variable if set, otherwise falls back to pkg-config
 */

const path = require('path');
const fs = require('fs');

const type = process.argv[2]; // 'include' or 'lib'

if (!type || (type !== 'include' && type !== 'lib')) {
  console.error('Usage: ffmpeg-paths.js [include|lib]');
  process.exit(1);
}

const ffmpegRoot = process.env.FFMPEG_ROOT;

if (!ffmpegRoot) {
  // No FFMPEG_ROOT set, exit with error to fall back to pkg-config
  process.exit(1);
}

// Verify FFMPEG_ROOT exists
if (!fs.existsSync(ffmpegRoot)) {
  console.error(`FFMPEG_ROOT=${ffmpegRoot} does not exist`);
  process.exit(1);
}

if (type === 'include') {
  // Return include paths
  const includePath = path.join(ffmpegRoot, 'include');
  if (fs.existsSync(includePath)) {
    console.log(includePath);
  } else {
    console.error(`Include path ${includePath} does not exist`);
    process.exit(1);
  }
} else if (type === 'lib') {
  // Return library flags
  const libPath = path.join(ffmpegRoot, 'lib');

  if (!fs.existsSync(libPath)) {
    console.error(`Lib path ${libPath} does not exist`);
    process.exit(1);
  }

  // Output format: -L/path/to/lib -lavcodec -lavformat -lavutil -lswscale -lswresample -lavfilter
  const libs = [
    '-lavcodec',
    '-lavformat',
    '-lavutil',
    '-lswscale',
    '-lswresample',
    '-lavfilter'
  ];

  console.log(`-L${libPath} ${libs.join(' ')}`);
}
