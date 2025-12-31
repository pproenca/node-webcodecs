# Known Issues

## Reference Test Threading Errors

**Status:** Under Investigation
**Affected:** reference/audio-encoder.test.ts, reference/audio-conversion.test.ts

**Symptoms:**
```
libc++abi: terminating due to uncaught exception of type std::__1::system_error:
mutex lock failed: Invalid argument
```

**Likely Cause:** Race condition in native NAPI code during FFmpeg resource cleanup.

**Workaround:** These tests are excluded from CI until fixed.

**Investigation Notes:**
- Occurs during rapid create/configure/close cycles
- May be related to ThreadSafeFunction cleanup timing
- The native async workers use multiple mutexes (`queue_mutex_`, `codec_mutex_`, `pool_mutex_`) for thread synchronization
- ThreadSafeFunctions are used for async callbacks between worker threads and the main JS thread
- Potential issue: mutex may be destroyed while another thread is waiting on it, or ThreadSafeFunction may be released before all pending calls complete

**Technical Context:**
- `src/async_encode_worker.cc` and `src/async_decode_worker.cc` manage background encoding/decoding
- Multiple `std::mutex` instances protect shared state
- `Napi::ThreadSafeFunction` bridges worker threads to JS callbacks
- Cleanup sequence during `close()` may not properly synchronize all threads

**CI Configuration:**
Reference tests are excluded from CI via `test/vitest.config.ts`:
```typescript
include: isCI
  ? ['golden/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}']
  : ['golden/**/*.test.{ts,js,mjs}', 'reference/**/*.test.{ts,js,mjs}', 'unit/**/*.test.{ts,js,mjs}'],
```
