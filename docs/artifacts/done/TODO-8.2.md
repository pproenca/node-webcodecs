# Task Packet: TODO-8.2

> **Feature:** WebCodecs Spec Compliance - EncodedVideoChunk Interface
> **Assigned to:** Subagent 8.2
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that EncodedVideoChunk interface is correctly implemented per W3C spec section 8.2 (8.2.1-8.2.5).

## Scope

### Files In Scope
- `lib/encoded-chunks.ts` - EncodedVideoChunk implementation
- `test/golden/encoded-chunks.test.ts` - EncodedVideoChunk tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-encoder.ts` - Produces chunks (handled by TODO-6.x)
- `lib/video-decoder.ts` - Consumes chunks (handled by TODO-4.x)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 8.2:

// 8.2.1 Internal Slots:
// [[type]] - "key" or "delta"
// [[timestamp]] - microseconds
// [[duration]] - microseconds (nullable)
// [[internal data]] - encoded bytes

// 8.2.2 Constructor:
constructor(init: EncodedVideoChunkInit);

// 8.2.3 Attributes:
readonly attribute EncodedVideoChunkType type;
readonly attribute long long timestamp;
readonly attribute unsigned long long? duration;
readonly attribute unsigned long byteLength;

// 8.2.4 Methods:
void copyTo(BufferSource destination);

// 8.2.5 Serialization (structured clone)
```

### Outputs You Must Provide
```typescript
export type EncodedVideoChunkType = 'key' | 'delta';

export interface EncodedVideoChunkInit {
  type: EncodedVideoChunkType;
  timestamp: number;
  duration?: number;
  data: ArrayBuffer | ArrayBufferView;
}

export class EncodedVideoChunk {
  constructor(init: EncodedVideoChunkInit);

  readonly type: EncodedVideoChunkType;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;

  copyTo(destination: ArrayBuffer | ArrayBufferView): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Timestamp in microseconds
- Duration nullable
- type "key" for I-frames, "delta" for P/B-frames
- Support structured cloning

### DO NOT
- Allow modification after construction
- Expose raw data directly

## Success Criteria
- [ ] All tests pass
- [ ] Constructor validates init
- [ ] type is "key" or "delta"
- [ ] key frames are independently decodable
- [ ] delta frames require previous frames
- [ ] copyTo copies encoded data
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/8-encoded-media-interfaces-chunks/8.2-encodedvideochunk-interface/` - Full spec
- `lib/encoded-chunks.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/video-encoder.ts` - Produces EncodedVideoChunk

## Dependencies

### Waits For (Upstream)
- None (basic type)

### Blocks (Downstream)
- TODO-6.x: VideoEncoder outputs EncodedVideoChunk
- TODO-4.x: VideoDecoder inputs EncodedVideoChunk

### Can Run In Parallel With
- TODO-8.1 (EncodedAudioChunk)

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. type "key" accepted
3. type "delta" accepted
4. timestamp is readonly
5. duration can be null
6. byteLength correct
7. copyTo works

### Edge Cases to Test
1. Key frame followed by delta frames
2. Large encoded frames (>1MB for 4K)
3. Zero duration vs null duration

### Error Cases to Test
1. Missing type → TypeError
2. Missing timestamp → TypeError
3. Missing data → TypeError
4. Invalid type value → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-8.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-8.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
