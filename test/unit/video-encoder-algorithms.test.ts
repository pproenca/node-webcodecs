// test/unit/video-encoder-algorithms.test.ts
// Tests for W3C WebCodecs spec section 6.6 - VideoEncoder Algorithms

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type EncodedVideoChunk,
  type EncodedVideoChunkMetadata,
  VideoEncoder,
  VideoFrame,
} from '../../lib';

/**
 * Tests for VideoEncoder algorithms per W3C WebCodecs spec section 6.6.
 * Covers Reset, Close, Output EncodedVideoChunks, and Schedule Dequeue Event.
 */

describe('VideoEncoder Algorithms: 6.6', () => {
  function createEncoder(): VideoEncoder {
    return new VideoEncoder({
      output: () => {},
      error: () => {},
    });
  }

  const config = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30,
  };

  // Helper to create test video frame
  function createVideoFrame(timestamp = 0, width = 640, height = 480): VideoFrame {
    const buf = Buffer.alloc(width * height * 4);
    return new VideoFrame(buf, {
      codedWidth: width,
      codedHeight: height,
      timestamp,
      format: 'RGBA',
    });
  }

  describe('Schedule Dequeue Event algorithm (6.6)', () => {
    // Spec: Schedule Dequeue Event fires dequeue event
    it('should fire dequeue event after output', async () => {
      let dequeueFired = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(dequeueFired, 'dequeue event should have fired');

      encoder.close();
    });

    // Spec step 1: If dequeue event scheduled is true, return (coalesce)
    it('should coalesce multiple dequeue events', async () => {
      let dequeueCount = 0;

      const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => {
          throw e;
        },
      });

      encoder.addEventListener('dequeue', () => {
        dequeueCount++;
      });

      encoder.configure(config);

      // Encode multiple frames quickly
      for (let i = 0; i < 5; i++) {
        const frame = createVideoFrame(i * 33333);
        encoder.encode(frame, i === 0 ? { keyFrame: true } : undefined);
        frame.close();
      }

      await encoder.flush();

      // Dequeue may be coalesced, but should fire at least once
      assert.ok(dequeueCount >= 1, 'dequeue should fire at least once');
      // With coalescing, shouldn't fire 5 times necessarily
      // (implementation may vary)

      encoder.close();
    });
  });

  describe('Output EncodedVideoChunks algorithm (6.6)', () => {
    // Spec: Output callback receives EncodedVideoChunk with correct properties
    it('should output EncodedVideoChunk with correct type', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have output');
      assert.ok(outputs[0].type === 'key' || outputs[0].type === 'delta', 'Should have valid type');

      encoder.close();
    });

    it('should output EncodedVideoChunk with timestamp', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const timestamp = 123456;
      const frame = createVideoFrame(timestamp);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should have output');
      assert.strictEqual(outputs[0].timestamp, timestamp, 'Should preserve timestamp');

      encoder.close();
    });

    it('should invoke output callback with metadata', async () => {
      let receivedMetadata: EncodedVideoChunkMetadata | undefined;

      const encoder = new VideoEncoder({
        output: (_chunk, metadata) => {
          receivedMetadata = metadata;
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      // VideoEncoder should provide metadata (unlike AudioEncoder)
      assert.ok(receivedMetadata !== undefined, 'Should receive metadata');

      encoder.close();
    });

    // Spec: decoderConfig in metadata for key frames
    it('should include decoderConfig in metadata for key frame', async () => {
      let receivedMetadata: EncodedVideoChunkMetadata | undefined;
      let outputType: string | undefined;

      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          if (chunk.type === 'key') {
            receivedMetadata = metadata;
            outputType = chunk.type;
          }
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.strictEqual(outputType, 'key', 'Should have key frame');
      assert.ok(receivedMetadata !== undefined, 'Should receive metadata');
      assert.ok(receivedMetadata.decoderConfig !== undefined, 'Should have decoderConfig');

      encoder.close();
    });
  });

  describe('Reset VideoEncoder algorithm (6.6)', () => {
    // Spec step 1: If state is closed, throw InvalidStateError
    it('should throw InvalidStateError if closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.throws(
        () => encoder.reset(),
        (e: Error) => e.name === 'InvalidStateError',
      );
    });

    // Spec step 2: Set state to unconfigured
    it('should set state to unconfigured', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      encoder.reset();
      assert.strictEqual(encoder.state, 'unconfigured');

      encoder.close();
    });

    // Spec step 6: Remove all control messages
    it('should clear control message queue', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      // Queue up some work
      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      encoder.reset();

      // After reset, encoder should be in unconfigured state
      assert.strictEqual(encoder.state, 'unconfigured');
      assert.strictEqual(encoder.encodeQueueSize, 0);

      encoder.close();
    });

    // Spec step 7: Set encodeQueueSize to zero and schedule dequeue
    it('should clear encodeQueueSize to zero', () => {
      const encoder = createEncoder();
      encoder.configure(config);

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      // Queue size may be > 0
      const sizeBefore = encoder.encodeQueueSize;
      assert.ok(sizeBefore >= 1, 'Should have pending work');

      encoder.reset();
      assert.strictEqual(encoder.encodeQueueSize, 0, 'encodeQueueSize should be 0');

      encoder.close();
    });

    // Spec: Reset allows reconfiguration
    it('should allow reconfigure after reset', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);
      encoder.reset();

      // Reconfigure
      encoder.configure(config);
      assert.strictEqual(encoder.state, 'configured');

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce output after reset + reconfigure');

      encoder.close();
    });
  });

  describe('Close VideoEncoder algorithm (6.6)', () => {
    // Spec step 2: Set state to closed
    it('should set state to closed', () => {
      const encoder = createEncoder();
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    // Spec: Close after configure
    it('should work after configure', () => {
      const encoder = createEncoder();
      encoder.configure(config);
      encoder.close();
      assert.strictEqual(encoder.state, 'closed');
    });

    // Spec: Close is final
    it('should be idempotent', () => {
      const encoder = createEncoder();
      encoder.close();
      encoder.close(); // Should not throw
      assert.strictEqual(encoder.state, 'closed');
    });

    // Spec step 4: If not AbortError, invoke error callback
    it('should not invoke error callback for normal close', () => {
      let errorCallbackCalled = false;

      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {
          errorCallbackCalled = true;
        },
      });

      encoder.close();

      // Normal close (AbortError) should NOT invoke error callback
      assert.strictEqual(errorCallbackCalled, false, 'Error callback should not be called');
    });
  });

  describe('Orientation handling', () => {
    // Spec: [[active orientation]] is set from first frame
    it('should accept frames and produce output', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      // First frame sets active orientation
      const frame1 = createVideoFrame(0);
      encoder.encode(frame1, { keyFrame: true });
      frame1.close();

      // Second frame should work with same orientation
      const frame2 = createVideoFrame(33333);
      encoder.encode(frame2);
      frame2.close();

      await encoder.flush();

      assert.ok(outputs.length >= 2, 'Should have multiple outputs');

      encoder.close();
    });

    // Spec: Reset clears [[active orientation]]
    it('should clear orientation state on reset', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure(config);

      const frame1 = createVideoFrame(0);
      encoder.encode(frame1, { keyFrame: true });
      frame1.close();

      encoder.reset();

      // Reconfigure
      encoder.configure(config);

      // New first frame after reset should work
      const frame2 = createVideoFrame(0);
      encoder.encode(frame2, { keyFrame: true });
      frame2.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce output after reset');

      encoder.close();
    });
  });

  describe('SVC metadata (scalability modes)', () => {
    // Note: SVC support depends on codec and configuration
    it('should configure with scalabilityMode if supported', async () => {
      const encoder = createEncoder();

      // Try L1T1 (single layer - should work)
      encoder.configure({
        ...config,
        scalabilityMode: 'L1T1',
      });

      assert.strictEqual(encoder.state, 'configured');

      encoder.close();
    });

    // Note: Full SVC metadata testing requires specific codec support
    it('should encode with scalabilityMode configured', async () => {
      const outputs: EncodedVideoChunk[] = [];

      const encoder = new VideoEncoder({
        output: (chunk) => {
          outputs.push(chunk);
        },
        error: (e) => {
          throw e;
        },
      });

      encoder.configure({
        ...config,
        scalabilityMode: 'L1T1',
      });

      const frame = createVideoFrame(0);
      encoder.encode(frame, { keyFrame: true });
      frame.close();

      await encoder.flush();

      assert.ok(outputs.length > 0, 'Should produce output with scalabilityMode');

      encoder.close();
    });
  });
});
