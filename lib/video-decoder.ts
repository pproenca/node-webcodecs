/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * VideoDecoder class
 */

import { binding } from './binding';
import { CodecBase } from './codec-base';
import { ControlMessageQueue } from './control-message-queue';
import type { EncodedVideoChunk } from './encoded-chunks';
import * as is from './is';
import type { NativeModule, NativeVideoDecoder, VideoDecoderOutputCallback } from './native-types';
import { ResourceManager } from './resource-manager';
import type { CodecState, VideoDecoderConfig, VideoDecoderInit } from './types';
import { VideoFrame } from './video-frame';

// Load native addon with type assertion
const native = binding as NativeModule;

export class VideoDecoder extends CodecBase {
  private _native: NativeVideoDecoder;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;
  private _resourceId: symbol;

  constructor(init: VideoDecoderInit) {
    super();
    // W3C spec: output and error callbacks are required
    is.assertPlainObject(init, 'init');
    is.assertFunction(init.output, 'init.output');
    is.assertFunction(init.error, 'init.error');

    this._controlQueue = new ControlMessageQueue();
    this._errorCallback = init.error;
    this._controlQueue.setErrorHandler(init.error);
    this._resourceId = ResourceManager.getInstance().register(this);

    const outputCallback: VideoDecoderOutputCallback = (nativeFrame) => {
      this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

      // Wrap the native frame as a VideoFrame
      // biome-ignore lint/suspicious/noExplicitAny: Object.create wrapper pattern requires any for property assignment
      const wrapper = Object.create(VideoFrame.prototype) as any;
      wrapper._native = nativeFrame;
      wrapper._closed = false;
      wrapper._metadata = {}; // Initialize empty metadata for decoded frames
      init.output(wrapper as VideoFrame);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.VideoDecoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: VideoDecoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }
    this._needsKeyFrame = true;
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  decode(chunk: EncodedVideoChunk): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state !== 'configured') {
      throw new DOMException(`Cannot decode in state "${this.state}"`, 'InvalidStateError');
    }

    // Check if first chunk must be a key frame per W3C spec
    if (this._needsKeyFrame && chunk.type !== 'key') {
      this._errorCallback(
        new DOMException('First chunk after configure/reset must be a key frame', 'DataError'),
      );
      return;
    }
    this._needsKeyFrame = false;

    ResourceManager.getInstance().recordActivity(this._resourceId);
    this._decodeQueueSize++;
    // Pass the native chunk directly (no data copy needed)
    this._native.decode(chunk._native);
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(new DOMException('Decoder is not configured', 'InvalidStateError'));
    }
    if (this.state === 'closed') {
      return Promise.reject(new DOMException('Decoder is closed', 'InvalidStateError'));
    }
    await this._controlQueue.flush();

    // Flush the native decoder (waits for worker queue to drain)
    this._native.flush();

    // Poll for pending TSFN callbacks to complete.
    // This allows the event loop to run (delivering callbacks) while we wait.
    // Using setTimeout(1ms) instead of setImmediate to ensure other event loop
    // phases (timers, I/O) can run, preventing event loop starvation.
    while (this._native.pendingFrames > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms poll
    }
  }

  reset(): void {
    // W3C spec: throw InvalidStateError if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    this._controlQueue.clear();
    this._decodeQueueSize = 0;
    this._needsKeyFrame = true;
    this._native.reset();
  }

  close(): void {
    ResourceManager.getInstance().unregister(this._resourceId);
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: VideoDecoderConfig): Promise<{
    supported: boolean;
    config: VideoDecoderConfig;
  }> {
    return native.VideoDecoder.isConfigSupported(config);
  }
}
