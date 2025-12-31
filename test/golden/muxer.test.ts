// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import {describe, it, expect} from 'vitest';

describe('Muxer', () => {
  it('should be exported from the library', async () => {
    const {Muxer} = await import('../../dist/index.js');
    expect(Muxer).toBeDefined();
  });
});
