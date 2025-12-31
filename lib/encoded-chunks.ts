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
import { detachArrayBuffers } from './transfer';
import type { EncodedAudioChunkInit, EncodedVideoChunkInit } from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

/**
 * FinalizationRegistry for automatic cleanup of native EncodedVideoChunk objects.
 * When a JS EncodedVideoChunk wrapper becomes unreachable, the registry callback
 * fires and releases the native memory via close().
 *
 * This provides a safety net for users who forget to call close(), preventing
 * memory leaks in high-throughput scenarios where GC may be delayed.
 */
const videoChunkRegistry = new FinalizationRegistry<NativeEncodedVideoChunk>((native) => {
  // The weak reference to the JS wrapper is now dead, but the native object
  // may still be valid. Call close() to release its internal data buffer.
  // close() is idempotent - safe to call even if already closed.
  try {
    native.close();
  } catch {
    // Ignore errors - native object may already be destroyed
  }
});

/**
 * FinalizationRegistry for automatic cleanup of native EncodedAudioChunk objects.
 */
const audioChunkRegistry = new FinalizationRegistry<NativeEncodedAudioChunk>((native) => {
  try {
    native.close();
  } catch {
    // Ignore errors - native object may already be destroyed
  }
});

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

    // Register with FinalizationRegistry for automatic cleanup.
    // When this JS wrapper is GC'd, the registry callback will call close()
    // on the native object to release memory.
    videoChunkRegistry.register(this, this._native, this);

    // Handle ArrayBuffer transfer semantics per W3C spec
    if (init.transfer && Array.isArray(init.transfer)) {
      detachArrayBuffers(init.transfer.filter((b): b is ArrayBuffer => b instanceof ArrayBuffer));
    }
  }

  /**
   * @internal
   * Wrap an existing native EncodedVideoChunk without copying data.
   * Used by the encoder's async output path to avoid double-copying.
   */
  static _fromNative(nativeChunk: NativeEncodedVideoChunk): EncodedVideoChunk {
    const chunk = Object.create(EncodedVideoChunk.prototype) as EncodedVideoChunk;
    chunk._native = nativeChunk;
    // Register with FinalizationRegistry for automatic cleanup
    videoChunkRegistry.register(chunk, nativeChunk, chunk);
    return chunk;
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

  /**
   * Releases the internal data buffer.
   * Per W3C WebCodecs spec, this allows early release of memory.
   */
  close(): void {
    // Unregister from FinalizationRegistry to prevent double-close.
    // If close() is called explicitly, we don't need the registry callback.
    videoChunkRegistry.unregister(this);
    this._native.close();
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

    // Register with FinalizationRegistry for automatic cleanup.
    // When this JS wrapper is GC'd, the registry callback will call close()
    // on the native object to release memory.
    audioChunkRegistry.register(this, this._native, this);

    // Handle ArrayBuffer transfer semantics per W3C spec
    if (init.transfer && Array.isArray(init.transfer)) {
      detachArrayBuffers(init.transfer.filter((b): b is ArrayBuffer => b instanceof ArrayBuffer));
    }
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

  /**
   * Releases the internal data buffer.
   * Per W3C WebCodecs spec, this allows early release of memory.
   */
  close(): void {
    // Unregister from FinalizationRegistry to prevent double-close.
    audioChunkRegistry.unregister(this);
    this._native.close();
  }

  get _nativeChunk(): NativeEncodedAudioChunk {
    return this._native;
  }
}
