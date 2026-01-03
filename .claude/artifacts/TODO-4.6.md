# Task Packet: TODO-4.6

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Algorithms
> **Assigned to:** Subagent 4.6
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that VideoDecoder internal algorithms (Reset VideoDecoder, Close VideoDecoder, Output VideoFrames, Schedule Dequeue Event) follow W3C spec section 4.6.

## Scope

### Files In Scope
- `lib/video-decoder.ts` - TypeScript algorithm implementations
- `src/video_decoder.cc` - Native algorithm implementations
- `test/golden/video-decoder.test.ts` - Algorithm behavior tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.6

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 4.6:
// Reset VideoDecoder algorithm (same as AudioDecoder)
// Close VideoDecoder algorithm (same as AudioDecoder)
// Output VideoFrames algorithm (outputs VideoFrame objects)
// Schedule Dequeue Event algorithm
```

### Outputs You Must Provide
```typescript
class VideoDecoder {
  private _resetDecoder(error?: DOMException): void;
  private _closeDecoder(error?: DOMException): void;
  private _outputVideoFrames(outputs: VideoFrame[]): void;
  private _scheduleDequeueEvent(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify output callback receives VideoFrame objects
- Verify VideoFrame has correct properties (timestamp, duration, format, etc.)
- Verify resource cleanup releases VideoFrame memory

### DO NOT
- Leak VideoFrame resources on close
- Output AudioData from VideoDecoder

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Reset sets state to "unconfigured"
- [ ] Reset rejects pending flush promises
- [ ] Close releases all resources
- [ ] Output callback receives VideoFrame with correct metadata
- [ ] Dequeue events coalesced
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.6-algorithms.md` - Algorithm spec
- `lib/video-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/video-frame.ts` - VideoFrame class

## Dependencies

### Waits For (Upstream)
- TODO-4.1: Internal slots
- TODO-4.5: Methods

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-3.6, TODO-5.6, TODO-6.6

## Test Requirements

### Unit Tests Required
1. Reset changes state to "unconfigured"
2. Reset rejects pending promises
3. Close changes state to "closed"
4. Close releases VideoFrame memory
5. Output callback receives VideoFrame
6. VideoFrame has timestamp, duration
7. Dequeue events coalesced

### Edge Cases to Test
1. Output callback throws
2. Rapid outputs coalesce
3. VideoFrame with odd dimensions

### Error Cases to Test
1. Reset with pending operations
2. Close with pending operations

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Memory leak tests pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.6.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.6.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
