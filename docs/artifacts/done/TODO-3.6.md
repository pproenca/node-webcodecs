# Task Packet: TODO-3.6

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Algorithms
> **Assigned to:** Subagent 3.6
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that AudioDecoder internal algorithms (Reset AudioDecoder, Close AudioDecoder, Output AudioData, Schedule Dequeue Event) follow W3C spec section 3.6.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - TypeScript algorithm implementations
- `src/audio_decoder.cc` - Native algorithm implementations
- `test/golden/audio-decoder.test.ts` - Algorithm behavior tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-decoder.ts` - Handled by TODO-4.6
- `lib/audio-encoder.ts` - Handled by TODO-5.6

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 3.6:
// Reset AudioDecoder:
//   1. Set [[state]] to "unconfigured"
//   2. Clear [[control message queue]]
//   3. Set [[codec implementation]] to null
//   4. Reject all [[pending flush promises]]
//   5. Set [[decodeQueueSize]] to 0
//   6. Signal [[codec implementation]] to cease work

// Close AudioDecoder:
//   1. Run Reset AudioDecoder
//   2. Set [[state]] to "closed"
//   3. Clear [[codec implementation]] and release resources

// Output AudioData:
//   1. For each output, invoke [[output callback]]

// Schedule Dequeue Event:
//   1. If [[dequeue event scheduled]] is true, return
//   2. Set [[dequeue event scheduled]] to true
//   3. Queue task to fire "dequeue" event
//   4. Set [[dequeue event scheduled]] to false
```

### Outputs You Must Provide
```typescript
// Internal algorithms (private methods or native code):
class AudioDecoder {
  // Called by reset() and close()
  private _resetDecoder(error?: DOMException): void;

  // Called by close()
  private _closeDecoder(error?: DOMException): void;

  // Called when decode produces output
  private _outputAudioData(outputs: AudioData[]): void;

  // Called when decodeQueueSize decreases
  private _scheduleDequeueEvent(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify Reset algorithm rejects pending flush promises
- Verify Close algorithm releases native resources
- Verify Output algorithm invokes callback for each output
- Verify Dequeue event is coalesced

### DO NOT
- Block main thread during reset/close
- Leak memory on close
- Fire multiple dequeue events for batch outputs

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Reset sets state to "unconfigured"
- [ ] Reset rejects pending flush promises with AbortError
- [ ] Reset clears decodeQueueSize
- [ ] Close sets state to "closed"
- [ ] Close releases all native resources
- [ ] Output callback invoked for each decoded frame
- [ ] Dequeue events coalesced via flag
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.6-algorithms.md` - Algorithm spec
- `lib/audio-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `src/ffmpeg_raii.h` - RAII patterns for resource cleanup

## Dependencies

### Waits For (Upstream)
- TODO-3.1: Internal slots
- TODO-3.5: Methods that call algorithms

### Blocks (Downstream)
- None (algorithms are internal)

### Can Run In Parallel With
- TODO-4.6, TODO-5.6, TODO-6.6 (other codec algorithms)

## Test Requirements

### Unit Tests Required
1. Reset changes state to "unconfigured"
2. Reset rejects pending flush promises
3. Reset clears decodeQueueSize
4. Close changes state to "closed"
5. Close rejects pending flush promises
6. Output callback invoked per decoded frame
7. Dequeue event fires after output
8. Dequeue events not spammed (coalesced)

### Edge Cases to Test
1. Reset called when already unconfigured
2. Close called when already closed
3. Output callback throws (decoder continues)
4. Rapid outputs coalesce to single dequeue

### Error Cases to Test
1. Reset with pending operations → all rejected with AbortError
2. Close with pending operations → all rejected with AbortError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Memory leak tests pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.6.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.6.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
