# Task Packet: TODO-7.9-7.16

> **Feature:** WebCodecs Spec Compliance - Configuration Enums and Options
> **Assigned to:** Subagent 7.9-7.16
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that all configuration enums and option types (HardwareAcceleration, AlphaOption, LatencyMode, VideoEncoderEncodeOptions, BitrateMode, CodecState, WebCodecsErrorCallback) are correctly defined per W3C spec sections 7.9-7.16.

## Scope

### Files In Scope
- `lib/types.ts` - Type definitions
- `test/golden/*.test.ts` - Type usage tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec sections 7.9-7.16:

// 7.9 HardwareAcceleration
enum HardwareAcceleration {
  "no-preference",
  "prefer-hardware",
  "prefer-software"
};

// 7.10 AlphaOption
enum AlphaOption {
  "discard",
  "keep"
};

// 7.11 LatencyMode
enum LatencyMode {
  "quality",
  "realtime"
};

// 7.12 Configuration Equivalence (algorithm, not type)

// 7.13 VideoEncoderEncodeOptions
dictionary VideoEncoderEncodeOptions {
  boolean keyFrame = false;
};

// 7.14 VideoEncoderBitrateMode
enum VideoEncoderBitrateMode {
  "constant",
  "variable",
  "quantizer"
};

// 7.15 CodecState
enum CodecState {
  "unconfigured",
  "configured",
  "closed"
};

// 7.16 WebCodecsErrorCallback
callback WebCodecsErrorCallback = undefined (DOMException error);
```

### Outputs You Must Provide
```typescript
export type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';

export type AlphaOption = 'discard' | 'keep';

export type LatencyMode = 'quality' | 'realtime';

export interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;  // default false
}

export type VideoEncoderBitrateMode = 'constant' | 'variable' | 'quantizer';

export type CodecState = 'unconfigured' | 'configured' | 'closed';

export type WebCodecsErrorCallback = (error: DOMException) => void;
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Use string literal unions for TypeScript enums
- Use correct default values
- Export all types

### DO NOT
- Use TypeScript enum keyword (spec uses string unions)
- Add values not in spec

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] HardwareAcceleration has 3 values
- [ ] AlphaOption has 2 values
- [ ] LatencyMode has 2 values
- [ ] VideoEncoderBitrateMode has 3 values
- [ ] CodecState has 3 values
- [ ] VideoEncoderEncodeOptions.keyFrame defaults to false
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.9-hardware-acceleration.md`
- `docs/specs/7-configurations/7.10-alpha-option.md`
- `docs/specs/7-configurations/7.11-latency-mode.md`
- `docs/specs/7-configurations/7.13-videoencoderencodeoptions.md`
- `docs/specs/7-configurations/7.14-videoencoderbitratemode.md`
- `docs/specs/7-configurations/7.15-codecstate.md`
- `docs/specs/7-configurations/7.16-webcodecserrorcallback.md`
- `lib/types.ts` - Current definitions

### Reference Only (Don't modify)
- Browser WebCodecs TypeScript definitions

## Dependencies

### Waits For (Upstream)
- None (basic types)

### Blocks (Downstream)
- TODO-7.5-7.8: Config types use these enums
- TODO-3-6: Codec classes use these types

### Can Run In Parallel With
- TODO-7.1-7.4

## Test Requirements

### Unit Tests Required
1. HardwareAcceleration accepts all three values
2. AlphaOption accepts both values
3. LatencyMode accepts both values
4. VideoEncoderBitrateMode accepts all three values
5. CodecState accepts all three values
6. encode() with {keyFrame: true} works
7. encode() with {keyFrame: false} works
8. encode() with {} uses default false

### Edge Cases to Test
1. Invalid enum value rejected by TypeScript

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
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.9-7.16.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.9-7.16.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
