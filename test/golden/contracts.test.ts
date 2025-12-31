/**
 * Vitest wrapper for standalone contract tests.
 *
 * This allows contract tests to be run as part of the main test suite
 * while preserving their standalone nature. Contract tests verify
 * W3C WebCodecs API invariants and can also be run directly with node.
 *
 * Run standalone: node test/contracts/video_encoder/state_machine.js
 * Run via vitest: npx vitest run test/golden/contracts.test.ts
 */

import { describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const contractsDir = path.join(__dirname, '..', 'contracts');
const rootDir = path.join(__dirname, '..', '..');

// All contract test files organized by category
const contractTests = {
  'Video Encoder': [
    'video_encoder/state_machine.js',
    'video_encoder/flush_behavior.js',
  ],
  'Video Decoder': [
    'video_decoder/state_machine.js',
    'video_decoder/flush_behavior.js',
  ],
  'Audio Encoder': [
    'audio_encoder/state_machine.js',
    'audio_encoder/flush_behavior.js',
  ],
  'Audio Decoder': [
    'audio_decoder/state_machine.js',
    'audio_decoder/flush_behavior.js',
  ],
  'Data Lifecycle': [
    'data_lifecycle/video_frame.js',
    'data_lifecycle/audio_data.js',
    'data_lifecycle/encoded_chunks.js',
  ],
  'Error Handling': [
    'error_handling/buffer_validation.js',
    'error_handling/invalid_state.js',
  ],
  'Round Trip': [
    'round_trip/video_integrity.js',
    'round_trip/audio_integrity.js',
  ],
};

/**
 * Runs a contract test file and returns the result
 */
function runContractTest(testFile: string): void {
  const testPath = path.join(contractsDir, testFile);

  try {
    execSync(`node "${testPath}"`, {
      cwd: rootDir,
      stdio: 'pipe',
      timeout: 30000,
      encoding: 'utf-8',
    });
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    // Include output in failure message for debugging
    const stdout = execError.stdout || '';
    const stderr = execError.stderr || '';
    const output = [stdout, stderr].filter(Boolean).join('\n');

    throw new Error(
      `Contract test failed: ${testFile}\n\n` +
        `Output:\n${output || '(no output)'}\n\n` +
        `Error: ${execError.message || 'Unknown error'}`
    );
  }
}

// Create test suites for each category
for (const [category, tests] of Object.entries(contractTests)) {
  describe(`Contract: ${category}`, () => {
    for (const testFile of tests) {
      const testName = testFile
        .replace(/.*\//, '') // Remove directory prefix
        .replace('.js', '') // Remove extension
        .replace(/_/g, ' '); // Replace underscores with spaces

      it(testName, { timeout: 30000 }, () => {
        runContractTest(testFile);
      });
    }
  });
}
