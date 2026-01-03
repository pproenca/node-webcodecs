# Task Packet: TODO-8.1

> **Feature:** WebCodecs Spec Compliance - EncodedAudioChunk Interface
> **Assigned to:** Subagent 8.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that EncodedAudioChunk interface is correctly implemented per W3C spec section 8.1 (8.1.1-8.1.5).

## Scope

### Files In Scope
- `lib/encoded-chunks.ts` - EncodedAudioChunk implementation
- `test/golden/encoded-chunks.test.ts` - EncodedAudioChunk tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Produces chunks (handled by TODO-5.x)
- `lib/audio-decoder.ts` - Consumes chunks (handled by TODO-3.x)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 8.1:

// 8.1.1 Internal Slots:
// [[type]] - "key" or "delta"
// [[timestamp]] - microseconds
// [[duration]] - microseconds (nullable)
// [[internal data]] - encoded bytes

// 8.1.2 Constructor:
constructor(init: EncodedAudioChunkInit);

// 8.1.3 Attributes:
readonly attribute EncodedAudioChunkType type;
readonly attribute long long timestamp;
readonly attribute unsigned long long? duration;
readonly attribute unsigned long byteLength;

// 8.1.4 Methods:
void copyTo(BufferSource destination);

// 8.1.5 Serialization (structured clone)
```

### Outputs You Must Provide
```typescript
export type EncodedAudioChunkType = 'key' | 'delta';

export interface EncodedAudioChunkInit {
  type: EncodedAudioChunkType;
  timestamp: number;
  duration?: number;
  data: ArrayBuffer | ArrayBufferView;
}

export class EncodedAudioChunk {
  constructor(init: EncodedAudioChunkInit);

  readonly type: EncodedAudioChunkType;
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
- Duration nullable (can be null)
- copyTo throws if destination too small
- Support structured cloning/serialization

### DO NOT
- Allow modification after construction
- Expose internal data directly (use copyTo)

## Success Criteria
- [ ] All tests pass
- [ ] Constructor validates init
- [ ] type is "key" or "delta"
- [ ] timestamp in microseconds
- [ ] duration nullable
- [ ] byteLength matches data size
- [ ] copyTo copies data to destination
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/8-encoded-media-interfaces-chunks/8.1-encodedaudiochunk-interface/` - Full spec
- `lib/encoded-chunks.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Produces EncodedAudioChunk

## Dependencies

### Waits For (Upstream)
- None (basic type)

### Blocks (Downstream)
- TODO-5.x: AudioEncoder outputs EncodedAudioChunk
- TODO-3.x: AudioDecoder inputs EncodedAudioChunk

### Can Run In Parallel With
- TODO-8.2 (EncodedVideoChunk)

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. type is readonly
3. timestamp is readonly
4. duration can be null
5. byteLength matches data size
6. copyTo copies all bytes
7. copyTo throws if destination too small

### Edge Cases to Test
1. Zero-length data
2. Large data (>1MB)
3. duration = 0 vs duration = null

### Error Cases to Test
1. Missing type → TypeError
2. Missing timestamp → TypeError
3. Missing data → TypeError
4. copyTo with small buffer → RangeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-8.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-8.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
