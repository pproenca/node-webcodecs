/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * ArrayBuffer transfer utilities for W3C WebCodecs transfer semantics.
 */

/**
 * Detach ArrayBuffers per W3C WebCodecs transfer semantics.
 * Uses structuredClone with transfer to detach, making the original buffer unusable.
 */
export function detachArrayBuffers(buffers: ArrayBuffer[]): void {
  for (const buffer of buffers) {
    if (buffer.byteLength === 0) continue; // Already detached
    try {
      // Modern approach: use structuredClone with transfer to detach
      // This makes the original buffer unusable (byteLength becomes 0)
      structuredClone(buffer, { transfer: [buffer] });
    } catch {
      // Fallback for environments without transfer support
      // We can't truly detach, but the data has been copied to native
      console.warn('ArrayBuffer transfer not supported, data copied instead');
    }
  }
}
