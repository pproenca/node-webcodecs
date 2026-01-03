// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { EncodedAudioChunk, EncodedVideoChunk } from './encoded-chunks';
import type { NativeModule, NativeMuxer } from './native-types';
import type { MuxerAudioTrackConfig, MuxerInit, MuxerVideoTrackConfig } from './types';

const native = binding as NativeModule;

export class Muxer {
  private _native: NativeMuxer;

  constructor(init: MuxerInit) {
    this._native = new native.Muxer({ filename: init.filename });
  }

  addVideoTrack(config: MuxerVideoTrackConfig): number {
    return this._native.addVideoTrack(config);
  }

  addAudioTrack(config: MuxerAudioTrackConfig): number {
    return this._native.addAudioTrack(config);
  }

  writeVideoChunk(chunk: EncodedVideoChunk): void {
    this._native.writeVideoChunk(chunk);
  }

  writeAudioChunk(chunk: EncodedAudioChunk): void {
    this._native.writeAudioChunk(chunk);
  }

  finalize(): void {
    this._native.finalize();
  }

  close(): void {
    this._native.close();
  }
}
