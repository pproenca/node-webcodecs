# Task Packet: TODO-2.2

> **Feature:** WebCodecs Spec Compliance - Control Messages
> **Assigned to:** Subagent 2.2
> **Priority:** 1
> **Estimated complexity:** MEDIUM

## Objective
Verify that control messages for configure, encode/decode, flush, reset, and close operations are correctly defined and sequenced per W3C spec section 2.2.

## Scope

### Files In Scope
- `lib/codec-base.ts` - Control message definitions in base codec
- `lib/control-message-queue.ts` - Queue that processes messages
- `test/contracts/` - State machine contract tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-encoder.ts` - Specific implementations (handled by TODO-6.x)
- `lib/audio-decoder.ts` - Specific implementations (handled by TODO-3.x)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 2.2:
// Control message types:
// - Configure: Sets codec configuration
// - Encode/Decode: Processes media data
// - Flush: Drains pending outputs
// - Reset: Returns to unconfigured state
// - Close: Releases all resources

// Message blocking behavior:
// - Configure blocks until configuration complete
// - Flush blocks until all outputs emitted
// - Reset/Close clear pending messages
```

### Outputs You Must Provide
```typescript
// Each codec method should enqueue corresponding control message:
// configure() -> enqueues configure message
// encode()/decode() -> enqueues encode/decode message
// flush() -> enqueues flush message (returns Promise)
// reset() -> clears queue, enqueues reset message
// close() -> clears queue, enqueues close message
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify configure() blocks queue until complete
- Verify flush() returns Promise that resolves when all outputs emitted
- Verify reset() clears pending messages before resetting
- Verify close() clears pending messages before closing

### DO NOT
- Modify specific codec implementations
- Change native C++ code
- Allow operations after close()

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] Configure message blocks subsequent messages
- [ ] Flush message blocks until outputs complete
- [ ] Reset clears queue then resets
- [ ] Close clears queue then closes
- [ ] No operations allowed after close
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/2-codec-processing-model/2.2-control-messages.md` - Spec for control messages
- `lib/codec-base.ts` - Current base implementation

### Reference Only (Don't modify)
- `test/contracts/encoder-state-machine.js` - State machine tests

## Dependencies

### Waits For (Upstream)
- TODO-2.1: Control message queue implementation

### Blocks (Downstream)
- TODO-3.5: AudioDecoder methods
- TODO-4.5: VideoDecoder methods
- TODO-5.5: AudioEncoder methods
- TODO-6.5: VideoEncoder methods

### Can Run In Parallel With
- TODO-1, TODO-2.3

## Test Requirements

### Unit Tests Required
1. Configure message blocks queue processing
2. Encode/decode messages processed in order
3. Flush returns Promise resolved when outputs complete
4. Reset clears queue before reset
5. Close clears queue before close

### Edge Cases to Test
1. configure() called while encode() pending
2. flush() called with no pending work
3. reset() called during flush()
4. close() called during encode()

### Error Cases to Test
1. encode() after close() → InvalidStateError
2. configure() after close() → InvalidStateError
3. flush() after close() → InvalidStateError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-2.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-2.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
