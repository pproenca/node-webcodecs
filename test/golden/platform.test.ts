import { describe, expect, it } from 'vitest';
import {
  buildPlatformArch,
  isPrebuiltAvailable,
  prebuiltPlatforms,
  runtimePlatformArch,
} from '../../lib/platform';

describe('Platform Detection', () => {
  it('returns valid platform-arch string', () => {
    const platform = runtimePlatformArch();
    expect(platform).toMatch(/^(darwin|linux|linuxmusl|win32)-(arm64|x64|arm|ia32)$/);
  });

  it('exports prebuilt platforms list', () => {
    expect(Array.isArray(prebuiltPlatforms)).toBe(true);
    expect(prebuiltPlatforms.length).toBeGreaterThan(0);
    expect(prebuiltPlatforms).toContain('darwin-arm64');
    expect(prebuiltPlatforms).toContain('linux-x64');
  });

  it('isPrebuiltAvailable returns boolean', () => {
    const available = isPrebuiltAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('buildPlatformArch returns valid platform string', () => {
    const platform = buildPlatformArch();
    expect(platform).toMatch(/^(darwin|linux|linuxmusl|win32)-(x64|arm64)$/);
  });

  it('buildPlatformArch matches runtime by default', () => {
    // In non-cross-compile scenario, build platform equals runtime platform
    expect(buildPlatformArch()).toBe(runtimePlatformArch());
  });
});
