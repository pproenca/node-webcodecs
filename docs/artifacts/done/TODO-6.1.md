# Task Packet: TODO-6.1

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Internal Slots
> **Assigned to:** Subagent 6.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that all VideoEncoder internal slots from W3C spec section 6.1 are correctly implemented, including video-specific slots like [[active orientation]].

## Scope

### Files In Scope
- `lib/video-encoder.ts` - TypeScript VideoEncoder wrapper
- `src/video_encoder.cc` - Native VideoEncoder implementation
- `test/golden/video-encoder.test.ts` - VideoEncoder tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.x
- `lib/video-decoder.ts` - Handled by TODO-4.x

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.1 (includes video-specific slots):
// [[control message queue]] - queue of control messages
// [[message queue blocked]] - boolean for queue blocking
// [[codec implementation]] - underlying encoder
// [[codec work queue]] - parallel queue for codec work
// [[codec saturated]] - boolean for saturation state
// [[output callback]] - callback for EncodedVideoChunk outputs
// [[error callback]] - callback for errors
// [[active encoder config]] - VideoEncoderConfig actively applied
// [[active output config]] - VideoDecoderConfig for decoding output
// [[state]] - CodecState enum
// [[encodeQueueSize]] - pending encode count
// [[pending flush promises]] - list of flush promises
// [[dequeue event scheduled]] - boolean for event scheduling
// [[active orientation]] - flip and rotation of first frame (VIDEO-SPECIFIC)
```

### Outputs You Must Provide
```typescript
class VideoEncoder {
  get state(): CodecState;
  get encodeQueueSize(): number;

  private _controlQueue: ControlMessageQueue;
  private _activeEncoderConfig: VideoEncoderConfig | null;
  private _activeOutputConfig: VideoDecoderConfig | null;
  private _activeOrientation: { flip: boolean; rotation: number } | null;
  private _native: NativeVideoEncoder;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Note [[active orientation]] is video-specific (not in AudioEncoder)
- Track flip and rotation from first VideoFrame after configure

### DO NOT
- Confuse with AudioEncoder slots
- Skip [[active orientation]] tracking

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All 14 internal slots initialized per spec
- [ ] [[active orientation]] tracks first frame's flip/rotation
- [ ] [[state]] initialized as "unconfigured"
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.1-internal-slots.md` - Spec slots
- `lib/video-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar pattern without orientation

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue

### Blocks (Downstream)
- TODO-6.2: Constructor
- TODO-6.5: Methods

### Can Run In Parallel With
- TODO-3.1, TODO-4.1, TODO-5.1

## Test Requirements

### Unit Tests Required
1. Constructor initializes state to "unconfigured"
2. Constructor initializes encodeQueueSize to 0
3. [[active orientation]] is null before first encode
4. [[active orientation]] set from first VideoFrame
5. [[active encoder config]] set after configure

### Edge Cases to Test
1. VideoFrame with rotation
2. VideoFrame with flip
3. Multiple configure() calls

### Error Cases to Test
1. Missing output callback → TypeError
2. Missing error callback → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
