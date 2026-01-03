# Task Packet: TODO-5.7

> **Feature:** WebCodecs Spec Compliance - EncodedAudioChunkMetadata
> **Assigned to:** Subagent 5.7
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that EncodedAudioChunkMetadata is correctly implemented per W3C spec section 5.7, providing decoderConfig for decoder interoperability.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - Metadata generation
- `lib/types.ts` - Type definitions
- `test/golden/audio-encoder.test.ts` - Metadata tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-encoder.ts` - Handled by TODO-6.7

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.7:
dictionary EncodedAudioChunkMetadata {
  AudioDecoderConfig decoderConfig;
};
```

### Outputs You Must Provide
```typescript
interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig;
}

// decoderConfig should contain:
interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: ArrayBuffer;  // Codec-specific setup data
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Include decoderConfig on first output (and when config changes)
- decoderConfig must be usable by AudioDecoder.configure()
- description field for codec-specific data (e.g., AAC AudioSpecificConfig)

### DO NOT
- Include decoderConfig on every output (optional after first)
- Forget description for codecs that need out-of-band config

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] EncodedAudioChunkMetadata type defined
- [ ] decoderConfig present on first output
- [ ] decoderConfig.codec matches encoder config
- [ ] decoderConfig.description contains codec setup data
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.7-encodedaudiochunkmetadata.md` - Metadata spec
- `lib/audio-encoder.ts` - Where metadata is generated
- `lib/types.ts` - Type definitions

### Reference Only (Don't modify)
- `docs/specs/6-videoencoder-interface/6.7-encodedvideochunkmetadata.md` - Similar video metadata

## Dependencies

### Waits For (Upstream)
- TODO-5.1: [[active output config]] slot
- TODO-5.6: Output algorithm

### Blocks (Downstream)
- None (metadata is output)

### Can Run In Parallel With
- TODO-6.7 (VideoEncoder metadata)

## Test Requirements

### Unit Tests Required
1. First output has metadata with decoderConfig
2. decoderConfig.codec matches encoder codec
3. decoderConfig.sampleRate matches encoder config
4. decoderConfig.numberOfChannels matches encoder config
5. decoderConfig usable by AudioDecoder.configure()

### Edge Cases to Test
1. AAC output includes AudioSpecificConfig in description
2. Opus output (no description needed)
3. Second output may not have metadata

### Error Cases to Test
1. (None specific to metadata - it's informational)

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.7.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.7.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
