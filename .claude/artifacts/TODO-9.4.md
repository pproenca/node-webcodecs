# Task Packet: TODO-9.4

> **Feature:** WebCodecs Spec Compliance - VideoFrame Interface
> **Assigned to:** Subagent 9.4
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that VideoFrame interface is correctly implemented per W3C spec section 9.4 (9.4.1-9.4.8).

## Scope

### Files In Scope
- `lib/video-frame.ts` - VideoFrame implementation
- `src/video_frame.cc` - Native VideoFrame
- `test/golden/video-frame.test.ts` - VideoFrame tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-encoder.ts` - Uses VideoFrame (handled by TODO-6.x)
- `lib/video-decoder.ts` - Produces VideoFrame (handled by TODO-4.x)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 9.4:

// 9.4.1 Internal Slots (many - see spec)

// 9.4.2 Constructors:
constructor(image: CanvasImageSource, init?: VideoFrameInit);
constructor(data: BufferSource, init: VideoFrameBufferInit);

// 9.4.3 Attributes:
readonly attribute VideoPixelFormat? format;
readonly attribute unsigned long codedWidth;
readonly attribute unsigned long codedHeight;
readonly attribute DOMRectReadOnly? codedRect;
readonly attribute DOMRectReadOnly? visibleRect;
readonly attribute unsigned long displayWidth;
readonly attribute unsigned long displayHeight;
readonly attribute unsigned long long? duration;
readonly attribute long long timestamp;
readonly attribute VideoColorSpace colorSpace;

// 9.4.5 Methods:
VideoFrameMetadata metadata();
unsigned long allocationSize(options?: VideoFrameCopyToOptions);
Promise<sequence<PlaneLayout>> copyTo(destination: BufferSource, options?: VideoFrameCopyToOptions);
VideoFrame clone();
void close();
```

### Outputs You Must Provide
```typescript
export interface VideoFrameInit {
  duration?: number;
  timestamp: number;
  alpha?: AlphaOption;
  visibleRect?: DOMRectInit;
  displayWidth?: number;
  displayHeight?: number;
  colorSpace?: VideoColorSpaceInit;
}

export interface VideoFrameBufferInit extends VideoFrameInit {
  format: VideoPixelFormat;
  codedWidth: number;
  codedHeight: number;
  layout?: PlaneLayout[];
}

export class VideoFrame {
  constructor(data: ArrayBuffer | ArrayBufferView, init: VideoFrameBufferInit);

  readonly format: VideoPixelFormat | null;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly codedRect: DOMRectReadOnly | null;
  readonly visibleRect: DOMRectReadOnly | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly duration: number | null;
  readonly timestamp: number;
  readonly colorSpace: VideoColorSpace;

  metadata(): VideoFrameMetadata;
  allocationSize(options?: VideoFrameCopyToOptions): number;
  copyTo(destination: ArrayBuffer | ArrayBufferView, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]>;
  clone(): VideoFrame;
  close(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Support all VideoPixelFormat values
- Support codedRect vs visibleRect distinction
- Support displayWidth/Height for aspect ratio
- Support colorSpace information
- copyTo returns Promise (async for GPU frames)

### DO NOT
- Allow operations after close()
- Leak GPU/memory resources

## Success Criteria
- [ ] All tests pass
- [ ] Constructor from buffer works
- [ ] All attributes accessible
- [ ] copyTo copies pixel data
- [ ] clone() works per memory model
- [ ] close() releases resources
- [ ] colorSpace information preserved
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.4-videoframe-interface/` - Full spec
- `lib/video-frame.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-data.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-9.1: Memory model
- TODO-9.8: Pixel format
- TODO-9.9: VideoColorSpace

### Blocks (Downstream)
- TODO-6.x: VideoEncoder.encode() takes VideoFrame
- TODO-4.x: VideoDecoder outputs VideoFrame

### Can Run In Parallel With
- TODO-9.2 (AudioData)

## Test Requirements

### Unit Tests Required
1. Constructor with buffer succeeds
2. format is readonly
3. codedWidth/codedHeight correct
4. visibleRect defaults to full frame
5. displayWidth/displayHeight for aspect ratio
6. timestamp required
7. duration optional
8. copyTo copies pixels
9. clone() works
10. close() works
11. colorSpace preserved

### Edge Cases to Test
1. Frame with non-square pixels (displayWidth ≠ codedWidth)
2. Frame with visible crop (visibleRect smaller)
3. Different pixel formats (I420, NV12, RGBA)

### Error Cases to Test
1. Missing format → TypeError
2. Missing dimensions → TypeError
3. copyTo after close → InvalidStateError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
