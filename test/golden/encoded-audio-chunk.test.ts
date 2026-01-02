import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('EncodedAudioChunk', () => {
  describe('constructor type validation', () => {
    it('should throw TypeError for invalid type value', () => {
      assert.throws(() => {
        new EncodedAudioChunk({
          type: 'invalid' as any,
          timestamp: 0,
          data: new Uint8Array([1, 2, 3, 4]),
        });
      }, TypeError);
    });

    it('should accept key and delta types', () => {
      const keyChunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      assert.strictEqual(keyChunk.type, 'key');

      const deltaChunk = new EncodedAudioChunk({
        type: 'delta',
        timestamp: 1000,
        data: new Uint8Array([1, 2, 3, 4]),
      });
      assert.strictEqual(deltaChunk.type, 'delta');
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
      assert.strictEqual(buffer.byteLength, 0);
      assert.strictEqual(chunk.byteLength, 100);
    });

    it('should work without transfer option', () => {
      const buffer = new ArrayBuffer(100);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: buffer,
      });

      assert.strictEqual(buffer.byteLength, 100);
      assert.strictEqual(chunk.byteLength, 100);
    });
  });
});
