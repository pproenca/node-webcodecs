// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Muxer', () => {
  it('should be exported from the library', async () => {
    const { Muxer } = await import('../../dist/index.js');
    expect(Muxer).toBeDefined();
  });

  describe('constructor', () => {
    let tempDir: string;
    let outputPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-test-'));
      outputPath = path.join(tempDir, 'test-output.mp4');
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create a muxer instance with filename', async () => {
      const { Muxer } = await import('../../dist/index.js');
      const muxer = new Muxer({ filename: outputPath });
      expect(muxer).toBeDefined();
      muxer.close();
    });

    it('should throw if filename is missing', async () => {
      const { Muxer } = await import('../../dist/index.js');
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
      expect(() => new Muxer({} as any)).toThrow();
    });
  });
});
