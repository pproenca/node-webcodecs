import { describe, expect, it } from 'vitest';

// WarningAccumulator is exposed via binding for testing
const { WarningAccumulator } = await import('../../dist/index.js');

describe('WarningAccumulator', () => {
  it('accumulates warnings and drains them', () => {
    const accumulator = new WarningAccumulator();
    accumulator.add('Warning 1');
    accumulator.add('Warning 2');

    expect(accumulator.count()).toBe(2);
    expect(accumulator.hasWarnings()).toBe(true);

    const warnings = accumulator.drain();
    expect(warnings).toEqual(['Warning 1', 'Warning 2']);

    expect(accumulator.count()).toBe(0);
    expect(accumulator.hasWarnings()).toBe(false);
  });

  it('returns empty array when no warnings', () => {
    const accumulator = new WarningAccumulator();
    expect(accumulator.drain()).toEqual([]);
  });
});
