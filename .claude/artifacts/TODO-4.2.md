# Task Packet: TODO-4.2

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Constructor
> **Assigned to:** Subagent 4.2
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoDecoder constructor follows the exact algorithm from W3C spec section 4.2 (same 14 steps as AudioDecoder).

## Scope

### Files In Scope
- `lib/video-decoder.ts` - TypeScript VideoDecoder constructor
- `test/golden/video-decoder.test.ts` - Constructor tests

### Files Out of Scope (DO NOT MODIFY)
- `src/video_decoder.cc` - Native implementation
- `lib/audio-decoder.ts` - Handled by TODO-3.2

## Interface Contract

### Inputs You Will Receive
```typescript
interface VideoDecoderInit {
  output: VideoDecoderOutputCallback;
  error: WebCodecsErrorCallback;
}

type VideoDecoderOutputCallback = (output: VideoFrame) => void;
```

### Outputs You Must Provide
```typescript
export class VideoDecoder {
  constructor(init: VideoDecoderInit);
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify all 14 constructor steps
- Ensure output callback receives VideoFrame type

### DO NOT
- Modify configure/decode/flush behavior
- Change native constructor interface

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Constructor accepts VideoDecoderInit
- [ ] State is "unconfigured" after construction
- [ ] Output callback receives VideoFrame
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.2-constructors.md` - Constructor spec
- `lib/video-decoder.ts` - Current constructor

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar constructor

## Dependencies

### Waits For (Upstream)
- TODO-4.1: Internal slots

### Blocks (Downstream)
- TODO-4.5: Methods

### Can Run In Parallel With
- TODO-3.2, TODO-5.2, TODO-6.2

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. State is "unconfigured" after construction
3. decodeQueueSize is 0 after construction
4. output callback invoked with VideoFrame
5. error callback invoked on errors

### Edge Cases to Test
1. Multiple instances created simultaneously
2. Callbacks that throw errors

### Error Cases to Test
1. Missing output callback → TypeError
2. Missing error callback → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
