# Task Packet: TODO-6.6

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Algorithms
> **Assigned to:** Subagent 6.6
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that VideoEncoder internal algorithms follow W3C spec section 6.6, including video-specific active orientation handling.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - TypeScript algorithm implementations
- `src/video_encoder.cc` - Native algorithm implementations
- `test/golden/video-encoder.test.ts` - Algorithm behavior tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.6

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.6:
// Reset VideoEncoder algorithm
// Close VideoEncoder algorithm
// Output EncodedVideoChunks algorithm (includes SVC metadata)
// Schedule Dequeue Event algorithm
// Active orientation handling (video-specific)
```

### Outputs You Must Provide
```typescript
class VideoEncoder {
  private _resetEncoder(error?: DOMException): void;
  private _closeEncoder(error?: DOMException): void;
  private _outputEncodedChunks(outputs: EncodedVideoChunk[], metadata?: EncodedVideoChunkMetadata): void;
  private _scheduleDequeueEvent(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Track [[active orientation]] from first VideoFrame after configure
- Include SVC metadata (temporalLayerId) for SVC encoding
- Include decoderConfig in metadata

### DO NOT
- Ignore orientation changes after first frame (per spec, it's locked)
- Skip SVC metadata

## Success Criteria
- [ ] All tests pass
- [ ] Reset clears [[active orientation]]
- [ ] First frame sets [[active orientation]]
- [ ] Output includes SVC metadata when applicable
- [ ] decoderConfig in metadata
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.6-algorithms.md` - Algorithm spec
- `lib/video-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar algorithms

## Dependencies

### Waits For (Upstream)
- TODO-6.1: Internal slots
- TODO-6.5: Methods

### Blocks (Downstream)
- TODO-6.7: EncodedVideoChunkMetadata

### Can Run In Parallel With
- TODO-3.6, TODO-4.6, TODO-5.6

## Test Requirements

### Unit Tests Required
1. Reset clears [[active orientation]]
2. First encode sets [[active orientation]]
3. Subsequent frames with different orientation work (converted)
4. Output includes metadata
5. SVC encoding includes temporalLayerId

### Edge Cases to Test
1. Frame with rotation
2. Frame with flip
3. SVC L1T2 mode

### Error Cases to Test
1. Reset with pending operations

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.6.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.6.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
