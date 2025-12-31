/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * AudioData class
 */

import { binding } from './binding';
import type { NativeAudioData, NativeModule } from './native-types';
import { detachArrayBuffers } from './transfer';
import type { AudioDataCopyToOptions, AudioDataInit, AudioSampleFormat } from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

export class AudioData {
  private _native: NativeAudioData;
  private _closed: boolean = false;

  constructor(init: AudioDataInit) {
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(init.data.buffer, init.data.byteOffset, init.data.byteLength);
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.AudioData({
      format: init.format,
      sampleRate: init.sampleRate,
      numberOfFrames: init.numberOfFrames,
      numberOfChannels: init.numberOfChannels,
      timestamp: init.timestamp,
      data: dataBuffer,
    });

    // Handle ArrayBuffer transfer semantics per W3C WebCodecs spec
    if (init.transfer && Array.isArray(init.transfer)) {
      detachArrayBuffers(init.transfer);
    }
  }

  get format(): AudioSampleFormat | null {
    return this._closed ? null : this._native.format;
  }

  get sampleRate(): number {
    return this._closed ? 0 : this._native.sampleRate;
  }

  get numberOfFrames(): number {
    return this._closed ? 0 : this._native.numberOfFrames;
  }

  get numberOfChannels(): number {
    return this._closed ? 0 : this._native.numberOfChannels;
  }

  get duration(): number {
    return this._closed ? 0 : this._native.duration;
  }

  get timestamp(): number {
    return this._closed ? 0 : this._native.timestamp;
  }

  allocationSize(options: AudioDataCopyToOptions): number {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
    }
    // W3C spec: planeIndex is required
    if (options.planeIndex === undefined || options.planeIndex === null) {
      throw new TypeError(
        "Failed to execute 'allocationSize' on 'AudioData': required member planeIndex is undefined.",
      );
    }
    return this._native.allocationSize(options);
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView, options: AudioDataCopyToOptions): void {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
    }
    // W3C spec: planeIndex is required
    if (options.planeIndex === undefined || options.planeIndex === null) {
      throw new TypeError(
        "Failed to execute 'copyTo' on 'AudioData': required member planeIndex is undefined.",
      );
    }

    // W3C spec: check destination buffer size before copying
    // Must throw RangeError if buffer is too small
    const requiredSize = this._native.allocationSize(options);
    const destSize = destination.byteLength;
    if (destSize < requiredSize) {
      throw new RangeError(
        `destination buffer too small: requires ${requiredSize} bytes, got ${destSize}`,
      );
    }

    let destBuffer: Buffer;
    if (destination instanceof ArrayBuffer) {
      destBuffer = Buffer.from(destination);
    } else {
      destBuffer = Buffer.from(destination.buffer, destination.byteOffset, destination.byteLength);
    }
    this._native.copyTo(destBuffer, options);
    // Copy back to original if it was an ArrayBuffer
    if (destination instanceof ArrayBuffer) {
      new Uint8Array(destination).set(destBuffer);
    }
  }

  clone(): AudioData {
    if (this._closed) {
      throw new DOMException('AudioData is closed', 'InvalidStateError');
    }
    const clonedNative = this._native.clone();
    const wrapper = Object.create(AudioData.prototype);
    wrapper._native = clonedNative;
    wrapper._closed = false;
    return wrapper;
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  get _nativeAudioData(): NativeAudioData {
    return this._native;
  }
}
