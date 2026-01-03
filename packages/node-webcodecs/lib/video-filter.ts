// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { binding } from './binding';
import type { NativeModule, NativeVideoFilter, NativeVideoFrame } from './native-types';
import type { BlurRegion, CodecState, VideoFilterConfig } from './types';
import { VideoFrame } from './video-frame';

const native = binding as NativeModule;

export class VideoFilter {
  private _native: NativeVideoFilter;
  private _state: CodecState = 'unconfigured';

  constructor(config: VideoFilterConfig) {
    this._native = new native.VideoFilter(config);
  }

  get state(): CodecState {
    return this._state;
  }

  configure(config: VideoFilterConfig): void {
    this._native.configure(config);
    this._state = 'configured';
  }

  applyBlur(frame: VideoFrame, regions: BlurRegion[], strength: number = 20): VideoFrame {
    if (this._state === 'closed') {
      throw new DOMException('VideoFilter is closed', 'InvalidStateError');
    }
    const resultNativeFrame = this._native.applyBlur(
      frame._nativeFrame as NativeVideoFrame,
      regions,
      strength,
    );
    // biome-ignore lint/suspicious/noExplicitAny: Object.create wrapper pattern requires any for property assignment
    const wrapper = Object.create(VideoFrame.prototype) as any;
    wrapper._native = resultNativeFrame;
    wrapper._closed = false;
    wrapper._metadata = {};
    return wrapper as VideoFrame;
  }

  close(): void {
    this._native.close();
    this._state = 'closed';
  }
}
