/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * AudioEncoder class
 */

import type { AudioData } from './audio-data';
import { binding } from './binding';
import { CodecBase } from './codec-base';
import { ControlMessageQueue } from './control-message-queue';
import { EncodedAudioChunk } from './encoded-chunks';
import * as is from './is';
import type {
  AudioEncoderOutputCallback,
  NativeAudioEncoder,
  NativeEncodedAudioChunk,
  NativeModule,
} from './native-types';
import type { AudioEncoderConfig, AudioEncoderInit, CodecState } from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

export class AudioEncoder extends CodecBase {
  private _native: NativeAudioEncoder;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;

  constructor(init: AudioEncoderInit) {
    super();

    // W3C spec: output and error callbacks are required
    is.assertPlainObject(init, 'init');
    is.assertFunction(init.output, 'init.output');
    is.assertFunction(init.error, 'init.error');

    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioEncoderOutputCallback = (chunk, metadata) => {
      // Decrement queue size when output received
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(EncodedAudioChunk.prototype) as any;
      wrapper._native = chunk as unknown as NativeEncodedAudioChunk;
      init.output(wrapper as EncodedAudioChunk, metadata);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.AudioEncoder({
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

  configure(config: AudioEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // W3C spec: validate required fields with TypeError
    is.assertDefined(config.codec, 'config.codec');
    is.assertDefined(config.sampleRate, 'config.sampleRate');
    is.assertDefined(config.numberOfChannels, 'config.numberOfChannels');

    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  encode(data: AudioData): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state === 'unconfigured') {
      throw new DOMException('Encoder is not configured', 'InvalidStateError');
    }
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    this._encodeQueueSize++;
    // Call native encode directly - data must be valid at call time
    this._native.encode(data._nativeAudioData);
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
    return this._native.flush();
  }

  reset(): void {
    // W3C spec: reset() is a no-op when closed (does NOT throw)
    if (this.state === 'closed') {
      return;
    }

    this._controlQueue.clear();
    this._encodeQueueSize = 0;
    this._native.reset();
  }

  close(): void {
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: AudioEncoderConfig): Promise<{
    supported: boolean;
    config: AudioEncoderConfig;
  }> {
    return native.AudioEncoder.isConfigSupported(config);
  }
}
