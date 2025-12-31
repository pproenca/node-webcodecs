# Test Reliability Fixes Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-test-reliability-fixes.md` to implement task-by-task.

**Goal:** Fix three critical issues causing test unreliability: memory sentinel false positives due to unbounded queue growth, and TSFN teardown crashes due to missing null checks.

**Architecture:** The memory sentinel fix adds periodic `flush()` calls during encoding to prevent unbounded queue growth. The C++ fixes add `env == nullptr` guards to all TSFN callbacks to prevent crashes during Node.js environment teardown. Both are minimal, surgical changes.

**Tech Stack:** JavaScript (memory sentinel), C++ NAPI (async workers)

**Note on Test Isolation:** The current `isolate: false` setting in `vitest.config.ts` is **intentional** for native addon testing. Spawning multiple V8 isolates with FFmpeg's global state and NAPI thread-local storage causes more problems than shared state. This plan does NOT change that setting.

---

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Independent files: memory_sentinel.js and async_encode_worker.cc |
| Group 2 | 3 | Depends on understanding encode worker pattern |
| Group 3 | 4 | Verification requires all fixes |

---

### Task 1: Fix Memory Sentinel Unbounded Queue Growth

**Files:**
- Modify: `test/guardrails/memory_sentinel.js:25-41`

**Problem:** The memory sentinel encodes 10,000 frames without periodic flush, creating an unbounded queue (~1.2GB for 640x480 RGBA frames) that triggers the 50MB memory growth limit before encoding even completes.

**Step 1: Add FLUSH_INTERVAL constant** (2 min)

Add a constant after line 4 in `test/guardrails/memory_sentinel.js`:

```javascript
const LIMIT_MB = 50;
const FRAMES = 10000;
const FLUSH_INTERVAL = 100; // Flush every 100 frames to prevent unbounded queue growth
```

**Step 2: Add periodic flush inside the encoding loop** (2 min)

After `frame.close();` (line 33), add the flush logic:

```javascript
    encoder.encode(frame);
    frame.close();

    // Prevent unbounded queue growth by flushing periodically
    // Without this, the async worker queue grows to FRAMES size, causing huge memory usage
    // that looks like a leak but is just buffered data.
    if (i % FLUSH_INTERVAL === 0) {
      await encoder.flush();
    }
```

**Step 3: Add encoder.close() after final flush** (1 min)

After the final `await encoder.flush();` (line 43), add:

```javascript
  await encoder.flush();
  encoder.close();

  if (global.gc) global.gc();
```

**Step 4: Run memory sentinel to verify it passes** (30 sec)

```bash
node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: `SUCCESS: Memory stable.` (growth should be well under 50MB now)

**Step 5: Commit** (30 sec)

```bash
git add test/guardrails/memory_sentinel.js
git commit -m "fix(test): add periodic flush to memory sentinel to prevent queue growth"
```

---

### Task 2: Add env == nullptr Check to Async Encode Worker

**Files:**
- Modify: `src/async_encode_worker.cc:208-214` (error callback)
- Modify: `src/async_encode_worker.cc:271-342` (output callback)

**Problem:** TSFN callbacks don't check if `env == nullptr` during environment teardown, causing crashes when trying to create NAPI objects with an invalid environment.

**Step 1: Fix the error callback in ProcessFrame** (3 min)

In `src/async_encode_worker.cc`, find the error callback at lines 208-214 and add the null check:

**Current code:**
```cpp
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
```

**Replace with:**
```cpp
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          // If env is null, TSFN is closing during teardown. Just cleanup.
          if (env == nullptr) {
            delete msg;
            return;
          }
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
```

**Step 2: Fix the output callback in EmitChunk** (5 min)

In `src/async_encode_worker.cc`, find the output callback at lines 271-342. Add null check at the start of the lambda:

**Find this code (lines 271-276):**
```cpp
  output_tsfn_.NonBlockingCall(cb_data, [](Napi::Env env, Napi::Function fn,
                                           ChunkCallbackData* info) {
    // Decrement pending count before any operations
    info->pending->fetch_sub(1);
    webcodecs::counterQueue--;  // Decrement global queue counter
```

**Replace with:**
```cpp
  output_tsfn_.NonBlockingCall(cb_data, [](Napi::Env env, Napi::Function fn,
                                           ChunkCallbackData* info) {
    // CRITICAL: If env is null, the TSFN is being destroyed (environment teardown).
    // Must still clean up data and counters, then return to avoid crashing.
    if (env == nullptr) {
      info->pending->fetch_sub(1);
      delete info;
      return;
    }

    // Decrement pending count before any operations
    info->pending->fetch_sub(1);
    webcodecs::counterQueue--;  // Decrement global queue counter
```

**Step 3: Build the native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors

**Step 4: Run tests to verify no crashes** (30 sec)

```bash
npm run test-fast
```

Expected: All tests pass without segfaults

**Step 5: Commit** (30 sec)

```bash
git add src/async_encode_worker.cc
git commit -m "fix(native): add env nullptr checks to encode worker TSFN callbacks"
```

---

### Task 3: Add env == nullptr Check to Async Decode Worker

**Files:**
- Modify: `src/async_decode_worker.cc:200-206` (error callback in ProcessPacket)
- Modify: `src/async_decode_worker.cc:231-237` (error callback in EmitFrame)
- Modify: `src/async_decode_worker.cc:298-331` (output callback in EmitFrame)

**Problem:** Same as Task 2 - TSFN callbacks don't guard against null env during teardown.

**Step 1: Fix the error callback in ProcessPacket** (3 min)

In `src/async_decode_worker.cc`, find the error callback at lines 200-206:

**Current code:**
```cpp
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
```

**Replace with:**
```cpp
    error_tsfn_.NonBlockingCall(
        new std::string(error_msg),
        [](Napi::Env env, Napi::Function fn, std::string* msg) {
          // If env is null, TSFN is closing during teardown. Just cleanup.
          if (env == nullptr) {
            delete msg;
            return;
          }
          fn.Call({Napi::Error::New(env, *msg).Value()});
          delete msg;
        });
```

**Step 2: Fix the error callback in EmitFrame** (3 min)

In `src/async_decode_worker.cc`, find the error callback at lines 231-237:

**Current code:**
```cpp
      error_tsfn_.NonBlockingCall(
          new std::string(error_msg),
          [](Napi::Env env, Napi::Function fn, std::string* msg) {
            fn.Call({Napi::Error::New(env, *msg).Value()});
            delete msg;
          });
```

**Replace with:**
```cpp
      error_tsfn_.NonBlockingCall(
          new std::string(error_msg),
          [](Napi::Env env, Napi::Function fn, std::string* msg) {
            // If env is null, TSFN is closing during teardown. Just cleanup.
            if (env == nullptr) {
              delete msg;
              return;
            }
            fn.Call({Napi::Error::New(env, *msg).Value()});
            delete msg;
          });
```

**Step 3: Fix the output callback in EmitFrame** (5 min)

In `src/async_decode_worker.cc`, find the output callback at lines 298-331. Add null check at the start of the lambda body:

**Find this code (lines 298-306):**
```cpp
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [pending_counter, width, height, timestamp, rotation, flip, disp_width,
       disp_height, color_primaries, color_transfer, color_matrix,
       color_full_range,
       has_color_space](Napi::Env env, Napi::Function fn,
                        std::vector<uint8_t>* data) {
        // Always clean up, even if callback throws
        try {
```

**Replace with:**
```cpp
  output_tsfn_.NonBlockingCall(
      rgba_data,
      [pending_counter, width, height, timestamp, rotation, flip, disp_width,
       disp_height, color_primaries, color_transfer, color_matrix,
       color_full_range,
       has_color_space](Napi::Env env, Napi::Function fn,
                        std::vector<uint8_t>* data) {
        // CRITICAL: If env is null, TSFN is closing during teardown.
        // Must still clean up data and counters, then return.
        if (env == nullptr) {
          delete data;
          (*pending_counter)--;
          return;
        }

        // Always clean up, even if callback throws
        try {
```

**Step 4: Build the native addon** (30 sec)

```bash
npm run build:native
```

Expected: Build succeeds with no errors

**Step 5: Run full test suite** (1 min)

```bash
npm run test-fast
```

Expected: All tests pass without segfaults

**Step 6: Commit** (30 sec)

```bash
git add src/async_decode_worker.cc
git commit -m "fix(native): add env nullptr checks to decode worker TSFN callbacks"
```

---

### Task 4: Verify All Fixes Together

**Files:**
- None (verification only)

**Step 1: Run memory sentinel** (30 sec)

```bash
node --expose-gc test/guardrails/memory_sentinel.js
```

Expected: `SUCCESS: Memory stable.`

**Step 2: Run full guardrails suite** (1 min)

```bash
npm run test-guardrails
```

Expected: All guardrail tests pass

**Step 3: Run full test suite** (2 min)

```bash
npm run test-all
```

Expected: All tests pass

**Step 4: Commit final verification** (30 sec)

No code changes needed. If all tests pass, the fixes are complete.

---

### Task 5: Code Review

Dispatch code-reviewer agent to review all changes:

```bash
git diff HEAD~3..HEAD
```

Review focus:
1. Memory cleanup paths in TSFN callbacks are complete
2. Counter decrements happen on all code paths
3. No new memory leaks introduced
4. Error handling is correct

---

## Summary of Changes

| File | Change |
|------|--------|
| `test/guardrails/memory_sentinel.js` | Add periodic `flush()` every 100 frames + `encoder.close()` |
| `src/async_encode_worker.cc` | Add `env == nullptr` checks to 2 TSFN callbacks |
| `src/async_decode_worker.cc` | Add `env == nullptr` checks to 3 TSFN callbacks |
