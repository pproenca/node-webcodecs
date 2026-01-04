#!/usr/bin/env tsx
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Run native C++ tests and benchmarks in a consistent way.
//
// Usage:
//   tsx scripts/native-runner.ts <mode> [filter]
//
// Modes:
//   test | sanitize | tsan | coverage | leaks | bench | bench-filter

import {cpus} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureDir, removeDir} from './shared/fs';
import {runCommandOrThrow} from './shared/exec';
import {isMainModule} from './shared/runtime';

type Mode =
  | 'test'
  | 'sanitize'
  | 'tsan'
  | 'coverage'
  | 'leaks'
  | 'bench'
  | 'bench-filter';

interface ParsedArgs {
  readonly mode?: Mode;
  readonly extraArgs: string[];
  readonly showHelp: boolean;
}

const MODES = new Set<Mode>([
  'test',
  'sanitize',
  'tsan',
  'coverage',
  'leaks',
  'bench',
  'bench-filter',
]);

function resolveRootDir(): string {
  if (process.env.ROOT_DIR) {
    return resolve(process.env.ROOT_DIR);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function parseArgs(args: string[]): ParsedArgs {
  const [modeRaw, ...rest] = args;
  if (!modeRaw || modeRaw === '--help' || modeRaw === '-h') {
    return {extraArgs: [], showHelp: true};
  }

  if (!MODES.has(modeRaw as Mode)) {
    return {extraArgs: [], showHelp: true};
  }

  return {mode: modeRaw as Mode, extraArgs: rest, showHelp: false};
}

function printUsage(): void {
  console.log('Usage: tsx scripts/native-runner.ts <mode> [filter]');
  console.log('Modes: test, sanitize, tsan, coverage, leaks, bench, bench-filter');
  console.log('Example: npm run bench:native:filter -- BM_H264_Encode');
  console.log('Extra args after the mode are forwarded to the test/benchmark binary.');
}

function prepareBuildDir(rootDir: string, clean: boolean): string {
  const buildDir = join(rootDir, 'test', 'native', 'build');
  if (clean) {
    removeDir(buildDir);
  }
  ensureDir(buildDir);
  return buildDir;
}

function runCmake(buildDir: string, args: string[]): void {
  runCommandOrThrow('cmake', ['..', ...args], {cwd: buildDir, stdio: 'inherit'});
}

function runMake(buildDir: string, targets: string[] = []): void {
  const jobs = Math.max(1, cpus().length);
  const makeArgs = [`-j${jobs}`, ...targets];
  runCommandOrThrow('make', makeArgs, {cwd: buildDir, stdio: 'inherit'});
}

function runTests(buildDir: string, args: string[] = [], env?: NodeJS.ProcessEnv): void {
  const mergedEnv = env ? {...process.env, ...env} : process.env;
  runCommandOrThrow('./webcodecs_tests', args, {
    cwd: buildDir,
    env: mergedEnv,
    stdio: 'inherit',
  });
}

function runBenchmarks(buildDir: string, args: string[] = []): void {
  runCommandOrThrow('./webcodecs_benchmarks', args, {cwd: buildDir, stdio: 'inherit'});
}

function runCoverage(buildDir: string, extraArgs: string[]): void {
  runTests(buildDir, ['--gtest_brief=1', ...extraArgs]);
  runCommandOrThrow(
    'lcov',
    [
      '--capture',
      '--directory',
      '.',
      '--output-file',
      'coverage.info',
      '--ignore-errors',
      'inconsistent,unsupported,format',
    ],
    {cwd: buildDir, stdio: 'inherit'},
  );
  runCommandOrThrow(
    'genhtml',
    [
      'coverage.info',
      '--output-directory',
      'coverage_html',
      '--ignore-errors',
      'inconsistent,format,empty,category',
      '--title',
      'Node WebCodecs C++ Tests',
      '--legend',
    ],
    {cwd: buildDir, stdio: 'inherit'},
  );
  console.log('Coverage report: test/native/build/coverage_html/index.html');
}

function runMode(rootDir: string, parsed: ParsedArgs): void {
  const mode = parsed.mode;
  if (!mode) {
    throw new Error('Missing mode.');
  }

  switch (mode) {
    case 'test': {
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, []);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs);
      return;
    }
    case 'sanitize': {
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, ['-DSANITIZE=ON']);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs, {ASAN_OPTIONS: 'detect_leaks=1'});
      return;
    }
    case 'tsan': {
      const buildDir = prepareBuildDir(rootDir, true);
      runCmake(buildDir, ['-DTSAN=ON']);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs, {TSAN_OPTIONS: 'halt_on_error=1'});
      return;
    }
    case 'coverage': {
      const buildDir = prepareBuildDir(rootDir, true);
      runCmake(buildDir, ['-DCOVERAGE=ON']);
      runMake(buildDir);
      runCoverage(buildDir, parsed.extraArgs);
      return;
    }
    case 'leaks': {
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, []);
      runMake(buildDir);
      const leakArgs = ['./webcodecs_tests', '--gtest_brief=1', ...parsed.extraArgs];
      runCommandOrThrow(
        'leaks',
        ['--atExit', '--', ...leakArgs],
        {cwd: buildDir, stdio: 'inherit'},
      );
      return;
    }
    case 'bench': {
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, ['-DBUILD_BENCHMARKS=ON', '-DCMAKE_BUILD_TYPE=Release']);
      runMake(buildDir, ['webcodecs_benchmarks']);
      runBenchmarks(buildDir, parsed.extraArgs);
      return;
    }
    case 'bench-filter': {
      const [filter, ...extraArgs] = parsed.extraArgs;
      if (!filter) {
        throw new Error('bench-filter requires a filter string.');
      }
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, ['-DBUILD_BENCHMARKS=ON', '-DCMAKE_BUILD_TYPE=Release']);
      runMake(buildDir, ['webcodecs_benchmarks']);
      runBenchmarks(buildDir, ['--benchmark_filter', filter, ...extraArgs]);
      return;
    }
    default: {
      const unreachable: never = mode;
      throw new Error(`Unsupported mode: ${unreachable}`);
    }
  }
}

export function main(args: string[]): number {
  const parsed = parseArgs(args);
  if (parsed.showHelp) {
    printUsage();
    return 1;
  }

  const rootDir = resolveRootDir();
  try {
    runMode(rootDir, parsed);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
