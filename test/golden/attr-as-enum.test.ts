import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { testAttrAsEnum } from '../../dist/index.js';

describe('AttrAsEnum', () => {
  it('returns mapped value for known string', () => {
    // testAttrAsEnum exposes internal for testing
    const result = testAttrAsEnum({ colorPrimaries: 'bt709' }, 'colorPrimaries');
    assert.strictEqual(result, 'bt709'); // Returns string representation
  });

  it('returns default for missing attribute', () => {
    const result = testAttrAsEnum({}, 'colorPrimaries');
    assert.strictEqual(result, 'bt709'); // Default
  });

  it('returns default for unknown value', () => {
    const result = testAttrAsEnum({ colorPrimaries: 'unknown' }, 'colorPrimaries');
    assert.strictEqual(result, 'bt709'); // Default
  });
});
