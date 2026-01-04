#!/usr/bin/env tsx
// Memory leak detection using macOS leaks tool
// Usage: tsx test/leak/leaks-macos.ts
// Requires: macOS with Xcode Command Line Tools

import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCommand} from '../../scripts/shared/exec';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST = 'test/guardrails/memory_sentinel.ts';

const EXCLUDE_FLAGS = [
  '--exclude', 'avcodec',
  '--exclude', 'avformat',
  '--exclude', 'swscale',
  '--exclude', 'av_log',
  '--exclude', 'x264',
  '--exclude', 'x265',
  '--exclude', 'vpx',
  '--exclude', 'aom',
  '--exclude', 'opus',
  '--exclude', 'videotoolbox',
  '--exclude', 'v8::',
  '--exclude', 'node::',
  '--exclude', 'uv_',
  '--exclude', 'pthread',
  '--exclude', 'libsystem',
  '--exclude', 'dyld',
  '--exclude', 'OPENSSL',
];

function hasLeaksTool(): boolean {
  const result = runCommand('leaks', ['--version']);
  return result.exitCode === 0;
}

function runLeaks(testPath: string): number {
  const fullPath = resolve(ROOT_DIR, testPath);
  if (!existsSync(fullPath)) {
    console.error(`Missing test file: ${fullPath}`);
    return 1;
  }

  const nodeArgs = ['--import', 'tsx', '--expose-gc', fullPath];
  const result = runCommand('leaks', [
    '--atExit',
    ...EXCLUDE_FLAGS,
    '--',
    process.execPath,
    ...nodeArgs,
  ], {
    env: {
      ...process.env,
      MallocStackLogging: '1',
    },
    stdio: 'inherit',
  });

  return result.exitCode;
}

function main(): number {
  if (process.platform !== 'darwin') {
    console.log('This script is for macOS only. Use test/leak/leak.ts on Linux.');
    return 0;
  }

  if (!hasLeaksTool()) {
    console.log('leaks not found. Install: xcode-select --install');
    return 0;
  }

  console.log('Running macOS leaks memory check...');
  console.log('================================================');
  console.log(`Checking: ${TEST}`);
  console.log('------------------------------------------------');

  const exitCode = runLeaks(TEST);
  if (exitCode === 0) {
    console.log('[PASS] No leaks detected');
    return 0;
  }
  if (exitCode === 1) {
    console.log('[FAIL] Memory leaks detected');
    console.log('');
    console.log('For detailed investigation, run:');
    console.log(`  MallocStackLogging=1 leaks --atExit -- node --expose-gc ${TEST}`);
    return 1;
  }

  console.log(`[ERROR] leaks tool error (exit code: ${exitCode})`);
  return 1;
}

process.exit(main());
