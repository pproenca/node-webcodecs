// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import { EncodedVideoChunk } from './encoded-chunks';
import type { NativeDemuxer, NativeModule } from './native-types';
import type { DemuxerInit, TrackInfo } from './types';

const native = binding as NativeModule;

export class Demuxer {
  private _native: NativeDemuxer;

  constructor(init: DemuxerInit) {
    this._native = new native.Demuxer({
      onTrack: init.onTrack,
      onChunk: (
        chunk: {
          type: string;
          timestamp: number;
          duration?: number;
          data: Buffer;
        },
        trackIndex: number,
      ) => {
        if (init.onChunk) {
          const wrappedChunk = new EncodedVideoChunk({
            type: chunk.type as 'key' | 'delta',
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data,
          });
          init.onChunk(wrappedChunk, trackIndex);
        }
      },
      onError: init.onError,
    });
  }

  async open(path: string): Promise<void> {
    return this._native.open(path);
  }

  async demux(): Promise<void> {
    return this._native.demux();
  }

  /**
   * Read packets from the file in chunks.
   * This is useful for yielding to the event loop during demuxing.
   * @param maxPackets - Maximum number of packets to read. 0 = unlimited (reads all).
   * @returns The number of packets actually read.
   */
  demuxPackets(maxPackets?: number): number {
    return this._native.demuxPackets(maxPackets ?? 0);
  }

  close(): void {
    this._native.close();
  }

  getVideoTrack(): TrackInfo | null {
    return this._native.getVideoTrack();
  }

  getAudioTrack(): TrackInfo | null {
    return this._native.getAudioTrack();
  }
}
