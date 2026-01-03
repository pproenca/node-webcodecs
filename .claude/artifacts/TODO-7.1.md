# Task Packet: TODO-7.1

> **Feature:** WebCodecs Spec Compliance - Check Configuration Support Algorithm
> **Assigned to:** Subagent 7.1
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that the Check Configuration Support algorithm (used by isConfigSupported) follows W3C spec section 7.1.

## Scope

### Files In Scope
- `lib/audio-decoder.ts` - AudioDecoder.isConfigSupported
- `lib/video-decoder.ts` - VideoDecoder.isConfigSupported
- `lib/audio-encoder.ts` - AudioEncoder.isConfigSupported
- `lib/video-encoder.ts` - VideoEncoder.isConfigSupported
- `src/*.cc` - Native isConfigSupported implementations
- `test/golden/*.test.ts` - isConfigSupported tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/image-decoder.ts` - Handled by TODO-10.x

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 7.1:
// Check Configuration Support algorithm:
// 1. If config is not valid, return false
// 2. If config.codec is not recognized, return false
// 3. If platform cannot support config, return false
// 4. Return true
```

### Outputs You Must Provide
```typescript
// Static methods on each codec class:
AudioDecoder.isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
VideoDecoder.isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
AudioEncoder.isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
VideoEncoder.isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;

// Each returns { supported: boolean, config: ClonedConfig }
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Return cloned config (not original) in result
- Run check on parallel queue (async)
- Support all FFmpeg-available codecs

### DO NOT
- Block main thread during check
- Return unsupported codec as supported

## Success Criteria
- [ ] All tests pass
- [ ] isConfigSupported returns Promise
- [ ] Result includes cloned config
- [ ] Supported codecs return supported: true
- [ ] Unsupported codecs return supported: false
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.1-check-configuration-support-with-config.md` - Algorithm spec
- `lib/video-encoder.ts` - Current isConfigSupported implementation

### Reference Only (Don't modify)
- FFmpeg codec availability

## Dependencies

### Waits For (Upstream)
- TODO-3.5, TODO-4.5, TODO-5.5, TODO-6.5: Codec methods

### Blocks (Downstream)
- TODO-7.3: Configuration support signalling

### Can Run In Parallel With
- TODO-7.2

## Test Requirements

### Unit Tests Required
1. AudioDecoder.isConfigSupported("mp4a.40.2") → supported: true
2. AudioDecoder.isConfigSupported("invalid") → supported: false
3. VideoDecoder.isConfigSupported("avc1.42001e") → supported: true
4. VideoEncoder.isConfigSupported with valid config → supported: true
5. Result config is a clone (not reference)

### Edge Cases to Test
1. Config with unknown optional fields (ignored)
2. Config at platform limits (max resolution)

### Error Cases to Test
1. Invalid config structure → rejects with TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.1.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.1.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
