/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * ImageDecoder class
 */

import { binding } from './binding';
import { ImageTrack } from './image-track';
import { ImageTrackList } from './image-track-list';
import type { NativeImageDecoder, NativeModule } from './native-types';
import { detachArrayBuffers } from './transfer';
import type { ImageDecodeOptions, ImageDecodeResult, ImageDecoderInit } from './types';
import { VideoFrame } from './video-frame';

// Load native addon with type assertion
const native = binding as NativeModule;

export class ImageDecoder {
  private _native: NativeImageDecoder | null = null;
  private _closed: boolean = false;
  private _tracks: ImageTrackList | null = null;
  private _type: string;
  private _isStreaming: boolean = false;
  private _completed: Promise<void>;
  private _completedResolve!: () => void;
  private _completedReject!: (error: Error) => void;
  private _tracksReadyResolve!: () => void;
  private _tracksReadyReject!: (error: Error) => void;
  private _tracksReadyPromise: Promise<void>;
  private _initOptions: Omit<ImageDecoderInit, 'data'> | null = null;

  constructor(init: ImageDecoderInit) {
    // Store type immediately for the type getter
    this._type = init.type;

    // Create completed promise
    this._completed = new Promise<void>((resolve, reject) => {
      this._completedResolve = resolve;
      this._completedReject = reject;
    });

    // Create tracks ready promise
    this._tracksReadyPromise = new Promise<void>((resolve, reject) => {
      this._tracksReadyResolve = resolve;
      this._tracksReadyReject = reject;
    });

    // Store init options (without data) for streaming case
    this._initOptions = {
      type: init.type,
      colorSpaceConversion: init.colorSpaceConversion,
      desiredWidth: init.desiredWidth,
      desiredHeight: init.desiredHeight,
      preferAnimation: init.preferAnimation,
    };

    // Handle ReadableStream
    if (init.data && typeof init.data === 'object' && 'getReader' in init.data) {
      this._isStreaming = true;
      // Fire and forget - errors are captured by _completedReject
      void this._consumeStream(init.data as ReadableStream<Uint8Array>);
      return;
    }

    // Convert data to Buffer if needed
    let dataBuffer: Buffer;
    if (init.data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(init.data);
    } else if (ArrayBuffer.isView(init.data)) {
      dataBuffer = Buffer.from(init.data.buffer, init.data.byteOffset, init.data.byteLength);
    } else {
      throw new TypeError('data must be ArrayBuffer or ArrayBufferView');
    }

    // Handle transfer option - detach specified ArrayBuffers per W3C spec
    if (init.transfer && init.transfer.length > 0) {
      detachArrayBuffers(init.transfer);
    }

    this._initializeNative(dataBuffer, init);
  }

  private _initializeNative(dataBuffer: Buffer, init: ImageDecoderInit | { type: string }): void {
    // Build native init object with all supported options
    const nativeInit: {
      type: string;
      data: Buffer;
      colorSpaceConversion?: string;
      desiredWidth?: number;
      desiredHeight?: number;
      preferAnimation?: boolean;
    } = {
      type: init.type,
      data: dataBuffer,
    };

    // Pass additional options if they are present in the full init object
    if ('colorSpaceConversion' in init && init.colorSpaceConversion) {
      nativeInit.colorSpaceConversion = init.colorSpaceConversion;
    }
    if ('desiredWidth' in init && init.desiredWidth !== undefined) {
      nativeInit.desiredWidth = init.desiredWidth;
    }
    if ('desiredHeight' in init && init.desiredHeight !== undefined) {
      nativeInit.desiredHeight = init.desiredHeight;
    }
    if ('preferAnimation' in init && init.preferAnimation !== undefined) {
      nativeInit.preferAnimation = init.preferAnimation;
    }

    this._native = new native.ImageDecoder(nativeInit);
    this._isStreaming = false;
    this._completedResolve();
    this._tracksReadyResolve();
  }

  private async _consumeStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      // Concatenate all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const fullData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullData.set(chunk, offset);
        offset += chunk.length;
      }

      // Initialize native decoder with complete data and stored options
      this._initializeNative(Buffer.from(fullData), this._initOptions || { type: this._type });
    } catch (error) {
      // Cancel the reader to properly clean up and prevent additional rejections
      try {
        await reader.cancel();
      } catch {
        // Ignore cancel errors
      }
      this._completedReject(error as Error);
      this._tracksReadyReject(error as Error);
    }
  }

  get type(): string {
    return this._type;
  }

  get complete(): boolean {
    if (this._isStreaming) {
      return false;
    }
    return this._native?.complete ?? false;
  }

  get tracks(): ImageTrackList {
    if (this._tracks === null) {
      // For streaming, return empty list until ready
      if (this._isStreaming || !this._native) {
        this._tracks = new ImageTrackList([], this._tracksReadyPromise);
        // Update tracks when stream completes - fire and forget
        void this._tracksReadyPromise.then(() => {
          if (this._native && this._tracks) {
            const nativeTracks = this._native.tracks;
            const tracks: ImageTrack[] = [];

            for (let i = 0; i < nativeTracks.length; i++) {
              const nt = nativeTracks[i];
              tracks.push(
                new ImageTrack({
                  animated: nt.animated,
                  frameCount: nt.frameCount,
                  repetitionCount: nt.repetitionCount,
                  selected: nt.selected,
                }),
              );
            }
            // Update the internal tracks array
            (this._tracks as ImageTrackList)._updateTracks(tracks);
          }
        });
        return this._tracks;
      }

      const nativeTracks = this._native.tracks;
      const tracks: ImageTrack[] = [];

      for (let i = 0; i < nativeTracks.length; i++) {
        const nt = nativeTracks[i];
        tracks.push(
          new ImageTrack({
            animated: nt.animated,
            frameCount: nt.frameCount,
            repetitionCount: nt.repetitionCount,
            selected: nt.selected,
          }),
        );
      }

      this._tracks = new ImageTrackList(tracks, Promise.resolve());
    }
    return this._tracks;
  }

  get completed(): Promise<void> {
    return this._completed;
  }

  async decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult> {
    if (this._closed) {
      throw new DOMException('ImageDecoder is closed', 'InvalidStateError');
    }

    // Wait for stream to complete if streaming
    await this._completed;

    if (!this._native) {
      throw new DOMException('ImageDecoder failed to initialize', 'DataError');
    }

    const result = await this._native.decode(options || {});

    if (!result.image) {
      throw new DOMException('Failed to decode image', 'EncodingError');
    }

    // Wrap the native frame as a VideoFrame
    // biome-ignore lint/suspicious/noExplicitAny: Object.create wrapper pattern requires any for property assignment
    const wrapper = Object.create(VideoFrame.prototype) as any;
    wrapper._native = result.image;
    wrapper._closed = false;
    wrapper._metadata = {}; // Initialize empty metadata for decoded images

    return {
      image: wrapper as VideoFrame,
      complete: result.complete,
    };
  }

  reset(): void {
    // No-op for static images
  }

  close(): void {
    if (!this._closed) {
      if (this._native) {
        this._native.close();
      }
      this._closed = true;
    }
  }

  static async isTypeSupported(type: string): Promise<boolean> {
    return native.ImageDecoder.isTypeSupported(type);
  }
}
