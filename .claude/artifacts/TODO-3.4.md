# Task Packet: TODO-3.4

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Event Summary
> **Assigned to:** Subagent 3.4
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioDecoder fires the correct events (dequeue) at the correct times per W3C spec section 3.4.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - AudioDecoder event dispatching
- `lib/codec-base.ts` - Base EventTarget implementation
- `test/golden/audio-decoder.test.ts` - Event tests

### Files Out of Scope (DO NOT MODIFY)
- `src/audio_decoder.cc` - Native implementation
- `lib/video-decoder.ts` - Handled by TODO-4.4

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 3.4:
// Event: dequeue
// Fires when: decodeQueueSize decreases
// Interface: Event
```

### Outputs You Must Provide
```typescript
// AudioDecoder must:
// 1. Extend EventTarget
// 2. Fire "dequeue" event when decodeQueueSize decreases
// 3. Coalesce rapid dequeue events (per [[dequeue event scheduled]])

export class AudioDecoder extends EventTarget {
  // Event handler attribute
  ondequeue: ((event: Event) => void) | null;

  // Internal method to trigger dequeue
  private _triggerDequeue(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify dequeue event fires when output callback invoked
- Verify dequeue events are coalesced (not one per output)
- Use [[dequeue event scheduled]] flag to prevent spam

### DO NOT
- Fire events synchronously (use microtask/next tick)
- Fire multiple events for batched outputs
- Fire dequeue when queue is already empty

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] dequeue fires when decodeQueueSize decreases
- [ ] Events coalesced (flag prevents spam)
- [ ] Both addEventListener and ondequeue work
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.4-event-summary.md` - Event spec
- `lib/audio-decoder.ts` - Current event handling
- `lib/codec-base.ts` - EventTarget base class

### Reference Only (Don't modify)
- `test/golden/video-encoder.test.ts` - Similar event test patterns

## Dependencies

### Waits For (Upstream)
- TODO-3.1: [[dequeue event scheduled]] slot
- TODO-3.3: ondequeue attribute

### Blocks (Downstream)
- None (events are observational)

### Can Run In Parallel With
- TODO-4.4, TODO-5.4, TODO-6.4 (other codec events)

## Test Requirements

### Unit Tests Required
1. dequeue event fires after decode output
2. dequeue event fires after flush completes
3. ondequeue handler called with Event object
4. addEventListener("dequeue", ...) works
5. Events coalesced for rapid outputs

### Edge Cases to Test
1. No handler set (no error)
2. Handler throws (should not break decoder)
3. Handler removed mid-operation

### Error Cases to Test
1. Dispatching event after close (should not fire)

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
