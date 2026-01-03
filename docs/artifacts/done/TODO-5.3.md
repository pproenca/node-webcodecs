# Task Packet: TODO-5.3

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Attributes
> **Assigned to:** Subagent 5.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioEncoder exposes the correct attributes (state, encodeQueueSize, ondequeue) per W3C spec section 5.3.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - AudioEncoder attribute getters
- `test/golden/audio-encoder.test.ts` - Attribute tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.3

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.3:
// state: CodecState (readonly)
// encodeQueueSize: unsigned long (readonly) - NOT decodeQueueSize
// ondequeue: EventHandler
```

### Outputs You Must Provide
```typescript
export class AudioEncoder extends EventTarget {
  get state(): CodecState;
  get encodeQueueSize(): number;
  ondequeue: ((event: Event) => void) | null;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Use encodeQueueSize (not decodeQueueSize)
- Verify queue size increases on encode(), decreases on output

### DO NOT
- Confuse with decoder's decodeQueueSize

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] state returns correct CodecState
- [ ] encodeQueueSize increases on encode()
- [ ] encodeQueueSize decreases when output emitted
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.3-attributes.md` - Attribute spec
- `lib/audio-encoder.ts` - Current attributes

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar pattern with decodeQueueSize

## Dependencies

### Waits For (Upstream)
- TODO-5.1: Internal slots
- TODO-5.2: Constructor

### Blocks (Downstream)
- TODO-5.5: Methods modify attributes

### Can Run In Parallel With
- TODO-3.3, TODO-4.3, TODO-6.3

## Test Requirements

### Unit Tests Required
1. state is "unconfigured" after construction
2. state is "configured" after configure()
3. encodeQueueSize increases on encode()
4. encodeQueueSize decreases on output
5. ondequeue fires when queue decreases

### Edge Cases to Test
1. ondequeue not set
2. Multiple rapid encodes

### Error Cases to Test
1. Setting state directly → ignored

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
