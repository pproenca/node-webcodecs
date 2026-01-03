# Task Packet: TODO-4.3

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Attributes
> **Assigned to:** Subagent 4.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoDecoder exposes the correct attributes (state, decodeQueueSize, ondequeue) per W3C spec section 4.3.

## Scope

### Files In Scope
- `lib/video-decoder.ts` - VideoDecoder attribute getters
- `lib/codec-base.ts` - Base class event handling
- `test/golden/video-decoder.test.ts` - Attribute tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.3

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 4.3:
// state: CodecState (readonly)
// decodeQueueSize: unsigned long (readonly)
// ondequeue: EventHandler
```

### Outputs You Must Provide
```typescript
export class VideoDecoder extends EventTarget {
  get state(): CodecState;
  get decodeQueueSize(): number;
  ondequeue: ((event: Event) => void) | null;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify state reflects current codec state
- Verify decodeQueueSize reflects pending decode count

### DO NOT
- Make attributes writable when spec says readonly

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] state returns correct CodecState
- [ ] decodeQueueSize returns correct count
- [ ] ondequeue event fires when queue decreases
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.3-attributes.md` - Attribute spec
- `lib/video-decoder.ts` - Current attributes

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar attributes

## Dependencies

### Waits For (Upstream)
- TODO-4.1: Internal slots
- TODO-4.2: Constructor

### Blocks (Downstream)
- TODO-4.5: Methods modify attributes

### Can Run In Parallel With
- TODO-3.3, TODO-5.3, TODO-6.3

## Test Requirements

### Unit Tests Required
1. state is "unconfigured" after construction
2. state is "configured" after configure()
3. state is "closed" after close()
4. decodeQueueSize increases on decode()
5. decodeQueueSize decreases when output received

### Edge Cases to Test
1. ondequeue not set
2. Multiple handlers via addEventListener

### Error Cases to Test
1. Setting state directly → should be ignored

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
