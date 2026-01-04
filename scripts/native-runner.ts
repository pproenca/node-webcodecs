#!/usr/bin/env tsx
// Copyright 2025 The node-webcodecs Authors
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

/**
 * Modes for running native C++ tests and benchmarks.
 *
 * @example
 * // Run standard tests
 * tsx scripts/native-runner.ts test
 *
 * // Run with sanitizers
 * tsx scripts/native-runner.ts sanitize
 *
 * // Run benchmarks with filter
 * tsx scripts/native-runner.ts bench-filter BM_H264_Encode
 */
type Mode =
  | 'test'
  | 'sanitize'
  | 'tsan'
  | 'coverage'
  | 'leaks'
  | 'bench'
  | 'bench-filter';

/**
 * Parsed command line arguments.
 */
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

/**
 * Resolves the root directory of the project.
 *
 * @returns Absolute path to the project root
 */
function resolveRootDir(): string {
  if (process.env.ROOT_DIR) {
    return resolve(process.env.ROOT_DIR);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Parses command line arguments.
 *
 * @param args - Command line arguments (e.g., ['test', '--extra-arg'])
 * @returns Parsed arguments with mode and extra args
 */
export function parseArgs(args: string[]): ParsedArgs {
  const [modeRaw, ...rest] = args;
  if (!modeRaw || modeRaw === '--help' || modeRaw === '-h') {
    return {extraArgs: [], showHelp: true};
  }

  if (!MODES.has(modeRaw as Mode)) {
    return {extraArgs: [], showHelp: true};
  }

  return {mode: modeRaw as Mode, extraArgs: rest, showHelp: false};
}

/**
 * Prints usage information to the console.
 */
function printUsage(): void {
  console.log('Usage: tsx scripts/native-runner.ts <mode> [filter]');
  console.log('Modes: test, sanitize, tsan, coverage, leaks, bench, bench-filter');
  console.log('Example: npm run bench:native:filter -- BM_H264_Encode');
  console.log('         (equivalent to: tsx scripts/native-runner.ts bench-filter BM_H264_Encode)');
  console.log('Extra args after the mode are forwarded to the test/benchmark binary.');
}

/**
 * Prepares the native build directory.
 *
 * @param rootDir - Project root directory
 * @param clean - Whether to clean the build directory before building
 * @returns Absolute path to the build directory
 */
function prepareBuildDir(rootDir: string, clean: boolean): string {
  const buildDir = join(rootDir, 'test', 'native', 'build');
  if (clean) {
    removeDir(buildDir);
  }
  ensureDir(buildDir);
  return buildDir;
}

/**
 * Runs CMake to configure the native build.
 *
 * @param buildDir - Build directory path
 * @param args - Additional CMake arguments
 */
function runCmake(buildDir: string, args: string[]): void {
  runCommandOrThrow('cmake', ['..', ...args], {cwd: buildDir, stdio: 'inherit'});
}

/**
 * Runs Make to build the native targets.
 *
 * @param buildDir - Build directory path
 * @param targets - Specific build targets to compile. If empty, builds all targets.
 */
function runMake(buildDir: string, targets: string[] = []): void {
  // Cap parallel jobs to prevent resource exhaustion on high-core systems
  const jobs = Math.min(Math.max(1, cpus().length), 16);
  const makeArgs = [`-j${jobs}`, ...targets];
  runCommandOrThrow('make', makeArgs, {cwd: buildDir, stdio: 'inherit'});
}

/**
 * Runs the native test binary.
 *
 * @param buildDir - Build directory path
 * @param args - Arguments to pass to the test binary
 * @param env - Optional environment variables
 * @throws Error if the test binary exits with non-zero code
 */
function runTests(buildDir: string, args: string[] = [], env?: NodeJS.ProcessEnv): void {
  const mergedEnv = env ? {...process.env, ...env} : process.env;
  runCommandOrThrow('./webcodecs_tests', args, {
    cwd: buildDir,
    env: mergedEnv,
    stdio: 'inherit',
  });
}

/**
 * Runs the native benchmark binary.
 *
 * @param buildDir - Build directory path
 * @param args - Arguments to pass to the benchmark binary
 * @throws Error if the benchmark binary exits with non-zero code
 */
function runBenchmarks(buildDir: string, args: string[] = []): void {
  runCommandOrThrow('./webcodecs_benchmarks', args, {cwd: buildDir, stdio: 'inherit'});
}

/**
 * Runs tests with coverage collection and generates HTML report.
 *
 * @param buildDir - Build directory path
 * @param extraArgs - Extra arguments to pass to the test binary
 *
 * @remarks
 * Generates two artifacts in buildDir:
 * - coverage.info: Raw lcov coverage data
 * - coverage_html/: HTML coverage report (view index.html in browser)
 *
 * @throws Error if tests fail or coverage tools (lcov, genhtml) are not installed
 */
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

/**
 * Executes the specified test/benchmark mode.
 *
 * @param rootDir - Project root directory
 * @param parsed - Parsed command line arguments
 */
function runMode(rootDir: string, parsed: ParsedArgs): void {
  const mode = parsed.mode;
  if (!mode) {
    throw new Error('Missing mode.');
  }

  switch (mode) {
    case 'test': {
      // Incremental build (reuse previous build artifacts)
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, []);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs);
      return;
    }
    case 'sanitize': {
      // Incremental build (reuse previous build artifacts)
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, ['-DSANITIZE=ON']);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs, {ASAN_OPTIONS: 'detect_leaks=1'});
      return;
    }
    case 'tsan': {
      // Clean build required: TSAN needs instrumentation from scratch to avoid false positives
      const buildDir = prepareBuildDir(rootDir, true);
      runCmake(buildDir, ['-DTSAN=ON']);
      runMake(buildDir);
      runTests(buildDir, parsed.extraArgs, {TSAN_OPTIONS: 'halt_on_error=1'});
      return;
    }
    case 'coverage': {
      // Clean build required: Coverage instrumentation must be consistent across all objects
      const buildDir = prepareBuildDir(rootDir, true);
      runCmake(buildDir, ['-DCOVERAGE=ON']);
      runMake(buildDir);
      runCoverage(buildDir, parsed.extraArgs);
      return;
    }
    case 'leaks': {
      // Incremental build (reuse previous build artifacts)
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
      // Incremental build (reuse previous build artifacts)
      const buildDir = prepareBuildDir(rootDir, false);
      runCmake(buildDir, ['-DBUILD_BENCHMARKS=ON', '-DCMAKE_BUILD_TYPE=Release']);
      runMake(buildDir, ['webcodecs_benchmarks']);
      runBenchmarks(buildDir, parsed.extraArgs);
      return;
    }
    case 'bench-filter': {
      const [filter, ...extraArgs] = parsed.extraArgs;
      if (!filter) {
        throw new Error(
          'bench-filter requires a filter string.\n' +
            'Usage: npm run bench:native:filter -- <filter> [extra-args]\n' +
            'Example: npm run bench:native:filter -- BM_H264_Encode',
        );
      }
      // Incremental build (reuse previous build artifacts)
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

/**
 * Main entry point for the native test/benchmark runner.
 *
 * @param args - Command line arguments (mode and optional extra args)
 * @returns Exit code (0 for success, 1 for failure)
 *
 * @example
 * main(['test']);
 * main(['bench-filter', 'BM_H264_Encode']);
 */
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
    if (error instanceof Error) {
      console.error('Error:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      console.error('Unexpected error:', String(error));
    }
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
