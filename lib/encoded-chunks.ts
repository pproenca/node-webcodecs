/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * EncodedVideoChunk and EncodedAudioChunk classes
 */

import { binding } from './binding';
import type {
  NativeEncodedAudioChunk,
  NativeEncodedVideoChunk,
  NativeModule,
} from './native-types';
import type { EncodedAudioChunkInit, EncodedVideoChunkInit } from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

export class EncodedVideoChunk {
  /** @internal */
  _native: NativeEncodedVideoChunk;

  constructor(init: EncodedVideoChunkInit) {
    // W3C spec: type must be 'key' or 'delta'
    if (init.type !== 'key' && init.type !== 'delta') {
      throw new TypeError(`Invalid type: ${init.type}`);
    }
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(init.data.buffer, init.data.byteOffset, init.data.byteLength);
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.EncodedVideoChunk({
      type: init.type,
      timestamp: init.timestamp,
      duration: init.duration,
      data: dataBuffer,
    });
  }

  get type(): 'key' | 'delta' {
    return this._native.type as 'key' | 'delta';
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  get duration(): number | null {
    return this._native.duration;
  }

  get byteLength(): number {
    return this._native.byteLength;
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView): void {
    // Native layer accepts ArrayBuffer or Uint8Array
    if (destination instanceof ArrayBuffer) {
      this._native.copyTo(destination);
    } else if (destination instanceof Uint8Array) {
      this._native.copyTo(destination);
    } else if (ArrayBuffer.isView(destination)) {
      // Convert other ArrayBufferView types to Uint8Array
      const view = new Uint8Array(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
      this._native.copyTo(view);
    } else {
      throw new TypeError('Destination must be ArrayBuffer or ArrayBufferView');
    }
  }
}

export class EncodedAudioChunk {
  private _native: NativeEncodedAudioChunk;

  constructor(init: EncodedAudioChunkInit) {
    // W3C spec: type must be 'key' or 'delta'
    if (init.type !== 'key' && init.type !== 'delta') {
      throw new TypeError(`Invalid type: ${init.type}`);
    }

    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(init.data.buffer, init.data.byteOffset, init.data.byteLength);
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }
    this._native = new native.EncodedAudioChunk({
      type: init.type,
      timestamp: init.timestamp,
      duration: init.duration,
      data: dataBuffer,
    });
  }

  get type(): 'key' | 'delta' {
    return this._native.type as 'key' | 'delta';
  }

  get timestamp(): number {
    return this._native.timestamp;
  }

  get duration(): number | null {
    return this._native.duration ?? null;
  }

  get byteLength(): number {
    return this._native.byteLength;
  }

  copyTo(destination: ArrayBuffer | ArrayBufferView): void {
    // Convert ArrayBufferView to Uint8Array for native layer
    if (destination instanceof ArrayBuffer) {
      this._native.copyTo(destination);
    } else {
      const uint8 = new Uint8Array(
        destination.buffer,
        destination.byteOffset,
        destination.byteLength,
      );
      this._native.copyTo(uint8);
    }
  }

  get _nativeChunk(): NativeEncodedAudioChunk {
    return this._native;
  }
}
