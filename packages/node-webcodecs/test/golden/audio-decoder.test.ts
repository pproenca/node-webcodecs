/**
 * Tests for AudioDecoder
 */

import * as assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { expectDOMException } from '../fixtures/test-helpers';

describe('AudioDecoder', () => {
  describe('configure() W3C compliance', () => {
    it('should throw TypeError when codec is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(() => {
        decoder.configure({
          sampleRate: 48000,
          numberOfChannels: 2,
        } as AudioDecoderConfig);
      }, TypeError);

      decoder.close();
    });

    it('should throw TypeError when sampleRate is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(() => {
        decoder.configure({
          codec: 'opus',
          numberOfChannels: 2,
        } as AudioDecoderConfig);
      }, TypeError);

      decoder.close();
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.throws(() => {
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
        } as AudioDecoderConfig);
      }, TypeError);

      decoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      expectDOMException('InvalidStateError', () => {
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
      });
    });
  });

  describe('decode() W3C compliance', () => {
    it('should throw InvalidStateError when unconfigured', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 0]),
      });

      expectDOMException('InvalidStateError', () => decoder.decode(chunk));

      decoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 0]),
      });

      expectDOMException('InvalidStateError', () => decoder.decode(chunk));
    });
  });

  describe('reset() W3C compliance', () => {
    it('should NOT throw when decoder is closed (W3C spec)', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      // W3C spec: reset() should be a no-op when closed, not throw
      assert.doesNotThrow(() => decoder.reset());
    });

    it('should transition to unconfigured state', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(decoder.state, 'configured');

      decoder.reset();

      assert.strictEqual(decoder.state, 'unconfigured');

      decoder.close();
    });
  });

  describe('MP3 codec support', () => {
    it('should support mp3 codec string', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'mp3',
        sampleRate: 44100,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'mp3');
    });

    it('should configure with mp3 codec', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.doesNotThrow(() => {
        decoder.configure({
          codec: 'mp3',
          sampleRate: 44100,
          numberOfChannels: 2,
        });
      });

      assert.strictEqual(decoder.state, 'configured');

      decoder.close();
    });
  });

  describe('decodeQueueSize tracking', () => {
    let decoder: AudioDecoder | null = null;
    const outputData: AudioData[] = [];

    after(() => {
      try {
        decoder?.close();
      } catch {
        // Already closed or never created
      }
      outputData.forEach((d) => {
        try {
          d.close();
        } catch {
          // Already closed
        }
      });
      outputData.length = 0;
      decoder = null;
    });

    it('should track pending decode operations', async () => {
      decoder = new AudioDecoder({
        output: (data) => {
          outputData.push(data);
        },
        error: (e) => {
          throw e;
        },
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(decoder.decodeQueueSize, 0);

      await decoder.flush();
      assert.strictEqual(decoder.decodeQueueSize, 0);
    });
  });

  describe('FLAC codec support', () => {
    it('should support flac codec string', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'flac',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'flac');
    });

    it('should configure with flac codec', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      assert.doesNotThrow(() => {
        decoder.configure({
          codec: 'flac',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
      });

      assert.strictEqual(decoder.state, 'configured');

      decoder.close();
    });
  });

  describe('Vorbis codec support', () => {
    it('should support vorbis codec string', async () => {
      const result = await AudioDecoder.isConfigSupported({
        codec: 'vorbis',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      assert.strictEqual(result.supported, true);
      assert.strictEqual(result.config.codec, 'vorbis');
    });

    it('should recognize vorbis codec and require description', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      // Vorbis codec is recognized but requires codec-specific extradata
      // (identification, comment, setup headers) via the description property.
      // Without description, FFmpeg cannot initialize the decoder.
      // This test verifies the codec string is recognized (not NotSupportedError).
      try {
        decoder.configure({
          codec: 'vorbis',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        // If we get here without error, vorbis is configured (unlikely without description)
      } catch (e) {
        // Should NOT be NotSupportedError (codec is recognized)
        assert.ok(!(e as Error).message.includes('NotSupportedError'));
        // Error should be about opening decoder (missing extradata), not unknown codec
        assert.ok((e as Error).message.includes('Could not open decoder'));
      }

      decoder.close();
    });
  });

  describe('W3C interface compliance', () => {
    it('should NOT have codecSaturated property (non-standard)', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      // W3C spec does not include codecSaturated
      assert.strictEqual('codecSaturated' in decoder, false);

      decoder.close();
    });
  });
});
