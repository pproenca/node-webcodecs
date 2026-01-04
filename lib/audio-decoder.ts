/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * AudioDecoder class
 */

import { AudioData } from './audio-data';
import { binding } from './binding';
import { CodecBase } from './codec-base';
import { ControlMessageQueue } from './control-message-queue';
import type { EncodedAudioChunk } from './encoded-chunks';
import * as is from './is';
import type { AudioDecoderOutputCallback, NativeAudioDecoder, NativeModule } from './native-types';
import type { AudioDecoderConfig, AudioDecoderInit, CodecState } from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

export class AudioDecoder extends CodecBase {
  private _native: NativeAudioDecoder;
  private _controlQueue: ControlMessageQueue;
  private _decodeQueueSize: number = 0;
  private _needsKeyFrame: boolean = true;
  private _errorCallback: (error: DOMException) => void;

  constructor(init: AudioDecoderInit) {
    super();
    // W3C spec: output and error callbacks are required
    is.assertPlainObject(init, 'init');
    is.assertFunction(init.output, 'init.output');
    is.assertFunction(init.error, 'init.error');

    this._controlQueue = new ControlMessageQueue();
    this._errorCallback = init.error;
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioDecoderOutputCallback = (nativeData) => {
      this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

      // biome-ignore lint/suspicious/noExplicitAny: Object.create wrapper pattern requires any for property assignment
      const wrapper = Object.create(AudioData.prototype) as any;
      wrapper._native = nativeData;
      wrapper._closed = false;
      init.output(wrapper as AudioData);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.AudioDecoder({
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

  configure(config: AudioDecoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // W3C spec: validate config is a valid AudioDecoderConfig
    is.assertDefined(config.codec, 'config.codec');
    is.assertDefined(config.sampleRate, 'config.sampleRate');
    is.assertDefined(config.numberOfChannels, 'config.numberOfChannels');

    // Validate codec is not empty
    if (typeof config.codec === 'string' && config.codec.trim() === '') {
      throw new TypeError('config.codec cannot be empty');
    }

    // Validate positive values (W3C spec: unsigned long requires positive integer)
    is.assertPositiveInteger(config.sampleRate, 'config.sampleRate');
    is.assertPositiveInteger(config.numberOfChannels, 'config.numberOfChannels');

    this._needsKeyFrame = true;
    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  decode(chunk: EncodedAudioChunk): void {
    // W3C spec: throw InvalidStateError if not configured
    if (this.state === 'unconfigured') {
      throw new DOMException('Decoder is unconfigured', 'InvalidStateError');
    }
    if (this.state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // Check if first chunk must be a key frame per W3C spec
    if (this._needsKeyFrame && chunk.type !== 'key') {
      this._errorCallback(
        new DOMException('First chunk after configure/reset must be a key frame', 'DataError'),
      );
      return;
    }
    this._needsKeyFrame = false;

    this._decodeQueueSize++;
    // Call native decode directly - chunk must be valid at call time
    this._native.decode(chunk._nativeChunk);
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
    return this._native.flush();
  }

  reset(): void {
    // W3C spec: reset() is a no-op when closed (does NOT throw)
    if (this.state === 'closed') {
      return;
    }
    this._controlQueue.clear();
    this._decodeQueueSize = 0;
    this._needsKeyFrame = true;
    this._native.reset();
  }

  close(): void {
    this._controlQueue.clear();
    this._native.close();
  }

  static async isConfigSupported(config: AudioDecoderConfig): Promise<{
    supported: boolean;
    config: AudioDecoderConfig;
  }> {
    return native.AudioDecoder.isConfigSupported(config);
  }
}
