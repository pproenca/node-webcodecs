# Task Packet: TODO-3.5

> **Feature:** WebCodecs Spec Compliance - AudioDecoder Methods
> **Assigned to:** Subagent 3.5
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that AudioDecoder methods (configure, decode, flush, reset, close, isConfigSupported) follow the exact algorithms from W3C spec section 3.5.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - TypeScript method implementations
- `src/audio_decoder.cc` - Native method implementations
- `test/golden/audio-decoder.test.ts` - Method tests
- `test/contracts/decoder-state-machine.js` - State machine contracts

### Files Out of Scope (DO NOT MODIFY)
- `lib/video-decoder.ts` - Handled by TODO-4.5
- `lib/audio-encoder.ts` - Handled by TODO-5.5

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 3.5:
// configure(config): void - throws on invalid config or closed state
// decode(chunk): void - throws on unconfigured/closed, queues work
// flush(): Promise<void> - drains outputs, rejects on invalid state
// reset(): void - clears queue, resets state to unconfigured
// close(): void - releases resources, final state
// static isConfigSupported(config): Promise<AudioDecoderSupport>
```

### Outputs You Must Provide
```typescript
export class AudioDecoder {
  configure(config: AudioDecoderConfig): void;
  decode(chunk: EncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  static isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
}

interface AudioDecoderSupport {
  supported: boolean;
  config: AudioDecoderConfig;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify configure() throws TypeError for invalid config
- Verify configure() throws InvalidStateError when closed
- Verify decode() throws InvalidStateError when not configured
- Verify decode() requires key chunk after configure/reset
- Verify flush() returns Promise that resolves after outputs
- Verify reset() clears queue and resets state
- Verify close() is final (no operations after)

### DO NOT
- Allow operations after close()
- Skip key chunk validation
- Ignore control message queue ordering

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] configure() validates config and throws TypeError on invalid
- [ ] configure() throws InvalidStateError when closed
- [ ] configure() sets state to "configured"
- [ ] decode() throws InvalidStateError when unconfigured/closed
- [ ] decode() throws DataError if first chunk not key
- [ ] flush() resolves after all outputs emitted
- [ ] reset() resets to unconfigured state
- [ ] close() transitions to closed state
- [ ] isConfigSupported() returns Promise with support info
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/3-audiodecoder-interface/3.5-methods.md` - Method specs
- `lib/audio-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `test/contracts/encoder-state-machine.js` - Contract test patterns

## Dependencies

### Waits For (Upstream)
- TODO-3.1: Internal slots
- TODO-3.2: Constructor
- TODO-2.2: Control message definitions

### Blocks (Downstream)
- TODO-3.6: Algorithms use these methods

### Can Run In Parallel With
- TODO-4.5, TODO-5.5, TODO-6.5 (other codec methods)

## Test Requirements

### Unit Tests Required
1. configure() with valid config succeeds, state becomes "configured"
2. configure() with invalid config throws TypeError
3. configure() when closed throws InvalidStateError
4. decode() when unconfigured throws InvalidStateError
5. decode() when closed throws InvalidStateError
6. decode() first chunk must be key, else DataError
7. flush() resolves after all outputs
8. flush() when unconfigured rejects with InvalidStateError
9. reset() clears queue and resets state
10. close() transitions to closed state
11. isConfigSupported() returns supported: true for valid codec
12. isConfigSupported() returns supported: false for invalid codec

### Edge Cases to Test
1. flush() with no pending work (resolves immediately)
2. reset() during active decode
3. close() during flush
4. Multiple rapid decode() calls

### Error Cases to Test
1. configure() with missing codec → TypeError
2. decode() with delta chunk first → DataError
3. decode() after close() → InvalidStateError
4. flush() after close() → InvalidStateError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] State machine contracts pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-3.5.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-3.5.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
