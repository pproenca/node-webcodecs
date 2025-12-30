/**
 * Tests for AudioDecoder
 */

import {beforeEach, afterEach, expect, it, describe} from 'vitest';

describe('AudioDecoder', () => {
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
