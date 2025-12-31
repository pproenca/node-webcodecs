import { describe, it, expect } from 'vitest';
import {
  computePixelDifference,
  assertSimilar,
  createRGBABuffer,
  colors,
} from '../fixtures/index.js';

describe('assertSimilar', () => {
  it('returns 0 for identical buffers', () => {
    const buf = createRGBABuffer(10, 10, colors.red);
    expect(computePixelDifference(buf, buf, 10, 10)).toBe(0);
  });

  it('returns high difference for opposite colors', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    const diff = computePixelDifference(red, blue, 10, 10);
    expect(diff).toBeGreaterThan(100); // Red vs Blue should be very different
  });

  it('throws when buffers differ beyond threshold', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    expect(() => assertSimilar(red, blue, 10, 10, 10)).toThrow(/differ by/);
  });
});
