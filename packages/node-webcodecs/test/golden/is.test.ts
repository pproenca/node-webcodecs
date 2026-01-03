// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as is from '../../lib/is';

describe('lib/is - Type Guards', () => {
  describe('defined', () => {
    it('returns true for defined values', () => {
      assert.strictEqual(is.defined(0), true);
      assert.strictEqual(is.defined(''), true);
      assert.strictEqual(is.defined(false), true);
      assert.strictEqual(is.defined({}), true);
    });

    it('returns false for undefined and null', () => {
      assert.strictEqual(is.defined(undefined), false);
      assert.strictEqual(is.defined(null), false);
    });
  });

  describe('positiveInteger', () => {
    it('returns true for positive integers', () => {
      assert.strictEqual(is.positiveInteger(1), true);
      assert.strictEqual(is.positiveInteger(100), true);
    });

    it('returns false for zero, negative, floats, non-numbers', () => {
      assert.strictEqual(is.positiveInteger(0), false);
      assert.strictEqual(is.positiveInteger(-1), false);
      assert.strictEqual(is.positiveInteger(1.5), false);
      assert.strictEqual(is.positiveInteger('1'), false);
      assert.strictEqual(is.positiveInteger(NaN), false);
    });
  });

  describe('bufferLike', () => {
    it('returns true for Buffer, ArrayBuffer, TypedArray', () => {
      assert.strictEqual(is.bufferLike(Buffer.from([1, 2, 3])), true);
      assert.strictEqual(is.bufferLike(new ArrayBuffer(8)), true);
      assert.strictEqual(is.bufferLike(new Uint8Array(8)), true);
    });

    it('returns false for other types', () => {
      assert.strictEqual(is.bufferLike([1, 2, 3]), false);
      assert.strictEqual(is.bufferLike('string'), false);
      assert.strictEqual(is.bufferLike(null), false);
    });
  });
});

describe('lib/is - Error Factories', () => {
  describe('invalidParameterError', () => {
    it('formats error with expected/actual/type', () => {
      const err = is.invalidParameterError('width', 'positive integer', -5);
      assert.strictEqual(
        err.message,
        'Expected positive integer for width but received -5 of type number',
      );
    });

    it('quotes string values', () => {
      const err = is.invalidParameterError('codec', 'valid codec string', 'bad');
      assert.ok(err.message.includes("'bad'"));
      assert.ok(err.message.includes('of type string'));
    });

    it('handles null and undefined', () => {
      const errNull = is.invalidParameterError('config', 'object', null);
      assert.ok(errNull.message.includes('of type null'));

      const errUndef = is.invalidParameterError('config', 'object', undefined);
      assert.ok(errUndef.message.includes('of type undefined'));
    });
  });

  describe('missingParameterError', () => {
    it('creates error with parameter name', () => {
      const err = is.missingParameterError('codec');
      assert.strictEqual(err.message, 'Missing required parameter: codec');
    });
  });

  describe('rangeError', () => {
    it('includes min, max, and actual value', () => {
      const err = is.rangeError('quality', 1, 100, 150);
      assert.strictEqual(err.message, 'Expected quality between 1 and 100 but received 150');
    });
  });

  describe('enumError', () => {
    it('lists allowed values', () => {
      const err = is.enumError('latencyMode', ['quality', 'realtime'], 'fast');
      assert.strictEqual(
        err.message,
        "Expected one of [quality, realtime] for latencyMode but received 'fast'",
      );
    });
  });
});

describe('lib/is - Assertion Helpers', () => {
  describe('assertDefined', () => {
    it('passes for defined values', () => {
      assert.doesNotThrow(() => { is.assertDefined(0, 'value'); });
      assert.doesNotThrow(() => { is.assertDefined('', 'value'); });
    });

    it('throws for undefined/null', () => {
      assert.throws(
        () => { is.assertDefined(undefined, 'config'); },
        /Missing required parameter: config/,
      );
      assert.throws(
        () => { is.assertDefined(null, 'config'); },
        /Missing required parameter: config/,
      );
    });
  });

  describe('assertPositiveInteger', () => {
    it('passes for positive integers', () => {
      assert.doesNotThrow(() => { is.assertPositiveInteger(1, 'width'); });
      assert.doesNotThrow(() => { is.assertPositiveInteger(1920, 'width'); });
    });

    it('throws for invalid values', () => {
      assert.throws(
        () => { is.assertPositiveInteger(0, 'width'); },
        /Expected positive integer for width/,
      );
      assert.throws(
        () => { is.assertPositiveInteger(-1, 'width'); },
        /Expected positive integer for width/,
      );
      assert.throws(
        () => { is.assertPositiveInteger(1.5, 'width'); },
        /Expected positive integer for width/,
      );
      assert.throws(
        () => { is.assertPositiveInteger('100', 'width'); },
        /Expected positive integer for width/,
      );
    });
  });

  describe('assertPlainObject', () => {
    it('passes for plain objects', () => {
      assert.doesNotThrow(() => { is.assertPlainObject({}, 'config'); });
      assert.doesNotThrow(() => { is.assertPlainObject({ a: 1 }, 'config'); });
    });

    it('throws for non-plain objects', () => {
      assert.throws(() => { is.assertPlainObject([], 'config'); });
      assert.throws(() => { is.assertPlainObject(null, 'config'); });
      assert.throws(() => { is.assertPlainObject('string', 'config'); });
    });
  });

  describe('assertOneOf', () => {
    it('passes for valid enum values', () => {
      assert.doesNotThrow(() => { is.assertOneOf('quality', 'mode', ['quality', 'realtime']); });
    });

    it('throws for invalid enum values', () => {
      assert.throws(
        () => { is.assertOneOf('fast', 'mode', ['quality', 'realtime']); },
        /Expected one of \[quality, realtime\] for mode/,
      );
    });
  });

  describe('assertBufferLike', () => {
    it('passes for buffer-like values', () => {
      assert.doesNotThrow(() => { is.assertBufferLike(Buffer.from([1]), 'data'); });
      assert.doesNotThrow(() => { is.assertBufferLike(new Uint8Array(8), 'data'); });
    });

    it('throws for non-buffer values', () => {
      assert.throws(
        () => { is.assertBufferLike([1, 2, 3], 'data'); },
        /Expected Buffer, ArrayBuffer, or TypedArray for data/,
      );
    });
  });
});

describe('lib/is - Domain Guards', () => {
  describe('pixelFormat', () => {
    it('returns true for valid pixel formats', () => {
      assert.strictEqual(is.pixelFormat('I420'), true);
      assert.strictEqual(is.pixelFormat('NV12'), true);
      assert.strictEqual(is.pixelFormat('RGBA'), true);
      assert.strictEqual(is.pixelFormat('BGRA'), true);
    });

    it('returns false for invalid pixel formats', () => {
      assert.strictEqual(is.pixelFormat('INVALID'), false);
      assert.strictEqual(is.pixelFormat(''), false);
      assert.strictEqual(is.pixelFormat(123), false);
    });
  });

  describe('sampleFormat', () => {
    it('returns true for valid sample formats', () => {
      assert.strictEqual(is.sampleFormat('u8'), true);
      assert.strictEqual(is.sampleFormat('s16'), true);
      assert.strictEqual(is.sampleFormat('f32-planar'), true);
    });

    it('returns false for invalid sample formats', () => {
      assert.strictEqual(is.sampleFormat('invalid'), false);
      assert.strictEqual(is.sampleFormat(''), false);
    });
  });

  describe('codecState', () => {
    it('returns true for valid codec states', () => {
      assert.strictEqual(is.codecState('unconfigured'), true);
      assert.strictEqual(is.codecState('configured'), true);
      assert.strictEqual(is.codecState('closed'), true);
    });

    it('returns false for invalid states', () => {
      assert.strictEqual(is.codecState('open'), false);
      assert.strictEqual(is.codecState(''), false);
    });
  });

  describe('isImageData', () => {
    it('should detect ImageData-like objects', () => {
      const mockImageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      };
      assert.strictEqual(is.isImageData(mockImageData), true);
    });

    it('should reject non-ImageData objects', () => {
      assert.strictEqual(is.isImageData({}), false);
      assert.strictEqual(is.isImageData({ width: 100, height: 100 }), false);
      assert.strictEqual(is.isImageData({ data: new Uint8Array(100) }), false);
      assert.strictEqual(is.isImageData(null), false);
      assert.strictEqual(is.isImageData(Buffer.alloc(100)), false);
    });

    it('should require Uint8ClampedArray for data', () => {
      const wrongType = {
        width: 10,
        height: 10,
        data: new Uint8Array(400), // Wrong type - should be Uint8ClampedArray
      };
      assert.strictEqual(is.isImageData(wrongType), false);
    });
  });
});
