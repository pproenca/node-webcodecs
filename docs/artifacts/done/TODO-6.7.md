# Task Packet: TODO-6.7

> **Feature:** WebCodecs Spec Compliance - EncodedVideoChunkMetadata
> **Assigned to:** Subagent 6.7
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that EncodedVideoChunkMetadata is correctly implemented per W3C spec section 6.7, including video-specific SVC and alpha metadata.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - Metadata generation
- `lib/types.ts` - Type definitions
- `test/golden/video-encoder.test.ts` - Metadata tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.7

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.7:
dictionary EncodedVideoChunkMetadata {
  VideoDecoderConfig decoderConfig;
  SvcOutputMetadata svc;
  BufferSource alphaSideData;
};

dictionary SvcOutputMetadata {
  unsigned long temporalLayerId;
};
```

### Outputs You Must Provide
```typescript
interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
  svc?: SvcOutputMetadata;
  alphaSideData?: ArrayBuffer;
}

interface SvcOutputMetadata {
  temporalLayerId: number;
}

// VideoDecoderConfig should contain:
interface VideoDecoderConfig {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: ArrayBuffer;  // SPS/PPS for H.264, etc.
  colorSpace?: VideoColorSpaceInit;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Include decoderConfig on first output
- Include svc.temporalLayerId when scalabilityMode used
- Include alphaSideData when alpha: 'keep' with alpha channel

### DO NOT
- Skip decoderConfig.description (contains SPS/PPS)
- Ignore SVC metadata for SVC encoding

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] decoderConfig present on first output
- [ ] decoderConfig.description contains SPS/PPS for H.264
- [ ] svc.temporalLayerId present for SVC encoding
- [ ] alphaSideData present when alpha encoded
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.7-encodedvideochunkmetadata.md` - Metadata spec
- `lib/video-encoder.ts` - Where metadata is generated
- `lib/types.ts` - Type definitions

### Reference Only (Don't modify)
- `docs/specs/5-audioencoder-interface/5.7-encodedaudiochunkmetadata.md` - Simpler audio metadata

## Dependencies

### Waits For (Upstream)
- TODO-6.1: [[active output config]] slot
- TODO-6.6: Output algorithm

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-5.7 (AudioEncoder metadata)

## Test Requirements

### Unit Tests Required
1. First output has metadata with decoderConfig
2. decoderConfig.codec matches encoder codec
3. decoderConfig.codedWidth/codedHeight correct
4. H.264 output has description with SPS/PPS
5. SVC encoding has svc.temporalLayerId
6. Alpha encoding has alphaSideData

### Edge Cases to Test
1. L1T2 encoding (temporalLayerId alternates 0, 1)
2. L1T3 encoding (temporalLayerId 0, 1, 2)
3. Alpha channel with RGBA VideoFrame

### Error Cases to Test
1. (None specific - metadata is informational)

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.7.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.7.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
