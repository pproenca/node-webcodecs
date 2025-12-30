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
  val: unknown
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
