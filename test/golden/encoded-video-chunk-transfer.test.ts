import { describe, expect, it } from 'vitest';

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
    expect(buffer.byteLength).toBe(0);
    // Chunk should still have the data
    expect(chunk.byteLength).toBe(100);
  });

  it('should work without transfer option', () => {
    const buffer = new ArrayBuffer(100);

    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: buffer,
    });

    // Buffer should NOT be detached
    expect(buffer.byteLength).toBe(100);
    expect(chunk.byteLength).toBe(100);
  });
});
