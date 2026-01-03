# Task Packet: TODO-7.3

> **Feature:** WebCodecs Spec Compliance - Signalling Configuration Support Types
> **Assigned to:** Subagent 7.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that all *Support types (AudioDecoderSupport, VideoDecoderSupport, AudioEncoderSupport, VideoEncoderSupport) are correctly defined per W3C spec sections 7.3.1-7.3.4.

## Scope

### Files In Scope
- `lib/types.ts` - Type definitions
- `test/golden/*.test.ts` - Type usage tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec sections 7.3.1-7.3.4:
dictionary AudioDecoderSupport {
  boolean supported;
  AudioDecoderConfig config;
};

dictionary VideoDecoderSupport {
  boolean supported;
  VideoDecoderConfig config;
};

dictionary AudioEncoderSupport {
  boolean supported;
  AudioEncoderConfig config;
};

dictionary VideoEncoderSupport {
  boolean supported;
  VideoEncoderConfig config;
};
```

### Outputs You Must Provide
```typescript
export interface AudioDecoderSupport {
  supported: boolean;
  config: AudioDecoderConfig;
}

export interface VideoDecoderSupport {
  supported: boolean;
  config: VideoDecoderConfig;
}

export interface AudioEncoderSupport {
  supported: boolean;
  config: AudioEncoderConfig;
}

export interface VideoEncoderSupport {
  supported: boolean;
  config: VideoEncoderConfig;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Export all four Support types
- Ensure config is cloned (not original reference)

### DO NOT
- Add extra fields not in spec
- Make fields optional that are required

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All four Support types exported
- [ ] isConfigSupported returns correct type
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.3-signalling-configuration-support/` - Support type specs
- `lib/types.ts` - Current type definitions

### Reference Only (Don't modify)
- Browser WebCodecs implementations

## Dependencies

### Waits For (Upstream)
- TODO-7.1: Check Configuration Support algorithm
- TODO-7.2: Clone Configuration algorithm

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-7.4, TODO-7.5, TODO-7.6, TODO-7.7, TODO-7.8

## Test Requirements

### Unit Tests Required
1. AudioDecoderSupport has supported and config
2. VideoDecoderSupport has supported and config
3. AudioEncoderSupport has supported and config
4. VideoEncoderSupport has supported and config
5. config field is properly typed

### Edge Cases to Test
1. supported: false with partial config

### Error Cases to Test
1. (Type system handles errors)

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
