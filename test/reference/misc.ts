/*!
 * Copyright (c) 2025-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const toDataView = (source: AllowSharedBufferSource): DataView => {
  if (source.constructor === DataView) {
    return source;
  } else if (ArrayBuffer.isView(source)) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength);
  } else {
    return new DataView(source);
  }
};

export const promiseWithResolvers = <T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} => {
  let resolve: (value: T) => void;
  let reject: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Promise executor runs synchronously, so resolve/reject are assigned
  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (reason: unknown) => reject(reason),
  };
};

export interface AsyncMutexLock extends Disposable {
  readonly pending: boolean;
  readonly ready: Promise<void> | null;
  release(): void;
}

export class AsyncMutex {
  private locked = false;
  private resolverQueue: (() => void)[] = [];

  lock() {
    if (!this.locked) {
      // Fast path
      this.locked = true;
      return this.createLock(false, null);
    }

    const { promise, resolve } = promiseWithResolvers();
    this.resolverQueue.push(resolve);

    return this.createLock(true, promise);
  }

  private createLock(pending: boolean, ready: Promise<void> | null): AsyncMutexLock {
    let released = false;

    return {
      pending,
      ready,
      release: () => {
        if (released) return;
        released = true;
        this.dispatch();
      },
      [Symbol.dispose]() {
        this.release();
      },
    };
  }

  private dispatch() {
    const resolve = this.resolverQueue.shift();
    if (resolve) {
      resolve();
    } else {
      this.locked = false;
    }
  }
}
