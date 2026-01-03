# Task Packet: TODO-5.6

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Algorithms
> **Assigned to:** Subagent 5.6
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that AudioEncoder internal algorithms follow W3C spec section 5.6.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - TypeScript algorithm implementations
- `src/audio_encoder.cc` - Native algorithm implementations
- `test/golden/audio-encoder.test.ts` - Algorithm behavior tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.6

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.6:
// Reset AudioEncoder algorithm
// Close AudioEncoder algorithm
// Output EncodedAudioChunks algorithm
// Schedule Dequeue Event algorithm
```

### Outputs You Must Provide
```typescript
class AudioEncoder {
  private _resetEncoder(error?: DOMException): void;
  private _closeEncoder(error?: DOMException): void;
  private _outputEncodedChunks(outputs: EncodedAudioChunk[], metadata?: EncodedAudioChunkMetadata): void;
  private _scheduleDequeueEvent(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Output callback receives EncodedAudioChunk + metadata
- metadata.decoderConfig provided for decoder interop
- Reset clears [[active encoder config]]

### DO NOT
- Forget to clear [[active encoder config]] on reset
- Skip metadata on output callback

## Success Criteria
- [ ] All tests pass
- [ ] Reset clears active config
- [ ] Close releases resources
- [ ] Output callback receives chunk + metadata
- [ ] metadata.decoderConfig correct
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.6-algorithms.md` - Algorithm spec
- `lib/audio-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar algorithms

## Dependencies

### Waits For (Upstream)
- TODO-5.1: Internal slots
- TODO-5.5: Methods

### Blocks (Downstream)
- TODO-5.7: EncodedAudioChunkMetadata

### Can Run In Parallel With
- TODO-3.6, TODO-4.6, TODO-6.6

## Test Requirements

### Unit Tests Required
1. Reset changes state to "unconfigured"
2. Reset clears [[active encoder config]]
3. Close releases resources
4. Output callback receives EncodedAudioChunk
5. Output callback receives metadata with decoderConfig

### Edge Cases to Test
1. Output callback throws
2. Rapid outputs coalesce dequeue

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.6.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.6.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
