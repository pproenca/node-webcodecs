/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { expectDOMException, expectDOMExceptionAsync } from '../fixtures/test-helpers';

describe('codec support', () => {
  it('should support FLAC encoding', async () => {
    const support = await AudioEncoder.isConfigSupported({
      codec: 'flac',
      sampleRate: 44100,
      numberOfChannels: 2,
    });

    assert.strictEqual(support.supported, true);
  });

  it('should support MP3 encoding', async () => {
    const support = await AudioEncoder.isConfigSupported({
      codec: 'mp3',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    assert.strictEqual(support.supported, true);
  });

  it('should support Vorbis encoding', async () => {
    const support = await AudioEncoder.isConfigSupported({
      codec: 'vorbis',
      sampleRate: 44100,
      numberOfChannels: 2,
    });

    assert.strictEqual(support.supported, true);
  });
});

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

    assert.strictEqual(encoder.encodeQueueSize, 0);

    const sampleRate = 48000;
    const numberOfChannels = 2;
    const numberOfFrames = 960;
    const data = new Float32Array(numberOfFrames * numberOfChannels);

    for (let i = 0; i < numberOfFrames; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
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
    assert.strictEqual(encoder.encodeQueueSize, 0);

    // Verify that encodeQueueSize returns a number
    assert.strictEqual(typeof encoder.encodeQueueSize, 'number');

    encoder.close();
  });
});

describe('AudioEncoder W3C Compliance', () => {
  describe('constructor()', () => {
    it('should throw TypeError when output callback is missing', () => {
      assert.throws(() => {
        // @ts-expect-error Testing invalid input without output
        new AudioEncoder({
          error: () => {},
        });
      }, TypeError);
    });

    it('should throw TypeError when error callback is missing', () => {
      assert.throws(() => {
        // @ts-expect-error Testing invalid input without error
        new AudioEncoder({
          output: () => {},
        });
      }, TypeError);
    });

    it('should throw TypeError when output is not a function', () => {
      assert.throws(() => {
        // @ts-expect-error Testing invalid input with wrong type
        new AudioEncoder({
          output: 'not a function',
          error: () => {},
        });
      }, TypeError);
    });

    it('should throw TypeError when error is not a function', () => {
      assert.throws(() => {
        // @ts-expect-error Testing invalid input with wrong type
        new AudioEncoder({
          output: () => {},
          error: 'not a function',
        });
      }, TypeError);
    });

    it('should create encoder with valid callbacks', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      assert.strictEqual(encoder.state, 'unconfigured');
      assert.strictEqual(encoder.encodeQueueSize, 0);
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
      assert.throws(() => {
        encoder.configure({
          sampleRate: 48000,
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }, TypeError);
    });

    it('should throw TypeError when sampleRate is missing', () => {
      assert.throws(() => {
        encoder.configure({
          codec: 'opus',
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }, TypeError);
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      assert.throws(() => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
        } as AudioEncoderConfig);
      }, TypeError);
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      encoder.close();

      expectDOMException('InvalidStateError', () => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
      });
    });

    it('should transition to configured state on valid config', () => {
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(encoder.state, 'configured');
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

      expectDOMException('InvalidStateError', () => encoder.encode(audioData));

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

      expectDOMException('InvalidStateError', () => encoder.encode(audioData));

      audioData.close();
    });
  });

  describe('flush() W3C compliance', () => {
    it('should reject with InvalidStateError when unconfigured', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      await expectDOMExceptionAsync('InvalidStateError', () => encoder.flush());

      encoder.close();
    });

    it('should reject with InvalidStateError when closed', async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();

      await expectDOMExceptionAsync('InvalidStateError', () => encoder.flush());
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
      assert.doesNotThrow(() => encoder.reset());
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

      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();

      assert.strictEqual(encoder.state, 'unconfigured');

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

      assert.strictEqual(encoder.encodeQueueSize, 0);

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

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.bitrateMode, 'constant');
    });

    it('should support variable bitrateMode', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'variable',
      });

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.bitrateMode, 'variable');
    });

    it('should accept bitrateMode in configure()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      assert.doesNotThrow(() => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128000,
          bitrateMode: 'constant',
        });
      });

      assert.strictEqual(encoder.state, 'configured');
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
      assert.ok('state' in encoder);
      assert.ok('encodeQueueSize' in encoder);

      // State should be a string
      assert.strictEqual(typeof encoder.state, 'string');

      // encodeQueueSize should be a number
      assert.strictEqual(typeof encoder.encodeQueueSize, 'number');

      encoder.close();
    });

    it('should have all required methods per W3C spec', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Required methods per W3C WebCodecs spec
      assert.strictEqual(typeof encoder.configure, 'function');
      assert.strictEqual(typeof encoder.encode, 'function');
      assert.strictEqual(typeof encoder.flush, 'function');
      assert.strictEqual(typeof encoder.reset, 'function');
      assert.strictEqual(typeof encoder.close, 'function');

      encoder.close();
    });

    it('should have static isConfigSupported method', () => {
      assert.strictEqual(typeof AudioEncoder.isConfigSupported, 'function');
    });

    it('should have ondequeue callback property', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // ondequeue should exist and be settable
      assert.strictEqual('ondequeue' in encoder, true);
      assert.strictEqual(encoder.ondequeue, null);

      const handler = () => {};
      encoder.ondequeue = handler;
      assert.strictEqual(encoder.ondequeue, handler);

      encoder.close();
    });

    it('should extend EventTarget for dequeue event', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Per W3C spec, AudioEncoder extends EventTarget
      assert.strictEqual(typeof encoder.addEventListener, 'function');
      assert.strictEqual(typeof encoder.removeEventListener, 'function');
      assert.strictEqual(typeof encoder.dispatchEvent, 'function');

      encoder.close();
    });
  });

  describe('state machine', () => {
    it('should start in unconfigured state', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      assert.strictEqual(encoder.state, 'unconfigured');
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
      assert.strictEqual(encoder.state, 'configured');

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
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    it('should transition to closed after close()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
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
      assert.strictEqual(encoder.state, 'configured');

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
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, config.codec);
      assert.strictEqual(result.config.sampleRate, config.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, config.numberOfChannels);
      assert.strictEqual(result.config.bitrate, config.bitrate);
    });

    it('should return supported=false for unsupported codecs', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'invalid-codec-string',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, false);
    });
  });

  describe('Opus codec support', () => {
    it('should support opus codec string', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'opus');
    });
  });

  describe('AAC codec support', () => {
    it('should support mp4a.40.2 codec string (AAC-LC)', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'mp4a.40.2');
    });
  });

  describe('dequeue event', () => {
    it('should fire dequeue event after output callback', async () => {
      const dequeuePromise = new Promise<void>((resolve) => {
        const encoder = new AudioEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.addEventListener('dequeue', () => {
          resolve();
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
        encoder.flush().then(() => {
          audioData.close();
          encoder.close();
        });
      });

      // Test passes when dequeue event fires (promise resolves)
      await dequeuePromise;
    });

    it('should call ondequeue callback after output', async () => {
      const callbackPromise = new Promise<void>((resolve) => {
        const encoder = new AudioEncoder({
          output: () => {},
          error: () => {},
        });

        encoder.ondequeue = () => {
          resolve();
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
        encoder.flush().then(() => {
          audioData.close();
          encoder.close();
        });
      });

      // Test passes when ondequeue callback fires (promise resolves)
      await callbackPromise;
    });
  });

  describe('AAC bitstream format', () => {
    it('should support aac.format = aac in isConfigSupported', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        aac: { format: 'aac' },
      });
      assert.strictEqual(result.supported, true);
      assert.notStrictEqual(result.config.aac, undefined);
      assert.strictEqual(result.config.aac?.format, 'aac');
    });

    it('should support aac.format = adts in isConfigSupported', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        aac: { format: 'adts' },
      });
      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.aac?.format, 'adts');
    });
  });

  describe('isConfigSupported W3C compliance', () => {
    it('should echo all recognized AudioEncoderConfig properties for AAC', async () => {
      const inputConfig = {
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'variable' as const,
        aac: { format: 'adts' as const },
      };

      const result = await AudioEncoder.isConfigSupported(inputConfig);

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, inputConfig.codec);
      assert.strictEqual(result.config.sampleRate, inputConfig.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, inputConfig.numberOfChannels);
      assert.strictEqual(result.config.bitrate, inputConfig.bitrate);
      assert.strictEqual(result.config.bitrateMode, inputConfig.bitrateMode);
      assert.strictEqual(result.config.aac?.format, inputConfig.aac.format);
    });

    it('should echo all recognized AudioEncoderConfig properties for Opus', async () => {
      const inputConfig = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'constant' as const,
        opus: {
          application: 'audio',
          complexity: 10,
          format: 'opus',
          frameDuration: 20000,
          signal: 'music',
          usedtx: false,
          useinbandfec: true,
        },
      };

      const result = await AudioEncoder.isConfigSupported(inputConfig);

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, inputConfig.codec);
      assert.strictEqual(result.config.sampleRate, inputConfig.sampleRate);
      assert.strictEqual(result.config.numberOfChannels, inputConfig.numberOfChannels);
      assert.strictEqual(result.config.bitrate, inputConfig.bitrate);
      assert.strictEqual(result.config.bitrateMode, inputConfig.bitrateMode);
      assert.strictEqual(result.config.opus?.application, inputConfig.opus.application);
      assert.strictEqual(result.config.opus?.complexity, inputConfig.opus.complexity);
      assert.strictEqual(result.config.opus?.format, inputConfig.opus.format);
      assert.strictEqual(result.config.opus?.frameDuration, inputConfig.opus.frameDuration);
      assert.strictEqual(result.config.opus?.signal, inputConfig.opus.signal);
      assert.strictEqual(result.config.opus?.usedtx, inputConfig.opus.usedtx);
      assert.strictEqual(result.config.opus?.useinbandfec, inputConfig.opus.useinbandfec);
    });

    it('should not echo unrecognized properties', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        unknownProperty: 'should-not-appear',
      } as any);

      assert.strictEqual(result.supported, true);
      assert.strictEqual((result.config as any).unknownProperty, undefined);
    });
  });
});
