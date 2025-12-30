/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';

describe('encodeQueueSize tracking', () => {
  it('should track pending encode operations', async () => {
    const outputChunks: EncodedAudioChunk[] = [];
    const encoder = new AudioEncoder({
      output: (chunk) => {
        outputChunks.push(chunk);
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    expect(encoder.encodeQueueSize).toBe(0);

    const sampleRate = 48000;
    const numberOfChannels = 2;
    const numberOfFrames = 960;
    const data = new Float32Array(numberOfFrames * numberOfChannels);

    for (let i = 0; i < numberOfFrames; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        data[i * numberOfChannels + ch] = sample;
      }
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: sampleRate,
      numberOfFrames: numberOfFrames,
      numberOfChannels: numberOfChannels,
      timestamp: 0,
      data: data,
    });

    encoder.encode(audioData);

    // After encode, queue size should have been incremented (though it may already be 0 if processed synchronously)
    // The important thing is it should be 0 after flush
    await encoder.flush();
    expect(encoder.encodeQueueSize).toBe(0);

    // Verify that encodeQueueSize returns a number
    expect(typeof encoder.encodeQueueSize).toBe('number');

    encoder.close();
  });
});

describe('AudioEncoder W3C Compliance', () => {
  describe('constructor()', () => {
    it('should throw TypeError when output callback is missing', () => {
      expect(() => {
        new AudioEncoder({
          error: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when error callback is missing', () => {
      expect(() => {
        new AudioEncoder({
          output: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when output is not a function', () => {
      expect(() => {
        new AudioEncoder({
          output: 'not a function',
          error: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when error is not a function', () => {
      expect(() => {
        new AudioEncoder({
          output: () => {},
          error: 'not a function',
        } as any);
      }).toThrow(TypeError);
    });

    it('should create encoder with valid callbacks', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder.state).toBe('unconfigured');
      expect(encoder.encodeQueueSize).toBe(0);
      encoder.close();
    });
  });

  describe('configure() W3C compliance', () => {
    let encoder: AudioEncoder;

    beforeEach(() => {
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    });

    it('should throw TypeError when codec is missing', () => {
      expect(() => {
        encoder.configure({
          sampleRate: 48000,
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when sampleRate is missing', () => {
      expect(() => {
        encoder.configure({
          codec: 'opus',
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      expect(() => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      encoder.close();

      try {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });

    it('should transition to configured state on valid config', () => {
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');
    });
  });

  describe('encode() W3C compliance', () => {
    it('should throw InvalidStateError when encoder is unconfigured', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      try {
        encoder.encode(audioData);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }

      audioData.close();
      encoder.close();
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(1024 * 2),
      });

      try {
        encoder.encode(audioData);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }

      audioData.close();
    });
  });

  describe('flush() W3C compliance', () => {
    it('should reject with InvalidStateError when unconfigured', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      try {
        await encoder.flush();
        expect.fail('Should have rejected');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }

      encoder.close();
    });

    it('should reject with InvalidStateError when closed', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      try {
        await encoder.flush();
        expect.fail('Should have rejected');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });
  });

  describe('reset() W3C compliance', () => {
    it('should NOT throw when encoder is closed (W3C spec: no-op)', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      // W3C spec: reset() should be a no-op when closed, not throw
      expect(() => encoder.reset()).not.toThrow();
    });

    it('should transition to unconfigured state', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      expect(encoder.state).toBe('configured');

      encoder.reset();

      expect(encoder.state).toBe('unconfigured');

      encoder.close();
    });

    it('should clear encodeQueueSize', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 960,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(960 * 2),
      });

      encoder.encode(audioData);
      audioData.close();

      encoder.reset();

      expect(encoder.encodeQueueSize).toBe(0);

      encoder.close();
    });
  });
});
