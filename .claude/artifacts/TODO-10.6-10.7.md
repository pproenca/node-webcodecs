# Task Packet: TODO-10.6-10.7

> **Feature:** WebCodecs Spec Compliance - ImageTrackList and ImageTrack
> **Assigned to:** Subagent 10.6-10.7
> **Priority:** 3
> **Estimated complexity:** MEDIUM

## Objective
Verify ImageTrackList and ImageTrack interfaces per W3C spec sections 10.6-10.7.

## Scope

### Files In Scope
- `lib/image-track-list.ts` - ImageTrackList implementation
- `lib/image-track.ts` - ImageTrack implementation
- `test/golden/image-decoder.test.ts` - Track tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-decoder.ts` - Video tracks (different)

## Interface Contract

### Inputs You Will Receive
```typescript
// 10.6 ImageTrackList Interface
interface ImageTrackList {
  // 10.6.1 Internal Slots: [[tracks]], [[selected index]]
  // 10.6.2 Attributes:
  readonly attribute Promise<undefined> ready;
  readonly attribute unsigned long length;
  readonly attribute long selectedIndex;
  readonly attribute ImageTrack? selectedTrack;

  getter ImageTrack (unsigned long index);
};

// 10.7 ImageTrack Interface
interface ImageTrack {
  // 10.7.1 Internal Slots: [[animated]], [[frame count]], [[repetition count]], [[selected]]
  // 10.7.2 Attributes:
  readonly attribute boolean animated;
  readonly attribute unsigned long frameCount;
  readonly attribute float repetitionCount;
  attribute boolean selected;
};
```

### Outputs You Must Provide
```typescript
export class ImageTrackList {
  readonly ready: Promise<void>;
  readonly length: number;
  readonly selectedIndex: number;
  readonly selectedTrack: ImageTrack | null;

  // Array-like access
  [index: number]: ImageTrack;
}

export class ImageTrack {
  readonly animated: boolean;
  readonly frameCount: number;
  readonly repetitionCount: number;
  selected: boolean;  // writable to select track
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- ready Promise resolves when tracks parsed
- Static images: 1 track, 1 frame, not animated
- Animated images: 1+ tracks, N frames, animated=true
- repetitionCount: Infinity for loop forever

### DO NOT
- Allow invalid track selection
- Make repetitionCount writable

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] ImageTrackList indexable
- [ ] ready resolves when tracks available
- [ ] selectedTrack reflects selection
- [ ] ImageTrack.animated correct
- [ ] ImageTrack.frameCount correct
- [ ] ImageTrack.repetitionCount correct for loops
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/10-image-decoding/10.6-imagetracklist-interface/` - TrackList spec
- `docs/specs/10-image-decoding/10.7-imagetrack-interface/` - Track spec
- `lib/image-track-list.ts` - Current implementation
- `lib/image-track.ts` - Current implementation

### Reference Only (Don't modify)
- GIF animation specification

## Dependencies

### Waits For (Upstream)
- TODO-10.2: ImageDecoder.tracks

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-10.3-10.5

## Test Requirements

### Unit Tests Required
1. ImageTrackList.length is number
2. ImageTrackList[0] returns ImageTrack
3. ImageTrackList.ready resolves
4. ImageTrackList.selectedIndex is 0 by default
5. ImageTrackList.selectedTrack returns selected track
6. ImageTrack.animated false for static image
7. ImageTrack.animated true for GIF animation
8. ImageTrack.frameCount is 1 for static
9. ImageTrack.frameCount > 1 for animation
10. ImageTrack.repetitionCount is Infinity for loop forever
11. ImageTrack.selected can be set

### Edge Cases to Test
1. Single-frame "animated" GIF
2. APNG animation
3. WebP animation

### Error Cases to Test
1. Access track beyond length → undefined
2. Select track on closed decoder → error

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-10.6-10.7.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-10.6-10.7.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
