/**
 * node:test wrapper for standalone contract tests.
 *
 * This allows contract tests to be run as part of the main test suite
 * while preserving their standalone nature. Contract tests verify
 * W3C WebCodecs API invariants and can also be run directly with tsx.
 *
 * Run standalone: npx tsx test/contracts/video_encoder/state_machine.ts
 * Run via node:test: npx tsx --test test/golden/contracts.test.ts
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(__dirname, '..', 'contracts');
const rootDir = path.join(__dirname, '..', '..');

// All contract test files organized by category
const contractTests = {
  'Video Encoder': [
    'video_encoder/state_machine.ts',
    'video_encoder/flush_behavior.ts',
  ],
  'Video Decoder': [
    'video_decoder/state_machine.ts',
    'video_decoder/flush_behavior.ts',
  ],
  'Audio Encoder': [
    'audio_encoder/state_machine.ts',
    'audio_encoder/flush_behavior.ts',
  ],
  'Audio Decoder': [
    'audio_decoder/state_machine.ts',
    'audio_decoder/flush_behavior.ts',
  ],
  'Data Lifecycle': [
    'data_lifecycle/video_frame.ts',
    'data_lifecycle/audio_data.ts',
    'data_lifecycle/encoded_chunks.ts',
  ],
  'Error Handling': [
    'error_handling/buffer_validation.ts',
    'error_handling/invalid_state.ts',
  ],
  'Round Trip': [
    'round_trip/video_integrity.ts',
    'round_trip/audio_integrity.ts',
  ],
};

/**
 * Runs a contract test file and returns the result
 */
function runContractTest(testFile: string): void {
  const testPath = path.join(contractsDir, testFile);

  try {
    execSync(`npx tsx "${testPath}"`, {
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
        .replace('.ts', '') // Remove extension
        .replace(/_/g, ' '); // Replace underscores with spaces

      it(testName, { timeout: 30000 }, () => {
        runContractTest(testFile);
      });
    }
  });
}
