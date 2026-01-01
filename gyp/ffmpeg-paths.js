#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Resolve FFmpeg paths for node-gyp binding.

'use strict';

const { existsSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { platform, arch } = require('node:os');

function getRuntimePlatform() {
  return `${platform()}-${arch()}`;
}

function getPrebuiltLibPath() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const libEntry = require.resolve(`${packageName}/lib`);
    return dirname(libEntry);
  } catch {
    return null;
  }
}

function getPrebuiltIncludePath() {
  const runtimePlatform = getRuntimePlatform();
  const packageName = `@pproenca/ffmpeg-${runtimePlatform}`;

  try {
    const includeEntry = require.resolve(`${packageName}/include`);
    return dirname(includeEntry);
  } catch {
    // Fallback: check relative to lib path
    const libPath = getPrebuiltLibPath();
    if (!libPath) return null;
    const includePath = join(dirname(libPath), 'include');
    return existsSync(includePath) ? includePath : null;
  }
}

// Output for node-gyp variable expansion
const mode = process.argv[2] || 'lib';

if (mode === 'lib') {
  const libPath = getPrebuiltLibPath();
  if (libPath) {
    console.log(`-L${libPath}`);
  } else {
    process.exit(1);
  }
} else if (mode === 'include') {
  const includePath = getPrebuiltIncludePath();
  if (includePath) {
    console.log(includePath);
  } else {
    process.exit(1);
  }
} else if (mode === 'rpath') {
  const libPath = getPrebuiltLibPath();
  if (libPath) {
    console.log(`-Wl,-rpath,${libPath}`);
  } else {
    process.exit(1);
  }
}
