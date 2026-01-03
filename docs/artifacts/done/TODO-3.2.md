# Task Packet: TODO-3.2

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Constructor
> **Assigned to:** Subagent 3.2
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that AudioDecoder constructor follows the exact 14-step algorithm from W3C spec section 3.2.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - TypeScript AudioDecoder constructor
- `test/golden/audio-decoder.test.ts` - Constructor tests

### Files Out of Scope (DO NOT MODIFY)
- `src/audio_decoder.cc` - Native implementation (handled by native tasks)
- `lib/video-decoder.ts` - Handled by TODO-4.2

## Interface Contract

### Inputs You Will Receive
```typescript
// AudioDecoderInit from W3C spec:
interface AudioDecoderInit {
  output: AudioDecoderOutputCallback;
  error: WebCodecsErrorCallback;
}

type AudioDecoderOutputCallback = (output: AudioData) => void;
type WebCodecsErrorCallback = (error: DOMException) => void;
```

### Outputs You Must Provide
```typescript
// Constructor must execute these steps in order:
// 1. Create new AudioDecoder object
// 2. Assign new queue to [[control message queue]]
// 3. Assign false to [[message queue blocked]]
// 4. Assign null to [[codec implementation]]
// 5. Start new parallel queue for [[codec work queue]]
// 6. Assign false to [[codec saturated]]
// 7. Assign init.output to [[output callback]]
// 8. Assign init.error to [[error callback]]
// 9. Assign true to [[key chunk required]]
// 10. Assign "unconfigured" to [[state]]
// 11. Assign 0 to [[decodeQueueSize]]
// 12. Assign new list to [[pending flush promises]]
// 13. Assign false to [[dequeue event scheduled]]
// 14. Return decoder

export class AudioDecoder {
  constructor(init: AudioDecoderInit);
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify each step of the 14-step algorithm
- Ensure callbacks are stored correctly
- Ensure initial state is "unconfigured"

### DO NOT
- Modify configure/decode/flush behavior
- Change native constructor interface
- Skip any initialization steps

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Constructor accepts AudioDecoderInit
- [ ] State is "unconfigured" after construction
- [ ] decodeQueueSize is 0 after construction
- [ ] Callbacks stored and invocable
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.2-constructors.md` - Constructor spec
- `lib/audio-decoder.ts` - Current constructor

### Reference Only (Don't modify)
- `lib/video-decoder.ts` - Similar constructor pattern

## Dependencies

### Waits For (Upstream)
- TODO-3.1: Internal slots definition

### Blocks (Downstream)
- TODO-3.5: Methods use constructor-initialized state

### Can Run In Parallel With
- TODO-4.2, TODO-5.2, TODO-6.2 (other codec constructors)

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. State is "unconfigured" immediately after construction
3. decodeQueueSize is 0 immediately after construction
4. output callback is invoked when decode produces output
5. error callback is invoked on errors

### Edge Cases to Test
1. Multiple decoder instances created simultaneously
2. Callbacks that throw errors

### Error Cases to Test
1. Constructor called with undefined → TypeError
2. Constructor called with missing output → TypeError
3. Constructor called with missing error → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
