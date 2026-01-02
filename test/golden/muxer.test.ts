// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';

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

      assert.ok(totalPackets > 0);
      assert.strictEqual(chunks.length, totalPackets);
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

      assert.ok(packetsRead > 0);
      assert.strictEqual(chunks.length, packetsRead);
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

      assert.strictEqual(packetsRead, 5);
      assert.strictEqual(chunks.length, 5);

      // Read more to verify continuity
      const morePackets = demuxer.demuxPackets(3);
      assert.strictEqual(morePackets, 3);
      assert.strictEqual(chunks.length, 8);

      demuxer.close();
    });
  });
});

describe('Muxer', () => {
  it('should be exported from the library', async () => {
    const { Muxer } = await import('../../dist/index.js');
    assert.notStrictEqual(Muxer, undefined);
  });

  describe('constructor', () => {
    let tempDir: string;
    let outputPath: string;

    before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-test-'));
      outputPath = path.join(tempDir, 'test-output.mp4');
    });

    after(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create a muxer instance with filename', async () => {
      const { Muxer } = await import('../../dist/index.js');
      const muxer = new Muxer({ filename: outputPath });
      assert.notStrictEqual(muxer, undefined);
      muxer.close();
    });

    it('should throw if filename is missing', async () => {
      const { Muxer } = await import('../../dist/index.js');
      assert.throws(() => new Muxer({} as any));
    });
  });
});
