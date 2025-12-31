# Test Suite Cleanup: Anti-Patterns and Consistency Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-test-suite-cleanup.md` to implement task-by-task.

**Goal:** Eliminate code smells, anti-patterns, and inconsistencies across the test suite to improve maintainability, reduce flaky tests, and establish consistent patterns.

**Architecture:** Create shared test utilities with automatic resource cleanup (RAII-style for tests), consolidate magic numbers into well-documented fixtures, and establish a single error-checking pattern across all test files.

**Tech Stack:** Vitest, TypeScript, node:assert (for contract tests)

---

## Audit Summary

The ffmpeg-cpp-sentinel agent identified the following issues:

| Severity | Issue | Files Affected |
|----------|-------|----------------|
| CRITICAL | Inconsistent resource cleanup (potential leaks) | 15+ test files |
| CRITICAL | Duplicated encoder/decoder creation (37+ times in video-encoder.test.ts alone) | All golden tests |
| MAJOR | Magic numbers without explanation | 50+ occurrences |
| MAJOR | Mixed test framework patterns (Vitest vs plain JS) | contracts/ vs golden/ |
| MAJOR | Missing assertions in integration tests | encode-decode.test.mjs |
| MAJOR | Inconsistent error checking (3 different patterns) | Throughout |
| MINOR | Inconsistent test naming conventions | Throughout |
| MINOR | Unused test fixtures | test/fixtures/index.ts |
| MINOR | setTimeout-based waits (flaky test risk) | 8+ occurrences |

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Foundation: shared utilities must exist before refactoring |
| Group 2 | 2, 3, 4, 5 | Independent test file refactors, no file overlap |
| Group 3 | 6, 7 | Contract tests and integration tests (independent) |
| Group 4 | 8 | Final: Code review |

---

### Task 1: Create Shared Test Utilities with Automatic Cleanup

**Files:**
- Create: `test/fixtures/test-helpers.ts`
- Modify: `test/fixtures/index.ts:1-10` (add re-export)

**Step 1: Write the failing test** (2-5 min)

Create a test file that uses the new helpers to verify they work correctly:

```typescript
// test/unit/test-helpers.test.ts
import { describe, expect, it } from 'vitest';
import { withVideoEncoder, withVideoDecoder, withVideoFrame, withAudioData } from '../fixtures/test-helpers';

describe('Test Helpers', () => {
  describe('withVideoEncoder', () => {
    it('should create encoder, run callback, and close automatically', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await withVideoEncoder(async (encoder) => {
        capturedEncoder = encoder;
        expect(encoder.state).toBe('unconfigured');
      });

      // After callback, encoder should be closed
      expect(capturedEncoder!.state).toBe('closed');
    });

    it('should close encoder even when callback throws', async () => {
      let capturedEncoder: VideoEncoder | null = null;

      await expect(withVideoEncoder(async (encoder) => {
        capturedEncoder = encoder;
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      expect(capturedEncoder!.state).toBe('closed');
    });
  });

  describe('withVideoFrame', () => {
    it('should create frame, run callback, and close automatically', async () => {
      let capturedFrame: VideoFrame | null = null;

      await withVideoFrame(
        { width: 64, height: 64, format: 'RGBA', timestamp: 0 },
        async (frame) => {
          capturedFrame = frame;
          expect(frame.codedWidth).toBe(64);
        }
      );

      // Frame should be closed after callback
      expect(capturedFrame!.format).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/unit/test-helpers.test.ts -v
```

Expected: FAIL with `Cannot find module '../fixtures/test-helpers'`

**Step 3: Write minimal implementation** (2-5 min)

Create the test helpers file:

```typescript
// test/fixtures/test-helpers.ts
import { createRGBABuffer, createEncoderCallbacks, createDecoderCallbacks } from './index';

/**
 * RAII-style wrapper for VideoEncoder.
 * Automatically closes the encoder after the callback completes (success or failure).
 */
export async function withVideoEncoder(
  fn: (encoder: VideoEncoder) => Promise<void>
): Promise<void> {
  const { output, error } = createEncoderCallbacks<EncodedVideoChunk>();
  const encoder = new VideoEncoder({ output, error });
  try {
    await fn(encoder);
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * RAII-style wrapper for VideoDecoder.
 * Automatically closes the decoder after the callback completes.
 */
export async function withVideoDecoder(
  fn: (decoder: VideoDecoder) => Promise<void>
): Promise<void> {
  const { output, error } = createDecoderCallbacks<VideoFrame>();
  const decoder = new VideoDecoder({ output, error });
  try {
    await fn(decoder);
  } finally {
    if (decoder.state !== 'closed') {
      decoder.close();
    }
  }
}

/**
 * RAII-style wrapper for AudioEncoder.
 * Automatically closes the encoder after the callback completes.
 */
export async function withAudioEncoder(
  fn: (encoder: AudioEncoder) => Promise<void>
): Promise<void> {
  const { output, error } = createEncoderCallbacks<EncodedAudioChunk>();
  const encoder = new AudioEncoder({ output, error });
  try {
    await fn(encoder);
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}

/**
 * RAII-style wrapper for AudioDecoder.
 * Automatically closes the decoder after the callback completes.
 */
export async function withAudioDecoder(
  fn: (decoder: AudioDecoder) => Promise<void>
): Promise<void> {
  const { output, error } = createDecoderCallbacks<AudioData>();
  const decoder = new AudioDecoder({ output, error });
  try {
    await fn(decoder.state !== 'closed') {
      decoder.close();
    }
  }
}

/**
 * Frame configuration for withVideoFrame helper.
 */
export interface FrameConfig {
  width: number;
  height: number;
  format: 'RGBA' | 'I420' | 'NV12';
  timestamp: number;
  color?: { r: number; g: number; b: number; a: number };
}

/**
 * RAII-style wrapper for VideoFrame.
 * Creates a frame with the specified config and closes it after the callback.
 */
export async function withVideoFrame(
  config: FrameConfig,
  fn: (frame: VideoFrame) => Promise<void>
): Promise<void> {
  const { width, height, format, timestamp, color } = config;
  const buffer = createRGBABuffer(width, height, color ?? { r: 128, g: 128, b: 128, a: 255 });
  const frame = new VideoFrame(buffer, {
    format,
    codedWidth: width,
    codedHeight: height,
    timestamp,
  });
  try {
    await fn(frame);
  } finally {
    frame.close();
  }
}

/**
 * Audio data configuration for withAudioData helper.
 */
export interface AudioConfig {
  sampleRate: number;
  numberOfChannels: number;
  numberOfFrames: number;
  timestamp: number;
}

/**
 * RAII-style wrapper for AudioData.
 * Creates audio data with the specified config and closes it after the callback.
 */
export async function withAudioData(
  config: AudioConfig,
  fn: (data: AudioData) => Promise<void>
): Promise<void> {
  const { sampleRate, numberOfChannels, numberOfFrames, timestamp } = config;
  const data = new AudioData({
    format: 'f32-planar',
    sampleRate,
    numberOfChannels,
    numberOfFrames,
    timestamp,
    data: new Float32Array(numberOfFrames * numberOfChannels),
  });
  try {
    await fn(data);
  } finally {
    data.close();
  }
}

/**
 * Standardized error assertion helper.
 * Ensures consistent error checking pattern across all tests.
 *
 * Usage:
 *   await expectDOMException('InvalidStateError', () => decoder.decode(chunk));
 */
export function expectDOMException(
  expectedName: string,
  fn: () => void | Promise<void>
): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error('Use expectDOMExceptionAsync for async functions');
    }
    throw new Error(`Expected ${expectedName} but no error was thrown`);
  } catch (e) {
    if (!(e instanceof DOMException)) {
      throw new Error(`Expected DOMException but got ${e}`);
    }
    if (e.name !== expectedName) {
      throw new Error(`Expected ${expectedName} but got ${e.name}`);
    }
  }
}

/**
 * Async version of expectDOMException.
 */
export async function expectDOMExceptionAsync(
  expectedName: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected ${expectedName} but no error was thrown`);
  } catch (e) {
    if (!(e instanceof DOMException)) {
      throw new Error(`Expected DOMException but got ${e}`);
    }
    if (e.name !== expectedName) {
      throw new Error(`Expected ${expectedName} but got ${e.name}`);
    }
  }
}

/**
 * Well-documented test constants.
 * Use these instead of magic numbers.
 */
export const TEST_CONSTANTS = {
  /** Standard small frame dimensions for quick tests */
  SMALL_FRAME: { width: 64, height: 64 },
  /** Standard medium frame dimensions for codec tests */
  MEDIUM_FRAME: { width: 320, height: 240 },
  /** Bytes per pixel for RGBA format */
  RGBA_BPP: 4,
  /** Bytes per pixel for I420 format (1.5 due to chroma subsampling) */
  I420_BPP: 1.5,
  /** Default test timeout in ms */
  DEFAULT_TIMEOUT: 10000,
  /** Extended timeout for codec operations */
  CODEC_TIMEOUT: 30000,
  /** Frame timestamps at 30fps */
  FPS_30_TIMESTAMP_DELTA: 33333, // microseconds
  /** Memory growth limit for leak tests (MB) */
  MEMORY_LIMIT_MB: 50,
} as const;
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/unit/test-helpers.test.ts -v
```

Expected: PASS (all tests green)

**Step 5: Add re-export to fixtures/index.ts** (1 min)

Add at the top of `test/fixtures/index.ts`:

```typescript
export * from './test-helpers';
```

**Step 6: Run full test suite to ensure no regressions** (1 min)

```bash
npm run test-fast
```

Expected: All existing tests still pass

**Step 7: Commit** (30 sec)

```bash
git add test/fixtures/test-helpers.ts test/unit/test-helpers.test.ts test/fixtures/index.ts
git commit -m "test(fixtures): add RAII-style test helpers with automatic cleanup"
```

---

### Task 2: Refactor video-frame-closed-state.test.ts - Eliminate Duplication

**Files:**
- Modify: `test/golden/video-frame-closed-state.test.ts:1-120`

**Step 1: Read the current file** (1 min)

Read the file to understand the current duplication pattern.

**Step 2: Write the refactored test file** (3-5 min)

Replace the duplicated frame creation with `beforeEach` and `afterEach`:

```typescript
// test/golden/video-frame-closed-state.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONSTANTS } from '../fixtures/test-helpers';

describe('VideoFrame closed state', () => {
  let frame: VideoFrame;
  const { width, height } = TEST_CONSTANTS.SMALL_FRAME;

  beforeEach(() => {
    const data = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP);
    frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 1000,
    });
    frame.close();
  });

  afterEach(() => {
    // Frame already closed in beforeEach, but guard against test modifications
    if (frame.format !== null) {
      frame.close();
    }
  });

  it('should return null for format when closed', () => {
    expect(frame.format).toBeNull();
  });

  it('should return 0 for codedWidth when closed', () => {
    expect(frame.codedWidth).toBe(0);
  });

  it('should return 0 for codedHeight when closed', () => {
    expect(frame.codedHeight).toBe(0);
  });

  it('should return 0 for displayWidth when closed', () => {
    expect(frame.displayWidth).toBe(0);
  });

  it('should return 0 for displayHeight when closed', () => {
    expect(frame.displayHeight).toBe(0);
  });

  it('should return null for timestamp when closed', () => {
    expect(frame.timestamp).toBeNull();
  });

  it('should return null for duration when closed', () => {
    expect(frame.duration).toBeNull();
  });

  it('should return null for colorSpace when closed', () => {
    expect(frame.colorSpace.matrix).toBeNull();
  });

  it('should allow idempotent close calls', () => {
    // Frame is already closed from beforeEach
    expect(() => frame.close()).not.toThrow();
    expect(() => frame.close()).not.toThrow();
  });
});
```

**Step 3: Run tests to verify refactor works** (30 sec)

```bash
npx vitest run test/golden/video-frame-closed-state.test.ts -v
```

Expected: PASS (9 tests)

**Step 4: Commit** (30 sec)

```bash
git add test/golden/video-frame-closed-state.test.ts
git commit -m "test(video-frame): eliminate duplication with shared beforeEach setup"
```

---

### Task 3: Refactor video-encoder.test.ts - Standardize Error Checking

**Files:**
- Modify: `test/golden/video-encoder.test.ts` (multiple sections)

**Step 1: Identify inconsistent error checking patterns** (2 min)

Search for the three different error-checking patterns:
1. `try/catch with manual assertion`
2. `expect().toThrow()`
3. Mixed redundant pattern

**Step 2: Standardize to expect().toThrow() pattern** (5 min)

For each occurrence of the verbose try/catch pattern:

**Before:**
```typescript
try {
  encoder.encode(frame);
  expect.fail('Should have thrown');
} catch (e) {
  expect(e).toBeInstanceOf(DOMException);
  expect((e as DOMException).name).toBe('InvalidStateError');
}
```

**After:**
```typescript
expect(() => encoder.encode(frame)).toThrow(DOMException);
```

If you need to verify the specific DOMException name, use:
```typescript
expect(() => encoder.encode(frame)).toThrowError(/InvalidStateError/);
```

Or use the new helper:
```typescript
import { expectDOMException } from '../fixtures/test-helpers';
expectDOMException('InvalidStateError', () => encoder.encode(frame));
```

**Step 3: Replace magic numbers with TEST_CONSTANTS** (3 min)

**Before:**
```typescript
const frame = new VideoFrame(new Uint8Array(320 * 240 * 4), {
  format: 'RGBA',
  codedWidth: 320,
  codedHeight: 240,
  timestamp: 0,
});
```

**After:**
```typescript
import { TEST_CONSTANTS } from '../fixtures/test-helpers';
const { width, height } = TEST_CONSTANTS.MEDIUM_FRAME;
const frame = new VideoFrame(new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP), {
  format: 'RGBA',
  codedWidth: width,
  codedHeight: height,
  timestamp: 0,
});
```

**Step 4: Run tests to verify changes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -v
```

Expected: PASS (all tests)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-encoder.test.ts
git commit -m "test(video-encoder): standardize error checking and replace magic numbers"
```

---

### Task 4: Refactor audio-encoder.test.ts - Fix Duplicate Error Check Pattern

**Files:**
- Modify: `test/golden/audio-encoder.test.ts` (error checking sections)

**Step 1: Find the wasteful duplicate error check pattern** (1 min)

The pattern that executes the operation twice:
```typescript
expect(() => decoder.decode(chunk)).toThrow(DOMException);

try {
  decoder.decode(chunk);  // Executed AGAIN!
} catch (e) {
  expect((e as DOMException).name).toBe('InvalidStateError');
}
```

**Step 2: Replace with single assertion** (3 min)

**After:**
```typescript
import { expectDOMException } from '../fixtures/test-helpers';
expectDOMException('InvalidStateError', () => decoder.decode(chunk));
```

Or if sticking with Vitest matchers:
```typescript
expect(() => decoder.decode(chunk)).toThrowError(
  expect.objectContaining({ name: 'InvalidStateError' })
);
```

**Step 3: Replace setTimeout waits with proper patterns** (3 min)

**Before:**
```typescript
await new Promise((resolve) => setTimeout(resolve, 50));
```

**After (using flush):**
```typescript
await encoder.flush();
```

Or if truly need to wait for events, use a proper condition:
```typescript
await new Promise<void>((resolve) => {
  const checkComplete = () => {
    if (chunks.length > 0) {
      resolve();
    } else {
      setTimeout(checkComplete, 10);
    }
  };
  checkComplete();
});
```

**Step 4: Run tests to verify** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -v
```

Expected: PASS (all tests)

**Step 5: Commit** (30 sec)

```bash
git add test/golden/audio-encoder.test.ts
git commit -m "test(audio-encoder): fix duplicate error checks and flaky setTimeout waits"
```

---

### Task 5: Refactor audio-decoder.test.ts and video-decoder.test.ts - Consistent Patterns

**Files:**
- Modify: `test/golden/audio-decoder.test.ts`
- Modify: `test/golden/video-decoder.test.ts`

**Step 1: Apply same error checking standardization** (3 min each file)

Apply the same patterns from Tasks 3 and 4:
- Use `expectDOMException()` helper for DOMException checks
- Use `TEST_CONSTANTS` for frame dimensions
- Remove duplicate try/catch blocks

**Step 2: Ensure proper resource cleanup in afterEach** (2 min each file)

**Pattern to add/verify:**
```typescript
afterEach(() => {
  try {
    decoder?.close();
  } catch {
    // Already closed or never created
  }
  outputFrames.forEach(f => {
    try { f.close(); } catch {}
  });
  outputFrames.length = 0;
});
```

**Step 3: Run tests** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts test/golden/video-decoder.test.ts -v
```

Expected: PASS

**Step 4: Commit** (30 sec)

```bash
git add test/golden/audio-decoder.test.ts test/golden/video-decoder.test.ts
git commit -m "test(decoders): standardize error checking and resource cleanup"
```

---

### Task 6: Add Missing Assertions to Integration Tests

**Files:**
- Modify: `test/golden/integration/encode-decode.test.mjs`

**Step 1: Identify tests without assertions** (1 min)

The following tests return data but don't verify it:
- `EncodeSingleFrame`
- `EncodeMultipleFrames`
- `EncodeI420Frame`

**Step 2: Add meaningful assertions** (5 min)

**Before:**
```javascript
it('EncodeSingleFrame', {timeout: 10_000}, async () => {
  const chunks = [];
  // ... encoding code ...
  return chunks;
});
```

**After:**
```javascript
it('EncodeSingleFrame', {timeout: 10_000}, async () => {
  const chunks = [];
  // ... encoding code ...

  // Assertions
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]).toBeInstanceOf(EncodedVideoChunk);
  expect(chunks[0].type).toBe('key'); // First frame should be keyframe
  expect(chunks[0].byteLength).toBeGreaterThan(0);
});
```

**Step 3: Add proper cleanup** (2 min)

Ensure all frames are closed after encoding:
```javascript
afterEach(() => {
  // Clean up any frames that might have been created
  frames.forEach(f => {
    try { f.close(); } catch {}
  });
  frames.length = 0;
});
```

**Step 4: Run tests** (30 sec)

```bash
npx vitest run test/golden/integration/encode-decode.test.mjs -v
```

Expected: PASS with actual assertions

**Step 5: Commit** (30 sec)

```bash
git add test/golden/integration/encode-decode.test.mjs
git commit -m "test(integration): add missing assertions and proper cleanup"
```

---

### Task 7: Document and Standardize Contract Tests

**Files:**
- Modify: `test/contracts/video_encoder/state_machine.js` (add documentation)
- Modify: `test/contracts/error_handling/invalid_state.js` (add documentation)

**Step 1: Add header documentation explaining contract test purpose** (2 min)

Add to each contract test file:

```javascript
/**
 * Contract Test: VideoEncoder State Machine
 *
 * PURPOSE: These tests verify the W3C WebCodecs state machine invariants
 * using a minimal test framework (no Vitest). They run as standalone scripts
 * to ensure the state machine works correctly even without framework support.
 *
 * RELATIONSHIP TO GOLDEN TESTS: These tests overlap with golden tests intentionally.
 * Golden tests verify feature correctness; contract tests verify spec compliance.
 * Both should pass independently.
 *
 * RUN: node test/contracts/video_encoder/state_machine.js
 */
```

**Step 2: Standardize helper functions** (3 min)

Extract common patterns into a shared contract helper:

```javascript
// test/contracts/helpers.js
const {
  VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder,
  VideoFrame, AudioData, EncodedVideoChunk, EncodedAudioChunk
} = require('../../dist');
const assert = require('node:assert');

const TEST_CONFIG = {
  SMALL_FRAME: { width: 64, height: 64 },
  MEDIUM_FRAME: { width: 320, height: 240 },
  RGBA_BPP: 4,
};

function createTestFrame(width = 320, height = 240) {
  const data = new Uint8Array(width * height * 4);
  return new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
  });
}

function createEncoder(onOutput = () => {}, onError = () => {}) {
  return new VideoEncoder({ output: onOutput, error: onError });
}

module.exports = { TEST_CONFIG, createTestFrame, createEncoder, assert };
```

**Step 3: Run contract tests** (30 sec)

```bash
npm run test-contracts
```

Expected: All contract tests pass

**Step 4: Commit** (30 sec)

```bash
git add test/contracts/
git commit -m "test(contracts): add documentation and standardize helpers"
```

---

### Task 8: Code Review

**Files:**
- All modified test files from Tasks 1-7

**Step 1: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass (lint + fast + guardrails)

**Step 2: Review changes for consistency** (3 min)

Verify:
- All new code uses `TEST_CONSTANTS` instead of magic numbers
- All error checking uses the standardized pattern
- All resources have cleanup in `afterEach` or `finally` blocks
- No duplicate try/catch patterns remain

**Step 3: Run stress tests to verify no memory regressions** (2 min)

```bash
npm run test-stress
```

Expected: PASS (no memory leaks introduced)

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `test/fixtures/test-helpers.ts` | Create | RAII-style test helpers, error assertions, constants |
| `test/unit/test-helpers.test.ts` | Create | Tests for new helpers |
| `test/fixtures/index.ts` | Modify | Re-export test-helpers |
| `test/golden/video-frame-closed-state.test.ts` | Modify | Eliminate duplication with beforeEach |
| `test/golden/video-encoder.test.ts` | Modify | Standardize error checking, use constants |
| `test/golden/audio-encoder.test.ts` | Modify | Fix duplicate error checks, flaky waits |
| `test/golden/audio-decoder.test.ts` | Modify | Standardize patterns |
| `test/golden/video-decoder.test.ts` | Modify | Standardize patterns |
| `test/golden/integration/encode-decode.test.mjs` | Modify | Add missing assertions |
| `test/contracts/*.js` | Modify | Add documentation, standardize helpers |

## Success Criteria

- [ ] All tests pass (`npm test`)
- [ ] No magic numbers without constants
- [ ] Single error checking pattern used
- [ ] All resources cleaned up in afterEach/finally
- [ ] No duplicate try/catch blocks
- [ ] Integration tests have actual assertions
- [ ] Contract tests have documentation headers
