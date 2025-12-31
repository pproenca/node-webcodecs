// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testFilePath = path.join(__dirname, '../fixtures/small_buck_bunny.mp4');

describe('Demuxer', () => {
  describe('demuxPackets', () => {
    it('should support chunked demuxing with packet limit', async () => {
      const { Demuxer } = await import('../../dist/index.js');

      const chunks: { trackIndex: number }[] = [];
      const demuxer = new Demuxer({
        onChunk: (_chunk, trackIndex) => {
          chunks.push({ trackIndex });
        },
      });

      await demuxer.open(testFilePath);

      let totalPackets = 0;
      while (true) {
        const packetsRead = demuxer.demuxPackets(10); // Read 10 at a time
        totalPackets += packetsRead;
        if (packetsRead === 0) break;
        await new Promise(r => setImmediate(r)); // Yield to event loop
      }

      expect(totalPackets).toBeGreaterThan(0);
      expect(chunks.length).toBe(totalPackets);
      demuxer.close();
    });

    it('should read all packets when maxPackets is 0 (unlimited)', async () => {
      const { Demuxer } = await import('../../dist/index.js');

      const chunks: { trackIndex: number }[] = [];
      const demuxer = new Demuxer({
        onChunk: (_chunk, trackIndex) => {
          chunks.push({ trackIndex });
        },
      });

      await demuxer.open(testFilePath);

      const packetsRead = demuxer.demuxPackets(0); // 0 = unlimited

      expect(packetsRead).toBeGreaterThan(0);
      expect(chunks.length).toBe(packetsRead);
      demuxer.close();
    });

    it('should respect packet limit and return count', async () => {
      const { Demuxer } = await import('../../dist/index.js');

      const chunks: { trackIndex: number }[] = [];
      const demuxer = new Demuxer({
        onChunk: (_chunk, trackIndex) => {
          chunks.push({ trackIndex });
        },
      });

      await demuxer.open(testFilePath);

      const packetsRead = demuxer.demuxPackets(5); // Read only 5

      expect(packetsRead).toBe(5);
      expect(chunks.length).toBe(5);

      // Read more to verify continuity
      const morePackets = demuxer.demuxPackets(3);
      expect(morePackets).toBe(3);
      expect(chunks.length).toBe(8);

      demuxer.close();
    });
  });
});

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
      expect(() => new Muxer({} as any)).toThrow();
    });
  });
});
