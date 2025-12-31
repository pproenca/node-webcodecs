import { describe, it, expect, } from 'vitest';

// We'll test the exported functions
describe('install/check.js', () => {
  it('should export checkPkgConfig function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.checkPkgConfig).toBe('function');
  });

  it('should export getFFmpegVersion function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.getFFmpegVersion).toBe('function');
  });

  it('should export hasPrebuiltFFmpeg function', async () => {
    const check = await import('../../install/check.js');
    expect(typeof check.hasPrebuiltFFmpeg).toBe('function');
  });
});
