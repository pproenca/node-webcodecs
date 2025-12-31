// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import {describe, it, expect} from 'vitest';

describe('platform detection', () => {
  it('should detect current platform', async () => {
    const {runtimePlatformArch, prebuiltPlatforms} = await import(
      '../../lib/platform'
    );

    const platform = runtimePlatformArch();
    expect(platform).toMatch(/^(darwin|linux|win32)(musl)?-(x64|arm64|arm)$/);
  });

  it('should list supported prebuilt platforms', async () => {
    const {prebuiltPlatforms} = await import('../../lib/platform');

    expect(prebuiltPlatforms).toContain('darwin-arm64');
    expect(prebuiltPlatforms).toContain('darwin-x64');
    expect(prebuiltPlatforms).toContain('linux-x64');
  });
});
