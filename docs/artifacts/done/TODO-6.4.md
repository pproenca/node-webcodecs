# Task Packet: TODO-6.4

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Event Summary
> **Assigned to:** Subagent 6.4
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoEncoder fires the correct events per W3C spec section 6.4.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - VideoEncoder event dispatching
- `test/golden/video-encoder.test.ts` - Event tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.4

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.4:
// Event: dequeue
// Fires when: encodeQueueSize decreases
// Interface: Event
```

### Outputs You Must Provide
```typescript
export class VideoEncoder extends EventTarget {
  ondequeue: ((event: Event) => void) | null;
  private _triggerDequeue(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Fire dequeue when encodeQueueSize decreases
- Coalesce events

### DO NOT
- Fire events synchronously
- Fire multiple events for batched outputs

## Success Criteria
- [ ] All tests pass
- [ ] dequeue fires when encodeQueueSize decreases
- [ ] Events coalesced
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.4-event-summary.md` - Event spec
- `lib/video-encoder.ts` - Current event handling

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-6.1: [[dequeue event scheduled]] slot
- TODO-6.3: ondequeue attribute

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-3.4, TODO-4.4, TODO-5.4

## Test Requirements

### Unit Tests Required
1. dequeue fires after encode output
2. Events coalesced
3. addEventListener works

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
