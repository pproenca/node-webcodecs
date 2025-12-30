/**
 * Tests for AudioDecoder
 */

import {beforeEach, afterEach, expect, it, describe} from 'vitest';

describe('AudioDecoder', () => {
  describe('configure() W3C compliance', () => {
    it('should throw TypeError when codec is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        decoder.configure({
          sampleRate: 48000,
          numberOfChannels: 2,
        } as AudioDecoderConfig);
      }).toThrow(TypeError);

      decoder.close();
    });

    it('should throw TypeError when sampleRate is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        decoder.configure({
          codec: 'opus',
          numberOfChannels: 2,
        } as AudioDecoderConfig);
      }).toThrow(TypeError);

      decoder.close();
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
        } as AudioDecoderConfig);
      }).toThrow(TypeError);

      decoder.close();
    });

    it('should throw InvalidStateError when closed', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      decoder.close();

      expect(() => {
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
      }).toThrow(DOMException);

      try {
        decoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
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

      expect(() => decoder.decode(chunk)).toThrow(DOMException);

      try {
        decoder.decode(chunk);
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }

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

      expect(() => decoder.decode(chunk)).toThrow(DOMException);

      try {
        decoder.decode(chunk);
      } catch (e) {
        expect((e as DOMException).name).toBe('InvalidStateError');
      }
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
      expect(() => decoder.reset()).not.toThrow();
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

      expect(decoder.state).toBe('configured');

      decoder.reset();

      expect(decoder.state).toBe('unconfigured');

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

      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('mp3');
    });

    it('should configure with mp3 codec', () => {
      const decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });

      expect(() => {
        decoder.configure({
          codec: 'mp3',
          sampleRate: 44100,
          numberOfChannels: 2,
        });
      }).not.toThrow();

      expect(decoder.state).toBe('configured');

      decoder.close();
    });
  });

  describe('decodeQueueSize tracking', () => {
    it('should track pending decode operations', async () => {
      const outputData: AudioData[] = [];
      const decoder = new AudioDecoder({
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

      expect(decoder.decodeQueueSize).toBe(0);

      await decoder.flush();
      expect(decoder.decodeQueueSize).toBe(0);

      outputData.forEach(d => d.close());
      decoder.close();
    });
  });
});
