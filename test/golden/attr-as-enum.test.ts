import { describe, expect, it } from 'vitest';

const { testAttrAsEnum } = await import('../../dist/index.js');

describe('AttrAsEnum', () => {
  it('returns mapped value for known string', () => {
    // testAttrAsEnum exposes internal for testing
    const result = testAttrAsEnum({ colorPrimaries: 'bt709' }, 'colorPrimaries');
    expect(result).toBe('bt709'); // Returns string representation
  });

  it('returns default for missing attribute', () => {
    const result = testAttrAsEnum({}, 'colorPrimaries');
    expect(result).toBe('bt709'); // Default
  });

  it('returns default for unknown value', () => {
    const result = testAttrAsEnum({ colorPrimaries: 'unknown' }, 'colorPrimaries');
    expect(result).toBe('bt709'); // Default
  });
});
