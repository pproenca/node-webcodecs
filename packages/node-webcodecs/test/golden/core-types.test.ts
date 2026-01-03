/**
 * Tests for core data types: VideoFrame, AudioData, EncodedVideoChunk, EncodedAudioChunk
 */

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('VideoFrame', () => {
  describe('constructor', () => {
    it('should create a VideoFrame from RGBA buffer', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);
      data.fill(128); // Gray

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      assert.strictEqual(frame.format, 'RGBA');
      assert.strictEqual(frame.codedWidth, width);
      assert.strictEqual(frame.codedHeight, height);
      assert.strictEqual(frame.timestamp, 0);
      assert.strictEqual(frame.duration, null);

      frame.close();
    });

    it('should create a VideoFrame from I420 buffer', () => {
      const width = 320;
      const height = 240;
      const ySize = width * height;
      const uvSize = (width / 2) * (height / 2);
      const data = new Uint8Array(ySize + uvSize * 2);
      data.fill(128);

      const frame = new VideoFrame(data, {
        format: 'I420',
        codedWidth: width,
        codedHeight: height,
        timestamp: 1000,
        duration: 33333,
      });

      assert.strictEqual(frame.format, 'I420');
      assert.strictEqual(frame.codedWidth, width);
      assert.strictEqual(frame.codedHeight, height);
      assert.strictEqual(frame.timestamp, 1000);
      assert.strictEqual(frame.duration, 33333);

      frame.close();
    });

    it('should throw if required parameters are missing', () => {
      const data = new Uint8Array(100);

      assert.throws(() => {
        new VideoFrame(data);
      }, TypeError);

      assert.throws(() => {
        new VideoFrame(data, { format: 'RGBA' });
      }, TypeError);
    });
  });

  describe('allocationSize', () => {
    it('should return correct size for RGBA', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      assert.strictEqual(frame.allocationSize(), width * height * 4);
      frame.close();
    });

    it('should return correct size for I420', () => {
      const width = 320;
      const height = 240;
      const ySize = width * height;
      const uvSize = (width / 2) * (height / 2);
      const data = new Uint8Array(ySize + uvSize * 2);

      const frame = new VideoFrame(data, {
        format: 'I420',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      assert.strictEqual(frame.allocationSize(), Math.floor(width * height * 1.5));
      frame.close();
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);
      data.fill(128);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 1000,
      });

      const clone = frame.clone();

      assert.strictEqual(clone.format, frame.format);
      assert.strictEqual(clone.codedWidth, frame.codedWidth);
      assert.strictEqual(clone.codedHeight, frame.codedHeight);
      assert.strictEqual(clone.timestamp, frame.timestamp);

      // Closing original shouldn't affect clone
      frame.close();
      assert.strictEqual(clone.codedWidth, width);

      clone.close();
    });
  });

  describe('close', () => {
    it('should prevent further operations', () => {
      const data = new Uint8Array(320 * 240 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });

      frame.close();

      assert.throws(() => { frame.allocationSize(); });
      assert.throws(() => { frame.clone(); });
    });
  });
});

describe('AudioData', () => {
  describe('constructor', () => {
    it('should create AudioData from f32 buffer', () => {
      const sampleRate = 48000;
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      data.fill(0.5);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      assert.strictEqual(audioData.format, 'f32');
      assert.strictEqual(audioData.sampleRate, sampleRate);
      assert.strictEqual(audioData.numberOfFrames, numberOfFrames);
      assert.strictEqual(audioData.numberOfChannels, numberOfChannels);
      assert.strictEqual(audioData.timestamp, 0);

      // Duration should be calculated correctly
      const expectedDuration = Math.floor((numberOfFrames / sampleRate) * 1_000_000);
      assert.strictEqual(audioData.duration, expectedDuration);

      audioData.close();
    });

    it('should throw if required parameters are missing', () => {
      assert.throws(() => {
        new AudioData({});
      }, TypeError);
    });
  });

  describe('allocationSize', () => {
    it('should return correct size for interleaved format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      assert.strictEqual(
        audioData.allocationSize({ planeIndex: 0 }),
        numberOfFrames * numberOfChannels * 4,
      );

      audioData.close();
    });

    it('should return correct size for planar format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      assert.strictEqual(audioData.allocationSize({ planeIndex: 0 }), numberOfFrames * 4);

      audioData.close();
    });

    it('should return per-plane size for planar format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Each plane is just one channel
      assert.strictEqual(audioData.allocationSize({ planeIndex: 0 }), numberOfFrames * 4);
      assert.strictEqual(audioData.allocationSize({ planeIndex: 1 }), numberOfFrames * 4);

      audioData.close();
    });

    it('should calculate size for format conversion', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert f32 (4 bytes) to s16 (2 bytes)
      const size = audioData.allocationSize({
        planeIndex: 0,
        format: 's16',
      });
      assert.strictEqual(size, numberOfFrames * numberOfChannels * 2);

      audioData.close();
    });

    it('should throw RangeError for invalid planeIndex on interleaved', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      assert.throws(() => { audioData.allocationSize({ planeIndex: 1 }); });
      audioData.close();
    });

    it('should return correct size with frameOffset and frameCount', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Request only 100 frames starting at offset 50
      const size = audioData.allocationSize({
        planeIndex: 0,
        frameOffset: 50,
        frameCount: 100,
      });
      assert.strictEqual(size, 100 * numberOfChannels * 4); // 100 frames * 2 channels * 4 bytes

      audioData.close();
    });
  });

  describe('copyTo', () => {
    it('should throw DOMException with InvalidStateError if AudioData is closed', async () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      audioData.close();

      const dest = new Float32Array(1024 * 2);
      assert.throws(() => { audioData.copyTo(dest, { planeIndex: 0 }); }, DOMException);
      try {
        audioData.copyTo(dest, { planeIndex: 0 });
      } catch (e) {
        assert.strictEqual((e as DOMException).name, 'InvalidStateError');
      }
    });

    it('should throw if destination buffer too small', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      const dest = new Float32Array(10); // Too small
      assert.throws(() => { audioData.copyTo(dest, { planeIndex: 0 }); });

      audioData.close();
    });

    it('should throw RangeError for invalid planeIndex on planar', () => {
      const data = new Float32Array(1024 * 2);
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: data.buffer,
      });

      const dest = new Float32Array(1024);
      assert.throws(() => { audioData.copyTo(dest, { planeIndex: 2 }); });

      audioData.close();
    });

    it('should copy partial frames with frameOffset and frameCount', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Create data with recognizable pattern: frame index * 0.01
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        for (let c = 0; c < numberOfChannels; c++) {
          data[i * numberOfChannels + c] = i * 0.01;
        }
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Copy frames 10-19 (10 frames)
      const copySize = audioData.allocationSize({
        planeIndex: 0,
        frameOffset: 10,
        frameCount: 10,
      });
      const dest = new Float32Array(copySize / 4);
      audioData.copyTo(dest, { planeIndex: 0, frameOffset: 10, frameCount: 10 });

      // Verify first sample is from frame 10
      assert.ok(Math.abs(dest[0] - 0.1) < 0.00001);
      // Verify last sample is from frame 19
      assert.ok(Math.abs(dest[dest.length - 1] - 0.19) < 0.00001);

      audioData.close();
    });

    it('should copy single plane from planar format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Planar: all channel 0 samples, then all channel 1 samples
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      // Channel 0: values 0.0 to 0.99
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = i * 0.01;
      }
      // Channel 1: values 1.0 to 1.99
      for (let i = 0; i < numberOfFrames; i++) {
        data[numberOfFrames + i] = 1.0 + i * 0.01;
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Copy plane 1 (channel 1)
      const copySize = audioData.allocationSize({ planeIndex: 1 });
      const dest = new Float32Array(copySize / 4);
      audioData.copyTo(dest, { planeIndex: 1 });

      // Verify values are from channel 1
      assert.ok(Math.abs(dest[0] - 1.0) < 0.00001);
      assert.ok(Math.abs(dest[99] - 1.99) < 0.00001);

      audioData.close();
    });

    it('should convert f32 to s16 format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 1;
      // Create f32 data with values that map nicely to s16
      const data = new Float32Array(numberOfFrames);
      for (let i = 0; i < numberOfFrames; i++) {
        // Range -1.0 to ~1.0
        data[i] = (i / numberOfFrames) * 2 - 1;
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to s16
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 's16' });
      assert.strictEqual(allocSize, numberOfFrames * 2); // 2 bytes per s16 sample

      const dest = new Int16Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 's16' });

      // First sample should be near -32768 (min s16)
      assert.ok(dest[0] < -30000);
      // Last sample should be near +32767 (max s16)
      assert.ok(dest[numberOfFrames - 1] > 30000);

      audioData.close();
    });

    it('should convert s16 to f32 format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 1;
      // Create s16 data
      const data = new Int16Array(numberOfFrames);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = Math.floor((i / numberOfFrames) * 65535 - 32768);
      }

      const audioData = new AudioData({
        format: 's16',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: new Uint8Array(data.buffer),
      });

      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32' });
      assert.strictEqual(allocSize, numberOfFrames * 4);

      const dest = new Float32Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32' });

      // Values should be in -1.0 to 1.0 range
      assert.ok(Math.abs(dest[0] - (-1.0)) < 0.1);
      assert.ok(Math.abs(dest[numberOfFrames - 1] - 1.0) < 0.1);

      audioData.close();
    });

    it('should convert interleaved to planar format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Interleaved: L0 R0 L1 R1 ...
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i * 2] = 0.5; // Left channel: all 0.5
        data[i * 2 + 1] = -0.5; // Right channel: all -0.5
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to f32-planar and get plane 0 (left channel)
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32-planar' });
      assert.strictEqual(allocSize, numberOfFrames * 4); // Single channel

      const dest = new Float32Array(numberOfFrames);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32-planar' });

      // All values should be 0.5 (left channel)
      assert.ok(Math.abs(dest[0] - 0.5) < 0.00001);
      assert.ok(Math.abs(dest[numberOfFrames - 1] - 0.5) < 0.00001);

      audioData.close();
    });

    it('should convert planar to interleaved format', () => {
      const numberOfFrames = 100;
      const numberOfChannels = 2;
      // Planar: plane 0 all 0.25, plane 1 all 0.75
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      for (let i = 0; i < numberOfFrames; i++) {
        data[i] = 0.25; // Plane 0
        data[numberOfFrames + i] = 0.75; // Plane 1
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      // Convert to interleaved f32
      const allocSize = audioData.allocationSize({ planeIndex: 0, format: 'f32' });
      assert.strictEqual(allocSize, numberOfFrames * numberOfChannels * 4);

      const dest = new Float32Array(numberOfFrames * numberOfChannels);
      audioData.copyTo(dest, { planeIndex: 0, format: 'f32' });

      // Interleaved: L0 R0 L1 R1 ...
      assert.ok(Math.abs(dest[0] - 0.25) < 0.00001); // L0
      assert.ok(Math.abs(dest[1] - 0.75) < 0.00001); // R0

      audioData.close();
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const data = new Float32Array(1024 * 2);
      data.fill(0.5);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 1000,
        data: data.buffer,
      });

      const clone = audioData.clone();

      assert.strictEqual(clone.format, audioData.format);
      assert.strictEqual(clone.sampleRate, audioData.sampleRate);
      assert.strictEqual(clone.numberOfFrames, audioData.numberOfFrames);
      assert.strictEqual(clone.numberOfChannels, audioData.numberOfChannels);
      assert.strictEqual(clone.timestamp, audioData.timestamp);

      audioData.close();
      assert.strictEqual(clone.sampleRate, 48000);

      clone.close();
    });
  });
});

describe('EncodedVideoChunk', () => {
  describe('constructor', () => {
    it('should create a key chunk', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]);

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data,
      });

      assert.strictEqual(chunk.type, 'key');
      assert.strictEqual(chunk.timestamp, 0);
      assert.strictEqual(chunk.duration, null);
      assert.strictEqual(chunk.byteLength, 6);
    });

    it('should create a delta chunk with duration', () => {
      const data = new Uint8Array([0x00, 0x00, 0x01, 0x41]);

      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        duration: 33333,
        data,
      });

      assert.strictEqual(chunk.type, 'delta');
      assert.strictEqual(chunk.timestamp, 33333);
      assert.strictEqual(chunk.duration, 33333);
      assert.strictEqual(chunk.byteLength, 4);
    });

    it('should throw for invalid type', () => {
      assert.throws(() => {
        new EncodedVideoChunk({
          type: 'invalid' as any,
          timestamp: 0,
          data: new Uint8Array(1),
        });
      }, TypeError);
    });
  });

  describe('copyTo', () => {
    it('should copy data to destination buffer', () => {
      const srcData = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: srcData,
      });

      const dest = new Uint8Array(10);
      chunk.copyTo(dest);

      assert.deepStrictEqual(dest.slice(0, 6), srcData);
    });

    it('should throw if destination is too small', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array(10),
      });

      assert.throws(() => {
        chunk.copyTo(new Uint8Array(5));
      }, TypeError);
    });
  });
});

describe('EncodedAudioChunk', () => {
  describe('constructor', () => {
    it('should create an audio chunk', () => {
      const data = new Uint8Array([0xff, 0xf1, 0x50, 0x80]);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        duration: 21333,
        data,
      });

      assert.strictEqual(chunk.type, 'key');
      assert.strictEqual(chunk.timestamp, 0);
      assert.strictEqual(chunk.duration, 21333);
      assert.strictEqual(chunk.byteLength, 4);
    });
  });

  describe('copyTo', () => {
    it('should copy data to destination buffer', () => {
      const srcData = new Uint8Array([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f]);
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: srcData,
      });

      const dest = new Uint8Array(10);
      chunk.copyTo(dest);

      assert.deepStrictEqual(dest.slice(0, 6), srcData);
    });
  });
});

describe('VideoColorSpace', () => {
  it('should use default values when no init provided', () => {
    const colorSpace = new VideoColorSpace();

    assert.strictEqual(colorSpace.primaries, null);
    assert.strictEqual(colorSpace.transfer, null);
    assert.strictEqual(colorSpace.matrix, null);
    assert.strictEqual(colorSpace.fullRange, null);
  });

  it('should accept init values', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: true,
    });

    assert.strictEqual(colorSpace.primaries, 'bt709');
    assert.strictEqual(colorSpace.transfer, 'bt709');
    assert.strictEqual(colorSpace.matrix, 'bt709');
    assert.strictEqual(colorSpace.fullRange, true);
  });

  it('should serialize to JSON', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'smpte170m',
      matrix: 'bt709',
      fullRange: false,
    });

    const json = colorSpace.toJSON();

    assert.strictEqual(json.primaries, 'bt709');
    assert.strictEqual(json.transfer, 'smpte170m');
    assert.strictEqual(json.matrix, 'bt709');
    assert.strictEqual(json.fullRange, false);
  });
});
