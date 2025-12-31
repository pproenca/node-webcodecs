# Hard Circuit Breaker Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-hard-circuit-breaker.md` to implement task-by-task.

**Goal:** Implement a hard circuit breaker in VideoEncoder that throws `QuotaExceededError` when the encode queue exceeds a hard limit, preventing OOM crashes when consumers ignore backpressure signals.

**Architecture:** Add `kMaxHardQueueSize` constant (64 frames) to VideoEncoder. Before enqueuing frames in `Encode()`, check against this limit and throw `QuotaExceededError` if exceeded. This converts catastrophic OOM crashes into handleable exceptions that force consumers to implement proper backpressure handling.

**Tech Stack:** C++17 (NAPI), FFmpeg, Vitest, Node.js

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Header + implementation are tightly coupled |
| Group 2 | 3 | Independent test config change |
| Group 3 | 4 | Code Review |

---

### Task 1: Add kMaxHardQueueSize Constant to VideoEncoder Header

**Files:**
- Modify: `src/video_encoder.h:86-89`

**Step 1: Read current header state** (30 sec)

Verify the current state of the header file around line 86.

```bash
head -100 src/video_encoder.h | tail -20
```

**Step 2: Add kMaxHardQueueSize constant** (2-5 min)

Add the hard limit constant after the existing `kMaxQueueSize`. Edit `src/video_encoder.h` to add after line 86:

```cpp
  static constexpr size_t kMaxQueueSize = 16;  // Saturation threshold

  // HARD LIMIT: The "Circuit Breaker".
  // If the user ignores backpressure signals and keeps pushing frames,
  // we reject requests to prevent OOM.
  // 64 frames @ 4K RGBA (3840x2160x4) is ~2GB of RAM.
  static constexpr size_t kMaxHardQueueSize = 64;
```

**Step 3: Verify header compiles** (30 sec)

```bash
npm run build:native 2>&1 | head -50
```

Expected: Build succeeds (or only unrelated warnings)

**Step 4: Commit** (30 sec)

```bash
git add src/video_encoder.h
git commit -m "$(cat <<'EOF'
feat(encoder): add kMaxHardQueueSize constant for circuit breaker

Add hard limit (64 frames) to VideoEncoder that will be enforced in
Encode() to prevent OOM when consumers ignore backpressure signals.
At 4K RGBA, 64 frames is ~2GB - a reasonable safety valve.
EOF
)"
```

---

### Task 2: Implement QuotaExceededError Check in Encode()

**Files:**
- Modify: `src/video_encoder.cc:474-485` (inside Encode method, before VideoFrame unwrap)

**Step 1: Write the failing test** (2-5 min)

Create test file `test/golden/circuit-breaker.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('VideoEncoder Circuit Breaker', () => {
  let encoder: InstanceType<typeof globalThis.VideoEncoder>;
  const chunks: unknown[] = [];

  beforeEach(() => {
    chunks.length = 0;
    encoder = new globalThis.VideoEncoder({
      output: (chunk: unknown) => chunks.push(chunk),
      error: (e: Error) => { throw e; },
    });
    encoder.configure({
      codec: 'avc1.42001E',
      width: 64,
      height: 64,
      bitrate: 100000,
    });
  });

  afterEach(() => {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  });

  it('should throw QuotaExceededError when queue exceeds hard limit', () => {
    // Hard limit is 64 frames. Flood the encoder without flushing.
    const buf = Buffer.alloc(64 * 64 * 4); // Small frame to avoid actual OOM

    let thrownError: Error | null = null;

    // Try to enqueue 100 frames (more than the 64 limit)
    for (let i = 0; i < 100; i++) {
      try {
        const frame = new globalThis.VideoFrame(buf, {
          codedWidth: 64,
          codedHeight: 64,
          timestamp: i * 33000,
        });
        encoder.encode(frame);
        frame.close();
      } catch (e) {
        thrownError = e as Error;
        break;
      }
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toContain('QuotaExceededError');
    expect(thrownError!.message).toContain('backpressure');
  });

  it('should allow encoding after queue drains', async () => {
    const buf = Buffer.alloc(64 * 64 * 4);

    // Fill queue to near limit
    for (let i = 0; i < 60; i++) {
      const frame = new globalThis.VideoFrame(buf, {
        codedWidth: 64,
        codedHeight: 64,
        timestamp: i * 33000,
      });
      encoder.encode(frame);
      frame.close();
    }

    // Flush to drain queue
    await encoder.flush();

    // Should be able to encode again
    const frame = new globalThis.VideoFrame(buf, {
      codedWidth: 64,
      codedHeight: 64,
      timestamp: 60 * 33000,
    });

    expect(() => encoder.encode(frame)).not.toThrow();
    frame.close();

    await encoder.flush();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/circuit-breaker.test.ts -t "should throw QuotaExceededError" 2>&1
```

Expected: FAIL - currently no QuotaExceededError is thrown, the test will either timeout or pass without error (indicating the missing feature)

**Step 3: Implement the hard limit check** (2-5 min)

Edit `src/video_encoder.cc` in the `Encode()` method. Add the check after the state check (around line 477) and before unwrapping the VideoFrame:

Find this code block (approximately lines 474-485):

```cpp
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "Encoder not configured");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "encode requires VideoFrame");
  }
```

Insert the hard limit check after the state check:

```cpp
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    throw Napi::Error::New(env, "Encoder not configured");
  }

  // SAFETY VALVE: Reject if queue is too large.
  // This prevents OOM if the consumer ignores backpressure.
  if (encode_queue_size_ >= static_cast<int>(kMaxHardQueueSize)) {
    throw Napi::Error::New(
        env,
        "QuotaExceededError: Encode queue is full. You must handle backpressure "
        "by waiting for encodeQueueSize to decrease.");
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::Error::New(env, "encode requires VideoFrame");
  }
```

**Step 4: Rebuild native addon** (30 sec)

```bash
npm run build:native 2>&1 | tail -10
```

Expected: Build succeeds

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/circuit-breaker.test.ts 2>&1
```

Expected: PASS (2 passed)

**Step 6: Run existing encoder tests to verify no regression** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts 2>&1 | tail -20
```

Expected: All existing tests pass

**Step 7: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/circuit-breaker.test.ts
git commit -m "$(cat <<'EOF'
feat(encoder): implement hard circuit breaker with QuotaExceededError

Add safety valve in Encode() that throws QuotaExceededError when the
internal queue exceeds kMaxHardQueueSize (64 frames). This prevents
OOM crashes when consumers ignore backpressure signals (codecSaturated).

The error message instructs users to handle backpressure by waiting
for encodeQueueSize to decrease before calling encode() again.
EOF
)"
```

---

### Task 3: Enable Test Isolation in Vitest Config

**Files:**
- Modify: `test/vitest.config.ts:16`

**Step 1: Update isolate setting** (2-5 min)

Edit `test/vitest.config.ts` line 16, change:

```typescript
isolate: false,
```

to:

```typescript
// Fix: Enable isolation to prevent tests from interfering with each other
// caused by shared global state in test/setup.ts
isolate: true,
```

**Step 2: Run tests to verify isolation works** (30 sec)

```bash
npm run test-fast 2>&1 | tail -30
```

Expected: All tests pass (may be slower due to isolation overhead)

**Step 3: Commit** (30 sec)

```bash
git add test/vitest.config.ts
git commit -m "$(cat <<'EOF'
test: enable test isolation to prevent state leakage

Set isolate: true in vitest config to run each test file in its own
environment. This prevents tests from interfering with each other
through shared global state injected by test/setup.ts.
EOF
)"
```

---

### Task 4: Code Review

**Files:**
- Review: All files modified in Tasks 1-3

**Step 1: Review changes** (2-5 min)

```bash
git diff HEAD~3..HEAD --stat
git log --oneline -3
```

**Step 2: Run full test suite** (2-5 min)

```bash
npm test 2>&1 | tail -50
```

Expected: All tests pass including lint, fast tests, and guardrails

**Step 3: Verify memory sentinel passes** (30 sec)

```bash
node --expose-gc test/guardrails/memory_sentinel.js 2>&1
```

Expected: SUCCESS: Memory stable.

---

## Verification Checklist

After all tasks complete:

- [ ] `kMaxHardQueueSize = 64` constant exists in `src/video_encoder.h`
- [ ] `QuotaExceededError` thrown when `encode_queue_size_ >= kMaxHardQueueSize`
- [ ] New test file `test/golden/circuit-breaker.test.ts` validates behavior
- [ ] `isolate: true` set in `test/vitest.config.ts`
- [ ] All existing tests pass
- [ ] Memory sentinel passes without OOM
