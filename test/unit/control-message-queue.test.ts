// test/unit/control-message-queue.test.ts

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ControlMessageQueue } from '../../lib/control-message-queue';

describe('ControlMessageQueue', () => {
  describe('FIFO ordering', () => {
    it('should process messages in FIFO order', async () => {
      const queue = new ControlMessageQueue();
      const order: number[] = [];

      queue.enqueue(() => {
        order.push(1);
      });
      queue.enqueue(() => {
        order.push(2);
      });
      queue.enqueue(() => {
        order.push(3);
      });

      await queue.flush();

      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should process async messages in FIFO order', async () => {
      const queue = new ControlMessageQueue();
      const order: number[] = [];

      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
      });
      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 5));
        order.push(2);
      });
      queue.enqueue(async () => {
        order.push(3);
      });

      await queue.flush();

      // Despite different delays, messages should complete in FIFO order
      assert.deepStrictEqual(order, [1, 2, 3]);
    });
  });

  describe('non-blocking behavior', () => {
    it('should return immediately from enqueue (non-blocking)', () => {
      const queue = new ControlMessageQueue();
      let messageExecuted = false;

      queue.enqueue(() => {
        messageExecuted = true;
      });

      // enqueue should return before message executes
      assert.strictEqual(messageExecuted, false);
      assert.strictEqual(queue.size, 1);
    });

    it('should not block when enqueuing during message processing', async () => {
      const queue = new ControlMessageQueue();
      const order: number[] = [];

      queue.enqueue(() => {
        order.push(1);
        // Enqueue during processing
        queue.enqueue(() => {
          order.push(3);
        });
      });
      queue.enqueue(() => {
        order.push(2);
      });

      await queue.flush();

      // Message enqueued during processing should come after current queue
      assert.deepStrictEqual(order, [1, 2, 3]);
    });
  });

  describe('flush', () => {
    it('should wait for all messages to complete', async () => {
      const queue = new ControlMessageQueue();
      let completed = 0;

      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 20));
        completed++;
      });
      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        completed++;
      });
      queue.enqueue(() => {
        completed++;
      });

      await queue.flush();

      assert.strictEqual(completed, 3);
      assert.strictEqual(queue.size, 0);
    });

    it('should resolve immediately if queue is empty', async () => {
      const queue = new ControlMessageQueue();

      const start = Date.now();
      await queue.flush();
      const elapsed = Date.now() - start;

      // Should resolve almost immediately
      assert.ok(elapsed < 50, `flush took ${elapsed}ms, expected < 50ms`);
    });
  });

  describe('clear', () => {
    it('should remove all pending messages', async () => {
      const queue = new ControlMessageQueue();
      const executed: number[] = [];

      queue.enqueue(() => {
        executed.push(1);
      });
      queue.enqueue(() => {
        executed.push(2);
      });
      queue.enqueue(() => {
        executed.push(3);
      });

      // Clear before any messages are processed
      queue.clear();

      // Wait a bit to ensure nothing processes
      await new Promise((r) => setTimeout(r, 50));

      assert.strictEqual(queue.size, 0);
      // None should have executed after clear
      // Note: first message may have started processing before clear
    });

    it('should not affect currently processing message', async () => {
      const queue = new ControlMessageQueue();
      const executed: number[] = [];

      queue.enqueue(async () => {
        executed.push(1);
        await new Promise((r) => setTimeout(r, 20));
        executed.push(2);
      });
      queue.enqueue(() => {
        executed.push(3);
      });

      // Wait for first message to start
      await new Promise((r) => setImmediate(r));
      queue.clear();

      await new Promise((r) => setTimeout(r, 50));

      // First message should complete (was already processing)
      // Second message should NOT execute (was cleared)
      assert.ok(executed.includes(1));
      assert.ok(executed.includes(2));
      assert.ok(!executed.includes(3));
    });
  });

  describe('size', () => {
    it('should report correct queue size', () => {
      const queue = new ControlMessageQueue();

      assert.strictEqual(queue.size, 0);

      queue.enqueue(() => {});
      assert.strictEqual(queue.size, 1);

      queue.enqueue(() => {});
      assert.strictEqual(queue.size, 2);
    });

    it('should decrease size as messages are processed', async () => {
      const queue = new ControlMessageQueue();

      queue.enqueue(() => {});
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      assert.strictEqual(queue.size, 3);

      await queue.flush();

      assert.strictEqual(queue.size, 0);
    });
  });

  describe('error handling', () => {
    it('should call errorHandler when message throws Error', async () => {
      const queue = new ControlMessageQueue();
      let capturedError: Error | null = null;

      queue.setErrorHandler((error) => {
        capturedError = error as Error;
      });

      const testError = new Error('Test error');
      queue.enqueue(() => {
        throw testError;
      });

      await queue.flush();

      assert.ok(capturedError);
      assert.strictEqual(capturedError?.message, 'Test error');
    });

    it('should call errorHandler when message throws DOMException', async () => {
      const queue = new ControlMessageQueue();
      let capturedError: DOMException | null = null;

      queue.setErrorHandler((error) => {
        capturedError = error as DOMException;
      });

      const domError = new DOMException('Invalid state', 'InvalidStateError');
      queue.enqueue(() => {
        throw domError;
      });

      await queue.flush();

      assert.ok(capturedError);
      assert.ok(capturedError instanceof DOMException);
      assert.strictEqual(capturedError?.name, 'InvalidStateError');
      assert.strictEqual(capturedError?.message, 'Invalid state');
    });

    it('should call errorHandler when async message rejects', async () => {
      const queue = new ControlMessageQueue();
      let capturedError: Error | null = null;

      queue.setErrorHandler((error) => {
        capturedError = error as Error;
      });

      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 5));
        throw new Error('Async error');
      });

      await queue.flush();

      assert.ok(capturedError);
      assert.strictEqual(capturedError?.message, 'Async error');
    });

    it('should log to console when no errorHandler is set', async () => {
      const queue = new ControlMessageQueue();
      const originalError = console.error;
      let loggedMessage = '';

      console.error = (...args: unknown[]) => {
        loggedMessage = String(args[0]);
      };

      try {
        queue.enqueue(() => {
          throw new Error('Unhandled error');
        });

        await queue.flush();

        assert.ok(loggedMessage.includes('Unhandled control message error'));
      } finally {
        console.error = originalError;
      }
    });

    it('should continue processing after error', async () => {
      const queue = new ControlMessageQueue();
      const executed: number[] = [];

      queue.setErrorHandler(() => {}); // Suppress error logging

      queue.enqueue(() => {
        executed.push(1);
      });
      queue.enqueue(() => {
        throw new Error('Test error');
      });
      queue.enqueue(() => {
        executed.push(3);
      });

      await queue.flush();

      // Both non-error messages should execute
      assert.deepStrictEqual(executed, [1, 3]);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid enqueues', async () => {
      const queue = new ControlMessageQueue();
      const results: number[] = [];
      const count = 100;

      for (let i = 0; i < count; i++) {
        queue.enqueue(() => {
          results.push(i);
        });
      }

      await queue.flush();

      assert.strictEqual(results.length, count);
      // Verify FIFO order
      for (let i = 0; i < count; i++) {
        assert.strictEqual(results[i], i);
      }
    });

    it('should handle enqueue during message processing', async () => {
      const queue = new ControlMessageQueue();
      const order: string[] = [];

      queue.enqueue(() => {
        order.push('A-start');
        queue.enqueue(() => {
          order.push('C');
        });
        order.push('A-end');
      });
      queue.enqueue(() => {
        order.push('B');
      });

      await queue.flush();

      // A runs first, enqueues C, then B runs, then C runs
      assert.deepStrictEqual(order, ['A-start', 'A-end', 'B', 'C']);
    });

    it('should handle async message that throws after delay', async () => {
      const queue = new ControlMessageQueue();
      let errorCaught = false;

      queue.setErrorHandler(() => {
        errorCaught = true;
      });

      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw new Error('Delayed error');
      });

      await queue.flush();

      assert.strictEqual(errorCaught, true);
    });
  });
});
