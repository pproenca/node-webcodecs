# Task Packet: TODO-4.4

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Event Summary
> **Assigned to:** Subagent 4.4
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoDecoder fires the correct events (dequeue) at the correct times per W3C spec section 4.4.

## Scope

### Files In Scope
- `lib/video-decoder.ts` - VideoDecoder event dispatching
- `lib/codec-base.ts` - Base EventTarget implementation
- `test/golden/video-decoder.test.ts` - Event tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.4

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 4.4:
// Event: dequeue
// Fires when: decodeQueueSize decreases
// Interface: Event
```

### Outputs You Must Provide
```typescript
export class VideoDecoder extends EventTarget {
  ondequeue: ((event: Event) => void) | null;
  private _triggerDequeue(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify dequeue event fires when output callback invoked
- Verify events coalesced per [[dequeue event scheduled]]

### DO NOT
- Fire events synchronously
- Fire multiple events for batched outputs

## Success Criteria
- [ ] All tests pass
- [ ] dequeue fires when decodeQueueSize decreases
- [ ] Events coalesced
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.4-event-summary.md` - Event spec
- `lib/video-decoder.ts` - Current event handling

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar event pattern

## Dependencies

### Waits For (Upstream)
- TODO-4.1: [[dequeue event scheduled]] slot
- TODO-4.3: ondequeue attribute

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-3.4, TODO-5.4, TODO-6.4

## Test Requirements

### Unit Tests Required
1. dequeue event fires after decode output
2. dequeue event fires after flush completes
3. Events coalesced for rapid outputs

### Edge Cases to Test
1. No handler set
2. Handler throws

### Error Cases to Test
1. Dispatching after close

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
