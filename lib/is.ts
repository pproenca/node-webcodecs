// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Type guards and validation helpers following sharp's lib/is.js pattern.

/**
 * Is this value defined and not null?
 */
export function defined<T>(val: T | undefined | null): val is T {
  return typeof val !== 'undefined' && val !== null;
}

/**
 * Is this value an object (but not null)?
 */
export function object(val: unknown): val is object {
  return typeof val === 'object' && val !== null;
}

/**
 * Is this value a plain object (not array, not class instance)?
 */
export function plainObject(val: unknown): val is Record<string, unknown> {
  return Object.prototype.toString.call(val) === '[object Object]';
}

/**
 * Is this value a function?
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function fn(val: unknown): val is Function {
  return typeof val === 'function';
}

/**
 * Is this value a boolean?
 */
export function bool(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

/**
 * Is this value a Buffer?
 */
export function buffer(val: unknown): val is Buffer {
  return Buffer.isBuffer(val);
}

/**
 * Is this value a TypedArray?
 */
export function typedArray(val: unknown): val is ArrayBufferView {
  if (!defined(val)) return false;
  const ctor = (val as object).constructor;
  return (
    ctor === Uint8Array ||
    ctor === Uint8ClampedArray ||
    ctor === Int8Array ||
    ctor === Uint16Array ||
    ctor === Int16Array ||
    ctor === Uint32Array ||
    ctor === Int32Array ||
    ctor === Float32Array ||
    ctor === Float64Array
  );
}

/**
 * Is this value an ArrayBuffer?
 */
export function arrayBuffer(val: unknown): val is ArrayBuffer {
  return val instanceof ArrayBuffer;
}

/**
 * Is this value buffer-like (Buffer, ArrayBuffer, TypedArray)?
 */
export function bufferLike(
  val: unknown,
): val is Buffer | ArrayBuffer | ArrayBufferView {
  return buffer(val) || arrayBuffer(val) || typedArray(val);
}

/**
 * Is this value a non-empty string?
 */
export function string(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

/**
 * Is this value a string (including empty)?
 */
export function anyString(val: unknown): val is string {
  return typeof val === 'string';
}

/**
 * Is this value a real number (not NaN, not Infinity)?
 */
export function number(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Is this value an integer?
 */
export function integer(val: unknown): val is number {
  return Number.isInteger(val);
}

/**
 * Is this value a positive integer (> 0)?
 */
export function positiveInteger(val: unknown): val is number {
  return integer(val) && (val as number) > 0;
}

/**
 * Is this value a non-negative integer (>= 0)?
 */
export function nonNegativeInteger(val: unknown): val is number {
  return integer(val) && (val as number) >= 0;
}

/**
 * Is this value within an inclusive range?
 */
export function inRange(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}

/**
 * Is this value one of the allowed values?
 */
export function inArray<T>(val: T, list: readonly T[]): boolean {
  return list.includes(val);
}

//==============================================================================
// Error Factories (following sharp pattern)
//==============================================================================

/**
 * Create an Error with a message relating to an invalid parameter.
 * Follows sharp's invalidParameterError pattern.
 *
 * @param name - Parameter name
 * @param expected - Description of expected type/value/range
 * @param actual - The value received
 * @returns Error with formatted message
 *
 * @example
 * throw invalidParameterError('width', 'positive integer', -5);
 * // Error: Expected positive integer for width but received -5 of type number
 */
export function invalidParameterError(
  name: string,
  expected: string,
  actual: unknown,
): TypeError {
  let actualType: string;
  if (actual === null) {
    actualType = 'null';
  } else if (actual === undefined) {
    actualType = 'undefined';
  } else {
    actualType = typeof actual;
  }

  const actualStr =
    typeof actual === 'string'
      ? `'${actual}'`
      : typeof actual === 'number' || typeof actual === 'boolean'
        ? String(actual)
        : actualType;

  return new TypeError(
    `Expected ${expected} for ${name} but received ${actualStr} of type ${actualType}`,
  );
}

/**
 * Create a TypeError for a missing required parameter.
 */
export function missingParameterError(name: string): TypeError {
  return new TypeError(`Missing required parameter: ${name}`);
}

/**
 * Create an Error for an out-of-range value.
 */
export function rangeError(
  name: string,
  min: number,
  max: number,
  actual: number,
): Error {
  return new Error(
    `Expected ${name} between ${min} and ${max} but received ${actual}`,
  );
}

/**
 * Create an Error for an invalid enum value.
 */
export function enumError(
  name: string,
  allowed: readonly string[],
  actual: unknown,
): Error {
  return new Error(
    `Expected one of [${allowed.join(', ')}] for ${name} but received '${actual}'`,
  );
}

/**
 * Ensures an Error from C++ native code contains a JS stack trace.
 * Following sharp's nativeError pattern.
 */
export function nativeError(native: Error, context: Error): Error {
  context.message = native.message;
  if ('code' in native) {
    (context as Error & {code: unknown}).code = native.code;
  }
  return context;
}

//==============================================================================
// Assertion Helpers
//==============================================================================

/**
 * Assert value is defined, throw if not.
 */
export function assertDefined<T>(
  val: T | undefined | null,
  name: string,
): asserts val is T {
  if (!defined(val)) {
    throw missingParameterError(name);
  }
}

/**
 * Assert value is a positive integer, throw if not.
 */
export function assertPositiveInteger(
  val: unknown,
  name: string,
): asserts val is number {
  if (!positiveInteger(val)) {
    throw invalidParameterError(name, 'positive integer', val);
  }
}

/**
 * Assert value is a non-negative integer, throw if not.
 */
export function assertNonNegativeInteger(
  val: unknown,
  name: string,
): asserts val is number {
  if (!nonNegativeInteger(val)) {
    throw invalidParameterError(name, 'non-negative integer', val);
  }
}

/**
 * Assert value is in range, throw if not.
 */
export function assertInRange(
  val: number,
  name: string,
  min: number,
  max: number,
): void {
  if (!inRange(val, min, max)) {
    throw rangeError(name, min, max, val);
  }
}

/**
 * Assert value is a function, throw if not.
 */
export function assertFunction(
  val: unknown,
  name: string,
): asserts val is (...args: unknown[]) => unknown {
  if (!fn(val)) {
    throw invalidParameterError(name, 'function', val);
  }
}

/**
 * Assert value is a plain object, throw if not.
 */
export function assertPlainObject(
  val: unknown,
  name: string,
): asserts val is Record<string, unknown> {
  if (!plainObject(val)) {
    throw invalidParameterError(name, 'plain object', val);
  }
}

/**
 * Assert value is one of allowed values, throw if not.
 */
export function assertOneOf<T extends string>(
  val: unknown,
  name: string,
  allowed: readonly T[],
): asserts val is T {
  if (!string(val) || !inArray(val as T, allowed)) {
    throw enumError(name, allowed, val);
  }
}

/**
 * Assert value is buffer-like, throw if not.
 */
export function assertBufferLike(
  val: unknown,
  name: string,
): asserts val is Buffer | ArrayBuffer | ArrayBufferView {
  if (!bufferLike(val)) {
    throw invalidParameterError(
      name,
      'Buffer, ArrayBuffer, or TypedArray',
      val,
    );
  }
}
