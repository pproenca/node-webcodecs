/**
 * node-webcodecs - WebCodecs API implementation for Node.js
 *
 * Copyright 2024 The node-webcodecs Authors
 * SPDX-License-Identifier: MIT
 */

/**
 * Abstract base class for all WebCodecs codec classes.
 * Provides EventTarget inheritance and common dequeue event handling.
 * Per W3C WebCodecs spec, all codecs extend EventTarget.
 */
export abstract class CodecBase extends EventTarget {
  protected _ondequeue: (() => void) | null = null;

  get ondequeue(): (() => void) | null {
    return this._ondequeue;
  }

  set ondequeue(handler: (() => void) | null) {
    this._ondequeue = handler;
  }

  /**
   * Triggers the 'dequeue' event per W3C spec.
   * Dispatches both the standard Event and calls the legacy callback.
   */
  protected _triggerDequeue(): void {
    // Dispatch standard EventTarget event
    this.dispatchEvent(new Event('dequeue'));

    // Also call legacy ondequeue callback for backwards compatibility
    if (this._ondequeue) {
      queueMicrotask(() => {
        if (this._ondequeue) {
          this._ondequeue();
        }
      });
    }
  }
}
