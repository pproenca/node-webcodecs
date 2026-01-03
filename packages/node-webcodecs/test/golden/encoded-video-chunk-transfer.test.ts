import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('EncodedVideoChunk transfer semantics', () => {
  it('should detach transferred ArrayBuffer after construction', () => {
    const buffer = new ArrayBuffer(100);
    const data = new Uint8Array(buffer);
    data.fill(42);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
      transfer: [buffer],
    });

    // ArrayBuffer should be detached (byteLength becomes 0)
    assert.strictEqual(buffer.byteLength, 0);
    // Chunk should still have the data
    assert.strictEqual(chunk.byteLength, 100);
  });

  it('should work without transfer option', () => {
    const buffer = new ArrayBuffer(100);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
    });

    // Buffer should NOT be detached
    assert.strictEqual(buffer.byteLength, 100);
    assert.strictEqual(chunk.byteLength, 100);
  });
});
