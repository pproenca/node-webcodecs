# Task Packet: TODO-10.3-10.5

> **Feature:** WebCodecs Spec Compliance - ImageDecoder Options and Result
> **Assigned to:** Subagent 10.3-10.5
> **Priority:** 3
> **Estimated complexity:** LOW

## Objective
Verify ImageDecoderInit, ImageDecodeOptions, and ImageDecodeResult interfaces per W3C spec sections 10.3-10.5.

## Scope

### Files In Scope
- `lib/image-decoder.ts` - ImageDecoder types
- `lib/types.ts` - Type definitions
- `test/golden/image-decoder.test.ts` - Tests

### Files Out of Scope (DO NOT MODIFY)
- None

## Interface Contract

### Inputs You Will Receive
```typescript
// 10.3 ImageDecoderInit
dictionary ImageDecoderInit {
  required ImageBufferSource data;
  required DOMString type;
  ColorSpaceConversion colorSpaceConversion = "default";
  unsigned long desiredWidth;
  unsigned long desiredHeight;
  boolean preferAnimation = false;
};

// 10.4 ImageDecodeOptions
dictionary ImageDecodeOptions {
  unsigned long frameIndex = 0;
  boolean completeFramesOnly = true;
};

// 10.5 ImageDecodeResult
dictionary ImageDecodeResult {
  required VideoFrame image;
  required boolean complete;
};
```

### Outputs You Must Provide
```typescript
export interface ImageDecoderInit {
  data: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>;
  type: string;
  colorSpaceConversion?: 'default' | 'none';
  desiredWidth?: number;
  desiredHeight?: number;
  preferAnimation?: boolean;
}

export interface ImageDecodeOptions {
  frameIndex?: number;  // default 0
  completeFramesOnly?: boolean;  // default true
}

export interface ImageDecodeResult {
  image: VideoFrame;
  complete: boolean;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- data can be buffer or ReadableStream
- desiredWidth/Height for rescaling
- frameIndex for animated images
- complete indicates if more data available (progressive)

### DO NOT
- Add fields not in spec
- Change default values

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] ImageDecoderInit validated
- [ ] ImageDecodeOptions defaults correct
- [ ] ImageDecodeResult.image is VideoFrame
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/10-image-decoding/10.3-imagedecoderinit-interface.md`
- `docs/specs/10-image-decoding/10.4-imagedecodeoptions-interface.md`
- `docs/specs/10-image-decoding/10.5-imagedecoderesult-interface.md`
- `lib/image-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- Browser implementations

## Dependencies

### Waits For (Upstream)
- TODO-10.2: ImageDecoder interface

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-10.6, TODO-10.7

## Test Requirements

### Unit Tests Required
1. ImageDecoderInit with ArrayBuffer data
2. ImageDecoderInit with ReadableStream data
3. type required
4. colorSpaceConversion defaults to "default"
5. preferAnimation defaults to false
6. frameIndex defaults to 0
7. completeFramesOnly defaults to true
8. ImageDecodeResult.image is VideoFrame
9. ImageDecodeResult.complete is boolean

### Edge Cases to Test
1. desiredWidth without desiredHeight
2. desiredHeight without desiredWidth
3. frameIndex beyond track length

### Error Cases to Test
1. Missing data → TypeError
2. Missing type → TypeError
3. Invalid type → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-10.3-10.5.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-10.3-10.5.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
