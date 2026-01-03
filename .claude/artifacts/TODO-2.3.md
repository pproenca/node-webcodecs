# Task Packet: TODO-2.3

> **Feature:** WebCodecs Spec Compliance - Codec Work Parallel Queue
> **Assigned to:** Subagent 2.3
> **Priority:** 1
> **Estimated complexity:** HIGH

## Objective
Verify that the parallel work queue pattern (separate from control message queue) is correctly implemented for async codec operations per W3C spec section 2.3.

## Scope

### Files In Scope
- `lib/codec-base.ts` - Parallel queue usage
- `src/async_encode_worker.cc` - Native async worker
- `src/async_decode_worker.cc` - Native async worker
- `test/stress/` - Stress tests for parallelism

### Files Out of Scope (DO NOT MODIFY)
- `lib/muxer.ts` - Non-spec extension
- `lib/demuxer.ts` - Non-spec extension

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 2.3:
// - [[codec work queue]] is a parallel queue
// - [[codec implementation]] accessed only from work queue
// - Tasks queued back to event loop use codec task source
```

### Outputs You Must Provide
```typescript
// Verify parallel processing:
// 1. codec implementation runs on background thread
// 2. callbacks invoked on main thread (event loop)
// 3. concurrent encode/decode operations handled safely

// AsyncWorker in C++ provides this via:
// - Execute() runs on worker thread
// - OnOK()/OnError() run on main thread via TSFN
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify worker thread isolation (no main thread blocking)
- Verify callbacks on main thread
- Verify thread-safe resource handling

### DO NOT
- Access AVCodecContext from main thread after configure
- Block main thread during encode/decode
- Create race conditions in callback scheduling

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Worker operations don't block main thread
- [ ] Callbacks invoked on correct thread
- [ ] No race conditions under stress
- [ ] Memory safety verified (no use-after-free)
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/2-codec-processing-model/2.3-codec-work-parallel-queue.md` - Spec
- `src/async_encode_worker.cc` - Native worker pattern
- `src/common.h` - Threading utilities

### Reference Only (Don't modify)
- `src/ffmpeg_raii.h` - RAII patterns for thread safety

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue
- TODO-2.2: Control message definitions

### Blocks (Downstream)
- TODO-3.6: AudioDecoder algorithms
- TODO-4.6: VideoDecoder algorithms
- TODO-5.6: AudioEncoder algorithms
- TODO-6.6: VideoEncoder algorithms

### Can Run In Parallel With
- TODO-1

## Test Requirements

### Unit Tests Required
1. Encode operation doesn't block main thread
2. Decode operation doesn't block main thread
3. Callbacks run on main thread
4. Multiple concurrent operations handled

### Edge Cases to Test
1. Rapid encode() calls exceeding queue capacity
2. decode() while previous decode pending
3. flush() during active encoding

### Error Cases to Test
1. Worker thread error → error callback on main thread
2. Resource exhaustion → proper error propagation
3. Cancellation during worker execution

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Stress tests pass without leaks
- [ ] Artifact handoff created at `.claude/artifacts/TODO-2.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-2.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
