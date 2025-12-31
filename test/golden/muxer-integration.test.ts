// test/golden/muxer-integration.test.ts
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Muxer Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muxer-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should encode frames and mux to MP4', async () => {
    const { VideoEncoder, VideoFrame, Muxer } = await import('../../dist/index.js');

    const outputPath = path.join(tempDir, 'output.mp4');
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 10;

    const chunks: Array<{ type: string; timestamp: number; duration: number; data: Uint8Array }> =
      [];
    let codecDescription: ArrayBuffer | undefined;

    // Create encoder
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration || 33333,
          data,
        });
        if (metadata?.decoderConfig?.description) {
          codecDescription = metadata.decoderConfig.description;
        }
      },
      error: (e) => {
        throw e;
      },
    });

    // Use avc format to get description (extradata) for MP4 container
    encoder.configure({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
      avc: { format: 'avc' },
    });

    // Encode frames
    for (let i = 0; i < FRAME_COUNT; i++) {
      const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
      // Simple gradient
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const idx = (y * WIDTH + x) * 4;
          buffer[idx] = (x + i * 10) % 256;
          buffer[idx + 1] = (y + i * 5) % 256;
          buffer[idx + 2] = 128;
          buffer[idx + 3] = 255;
        }
      }

      const frame = new VideoFrame(buffer, {
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: i * 33333,
      });

      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);

    // Sort chunks by timestamp (decode order) to handle B-frames
    // The encoder may output frames in decode order which differs from presentation order
    // when B-frames are used. For muxing, we need monotonically increasing timestamps.
    const sortedChunks = [...chunks].sort((a, b) => a.timestamp - b.timestamp);

    // Mux to MP4
    const muxer = new Muxer({ filename: outputPath });

    muxer.addVideoTrack({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
      description: codecDescription,
    });

    for (const chunk of sortedChunks) {
      muxer.writeVideoChunk(chunk as any);
    }

    muxer.finalize();
    muxer.close();

    // Verify output file exists and has content
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify it's a valid MP4 by checking for ftyp box
    const header = fs.readFileSync(outputPath).slice(0, 12);
    const ftypOffset = header.indexOf('ftyp');
    expect(ftypOffset).toBeGreaterThanOrEqual(4); // ftyp should be in first 12 bytes
  });

  it('should be readable by Demuxer', async () => {
    const { VideoEncoder, VideoFrame, Muxer, Demuxer } = await import('../../dist/index.js');

    const outputPath = path.join(tempDir, 'roundtrip.mp4');
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 5;

    const chunks: Array<{ type: string; timestamp: number; duration: number; data: Uint8Array }> =
      [];
    let codecDescription: ArrayBuffer | undefined;

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration || 33333,
          data,
        });
        if (metadata?.decoderConfig?.description) {
          codecDescription = metadata.decoderConfig.description;
        }
      },
      error: (e) => {
        throw e;
      },
    });

    // Use avc format to get description (extradata) for MP4 container
    encoder.configure({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      bitrate: 1_000_000,
      framerate: 30,
      avc: { format: 'avc' },
    });

    for (let i = 0; i < FRAME_COUNT; i++) {
      const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const idx = (y * WIDTH + x) * 4;
          buffer[idx] = x % 256;
          buffer[idx + 1] = y % 256;
          buffer[idx + 2] = i * 50;
          buffer[idx + 3] = 255;
        }
      }

      const frame = new VideoFrame(buffer, {
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: i * 33333,
      });

      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    // Sort chunks by timestamp to handle B-frames (see first test for explanation)
    const sortedChunks = [...chunks].sort((a, b) => a.timestamp - b.timestamp);

    // Mux
    const muxer = new Muxer({ filename: outputPath });
    muxer.addVideoTrack({
      codec: 'avc1.42001e',
      width: WIDTH,
      height: HEIGHT,
      description: codecDescription,
    });

    for (const chunk of sortedChunks) {
      muxer.writeVideoChunk(chunk as any);
    }

    muxer.finalize();
    muxer.close();

    // Demux and verify
    let videoTrack: any = null;
    let demuxedChunks = 0;

    const demuxer = new Demuxer({
      onTrack: (track) => {
        if (track.type === 'video') {
          videoTrack = track;
        }
      },
      onChunk: () => {
        demuxedChunks++;
      },
      onError: (e) => {
        throw e;
      },
    });

    await demuxer.open(outputPath);
    await demuxer.demux();
    demuxer.close();

    expect(videoTrack).not.toBeNull();
    expect(videoTrack.width).toBe(WIDTH);
    expect(videoTrack.height).toBe(HEIGHT);
    expect(demuxedChunks).toBe(chunks.length);
  });
});
