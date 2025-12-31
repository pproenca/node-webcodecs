# Sharp Patterns Migration Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2024-12-30-sharp-patterns-implementation.md` to implement task-by-task.

**Goal:** Migrate node-webcodecs to sharp's production patterns: node-gyp build system, C++ `webcodecs::` namespace with helpers, JS validation layer (`lib/is.ts`), and enhanced error messages.

**Architecture:** Phased migration preserving backwards compatibility. Phase 1 adds new infrastructure without breaking existing code. Subsequent phases integrate helpers incrementally. Final phase switches build system and removes cmake-js.

**Tech Stack:** node-gyp, node-addon-api v8, TypeScript, Vitest, FFmpeg (via pkg-config)

---

## Phase 1: Add New Infrastructure (Non-Breaking)

### Task 1: Create lib/is.ts - Type Guards Module

**Files:**
- Create: `lib/is.ts`
- Test: `test/golden/is.test.ts`

**Step 1: Create test file for type guards** (3 min)

Create `test/golden/is.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: FAIL with `Cannot find module '../../lib/is'`

**Step 3: Create lib/is.ts with type guards** (5 min)

Create `lib/is.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add type guards module following sharp pattern"
```

---

### Task 2: Add Error Factory Functions to lib/is.ts

**Files:**
- Modify: `lib/is.ts`
- Test: `test/golden/is.test.ts`

**Step 1: Add error factory tests** (3 min)

Append to `test/golden/is.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: FAIL with `is.invalidParameterError is not a function`

**Step 3: Add error factory implementations** (4 min)

Append to `lib/is.ts`:

```typescript
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
  actual: unknown
): Error {
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

  return new Error(
    `Expected ${expected} for ${name} but received ${actualStr} of type ${actualType}`
  );
}

/**
 * Create an Error for a missing required parameter.
 */
export function missingParameterError(name: string): Error {
  return new Error(`Missing required parameter: ${name}`);
}

/**
 * Create an Error for an out-of-range value.
 */
export function rangeError(
  name: string,
  min: number,
  max: number,
  actual: number
): Error {
  return new Error(
    `Expected ${name} between ${min} and ${max} but received ${actual}`
  );
}

/**
 * Create an Error for an invalid enum value.
 */
export function enumError(
  name: string,
  allowed: readonly string[],
  actual: unknown
): Error {
  return new Error(
    `Expected one of [${allowed.join(', ')}] for ${name} but received '${actual}'`
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
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: PASS (all tests pass)

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add error factory functions following sharp pattern"
```

---

### Task 3: Add Assertion Helpers to lib/is.ts

**Files:**
- Modify: `lib/is.ts`
- Test: `test/golden/is.test.ts`

**Step 1: Add assertion helper tests** (3 min)

Append to `test/golden/is.test.ts`:

```typescript
describe('lib/is - Assertion Helpers', () => {
  describe('assertDefined', () => {
    it('passes for defined values', () => {
      expect(() => is.assertDefined(0, 'value')).not.toThrow();
      expect(() => is.assertDefined('', 'value')).not.toThrow();
    });

    it('throws for undefined/null', () => {
      expect(() => is.assertDefined(undefined, 'config')).toThrow(
        'Missing required parameter: config'
      );
      expect(() => is.assertDefined(null, 'config')).toThrow(
        'Missing required parameter: config'
      );
    });
  });

  describe('assertPositiveInteger', () => {
    it('passes for positive integers', () => {
      expect(() => is.assertPositiveInteger(1, 'width')).not.toThrow();
      expect(() => is.assertPositiveInteger(1920, 'width')).not.toThrow();
    });

    it('throws for invalid values', () => {
      expect(() => is.assertPositiveInteger(0, 'width')).toThrow(
        /Expected positive integer for width/
      );
      expect(() => is.assertPositiveInteger(-1, 'width')).toThrow(
        /Expected positive integer for width/
      );
      expect(() => is.assertPositiveInteger(1.5, 'width')).toThrow(
        /Expected positive integer for width/
      );
      expect(() => is.assertPositiveInteger('100', 'width')).toThrow(
        /Expected positive integer for width/
      );
    });
  });

  describe('assertPlainObject', () => {
    it('passes for plain objects', () => {
      expect(() => is.assertPlainObject({}, 'config')).not.toThrow();
      expect(() => is.assertPlainObject({a: 1}, 'config')).not.toThrow();
    });

    it('throws for non-plain objects', () => {
      expect(() => is.assertPlainObject([], 'config')).toThrow();
      expect(() => is.assertPlainObject(null, 'config')).toThrow();
      expect(() => is.assertPlainObject('string', 'config')).toThrow();
    });
  });

  describe('assertOneOf', () => {
    it('passes for valid enum values', () => {
      expect(() =>
        is.assertOneOf('quality', 'mode', ['quality', 'realtime'])
      ).not.toThrow();
    });

    it('throws for invalid enum values', () => {
      expect(() =>
        is.assertOneOf('fast', 'mode', ['quality', 'realtime'])
      ).toThrow(/Expected one of \[quality, realtime\] for mode/);
    });
  });

  describe('assertBufferLike', () => {
    it('passes for buffer-like values', () => {
      expect(() =>
        is.assertBufferLike(Buffer.from([1]), 'data')
      ).not.toThrow();
      expect(() =>
        is.assertBufferLike(new Uint8Array(8), 'data')
      ).not.toThrow();
    });

    it('throws for non-buffer values', () => {
      expect(() => is.assertBufferLike([1, 2, 3], 'data')).toThrow(
        /Expected Buffer, ArrayBuffer, or TypedArray for data/
      );
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: FAIL with `is.assertDefined is not a function`

**Step 3: Add assertion helper implementations** (4 min)

Append to `lib/is.ts`:

```typescript
//==============================================================================
// Assertion Helpers
//==============================================================================

/**
 * Assert value is defined, throw if not.
 */
export function assertDefined<T>(
  val: T | undefined | null,
  name: string
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
  name: string
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
  name: string
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
  max: number
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
  name: string
): asserts val is Function {
  if (!fn(val)) {
    throw invalidParameterError(name, 'function', val);
  }
}

/**
 * Assert value is a plain object, throw if not.
 */
export function assertPlainObject(
  val: unknown,
  name: string
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
  allowed: readonly T[]
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
  name: string
): asserts val is Buffer | ArrayBuffer | ArrayBufferView {
  if (!bufferLike(val)) {
    throw invalidParameterError(name, 'Buffer, ArrayBuffer, or TypedArray', val);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/is.test.ts
```

Expected: PASS (all tests pass)

**Step 5: Commit** (30 sec)

```bash
git add lib/is.ts test/golden/is.test.ts
git commit -m "feat(is): add assertion helpers for parameter validation"
```

---

### Task 4: Create src/common.h - C++ Namespace Declarations

**Files:**
- Create: `src/common.h`

**Step 1: Create src/common.h** (5 min)

Create `src/common.h`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

#include <atomic>
#include <mutex>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libavutil/error.h>
#include <libavutil/pixdesc.h>
}

// Verify FFmpeg version compatibility
#if LIBAVCODEC_VERSION_MAJOR < 59
#error "FFmpeg 5.0+ (libavcodec 59+) is required"
#endif

namespace webcodecs {

//==============================================================================
// Napi::Object Attribute Helpers
//==============================================================================

// Check if object has a defined (non-undefined) attribute
bool HasAttr(Napi::Object obj, const std::string& attr);

// Extract string attribute (returns empty string if missing/wrong type)
std::string AttrAsStr(Napi::Object obj, const std::string& attr);

// Extract string with default value
std::string AttrAsStr(Napi::Object obj, const std::string& attr,
                      const std::string& default_val);

// Extract uint32 attribute (returns 0 if missing/wrong type)
uint32_t AttrAsUint32(Napi::Object obj, const std::string& attr);

// Extract int32 attribute (returns 0 if missing/wrong type)
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr);

// Extract int32 with default value
int32_t AttrAsInt32(Napi::Object obj, const std::string& attr,
                    int32_t default_val);

// Extract int64 attribute (returns 0 if missing/wrong type)
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr);

// Extract int64 with default value
int64_t AttrAsInt64(Napi::Object obj, const std::string& attr,
                    int64_t default_val);

// Extract double attribute (returns 0.0 if missing/wrong type)
double AttrAsDouble(Napi::Object obj, const std::string& attr);

// Extract double with default value
double AttrAsDouble(Napi::Object obj, const std::string& attr,
                    double default_val);

// Extract boolean attribute (returns false if missing/wrong type)
bool AttrAsBool(Napi::Object obj, const std::string& attr);

// Extract boolean with default value
bool AttrAsBool(Napi::Object obj, const std::string& attr, bool default_val);

// Extract Buffer/ArrayBuffer/TypedArray as pointer and length
// Returns {nullptr, 0} if not buffer-like
std::tuple<const uint8_t*, size_t> AttrAsBuffer(Napi::Object obj,
                                                const std::string& attr);

//==============================================================================
// Validation Helpers (throw on failure)
//==============================================================================

// Throw if attribute is missing or undefined
void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr);

// Throw if value is not positive (> 0)
void RequirePositiveInt(Napi::Env env, const std::string& name, int32_t value);

// Throw if value is negative (< 0)
void RequireNonNegativeInt(Napi::Env env, const std::string& name,
                           int32_t value);

// Throw if value is outside [min, max] range
void RequireInRange(Napi::Env env, const std::string& name, int32_t value,
                    int32_t min, int32_t max);

// Throw if value is not one of allowed strings
void RequireOneOf(Napi::Env env, const std::string& name,
                  const std::string& value,
                  const std::vector<std::string>& allowed);

//==============================================================================
// Error Helpers
//==============================================================================

// Create error following sharp pattern: "Expected X for Y but received Z"
Napi::Error InvalidParameterError(Napi::Env env, const std::string& name,
                                  const std::string& expected,
                                  const Napi::Value& actual);

// Create error from FFmpeg error code with human-readable message
Napi::Error FFmpegError(Napi::Env env, const std::string& operation,
                        int errnum);

// Get FFmpeg error string from error code
std::string FFmpegErrorString(int errnum);

//==============================================================================
// Pixel Format Utilities
//==============================================================================

// WebCodecs format string to FFmpeg pixel format
AVPixelFormat PixelFormatFromString(const std::string& format);

// FFmpeg pixel format to WebCodecs format string
std::string PixelFormatToString(AVPixelFormat format);

//==============================================================================
// Global Counters (for monitoring, following sharp pattern)
//==============================================================================

extern std::atomic<int> counterQueue;
extern std::atomic<int> counterProcess;
extern std::atomic<int> counterFrames;

//==============================================================================
// FFmpeg Initialization
//==============================================================================

// Thread-safe FFmpeg initialization (call once at module load)
void InitFFmpeg();

}  // namespace webcodecs

#endif  // SRC_COMMON_H_
```

**Step 2: Verify header compiles** (30 sec)

```bash
# Just check syntax - actual build test comes with common.cc
head -5 src/common.h
```

**Step 3: Commit** (30 sec)

```bash
git add src/common.h
git commit -m "feat(common): add C++ namespace declarations for webcodecs helpers"
```

---

### Task 5: Create src/common.cc - C++ Helper Implementations

**Files:**
- Create: `src/common.cc`
- Modify: `CMakeLists.txt` (add to sources)

**Step 1: Create src/common.cc** (8 min)

Create `src/common.cc`:

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/common.h"

#include <cstring>

namespace webcodecs {

// Global counters
std::atomic<int> counterQueue{0};
std::atomic<int> counterProcess{0};
std::atomic<int> counterFrames{0};

//==============================================================================
// Attribute Helpers
//==============================================================================

bool HasAttr(Napi::Object obj, const std::string& attr) {
  return obj.Has(attr) && !obj.Get(attr).IsUndefined();
}

std::string AttrAsStr(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return "";
  Napi::Value val = obj.Get(attr);
  if (!val.IsString()) return "";
  return val.As<Napi::String>().Utf8Value();
}

std::string AttrAsStr(Napi::Object obj, const std::string& attr,
                      const std::string& default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsString()) return default_val;
  return val.As<Napi::String>().Utf8Value();
}

uint32_t AttrAsUint32(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Uint32Value();
}

int32_t AttrAsInt32(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Int32Value();
}

int32_t AttrAsInt32(Napi::Object obj, const std::string& attr,
                    int32_t default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().Int32Value();
}

int64_t AttrAsInt64(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0;
  return val.As<Napi::Number>().Int64Value();
}

int64_t AttrAsInt64(Napi::Object obj, const std::string& attr,
                    int64_t default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().Int64Value();
}

double AttrAsDouble(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return 0.0;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return 0.0;
  return val.As<Napi::Number>().DoubleValue();
}

double AttrAsDouble(Napi::Object obj, const std::string& attr,
                    double default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsNumber()) return default_val;
  return val.As<Napi::Number>().DoubleValue();
}

bool AttrAsBool(Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) return false;
  Napi::Value val = obj.Get(attr);
  if (!val.IsBoolean()) return false;
  return val.As<Napi::Boolean>().Value();
}

bool AttrAsBool(Napi::Object obj, const std::string& attr, bool default_val) {
  if (!HasAttr(obj, attr)) return default_val;
  Napi::Value val = obj.Get(attr);
  if (!val.IsBoolean()) return default_val;
  return val.As<Napi::Boolean>().Value();
}

std::tuple<const uint8_t*, size_t> AttrAsBuffer(Napi::Object obj,
                                                const std::string& attr) {
  if (!HasAttr(obj, attr)) return {nullptr, 0};
  Napi::Value val = obj.Get(attr);

  if (val.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = val.As<Napi::Buffer<uint8_t>>();
    return {buf.Data(), buf.Length()};
  }
  if (val.IsArrayBuffer()) {
    Napi::ArrayBuffer ab = val.As<Napi::ArrayBuffer>();
    return {static_cast<const uint8_t*>(ab.Data()), ab.ByteLength()};
  }
  if (val.IsTypedArray()) {
    Napi::TypedArray ta = val.As<Napi::TypedArray>();
    return {static_cast<const uint8_t*>(ta.ArrayBuffer().Data()) +
                ta.ByteOffset(),
            ta.ByteLength()};
  }
  return {nullptr, 0};
}

//==============================================================================
// Validation Helpers
//==============================================================================

void RequireAttr(Napi::Env env, Napi::Object obj, const std::string& attr) {
  if (!HasAttr(obj, attr)) {
    throw Napi::Error::New(env, "Missing required parameter: " + attr);
  }
}

void RequirePositiveInt(Napi::Env env, const std::string& name,
                        int32_t value) {
  if (value <= 0) {
    throw Napi::Error::New(
        env, "Expected positive integer for " + name + " but received " +
                 std::to_string(value));
  }
}

void RequireNonNegativeInt(Napi::Env env, const std::string& name,
                           int32_t value) {
  if (value < 0) {
    throw Napi::Error::New(
        env, "Expected non-negative integer for " + name + " but received " +
                 std::to_string(value));
  }
}

void RequireInRange(Napi::Env env, const std::string& name, int32_t value,
                    int32_t min, int32_t max) {
  if (value < min || value > max) {
    throw Napi::Error::New(env, "Expected " + name + " between " +
                                    std::to_string(min) + " and " +
                                    std::to_string(max) + " but received " +
                                    std::to_string(value));
  }
}

void RequireOneOf(Napi::Env env, const std::string& name,
                  const std::string& value,
                  const std::vector<std::string>& allowed) {
  for (const auto& a : allowed) {
    if (value == a) return;
  }
  std::string allowed_str;
  for (size_t i = 0; i < allowed.size(); ++i) {
    if (i > 0) allowed_str += ", ";
    allowed_str += allowed[i];
  }
  throw Napi::Error::New(env, "Expected one of [" + allowed_str + "] for " +
                                  name + " but received '" + value + "'");
}

//==============================================================================
// Error Helpers
//==============================================================================

Napi::Error InvalidParameterError(Napi::Env env, const std::string& name,
                                  const std::string& expected,
                                  const Napi::Value& actual) {
  std::string type_name;
  if (actual.IsUndefined())
    type_name = "undefined";
  else if (actual.IsNull())
    type_name = "null";
  else if (actual.IsBoolean())
    type_name = "boolean";
  else if (actual.IsNumber())
    type_name = "number";
  else if (actual.IsString())
    type_name = "string";
  else if (actual.IsArray())
    type_name = "array";
  else if (actual.IsBuffer())
    type_name = "Buffer";
  else if (actual.IsFunction())
    type_name = "function";
  else
    type_name = "object";

  std::string actual_str;
  if (actual.IsString()) {
    actual_str = "'" + actual.As<Napi::String>().Utf8Value() + "'";
  } else if (actual.IsNumber()) {
    actual_str = std::to_string(actual.As<Napi::Number>().DoubleValue());
  } else {
    actual_str = type_name;
  }

  return Napi::Error::New(env, "Expected " + expected + " for " + name +
                                   " but received " + actual_str + " of type " +
                                   type_name);
}

std::string FFmpegErrorString(int errnum) {
  char errbuf[AV_ERROR_MAX_STRING_SIZE];
  av_strerror(errnum, errbuf, sizeof(errbuf));
  return std::string(errbuf);
}

Napi::Error FFmpegError(Napi::Env env, const std::string& operation,
                        int errnum) {
  return Napi::Error::New(env,
                          operation + " failed: " + FFmpegErrorString(errnum));
}

//==============================================================================
// Pixel Format Utilities
//==============================================================================

AVPixelFormat PixelFormatFromString(const std::string& format) {
  static const std::unordered_map<std::string, AVPixelFormat> formats = {
      {"I420", AV_PIX_FMT_YUV420P},
      {"I420A", AV_PIX_FMT_YUVA420P},
      {"I422", AV_PIX_FMT_YUV422P},
      {"I444", AV_PIX_FMT_YUV444P},
      {"NV12", AV_PIX_FMT_NV12},
      {"NV21", AV_PIX_FMT_NV21},
      {"RGBA", AV_PIX_FMT_RGBA},
      {"RGBX", AV_PIX_FMT_RGB0},
      {"BGRA", AV_PIX_FMT_BGRA},
      {"BGRX", AV_PIX_FMT_BGR0},
      {"I420P10", AV_PIX_FMT_YUV420P10LE},
      {"I420P12", AV_PIX_FMT_YUV420P12LE},
      {"I422P10", AV_PIX_FMT_YUV422P10LE},
      {"I422P12", AV_PIX_FMT_YUV422P12LE},
      {"I444P10", AV_PIX_FMT_YUV444P10LE},
      {"I444P12", AV_PIX_FMT_YUV444P12LE},
  };

  auto it = formats.find(format);
  return (it != formats.end()) ? it->second : AV_PIX_FMT_NONE;
}

std::string PixelFormatToString(AVPixelFormat format) {
  static const std::unordered_map<AVPixelFormat, std::string> formats = {
      {AV_PIX_FMT_YUV420P, "I420"},
      {AV_PIX_FMT_YUVA420P, "I420A"},
      {AV_PIX_FMT_YUV422P, "I422"},
      {AV_PIX_FMT_YUV444P, "I444"},
      {AV_PIX_FMT_NV12, "NV12"},
      {AV_PIX_FMT_NV21, "NV21"},
      {AV_PIX_FMT_RGBA, "RGBA"},
      {AV_PIX_FMT_RGB0, "RGBX"},
      {AV_PIX_FMT_BGRA, "BGRA"},
      {AV_PIX_FMT_BGR0, "BGRX"},
      {AV_PIX_FMT_YUV420P10LE, "I420P10"},
      {AV_PIX_FMT_YUV420P12LE, "I420P12"},
      {AV_PIX_FMT_YUV422P10LE, "I422P10"},
      {AV_PIX_FMT_YUV422P12LE, "I422P12"},
      {AV_PIX_FMT_YUV444P10LE, "I444P10"},
      {AV_PIX_FMT_YUV444P12LE, "I444P12"},
  };

  auto it = formats.find(format);
  return (it != formats.end()) ? it->second : "unknown";
}

//==============================================================================
// FFmpeg Initialization
//==============================================================================

void InitFFmpeg() {
  static std::once_flag init_flag;
  std::call_once(init_flag, []() {
    // Set log level - can be overridden by AV_LOG_* env var
    av_log_set_level(AV_LOG_WARNING);
  });
}

}  // namespace webcodecs
```

**Step 2: Add common.cc to CMakeLists.txt** (2 min)

Edit `CMakeLists.txt` to add `src/common.cc` to the source files. Find the `file(GLOB SOURCE_FILES` section and add:

```cmake
# Source files
set(SOURCE_FILES
    src/addon.cc
    src/common.cc
    src/video_encoder.cc
    src/video_decoder.cc
    src/video_frame.cc
    src/audio_encoder.cc
    src/audio_decoder.cc
    src/audio_data.cc
    src/encoded_video_chunk.cc
    src/encoded_audio_chunk.cc
    src/video_filter.cc
    src/demuxer.cc
    src/image_decoder.cc
    src/async_encode_worker.cc
    src/async_decode_worker.cc
)
```

Or if using GLOB, just ensure common.cc is picked up.

**Step 3: Build and verify** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors

**Step 4: Run existing tests** (30 sec)

```bash
npm test
```

Expected: All existing tests pass (common.cc doesn't break anything)

**Step 5: Commit** (30 sec)

```bash
git add src/common.cc CMakeLists.txt
git commit -m "feat(common): add C++ helper implementations for webcodecs namespace"
```

---

### Task 6: Create install/check.js - FFmpeg Validation

**Files:**
- Create: `install/check.js`

**Step 1: Create install directory and check.js** (5 min)

```bash
mkdir -p install
```

Create `install/check.js`:

```javascript
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Install-time check for FFmpeg availability.

'use strict';

const {execSync, spawnSync} = require('child_process');
const {platform} = require('os');

const MIN_FFMPEG_VERSION = '5.0';

function checkPkgConfig() {
  const libs = [
    'libavcodec',
    'libavutil',
    'libswscale',
    'libswresample',
    'libavfilter',
  ];

  try {
    execSync(`pkg-config --exists ${libs.join(' ')}`, {stdio: 'pipe'});
    return true;
  } catch {
    return false;
  }
}

function getFFmpegVersion() {
  try {
    const version = execSync('pkg-config --modversion libavcodec', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return version;
  } catch {
    return null;
  }
}

function versionAtLeast(version, minimum) {
  const v1 = version.split('.').map(Number);
  const v2 = minimum.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

function getInstallInstructions() {
  const os = platform();

  const instructions = {
    darwin: `
  Install FFmpeg using Homebrew:
    brew install ffmpeg
`,
    linux: `
  Ubuntu/Debian:
    sudo apt-get update
    sudo apt-get install -y \\
      libavcodec-dev \\
      libavutil-dev \\
      libswscale-dev \\
      libswresample-dev \\
      libavfilter-dev \\
      libavformat-dev \\
      pkg-config

  Fedora:
    sudo dnf install ffmpeg-devel

  Arch Linux:
    sudo pacman -S ffmpeg
`,
    win32: `
  Windows requires manual FFmpeg installation:
    1. Download from https://github.com/BtbN/FFmpeg-Builds/releases
    2. Extract to C:\\ffmpeg
    3. Set FFMPEG_PATH=C:\\ffmpeg in environment variables
    4. Restart your terminal and run: npm run build
`,
  };

  return instructions[os] || instructions.linux;
}

function main() {
  console.log('node-webcodecs: Checking FFmpeg installation...\n');

  // Skip detailed checks on Windows
  if (platform() === 'win32') {
    if (!process.env.FFMPEG_PATH) {
      console.warn(
        '⚠️  Windows: Set FFMPEG_PATH environment variable to FFmpeg location.'
      );
      console.log(getInstallInstructions());
    } else {
      console.log('✓ FFMPEG_PATH is set');
    }
    return;
  }

  // Check pkg-config exists
  const pkgConfigResult = spawnSync('which', ['pkg-config'], {stdio: 'pipe'});
  if (pkgConfigResult.status !== 0) {
    console.error('✗ pkg-config not found');
    console.log('\n  Install pkg-config:');
    console.log('    macOS: brew install pkg-config');
    console.log('    Ubuntu: sudo apt-get install pkg-config');
    process.exit(1);
  }
  console.log('✓ pkg-config found');

  // Check FFmpeg libraries
  if (!checkPkgConfig()) {
    console.error('✗ FFmpeg development libraries not found');
    console.log(getInstallInstructions());
    process.exit(1);
  }
  console.log('✓ FFmpeg development libraries found');

  // Check FFmpeg version
  const version = getFFmpegVersion();
  if (version) {
    if (versionAtLeast(version, MIN_FFMPEG_VERSION)) {
      console.log(
        `✓ FFmpeg version ${version} (>= ${MIN_FFMPEG_VERSION} required)`
      );
    } else {
      console.warn(
        `⚠️  FFmpeg version ${version} is older than recommended ${MIN_FFMPEG_VERSION}`
      );
    }
  }

  console.log('\n✓ All checks passed. Ready to build.\n');
}

if (require.main === module) {
  main();
}

module.exports = {checkPkgConfig, getFFmpegVersion};
```

**Step 2: Test the check script** (30 sec)

```bash
node install/check.js
```

Expected: Shows check results (should pass if FFmpeg installed)

**Step 3: Commit** (30 sec)

```bash
git add install/check.js
git commit -m "feat(install): add FFmpeg availability check script"
```

---

### Task 7: Create binding.gyp - node-gyp Build Configuration

**Files:**
- Create: `binding.gyp`

**Step 1: Create binding.gyp** (5 min)

Create `binding.gyp`:

```python
{
  "targets": [
    {
      "target_name": "node_webcodecs",
      "sources": [
        "src/addon.cc",
        "src/common.cc",
        "src/video_encoder.cc",
        "src/video_decoder.cc",
        "src/video_frame.cc",
        "src/audio_encoder.cc",
        "src/audio_decoder.cc",
        "src/audio_data.cc",
        "src/encoded_video_chunk.cc",
        "src/encoded_audio_chunk.cc",
        "src/video_filter.cc",
        "src/demuxer.cc",
        "src/image_decoder.cc",
        "src/async_encode_worker.cc",
        "src/async_decode_worker.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "."
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_CPP_EXCEPTIONS",
        "NODE_ADDON_API_DISABLE_DEPRECATED"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "conditions": [
        ["OS=='mac'", {
          "include_dirs": [
            "<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/opt/homebrew/include /usr/local/include')"
          ],
          "libraries": [
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter')"
          ],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "GCC_ENABLE_CPP_RTTI": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CPLUSPLUSFLAGS": [
              "-fexceptions",
              "-Wall",
              "-Wextra",
              "-Wno-unused-parameter"
            ]
          }
        }],
        ["OS=='linux'", {
          "include_dirs": [
            "<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter | sed s/-I//g)"
          ],
          "libraries": [
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter)"
          ],
          "cflags_cc": [
            "-std=c++17",
            "-fexceptions",
            "-Wall",
            "-Wextra",
            "-Wno-unused-parameter",
            "-fPIC"
          ]
        }],
        ["OS=='win'", {
          "include_dirs": [
            "<!(echo %FFMPEG_PATH%)/include"
          ],
          "libraries": [
            "-l<!(echo %FFMPEG_PATH%)/lib/avcodec",
            "-l<!(echo %FFMPEG_PATH%)/lib/avutil",
            "-l<!(echo %FFMPEG_PATH%)/lib/swscale",
            "-l<!(echo %FFMPEG_PATH%)/lib/swresample",
            "-l<!(echo %FFMPEG_PATH%)/lib/avfilter"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++17", "/EHsc"],
              "ExceptionHandling": 1
            }
          },
          "defines": ["_HAS_EXCEPTIONS=1"]
        }]
      ]
    }
  ]
}
```

**Step 2: Test node-gyp build (parallel to cmake-js)** (1 min)

```bash
# Test that binding.gyp is valid - don't actually switch yet
node-gyp configure
```

Expected: Configures successfully (creates build/ directory)

**Step 3: Clean up test build** (30 sec)

```bash
# Remove node-gyp test build, keep cmake-js build
rm -rf build/Makefile build/Release/obj.target build/config.gypi build/binding.Makefile
```

**Step 4: Commit** (30 sec)

```bash
git add binding.gyp
git commit -m "feat(build): add node-gyp binding.gyp configuration"
```

---

### Task 8: Update package.json - Add node-gyp Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Update package.json** (3 min)

Add to dependencies:
```json
"node-gyp-build": "^4.8.0"
```

Add to devDependencies:
```json
"node-gyp": "^10.0.0"
```

Update node-addon-api version:
```json
"node-addon-api": "^8.0.0"
```

Add gypfile flag:
```json
"gypfile": true
```

Keep existing scripts unchanged for now (cmake-js still works).

**Step 2: Install new dependencies** (30 sec)

```bash
npm install
```

**Step 3: Verify existing build still works** (30 sec)

```bash
npm run build
npm test
```

Expected: All tests pass

**Step 4: Commit** (30 sec)

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add node-gyp and node-gyp-build dependencies"
```

---

## Phase 1 Summary

| Task | Files Created/Modified | Status |
|------|----------------------|--------|
| 1 | `lib/is.ts`, `test/golden/is.test.ts` | Type guards |
| 2 | `lib/is.ts`, `test/golden/is.test.ts` | Error factories |
| 3 | `lib/is.ts`, `test/golden/is.test.ts` | Assertion helpers |
| 4 | `src/common.h` | C++ declarations |
| 5 | `src/common.cc`, `CMakeLists.txt` | C++ implementations |
| 6 | `install/check.js` | FFmpeg check |
| 7 | `binding.gyp` | node-gyp config |
| 8 | `package.json` | Dependencies |

**Parallel Groups:**
- Group 1: Tasks 1, 2, 3 (all touch lib/is.ts - SERIAL)
- Group 2: Tasks 4, 5 (C++ files - SERIAL)
- Group 3: Tasks 6, 7, 8 (independent - PARALLEL)

---

## Phase 2: Integrate C++ Helpers

### Task 9: Update addon.cc with InitFFmpeg

**Files:**
- Modify: `src/addon.cc`

**Step 1: Add InitFFmpeg call** (2 min)

Add to `src/addon.cc`:

```cpp
#include "src/common.h"

// In InitAll function, at the start:
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Thread-safe FFmpeg initialization
  webcodecs::InitFFmpeg();

  // ... existing registrations
}
```

**Step 2: Build and test** (30 sec)

```bash
npm run build && npm test
```

**Step 3: Commit** (30 sec)

```bash
git add src/addon.cc
git commit -m "feat(addon): add thread-safe FFmpeg initialization"
```

---

### Task 10: Refactor video_encoder.cc to Use webcodecs:: Helpers

**Files:**
- Modify: `src/video_encoder.cc`

**Step 1: Add include and using directive** (1 min)

At top of `src/video_encoder.cc`:

```cpp
#include "src/common.h"

// After includes, add:
using namespace webcodecs;
```

**Step 2: Refactor Configure method attribute extraction** (5 min)

Replace manual `.Has()` + `.Get()` patterns with helper calls:

```cpp
// Before:
if (!config.Has("width") || !config.Get("width").IsNumber()) {
  throw Napi::Error::New(env, "width is required");
}
int width = config.Get("width").As<Napi::Number>().Int32Value();

// After:
RequireAttr(env, config, "width");
int width = AttrAsInt32(config, "width");
RequirePositiveInt(env, "width", width);
```

**Step 3: Refactor optional attributes** (3 min)

```cpp
// Before:
display_width_ = width_;
if (config.Has("displayWidth") && config.Get("displayWidth").IsNumber()) {
  display_width_ = config.Get("displayWidth").As<Napi::Number>().Int32Value();
}

// After:
display_width_ = AttrAsInt32(config, "displayWidth", width_);
```

**Step 4: Build and test** (30 sec)

```bash
npm run build && npm test
```

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc
git commit -m "refactor(video_encoder): use webcodecs:: helpers for attribute extraction"
```

---

### Task 11-15: Refactor Remaining C++ Files

Apply same pattern to:
- Task 11: `src/video_decoder.cc`
- Task 12: `src/video_frame.cc`
- Task 13: `src/audio_encoder.cc`
- Task 14: `src/audio_decoder.cc`
- Task 15: `src/audio_data.cc`, `src/encoded_video_chunk.cc`, `src/encoded_audio_chunk.cc`, `src/video_filter.cc`, `src/demuxer.cc`, `src/image_decoder.cc`

Each follows the same pattern as Task 10.

---

## Phase 3: Integrate JS Validation Layer

### Task 16: Update lib/index.ts to Use lib/is.ts

**Files:**
- Modify: `lib/index.ts`

**Step 1: Add import** (1 min)

At top of `lib/index.ts`:

```typescript
import * as is from './is';
```

**Step 2: Refactor VideoEncoder constructor validation** (3 min)

```typescript
// Before:
if (!init || typeof init.output !== 'function') {
  throw new TypeError('output callback is required');
}

// After:
is.assertPlainObject(init, 'init');
is.assertFunction(init.output, 'init.output');
is.assertFunction(init.error, 'init.error');
```

**Step 3: Refactor configure validation** (3 min)

```typescript
// Before:
if (!config.width || !Number.isInteger(config.width) || config.width <= 0) {
  throw new Error('width must be a positive integer');
}

// After:
is.assertPositiveInteger(config.width, 'config.width');
is.assertPositiveInteger(config.height, 'config.height');
```

**Step 4: Build and test** (30 sec)

```bash
npm run build:ts && npm test
```

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts
git commit -m "refactor(index): use lib/is.ts validation helpers"
```

---

## Phase 4: Switch Build System

### Task 17: Update package.json Scripts to node-gyp

**Files:**
- Modify: `package.json`

**Step 1: Update scripts** (2 min)

```json
{
  "scripts": {
    "install": "node install/check.js && (node-gyp-build || npm run build:native)",
    "build": "npm run build:native && npm run build:ts",
    "build:native": "node-gyp rebuild",
    "build:native:debug": "node-gyp rebuild --debug",
    "build:ts": "tsc",
    "rebuild": "npm run clean && npm run build",
    "clean": "node-gyp clean && rm -rf dist",
    "test": "vitest run --config test/vitest.config.ts",
    "lint": "gts lint",
    "fix": "gts fix"
  }
}
```

**Step 2: Clean and rebuild with node-gyp** (1 min)

```bash
rm -rf build dist
npm run build
```

**Step 3: Run tests** (30 sec)

```bash
npm test
```

**Step 4: Commit** (30 sec)

```bash
git add package.json
git commit -m "build: switch from cmake-js to node-gyp"
```

---

### Task 18: Update lib/binding.ts with Enhanced Loader

**Files:**
- Modify: `lib/binding.ts`

**Step 1: Update binding paths** (3 min)

Update the binding paths to match node-gyp output:

```typescript
const bindingPaths = [
  '../build/Release/node_webcodecs.node',
  '../build/Debug/node_webcodecs.node',
  `../prebuilds/${runtimePlatformArch()}/node_webcodecs.node`,
];
```

**Step 2: Enhance error messages** (3 min)

Add platform-specific installation instructions to the error handler.

**Step 3: Build and test** (30 sec)

```bash
npm run build && npm test
```

**Step 4: Commit** (30 sec)

```bash
git add lib/binding.ts
git commit -m "feat(binding): enhance loader with node-gyp paths and diagnostics"
```

---

### Task 19: Remove CMakeLists.txt and cmake-js

**Files:**
- Delete: `CMakeLists.txt`
- Modify: `package.json` (remove cmake-js)

**Step 1: Remove CMakeLists.txt** (30 sec)

```bash
rm CMakeLists.txt
```

**Step 2: Remove cmake-js from devDependencies** (1 min)

Edit `package.json` to remove `"cmake-js"` from devDependencies.

**Step 3: Clean install** (30 sec)

```bash
rm -rf node_modules package-lock.json
npm install
```

**Step 4: Build and test** (30 sec)

```bash
npm run build && npm test
```

**Step 5: Commit** (30 sec)

```bash
git add -A
git commit -m "build: remove cmake-js, complete migration to node-gyp"
```

---

## Phase 5: Final Code Review Task

### Task 20: Code Review

Run full test suite and code review:

```bash
npm run lint
npm test
npm run build
```

Verify:
- All tests pass
- No lint errors
- Build succeeds with node-gyp
- Error messages follow "Expected X for Y but received Z" pattern

---

## Parallel Groups Summary

| Group | Tasks | Rationale |
|-------|-------|-----------|
| 1 | 1, 2, 3 | lib/is.ts - SERIAL (same file) |
| 2 | 4, 5 | C++ common.h/cc - SERIAL (header first) |
| 3 | 6, 7, 8 | Independent infrastructure - PARALLEL |
| 4 | 9 | addon.cc - Single task |
| 5 | 10, 11, 12, 13, 14, 15 | C++ refactors - PARALLEL (different files) |
| 6 | 16 | lib/index.ts - Single task |
| 7 | 17, 18, 19 | Build system switch - SERIAL |
| 8 | 20 | Code review - Final |
