# Task Packet: TODO-6.5

> **Feature:** WebCodecs Spec Compliance - VideoEncoder Methods
> **Assigned to:** Subagent 6.5
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that VideoEncoder methods follow W3C spec section 6.5, including video-specific encode options like keyFrame.

## Scope

### Files In Scope
- `lib/video-encoder.ts` - TypeScript method implementations
- `src/video_encoder.cc` - Native method implementations
- `test/golden/video-encoder.test.ts` - Method tests
- `test/contracts/encoder-state-machine.js` - State machine contracts

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Handled by TODO-5.5

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 6.5:
// configure(config: VideoEncoderConfig): void
// encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void
// flush(): Promise<void>
// reset(): void
// close(): void
// static isConfigSupported(config): Promise<VideoEncoderSupport>
```

### Outputs You Must Provide
```typescript
export class VideoEncoder {
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  static isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;
}

interface VideoEncoderConfig {
  codec: string;  // avc1.42001e, hvc1.*, vp09.*, av01.*
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  latencyMode?: 'quality' | 'realtime';
  bitrateMode?: 'constant' | 'variable' | 'quantizer';
  scalabilityMode?: string;  // L1T1, L1T2, L1T3, etc.
  alpha?: 'discard' | 'keep';
}

interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;  // Force key frame
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- encode() takes VideoFrame (raw video)
- Support keyFrame option to force I-frames
- Support scalabilityMode for SVC encoding
- Verify isConfigSupported() for video codecs

### DO NOT
- Skip keyFrame option
- Ignore scalabilityMode in config

## Success Criteria
- [ ] All tests pass
- [ ] configure() validates VideoEncoderConfig
- [ ] encode(frame, {keyFrame: true}) produces key frame
- [ ] configure() with scalabilityMode works
- [ ] isConfigSupported() works for avc1, vp09, av01
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/6-videoencoder-interface/6.5-methods.md` - Method specs
- `lib/video-encoder.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/audio-encoder.ts` - Similar pattern

## Dependencies

### Waits For (Upstream)
- TODO-6.1: Internal slots
- TODO-6.2: Constructor
- TODO-9.4: VideoFrame interface

### Blocks (Downstream)
- TODO-6.6: Algorithms
- TODO-6.7: EncodedVideoChunkMetadata

### Can Run In Parallel With
- TODO-3.5, TODO-4.5, TODO-5.5

## Test Requirements

### Unit Tests Required
1. configure() with H.264 config succeeds
2. configure() with VP9 config succeeds
3. encode() accepts VideoFrame
4. encode(frame, {keyFrame: true}) produces key frame
5. configure() with latencyMode 'realtime'
6. configure() with bitrateMode 'variable'
7. isConfigSupported("avc1.42001e") returns true

### Edge Cases to Test
1. encode() with VideoFrame that has different dimensions
2. scalabilityMode L1T2 (temporal layers)
3. alpha: 'keep' with alpha channel

### Error Cases to Test
1. configure() missing width → TypeError
2. configure() missing height → TypeError
3. encode() when unconfigured → InvalidStateError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] State machine contracts pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-6.5.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-6.5.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
