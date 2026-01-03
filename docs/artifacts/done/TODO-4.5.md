# Task Packet: TODO-4.5

> **Feature:** WebCodecs Spec Compliance - VideoDecoder Methods
> **Assigned to:** Subagent 4.5
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that VideoDecoder methods (configure, decode, flush, reset, close, isConfigSupported) follow the exact algorithms from W3C spec section 4.5.

## Scope

### Files In Scope
- `lib/video-decoder.ts` - TypeScript method implementations
- `src/video_decoder.cc` - Native method implementations
- `test/golden/video-decoder.test.ts` - Method tests
- `test/contracts/decoder-state-machine.js` - State machine contracts

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.5

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 4.5:
// configure(config: VideoDecoderConfig): void
// decode(chunk: EncodedVideoChunk): void
// flush(): Promise<void>
// reset(): void
// close(): void
// static isConfigSupported(config): Promise<VideoDecoderSupport>
```

### Outputs You Must Provide
```typescript
export class VideoDecoder {
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  static isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
}

interface VideoDecoderSupport {
  supported: boolean;
  config: VideoDecoderConfig;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Verify configure() validates VideoDecoderConfig (codec, codedWidth, codedHeight)
- Verify decode() accepts EncodedVideoChunk
- Verify flush() drains VideoFrame outputs
- Verify isConfigSupported() checks video codecs (avc1, hvc1, vp09, av01)

### DO NOT
- Skip codec string validation for video
- Ignore description field in config

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] configure() validates VideoDecoderConfig
- [ ] decode() throws InvalidStateError when unconfigured/closed
- [ ] decode() requires key chunk after configure/reset
- [ ] flush() resolves after all VideoFrames emitted
- [ ] reset() resets state
- [ ] close() is final
- [ ] isConfigSupported() works for video codecs
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/4-videodecoder-interface/4.5-methods.md` - Method specs
- `lib/video-decoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-4.1: Internal slots
- TODO-4.2: Constructor

### Blocks (Downstream)
- TODO-4.6: Algorithms

### Can Run In Parallel With
- TODO-3.5, TODO-5.5, TODO-6.5

## Test Requirements

### Unit Tests Required
1. configure() with valid H.264 config succeeds
2. configure() with valid VP9 config succeeds
3. configure() with invalid codec throws NotSupportedError
4. decode() when unconfigured throws InvalidStateError
5. decode() first chunk must be key
6. flush() resolves after all VideoFrames
7. reset() clears state
8. close() transitions to closed
9. isConfigSupported() returns true for avc1.42001e
10. isConfigSupported() returns false for invalid codec

### Edge Cases to Test
1. Config with description (out-of-band codec data)
2. Config with colorSpace hints
3. Decoding interlaced video

### Error Cases to Test
1. configure() missing codedWidth → TypeError
2. configure() missing codedHeight → TypeError
3. decode() with delta first → DataError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] State machine contracts pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-4.5.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-4.5.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
