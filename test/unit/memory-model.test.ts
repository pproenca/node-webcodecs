// test/unit/memory-model.test.ts
// Tests for W3C WebCodecs spec section 9.1 - Memory Model

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioData, VideoFrame } from '../../lib';

/**
 * Tests for Memory Model per W3C WebCodecs spec section 9.1.
 * Covers reference counting, close(), clone(), and resource management.
 */

describe('Memory Model: 9.1', () => {
  // Helper to create a VideoFrame for testing
  function createVideoFrame(timestamp = 0): VideoFrame {
    const buf = Buffer.alloc(640 * 480 * 4);
    buf.fill(0x42); // Fill with recognizable pattern
    return new VideoFrame(buf, {
      codedWidth: 640,
      codedHeight: 480,
      timestamp,
      format: 'RGBA',
    });
  }

  // Helper to create AudioData for testing
  function createAudioData(timestamp = 0): AudioData {
    // Create 1024 samples of f32 data (4 bytes per sample)
    const samples = new Float32Array(1024);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / samples.length) * Math.PI * 2);
    }
    return new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 1,
      timestamp,
      data: samples,
    });
  }

  describe('9.1.1 Background', () => {
    // Spec 9.1.1: Media resources may occupy large memory
    it('should support explicit resource release via close()', () => {
      const frame = createVideoFrame();
      assert.strictEqual(frame.codedWidth, 640);
      frame.close();
      // After close, attributes should return default values
      assert.strictEqual(frame.codedWidth, 0);
    });

    it('should support explicit resource release for AudioData via close()', () => {
      const audio = createAudioData();
      assert.strictEqual(audio.numberOfFrames, 1024);
      audio.close();
      // After close, attributes should return default values
      assert.strictEqual(audio.numberOfFrames, 0);
    });
  });

  describe('9.1.2 Reference Counting - VideoFrame', () => {
    // Spec 9.1.2: close() marks object as closed
    it('should mark VideoFrame as closed after close()', () => {
      const frame = createVideoFrame();
      assert.strictEqual(frame.format, 'RGBA');
      frame.close();
      // format returns null when closed
      assert.strictEqual(frame.format, null);
    });

    // Spec 9.1.2: clone() creates new object
    it('should create new VideoFrame via clone()', () => {
      const original = createVideoFrame();
      const cloned = original.clone();

      assert.ok(cloned instanceof VideoFrame);
      assert.notStrictEqual(original, cloned);

      original.close();
      cloned.close();
    });

    // Spec 9.1.2: clone() shares same media resource
    it('should share media resource between VideoFrame and clone', async () => {
      const original = createVideoFrame();
      const cloned = original.clone();

      // Both should have same dimensions
      assert.strictEqual(cloned.codedWidth, original.codedWidth);
      assert.strictEqual(cloned.codedHeight, original.codedHeight);
      assert.strictEqual(cloned.timestamp, original.timestamp);

      // Both should have same pixel data
      const originalData = new Uint8Array(original.allocationSize());
      const clonedData = new Uint8Array(cloned.allocationSize());

      await original.copyTo(originalData);
      await cloned.copyTo(clonedData);

      assert.deepStrictEqual([...originalData], [...clonedData]);

      original.close();
      cloned.close();
    });

    // Spec 9.1.2: close() on original doesn't affect clone
    it('should not affect clone when original VideoFrame is closed', async () => {
      const original = createVideoFrame();
      const cloned = original.clone();

      original.close();

      // Clone should still be usable
      assert.strictEqual(cloned.codedWidth, 640);
      assert.strictEqual(cloned.format, 'RGBA');

      // Clone should still have data
      const data = new Uint8Array(cloned.allocationSize());
      await cloned.copyTo(data);
      assert.strictEqual(data[0], 0x42);

      cloned.close();
    });

    // Spec 9.1.2: close() on clone doesn't affect original
    it('should not affect original when clone is closed', async () => {
      const original = createVideoFrame();
      const cloned = original.clone();

      cloned.close();

      // Original should still be usable
      assert.strictEqual(original.codedWidth, 640);
      assert.strictEqual(original.format, 'RGBA');

      // Original should still have data
      const data = new Uint8Array(original.allocationSize());
      await original.copyTo(data);
      assert.strictEqual(data[0], 0x42);

      original.close();
    });

    // Spec 9.1.2: clone() throws InvalidStateError on closed frame
    it('should throw InvalidStateError when cloning closed VideoFrame', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.throws(
        () => frame.clone(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    // close() is idempotent
    it('should allow double close() on VideoFrame without error', () => {
      const frame = createVideoFrame();
      frame.close();
      assert.doesNotThrow(() => {
        frame.close();
      });
    });
  });

  describe('9.1.2 Reference Counting - AudioData', () => {
    // Spec 9.1.2: close() marks object as closed
    it('should mark AudioData as closed after close()', () => {
      const audio = createAudioData();
      assert.strictEqual(audio.format, 'f32');
      audio.close();
      // format returns null when closed
      assert.strictEqual(audio.format, null);
    });

    // Spec 9.1.2: clone() creates new object
    it('should create new AudioData via clone()', () => {
      const original = createAudioData();
      const cloned = original.clone();

      assert.ok(cloned instanceof AudioData);
      assert.notStrictEqual(original, cloned);

      original.close();
      cloned.close();
    });

    // Spec 9.1.2: clone() shares same media resource
    it('should share media resource between AudioData and clone', () => {
      const original = createAudioData();
      const cloned = original.clone();

      // Both should have same properties
      assert.strictEqual(cloned.format, original.format);
      assert.strictEqual(cloned.sampleRate, original.sampleRate);
      assert.strictEqual(cloned.numberOfFrames, original.numberOfFrames);
      assert.strictEqual(cloned.numberOfChannels, original.numberOfChannels);
      assert.strictEqual(cloned.timestamp, original.timestamp);

      // Both should have same sample data
      const originalData = new Float32Array(original.allocationSize({ planeIndex: 0 }) / 4);
      const clonedData = new Float32Array(cloned.allocationSize({ planeIndex: 0 }) / 4);

      original.copyTo(originalData, { planeIndex: 0 });
      cloned.copyTo(clonedData, { planeIndex: 0 });

      assert.deepStrictEqual([...originalData], [...clonedData]);

      original.close();
      cloned.close();
    });

    // Spec 9.1.2: close() on original doesn't affect clone
    it('should not affect clone when original AudioData is closed', () => {
      const original = createAudioData();
      const cloned = original.clone();

      original.close();

      // Clone should still be usable
      assert.strictEqual(cloned.sampleRate, 48000);
      assert.strictEqual(cloned.format, 'f32');
      assert.strictEqual(cloned.numberOfFrames, 1024);

      cloned.close();
    });

    // Spec 9.1.2: close() on clone doesn't affect original
    it('should not affect original when clone is closed', () => {
      const original = createAudioData();
      const cloned = original.clone();

      cloned.close();

      // Original should still be usable
      assert.strictEqual(original.sampleRate, 48000);
      assert.strictEqual(original.format, 'f32');
      assert.strictEqual(original.numberOfFrames, 1024);

      original.close();
    });

    // Spec 9.1.2: clone() throws InvalidStateError on closed audio
    it('should throw InvalidStateError when cloning closed AudioData', () => {
      const audio = createAudioData();
      audio.close();

      assert.throws(
        () => audio.clone(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    // close() is idempotent
    it('should allow double close() on AudioData without error', () => {
      const audio = createAudioData();
      audio.close();
      assert.doesNotThrow(() => {
        audio.close();
      });
    });
  });

  describe('Edge cases - clone chain', () => {
    // clone() of clone()
    it('should support clone of clone for VideoFrame', async () => {
      const original = createVideoFrame();
      const clone1 = original.clone();
      const clone2 = clone1.clone();

      // All three should have same data
      assert.strictEqual(clone2.codedWidth, original.codedWidth);
      assert.strictEqual(clone2.timestamp, original.timestamp);

      // Verify data integrity through the chain
      const data1 = new Uint8Array(original.allocationSize());
      const data2 = new Uint8Array(clone2.allocationSize());
      await original.copyTo(data1);
      await clone2.copyTo(data2);
      assert.deepStrictEqual([...data1], [...data2]);

      original.close();
      clone1.close();
      clone2.close();
    });

    it('should support clone of clone for AudioData', () => {
      const original = createAudioData();
      const clone1 = original.clone();
      const clone2 = clone1.clone();

      // All three should have same data
      assert.strictEqual(clone2.sampleRate, original.sampleRate);
      assert.strictEqual(clone2.numberOfFrames, original.numberOfFrames);

      original.close();
      clone1.close();
      clone2.close();
    });

    // close all clones in any order
    it('should support closing VideoFrame clones in any order', async () => {
      const original = createVideoFrame();
      const clone1 = original.clone();
      const clone2 = original.clone();
      const clone3 = clone1.clone();

      // Close in mixed order: clone1, original, clone3, clone2
      clone1.close();

      // clone2 and clone3 should still work
      assert.strictEqual(clone2.codedWidth, 640);
      assert.strictEqual(clone3.codedWidth, 640);

      original.close();

      // clone2 and clone3 should still work
      assert.strictEqual(clone2.format, 'RGBA');
      assert.strictEqual(clone3.format, 'RGBA');

      clone3.close();

      // clone2 should still work
      const data = new Uint8Array(clone2.allocationSize());
      await clone2.copyTo(data);
      assert.strictEqual(data[0], 0x42);

      clone2.close();
    });

    it('should support closing AudioData clones in any order', () => {
      const original = createAudioData();
      const clone1 = original.clone();
      const clone2 = original.clone();
      const clone3 = clone1.clone();

      // Close in mixed order
      clone2.close();
      original.close();
      clone1.close();

      // clone3 should still work
      assert.strictEqual(clone3.sampleRate, 48000);
      assert.strictEqual(clone3.numberOfFrames, 1024);

      clone3.close();
    });
  });

  describe('Error cases - use after close', () => {
    // Use after close → InvalidStateError
    it('should throw InvalidStateError for copyTo after VideoFrame close', async () => {
      const frame = createVideoFrame();
      frame.close();

      const dest = new Uint8Array(640 * 480 * 4);

      await assert.rejects(
        async () => frame.copyTo(dest),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    it('should throw InvalidStateError for allocationSize after VideoFrame close', () => {
      const frame = createVideoFrame();
      frame.close();

      assert.throws(
        () => frame.allocationSize(),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    it('should throw InvalidStateError for copyTo after AudioData close', () => {
      const audio = createAudioData();
      audio.close();

      const dest = new Float32Array(1024);

      assert.throws(
        () => audio.copyTo(dest, { planeIndex: 0 }),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });

    it('should throw InvalidStateError for allocationSize after AudioData close', () => {
      const audio = createAudioData();
      audio.close();

      assert.throws(
        () => audio.allocationSize({ planeIndex: 0 }),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });

  describe('Attribute behavior after close', () => {
    it('should return default values for VideoFrame attributes after close', () => {
      const frame = createVideoFrame(12345);
      frame.close();

      // Spec 9.1.2: Attributes return default values when closed
      assert.strictEqual(frame.codedWidth, 0);
      assert.strictEqual(frame.codedHeight, 0);
      assert.strictEqual(frame.displayWidth, 0);
      assert.strictEqual(frame.displayHeight, 0);
      assert.strictEqual(frame.timestamp, 0);
      assert.strictEqual(frame.format, null);
      assert.strictEqual(frame.duration, null);
      assert.strictEqual(frame.codedRect, null);
      assert.strictEqual(frame.visibleRect, null);
    });

    it('should return default values for AudioData attributes after close', () => {
      const audio = createAudioData(12345);
      audio.close();

      // Spec 9.1.2: Attributes return default values when closed
      assert.strictEqual(audio.format, null);
      assert.strictEqual(audio.sampleRate, 0);
      assert.strictEqual(audio.numberOfFrames, 0);
      assert.strictEqual(audio.numberOfChannels, 0);
      assert.strictEqual(audio.duration, 0);
      assert.strictEqual(audio.timestamp, 0);
    });
  });

  describe('9.1.3 Transfer semantics (ArrayBuffer detachment)', () => {
    // Test transfer option detaches ArrayBuffers
    it('should detach transferred ArrayBuffer when constructing VideoFrame', () => {
      const buffer = new ArrayBuffer(640 * 480 * 4);
      new Uint8Array(buffer).fill(0x42);

      const frame = new VideoFrame(Buffer.from(buffer), {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0,
        format: 'RGBA',
        transfer: [buffer],
      });

      // Buffer should be detached (byteLength becomes 0)
      assert.strictEqual(buffer.byteLength, 0);

      frame.close();
    });

    it('should detach transferred ArrayBuffer when constructing AudioData', () => {
      const buffer = new ArrayBuffer(1024 * 4);
      const samples = new Float32Array(buffer);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((i / samples.length) * Math.PI * 2);
      }

      const audio = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 1,
        timestamp: 0,
        data: samples,
        transfer: [buffer],
      });

      // Buffer should be detached (byteLength becomes 0)
      assert.strictEqual(buffer.byteLength, 0);

      audio.close();
    });
  });

  describe('VideoFrame-from-VideoFrame construction', () => {
    // Spec: construct VideoFrame from existing VideoFrame
    it('should construct VideoFrame from existing VideoFrame', async () => {
      const original = createVideoFrame(12345);
      const fromFrame = new VideoFrame(original);

      assert.ok(fromFrame instanceof VideoFrame);
      assert.strictEqual(fromFrame.codedWidth, original.codedWidth);
      assert.strictEqual(fromFrame.codedHeight, original.codedHeight);
      assert.strictEqual(fromFrame.timestamp, original.timestamp);

      // Verify data is shared
      const data1 = new Uint8Array(original.allocationSize());
      const data2 = new Uint8Array(fromFrame.allocationSize());
      await original.copyTo(data1);
      await fromFrame.copyTo(data2);
      assert.deepStrictEqual([...data1], [...data2]);

      original.close();
      fromFrame.close();
    });

    it('should allow timestamp override when constructing from VideoFrame', () => {
      const original = createVideoFrame(0);
      const withOverride = new VideoFrame(original, { timestamp: 99999 });

      assert.strictEqual(original.timestamp, 0);
      assert.strictEqual(withOverride.timestamp, 99999);

      original.close();
      withOverride.close();
    });

    it('should throw InvalidStateError when constructing from closed VideoFrame', () => {
      const original = createVideoFrame();
      original.close();

      assert.throws(
        () => new VideoFrame(original),
        (err: Error) => {
          assert.ok(err instanceof DOMException);
          assert.strictEqual((err as DOMException).name, 'InvalidStateError');
          return true;
        },
      );
    });
  });
});
