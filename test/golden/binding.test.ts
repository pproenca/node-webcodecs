// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('binding loader', () => {
  it('should load native binding', async () => {
    const { binding, platformInfo } = await import('../../lib/binding');

    assert.notStrictEqual(binding, undefined);
    assert.strictEqual(typeof binding.VideoEncoder, 'function');
    assert.strictEqual(typeof binding.VideoDecoder, 'function');
    assert.match(platformInfo.platform, /^(darwin|linux|win32)/);
  });

  it('should export platform info', async () => {
    const { platformInfo } = await import('../../lib/binding');

    assert.ok('platform' in platformInfo);
    assert.ok('arch' in platformInfo);
    assert.ok('nodeVersion' in platformInfo);
    assert.ok('napiVersion' in platformInfo);
  });
});
