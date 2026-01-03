# Task Packet: TODO-5.1

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Internal Slots
> **Assigned to:** Subagent 5.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that all AudioEncoder internal slots from W3C spec section 5.1 are correctly implemented, noting encoder-specific slots like [[active encoder config]] and [[active output config]].

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - TypeScript AudioEncoder wrapper
- `src/audio_encoder.cc` - Native AudioEncoder implementation
- `test/golden/audio-encoder.test.ts` - AudioEncoder tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.x
- `lib/video-encoder.ts` - Handled by TODO-6.x

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.1 (encoder-specific slots):
// [[control message queue]] - queue of control messages
// [[message queue blocked]] - boolean for queue blocking
// [[codec implementation]] - underlying encoder
// [[codec work queue]] - parallel queue for codec work
// [[codec saturated]] - boolean for saturation state
// [[output callback]] - callback for EncodedAudioChunk outputs
// [[error callback]] - callback for errors
// [[active encoder config]] - AudioEncoderConfig actively applied
// [[active output config]] - AudioDecoderConfig for decoding output
// [[state]] - CodecState enum
// [[encodeQueueSize]] - pending encode count (NOT decodeQueueSize)
// [[pending flush promises]] - list of flush promises
// [[dequeue event scheduled]] - boolean for event scheduling
```

### Outputs You Must Provide
```typescript
class AudioEncoder {
  get state(): CodecState;
  get encodeQueueSize(): number;  // Note: encodeQueueSize not decodeQueueSize

  private _controlQueue: ControlMessageQueue;
  private _activeEncoderConfig: AudioEncoderConfig | null;
  private _activeOutputConfig: AudioDecoderConfig | null;
  private _native: NativeAudioEncoder;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Note encoder uses encodeQueueSize (not decodeQueueSize)
- Verify [[active encoder config]] tracks current config
- Verify [[active output config]] provides decoder config for output

### DO NOT
- Confuse with decoder slots
- Skip [[active output config]] (needed for decoder interop)

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] [[encodeQueueSize]] initialized as 0
- [ ] [[active encoder config]] is null until configure
- [ ] [[active output config]] populated after first encode output
- [ ] [[state]] initialized as "unconfigured"
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.1-internal-slots.md` - Spec slots
- `lib/audio-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Decoder pattern comparison

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue

### Blocks (Downstream)
- TODO-5.2: Constructor
- TODO-5.5: Methods

### Can Run In Parallel With
- TODO-3.1, TODO-4.1, TODO-6.1

## Test Requirements

### Unit Tests Required
1. Constructor initializes state to "unconfigured"
2. Constructor initializes encodeQueueSize to 0
3. [[active encoder config]] is null before configure
4. [[active encoder config]] set after configure
5. [[active output config]] provided with first output

### Edge Cases to Test
1. Multiple configure() calls update [[active encoder config]]
2. [[active output config]] changes if codec settings change

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
