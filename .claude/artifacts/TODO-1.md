# Task Packet: TODO-1

> **Feature:** WebCodecs Spec Compliance - Definitions
> **Assigned to:** Subagent 1
> **Priority:** 1
> **Estimated complexity:** LOW

## Objective
Verify that all W3C WebCodecs spec definitions from Section 1 are correctly implemented and exported in the codebase.

## Scope

### Files In Scope
- `lib/types.ts` - Type definitions for spec terms
- `lib/codec-base.ts` - Base codec implementation with definitions
- `lib/video-frame.ts` - VideoFrame implementation
- `lib/audio-data.ts` - AudioData implementation
- `lib/resource-manager.ts` - Resource reclamation logic

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native C++ implementations (handled by native tasks)
- `lib/muxer.ts` - Non-spec extension
- `lib/demuxer.ts` - Non-spec extension

## Interface Contract

### Inputs You Will Receive
```typescript
// Spec definitions from docs/specs/1-definitions.md
// Key terms: Codec, Key Chunk, Internal Pending Output,
// Codec System Resources, Temporal Layer, Progressive Image,
// RGB Format, sRGB/Display P3/REC709 Color Spaces, Codec Saturation
```

### Outputs You Must Provide
```typescript
// Verify these concepts exist and match spec semantics:
export type CodecType = 'AudioDecoder' | 'AudioEncoder' | 'VideoDecoder' | 'VideoEncoder';

// Key Chunk detection via EncodedVideoChunk.type === 'key'
export type EncodedChunkType = 'key' | 'delta';

// Color space definitions
export interface VideoColorSpace {
  primaries?: VideoColorPrimaries;
  transfer?: VideoTransferCharacteristics;
  matrix?: VideoMatrixCoefficients;
  fullRange?: boolean;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify all 14 definitions from spec section 1
- Check that sRGB, Display P3, and REC709 color space defaults match spec
- Validate Codec Saturation concept is represented in queue size attributes

### DO NOT
- Modify files outside your scope
- Add new dependencies without approval
- Implement codec logic (that's other tasks)
- Change native C++ code

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All 14 spec definitions verified or gaps documented
- [ ] sRGB color space: primaries=bt709, transfer=iec61966-2-1, matrix=rgb, fullRange=true
- [ ] Display P3 color space: primaries=smpte432, transfer=iec61966-2-1, matrix=rgb, fullRange=true
- [ ] REC709 color space: primaries=bt709, transfer=bt709, matrix=bt709, fullRange=false
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/1-definitions.md` - W3C spec definitions
- `lib/types.ts` - Current type definitions
- `lib/video-frame.ts` - VideoFrame and VideoColorSpace

### Reference Only (Don't modify)
- `test/golden/video-frame.test.ts` - Pattern reference for VideoFrame tests

## Dependencies

### Waits For (Upstream)
- None (this is foundational)

### Blocks (Downstream)
- TODO-9.9: Video Color Space Interface implementation

### Can Run In Parallel With
- TODO-2.1, TODO-2.2, TODO-2.3 (Codec Processing Model)

## Test Requirements

### Unit Tests Required
1. Verify VideoColorSpace sRGB defaults match spec
2. Verify VideoColorSpace Display P3 defaults match spec
3. Verify VideoColorSpace REC709 defaults match spec
4. Verify EncodedChunkType includes 'key' and 'delta'

### Edge Cases to Test
1. VideoColorSpace with null/undefined members
2. Color space serialization/deserialization

### Error Cases to Test
1. Invalid color primaries value → TypeError
2. Invalid transfer characteristics → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
