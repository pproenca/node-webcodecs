# Test Suite Audit: node-webcodecs vs Sharp

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-test-suite-audit.md` to implement task-by-task.

**Goal:** Comprehensive audit comparing node-webcodecs test suite to Sharp's battle-tested patterns, identifying tests that pass for wrong reasons, and preparing for open-source release.

**Architecture:** Multi-phase audit covering test correctness, coverage gaps, Sharp comparison, and CI readiness.

**Tech Stack:** Vitest, Node.js native testing, FFmpeg NAPI bindings

---

## Executive Summary

### Current State

| Metric | node-webcodecs | Sharp |
|--------|----------------|-------|
| Test files | ~60 | ~57 (unit only) |
| Lines of test code | ~8,000 | ~15,500 |
| Test categories | 6 (unit, golden, reference, contracts, guardrails, stress) | 3 (unit, bench, leak) |
| Leak detection | JS-based heapUsed (broken) + guardrails | Valgrind shell script |
| Contract tests | 15 standalone files | None (integrated) |
| Fixture system | Basic (1 MP4, buffer generators) | Comprehensive (100+ files, assertSimilar) |
| CI integration | Partial | Full matrix |

### Critical Issues Found

1. **Memory leak tests call undefined function** - `getHeapUsed()` doesn't exist, `getMemoryUsed()` is defined
2. **Reference tests crashing with mutex errors** - C++ threading issue in audio tests
3. **Integration tests don't verify pixel values** - Only check dimensions, not actual encoding quality
4. **Contract tests disconnected from CI** - Not in main test flow
5. **No visual comparison framework** - Sharp has `assertSimilar()` with fingerprinting

---

## Detailed Findings

### 1. Tests Passing for Wrong Reasons

#### 1.1 Memory Leak Tests (`test/stress/memory-leak.test.ts`)

**Issue:** Function name mismatch - defines `getMemoryUsed()` but calls `getHeapUsed()`

```typescript
// Line 31-34 DEFINES:
function getMemoryUsed(): number {
  forceGC();
  return process.memoryUsage().rss;
}

// Lines 53, 73, 80, 120, etc. CALL:
const before = getHeapUsed(); // ← UNDEFINED FUNCTION!
```

**Why it "passes":** Test execution fails silently or Vitest doesn't run stress tests by default.

**Fix required:** Replace all `getHeapUsed()` calls with `getMemoryUsed()`

#### 1.2 Integration Tests (`test/golden/integration/encode-decode.test.mjs`)

**Issue:** Tests encode/decode but never verify pixel data integrity

```javascript
// Line 134-205: EncodeDecode test
// Creates green frame (R=0, G=255, B=0)
// Encodes → Decodes
// ONLY checks: decodedFrames.length > 0
// NEVER verifies: decoded pixel values match input
```

**Why it "passes":** Any frame output (even garbage) passes the test.

**What Sharp does:** Uses `assertSimilar()` with perceptual fingerprinting (dHash algorithm):
```javascript
// Sharp's fixtures/index.js lines 154-192
assertSimilar: async (expectedImage, actualImage, options) => {
  const [expectedFingerprint, actualFingerprint] = await Promise.all([
    fingerprint(expectedImage),
    fingerprint(actualImage)
  ]);
  // Computes Hamming distance of 64-bit fingerprints
}
```

#### 1.3 Round-Trip Contract Tests (`test/contracts/round_trip/video_integrity.js`)

**Issue:** Same problem - only checks dimensions and timestamps, not visual integrity.

```javascript
// Line 21-109: Only verifies
assert.strictEqual(decoded.width, width);
assert.strictEqual(decoded.height, height);
// Missing: actual pixel comparison
```

#### 1.4 Contract Tests Wrapper (`test/golden/contracts.test.ts`)

**Issue:** Runs contracts as subprocess, swallows stdout/stderr on success.

**Why problematic:**
- Partial failures may be hidden
- No integration with Vitest coverage
- Duplicate test infrastructure maintenance

### 2. Tests That Should Fail But Don't

#### 2.1 Reference Tests - Threading Errors Visible

```
libc++abi: terminating due to uncaught exception of type std::__1::system_error:
mutex lock failed: Invalid argument
```

These errors indicate C++ mutex corruption but tests continue. The mutex errors appear in:
- `reference/audio-encoder.test.ts` (3 failed)
- `reference/audio-conversion.test.ts` (5 failed)
- `reference/video-encoder.test.ts` (1 failed)

**Root cause:** Likely race condition in native NAPI code or FFmpeg resource cleanup.

### 3. Missing Test Coverage (Sharp Comparison)

| Feature | Sharp | node-webcodecs |
|---------|-------|----------------|
| Input validation edge cases | 50+ tests in io.js | Basic in exceptions tests |
| Stream I/O (pipe, events) | 40+ tests | None |
| Error message quality | Tests exact messages | Only checks `instanceof Error` |
| File I/O same-file check | Tested | Not applicable but no equivalent |
| Corrupt file handling | 5+ tests | None |
| Memory limits (`limitInputPixels`) | Tested | None |
| Wide-character filenames | Tested | Not tested |

### 4. Test Infrastructure Comparison

#### Sharp's Fixtures Module (`test/fixtures/index.js`)

Provides:
- 100+ named test files with provenance comments
- `fingerprint()` - 64-bit perceptual hash
- `assertSimilar()` - threshold-based similarity
- `assertMaxColourDistance()` - native color distance
- `path()` and `expected()` helpers

#### node-webcodecs Fixtures (`test/fixtures/index.ts`)

Provides:
- 1 test file (`small_buck_bunny.mp4`)
- Buffer generators (`createRGBABuffer`, `createI420Buffer`, etc.)
- Config presets (`videoConfigs`, `audioConfigs`)
- Callback factories (`createEncoderCallbacks`, etc.)

**Gap:** No image/video comparison utilities for verification.

### 5. Leak Detection Comparison

#### Sharp (`test/leak/leak.sh`)

```bash
valgrind \
  --leak-check=full \
  --show-leak-kinds=definite,indirect \
  --num-callers=20 \
  --trace-children=yes \
  node --zero-fill-buffers --test "test/unit/$test"
```

- Uses Valgrind for native memory leak detection
- Has suppression files for libvips
- Runs each test file individually

#### node-webcodecs (`test/guardrails/memory_sentinel.js`)

```javascript
const LIMIT_MB = 50;
const FRAMES = 10000;
// Uses process.memoryUsage().rss
```

- Pure JS solution (RSS-based)
- Cannot detect native FFmpeg leaks without Valgrind
- Single test run, not per-file isolation

### 6. CI Readiness Issues

| Issue | Impact |
|-------|--------|
| No test coverage reporting | Can't track regression |
| `isolate: false` in vitest config | Tests can affect each other |
| Reference tests excluded in CI | `isCI ? [...exclude reference...]` |
| Contract tests not in `npm test` | Must run `npm run test-contracts` separately |
| No platform matrix | Only runs on one OS |
| Guardrails not in main flow | Must run `npm run test-guardrails` separately |

---

## Task List

### Task 1: Fix Memory Leak Test Function Name Bug

**Files:**
- Modify: `test/stress/memory-leak.test.ts:53-287`

**Step 1: Write test to verify the bug exists** (2 min)

```bash
# Confirm the function doesn't exist
grep -n "function getHeapUsed" test/stress/memory-leak.test.ts
grep -n "getHeapUsed()" test/stress/memory-leak.test.ts
```

Expected: No definition found, but calls exist.

**Step 2: Fix all occurrences** (2 min)

Replace all `getHeapUsed()` with `getMemoryUsed()` (9 occurrences)

**Step 3: Run stress tests to verify fix** (2 min)

```bash
npx vitest run --config test/vitest.config.ts stress/
```

Expected: Tests now execute properly

**Step 4: Commit** (30 sec)

```bash
git add test/stress/memory-leak.test.ts
git commit -m "fix(test): use correct function name getMemoryUsed in leak tests"
```

---

### Task 2: Add Pixel Verification to Encode-Decode Integration Test

**Files:**
- Modify: `test/golden/integration/encode-decode.test.mjs`

**Step 1: Add helper for dominant color extraction** (3 min)

Add at top of file:
```javascript
/**
 * Extracts dominant color from VideoFrame by sampling center pixel
 * Returns {r, g, b} in 0-255 range
 */
async function getDominantColor(frame) {
  // Copy frame data to buffer
  const size = frame.allocationSize();
  const buffer = new Uint8Array(size);
  await frame.copyTo(buffer);

  // Sample center pixel (assumes I420 or similar YUV format after decode)
  // For simplicity, we'll check the Y plane luminance
  const centerOffset = Math.floor(frame.codedWidth * frame.codedHeight / 2 + frame.codedWidth / 2);
  const y = buffer[centerOffset];

  return { y, width: frame.codedWidth, height: frame.codedHeight };
}
```

**Step 2: Modify EncodeDecode test to verify pixels** (3 min)

```javascript
it('EncodeDecode', {timeout: 10_000}, async () => {
  // ... existing encode code ...

  // Decode and verify
  let decodedColor = null;
  const decoder = new VideoDecoder({
    output: async (decodedFrame) => {
      if (!decodedColor) {
        decodedColor = await getDominantColor(decodedFrame);
      }
      decodedFrame.close();
    },
    error: err => { throw err; },
  });

  // ... decode chunks ...

  await decoder.flush();
  decoder.close();

  // Verify: green frame should produce high Y value (bright)
  // Pure green (0, 255, 0) in YUV is approximately Y=150
  expect(decodedColor.y).toBeGreaterThan(100);
  expect(decodedColor.y).toBeLessThan(200);
});
```

**Step 3: Run integration tests** (2 min)

```bash
npx vitest run test/golden/integration/encode-decode.test.mjs
```

Expected: PASS with actual pixel verification

**Step 4: Commit** (30 sec)

```bash
git add test/golden/integration/encode-decode.test.mjs
git commit -m "test(integration): add pixel verification to encode-decode test"
```

---

### Task 3: Integrate Contract Tests into Main Test Flow

**Files:**
- Modify: `test/vitest.config.ts`
- Modify: `package.json`

**Step 1: Add contracts to vitest include pattern** (2 min)

In `test/vitest.config.ts`, change:
```typescript
include: isCI
  ? ['golden/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}']
  : ['golden/**/*.test.{ts,js,mjs}', 'reference/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}'],
```

The contracts are already included via `golden/contracts.test.ts` wrapper.

**Step 2: Update package.json test script** (2 min)

Change:
```json
"test": "npm run lint && npm run test-fast",
```

To:
```json
"test": "npm run lint && npm run test-fast && npm run test-guardrails",
```

**Step 3: Verify all tests run together** (5 min)

```bash
npm test
```

**Step 4: Commit** (30 sec)

```bash
git add test/vitest.config.ts package.json
git commit -m "ci(test): integrate guardrails into main test flow"
```

---

### Task 4: Add Test Fixtures Comparison Helper

**Files:**
- Create: `test/fixtures/assertions.ts`
- Modify: `test/fixtures/index.ts`

**Step 1: Create assertions module** (5 min)

```typescript
// test/fixtures/assertions.ts
/**
 * Video frame comparison utilities
 * Inspired by Sharp's assertSimilar pattern
 */

/**
 * Computes average pixel difference between two RGBA buffers
 * Returns 0 for identical, higher for more different
 */
export function computePixelDifference(
  buffer1: Uint8Array,
  buffer2: Uint8Array,
  width: number,
  height: number
): number {
  if (buffer1.length !== buffer2.length) {
    return Infinity;
  }

  let totalDiff = 0;
  const pixelCount = width * height;

  for (let i = 0; i < buffer1.length; i += 4) {
    // Compare RGB, ignore alpha
    totalDiff += Math.abs(buffer1[i] - buffer2[i]);     // R
    totalDiff += Math.abs(buffer1[i+1] - buffer2[i+1]); // G
    totalDiff += Math.abs(buffer1[i+2] - buffer2[i+2]); // B
  }

  // Return average difference per channel per pixel (0-255 scale)
  return totalDiff / (pixelCount * 3);
}

/**
 * Asserts two buffers are visually similar within threshold
 * @param expected Expected pixel buffer
 * @param actual Actual pixel buffer
 * @param width Frame width
 * @param height Frame height
 * @param threshold Maximum average difference (default 10 = ~4% of 255)
 */
export function assertSimilar(
  expected: Uint8Array,
  actual: Uint8Array,
  width: number,
  height: number,
  threshold: number = 10
): void {
  const diff = computePixelDifference(expected, actual, width, height);
  if (diff > threshold) {
    throw new Error(
      `Frame buffers differ by ${diff.toFixed(2)} (threshold: ${threshold}). ` +
      `Expected similar visual content.`
    );
  }
}
```

**Step 2: Export from index.ts** (1 min)

Add to `test/fixtures/index.ts`:
```typescript
export * from './assertions.js';
```

**Step 3: Write test for the assertion helper** (3 min)

Create `test/unit/assertions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computePixelDifference, assertSimilar, createRGBABuffer, colors } from '../fixtures/index.js';

describe('assertSimilar', () => {
  it('returns 0 for identical buffers', () => {
    const buf = createRGBABuffer(10, 10, colors.red);
    expect(computePixelDifference(buf, buf, 10, 10)).toBe(0);
  });

  it('returns high difference for opposite colors', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    const diff = computePixelDifference(red, blue, 10, 10);
    expect(diff).toBeGreaterThan(100); // Red vs Blue should be very different
  });

  it('throws when buffers differ beyond threshold', () => {
    const red = createRGBABuffer(10, 10, colors.red);
    const blue = createRGBABuffer(10, 10, colors.blue);
    expect(() => assertSimilar(red, blue, 10, 10, 10)).toThrow(/differ by/);
  });
});
```

**Step 4: Run tests** (1 min)

```bash
npx vitest run test/unit/assertions.test.ts
```

**Step 5: Commit** (30 sec)

```bash
git add test/fixtures/assertions.ts test/fixtures/index.ts test/unit/assertions.test.ts
git commit -m "test(fixtures): add assertSimilar helper for visual comparison"
```

---

### Task 5: Add Coverage Reporting

**Files:**
- Modify: `test/vitest.config.ts`
- Modify: `package.json`

**Step 1: Update vitest config for coverage thresholds** (2 min)

Coverage is already configured in vitest.config.ts. Enable it by default in CI:
```typescript
coverage: {
  enabled: process.env.CI === 'true',
  provider: 'v8',
  include: ['lib/**/*.ts'],
  exclude: ['lib/**/*.d.ts', 'lib/types.ts'],
  thresholds: {
    lines: 70,
    branches: 60,
    functions: 70,
    statements: 70,
  },
},
```

**Step 2: Add coverage command** (1 min)

Already exists: `"test-coverage": "vitest run --config test/vitest.config.ts --coverage"`

**Step 3: Run coverage report** (3 min)

```bash
npm run test-coverage
```

**Step 4: Commit** (30 sec)

```bash
git add test/vitest.config.ts
git commit -m "ci(coverage): enable coverage in CI environment"
```

---

### Task 6: Investigate and Document Reference Test Threading Issues

**Files:**
- Create: `docs/known-issues.md` (partial)

**Step 1: Isolate the failing test** (3 min)

```bash
npx vitest run test/reference/audio-encoder.test.ts --reporter=verbose
```

**Step 2: Check for pattern** (2 min)

The error `mutex lock failed: Invalid argument` typically indicates:
- Mutex destroyed while locked
- Double-free of mutex
- Race condition in cleanup

**Step 3: Document in known-issues** (3 min)

```markdown
# Known Issues

## Reference Test Threading Errors

**Status:** Under Investigation
**Affected:** reference/audio-encoder.test.ts, reference/audio-conversion.test.ts

**Symptoms:**
\`\`\`
libc++abi: terminating due to uncaught exception of type std::__1::system_error:
mutex lock failed: Invalid argument
\`\`\`

**Likely Cause:** Race condition in native NAPI code during FFmpeg resource cleanup.

**Workaround:** These tests are excluded from CI until fixed.

**Investigation Notes:**
- Occurs during rapid create/configure/close cycles
- May be related to ThreadSafeFunction cleanup timing
```

**Step 4: Commit** (30 sec)

```bash
git add docs/known-issues.md
git commit -m "docs: document reference test threading issues"
```

---

### Task 7: Code Review

**This is a meta-task - run code review agent after all other tasks complete.**

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 4 | Independent files, no overlap |
| Group 2 | 2 | Depends on fixtures from Group 1 |
| Group 3 | 3, 5 | Config files, sequential for safety |
| Group 4 | 6 | Documentation, independent |
| Group 5 | 7 | Final review after all changes |

---

## Recommendations for Open Source Release

### Must-Have Before Release

1. **Fix memory leak test bug** (Task 1) - Tests currently broken
2. **Add pixel verification** (Task 2) - Encode/decode tests prove nothing currently
3. **Integrate all tests into CI** (Task 3) - Guardrails/contracts should run automatically

### Should-Have

4. **Visual comparison helpers** (Task 4) - Follows Sharp pattern
5. **Coverage reporting** (Task 5) - Track quality over time
6. **Document known issues** (Task 6) - Transparency for users

### Nice-to-Have (Future)

- Valgrind-based leak detection script (like Sharp)
- Multi-platform CI matrix
- Test fixture parity with Sharp (more real media files)
- Benchmark comparison CI step

---

## Files Changed Summary

| File | Change Type |
|------|-------------|
| `test/stress/memory-leak.test.ts` | Bug fix |
| `test/golden/integration/encode-decode.test.mjs` | Add assertions |
| `test/vitest.config.ts` | CI config |
| `package.json` | Script updates |
| `test/fixtures/assertions.ts` | New file |
| `test/fixtures/index.ts` | Export addition |
| `test/unit/assertions.test.ts` | New test |
| `docs/known-issues.md` | New documentation |

---

## Conclusion

Your test suite is **production-ready but not open-source-mature**. The contract tests and guardrails show good engineering judgment, but they're disconnected from the main test flow and some tests pass without actually verifying correctness.

**For open source release:**
1. Fix the memory leak test function name bug (critical)
2. Add pixel verification to integration tests (critical)
3. Integrate guardrails into main test flow (important)
4. Add coverage reporting (important)
5. Document known threading issues (transparency)
