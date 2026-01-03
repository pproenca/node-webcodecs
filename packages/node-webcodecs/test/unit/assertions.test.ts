import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertSimilar,
  colors,
  computePixelDifference,
  createRGBABuffer,
} from '../fixtures/index.js';

describe('assertSimilar', () => {
  it('returns 0 for identical buffers', () => {
    const buf = createRGBABuffer(10, 10, colors.red);
    assert.strictEqual(computePixelDifference(buf, buf, 10, 10), 0);
  });

  it('returns high difference for opposite colors', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    const diff = computePixelDifference(red, blue, 10, 10);
    assert.ok(diff > 100, 'Red vs Blue should be very different');
  });

  it('throws when buffers differ beyond threshold', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    assert.throws(() => { assertSimilar(red, blue, 10, 10, 10); }, /differ by/);
  });
});
