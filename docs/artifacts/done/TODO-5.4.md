# Task Packet: TODO-5.4

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Event Summary
> **Assigned to:** Subagent 5.4
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioEncoder fires the correct events (dequeue) per W3C spec section 5.4.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - AudioEncoder event dispatching
- `test/golden/audio-encoder.test.ts` - Event tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.4

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.4:
// Event: dequeue
// Fires when: encodeQueueSize decreases
// Interface: Event
```

### Outputs You Must Provide
```typescript
export class AudioEncoder extends EventTarget {
  ondequeue: ((event: Event) => void) | null;
  private _triggerDequeue(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Fire dequeue when encodeQueueSize decreases (on output)
- Coalesce events per [[dequeue event scheduled]]

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
- `docs/specs/5-audioencoder-interface/5.4-event-summary.md` - Event spec
- `lib/audio-encoder.ts` - Current event handling

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar event pattern

## Dependencies

### Waits For (Upstream)
- TODO-5.1: [[dequeue event scheduled]] slot
- TODO-5.3: ondequeue attribute

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-3.4, TODO-4.4, TODO-6.4

## Test Requirements

### Unit Tests Required
1. dequeue fires after encode output
2. Events coalesced for rapid outputs
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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
