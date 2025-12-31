import { describe, expect, it } from 'vitest';

describe('EncodedAudioChunk', () => {
  describe('constructor type validation', () => {
    it('should throw TypeError for invalid type value', () => {
      expect(() => new EncodedAudioChunk({
        type: 'invalid' as any,
        timestamp: 0,
        data: new Uint8Array([1, 2, 3, 4]),
      })).toThrow(TypeError);
    });

    it('should accept key and delta types', () => {
      const keyChunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      expect(keyChunk.type).toBe('key');

      const deltaChunk = new EncodedAudioChunk({
        type: 'delta',
        timestamp: 1000,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      expect(deltaChunk.type).toBe('delta');
    });
  });
});
