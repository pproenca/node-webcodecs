/**
 * Tests for core data types: VideoFrame, AudioData, EncodedVideoChunk, EncodedAudioChunk
 */

import {expect, it, describe} from 'vitest';

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

      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);
      expect(frame.timestamp).toBe(0);
      expect(frame.duration).toBeNull();

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

      expect(frame.format).toBe('I420');
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);
      expect(frame.timestamp).toBe(1000);
      expect(frame.duration).toBe(33333);

      frame.close();
    });

    it('should throw if required parameters are missing', () => {
      const data = new Uint8Array(100);

      expect(() => {
        new VideoFrame(data);
      }).toThrow(TypeError);

      expect(() => {
        new VideoFrame(data, { format: 'RGBA' });
      }).toThrow(TypeError);
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

      expect(frame.allocationSize()).toBe(width * height * 4);
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

      expect(frame.allocationSize()).toBe(Math.floor(width * height * 1.5));
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

      expect(clone.format).toBe(frame.format);
      expect(clone.codedWidth).toBe(frame.codedWidth);
      expect(clone.codedHeight).toBe(frame.codedHeight);
      expect(clone.timestamp).toBe(frame.timestamp);

      // Closing original shouldn't affect clone
      frame.close();
      expect(clone.codedWidth).toBe(width);

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

      expect(() => frame.allocationSize()).toThrow();
      expect(() => frame.clone()).toThrow();
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

      expect(audioData.format).toBe('f32');
      expect(audioData.sampleRate).toBe(sampleRate);
      expect(audioData.numberOfFrames).toBe(numberOfFrames);
      expect(audioData.numberOfChannels).toBe(numberOfChannels);
      expect(audioData.timestamp).toBe(0);

      // Duration should be calculated correctly
      const expectedDuration = Math.floor((numberOfFrames / sampleRate) * 1_000_000);
      expect(audioData.duration).toBe(expectedDuration);

      audioData.close();
    });

    it('should throw if required parameters are missing', () => {
      expect(() => {
        new AudioData({});
      }).toThrow(TypeError);
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

      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(
        numberOfFrames * numberOfChannels * 4
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

      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(
        numberOfFrames * 4
      );

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
      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(numberOfFrames * 4);
      expect(audioData.allocationSize({ planeIndex: 1 })).toBe(numberOfFrames * 4);

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
      expect(size).toBe(numberOfFrames * numberOfChannels * 2);

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

      expect(() => audioData.allocationSize({ planeIndex: 1 })).toThrow();
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
      expect(size).toBe(100 * numberOfChannels * 4); // 100 frames * 2 channels * 4 bytes

      audioData.close();
    });
  });

  describe('copyTo', () => {
    it('should throw if AudioData is closed', () => {
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
      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow(/InvalidStateError/);
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
      expect(() => audioData.copyTo(dest, { planeIndex: 0 })).toThrow();

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
      expect(() => audioData.copyTo(dest, { planeIndex: 2 })).toThrow();

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
      expect(dest[0]).toBeCloseTo(0.10, 5);
      // Verify last sample is from frame 19
      expect(dest[dest.length - 1]).toBeCloseTo(0.19, 5);

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
      expect(dest[0]).toBeCloseTo(1.0, 5);
      expect(dest[99]).toBeCloseTo(1.99, 5);

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

      expect(clone.format).toBe(audioData.format);
      expect(clone.sampleRate).toBe(audioData.sampleRate);
      expect(clone.numberOfFrames).toBe(audioData.numberOfFrames);
      expect(clone.numberOfChannels).toBe(audioData.numberOfChannels);
      expect(clone.timestamp).toBe(audioData.timestamp);

      audioData.close();
      expect(clone.sampleRate).toBe(48000);

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

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.duration).toBeNull();
      expect(chunk.byteLength).toBe(6);
    });

    it('should create a delta chunk with duration', () => {
      const data = new Uint8Array([0x00, 0x00, 0x01, 0x41]);

      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        duration: 33333,
        data,
      });

      expect(chunk.type).toBe('delta');
      expect(chunk.timestamp).toBe(33333);
      expect(chunk.duration).toBe(33333);
      expect(chunk.byteLength).toBe(4);
    });

    it('should throw for invalid type', () => {
      expect(() => {
        new EncodedVideoChunk({
          type: 'invalid' as any,
          timestamp: 0,
          data: new Uint8Array(1),
        });
      }).toThrow(TypeError);
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

      expect(dest.slice(0, 6)).toEqual(srcData);
    });

    it('should throw if destination is too small', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array(10),
      });

      expect(() => {
        chunk.copyTo(new Uint8Array(5));
      }).toThrow(TypeError);
    });
  });
});

describe('EncodedAudioChunk', () => {
  describe('constructor', () => {
    it('should create an audio chunk', () => {
      const data = new Uint8Array([0xFF, 0xF1, 0x50, 0x80]);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        duration: 21333,
        data,
      });

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.duration).toBe(21333);
      expect(chunk.byteLength).toBe(4);
    });
  });

  describe('copyTo', () => {
    it('should copy data to destination buffer', () => {
      const srcData = new Uint8Array([0xFF, 0xF1, 0x50, 0x80, 0x00, 0x1F]);
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: srcData,
      });

      const dest = new Uint8Array(10);
      chunk.copyTo(dest);

      expect(dest.slice(0, 6)).toEqual(srcData);
    });
  });
});

describe('VideoColorSpace', () => {
  it('should use default values when no init provided', () => {
    const colorSpace = new VideoColorSpace();

    expect(colorSpace.primaries).toBeNull();
    expect(colorSpace.transfer).toBeNull();
    expect(colorSpace.matrix).toBeNull();
    expect(colorSpace.fullRange).toBeNull();
  });

  it('should accept init values', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: true,
    });

    expect(colorSpace.primaries).toBe('bt709');
    expect(colorSpace.transfer).toBe('bt709');
    expect(colorSpace.matrix).toBe('bt709');
    expect(colorSpace.fullRange).toBe(true);
  });

  it('should serialize to JSON', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'smpte170m',
      matrix: 'bt709',
      fullRange: false,
    });

    const json = colorSpace.toJSON();

    expect(json.primaries).toBe('bt709');
    expect(json.transfer).toBe('smpte170m');
    expect(json.matrix).toBe('bt709');
    expect(json.fullRange).toBe(false);
  });
});
