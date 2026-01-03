/**
 * Video frame comparison utilities
 * Inspired by Sharp's assertSimilar pattern
 */

/**
 * Computes average pixel difference between two RGBA buffers
 * Returns 0 for identical, higher for more different
 */
export function computePixelDifference(
  buffer1: Uint8Array,
  buffer2: Uint8Array,
  width: number,
  height: number
): number {
  if (buffer1.length !== buffer2.length) {
    return Infinity;
  }

  let totalDiff = 0;
  const pixelCount = width * height;

  for (let i = 0; i < buffer1.length; i += 4) {
    // Compare RGB, ignore alpha
    totalDiff += Math.abs(buffer1[i] - buffer2[i]); // R
    totalDiff += Math.abs(buffer1[i + 1] - buffer2[i + 1]); // G
    totalDiff += Math.abs(buffer1[i + 2] - buffer2[i + 2]); // B
  }

  // Return average difference per channel per pixel (0-255 scale)
  return totalDiff / (pixelCount * 3);
}

/**
 * Asserts two buffers are visually similar within threshold
 * @param expected Expected pixel buffer
 * @param actual Actual pixel buffer
 * @param width Frame width
 * @param height Frame height
 * @param threshold Maximum average difference (default 10 = ~4% of 255)
 */
export function assertSimilar(
  expected: Uint8Array,
  actual: Uint8Array,
  width: number,
  height: number,
  threshold: number = 10
): void {
  const diff = computePixelDifference(expected, actual, width, height);
  if (diff > threshold) {
    throw new Error(
      `Frame buffers differ by ${diff.toFixed(2)} (threshold: ${threshold}). ` +
        `Expected similar visual content.`
    );
  }
}
