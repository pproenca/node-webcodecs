/**
 * Control Message Queue per W3C WebCodecs spec.
 *
 * Each codec instance maintains an internal [[control message queue]].
 * Methods like configure(), encode(), decode() enqueue control messages
 * rather than executing immediately, ensuring non-blocking behavior.
 */

type ControlMessage = () => void | Promise<void>;

export class ControlMessageQueue {
  private queue: ControlMessage[] = [];
  private processing: boolean = false;
  private errorHandler: ((error: Error | DOMException) => void) | null = null;

  /**
   * Enqueue a control message for async processing.
   * Messages are processed in FIFO order.
   */
  enqueue(message: ControlMessage): void {
    this.queue.push(message);
    this.scheduleProcessing();
  }

  /**
   * Set error handler for message processing failures.
   */
  setErrorHandler(handler: (error: Error | DOMException) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Wait for all queued messages to be processed.
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  /**
   * Clear all pending messages (used by reset/close).
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get current queue size.
   */
  get size(): number {
    return this.queue.length;
  }

  private scheduleProcessing(): void {
    if (this.processing) return;

    queueMicrotask(() => this.processNext());
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    // biome-ignore lint/style/noNonNullAssertion: guaranteed non-empty after length check above
    const message = this.queue.shift()!;

    try {
      await message();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error as Error);
      } else {
        console.error('Unhandled control message error:', error);
      }
    }

    this.processing = false;

    // Continue processing if more messages
    if (this.queue.length > 0) {
      this.scheduleProcessing();
    }
  }
}
