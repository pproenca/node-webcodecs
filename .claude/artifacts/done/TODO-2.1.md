# Task Packet: TODO-2.1

> **Feature:** WebCodecs Spec Compliance - Codec Processing Model Background
> **Assigned to:** Subagent 2.1
> **Priority:** 1
> **Estimated complexity:** MEDIUM

## Objective
Verify that the background concepts of the Codec Processing Model (control messages, queuing, event loop integration) are correctly implemented per W3C spec section 2.1.

## Scope

### Files In Scope
- `lib/control-message-queue.ts` - Control message queue implementation
- `lib/codec-base.ts` - Base codec class using control messages
- `test/unit/control-message-queue.test.ts` - Queue tests (create if missing)

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-encoder.ts` - Specific codec (handled by TODO-6.x)
- `lib/audio-decoder.ts` - Specific codec (handled by TODO-3.x)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 2.1:
// - Control messages are queued, not executed immediately
// - Processing is non-blocking
// - Messages processed in FIFO order
```

### Outputs You Must Provide
```typescript
// ControlMessageQueue must implement:
export class ControlMessageQueue {
  enqueue(message: () => void | Promise<void>): void;
  flush(): Promise<void>;
  clear(): void;
  get size(): number;
  setErrorHandler(handler: (error: Error | DOMException) => void): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify FIFO message ordering
- Verify non-blocking behavior (enqueue returns immediately)
- Test error propagation to error callback
- Test queue clear on reset/close

### DO NOT
- Modify specific codec implementations
- Change native C++ code
- Add blocking synchronous operations to queue

## Success Criteria
- [x] All tests pass
- [x] Type check passes
- [x] FIFO ordering verified with multiple messages
- [x] Non-blocking enqueue verified (returns before processing)
- [x] Error handling verified (errors go to errorHandler)
- [x] Queue clear verified (all messages removed)
- [x] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/2-codec-processing-model/2.1-background.md` - Spec background
- `lib/control-message-queue.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/codec-base.ts` - How queue is used by codecs

## Dependencies

### Waits For (Upstream)
- None

### Blocks (Downstream)
- TODO-3.x: AudioDecoder uses control message queue
- TODO-4.x: VideoDecoder uses control message queue
- TODO-5.x: AudioEncoder uses control message queue
- TODO-6.x: VideoEncoder uses control message queue

### Can Run In Parallel With
- TODO-1, TODO-2.2, TODO-2.3

## Test Requirements

### Unit Tests Required
1. Messages processed in FIFO order
2. Enqueue returns immediately (non-blocking)
3. Flush waits for all messages to complete
4. Clear removes all pending messages
5. Error handler receives processing errors

### Edge Cases to Test
1. Enqueue during message processing
2. Multiple rapid enqueues
3. Async message that throws

### Error Cases to Test
1. Message throws Error → errorHandler called with Error
2. Message throws DOMException → errorHandler called with DOMException
3. No errorHandler set → error logged to console

## Completion Checklist
- [x] Tests written (RED)
- [x] Tests fail as expected
- [x] Implementation complete (GREEN)
- [x] All tests pass
- [x] Refactored if needed (BLUE)
- [x] No TypeScript errors
- [x] No lint errors
- [x] Artifact handoff created at `.claude/artifacts/TODO-2.1-handoff.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-2.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
