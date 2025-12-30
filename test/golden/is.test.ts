// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import {describe, it, expect} from 'vitest';
import * as is from '../../lib/is';

describe('lib/is - Type Guards', () => {
  describe('defined', () => {
    it('returns true for defined values', () => {
      expect(is.defined(0)).toBe(true);
      expect(is.defined('')).toBe(true);
      expect(is.defined(false)).toBe(true);
      expect(is.defined({})).toBe(true);
    });

    it('returns false for undefined and null', () => {
      expect(is.defined(undefined)).toBe(false);
      expect(is.defined(null)).toBe(false);
    });
  });

  describe('positiveInteger', () => {
    it('returns true for positive integers', () => {
      expect(is.positiveInteger(1)).toBe(true);
      expect(is.positiveInteger(100)).toBe(true);
    });

    it('returns false for zero, negative, floats, non-numbers', () => {
      expect(is.positiveInteger(0)).toBe(false);
      expect(is.positiveInteger(-1)).toBe(false);
      expect(is.positiveInteger(1.5)).toBe(false);
      expect(is.positiveInteger('1')).toBe(false);
      expect(is.positiveInteger(NaN)).toBe(false);
    });
  });

  describe('bufferLike', () => {
    it('returns true for Buffer, ArrayBuffer, TypedArray', () => {
      expect(is.bufferLike(Buffer.from([1, 2, 3]))).toBe(true);
      expect(is.bufferLike(new ArrayBuffer(8))).toBe(true);
      expect(is.bufferLike(new Uint8Array(8))).toBe(true);
    });

    it('returns false for other types', () => {
      expect(is.bufferLike([1, 2, 3])).toBe(false);
      expect(is.bufferLike('string')).toBe(false);
      expect(is.bufferLike(null)).toBe(false);
    });
  });
});

describe('lib/is - Error Factories', () => {
  describe('invalidParameterError', () => {
    it('formats error with expected/actual/type', () => {
      const err = is.invalidParameterError('width', 'positive integer', -5);
      expect(err.message).toBe(
        'Expected positive integer for width but received -5 of type number'
      );
    });

    it('quotes string values', () => {
      const err = is.invalidParameterError('codec', 'valid codec string', 'bad');
      expect(err.message).toContain("'bad'");
      expect(err.message).toContain('of type string');
    });

    it('handles null and undefined', () => {
      const errNull = is.invalidParameterError('config', 'object', null);
      expect(errNull.message).toContain('of type null');

      const errUndef = is.invalidParameterError('config', 'object', undefined);
      expect(errUndef.message).toContain('of type undefined');
    });
  });

  describe('missingParameterError', () => {
    it('creates error with parameter name', () => {
      const err = is.missingParameterError('codec');
      expect(err.message).toBe('Missing required parameter: codec');
    });
  });

  describe('rangeError', () => {
    it('includes min, max, and actual value', () => {
      const err = is.rangeError('quality', 1, 100, 150);
      expect(err.message).toBe(
        'Expected quality between 1 and 100 but received 150'
      );
    });
  });

  describe('enumError', () => {
    it('lists allowed values', () => {
      const err = is.enumError('latencyMode', ['quality', 'realtime'], 'fast');
      expect(err.message).toBe(
        "Expected one of [quality, realtime] for latencyMode but received 'fast'"
      );
    });
  });
});
