# Task Packet: TODO-4.1

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Internal Slots
> **Assigned to:** Subagent 4.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that all VideoDecoder internal slots from W3C spec section 4.1 are correctly implemented and initialized per spec.

## Scope

### Files In Scope
- `lib/video-decoder.ts` - TypeScript VideoDecoder wrapper
- `src/video_decoder.cc` - Native VideoDecoder implementation
- `src/video_decoder.h` - Native VideoDecoder header
- `test/golden/video-decoder.test.ts` - VideoDecoder tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.x
- `src/audio_decoder.cc` - Handled by TODO-3.x

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 4.1:
// Internal slots (same as AudioDecoder plus video-specific):
// [[control message queue]] - queue of control messages
// [[message queue blocked]] - boolean for queue blocking
// [[codec implementation]] - underlying decoder
// [[codec work queue]] - parallel queue for codec work
// [[codec saturated]] - boolean for saturation state
// [[output callback]] - callback for decoded VideoFrames
// [[error callback]] - callback for errors
// [[key chunk required]] - boolean for key frame requirement
// [[state]] - CodecState enum
// [[decodeQueueSize]] - pending decode count
// [[pending flush promises]] - list of flush promises
// [[dequeue event scheduled]] - boolean for event scheduling
```

### Outputs You Must Provide
```typescript
class VideoDecoder {
  get state(): CodecState;
  get decodeQueueSize(): number;

  private _controlQueue: ControlMessageQueue;
  private _needsKeyFrame: boolean;
  private _native: NativeVideoDecoder;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify all 12 internal slots are represented
- Verify constructor initializes slots per spec
- Note: VideoDecoder outputs VideoFrame, not AudioData

### DO NOT
- Confuse with AudioDecoder implementation
- Change decode/encode behavior (handled by TODO-4.5)

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All internal slots initialized per spec
- [ ] [[state]] initialized as "unconfigured"
- [ ] [[decodeQueueSize]] initialized as 0
- [ ] [[key chunk required]] initialized as true
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.1-internal-slots.md` - Spec slots
- `lib/video-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue

### Blocks (Downstream)
- TODO-4.2: Constructor
- TODO-4.5: Methods

### Can Run In Parallel With
- TODO-3.1, TODO-5.1, TODO-6.1

## Test Requirements

### Unit Tests Required
1. Constructor initializes state to "unconfigured"
2. Constructor initializes decodeQueueSize to 0
3. Constructor stores output callback (receives VideoFrame)
4. Constructor stores error callback
5. Key chunk required is true after construction

### Edge Cases to Test
1. Multiple instances independent
2. Output callback receives VideoFrame (not AudioData)

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
