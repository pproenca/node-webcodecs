# Task Packet: TODO-9.1

> **Feature:** WebCodecs Spec Compliance - Memory Model
> **Assigned to:** Subagent 9.1
> **Priority:** 1
> **Estimated complexity:** HIGH

## Objective
Verify that the WebCodecs memory model (background, reference counting, transfer/serialization) is correctly implemented per W3C spec section 9.1.

## Scope

### Files In Scope
- `lib/video-frame.ts` - VideoFrame memory management
- `lib/audio-data.ts` - AudioData memory management
- `lib/transfer.ts` - Transfer/serialization utilities
- `src/video_frame.cc` - Native VideoFrame resource management
- `src/audio_data.cc` - Native AudioData resource management
- `test/stress/` - Memory leak tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/encoded-chunks.ts` - Different memory model (immutable)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 9.1:

// 9.1.1 Background:
// - VideoFrame/AudioData may hold GPU or large memory resources
// - Resources should be released ASAP when no longer needed
// - close() releases resources immediately

// 9.1.2 Reference Counting:
// - clone() creates a new object sharing the same media resource
// - close() decrements reference count
// - Resources freed when count reaches 0

// 9.1.3 Transfer and Serialization:
// - Transferable interface for Worker postMessage
// - Transfer moves ownership (original becomes closed)
// - Serialization makes a copy
```

### Outputs You Must Provide
```typescript
// VideoFrame and AudioData must implement:
interface MediaResource {
  close(): void;  // Release resources
  clone(): this;  // Share resource (increment ref count)
}

// Transferable support:
// postMessage(frame, [frame]) - transfers ownership
// postMessage(frame) - serializes (copies)
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Use reference counting for shared resources
- close() must be idempotent
- Transfer must close original
- Verify no leaks under stress

### DO NOT
- Leak memory on early GC
- Allow use after close
- Double-free on multiple close()

## Success Criteria
- [ ] All tests pass
- [ ] close() releases resources
- [ ] clone() shares resources
- [ ] close() on clone doesn't affect other clones
- [ ] Transfer closes original
- [ ] No memory leaks in stress tests
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.1-memory-model/` - Full spec
- `lib/video-frame.ts` - VideoFrame implementation
- `lib/audio-data.ts` - AudioData implementation

### Reference Only (Don't modify)
- `src/ffmpeg_raii.h` - RAII patterns

## Dependencies

### Waits For (Upstream)
- None (foundational)

### Blocks (Downstream)
- TODO-9.2: AudioData interface
- TODO-9.4: VideoFrame interface

### Can Run In Parallel With
- TODO-9.3 (Audio Sample Format)

## Test Requirements

### Unit Tests Required
1. close() marks object as closed
2. clone() returns new object
3. clone() shares underlying resource
4. close() on original doesn't affect clone
5. close() on clone doesn't affect original
6. Transfer closes source
7. close() is idempotent

### Edge Cases to Test
1. clone() of clone()
2. close() all clones in any order
3. GC of unclosed objects (should warn/cleanup)

### Error Cases to Test
1. Use after close → InvalidStateError
2. clone() after close → InvalidStateError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Stress tests pass (no leaks)
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
