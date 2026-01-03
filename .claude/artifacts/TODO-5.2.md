# Task Packet: TODO-5.2

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Constructor
> **Assigned to:** Subagent 5.2
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioEncoder constructor follows W3C spec section 5.2, noting output callback receives EncodedAudioChunk + metadata.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - TypeScript AudioEncoder constructor
- `test/golden/audio-encoder.test.ts` - Constructor tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.2
- `src/audio_encoder.cc` - Native implementation

## Interface Contract

### Inputs You Will Receive
```typescript
interface AudioEncoderInit {
  output: EncodedAudioChunkOutputCallback;
  error: WebCodecsErrorCallback;
}

// Note: output receives BOTH chunk AND metadata
type EncodedAudioChunkOutputCallback = (
  output: EncodedAudioChunk,
  metadata?: EncodedAudioChunkMetadata
) => void;
```

### Outputs You Must Provide
```typescript
export class AudioEncoder {
  constructor(init: AudioEncoderInit);
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify output callback signature includes metadata parameter
- Verify metadata contains decoderConfig

### DO NOT
- Forget metadata parameter in output callback
- Skip decoderConfig in metadata

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Constructor accepts AudioEncoderInit
- [ ] output callback receives (chunk, metadata)
- [ ] metadata.decoderConfig provided on first output
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.2-constructors.md` - Constructor spec
- `lib/audio-encoder.ts` - Current constructor

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Simpler callback pattern

## Dependencies

### Waits For (Upstream)
- TODO-5.1: Internal slots

### Blocks (Downstream)
- TODO-5.5: Methods

### Can Run In Parallel With
- TODO-3.2, TODO-4.2, TODO-6.2

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. output callback invoked with EncodedAudioChunk
3. output callback invoked with metadata
4. metadata.decoderConfig present on first output
5. error callback invoked on errors

### Edge Cases to Test
1. Metadata may be undefined for subsequent outputs
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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
