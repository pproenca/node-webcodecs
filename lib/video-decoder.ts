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

// Default backpressure threshold for limiting in-flight chunks
const DEFAULT_MAX_QUEUE_DEPTH = 16;

export class VideoDecoder extends CodecBase {
  private _native: NativeVideoDecoder;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;
  private _resourceId: symbol;

  // Backpressure support
  private _maxQueueDepth: number = DEFAULT_MAX_QUEUE_DEPTH;

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

  /**
   * Returns the number of pending frames waiting to be delivered via output callback.
   * This tracks frames that have been decoded by the worker but not yet delivered to JS.
   */
  get pendingFrames(): number {
    return this._native.pendingFrames;
  }

  /**
   * Returns a Promise that resolves when the decoder has capacity for more chunks.
   * Use this to implement backpressure in high-throughput decoding pipelines.
   *
   * When the internal queue is full (decodeQueueSize >= maxQueueDepth), calling
   * `await decoder.ready` will pause until capacity is available.
   *
   * @example
   * for (const chunk of chunks) {
   *   await decoder.ready;  // Wait for capacity
   *   decoder.decode(chunk);
   * }
   */
  get ready(): Promise<void> {
    // If we have capacity, resolve immediately
    if (this._decodeQueueSize < this._maxQueueDepth) {
      return Promise.resolve();
    }

    // Otherwise, poll until capacity is available.
    // We use setTimeout(1ms) polling to allow TSFN output callbacks to execute.
    // setTimeout ensures we yield through the full event loop cycle, including
    // the I/O phase where TSFN callbacks are delivered.
    return new Promise<void>((resolve) => {
      const checkCapacity = () => {
        if (this._decodeQueueSize < this._maxQueueDepth) {
          resolve();
        } else {
          // Yield full event loop cycle to allow output callbacks to run
          setTimeout(checkCapacity, 1);
        }
      };
      // Initial yield to allow any pending callbacks to run
      setTimeout(checkCapacity, 1);
    });
  }

  /**
   * The maximum queue depth before backpressure is applied.
   * Default is 16. Adjust based on memory constraints and frame size.
   */
  get maxQueueDepth(): number {
    return this._maxQueueDepth;
  }

  set maxQueueDepth(value: number) {
    if (value < 1) {
      throw new RangeError('maxQueueDepth must be at least 1');
    }
    this._maxQueueDepth = value;
  }

  configure(config: VideoDecoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // Validate rotation (node-webcodecs extension)
    if ('rotation' in config && config.rotation !== undefined) {
      if (![0, 90, 180, 270].includes(config.rotation)) {
        throw new TypeError(`rotation must be 0, 90, 180, or 270, got ${config.rotation}`);
      }
    }

    // Validate flip (node-webcodecs extension)
    if ('flip' in config && config.flip !== undefined) {
      if (typeof config.flip !== 'boolean') {
        throw new TypeError('flip must be a boolean');
      }
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

    // Flush the native decoder - the promise resolves when the worker
    // completes processing all queued frames
    await this._native.flush();

    // Poll for any remaining pending TSFN callbacks to complete.
    // Even after flush resolves, TSFN callbacks may still be queued.
    // This allows the event loop to run (delivering callbacks) while we wait.
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
