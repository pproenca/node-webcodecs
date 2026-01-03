# Task Packet: TODO-5.5

> **Feature:** WebCodecs Spec Compliance - AudioEncoder Methods
> **Assigned to:** Subagent 5.5
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that AudioEncoder methods (configure, encode, flush, reset, close, isConfigSupported) follow W3C spec section 5.5.

## Scope

### Files In Scope
- `lib/audio-encoder.ts` - TypeScript method implementations
- `src/audio_encoder.cc` - Native method implementations
- `test/golden/audio-encoder.test.ts` - Method tests
- `test/contracts/encoder-state-machine.js` - State machine contracts

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-decoder.ts` - Handled by TODO-3.5

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 5.5:
// configure(config: AudioEncoderConfig): void
// encode(data: AudioData): void - NOT EncodedAudioChunk
// flush(): Promise<void>
// reset(): void
// close(): void
// static isConfigSupported(config): Promise<AudioEncoderSupport>
```

### Outputs You Must Provide
```typescript
export class AudioEncoder {
  configure(config: AudioEncoderConfig): void;
  encode(data: AudioData): void;  // Input is raw AudioData
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  static isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
}

interface AudioEncoderConfig {
  codec: string;  // e.g., "mp4a.40.2", "opus"
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- encode() takes AudioData (raw audio), outputs EncodedAudioChunk
- Verify configure() validates AudioEncoderConfig
- Verify isConfigSupported() for audio codecs (aac, opus, mp3)

### DO NOT
- Confuse encode() input type (AudioData, not EncodedAudioChunk)
- Skip bitrate validation when provided

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] configure() validates AudioEncoderConfig
- [ ] encode() accepts AudioData
- [ ] encode() throws InvalidStateError when unconfigured
- [ ] flush() resolves after all EncodedAudioChunks emitted
- [ ] isConfigSupported() works for aac, opus
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/5-audioencoder-interface/5.5-methods.md` - Method specs
- `lib/audio-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-decoder.ts` - Similar pattern (but decode takes EncodedAudioChunk)

## Dependencies

### Waits For (Upstream)
- TODO-5.1: Internal slots
- TODO-5.2: Constructor
- TODO-9.2: AudioData interface

### Blocks (Downstream)
- TODO-5.6: Algorithms
- TODO-5.7: EncodedAudioChunkMetadata

### Can Run In Parallel With
- TODO-3.5, TODO-4.5, TODO-6.5

## Test Requirements

### Unit Tests Required
1. configure() with valid AAC config succeeds
2. configure() with valid Opus config succeeds
3. encode() accepts AudioData
4. encode() when unconfigured throws InvalidStateError
5. flush() resolves after outputs
6. isConfigSupported("mp4a.40.2") returns true
7. isConfigSupported("opus") returns true

### Edge Cases to Test
1. encode() with AudioData that has different sample rate than config
2. encode() with stereo when config is mono
3. bitrate specified vs. default

### Error Cases to Test
1. configure() missing sampleRate → TypeError
2. configure() missing numberOfChannels → TypeError
3. encode() with closed AudioData → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] State machine contracts pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-5.5.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-5.5.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
