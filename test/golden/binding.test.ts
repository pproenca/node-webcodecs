// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';

describe('binding loader', () => {
  it('should load native binding', async () => {
    const { binding, platformInfo } = await import('../../lib/binding');

    expect(binding).toBeDefined();
    expect(typeof binding.VideoEncoder).toBe('function');
    expect(typeof binding.VideoDecoder).toBe('function');
    expect(platformInfo.platform).toMatch(/^(darwin|linux|win32)/);
  });

  it('should export platform info', async () => {
    const { platformInfo } = await import('../../lib/binding');

    expect(platformInfo).toHaveProperty('platform');
    expect(platformInfo).toHaveProperty('arch');
    expect(platformInfo).toHaveProperty('nodeVersion');
    expect(platformInfo).toHaveProperty('napiVersion');
  });
});
