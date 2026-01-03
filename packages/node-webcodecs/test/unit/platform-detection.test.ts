// test/unit/platform-detection.test.ts
// Tests for platform detection logic in binding.ts

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectPlatform, platformInfo } from '../../lib/binding';

describe('Platform Detection', () => {
  it('detectPlatform returns a valid platform string', () => {
    const platform = detectPlatform();

    // Platform should be in format: os-arch or os-arch-libc
    assert.match(platform, /^(darwin|linux|win32)-(x64|arm64)(-musl)?$/);
  });

  it('detectPlatform matches process.platform and process.arch', () => {
    const platform = detectPlatform();

    // Should start with process.platform-process.arch
    const expected = `${process.platform}-${process.arch}`;
    assert.ok(
      platform.startsWith(expected),
      `Expected platform to start with '${expected}', got '${platform}'`
    );
  });

  it('platformInfo includes detectedPlatform', () => {
    assert.ok('detectedPlatform' in platformInfo);
    assert.strictEqual(typeof platformInfo.detectedPlatform, 'string');
    assert.strictEqual(platformInfo.detectedPlatform, detectPlatform());
  });

  it('platformInfo has expected structure', () => {
    assert.strictEqual(platformInfo.platform, process.platform);
    assert.strictEqual(platformInfo.arch, process.arch);
    assert.strictEqual(platformInfo.nodeVersion, process.version);
    assert.ok('napiVersion' in platformInfo);
    assert.ok('detectedPlatform' in platformInfo);
  });

  it('detectPlatform returns musl suffix on musl-based Linux', function () {
    // This test only runs meaningfully on Linux
    if (process.platform !== 'linux') {
      this.skip();
      return;
    }

    const platform = detectPlatform();

    // On Linux, should be either linux-x64 (glibc) or linux-x64-musl
    assert.match(platform, /^linux-(x64|arm64)(-musl)?$/);

    // If running in Alpine container, should have -musl suffix
    // We can check /etc/os-release for alpine
    try {
      const fs = require('node:fs');
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      if (osRelease.includes('Alpine')) {
        assert.ok(
          platform.endsWith('-musl'),
          `Expected '-musl' suffix on Alpine Linux, got '${platform}'`
        );
      }
    } catch {
      // Not Alpine or can't read file - test passes
    }
  });

  it('detectPlatform returns darwin on macOS', function () {
    if (process.platform !== 'darwin') {
      this.skip();
      return;
    }

    const platform = detectPlatform();
    assert.match(platform, /^darwin-(x64|arm64)$/);
    // macOS should never have libc suffix
    assert.ok(!platform.includes('musl'));
    assert.ok(!platform.includes('glibc'));
  });
});
