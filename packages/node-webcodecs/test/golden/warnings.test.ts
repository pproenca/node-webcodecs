import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// WarningAccumulator is exposed via binding for testing
import { WarningAccumulator } from '../../dist/index.js';

describe('WarningAccumulator', () => {
  it('accumulates warnings and drains them', () => {
    const accumulator = new WarningAccumulator();
    accumulator.add('Warning 1');
    accumulator.add('Warning 2');

    assert.strictEqual(accumulator.count(), 2);
    assert.strictEqual(accumulator.hasWarnings(), true);

    const warnings = accumulator.drain();
    assert.deepStrictEqual(warnings, ['Warning 1', 'Warning 2']);

    assert.strictEqual(accumulator.count(), 0);
    assert.strictEqual(accumulator.hasWarnings(), false);
  });

  it('returns empty array when no warnings', () => {
    const accumulator = new WarningAccumulator();
    assert.deepStrictEqual(accumulator.drain(), []);
  });
});
