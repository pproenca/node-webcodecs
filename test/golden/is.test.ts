// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
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
        'Expected positive integer for width but received -5 of type number',
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
      expect(err.message).toBe('Expected quality between 1 and 100 but received 150');
    });
  });

  describe('enumError', () => {
    it('lists allowed values', () => {
      const err = is.enumError('latencyMode', ['quality', 'realtime'], 'fast');
      expect(err.message).toBe(
        "Expected one of [quality, realtime] for latencyMode but received 'fast'",
      );
    });
  });
});

describe('lib/is - Assertion Helpers', () => {
  describe('assertDefined', () => {
    it('passes for defined values', () => {
      expect(() => is.assertDefined(0, 'value')).not.toThrow();
      expect(() => is.assertDefined('', 'value')).not.toThrow();
    });

    it('throws for undefined/null', () => {
      expect(() => is.assertDefined(undefined, 'config')).toThrow(
        'Missing required parameter: config',
      );
      expect(() => is.assertDefined(null, 'config')).toThrow('Missing required parameter: config');
    });
  });

  describe('assertPositiveInteger', () => {
    it('passes for positive integers', () => {
      expect(() => is.assertPositiveInteger(1, 'width')).not.toThrow();
      expect(() => is.assertPositiveInteger(1920, 'width')).not.toThrow();
    });

    it('throws for invalid values', () => {
      expect(() => is.assertPositiveInteger(0, 'width')).toThrow(
        /Expected positive integer for width/,
      );
      expect(() => is.assertPositiveInteger(-1, 'width')).toThrow(
        /Expected positive integer for width/,
      );
      expect(() => is.assertPositiveInteger(1.5, 'width')).toThrow(
        /Expected positive integer for width/,
      );
      expect(() => is.assertPositiveInteger('100', 'width')).toThrow(
        /Expected positive integer for width/,
      );
    });
  });

  describe('assertPlainObject', () => {
    it('passes for plain objects', () => {
      expect(() => is.assertPlainObject({}, 'config')).not.toThrow();
      expect(() => is.assertPlainObject({ a: 1 }, 'config')).not.toThrow();
    });

    it('throws for non-plain objects', () => {
      expect(() => is.assertPlainObject([], 'config')).toThrow();
      expect(() => is.assertPlainObject(null, 'config')).toThrow();
      expect(() => is.assertPlainObject('string', 'config')).toThrow();
    });
  });

  describe('assertOneOf', () => {
    it('passes for valid enum values', () => {
      expect(() => is.assertOneOf('quality', 'mode', ['quality', 'realtime'])).not.toThrow();
    });

    it('throws for invalid enum values', () => {
      expect(() => is.assertOneOf('fast', 'mode', ['quality', 'realtime'])).toThrow(
        /Expected one of \[quality, realtime\] for mode/,
      );
    });
  });

  describe('assertBufferLike', () => {
    it('passes for buffer-like values', () => {
      expect(() => is.assertBufferLike(Buffer.from([1]), 'data')).not.toThrow();
      expect(() => is.assertBufferLike(new Uint8Array(8), 'data')).not.toThrow();
    });

    it('throws for non-buffer values', () => {
      expect(() => is.assertBufferLike([1, 2, 3], 'data')).toThrow(
        /Expected Buffer, ArrayBuffer, or TypedArray for data/,
      );
    });
  });
});

describe('lib/is - Domain Guards', () => {
  describe('pixelFormat', () => {
    it('returns true for valid pixel formats', () => {
      expect(is.pixelFormat('I420')).toBe(true);
      expect(is.pixelFormat('NV12')).toBe(true);
      expect(is.pixelFormat('RGBA')).toBe(true);
      expect(is.pixelFormat('BGRA')).toBe(true);
    });

    it('returns false for invalid pixel formats', () => {
      expect(is.pixelFormat('INVALID')).toBe(false);
      expect(is.pixelFormat('')).toBe(false);
      expect(is.pixelFormat(123)).toBe(false);
    });
  });

  describe('sampleFormat', () => {
    it('returns true for valid sample formats', () => {
      expect(is.sampleFormat('u8')).toBe(true);
      expect(is.sampleFormat('s16')).toBe(true);
      expect(is.sampleFormat('f32-planar')).toBe(true);
    });

    it('returns false for invalid sample formats', () => {
      expect(is.sampleFormat('invalid')).toBe(false);
      expect(is.sampleFormat('')).toBe(false);
    });
  });

  describe('codecState', () => {
    it('returns true for valid codec states', () => {
      expect(is.codecState('unconfigured')).toBe(true);
      expect(is.codecState('configured')).toBe(true);
      expect(is.codecState('closed')).toBe(true);
    });

    it('returns false for invalid states', () => {
      expect(is.codecState('open')).toBe(false);
      expect(is.codecState('')).toBe(false);
    });
  });
});
