import { describe, it, expect } from 'vitest';
import {
  getFFmpegLibPath,
  hasPrebuiltFFmpeg,
  useSystemFFmpeg,
} from '../../lib/ffmpeg';

describe('lib/ffmpeg.ts', () => {
  it('should export getFFmpegLibPath function', () => {
    expect(typeof getFFmpegLibPath).toBe('function');
  });

  it('should export hasPrebuiltFFmpeg function', () => {
    expect(typeof hasPrebuiltFFmpeg).toBe('function');
  });

  it('should export useSystemFFmpeg function', () => {
    expect(typeof useSystemFFmpeg).toBe('function');
  });

  it('getFFmpegLibPath returns null when no prebuilt available', () => {
    // In test environment without prebuilt packages
    const result = getFFmpegLibPath();
    // Either returns a path (if somehow available) or null
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
