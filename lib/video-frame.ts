/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * VideoFrame and VideoColorSpace classes
 */

import { binding } from './binding';
import { type ImageDataLike, isImageData } from './is';
import type { NativeModule, NativeVideoFrame } from './native-types';
import { detachArrayBuffers } from './transfer';
import type {
  DOMRectReadOnly,
  PlaneLayout,
  VideoColorPrimaries,
  VideoColorSpaceInit,
  VideoFrameBufferInit,
  VideoFrameCopyToOptions,
  VideoFrameInit,
  VideoFrameMetadata,
  VideoMatrixCoefficients,
  VideoPixelFormat,
  VideoTransferCharacteristics,
} from './types';

// Load native addon with type assertion
const native = binding as NativeModule;

export class VideoColorSpace {
  readonly primaries: VideoColorPrimaries | null;
  readonly transfer: VideoTransferCharacteristics | null;
  readonly matrix: VideoMatrixCoefficients | null;
  readonly fullRange: boolean | null;

  constructor(init?: VideoColorSpaceInit) {
    // Cast to enum types - values from native layer should match W3C enums
    this.primaries = (init?.primaries as VideoColorPrimaries) ?? null;
    this.transfer = (init?.transfer as VideoTransferCharacteristics) ?? null;
    this.matrix = (init?.matrix as VideoMatrixCoefficients) ?? null;
    this.fullRange = init?.fullRange ?? null;
  }

  toJSON(): VideoColorSpaceInit {
    return {
      primaries: this.primaries,
      transfer: this.transfer,
      matrix: this.matrix,
      fullRange: this.fullRange,
    };
  }
}

export class VideoFrame {
  private _native: NativeVideoFrame;
  private _closed: boolean = false;
  private _metadata: VideoFrameMetadata;
  private _timestampOverride?: number;
  private _durationOverride?: number;
  private _visibleRectOverride?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /**
   * Constructs a VideoFrame from raw data, ImageData, or from an existing VideoFrame.
   *
   * Per W3C WebCodecs spec, VideoFrame can be constructed from:
   * 1. ImageData - self-describing RGBA buffer (Node.js alternative to CanvasImageSource)
   * 2. Raw buffer data with VideoFrameBufferInit
   * 3. An existing VideoFrame with optional VideoFrameInit overrides
   */
  constructor(imageData: ImageDataLike, init?: VideoFrameInit);
  constructor(data: Buffer | Uint8Array | ArrayBuffer, init: VideoFrameBufferInit);
  constructor(source: VideoFrame, init?: VideoFrameInit);
  constructor(
    dataOrSourceOrImageData: Buffer | Uint8Array | ArrayBuffer | VideoFrame | ImageDataLike,
    init?: VideoFrameBufferInit | VideoFrameInit,
  ) {
    // Check if constructing from ImageData (self-describing RGBA)
    // ImageData is canvas.getContext('2d').getImageData() compatible
    if (isImageData(dataOrSourceOrImageData)) {
      const imageData = dataOrSourceOrImageData;
      const frameInit = init as VideoFrameInit | undefined;

      // Validate data size matches dimensions (width * height * 4 for RGBA)
      const expectedSize = imageData.width * imageData.height * 4;
      if (imageData.data.length !== expectedSize) {
        throw new TypeError(
          `ImageData.data length (${imageData.data.length}) does not match ` +
            `expected size (${expectedSize}) for ${imageData.width}x${imageData.height} RGBA`,
        );
      }

      // Convert Uint8ClampedArray to Buffer for native binding
      const dataBuffer = Buffer.from(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );

      // Build VideoFrameBufferInit from ImageData dimensions
      // ImageData is always RGBA format from canvas
      const bufferInit: VideoFrameBufferInit = {
        format: 'RGBA',
        codedWidth: imageData.width,
        codedHeight: imageData.height,
        timestamp: frameInit?.timestamp ?? 0,
        duration: frameInit?.duration,
        visibleRect: frameInit?.visibleRect,
        displayWidth: frameInit?.displayWidth ?? imageData.width,
        displayHeight: frameInit?.displayHeight ?? imageData.height,
        metadata: frameInit?.metadata,
      };

      this._native = new native.VideoFrame(dataBuffer, bufferInit);
      this._metadata = bufferInit.metadata ?? {};
      this._closed = false;
      return;
    }

    // Check if constructing from existing VideoFrame
    if (dataOrSourceOrImageData instanceof VideoFrame) {
      const source = dataOrSourceOrImageData;
      const frameInit = init as VideoFrameInit | undefined;

      // W3C spec: throw InvalidStateError if source frame is closed (detached)
      if (source._closed) {
        throw new DOMException(
          'Cannot construct VideoFrame from closed VideoFrame',
          'InvalidStateError',
        );
      }

      // Clone the native frame
      this._native = source._native.clone();
      this._closed = false;

      // Copy metadata from source
      this._metadata = { ...source._metadata };

      // Apply overrides from init if provided
      if (frameInit) {
        // Override timestamp if provided
        if (frameInit.timestamp !== undefined) {
          this._timestampOverride = frameInit.timestamp;
        }

        // Override duration if provided
        if (frameInit.duration !== undefined) {
          this._durationOverride = frameInit.duration;
        }

        // Override visibleRect if provided
        if (frameInit.visibleRect) {
          this._visibleRectOverride = {
            x: frameInit.visibleRect.x ?? 0,
            y: frameInit.visibleRect.y ?? 0,
            width: frameInit.visibleRect.width ?? this._native.visibleRect.width,
            height: frameInit.visibleRect.height ?? this._native.visibleRect.height,
          };
        }

        // Override metadata if provided
        if (frameInit.metadata) {
          this._metadata = { ...this._metadata, ...frameInit.metadata };
        }
      }
      return;
    }

    // Original buffer-based construction
    const data = dataOrSourceOrImageData;
    const bufferInit = init as VideoFrameBufferInit;

    // Spec 9.4.2: format is a required member of VideoFrameBufferInit
    if (!bufferInit.format) {
      throw new TypeError('format is required for buffer constructor');
    }

    // Convert to Buffer if needed
    let dataBuffer: Buffer;
    if (data instanceof Buffer) {
      dataBuffer = data;
    } else if (data instanceof Uint8Array) {
      dataBuffer = Buffer.from(data);
    } else if (data instanceof ArrayBuffer) {
      dataBuffer = Buffer.from(data);
    } else {
      throw new TypeError('data must be Buffer, Uint8Array, or ArrayBuffer');
    }
    this._native = new native.VideoFrame(dataBuffer, bufferInit);

    // Store metadata per W3C VideoFrame Metadata Registry
    this._metadata = bufferInit.metadata ?? {};

    // Handle ArrayBuffer transfer semantics per W3C WebCodecs spec
    if (bufferInit.transfer && Array.isArray(bufferInit.transfer)) {
      detachArrayBuffers(bufferInit.transfer);
    }
  }

  get codedWidth(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.codedWidth;
  }

  get codedHeight(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.codedHeight;
  }

  get timestamp(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    if (this._timestampOverride !== undefined) {
      return this._timestampOverride;
    }
    return this._native.timestamp;
  }

  get format(): VideoPixelFormat | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Cast native format string to VideoPixelFormat enum
    return (this._native.format as VideoPixelFormat) ?? null;
  }

  get duration(): number | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    if (this._durationOverride !== undefined) {
      return this._durationOverride;
    }
    return this._native.duration ?? null;
  }

  get displayWidth(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.displayWidth;
  }

  get displayHeight(): number {
    // W3C spec: return 0 when [[Detached]] is true
    if (this._closed) return 0;
    return this._native.displayHeight;
  }

  get codedRect(): DOMRectReadOnly | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    const w = this.codedWidth;
    const h = this.codedHeight;
    return {
      x: 0,
      y: 0,
      width: w,
      height: h,
      top: 0,
      left: 0,
      right: w,
      bottom: h,
    };
  }

  get visibleRect(): DOMRectReadOnly | null {
    // W3C spec: return null when [[Detached]] is true
    if (this._closed) return null;
    // Return override if set (from VideoFrame-from-VideoFrame construction)
    const rect = this._visibleRectOverride ?? this._native.visibleRect;
    // Return DOMRectReadOnly-compatible object with computed right/bottom/top/left
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    };
  }

  get colorSpace(): VideoColorSpace {
    // Return VideoColorSpace from native colorSpace data if available
    const nativeColorSpace = this._native.colorSpace;
    return new VideoColorSpace(nativeColorSpace);
  }

  get rotation(): number {
    return this._native.rotation ?? 0;
  }

  get flip(): boolean {
    return this._native.flip ?? false;
  }

  metadata(): VideoFrameMetadata {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    // Return a copy to prevent external mutation
    return { ...this._metadata };
  }

  close(): void {
    if (!this._closed) {
      this._native.close();
      this._closed = true;
    }
  }

  async copyTo(
    destination: ArrayBuffer | Uint8Array,
    options?: VideoFrameCopyToOptions,
  ): Promise<PlaneLayout[]> {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }

    // W3C spec: validate rect bounds before copying
    if (options?.rect) {
      const rect = options.rect;
      const rectX = rect.x ?? 0;
      const rectY = rect.y ?? 0;
      const rectWidth = rect.width ?? this._native.codedWidth;
      const rectHeight = rect.height ?? this._native.codedHeight;

      if (
        rectX < 0 ||
        rectY < 0 ||
        rectX + rectWidth > this._native.codedWidth ||
        rectY + rectHeight > this._native.codedHeight
      ) {
        throw new RangeError('rect exceeds coded frame dimensions');
      }
    }

    // Convert ArrayBuffer to Buffer for native layer
    let destBuffer: Buffer;
    let destLength: number;
    if (destination instanceof ArrayBuffer) {
      destBuffer = Buffer.from(destination);
      destLength = destination.byteLength;
    } else if (destination instanceof Uint8Array) {
      destBuffer = Buffer.from(destination.buffer, destination.byteOffset, destination.byteLength);
      destLength = destination.byteLength;
    } else {
      throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
    }

    // W3C spec: validate buffer size before copying
    // When rect is specified, calculate size based on rect dimensions
    let requiredSize: number;
    if (options?.rect) {
      const rect = options.rect;
      const rectWidth = rect.width ?? this._native.codedWidth;
      const rectHeight = rect.height ?? this._native.codedHeight;
      // For buffer size validation with rect, calculate based on rect dimensions
      // The native allocationSize doesn't accept rect, so we calculate here
      const format = this._native.format;
      if (format === 'RGBA' || format === 'RGBX' || format === 'BGRA' || format === 'BGRX') {
        // Packed RGB formats: 4 bytes per pixel
        requiredSize = rectWidth * rectHeight * 4;
      } else {
        // For planar formats, let native layer validate (it calculates correctly)
        requiredSize = 0;
      }
    } else {
      requiredSize = this._native.allocationSize(options || {});
    }
    if (requiredSize > 0 && destLength < requiredSize) {
      throw new RangeError(
        `Destination buffer too small: ${destLength} bytes provided, ${requiredSize} bytes required`,
      );
    }

    // Call native copyTo
    const layout = this._native.copyTo(destBuffer, options || {});

    // Copy back to original if it was an ArrayBuffer
    if (destination instanceof ArrayBuffer) {
      new Uint8Array(destination).set(destBuffer);
    } else if (destination instanceof Uint8Array) {
      destination.set(destBuffer);
    }

    return layout;
  }

  allocationSize(options?: VideoFrameCopyToOptions): number {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }

    // W3C spec: validate rect bounds if provided
    if (options?.rect) {
      const rect = options.rect;
      const rectX = rect.x ?? 0;
      const rectY = rect.y ?? 0;
      const rectWidth = rect.width ?? this._native.codedWidth;
      const rectHeight = rect.height ?? this._native.codedHeight;

      if (
        rectX < 0 ||
        rectY < 0 ||
        rectX + rectWidth > this._native.codedWidth ||
        rectY + rectHeight > this._native.codedHeight
      ) {
        throw new RangeError('rect exceeds coded frame dimensions');
      }

      // Calculate allocation size based on rect dimensions
      return this._calculateAllocationSizeForRect(rectWidth, rectHeight, options.format);
    }

    return this._native.allocationSize(options || {});
  }

  /**
   * Calculate allocation size for a given width/height and format.
   * Used internally for rect-based allocationSize calculations.
   */
  private _calculateAllocationSizeForRect(
    width: number,
    height: number,
    format?: VideoPixelFormat,
  ): number {
    const targetFormat = format ?? (this._native.format as VideoPixelFormat);

    // Packed RGB formats: 4 bytes per pixel
    if (
      targetFormat === 'RGBA' ||
      targetFormat === 'RGBX' ||
      targetFormat === 'BGRA' ||
      targetFormat === 'BGRX'
    ) {
      return width * height * 4;
    }

    // I420 format: Y plane + U plane (1/4) + V plane (1/4) = 1.5 bytes per pixel
    if (targetFormat === 'I420') {
      const ySize = width * height;
      const chromaWidth = width >> 1;
      const chromaHeight = height >> 1;
      const uvSize = chromaWidth * chromaHeight;
      return ySize + uvSize * 2;
    }

    // I420A format: I420 + alpha plane
    if (targetFormat === 'I420A') {
      const ySize = width * height;
      const chromaWidth = width >> 1;
      const chromaHeight = height >> 1;
      const uvSize = chromaWidth * chromaHeight;
      return ySize + uvSize * 2 + ySize; // Y + U + V + A
    }

    // I422 format: Y plane + U plane (1/2 width) + V plane (1/2 width)
    if (targetFormat === 'I422') {
      const ySize = width * height;
      const chromaWidth = width >> 1;
      const uvSize = chromaWidth * height;
      return ySize + uvSize * 2;
    }

    // I422A format: I422 + alpha plane
    if (targetFormat === 'I422A') {
      const ySize = width * height;
      const chromaWidth = width >> 1;
      const uvSize = chromaWidth * height;
      return ySize + uvSize * 2 + ySize;
    }

    // I444 format: Y plane + U plane + V plane (all same size)
    if (targetFormat === 'I444') {
      return width * height * 3;
    }

    // I444A format: I444 + alpha plane
    if (targetFormat === 'I444A') {
      return width * height * 4;
    }

    // NV12 format: Y plane + interleaved UV plane (1/2 height)
    if (targetFormat === 'NV12' || targetFormat === 'NV21') {
      const ySize = width * height;
      const chromaHeight = height >> 1;
      const uvSize = width * chromaHeight;
      return ySize + uvSize;
    }

    // NV12A format: NV12 + alpha plane
    if (targetFormat === 'NV12A') {
      const ySize = width * height;
      const chromaHeight = height >> 1;
      const uvSize = width * chromaHeight;
      return ySize + uvSize + ySize;
    }

    // 10-bit formats: 2 bytes per sample
    if (targetFormat === 'I420P10' || targetFormat === 'I420P12') {
      const ySize = width * height * 2;
      const chromaWidth = width >> 1;
      const chromaHeight = height >> 1;
      const uvSize = chromaWidth * chromaHeight * 2;
      return ySize + uvSize * 2;
    }

    if (targetFormat === 'I420AP10' || targetFormat === 'I420AP12') {
      const ySize = width * height * 2;
      const chromaWidth = width >> 1;
      const chromaHeight = height >> 1;
      const uvSize = chromaWidth * chromaHeight * 2;
      return ySize + uvSize * 2 + ySize;
    }

    if (targetFormat === 'I422P10' || targetFormat === 'I422P12') {
      const ySize = width * height * 2;
      const chromaWidth = width >> 1;
      const uvSize = chromaWidth * height * 2;
      return ySize + uvSize * 2;
    }

    if (targetFormat === 'I422AP10' || targetFormat === 'I422AP12') {
      const ySize = width * height * 2;
      const chromaWidth = width >> 1;
      const uvSize = chromaWidth * height * 2;
      return ySize + uvSize * 2 + ySize;
    }

    if (targetFormat === 'I444P10' || targetFormat === 'I444P12') {
      return width * height * 3 * 2;
    }

    if (targetFormat === 'I444AP10' || targetFormat === 'I444AP12') {
      return width * height * 4 * 2;
    }

    if (targetFormat === 'NV12P10') {
      const ySize = width * height * 2;
      const chromaHeight = height >> 1;
      const uvSize = width * chromaHeight * 2;
      return ySize + uvSize;
    }

    // Fallback: delegate to native for unknown formats
    return this._native.allocationSize({ format: targetFormat });
  }

  clone(): VideoFrame {
    if (this._closed) {
      throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    const clonedNative = this._native.clone();
    // Wrap the cloned native frame
    const wrapper = Object.create(VideoFrame.prototype);
    wrapper._native = clonedNative;
    wrapper._closed = false;
    // Preserve metadata through clone
    wrapper._metadata = { ...this._metadata };
    // Preserve override fields through clone
    wrapper._timestampOverride = this._timestampOverride;
    wrapper._durationOverride = this._durationOverride;
    wrapper._visibleRectOverride = this._visibleRectOverride
      ? { ...this._visibleRectOverride }
      : undefined;
    return wrapper;
  }

  // Internal access for native binding
  get _nativeFrame(): NativeVideoFrame {
    return this._native;
  }
}
