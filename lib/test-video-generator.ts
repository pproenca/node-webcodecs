// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { NativeModule, NativeTestVideoGenerator, NativeVideoFrame } from './native-types';
import type { CodecState, TestVideoGeneratorConfig } from './types';
import { VideoFrame } from './video-frame';

const native = binding as NativeModule;

export class TestVideoGenerator {
  private _native: NativeTestVideoGenerator;

  constructor() {
    this._native = new native.TestVideoGenerator();
  }

  get state(): CodecState {
    return this._native.state as CodecState;
  }

  configure(config: TestVideoGeneratorConfig): void {
    this._native.configure(config);
  }

  async generate(callback: (frame: VideoFrame) => void): Promise<void> {
    return this._native.generate((nativeFrame: NativeVideoFrame) => {
      // biome-ignore lint/suspicious/noExplicitAny: Object.create wrapper pattern requires any for property assignment
      const wrapper = Object.create(VideoFrame.prototype) as any;
      wrapper._native = nativeFrame;
      wrapper._closed = false;
      wrapper._metadata = {};
      callback(wrapper as VideoFrame);
    });
  }

  close(): void {
    this._native.close();
  }
}
