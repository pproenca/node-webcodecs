# Task Packet: TODO-3.1

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Internal Slots
> **Assigned to:** Subagent 3.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that all AudioDecoder internal slots from W3C spec section 3.1 are correctly implemented and initialized per spec.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - TypeScript AudioDecoder wrapper
- `src/audio_decoder.cc` - Native AudioDecoder implementation
- `src/audio_decoder.h` - Native AudioDecoder header
- `test/golden/audio-decoder.test.ts` - AudioDecoder tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-decoder.ts` - Handled by TODO-4.x
- `src/video_decoder.cc` - Handled by TODO-4.x

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 3.1:
// Internal slots to verify:
// [[control message queue]] - queue of control messages
// [[message queue blocked]] - boolean for queue blocking
// [[codec implementation]] - underlying decoder
// [[codec work queue]] - parallel queue for codec work
// [[codec saturated]] - boolean for saturation state
// [[output callback]] - callback for decoded outputs
// [[error callback]] - callback for errors
// [[key chunk required]] - boolean for key frame requirement
// [[state]] - CodecState enum
// [[decodeQueueSize]] - pending decode count
// [[pending flush promises]] - list of flush promises
// [[dequeue event scheduled]] - boolean for event scheduling
```

### Outputs You Must Provide
```typescript
// AudioDecoder must have these internal state tracking:
class AudioDecoder {
  // Exposed attributes
  get state(): CodecState;
  get decodeQueueSize(): number;

  // Internal state (private)
  private _controlQueue: ControlMessageQueue;  // [[control message queue]]
  private _needsKeyFrame: boolean;             // [[key chunk required]]
  private _native: NativeAudioDecoder;         // [[codec implementation]]
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify all 12 internal slots are represented
- Verify constructor initializes slots per spec step-by-step
- Test state transitions per spec

### DO NOT
- Change decode/encode behavior (handled by TODO-3.5)
- Modify native C++ structure without corresponding TS changes
- Add slots not defined in spec

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] [[control message queue]] initialized as empty queue
- [ ] [[message queue blocked]] initialized as false
- [ ] [[codec implementation]] initialized as null (until configure)
- [ ] [[codec saturated]] initialized as false
- [ ] [[key chunk required]] initialized as true
- [ ] [[state]] initialized as "unconfigured"
- [ ] [[decodeQueueSize]] initialized as 0
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.1-internal-slots.md` - Spec slots
- `docs/specs/3-audiodecoder-interface/3.2-constructors.md` - Constructor steps
- `lib/audio-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/codec-base.ts` - Base class pattern

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue implementation

### Blocks (Downstream)
- TODO-3.2: Constructor depends on slots
- TODO-3.5: Methods depend on slots

### Can Run In Parallel With
- TODO-4.1, TODO-5.1, TODO-6.1 (other codec internal slots)

## Test Requirements

### Unit Tests Required
1. Constructor initializes state to "unconfigured"
2. Constructor initializes decodeQueueSize to 0
3. Constructor stores output callback
4. Constructor stores error callback
5. Key chunk required is true after construction

### Edge Cases to Test
1. Multiple AudioDecoder instances have independent state
2. Constructor with minimal valid init

### Error Cases to Test
1. Constructor with missing output callback → TypeError
2. Constructor with missing error callback → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
