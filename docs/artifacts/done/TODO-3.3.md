# Task Packet: TODO-3.3

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Attributes
> **Assigned to:** Subagent 3.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioDecoder exposes the correct attributes (state, decodeQueueSize, ondequeue) per W3C spec section 3.3.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - AudioDecoder attribute getters
- `lib/codec-base.ts` - Base class event handling
- `test/golden/audio-decoder.test.ts` - Attribute tests

### Files Out of Scope (DO NOT MODIFY)
- `src/audio_decoder.cc` - Native implementation
- `lib/video-decoder.ts` - Handled by TODO-4.3

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 3.3:
// state: CodecState (readonly)
// decodeQueueSize: unsigned long (readonly)
// ondequeue: EventHandler
```

### Outputs You Must Provide
```typescript
export class AudioDecoder extends EventTarget {
  // Readonly attributes
  get state(): CodecState;
  get decodeQueueSize(): number;

  // Event handler
  ondequeue: ((event: Event) => void) | null;
}

// CodecState enum
type CodecState = 'unconfigured' | 'configured' | 'closed';
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify state reflects current codec state
- Verify decodeQueueSize reflects pending decode count
- Verify ondequeue fires when queue decreases

### DO NOT
- Modify state transitions (handled by TODO-3.5)
- Make attributes writable when spec says readonly
- Change event timing

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] state returns correct CodecState value
- [ ] decodeQueueSize returns correct count
- [ ] ondequeue event fires when queue size decreases
- [ ] Attributes are readonly (no setters for state/decodeQueueSize)
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.3-attributes.md` - Attribute spec
- `lib/audio-decoder.ts` - Current attributes
- `lib/codec-base.ts` - EventTarget inheritance

### Reference Only (Don't modify)
- `test/golden/audio-decoder.test.ts` - Existing test patterns

## Dependencies

### Waits For (Upstream)
- TODO-3.1: Internal slots that back attributes
- TODO-3.2: Constructor initializes attributes

### Blocks (Downstream)
- TODO-3.5: Methods modify attributes

### Can Run In Parallel With
- TODO-4.3, TODO-5.3, TODO-6.3 (other codec attributes)

## Test Requirements

### Unit Tests Required
1. state is "unconfigured" after construction
2. state is "configured" after configure()
3. state is "closed" after close()
4. decodeQueueSize increases on decode()
5. decodeQueueSize decreases when output received
6. ondequeue fires when decodeQueueSize decreases

### Edge Cases to Test
1. ondequeue not set (no error)
2. ondequeue set to null after being set
3. Multiple ondequeue handlers via addEventListener

### Error Cases to Test
1. Setting state directly → should be ignored or throw
2. Setting decodeQueueSize directly → should be ignored or throw

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
