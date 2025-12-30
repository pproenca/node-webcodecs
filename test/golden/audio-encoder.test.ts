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

  describe('bitrateMode support', () => {
    it('should support bitrateMode in isConfigSupported', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'constant',
      });

      expect(result.supported).toBe(true);
      expect(result.config.bitrateMode).toBe('constant');
    });

    it('should support variable bitrateMode', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'variable',
      });

      expect(result.supported).toBe(true);
      expect(result.config.bitrateMode).toBe('variable');
    });

    it('should accept bitrateMode in configure()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128000,
          bitrateMode: 'constant',
        });
      }).not.toThrow();

      expect(encoder.state).toBe('configured');
      encoder.close();
    });
  });
});

describe('W3C Interface Compliance', () => {
  describe('AudioEncoder interface', () => {
    it('should have all required properties per W3C spec', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Required properties per W3C WebCodecs spec
      expect(encoder).toHaveProperty('state');
      expect(encoder).toHaveProperty('encodeQueueSize');

      // State should be a string
      expect(typeof encoder.state).toBe('string');

      // encodeQueueSize should be a number
      expect(typeof encoder.encodeQueueSize).toBe('number');

      encoder.close();
    });

    it('should have all required methods per W3C spec', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Required methods per W3C WebCodecs spec
      expect(typeof encoder.configure).toBe('function');
      expect(typeof encoder.encode).toBe('function');
      expect(typeof encoder.flush).toBe('function');
      expect(typeof encoder.reset).toBe('function');
      expect(typeof encoder.close).toBe('function');

      encoder.close();
    });

    it('should have static isConfigSupported method', () => {
      expect(typeof AudioEncoder.isConfigSupported).toBe('function');
    });

    it('should have ondequeue callback property', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // ondequeue should exist and be settable
      expect('ondequeue' in encoder).toBe(true);
      expect(encoder.ondequeue).toBe(null);

      const handler = () => {};
      encoder.ondequeue = handler;
      expect(encoder.ondequeue).toBe(handler);

      encoder.close();
    });

    it('should extend EventTarget for dequeue event', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Per W3C spec, AudioEncoder extends EventTarget
      expect(typeof encoder.addEventListener).toBe('function');
      expect(typeof encoder.removeEventListener).toBe('function');
      expect(typeof encoder.dispatchEvent).toBe('function');

      encoder.close();
    });
  });

  describe('state machine', () => {
    it('should start in unconfigured state', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      expect(encoder.state).toBe('unconfigured');
      encoder.close();
    });

    it('should transition to configured after configure()', () => {
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

      encoder.close();
    });

    it('should transition back to unconfigured after reset()', () => {
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

    it('should transition to closed after close()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();
      expect(encoder.state).toBe('closed');
    });

    it('should allow reconfigure after reset', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      encoder.reset();
      encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');

      encoder.close();
    });
  });

  describe('AudioEncoderConfig properties', () => {
    it('should echo core config properties in isConfigSupported result', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      };

      const result = await AudioEncoder.isConfigSupported(config);
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe(config.codec);
      expect(result.config.sampleRate).toBe(config.sampleRate);
      expect(result.config.numberOfChannels).toBe(config.numberOfChannels);
      expect(result.config.bitrate).toBe(config.bitrate);
    });

    it('should return supported=false for unsupported codecs', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'invalid-codec-string',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(false);
    });
  });

  describe('Opus codec support', () => {
    it('should support opus codec string', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('opus');
    });
  });

  describe('AAC codec support', () => {
    it('should support mp4a.40.2 codec string (AAC-LC)', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('mp4a.40.2');
    });
  });

  describe('dequeue event', () => {
    it('should fire dequeue event after output callback', async () => {
      let dequeueFired = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.addEventListener('dequeue', () => {
        dequeueFired = true;
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
      await encoder.flush();
      audioData.close();

      // Give time for async events
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(dequeueFired).toBe(true);

      encoder.close();
    });

    it('should call ondequeue callback after output', async () => {
      let callbackCalled = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.ondequeue = () => {
        callbackCalled = true;
      };

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
      await encoder.flush();
      audioData.close();

      // Give time for async callbacks
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbackCalled).toBe(true);

      encoder.close();
    });
  });

  describe('AAC bitstream format', () => {
    it('should support aac.format = aac in isConfigSupported', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        aac: {format: 'aac'},
      });
      expect(result.supported).toBe(true);
      expect(result.config.aac).toBeDefined();
      expect(result.config.aac?.format).toBe('aac');
    });

    it('should support aac.format = adts in isConfigSupported', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        aac: {format: 'adts'},
      });
      expect(result.supported).toBe(true);
      expect(result.config.aac?.format).toBe('adts');
    });
  });
});
