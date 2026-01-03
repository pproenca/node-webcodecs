import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlatformArch,
  isPrebuiltAvailable,
  prebuiltPlatforms,
  runtimePlatformArch,
} from '../../lib/platform';

describe('Platform Detection', () => {
  it('returns valid platform-arch string', () => {
    const platform = runtimePlatformArch();
    assert.match(platform, /^(darwin|linux|linuxmusl|win32)-(arm64|x64|arm|ia32)$/);
  });

  it('exports prebuilt platforms list', () => {
    assert.strictEqual(Array.isArray(prebuiltPlatforms), true);
    assert.ok(prebuiltPlatforms.length > 0);
    assert.ok(prebuiltPlatforms.includes('darwin-arm64'));
    assert.ok(prebuiltPlatforms.includes('linux-x64'));
  });

  it('isPrebuiltAvailable returns boolean', () => {
    const available = isPrebuiltAvailable();
    assert.strictEqual(typeof available, 'boolean');
  });

  it('buildPlatformArch returns valid platform string', () => {
    const platform = buildPlatformArch();
    assert.match(platform, /^(darwin|linux|linuxmusl|win32)-(x64|arm64)$/);
  });

  it('buildPlatformArch matches runtime by default', () => {
    // In non-cross-compile scenario, build platform equals runtime platform
    assert.strictEqual(buildPlatformArch(), runtimePlatformArch());
  });
});
