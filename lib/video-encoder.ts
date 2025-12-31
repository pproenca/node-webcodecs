/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * VideoEncoder class
 */

import { binding } from './binding';
import { CodecBase } from './codec-base';
import { ControlMessageQueue } from './control-message-queue';
import { EncodedVideoChunk } from './encoded-chunks';
import * as is from './is';
import type { NativeModule, NativeVideoEncoder, VideoEncoderOutputCallback } from './native-types';
import { ResourceManager } from './resource-manager';
import type { CodecState, VideoEncoderConfig, VideoEncoderInit } from './types';
import type { VideoFrame } from './video-frame';

// Load native addon with type assertion
const native = binding as NativeModule;

export class VideoEncoder extends CodecBase {
  private _native: NativeVideoEncoder;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;
  private _resourceId: symbol;

  constructor(init: VideoEncoderInit) {
    super();
    // W3C spec: output and error callbacks are required
    is.assertPlainObject(init, 'init');
    is.assertFunction(init.output, 'init.output');
    is.assertFunction(init.error, 'init.error');

    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);
    this._resourceId = ResourceManager.getInstance().register(this);

    const outputCallback: VideoEncoderOutputCallback = (chunk, metadata) => {
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      // The native layer now returns an EncodedVideoChunk directly (not a plain object).
      // Check if it's already a native chunk (has close method) vs plain object (has data buffer).
      // Native chunks have close() but no 'data' property; plain objects have 'data' buffer.
      let wrappedChunk: EncodedVideoChunk;
      if ('data' in chunk && chunk.data instanceof Buffer) {
        // Legacy path: plain object from sync encoder - wrap it
        wrappedChunk = new EncodedVideoChunk({
          type: chunk.type as 'key' | 'delta',
          timestamp: chunk.timestamp,
          duration: chunk.duration ?? undefined,
          data: chunk.data,
        });
      } else {
        // New path: already a native EncodedVideoChunk from async encoder
        // Wrap without copying data
        wrappedChunk = EncodedVideoChunk._fromNative(
          chunk as unknown as import('./native-types').NativeEncodedVideoChunk,
        );
      }
      init.output(wrappedChunk, metadata);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.VideoEncoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: VideoEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // Validate display dimensions pairing per W3C spec
    if ((config.displayWidth !== undefined) !== (config.displayHeight !== undefined)) {
      throw new TypeError('displayWidth and displayHeight must both be present or both absent');
    }

    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
    // W3C spec: throw if not configured
    if (this.state !== 'configured') {
      throw new DOMException(`Encoder is ${this.state}`, 'InvalidStateError');
    }
    ResourceManager.getInstance().recordActivity(this._resourceId);
    this._encodeQueueSize++;
    // Call native encode directly - frame must be valid at call time
    this._native.encode(frame._nativeFrame, options || {});
  }

  async flush(): Promise<void> {
    // W3C spec: reject if unconfigured or closed
    if (this.state === 'unconfigured') {
      return Promise.reject(new DOMException('Encoder is not configured', 'InvalidStateError'));
    }
    if (this.state === 'closed') {
      return Promise.reject(new DOMException('Encoder is closed', 'InvalidStateError'));
    }
    await this._controlQueue.flush();

    // Flush the native encoder (waits for worker queue to drain)
    this._native.flush();

    // Poll for pending TSFN callbacks to complete.
    // This allows the event loop to run (delivering callbacks) while we wait.
    // Using setTimeout(1ms) instead of setImmediate to ensure other event loop
    // phases (timers, I/O) can run, preventing event loop starvation.
    while (this._native.pendingChunks > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms poll
    }
  }

  reset(): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }
    this._controlQueue.clear();
    this._encodeQueueSize = 0;
    this._native.reset();
  }

  close(): void {
    ResourceManager.getInstance().unregister(this._resourceId);
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: VideoEncoderConfig): Promise<{
    supported: boolean;
    config: VideoEncoderConfig;
  }> {
    return native.VideoEncoder.isConfigSupported(config);
  }
}
