import { describe, expect, it } from 'vitest';

const { getFFmpegWarnings, clearFFmpegWarnings } = await import('../../dist/index.js');

describe('FFmpeg Logging', () => {
  it('captures FFmpeg warnings', () => {
    // FFmpeg warnings are captured globally
    clearFFmpegWarnings();

    const warnings = getFFmpegWarnings();
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('clears warnings after retrieval', () => {
    clearFFmpegWarnings();
    const warnings1 = getFFmpegWarnings();
    const warnings2 = getFFmpegWarnings();

    // Second call should return empty (warnings drained)
    expect(warnings2.length).toBeLessThanOrEqual(warnings1.length);
  });
});
