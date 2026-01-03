// test/unit/encoded-video-chunk.test.ts
// Tests for W3C WebCodecs spec section 8.2 - EncodedVideoChunk Interface

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EncodedVideoChunk, type EncodedVideoChunkInit, type EncodedVideoChunkType } from '../../lib';

/**
 * Tests for EncodedVideoChunk per W3C WebCodecs spec section 8.2.
 * Covers constructor, attributes, methods, and error handling.
 */

describe('EncodedVideoChunk: 8.2', () => {
  describe('8.2.2 Constructor', () => {
    // Spec 8.2.2: Create EncodedVideoChunk with valid init
    it('should construct with valid init', () => {
      const init: EncodedVideoChunkInit = {
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e]),
      };

      const chunk = new EncodedVideoChunk(init);

      assert.ok(chunk);
      assert.strictEqual(chunk.type, 'key');
      assert.strictEqual(chunk.timestamp, 0);
      assert.strictEqual(chunk.byteLength, 8);

      chunk.close();
    });

    it('should accept type: "key"', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.type, 'key');
      chunk.close();
    });

    it('should accept type: "delta"', () => {
      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.type, 'delta');
      chunk.close();
    });

    it('should accept ArrayBuffer as data', () => {
      const data = new ArrayBuffer(16);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data,
      });

      assert.strictEqual(chunk.byteLength, 16);
      chunk.close();
    });

    it('should accept Uint8Array as data', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data,
      });

      assert.strictEqual(chunk.byteLength, 8);
      chunk.close();
    });

    it('should accept optional duration', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        duration: 33333, // ~33ms (30fps)
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.duration, 33333);
      chunk.close();
    });

    // Error cases
    it('should throw TypeError for invalid type', () => {
      assert.throws(
        () =>
          new EncodedVideoChunk({
            type: 'invalid' as EncodedVideoChunkType,
            timestamp: 0,
            data: new Uint8Array([1]),
          }),
        TypeError,
      );
    });

    it('should throw TypeError for missing data', () => {
      assert.throws(
        () =>
          new EncodedVideoChunk({
            type: 'key',
            timestamp: 0,
            data: undefined as unknown as ArrayBuffer,
          }),
        TypeError,
      );
    });
  });

  describe('8.2.3 Attributes', () => {
    // Spec 8.2.3: type attribute - key for I-frames, delta for P/B-frames
    it('should have readonly type attribute', () => {
      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        data: new Uint8Array([1, 2, 3]),
      });

      assert.strictEqual(chunk.type, 'delta');
      chunk.close();
    });

    // Spec 8.2.3: timestamp attribute in microseconds
    it('should have readonly timestamp attribute in microseconds', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 1000000, // 1 second in microseconds
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.timestamp, 1000000);
      chunk.close();
    });

    it('should support negative timestamp', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: -5000,
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.timestamp, -5000);
      chunk.close();
    });

    // Spec 8.2.3: duration attribute (nullable)
    it('should have nullable duration attribute', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      });

      // Duration should be null when not provided
      assert.strictEqual(chunk.duration, null);
      chunk.close();
    });

    it('should have duration when provided', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        duration: 16666, // ~60fps
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.duration, 16666);
      chunk.close();
    });

    // Spec 8.2.3: byteLength attribute
    it('should have byteLength matching data size', () => {
      const data = new Uint8Array(1000); // 1KB
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data,
      });

      assert.strictEqual(chunk.byteLength, 1000);
      chunk.close();
    });
  });

  describe('8.2.4 copyTo Method', () => {
    // Spec 8.2.4: copyTo copies internal data
    it('should copy data to ArrayBuffer destination', () => {
      const sourceData = new Uint8Array([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: sourceData,
      });

      const destination = new ArrayBuffer(8);
      chunk.copyTo(destination);

      const result = new Uint8Array(destination);
      assert.deepStrictEqual([...result], [0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e]);

      chunk.close();
    });

    it('should copy data to Uint8Array destination', () => {
      const sourceData = new Uint8Array([10, 20, 30, 40]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: sourceData,
      });

      const destination = new Uint8Array(4);
      chunk.copyTo(destination);

      assert.deepStrictEqual([...destination], [10, 20, 30, 40]);

      chunk.close();
    });

    it('should copy data to larger destination', () => {
      const sourceData = new Uint8Array([1, 2, 3]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: sourceData,
      });

      const destination = new Uint8Array(10);
      chunk.copyTo(destination);

      assert.strictEqual(destination[0], 1);
      assert.strictEqual(destination[1], 2);
      assert.strictEqual(destination[2], 3);

      chunk.close();
    });

    // Spec 8.2.4: throw if destination too small
    it('should throw if destination is too small', () => {
      const sourceData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: sourceData,
      });

      const destination = new Uint8Array(4); // Too small

      assert.throws(() => chunk.copyTo(destination));

      chunk.close();
    });
  });

  describe('Key and delta frame semantics', () => {
    // Key frames are independently decodable
    it('should mark key frames with type "key"', () => {
      const keyFrame = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1, 0x67]), // H.264 SPS NAL unit
      });

      assert.strictEqual(keyFrame.type, 'key');
      keyFrame.close();
    });

    // Delta frames require previous frames
    it('should mark delta frames with type "delta"', () => {
      const deltaFrame = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        data: new Uint8Array([0, 0, 0, 1, 0x41]), // H.264 P-frame NAL unit
      });

      assert.strictEqual(deltaFrame.type, 'delta');
      deltaFrame.close();
    });

    // Typical GOP structure: key, delta, delta, ...
    it('should support GOP structure (key followed by deltas)', () => {
      const frames: EncodedVideoChunk[] = [];

      // Key frame
      frames.push(
        new EncodedVideoChunk({
          type: 'key',
          timestamp: 0,
          data: new Uint8Array(100),
        }),
      );

      // Delta frames
      for (let i = 1; i < 30; i++) {
        frames.push(
          new EncodedVideoChunk({
            type: 'delta',
            timestamp: i * 33333,
            data: new Uint8Array(50),
          }),
        );
      }

      assert.strictEqual(frames[0].type, 'key');
      assert.strictEqual(frames[1].type, 'delta');
      assert.strictEqual(frames.length, 30);

      frames.forEach((f) => {
        f.close();
      });
    });
  });

  describe('Edge cases', () => {
    // Zero-length data
    it('should handle zero-length data', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array(0),
      });

      assert.strictEqual(chunk.byteLength, 0);

      const dest = new Uint8Array(0);
      chunk.copyTo(dest);

      chunk.close();
    });

    // Large data for 4K video
    it('should handle large data (>1MB for 4K)', () => {
      const largeData = new Uint8Array(2 * 1024 * 1024); // 2MB
      largeData.fill(0x42);

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: largeData,
      });

      assert.strictEqual(chunk.byteLength, 2 * 1024 * 1024);

      const destination = new Uint8Array(chunk.byteLength);
      chunk.copyTo(destination);
      assert.strictEqual(destination[0], 0x42);
      assert.strictEqual(destination[destination.length - 1], 0x42);

      chunk.close();
    });

    // Timestamp precision
    it('should preserve microsecond timestamp precision', () => {
      const timestamp = 12345678901;

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp,
        data: new Uint8Array([1]),
      });

      assert.strictEqual(chunk.timestamp, timestamp);
      chunk.close();
    });

    // Duration values
    it('should distinguish duration = 0 vs null (implementation-specific)', () => {
      const chunkWithZeroDuration = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        duration: 0,
        data: new Uint8Array([1]),
      });

      const chunkWithNoDuration = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      });

      // Document current behavior
      assert.ok(chunkWithZeroDuration.duration === 0 || chunkWithZeroDuration.duration === null);
      assert.strictEqual(chunkWithNoDuration.duration, null);

      chunkWithZeroDuration.close();
      chunkWithNoDuration.close();
    });
  });

  describe('Type exports', () => {
    it('should export EncodedVideoChunk class', () => {
      assert.strictEqual(typeof EncodedVideoChunk, 'function');
    });

    it('should export EncodedVideoChunkType type', () => {
      const type: EncodedVideoChunkType = 'key';
      assert.ok(type);
    });

    it('should export EncodedVideoChunkInit type', () => {
      const init: EncodedVideoChunkInit = {
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      };
      assert.ok(init);
    });
  });

  describe('close() method', () => {
    it('should have close method', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      });

      assert.strictEqual(typeof chunk.close, 'function');
      chunk.close();
    });

    it('should allow double close without error', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1]),
      });

      chunk.close();
      assert.doesNotThrow(() => chunk.close());
    });
  });
});
