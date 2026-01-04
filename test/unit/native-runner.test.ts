import * as assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {main, parseArgs} from '../../scripts/native-runner.js';

describe('native-runner', () => {
  describe('parseArgs', () => {
    it('should parse valid mode with no extra args', () => {
      const result = parseArgs(['test']);
      assert.deepStrictEqual(result, {
        mode: 'test',
        extraArgs: [],
        showHelp: false,
      });
    });

    it('should extract extra arguments after mode', () => {
      const result = parseArgs(['bench-filter', 'BM_H264', '--benchmark_repetitions=10']);
      assert.strictEqual(result.mode, 'bench-filter');
      assert.deepStrictEqual(result.extraArgs, ['BM_H264', '--benchmark_repetitions=10']);
      assert.strictEqual(result.showHelp, false);
    });

    it('should set showHelp for invalid mode', () => {
      const result = parseArgs(['invalid-mode']);
      assert.strictEqual(result.mode, undefined);
      assert.strictEqual(result.showHelp, true);
    });

    it('should set showHelp when no args provided', () => {
      const result = parseArgs([]);
      assert.strictEqual(result.mode, undefined);
      assert.strictEqual(result.showHelp, true);
    });

    it('should set showHelp for --help flag', () => {
      const result = parseArgs(['--help']);
      assert.strictEqual(result.mode, undefined);
      assert.strictEqual(result.showHelp, true);
    });

    it('should set showHelp for -h flag', () => {
      const result = parseArgs(['-h']);
      assert.strictEqual(result.mode, undefined);
      assert.strictEqual(result.showHelp, true);
    });

    // Test all valid modes are recognized
    const validModes = ['test', 'sanitize', 'tsan', 'coverage', 'leaks', 'bench', 'bench-filter'];
    validModes.forEach((mode) => {
      it(`should recognize '${mode}' as valid mode`, () => {
        const result = parseArgs([mode]);
        assert.strictEqual(result.mode, mode);
        assert.strictEqual(result.showHelp, false);
        assert.deepStrictEqual(result.extraArgs, []);
      });
    });

    it('should preserve extra args for test mode', () => {
      const result = parseArgs(['test', '--gtest_filter=MyTest.*', '--gtest_repeat=3']);
      assert.strictEqual(result.mode, 'test');
      assert.deepStrictEqual(result.extraArgs, ['--gtest_filter=MyTest.*', '--gtest_repeat=3']);
    });

    it('should preserve extra args for bench mode', () => {
      const result = parseArgs(['bench', '--benchmark_repetitions=5']);
      assert.strictEqual(result.mode, 'bench');
      assert.deepStrictEqual(result.extraArgs, ['--benchmark_repetitions=5']);
    });
  });

  describe('main', () => {
    it('should return 1 when no mode is provided', () => {
      const exitCode = main([]);
      assert.strictEqual(exitCode, 1);
    });

    it('should return 1 when --help flag is provided', () => {
      const exitCode = main(['--help']);
      assert.strictEqual(exitCode, 1);
    });

    it('should return 1 when -h flag is provided', () => {
      const exitCode = main(['-h']);
      assert.strictEqual(exitCode, 1);
    });

    it('should return 1 when invalid mode is provided', () => {
      const exitCode = main(['invalid-mode']);
      assert.strictEqual(exitCode, 1);
    });

    it('should display usage information when help is requested', () => {
      // Capture console.log output
      const originalLog = console.log;
      const logCalls: string[] = [];
      console.log = (...args: unknown[]) => {
        logCalls.push(args.join(' '));
      };

      main(['--help']);

      // Restore console.log
      console.log = originalLog;

      // Verify usage information was displayed
      assert.ok(logCalls.some((call) => call.includes('Usage:')));
      assert.ok(logCalls.some((call) => call.includes('Modes:')));
      assert.ok(
        logCalls.some((call) => call.includes('test, sanitize, tsan, coverage, leaks, bench')),
      );
      // Verify the improved example is shown
      assert.ok(logCalls.some((call) => call.includes('equivalent to:')));
    });

    it('should return 1 and display improved error message for bench-filter without filter', () => {
      // Capture console.error output
      const originalError = console.error;
      const errorCalls: string[] = [];
      console.error = (...args: unknown[]) => {
        errorCalls.push(args.join(' '));
      };

      const exitCode = main(['bench-filter']);

      // Restore console.error
      console.error = originalError;

      // Verify exit code
      assert.strictEqual(exitCode, 1);

      // Verify the improved error message is displayed
      const errorMessage = errorCalls.join(' ');
      assert.ok(errorMessage.includes('bench-filter requires a filter string'));
      assert.ok(errorMessage.includes('Usage:'));
      assert.ok(errorMessage.includes('Example:'));
    });

    it('should show stack trace in DEBUG mode for bench-filter error', () => {
      // Set DEBUG environment variable
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = '1';

      // Capture console.error output
      const originalError = console.error;
      const errorCalls: string[] = [];
      console.error = (...args: unknown[]) => {
        errorCalls.push(args.join(' '));
      };

      main(['bench-filter']);

      // Restore
      console.error = originalError;
      if (originalDebug === undefined) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = originalDebug;
      }

      // Verify stack trace is included
      const errorOutput = errorCalls.join('\n');
      assert.ok(errorOutput.includes('Error:'));
      // Stack traces typically contain 'at ' for stack frames
      assert.ok(errorOutput.includes('at '));
    });
  });
});
