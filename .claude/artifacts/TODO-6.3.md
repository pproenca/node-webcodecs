# Task Packet: TODO-6.3

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Attributes
> **Assigned to:** Subagent 6.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoEncoder exposes the correct attributes per W3C spec section 6.3.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - VideoEncoder attribute getters
- `test/golden/video-encoder.test.ts` - Attribute tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.3

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.3:
// state: CodecState (readonly)
// encodeQueueSize: unsigned long (readonly)
// ondequeue: EventHandler
```

### Outputs You Must Provide
```typescript
export class VideoEncoder extends EventTarget {
  get state(): CodecState;
  get encodeQueueSize(): number;
  ondequeue: ((event: Event) => void) | null;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify encodeQueueSize tracks pending VideoFrame encodes

### DO NOT
- Make attributes writable

## Success Criteria
- [ ] All tests pass
- [ ] state returns correct CodecState
- [ ] encodeQueueSize increases on encode(VideoFrame)
- [ ] encodeQueueSize decreases on output
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.3-attributes.md` - Attribute spec
- `lib/video-encoder.ts` - Current attributes

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-6.1: Internal slots
- TODO-6.2: Constructor

### Blocks (Downstream)
- TODO-6.5: Methods

### Can Run In Parallel With
- TODO-3.3, TODO-4.3, TODO-5.3

## Test Requirements

### Unit Tests Required
1. state is "unconfigured" after construction
2. state is "configured" after configure()
3. encodeQueueSize increases on encode()
4. encodeQueueSize decreases on output
5. ondequeue fires

### Edge Cases to Test
1. ondequeue not set
2. Rapid encodes

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
