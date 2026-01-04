# N-API Compliance Audit: WebCodecs Async Flow

## Executive Summary

This audit examines the async flow from JavaScript → C++ → FFmpeg against Node.js N-API guidelines for thread-safe functions, libuv event loop integration, and Promise handling.

**Status**: ✅ Generally solid architecture, but **5 critical P0 issues** identified that can cause memory leaks, promise hangs, and crashes.

## Critical Issues Requiring Immediate Attention (P0)

### 1. Exception Safety in TSFN Callbacks - Memory Leaks

**Location**: `src/video_encoder.cc:215`, `src/video_encoder.cc:228`, `src/async_encode_worker.cc:389`

**Issue**: `fn.Call()` can throw exceptions. If it does, the `delete data;` statement won't execute, causing memory leaks.

```cpp
// CURRENT CODE (UNSAFE):
fn.Call({chunk, metadata});
delete data;  // Skipped if fn.Call() throws!
```

**N-API Requirement Violated**: Thread-safe function callbacks must free data in ALL code paths, including exceptions.

**Impact**:
- Accumulating memory leaks if user's output callback throws
- Production crash after memory exhaustion
- Severity: HIGH, Likelihood: MEDIUM

**Remediation**:
```cpp
// SAFE PATTERN:
try {
  fn.Call({chunk, metadata});
} catch (...) {
  // Log error but don't propagate to N-API layer
}
delete data;  // Always executes
```

**Files to Modify**:
- `src/video_encoder.cc` (3 TSFN callbacks: OnOutputTSFN, OnErrorTSFN, OnFlushTSFN)
- `src/video_decoder.cc` (equivalent callbacks)
- `src/audio_encoder.cc` (if exists)
- `src/audio_decoder.cc` (if exists)
- `src/async_encode_worker.cc:389`
- `src/async_decode_worker.cc` (equivalent location)

---

### 2. Promise Orphaning on Environment Teardown

**Location**: `src/video_encoder.cc:236-238`, `src/video_encoder.cc:138-140`

**Issue**: When `env == nullptr` (environment teardown), the promise is never settled. User's `await flush()` hangs forever.

```cpp
// CURRENT CODE:
void VideoEncoder::OnFlushTSFN(Napi::Env env, Napi::Function,
                               VideoEncoder* ctx,
                               FlushCompleteData* data) {
  if (env == nullptr) {
    delete data;
    return;  // Promise never settled!
  }
  // ... resolve/reject promise
}
```

**N-API Requirement Violated**: Every deferred promise must be settled exactly once.

**Impact**:
- User's `await flush()` hangs forever during process shutdown
- Test suite hangs on cleanup
- Severity: CRITICAL, Likelihood: MEDIUM (happens during cleanup)

**Remediation**:
```cpp
if (env == nullptr) {
  // Reject all pending promises with shutdown error
  std::lock_guard<std::mutex> lock(ctx->flush_promise_mutex_);
  auto it = ctx->pending_flush_promises_.find(data->promise_id);
  if (it != ctx->pending_flush_promises_.end()) {
    // Can't use Napi::Error without env, but we can reject with string
    // Actually, we CAN'T reject without env. Document this limitation.
    ctx->pending_flush_promises_.erase(it);
  }
  delete data;
  return;
}
```

**Better Solution**: Add cleanup hook to reject all pending promises BEFORE environment teardown.

**Files to Modify**:
- `src/video_encoder.cc` (OnFlushTSFN + Cleanup method)
- `src/video_decoder.cc` (equivalent)
- `src/addon.cc` (add cleanup hook)

---

### 3. TSFN Release Timing - Race Condition

**Location**: `src/video_encoder.cc:117-128`

**Issue**: 100ms timeout is arbitrary. Releasing TSFN while callbacks are queued is undefined behavior per N-API docs.

```cpp
// CURRENT CODE:
auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(100);
while (worker_->GetPendingChunks() > 0 &&
       std::chrono::steady_clock::now() < deadline) {
  std::this_thread::sleep_for(std::chrono::milliseconds(1));
}

// Release TSFNs (might still have queued callbacks!)
output_tsfn_.Release();
error_tsfn_.Release();
flush_tsfn_.Release();
```

**N-API Requirement Violated**: Must ensure TSFN queue is empty before calling `napi_release_threadsafe_function`.

**Impact**:
- Undefined behavior if TSFN released with pending callbacks
- Potential crash or memory corruption
- Severity: CRITICAL, Likelihood: HIGH (100ms often insufficient)

**Remediation**:
```cpp
// Wait indefinitely for pending callbacks to complete
while (worker_->GetPendingChunks() > 0) {
  std::this_thread::sleep_for(std::chrono::milliseconds(1));
}

// Add assertion to verify
assert(worker_->GetPendingChunks() == 0 && "TSFN queue must be empty before Release");

output_tsfn_.Release();
// ...
```

**Alternative**: Use a condition variable signaled by TSFN callbacks instead of polling.

**Files to Modify**:
- `src/video_encoder.cc` (Cleanup method)
- `src/video_decoder.cc` (equivalent)
- `src/audio_encoder.cc` (if exists)
- `src/audio_decoder.cc` (if exists)

---

### 4. Wrong Promise Returned on Enqueue Failure

**Location**: `src/video_encoder.cc:598`

**Issue**: Returns a NEW resolved promise instead of the ORIGINAL rejected promise.

```cpp
// CURRENT CODE:
if (!control_queue_->Enqueue(std::move(msg))) {
  std::lock_guard<std::mutex> lock(flush_promise_mutex_);
  auto it = pending_flush_promises_.find(promise_id);
  if (it != pending_flush_promises_.end()) {
    it->second.Reject(Napi::Error::New(env, "Failed to enqueue flush").Value());
    pending_flush_promises_.erase(it);  // ERASED!
  }
  return Napi::Promise::Deferred::New(env).Promise();  // Wrong promise!
}
```

**N-API Requirement Violated**: Must return the same promise that was created.

**Impact**:
- User gets a resolved promise even though flush failed
- Silent failure, incorrect program behavior
- Severity: CRITICAL, Likelihood: LOW (queue rarely full)

**Remediation**:
```cpp
if (!control_queue_->Enqueue(std::move(msg))) {
  std::lock_guard<std::mutex> lock(flush_promise_mutex_);
  auto it = pending_flush_promises_.find(promise_id);
  if (it != pending_flush_promises_.end()) {
    napi_value promise = it->second.Promise();  // Get promise BEFORE erase
    it->second.Reject(Napi::Error::New(env, "Failed to enqueue flush").Value());
    pending_flush_promises_.erase(it);
    return promise;  // Return the CORRECT promise
  }
}
// Fallback (should never happen)
Napi::Promise::Deferred fallback = Napi::Promise::Deferred::New(env);
fallback.Reject(Napi::Error::New(env, "Internal error").Value());
return fallback.Promise();
```

**Files to Modify**:
- `src/video_encoder.cc` (Flush method, lines 591-599)
- `src/video_decoder.cc` (equivalent method)

---

### 5. No Cleanup Hook for Environment Teardown

**Location**: `src/addon.cc` (missing implementation)

**Issue**: No `napi_add_env_cleanup_hook` to stop workers before environment teardown.

**N-API Requirement Violated**: Addons must clean up resources when environment is torn down.

**Impact**:
- Worker threads may access destroyed environment
- Segfault during `process.exit()` or worker thread termination
- Severity: CRITICAL, Likelihood: LOW (only during abnormal shutdown)

**Remediation**:
```cpp
// In addon.cc
static std::vector<VideoEncoder*> active_encoders;
static std::mutex active_encoders_mutex;

static void CleanupHook(void* arg) {
  std::lock_guard<std::mutex> lock(active_encoders_mutex);
  for (auto* encoder : active_encoders) {
    encoder->Cleanup();
  }
  active_encoders.clear();
}

// In Init function
napi_add_env_cleanup_hook(env, CleanupHook, nullptr);

// In VideoEncoder constructor
{
  std::lock_guard<std::mutex> lock(active_encoders_mutex);
  active_encoders.push_back(this);
}

// In VideoEncoder destructor
{
  std::lock_guard<std::mutex> lock(active_encoders_mutex);
  active_encoders.erase(
    std::remove(active_encoders.begin(), active_encoders.end(), this),
    active_encoders.end()
  );
}
```

**Files to Modify**:
- `src/addon.cc` (add cleanup hook registration)
- All codec classes (register/unregister in constructor/destructor)

---

## Architecture Assessment

### ✅ Strengths

1. **Thread Isolation**: AVCodecContext owned exclusively by worker thread - no mutex needed for codec ops
2. **RAII Coverage**: All FFmpeg resources use smart pointers (ffmpeg_raii.h)
3. **Message Queue**: Thread-safe FIFO with timeout-based dequeue for graceful shutdown
4. **SafeThreadSafeFunction Wrapper**: Prevents calls after Release() with mutex protection
5. **Null Environment Checks**: 3 out of 4 TSFN callbacks check for env == nullptr (OnErrorTSFN missing)
6. **NonBlocking TSFN Calls**: Uses NonBlockingCall by default, avoiding deadlocks
7. **Shutdown Race Protection**: codec_valid_ flag + stop_mutex_ prevents access during shutdown

### ⚠️ Concerns

1. **No Explicit Acquire/Release for Worker Threads**: Uses node-addon-api's automatic reference counting, but unclear if compliant
2. **Polling-Based Backpressure**: TypeScript layer polls with setTimeout(1) - could use TSFN for notifications instead
3. **No ThreadSanitizer/Valgrind in CI**: Missing automated detection of threading issues
4. **Two Worker Patterns**: Legacy AsyncWorker vs Modern CodecWorker - should consolidate
5. **100ms Arbitrary Timeout**: Multiple locations assume 100ms is sufficient for cleanup

---

## Verification Testing Plan

### Phase 1: Automated Tools (2-3 hours)

```bash
# Memory leak detection
valgrind --leak-check=full --show-leak-kinds=all npm test

# Address sanitizer (requires rebuild)
CFLAGS="-fsanitize=address" CXXFLAGS="-fsanitize=address" npm run build
npm test

# Thread sanitizer (requires rebuild)
CFLAGS="-fsanitize=thread" CXXFLAGS="-fsanitize=thread" npm run build
npm test

# Leak sanitizer
ASAN_OPTIONS=detect_leaks=1 npm test
```

### Phase 2: Stress Testing (3-4 hours)

```typescript
// Test 1: Rapid create/destroy cycles
for (let i = 0; i < 10000; i++) {
  const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
  encoder.configure({ codec: 'vp8', width: 640, height: 480 });
  encoder.close();
}

// Test 2: Exception in output callback
const encoder = new VideoEncoder({
  output: (chunk) => { throw new Error("User error"); },
  error: () => {}
});
// Verify no memory leaks

// Test 3: process.exit() during encode
const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
encoder.encode(frame);
process.exit(0);  // Should not segfault

// Test 4: Flush timeout
const encoder = new VideoEncoder({
  output: () => { while(true) {} },  // Block forever
  error: () => {}
});
await encoder.flush();  // Should timeout gracefully

// Test 5: Multiple concurrent encoders
const encoders = Array.from({length: 100}, () => new VideoEncoder(...));
// Encode in parallel, verify no race conditions
```

### Phase 3: Manual Code Review Checklist

- [ ] All TSFN callbacks have try/catch around fn.Call()
- [ ] All TSFN callbacks delete data in all code paths
- [ ] All TSFN callbacks check env == nullptr
- [ ] All promises settled exactly once
- [ ] No N-API calls from worker threads (except TSFN)
- [ ] Cleanup hooks registered for all codecs
- [ ] No arbitrary timeouts in critical paths
- [ ] All mutex lock orders documented to prevent deadlocks

---

## Critical Files Reference

### Must Modify (P0 Issues)

- `src/video_encoder.cc` - Lines 107-143 (Cleanup), 145-256 (TSFN callbacks), 562-615 (Flush)
- `src/video_decoder.cc` - Equivalent locations
- `src/audio_encoder.cc` - If exists
- `src/audio_decoder.cc` - If exists
- `src/async_encode_worker.cc` - Line 389 (TSFN callback)
- `src/async_decode_worker.cc` - Equivalent location
- `src/addon.cc` - Add cleanup hooks
- `src/shared/safe_tsfn.h` - Consider queue drain verification

### Review (Architecture)

- `src/shared/codec_worker.h` - Template worker pattern
- `src/shared/control_message_queue.h` - Thread-safe queue
- `src/ffmpeg_raii.h` - RAII wrappers

### TypeScript Layer (Lower Priority)

- `lib/video-encoder.ts` - Polling-based backpressure
- `lib/video-decoder.ts` - Equivalent
- `lib/control-message-queue.ts` - Queue management

---

## Estimated Remediation Effort

| Issue | Priority | Effort | Risk |
|-------|----------|--------|------|
| P0-1: Exception safety | CRITICAL | 4h | Low |
| P0-2: Promise orphaning | CRITICAL | 6h | Medium |
| P0-3: TSFN release timing | CRITICAL | 8h | High |
| P0-4: Wrong promise | CRITICAL | 1h | Low |
| P0-5: Cleanup hooks | CRITICAL | 4h | Medium |
| **Total P0** | - | **23h** | - |
| Testing & validation | - | 10h | - |
| Documentation | - | 3h | - |
| **Grand Total** | - | **36h** | - |

---

## Recommendations

### Immediate Actions (This Sprint)

1. Fix P0-1 (Exception safety) - Highest ROI, lowest risk
2. Fix P0-4 (Wrong promise) - Quick win, low risk
3. Add automated testing (valgrind, ASAN) to CI

### Short Term (Next Sprint)

4. Fix P0-3 (TSFN release timing) - Requires careful testing
5. Fix P0-2 (Promise orphaning) + P0-5 (Cleanup hooks) together
6. Add comprehensive stress tests

### Long Term (Next Quarter)

7. Consolidate worker patterns (eliminate legacy AsyncWorker)
8. Replace polling with event-driven backpressure
9. Add ThreadSanitizer to CI
10. Document N-API patterns in CLAUDE.md

---

## N-API Compliance Scorecard

| Category | Status | Notes |
|----------|--------|-------|
| Thread-Safe Functions | ⚠️ MOSTLY | Missing exception safety, release timing issues |
| libuv Event Loop | ✅ COMPLIANT | Proper thread isolation, no main thread blocking |
| Promise Handling | ⚠️ ISSUES | Orphaned promises on teardown, wrong promise returned |
| Resource Management | ✅ EXCELLENT | RAII throughout, clean TSFN wrapper |
| Shutdown Safety | ⚠️ ISSUES | 100ms timeout arbitrary, no cleanup hooks |
| Memory Safety | ⚠️ LEAKS | Exception paths leak data |

**Overall Assessment**: 70% compliant. Excellent architecture with critical bugs in edge cases.
