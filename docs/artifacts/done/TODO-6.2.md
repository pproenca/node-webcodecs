# Task Packet: TODO-6.2

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Constructor
> **Assigned to:** Subagent 6.2
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that VideoEncoder constructor follows W3C spec section 6.2.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - TypeScript VideoEncoder constructor
- `test/golden/video-encoder.test.ts` - Constructor tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.2

## Interface Contract

### Inputs You Will Receive
```typescript
interface VideoEncoderInit {
  output: EncodedVideoChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

// Note: output receives chunk AND metadata (like AudioEncoder)
type EncodedVideoChunkOutputCallback = (
  output: EncodedVideoChunk,
  metadata?: EncodedVideoChunkMetadata
) => void;
```

### Outputs You Must Provide
```typescript
export class VideoEncoder {
  constructor(init: VideoEncoderInit);
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify output callback signature includes metadata
- Verify metadata contains decoderConfig, svc, alphaSideData

### DO NOT
- Forget metadata parameter
- Skip video-specific metadata fields

## Success Criteria
- [ ] All tests pass
- [ ] Constructor accepts VideoEncoderInit
- [ ] output callback receives (chunk, metadata)
- [ ] metadata.decoderConfig provided
- [ ] metadata.svc for SVC encoding
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.2-constructors.md` - Constructor spec
- `lib/video-encoder.ts` - Current constructor

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-6.1: Internal slots

### Blocks (Downstream)
- TODO-6.5: Methods

### Can Run In Parallel With
- TODO-3.2, TODO-4.2, TODO-5.2

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. output callback receives EncodedVideoChunk
3. output callback receives metadata
4. metadata.decoderConfig present
5. error callback invoked on errors

### Edge Cases to Test
1. Callbacks that throw
2. Multiple instances

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
