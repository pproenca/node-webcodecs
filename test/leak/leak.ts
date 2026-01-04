#!/usr/bin/env tsx
// Memory leak detection using Valgrind
// Usage: tsx test/leak/leak.ts
// Requires: valgrind installed on system (Linux only)

import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCommand} from '../../scripts/shared/exec';

const SUPP_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const ROOT_DIR = resolve(SUPP_DIR, '..', '..');
const TESTS = ['test/guardrails/memory_sentinel.ts'];

function hasCommand(command: string): boolean {
  const result = runCommand(command, ['--version']);
  return result.exitCode === 0;
}

function runValgrind(testPath: string): boolean {
  const suppressions = join(SUPP_DIR, 'ffmpeg.supp');
  const fullPath = resolve(ROOT_DIR, testPath);
  if (!existsSync(fullPath)) {
    console.error(`Missing test file: ${fullPath}`);
    return false;
  }

  const nodeArgs = ['--import', 'tsx', '--expose-gc', fullPath];
  const result = runCommand('valgrind', [
    `--suppressions=${suppressions}`,
    '--leak-check=full',
    '--show-leak-kinds=definite,indirect',
    '--num-callers=20',
    '--error-exitcode=1',
    '--track-origins=yes',
    process.execPath,
    ...nodeArgs,
  ], {
    env: {
      ...process.env,
      G_SLICE: 'always-malloc',
      G_DEBUG: 'gc-friendly',
    },
    stdio: 'inherit',
  });

  return result.exitCode === 0;
}

function main(): number {
  if (!hasCommand('valgrind')) {
    console.log('Valgrind not found. Skipping memory leak tests.');
    console.log('Install with: apt-get install valgrind (Linux) or brew install valgrind (macOS)');
    return 0;
  }

  console.log('Running Valgrind memory leak checks...');
  console.log('================================================');

  let failed = 0;
  for (const test of TESTS) {
    console.log('');
    console.log(`Checking: ${test}`);
    console.log('------------------------------------------------');

    if (runValgrind(test)) {
      console.log(`[PASS] ${test}`);
    } else {
      console.log(`[FAIL] ${test} - memory leaks detected`);
      failed++;
    }
  }

  console.log('');
  console.log('================================================');
  if (failed === 0) {
    console.log('All memory leak checks passed!');
    return 0;
  }

  console.log('Memory leak checks failed!');
  return 1;
}

process.exit(main());
