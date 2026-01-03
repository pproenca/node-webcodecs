# Task Packet: TODO-10.2

> **Feature:** WebCodecs Spec Compliance - ImageDecoder Interface
> **Assigned to:** Subagent 10.2
> **Priority:** 3
> **Estimated complexity:** HIGH

## Objective
Verify that ImageDecoder interface is correctly implemented per W3C spec section 10.2 (10.2.1-10.2.5).

## Scope

### Files In Scope
- `lib/image-decoder.ts` - ImageDecoder implementation
- `src/image_decoder.cc` - Native ImageDecoder (if exists)
- `test/golden/image-decoder.test.ts` - ImageDecoder tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-decoder.ts` - Video decoding (handled by TODO-4.x)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 10.2:

// 10.2.1 Internal Slots:
// [[type]], [[data complete]], [[tracks]], [[internal data]],
// [[pending decode promises]], [[completed]], [[closed]]

// 10.2.2 Constructor:
constructor(init: ImageDecoderInit);

// 10.2.3 Attributes:
readonly attribute DOMString type;
readonly attribute boolean complete;
readonly attribute Promise<undefined> completed;
readonly attribute ImageTrackList tracks;

// 10.2.4 Methods:
Promise<ImageDecodeResult> decode(options?: ImageDecodeOptions);
void reset();
void close();
static Promise<boolean> isTypeSupported(type: DOMString);

// 10.2.5 Algorithms
```

### Outputs You Must Provide
```typescript
export class ImageDecoder {
  constructor(init: ImageDecoderInit);

  readonly type: string;
  readonly complete: boolean;
  readonly completed: Promise<void>;
  readonly tracks: ImageTrackList;

  decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult>;
  reset(): void;
  close(): void;
  static isTypeSupported(type: string): Promise<boolean>;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Support common image formats (JPEG, PNG, GIF, WebP)
- Support animated images (GIF, APNG, WebP)
- completed Promise resolves when all data received
- decode() returns VideoFrame

### DO NOT
- Allow operations after close()
- Block main thread during decode

## Success Criteria
- [ ] All tests pass
- [ ] Constructor validates init
- [ ] decode() returns Promise<ImageDecodeResult>
- [ ] ImageDecodeResult contains VideoFrame
- [ ] tracks provides ImageTrackList
- [ ] isTypeSupported() works for common formats
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/10-image-decoding/10.2-imagedecoder-interface/` - Full spec
- `lib/image-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- Browser ImageDecoder implementations

## Dependencies

### Waits For (Upstream)
- TODO-10.1: Background concepts
- TODO-9.4: VideoFrame (decode returns VideoFrame)

### Blocks (Downstream)
- TODO-10.6: ImageTrackList
- TODO-10.7: ImageTrack

### Can Run In Parallel With
- TODO-10.3, TODO-10.4, TODO-10.5

## Test Requirements

### Unit Tests Required
1. Constructor with valid JPEG data succeeds
2. Constructor with valid PNG data succeeds
3. type returns MIME type
4. complete is false until data fully received
5. completed resolves when data complete
6. decode() returns ImageDecodeResult
7. decode() result has VideoFrame
8. tracks returns ImageTrackList
9. isTypeSupported("image/jpeg") returns true
10. isTypeSupported("image/png") returns true
11. reset() resets decoder state
12. close() closes decoder

### Edge Cases to Test
1. Progressive JPEG decoding
2. Animated GIF with multiple frames
3. decode() with frameIndex

### Error Cases to Test
1. Invalid image data → throws
2. decode() after close() → InvalidStateError
3. isTypeSupported("invalid") → false

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-10.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-10.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
