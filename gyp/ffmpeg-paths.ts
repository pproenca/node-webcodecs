#!/usr/bin/env node

import {
  resolveProjectRoot,
  resolveLibFlags,
  resolveIncludeFlags,
  resolveRpath,
} from './ffmpeg-paths-lib';

const mode = process.argv[2] ?? 'lib';
const projectRoot = resolveProjectRoot();

if (mode === 'lib') {
  const result = resolveLibFlags(projectRoot, process.env, process.platform);
  if (result) {
    console.log(result);
    process.exit(0);
  }
  process.exit(1);
}

if (mode === 'include') {
  const result = resolveIncludeFlags(projectRoot, process.env);
  if (result) {
    console.log(result);
    process.exit(0);
  }
  process.exit(1);
}

if (mode === 'rpath') {
  const result = resolveRpath(projectRoot, process.env);
  if (result) {
    console.log(result);
    process.exit(0);
  }
  process.exit(1);
}

console.error(`Unknown mode: ${mode}`);
process.exit(1);
