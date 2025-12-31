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

  describe('transfer semantics', () => {
    it('should detach transferred ArrayBuffer after construction', () => {
      const buffer = new ArrayBuffer(100);
      const data = new Uint8Array(buffer);
      data.fill(42);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: buffer,
        transfer: [buffer],
      });

      // ArrayBuffer should be detached (byteLength becomes 0)
      expect(buffer.byteLength).toBe(0);
      expect(chunk.byteLength).toBe(100);
    });

    it('should work without transfer option', () => {
      const buffer = new ArrayBuffer(100);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: buffer,
      });

      expect(buffer.byteLength).toBe(100);
      expect(chunk.byteLength).toBe(100);
    });
  });
});
