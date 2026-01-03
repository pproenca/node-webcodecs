# Task Packet: TODO-9.5-9.8

> **Feature:** WebCodecs Spec Compliance - VideoFrame CopyTo, DOMRects, PlaneLayout, PixelFormat
> **Assigned to:** Subagent 9.5-9.8
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify VideoFrame copy options, DOMRect handling, plane layout, and pixel formats per W3C spec sections 9.5-9.8.

## Scope

### Files In Scope
- `lib/video-frame.ts` - VideoFrame copyTo and related
- `lib/types.ts` - Type definitions
- `test/golden/video-frame.test.ts` - Tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// 9.5 VideoFrame CopyTo Options
dictionary VideoFrameCopyToOptions {
  DOMRectInit rect;
  sequence<PlaneLayout> layout;
  VideoPixelFormat format;  // Convert to different format
  PredefinedColorSpace colorSpace;
};

// 9.6 DOMRects in VideoFrame
// codedRect: full coded dimensions
// visibleRect: visible portion (may be cropped)

// 9.7 PlaneLayout
dictionary PlaneLayout {
  required unsigned long offset;
  required unsigned long stride;
};

// 9.8 Pixel Format
enum VideoPixelFormat {
  "I420", "I420A", "I422", "I444", "NV12", "RGBA", "RGBX", "BGRA", "BGRX"
};
```

### Outputs You Must Provide
```typescript
export interface VideoFrameCopyToOptions {
  rect?: DOMRectInit;
  layout?: PlaneLayout[];
  format?: VideoPixelFormat;
  colorSpace?: PredefinedColorSpace;
}

export interface PlaneLayout {
  offset: number;
  stride: number;
}

export type VideoPixelFormat =
  | 'I420'   // YUV 4:2:0 planar
  | 'I420A'  // YUV 4:2:0 + alpha planar
  | 'I422'   // YUV 4:2:2 planar
  | 'I444'   // YUV 4:4:4 planar
  | 'NV12'   // YUV 4:2:0 semi-planar (Y plane + interleaved UV)
  | 'RGBA'   // RGBA interleaved
  | 'RGBX'   // RGBX interleaved (alpha ignored)
  | 'BGRA'   // BGRA interleaved
  | 'BGRX';  // BGRX interleaved (alpha ignored)

export type PredefinedColorSpace = 'srgb' | 'display-p3';
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Support format conversion in copyTo
- Support rect for partial copy
- Support custom layout for non-standard stride
- All VideoPixelFormat values per spec

### DO NOT
- Add pixel formats not in spec
- Ignore stride in layout

## Success Criteria
- [ ] All tests pass
- [ ] All 9 pixel formats defined
- [ ] copyTo with rect crops correctly
- [ ] copyTo with layout uses custom stride
- [ ] copyTo with format converts
- [ ] PlaneLayout used correctly
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.5-videoframe-copyto-options.md`
- `docs/specs/9-raw-media-interfaces/9.6-domrects-in-videoframe.md`
- `docs/specs/9-raw-media-interfaces/9.7-plane-layout.md`
- `docs/specs/9-raw-media-interfaces/9.8-pixel-format.md`
- `lib/video-frame.ts` - Current implementation

### Reference Only (Don't modify)
- FFmpeg pixel format mappings

## Dependencies

### Waits For (Upstream)
- TODO-9.4: VideoFrame interface

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-9.9

## Test Requirements

### Unit Tests Required
1. copyTo with no options copies full frame
2. copyTo with rect copies subset
3. copyTo with layout uses custom stride
4. copyTo with format converts (I420 → RGBA)
5. All pixel formats recognized
6. I420: 3 planes (Y, U, V)
7. NV12: 2 planes (Y, UV interleaved)
8. RGBA: 1 plane (interleaved)

### Edge Cases to Test
1. Odd-sized frames for 4:2:0 formats
2. Custom stride > width
3. Format conversion with colorSpace

### Error Cases to Test
1. Invalid rect → RangeError
2. Invalid format → TypeError
3. Layout plane count mismatch → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.5-9.8.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.5-9.8.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
